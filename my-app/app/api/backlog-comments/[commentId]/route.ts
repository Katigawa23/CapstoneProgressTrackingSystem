import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { COMMENT_BODY_MAX_LENGTH } from "@/lib/text-validation"
import {
  deleteBacklogComment,
  updateBacklogComment,
} from "@backend/repositories/comments-repository"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const { commentId } = await params
    const body = (await request.json()) as {
      body?: string
      attachments?: string[]
    }
    const trimmedBody =
      typeof body.body === "string" ? body.body.trim() : undefined
    const normalizedAttachments = Array.isArray(body.attachments)
      ? body.attachments.map((item) => String(item).trim()).filter(Boolean)
      : undefined

    if (
      typeof trimmedBody === "string" &&
      Array.isArray(normalizedAttachments) &&
      !trimmedBody &&
      normalizedAttachments.length === 0
    ) {
      return NextResponse.json(
        { error: "A comment must include text or at least one attachment." },
        { status: 400 }
      )
    }

    if (
      typeof trimmedBody === "string" &&
      trimmedBody.length > COMMENT_BODY_MAX_LENGTH
    ) {
      return NextResponse.json(
        {
          error: `Comment must be ${COMMENT_BODY_MAX_LENGTH} characters or fewer.`,
        },
        { status: 400 }
      )
    }

    const comment = await updateBacklogComment(commentId, user.id, {
      body: trimmedBody,
      attachments: normalizedAttachments,
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
    const user = await requireAuthenticatedUser()
    const { commentId } = await params
    const deleted = await deleteBacklogComment(commentId, user.id)

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
