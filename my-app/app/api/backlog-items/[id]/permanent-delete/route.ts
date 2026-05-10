import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { permanentlyDeleteBacklogItem } from "@backend/repositories/backlog-repository"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const { id } = await params
    const deleted = await permanentlyDeleteBacklogItem(id, user.id, user.role)

    if (!deleted) {
      return NextResponse.json(
        { error: "Deleted item not found" },
        { status: 404 }
      )
    }

    revalidateTag("backlog-items", "max")
    revalidateTag("backlog-comments", "max")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to permanently delete backlog item", error)
    return NextResponse.json(
      { error: "Failed to permanently delete backlog item" },
      { status: 500 }
    )
  }
}
