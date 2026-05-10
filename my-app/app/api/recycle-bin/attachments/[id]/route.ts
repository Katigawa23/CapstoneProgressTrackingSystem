import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { permanentlyDeleteBacklogAttachment } from "@backend/repositories/backlog-attachment-repository"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const { id } = await params
    const deleted = await permanentlyDeleteBacklogAttachment(id, user.id, user.role)

    if (!deleted) {
      return NextResponse.json(
        { error: "Deleted resource not found" },
        { status: 404 }
      )
    }

    revalidateTag("backlog-items", "max")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to permanently delete resource", error)
    return NextResponse.json(
      { error: "Failed to permanently delete resource" },
      { status: 500 }
    )
  }
}
