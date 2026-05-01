import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import {
  addBacklogItemToSprint,
  removeBacklogItemFromSprint,
} from "@backend/repositories/sprint-repository"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const { id } = await params
    const body = (await request.json()) as {
      backlogItemId?: string
    }

    const backlogItemId = body.backlogItemId?.trim()

    if (!backlogItemId) {
      return NextResponse.json({ error: "backlogItemId is required" }, { status: 400 })
    }

    const added = await addBacklogItemToSprint(id, backlogItemId, user.id)

    if (!added) {
      return NextResponse.json({ error: "Sprint or backlog item not found" }, { status: 404 })
    }

    revalidateTag("backlog-items", "max")

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error("Failed to add backlog item to sprint", error)
    return NextResponse.json(
      { error: "Failed to add backlog item to sprint" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const { id } = await params
    const body = (await request.json()) as {
      backlogItemId?: string
    }

    const backlogItemId = body.backlogItemId?.trim()

    if (!backlogItemId) {
      return NextResponse.json({ error: "backlogItemId is required" }, { status: 400 })
    }

    const removed = await removeBacklogItemFromSprint(id, backlogItemId, user.id)

    if (!removed) {
      return NextResponse.json({ error: "Sprint or backlog item not found" }, { status: 404 })
    }

    revalidateTag("backlog-items", "max")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to remove backlog item from sprint", error)
    return NextResponse.json(
      { error: "Failed to remove backlog item from sprint" },
      { status: 500 }
    )
  }
}
