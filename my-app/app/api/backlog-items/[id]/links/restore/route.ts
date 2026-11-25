import { canAccessTask } from "@/lib/server-project-access"
import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { rejectCompletedTaskMutation } from "@/lib/server-completed-task"
import { rejectSuperAdminMutation } from "@/lib/server-admin-viewer"
import { restoreBacklogWebLink } from "@backend/repositories/attachments-repository"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const readOnlyResponse = rejectSuperAdminMutation(user.id)
    if (readOnlyResponse) return readOnlyResponse
    const { id } = await params
    if (!(await canAccessTask(id, user.id))) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }
    const completionResponse = await rejectCompletedTaskMutation(id)
    if (completionResponse) return completionResponse
    const url = new URL(request.url)
    const linkId = url.searchParams.get("linkId")?.trim()

    if (!linkId) {
      return NextResponse.json({ error: "linkId is required" }, { status: 400 })
    }

    const link = await restoreBacklogWebLink(id, linkId, user.id, user.role)

    if (!link) {
      return NextResponse.json({ error: "Archived link not found" }, { status: 404 })
    }

    revalidateTag("backlog-items", "max")
    return NextResponse.json({ link })
  } catch (error) {
    console.error("Failed to restore backlog web link", error)
    return NextResponse.json(
      { error: "Failed to restore backlog web link" },
      { status: 500 }
    )
  }
}
