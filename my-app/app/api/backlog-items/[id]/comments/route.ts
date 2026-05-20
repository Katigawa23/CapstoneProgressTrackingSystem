import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { getMicrosoftTenantId } from "@backend/auth/microsoft"
import { requireAuthenticatedUser } from "@/lib/server-auth"
import { COMMENT_BODY_MAX_LENGTH } from "@/lib/text-validation"
import {
  createBacklogComment,
  listBacklogComments,
} from "@backend/repositories/comments-repository"
import { saveMicrosoftAccountLogin } from "@backend/repositories/users-repository"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const { id } = await params
    const comments = await listBacklogComments(id, user.id)
    return NextResponse.json({ comments })
  } catch (error) {
    console.error("Failed to load backlog comments", error)
    return NextResponse.json(
      { error: "Failed to load backlog comments" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    await saveMicrosoftAccountLogin(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      user.tenantId?.trim() || getMicrosoftTenantId()
    )
    const { id } = await params
    const body = (await request.json()) as {
      body?: string
      attachments?: string[]
    }
    const trimmedBody = body.body?.trim() ?? ""
    const normalizedAttachments = Array.isArray(body.attachments)
      ? body.attachments
          .map((item) => String(item).trim())
          .filter(Boolean)
      : []

    if (!trimmedBody && normalizedAttachments.length === 0) {
      return NextResponse.json(
        { error: "A comment must include text or at least one attachment." },
        { status: 400 }
      )
    }

    if (trimmedBody.length > COMMENT_BODY_MAX_LENGTH) {
      return NextResponse.json(
        {
          error: `Comment must be ${COMMENT_BODY_MAX_LENGTH} characters or fewer.`,
        },
        { status: 400 }
      )
    }

    const comment = await createBacklogComment({
      backlogItemId: id,
      authorUserId: user.id,
      author: user.name?.trim() || user.email?.trim() || "Unknown User",
      body: trimmedBody,
      attachments: normalizedAttachments,
    }, user.id)

    if (!comment) {
      return NextResponse.json(
        { error: "Backlog item not found" },
        { status: 404 }
      )
    }

    revalidateTag("backlog-comments", "max")
    revalidateTag("backlog-items", "max")

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    console.error("Failed to create backlog comment", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : "Failed to create backlog comment",
      },
      { status: 500 }
    )
  }
}
