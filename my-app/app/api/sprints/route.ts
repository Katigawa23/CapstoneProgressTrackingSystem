import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { canUserCreateSprintInProject } from "@backend/repositories/project-repository"
import {
  createSprint,
  listSprints,
} from "@backend/repositories/sprint-repository"

function normalizeRequiredDate(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : null
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser()
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")?.trim()

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 })
    }

    const sprints = await listSprints(projectId, user.id)

    return NextResponse.json(
      { sprints },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    )
  } catch (error) {
    console.error("Failed to load sprints", error)
    return NextResponse.json({ error: "Failed to load sprints" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser()
    const body = (await request.json()) as {
      projectId?: string
      name?: string
      duration?: string
      startDate?: string
      endDate?: string
      description?: string
      backlogItemIds?: string[]
    }

    const projectId = body.projectId?.trim()
    const name = body.name?.trim()
    const duration = body.duration?.trim() ?? ""
    const startDate = normalizeRequiredDate(body.startDate)
    const endDate = normalizeRequiredDate(body.endDate)
    const backlogItemIds = Array.isArray(body.backlogItemIds)
      ? body.backlogItemIds.filter((value) => typeof value === "string" && value.trim())
      : []

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 })
    }

    if (!name) {
      return NextResponse.json({ error: "Sprint name is required" }, { status: 400 })
    }

    if (!startDate) {
      return NextResponse.json({ error: "Start date is required" }, { status: 400 })
    }

    if (!endDate) {
      return NextResponse.json({ error: "End date is required" }, { status: 400 })
    }

    const canCreateSprint = await canUserCreateSprintInProject(projectId, user.id, user.role)

    if (!canCreateSprint) {
      return NextResponse.json(
        { error: "You do not have permission to create a sprint for this project." },
        { status: 403 }
      )
    }

    const sprint = await createSprint(
      {
        projectId,
        name,
        duration,
        startDate,
        endDate,
        description: body.description?.trim() ?? "",
        backlogItemIds,
      },
      user.id
    )

    revalidateTag("backlog-items", "max")

    return NextResponse.json({ sprint }, { status: 201 })
  } catch (error) {
    console.error("Failed to create sprint", error)
    return NextResponse.json({ error: "Failed to create sprint" }, { status: 500 })
  }
}
