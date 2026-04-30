import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import {
  createBacklogComment,
  listBacklogComments,
} from "@backend/repositories/backlog-comment-repository"

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
    const { id } = await params
    const body = (await request.json()) as {
      body?: string
      attachments?: string[]
    }

    const comment = await createBacklogComment({
      backlogItemId: id,
      authorUserId: user.id,
      author: user.name?.trim() || user.email?.trim() || "Unknown User",
      body: body.body?.trim() ?? "",
      attachments: Array.isArray(body.attachments)
        ? body.attachments
            .map((item) => String(item).trim())
            .filter(Boolean)
        : [],
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
      { error: "Failed to create backlog comment" },
      { status: 500 }
    )
  }
}
