import { NextResponse } from "next/server"

import { createBacklogItem, listBacklogItems } from "@/lib/backlog-repository"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")?.trim()

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 })
    }

    const items = await listBacklogItems(projectId)
    return NextResponse.json({ items })
  } catch (error) {
    console.error("Failed to load backlog items", error)
    return NextResponse.json(
      { error: "Failed to load backlog items" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      projectId?: string
      title?: string
      description?: string
      dueDate?: string | null
      assigneeId?: string | null
      file?: { name?: string; size?: string; type?: string } | null
    }

    const title = body.title?.trim()
    const projectId = body.projectId?.trim()

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 })
    }

    const item = await createBacklogItem({
      projectId,
      title,
      description: body.description?.trim() ?? "",
      dueDate: body.dueDate ?? null,
      status: "todo",
      checked: false,
      assigneeId: body.assigneeId ?? null,
      file:
        body.file?.name && body.file.size && body.file.type
          ? {
              name: body.file.name,
              size: body.file.size,
              type: body.file.type,
            }
          : null,
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error("Failed to create backlog item", error)
    return NextResponse.json(
      { error: "Failed to create backlog item" },
      { status: 500 }
    )
  }
}
