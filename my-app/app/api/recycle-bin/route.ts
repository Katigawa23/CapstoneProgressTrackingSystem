import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { listDeletedBacklogAttachments } from "@backend/repositories/backlog-attachment-repository"
import { listBacklogItems } from "@backend/repositories/backlog-repository"

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser()
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")?.trim()

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 })
    }

    const [items, attachments] = await Promise.all([
      listBacklogItems(projectId, user.id, {
        archived: false,
        deleted: true,
        limit: 500,
      }),
      listDeletedBacklogAttachments(projectId, user.id),
    ])

    return NextResponse.json({ items, attachments })
  } catch (error) {
    console.error("Failed to load recycle bin items", error)
    return NextResponse.json(
      { error: "Failed to load recycle bin items" },
      { status: 500 }
    )
  }
}
