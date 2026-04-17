import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import {
  deleteBacklogComment,
  updateBacklogComment,
} from "@/backend/repositories/backlog-comment-repository"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { commentId } = await params
    const body = (await request.json()) as {
      body?: string
      attachments?: string[]
    }

    const comment = await updateBacklogComment(commentId, {
      body: typeof body.body === "string" ? body.body.trim() : undefined,
      attachments: Array.isArray(body.attachments)
        ? body.attachments.map((item) => String(item).trim()).filter(Boolean)
        : undefined,
    })

    if (!comment) {
      return NextResponse.json(
        { error: "Comment not found or unchanged" },
        { status: 404 }
      )
    }

    revalidateTag("backlog-comments", "max")
    revalidateTag("backlog-items", "max")

    return NextResponse.json({ comment })
  } catch (error) {
    console.error("Failed to update comment", error)
    return NextResponse.json(
      { error: "Failed to update comment" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { commentId } = await params
    const deleted = await deleteBacklogComment(commentId)

    if (!deleted) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    revalidateTag("backlog-comments", "max")
    revalidateTag("backlog-items", "max")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete comment", error)
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 }
    )
  }
}
