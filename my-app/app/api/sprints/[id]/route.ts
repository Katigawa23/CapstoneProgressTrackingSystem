import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import {
  stripEmoji,
  TASK_SPRINT_NAME_MAX_LENGTH,
  validateDisplayName,
} from "@/lib/text-validation"
import { canUserCreateSprintInProject } from "@backend/repositories/project-repository"
import {
  archiveSprint,
  deleteSprint,
  SprintNameConflictError,
  updateSprint,
} from "@backend/repositories/sprint-repository"

function normalizeRequiredDate(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : null
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const { id } = await params
    const body = (await request.json()) as {
      projectId?: string
      name?: string
      duration?: string
      startDate?: string
      endDate?: string
      description?: string
    }

    const projectId = body.projectId?.trim()
    const rawName = body.name?.trim()
    const name = rawName ? stripEmoji(rawName).trim() : rawName
    const startDate = normalizeRequiredDate(body.startDate)
    const endDate = normalizeRequiredDate(body.endDate)

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 })
    }

    if (!name) {
      return NextResponse.json({ error: "Sprint name is required" }, { status: 400 })
    }

    const nameValidationError = validateDisplayName(name, "Sprint name", {
      maxLength: TASK_SPRINT_NAME_MAX_LENGTH,
    })

    if (nameValidationError) {
      return NextResponse.json({ error: nameValidationError }, { status: 400 })
    }

    if (!startDate) {
      return NextResponse.json({ error: "Start date is required" }, { status: 400 })
    }

    if (!endDate) {
      return NextResponse.json({ error: "End date is required" }, { status: 400 })
    }

    const canManageSprint = await canUserCreateSprintInProject(projectId, user.id, user.role)

    if (!canManageSprint) {
      return NextResponse.json(
        { error: "You do not have permission to edit this sprint." },
        { status: 403 }
      )
    }

    const sprint = await updateSprint(
      {
        id,
        projectId,
        name,
        duration: body.duration?.trim() ?? "",
        startDate,
        endDate,
        description: body.description?.trim() ?? "",
      },
      user.id,
      user.role
    )

    if (!sprint || sprint.projectId !== projectId) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 })
    }

    revalidateTag("backlog-items", "max")

    return NextResponse.json({ sprint })
  } catch (error) {
    if (error instanceof SprintNameConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    console.error("Failed to update sprint", error)
    return NextResponse.json({ error: "Failed to update sprint" }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")?.trim()
    const action = searchParams.get("action")?.trim() ?? "delete"

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 })
    }

    const canManageSprint = await canUserCreateSprintInProject(projectId, user.id, user.role)

    if (!canManageSprint) {
      return NextResponse.json(
        { error: "You do not have permission to manage this sprint." },
        { status: 403 }
      )
    }

    const success =
      action === "archive"
        ? await archiveSprint(id, projectId, user.id, user.role)
        : await deleteSprint(id, projectId, user.id, user.role)

    if (!success) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 })
    }

    revalidateTag("backlog-items", "max")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to manage sprint", error)
    return NextResponse.json({ error: "Failed to manage sprint" }, { status: 500 })
  }
}
