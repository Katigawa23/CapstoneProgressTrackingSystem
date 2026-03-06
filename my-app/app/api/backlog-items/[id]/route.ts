import { NextResponse } from "next/server"

import {
  deleteBacklogItem,
  updateBacklogItem,
} from "@/lib/backlog-repository"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = (await request.json()) as {
      title?: string
      description?: string
      status?: string
      checked?: boolean
      assigneeId?: string | null
    }

    const item = await updateBacklogItem(id, {
      title: body.title?.trim(),
      description: typeof body.description === "string" ? body.description.trim() : undefined,
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
