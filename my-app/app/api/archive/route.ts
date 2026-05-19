import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { listBacklogItems } from "@backend/repositories/tasks-repository"
import { listArchivedBacklogAttachments } from "@backend/repositories/attachments-repository"

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser()
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")?.trim()

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 })
    }

    const [items, attachments] = await Promise.all([
      listBacklogItems(projectId, user.id, { archived: true, limit: 500, offset: 0 }),
      listArchivedBacklogAttachments(projectId, user.id),
    ])

    return NextResponse.json({ items, attachments })
  } catch (error) {
    console.error("Failed to load archive items", error)
    return NextResponse.json(
      { error: "Failed to load archive items" },
      { status: 500 }
    )
  }
}
