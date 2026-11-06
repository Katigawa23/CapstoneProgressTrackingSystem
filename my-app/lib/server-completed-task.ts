import { NextResponse } from "next/server"
import { getBacklogCompletionLock } from "@backend/repositories/tasks-repository"

export async function rejectCompletedTaskMutation(taskId: string) {
  const lock = await getBacklogCompletionLock(taskId)
  if (lock?.completed || lock?.ancestorCompleted) {
    return NextResponse.json(
      { error: "Completed tasks are locked. The assigned adviser must reopen the task for revision first." },
      { status: 409 }
    )
  }
  return null
}
