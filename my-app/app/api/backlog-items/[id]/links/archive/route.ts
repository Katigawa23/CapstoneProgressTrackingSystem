import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { archiveBacklogWebLink } from "@backend/repositories/attachments-repository"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const { id } = await params
    const url = new URL(request.url)
    const linkId = url.searchParams.get("linkId")?.trim()

    if (!linkId) {
      return NextResponse.json({ error: "linkId is required" }, { status: 400 })
    }

    const link = await archiveBacklogWebLink(id, linkId, user.id, user.role)

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 })
    }

    revalidateTag("backlog-items", "max")
    return NextResponse.json({ link })
  } catch (error) {
    console.error("Failed to archive backlog web link", error)
    return NextResponse.json(
      { error: "Failed to archive backlog web link" },
      { status: 500 }
    )
  }
}
