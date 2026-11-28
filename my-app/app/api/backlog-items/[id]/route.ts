import { canTransitionTaskStatus } from "@/lib/task-status-transitions"
import { canPersistProjectWorkflow, getProjectWorkflow } from "@/lib/server-project-workflow"
import { canAccessTask } from "@/lib/server-project-access"
import { listBacklogSubmissions, listBacklogWebLinks } from "@backend/repositories/attachments-repository"
import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { rejectSuperAdminMutation } from "@/lib/server-admin-viewer"
import { isAssignedCoordinator } from "@/lib/server-coordinator-assignments"
import {
  BacklogDescriptionLockedError,
  BacklogItemNameConflictError,
  BacklogWorkflowConflictError,
  getBacklogCompletionLock,
  isBacklogItemAssignedToAdviser,
  updateBacklogItem,
} from "@backend/repositories/tasks-repository"
import { createNotification, notifyProjectAdvisers } from "@/lib/server-notification-repository"

function normalizeOptionalDate(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : null
}

export async function PATCH(
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
    const body = (await request.json()) as {
      parentId?: string | null
      title?: string
      description?: string
      startDate?: string | null
      dueDate?: string | null
      status?: string
      checked?: boolean
      assigneeId?: string | null
      priority?: "Low" | "Medium" | "High"
      orderIndex?: number
      expectedStatus?: string
    }

    const completionLock = await getBacklogCompletionLock(id)
    if (completionLock?.completed || completionLock?.ancestorCompleted) {
      return NextResponse.json({ error: "Completed tasks are locked." }, { status: 409 })
    }

    if (typeof body.parentId === "string") {
      const parentLock = await getBacklogCompletionLock(body.parentId)
      if (parentLock?.completed || parentLock?.ancestorCompleted) {
        return NextResponse.json({ error: "Cannot move work into a completed task." }, { status: 409 })
      }
    }

    if ("priority" in body) {
      return NextResponse.json(
        { error: "Task priority is set when the task is created and can no longer be changed." },
        { status: 403 }
      )
    }

    const editsCoordinatorReadOnlyFields =
      "status" in body ||
      "checked" in body ||
      "orderIndex" in body ||
      "parentId" in body ||
      "assigneeId" in body

    if (
      editsCoordinatorReadOnlyFields &&
      (user.id === "tester-coordinator" ||
        (user.role === "faculty" && await isAssignedCoordinator(user.id)))
    ) {
      return NextResponse.json(
        { error: "Coordinators have view-only access to task status, placement, and assignment." },
        { status: 403 }
      )
    }
    const editsAdviserOnlyFields =
      "title" in body ||
      "startDate" in body ||
      "dueDate" in body ||
      "assigneeId" in body

    if (
      editsAdviserOnlyFields &&
      (user.role !== "faculty" ||
        !(await isBacklogItemAssignedToAdviser(id, user.id, user.name)))
    ) {
      return NextResponse.json(
        { error: "Only the assigned adviser can edit task fields." },
        { status: 403 }
      )
    }

    const workflow = completionLock && typeof body.status === "string" && body.status !== completionLock.status
      ? await getProjectWorkflow(completionLock.projectId)
      : undefined
    if (completionLock && editsCoordinatorReadOnlyFields) {
      const currentStatus = completionLock.status
      if (body.expectedStatus !== undefined && body.expectedStatus !== currentStatus) {
        return NextResponse.json({ error: "Someone already moved this task. The latest status will be loaded." }, { status: 409 })
      }

      if (
        (body.status !== undefined && (body.status !== currentStatus || user.role === "student") &&
          !canTransitionTaskStatus(currentStatus, body.status, user.role, workflow?.transitions)) ||
        (user.role === "student" && ("orderIndex" in body || "parentId" in body || ("checked" in body && body.status !== "inprogress"))) ||
        (user.role === "faculty" && !(await isBacklogItemAssignedToAdviser(id, user.id, user.name)))
      ) {
        return NextResponse.json({ error: "This status change is not allowed." }, { status: 403 })
      }
    }

    const updates = {
      ...("parentId" in body
        ? {
            parentId:
              typeof body.parentId === "string" && body.parentId.trim().length > 0
                ? body.parentId.trim()
                : null,
          }
        : {}),
      ...(typeof body.title === "string" ? { title: body.title.trim() } : {}),
      ...(typeof body.description === "string"
        ? { description: body.description.trim() }
        : {}),
      ...("startDate" in body
        ? { startDate: normalizeOptionalDate(body.startDate) }
        : {}),
      ...("dueDate" in body
        ? { dueDate: normalizeOptionalDate(body.dueDate) }
        : {}),
      ...(typeof body.status === "string" ? { status: body.status } : {}),
      ...(typeof body.checked === "boolean" ? { checked: body.checked } : {}),
      ...("assigneeId" in body ? { assigneeId: body.assigneeId ?? null } : {}),
      ...(typeof body.orderIndex === "number" && Number.isFinite(body.orderIndex)
        ? { orderIndex: body.orderIndex }
        : {}),
    }

    if (completionLock?.status === "todo" && updates.status === "inprogress") {
      const [files, links] = await Promise.all([
        listBacklogSubmissions(id, user.id),
        listBacklogWebLinks(id, user.id),
      ])
      if (!files.length && !links.length) {
        return NextResponse.json(
          { error: "Upload a file or submit a web link before moving this task to In Progress." },
          { status: 409 }
        )
      }
    }

    const workflowGuard = workflow && completionLock && canPersistProjectWorkflow()
      ? {
          projectId: completionLock.projectId,
          revision: workflow.revision,
          wipLimit: workflow.boardColumns.find((column) => column.id === updates.status)?.wipLimit,
        }
      : undefined
    const item = await updateBacklogItem(id, user.id, updates, user.role, completionLock?.status, workflowGuard)

    if (!item) {
      return NextResponse.json(
        { error: "The task could not be updated. It may have changed." },
        { status: 409 }
      )
    }

    if ("assigneeId" in body && item.assigneeId && completionLock?.assigneeId !== item.assigneeId) {
      await createNotification({
        recipientUserId: item.assigneeId,
        actorUserId: user.id,
        projectId: item.projectId,
        backlogItemId: item.id,
        type: "task_assigned",
        title: "Task assigned to you",
        message: `${user.name} assigned “${item.title}” to you.`,
        href: `/dashboard/board?taskId=${encodeURIComponent(item.id)}`,
        dedupeKey: `task-assigned:${item.id}:${item.assigneeId}:${completionLock?.updatedAt ?? item.createdAt}`,
      })
    }

    const isAdviserReview = user.role === "faculty" && item.assigneeId &&
      (body.status === "completed" || body.status === "revision") &&
      completionLock?.status !== body.status &&
      await isBacklogItemAssignedToAdviser(id, user.id, user.name)

    if (isAdviserReview && body.status === "completed") {
      await createNotification({
        recipientUserId: item.assigneeId,
        actorUserId: user.id,
        projectId: item.projectId,
        backlogItemId: item.id,
        type: "task_approved",
        title: "Task approved by adviser",
        message: `${user.name} approved “${item.title}”.`,
        href: `/dashboard/board?taskId=${encodeURIComponent(item.id)}`,
        dedupeKey: `task-approved:${item.id}:${completionLock?.updatedAt ?? item.createdAt}`,
      })
    }

    if (isAdviserReview && body.status === "revision") {
      await createNotification({
        recipientUserId: item.assigneeId, actorUserId: user.id, projectId: item.projectId,
        backlogItemId: item.id, type: "task_revision_requested", title: "Task returned for revision",
        message: `${user.name} returned “${item.title}” for revision. Open the task to check the feedback.`,
        href: `/dashboard/board?taskId=${encodeURIComponent(item.id)}`,
        dedupeKey: `task-revision:${item.id}:${completionLock?.updatedAt ?? item.createdAt}`,
      })
    }

    if (user.role === "student" && (body.status === "inreview" || body.status === "completed")) {
      await notifyProjectAdvisers({
        projectId: item.projectId,
        actorUserId: user.id,
        backlogItemId: item.id,
        taskTitle: item.title,
        actorName: user.name,
      })
    }

    revalidateTag("backlog-items", "max")
    revalidateTag("backlog-comments", "max")

    return NextResponse.json({ item })
  } catch (error) {
    if (error instanceof BacklogDescriptionLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    if (error instanceof BacklogItemNameConflictError || error instanceof BacklogWorkflowConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    console.error("Failed to update backlog item", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : "Failed to update backlog item",
      },
      { status: 500 }
    )
  }
}
