import { isAssignedCoordinator } from "@/lib/server-coordinator-assignments"
import { isBacklogItemAssignedToAdviser } from "@backend/repositories/tasks-repository"
import { canAccessTask } from "@/lib/server-project-access"
import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { rejectCompletedTaskMutation } from "@/lib/server-completed-task"
import { rejectSuperAdminMutation } from "@/lib/server-admin-viewer"
import { deleteBacklogSubmission } from "@backend/repositories/attachments-repository"

export async function DELETE(
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
    const submissionId = url.searchParams.get("submissionId")?.trim()

    if (!submissionId) {
      return NextResponse.json({ error: "submissionId is required" }, { status: 400 })
    }

    if (user.role === "admin" || user.id === "tester-coordinator" ||
        (user.role === "faculty" && await isAssignedCoordinator(user.id))) {
      return NextResponse.json({ error: "You cannot delete files in this project." }, { status: 403 })
    }
    const mayManageOtherFiles = user.role === "faculty" &&
      await isBacklogItemAssignedToAdviser(id, user.id, user.name)
    const submission = await deleteBacklogSubmission(id, submissionId, user.id, mayManageOtherFiles ? "faculty" : "student")

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 })
    }

    revalidateTag("backlog-items", "max")
    return NextResponse.json({ submission })
  } catch (error) {
    console.error("Failed to delete backlog submission", error)
    return NextResponse.json(
      { error: "Failed to delete backlog submission" },
      { status: 500 }
    )
  }
}
