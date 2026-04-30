import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { addBacklogItemToSprint } from "@backend/repositories/sprint-repository"

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
