import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { stripEmoji, validateDisplayName } from "@/lib/text-validation"
import {
  BacklogItemNameConflictError,
  createBacklogItem,
  updateBacklogItem,
} from "@backend/repositories/backlog-repository"

const allowedStatuses = new Set([
  "todo",
  "inprogress",
  "inreview",
  "revision",
  "completed",
])

function normalizeOptionalDate(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const { id: parentId } = await params
    const body = (await request.json()) as {
      projectId?: string
      title?: string
      description?: string
      startDate?: string | null
      dueDate?: string | null
      status?: string
      assigneeId?: string | null
    }

    const rawTitle = body.title?.trim()
    const title = rawTitle ? stripEmoji(rawTitle).trim() : rawTitle
    const projectId = body.projectId?.trim()
    const normalizedParentId = parentId.trim()
    const status =
      typeof body.status === "string" && allowedStatuses.has(body.status)
        ? body.status
        : "todo"

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const titleValidationError = validateDisplayName(title, "Subtask name")

    if (titleValidationError) {
      return NextResponse.json({ error: titleValidationError }, { status: 400 })
    }

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 })
    }

    const createdItem = await createBacklogItem(
      {
        projectId,
        parentId: normalizedParentId,
        title,
        description: body.description?.trim() ?? "",
        startDate: normalizeOptionalDate(body.startDate),
        dueDate: normalizeOptionalDate(body.dueDate),
        status,
        checked: false,
        assigneeId: body.assigneeId ?? null,
      },
      user.id
    )

    if (!createdItem) {
      return NextResponse.json(
        { error: "Parent task or project not found" },
        { status: 404 }
      )
    }

    const persistedItem =
      createdItem.parentId === normalizedParentId
        ? createdItem
        : await updateBacklogItem(createdItem.id, user.id, {
            parentId: normalizedParentId,
          }, user.role)

    if (!persistedItem || persistedItem.parentId !== normalizedParentId) {
      return NextResponse.json(
        { error: "Failed to persist subtask parent relationship" },
        { status: 500 }
      )
    }

    revalidateTag("backlog-items", "max")
    revalidateTag("backlog-comments", "max")

    return NextResponse.json({ item: persistedItem }, { status: 201 })
  } catch (error) {
    if (error instanceof BacklogItemNameConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    console.error("Failed to create subtask", error)
    return NextResponse.json(
      { error: "Failed to create subtask" },
      { status: 500 }
    )
  }
}
