import { NextResponse } from "next/server"
import { readAuthenticatedUser } from "@/lib/server-auth"
import { getDb } from "@/lib/server-db"
import { ensureLandingBannerSchema, listLandingBannerSlides } from "@/lib/server-landing-banner"
import { LANDING_BANNER_MAX_BYTES, LANDING_BANNER_MAX_IMAGES, type LandingBannerSlide } from "@/lib/landing-banner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

function identifyImage(bytes: Buffer) {
  if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "image/jpeg"
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png"
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp"
  return null
}

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id")
    if (id !== null && !uuidPattern.test(id)) return new Response(null, { status: 404 })
    if (id) {
      await ensureLandingBannerSchema()
      const { rows: [slide] } = await getDb().query<{ image: Buffer; mime: string }>(
        "select image, mime from public.landing_banner_slides where id=$1", [id],
      )
      if (!slide) return new Response(null, { status: 404 })
      return new Response(new Uint8Array(slide.image), {
        headers: { "Content-Type": slide.mime, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" },
      })
    }
    const slides = await listLandingBannerSlides()
    return NextResponse.json({ slides }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Could not load landing banner", error)
    return NextResponse.json({ error: "Could not load the landing page banner." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await readAuthenticatedUser()
    if (user?.role !== "admin" || user.id !== "tester-admin") {
      return NextResponse.json({ error: "Super Admin access is required." }, { status: 403 })
    }
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 })
    }
    if (Number(request.headers.get("content-length")) > LANDING_BANNER_MAX_BYTES + 16384) {
      return NextResponse.json({ error: "Images must be 2 MB or smaller." }, { status: 413 })
    }
    const form = await request.formData().catch(() => null)
    const action = form?.get("action")
    const id = form?.get("id")
    if (!form || !(action === "add" || action === "replace" || action === "remove" || action === "up" || action === "down") ||
      (action !== "add" && (typeof id !== "string" || !uuidPattern.test(id)))) {
      return NextResponse.json({ error: "Invalid banner action." }, { status: 400 })
    }

    let image: Buffer | undefined
    let mime: string | null = null
    const alt = "Landing page banner picture"
    if (action === "add" || action === "replace") {
      const file = form.get("image")
      if (!(file instanceof File) || !file.size || file.size > LANDING_BANNER_MAX_BYTES) {
        return NextResponse.json({ error: "Choose an image up to 2 MB." }, { status: 400 })
      }
      image = Buffer.from(await file.arrayBuffer())
      mime = identifyImage(image)
      if (!mime || mime !== file.type) {
        return NextResponse.json({ error: "Choose a valid JPG, PNG, or WebP image." }, { status: 400 })
      }
    }

    await ensureLandingBannerSchema()
    const client = await getDb().connect()
    try {
      await client.query("begin")
      await client.query("lock table public.landing_banner_slides in share row exclusive mode")
      const { rows } = await client.query<{ id: string; position: number }>(
        "select id, position from public.landing_banner_slides order by position, id",
      )
      const index = rows.findIndex((row) => row.id === id)
      if (action === "add" && rows.length >= LANDING_BANNER_MAX_IMAGES || action !== "add" && index === -1) {
        await client.query("rollback")
        return NextResponse.json({ error: action === "add" ? "The banner already has eight pictures." : "This picture is no longer available." }, { status: 409 })
      }
      if (image) {
        const { rows: [match] } = await client.query<{ duplicate: boolean }>(
          "select exists (select 1 from public.landing_banner_slides where image = $1::bytea) as duplicate",
          [image],
        )
        if (match.duplicate) {
          await client.query("rollback")
          return NextResponse.json({ error: "This picture is already in the banner. Choose a different image." }, { status: 409 })
        }
      }
      if (action === "add") {
        await client.query("insert into public.landing_banner_slides (alt, mime, image, position) values ($1,$2,$3,$4)",
          [alt, mime, image, (rows.at(-1)?.position ?? 0) + 1])
      } else if (action === "replace") {
        await client.query("update public.landing_banner_slides set alt=$2, mime=$3, image=$4, revision=gen_random_uuid() where id=$1",
          [id, alt, mime, image])
      } else if (action === "remove") {
        await client.query("delete from public.landing_banner_slides where id=$1", [id])
      } else {
        const neighbor = rows[index + (action === "up" ? -1 : 1)]
        if (neighbor) {
          await client.query("update public.landing_banner_slides set position=case when id=$1 then $3::integer else $4::integer end where id in ($1,$2)",
            [id, neighbor.id, neighbor.position, rows[index].position])
        }
      }
      const result = await client.query<LandingBannerSlide>("select id, alt, revision from public.landing_banner_slides order by position, id")
      await client.query("commit")
      return NextResponse.json({ slides: result.rows })
    } catch (error) {
      await client.query("rollback")
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error("Could not update landing banner", error)
    return NextResponse.json({ error: "Could not save the landing page banner." }, { status: 500 })
  }
}
