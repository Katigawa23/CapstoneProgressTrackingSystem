import { NextResponse } from "next/server"

import { createBacklogItem, listBacklogItems } from "@/backend/repositories/backlog-repository"

const allowedStatuses = new Set([
  "todo",
  "inprogress",
  "inreview",
  "revision",
  "completed",
])

function normalizeOptionalDate(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : null
}

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
      startDate?: string | null
      dueDate?: string | null
      status?: string
      assigneeId?: string | null
    }

    const title = body.title?.trim()
    const projectId = body.projectId?.trim()
    const status =
      typeof body.status === "string" && allowedStatuses.has(body.status)
        ? body.status
        : "todo"

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
      startDate: normalizeOptionalDate(body.startDate),
      dueDate: normalizeOptionalDate(body.dueDate),
      status,
      checked: false,
      assigneeId: body.assigneeId ?? null,
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
