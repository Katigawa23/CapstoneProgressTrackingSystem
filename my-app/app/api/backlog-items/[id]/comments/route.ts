import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import {
  createBacklogComment,
  listBacklogComments,
} from "@/backend/repositories/backlog-comment-repository"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const comments = await listBacklogComments(id)
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
    const { id } = await params
    const body = (await request.json()) as {
      author?: string
      body?: string
      attachments?: string[]
    }

    const comment = await createBacklogComment({
      backlogItemId: id,
      author: body.author?.trim() || "Unknown User",
      body: body.body?.trim() ?? "",
      attachments: Array.isArray(body.attachments)
        ? body.attachments
            .map((item) => String(item).trim())
            .filter(Boolean)
        : [],
    })

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
