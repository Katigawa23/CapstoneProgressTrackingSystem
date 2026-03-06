import { NextResponse } from "next/server"

import { updateBacklogItem } from "@/lib/backlog-repository"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = (await request.json()) as {
      status?: string
      checked?: boolean
    }

    const item = await updateBacklogItem(id, {
      status: body.status,
      checked: body.checked,
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
