import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { archiveBacklogItem } from "@backend/repositories/backlog-repository"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const { id } = await params
    const items = await archiveBacklogItem(id, user.id, user.role)

    if (items.length === 0) {
      return NextResponse.json(
        { error: "Backlog item not found" },
        { status: 404 }
      )
    }

    revalidateTag("backlog-items", "max")
    revalidateTag("backlog-comments", "max")

    return NextResponse.json({ items })
  } catch (error) {
    console.error("Failed to archive backlog item", error)
    return NextResponse.json(
      { error: "Failed to archive backlog item" },
      { status: 500 }
    )
  }
}
