import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { rejectSuperAdminMutation } from "@/lib/server-admin-viewer"
import { isAssignedCoordinator } from "@/lib/server-coordinator-assignments"
import {
  BacklogDescriptionLockedError,
  BacklogItemNameConflictError,
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
    }

    const completionLock = await getBacklogCompletionLock(id)
    if (completionLock?.completed || completionLock?.ancestorCompleted) {
      const canReopen = !completionLock.ancestorCompleted && completionLock.completed &&
        body.status === "revision" && (body.checked === undefined || body.checked === false) &&
        Object.keys(body).every((key) => ["status", "checked", "parentId"].includes(key)) &&
        (!("parentId" in body) || (body.parentId ?? null) === completionLock.parentId) &&
        user.role === "faculty" &&
        user.id !== "tester-coordinator" && !(await isAssignedCoordinator(user.id)) &&
        await isBacklogItemAssignedToAdviser(id, user.id, user.name)
      if (!canReopen) {
        return NextResponse.json({ error: "Completed tasks are locked. Only the assigned adviser can reopen them for revision." }, { status: 409 })
      }
      body.checked = false
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

    const item = await updateBacklogItem(id, user.id, updates, user.role)

    if (!item) {
      return NextResponse.json(
        { error: "Backlog item not found or unchanged" },
        { status: 404 }
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
    if (error instanceof BacklogItemNameConflictError) {
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
