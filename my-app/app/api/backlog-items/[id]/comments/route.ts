import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { getPreferredStorageMode } from "@backend/config/storage-mode"
import { getDb } from "@backend/db/connection"
import { COMMENT_ASSET_ENCODED_LIMIT, readCommentAsset } from "@/lib/comment-assets"
import { getMicrosoftTenantId } from "@backend/auth/microsoft"
import { requireAuthenticatedUser } from "@/lib/server-auth"
import {
  isSuperAdminViewer,
  rejectSuperAdminMutation,
} from "@/lib/server-admin-viewer"
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

    if (isSuperAdminViewer(user.id)) {
      return NextResponse.json({ comments: [], restricted: true })
    }

    const { id } = await params
    const comments = await listBacklogComments(id, user.id)
    if (getPreferredStorageMode() === "file" || !comments.length) return NextResponse.json({ comments })

    await ensureCommentLikes()
    const { rows } = await getDb().query<{ comment_id: string; likeCount: number; liked: boolean }>(
      `select comment_id, count(*)::int as "likeCount", bool_or(user_id = $2) as liked
       from comment_likes where comment_id = any($1::uuid[]) group by comment_id`,
      [comments.map((comment) => comment.id), user.id]
    )
    const likes = new Map(rows.map(({ comment_id, ...reaction }) => [comment_id, reaction]))
    return NextResponse.json({ comments: comments.map((comment) => ({ ...comment, ...likes.get(comment.id) })) })
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
    const readOnlyResponse = rejectSuperAdminMutation(user.id)
    if (readOnlyResponse) return readOnlyResponse
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
      requestId?: string
      replyToCommentId?: string
    }
    const trimmedBody = body.body?.trim() ?? ""
    const requestId = typeof body.requestId === "string" ? body.requestId.trim() : ""
    const normalizedAttachments = Array.isArray(body.attachments)
      ? body.attachments
          .map((item) => String(item).trim())
          .filter(Boolean)
      : []

    if (normalizedAttachments.reduce((size, asset) => size + asset.length, 0) > COMMENT_ASSET_ENCODED_LIMIT ||
        normalizedAttachments.some((asset) => !readCommentAsset(asset))) {
      return NextResponse.json({ error: "Invalid comment attachments or combined size exceeds 2 MB." }, { status: 400 })
    }

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

    if (requestId.length > 100) {
      return NextResponse.json({ error: "Invalid comment request." }, { status: 400 })
    }

    const comment = await createBacklogComment({
      backlogItemId: id,
      authorUserId: user.id,
      author: user.name?.trim() || user.email?.trim() || "Unknown User",
      body: trimmedBody,
      attachments: normalizedAttachments,
      requestId: requestId || null,
      replyToCommentId: typeof body.replyToCommentId === "string" ? body.replyToCommentId : null,
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

let likesSchema: Promise<unknown> | undefined

function ensureCommentLikes() {
  return likesSchema ??= getDb().query(`
    create table if not exists comment_likes (
      comment_id uuid not null references comments(id) on delete cascade,
      user_id text not null,
      primary key (comment_id, user_id)
    )
  `).catch((error) => {
    likesSchema = undefined
    throw error
  })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthenticatedUser()
    const readOnlyResponse = rejectSuperAdminMutation(user.id)
    if (readOnlyResponse) return readOnlyResponse

    const { id } = await params
    const { commentId, liked } = await request.json()
    if (typeof commentId !== "string" || typeof liked !== "boolean") {
      return NextResponse.json({ error: "Invalid comment reaction." }, { status: 400 })
    }
    const comments = await listBacklogComments(id, user.id)
    if (!comments.some((comment) => comment.id === commentId)) {
      return NextResponse.json({ error: "Comment not found." }, { status: 404 })
    }

    await ensureCommentLikes()
    const db = getDb()
    await db.query(
      liked
        ? "insert into comment_likes (comment_id, user_id) values ($1, $2) on conflict do nothing"
        : "delete from comment_likes where comment_id = $1 and user_id = $2",
      [commentId, user.id]
    )
    const { rows } = await db.query<{ likeCount: number; liked: boolean }>(
      `select count(*)::int as "likeCount", coalesce(bool_or(user_id = $2), false) as liked
       from comment_likes where comment_id = $1`,
      [commentId, user.id]
    )
    return NextResponse.json(rows[0])
  } catch {
    return NextResponse.json({ error: "Could not update the like." }, { status: 500 })
  }
}
