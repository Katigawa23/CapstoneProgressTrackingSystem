import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import {
  deleteBacklogItem,
  updateBacklogItem,
} from "@backend/repositories/backlog-repository"

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
      orderIndex?: number
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

    revalidateTag("backlog-items", "max")
    revalidateTag("backlog-comments", "max")

    return NextResponse.json({ item })
  } catch (error) {
    console.error("Failed to update backlog item", error)
    return NextResponse.json(
      { error: "Failed to update backlog item" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const { id } = await params
    const deleted = await deleteBacklogItem(id, user.id, user.role)

    if (!deleted) {
      return NextResponse.json(
        { error: "Backlog item not found" },
        { status: 404 }
      )
    }

    revalidateTag("backlog-items", "max")
    revalidateTag("backlog-comments", "max")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete backlog item", error)
    return NextResponse.json(
      { error: "Failed to delete backlog item" },
      { status: 500 }
    )
  }
}
