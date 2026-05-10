import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { restoreDeletedBacklogItem } from "@backend/repositories/backlog-repository"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const { id } = await params
    const restored = await restoreDeletedBacklogItem(id, user.id, user.role)

    if (!restored) {
      return NextResponse.json(
        { error: "Deleted item not found or cannot be restored" },
        { status: 404 }
      )
    }

    revalidateTag("backlog-items", "max")
    revalidateTag("backlog-comments", "max")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to restore deleted backlog item", error)
    return NextResponse.json(
      { error: "Failed to restore deleted backlog item" },
      { status: 500 }
    )
  }
}
