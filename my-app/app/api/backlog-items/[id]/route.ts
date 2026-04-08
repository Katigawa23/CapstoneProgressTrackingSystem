import { NextResponse } from "next/server"

import {
  deleteBacklogItem,
  updateBacklogItem,
} from "@/backend/repositories/backlog-repository"

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
    const { id } = await params
    const body = (await request.json()) as {
      title?: string
      description?: string
      startDate?: string | null
      dueDate?: string | null
      status?: string
      checked?: boolean
      assigneeId?: string | null
    }

    const item = await updateBacklogItem(id, {
      title: typeof body.title === "string" ? body.title.trim() : undefined,
      description: typeof body.description === "string" ? body.description.trim() : undefined,
      startDate: "startDate" in body ? normalizeOptionalDate(body.startDate) : undefined,
      dueDate: "dueDate" in body ? normalizeOptionalDate(body.dueDate) : undefined,
      status: body.status,
      checked: body.checked,
      assigneeId: body.assigneeId,
    })

    if (!item) {
      return NextResponse.json(
        { error: "Backlog item not found or unchanged" },
        { status: 404 }
      )
    }

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
    const { id } = await params
    const deleted = await deleteBacklogItem(id)

    if (!deleted) {
      return NextResponse.json(
        { error: "Backlog item not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete backlog item", error)
    return NextResponse.json(
      { error: "Failed to delete backlog item" },
      { status: 500 }
    )
  }
}
