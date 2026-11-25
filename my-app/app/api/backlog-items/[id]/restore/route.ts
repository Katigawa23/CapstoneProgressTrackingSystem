import { isAssignedCoordinator } from "@/lib/server-coordinator-assignments"
import { canAccessTask } from "@/lib/server-project-access"
import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { rejectCompletedTaskMutation } from "@/lib/server-completed-task"
import { rejectSuperAdminMutation } from "@/lib/server-admin-viewer"
import { isBacklogItemAssignedToAdviser, restoreBacklogItem } from "@backend/repositories/tasks-repository"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const readOnlyResponse = rejectSuperAdminMutation(user.id)
    if (readOnlyResponse) return readOnlyResponse
    if (user.role !== "faculty" || user.id === "tester-coordinator" || await isAssignedCoordinator(user.id)) {
      return NextResponse.json(
        { error: "Only the project adviser can restore archived tasks." },
        { status: 403 }
      )
    }
    const { id } = await params
    if (!(await canAccessTask(id, user.id))) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }
    if (!(await isBacklogItemAssignedToAdviser(id, user.id, user.name))) {
      return NextResponse.json({ error: "Only the project adviser can restore archived tasks." }, { status: 403 })
    }
    const completionResponse = await rejectCompletedTaskMutation(id)
    if (completionResponse) return completionResponse
    const items = await restoreBacklogItem(id, user.id, user.role)

    if (items.length === 0) {
      return NextResponse.json(
        { error: "Archived backlog item not found" },
        { status: 404 }
      )
    }

    revalidateTag("backlog-items", "max")
    revalidateTag("backlog-comments", "max")

    return NextResponse.json({ items })
  } catch (error) {
    console.error("Failed to restore backlog item", error)
    return NextResponse.json(
      { error: "Failed to restore backlog item" },
      { status: 500 }
    )
  }
}
