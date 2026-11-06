import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { ensureNotificationSchema } from "@/lib/server-notification-repository"
import { processPendingTaskEmails } from "@/lib/server-notification-email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  const supplied = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`
  if (!secret || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    await ensureNotificationSchema()
    return NextResponse.json(await processPendingTaskEmails(), { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Email queue processing failed" }, { status: 500 })
  }
}
