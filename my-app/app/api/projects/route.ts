import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import {
  PROJECT_METADATA_MAX_LENGTH,
  PROJECT_TITLE_MAX_LENGTH,
  stripEmojiFromProjectTitle,
} from "@/lib/projects"
import { canCreateProject, isUserRole } from "@/lib/rbac"
import { validateDisplayName } from "@/lib/text-validation"
import {
  createProject,
  ProjectNameConflictError,
  listProjects,
  updateProjectStarred,
} from "@backend/repositories/projects-repository"

function revalidateProjectData() {
  try {
    revalidateTag("projects", "max")
    revalidateTag("backlog-items", "max")
    revalidateTag("backlog-comments", "max")
  } catch (error) {
    console.error("Failed to revalidate project-related cache", error)
  }
}

export async function GET() {
  try {
    const user = await requireAuthenticatedUser()
    const projects = await listProjects(user.id)
    return NextResponse.json(
      { projects },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    )
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.error("Failed to load projects", error)
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser()

    if (!isUserRole(user.role) || !canCreateProject(user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to create a project." },
        { status: 403 }
      )
    }

    const body = (await request.json()) as {
      name?: string
      members?: string[]
      advisers?: string[]
      sprintCreatorUserIds?: string[]
      starred?: boolean
      memberUserIds?: string[]
      memberAccess?: Array<{
        userId?: string
        role?: string
        canCreateSprint?: boolean
      }>
      program?: string
      yearLevel?: string
      syTerm?: string
      projectType?: string
    }

    const rawName = body.name?.trim()
    const name = rawName ? stripEmojiFromProjectTitle(rawName).trim() : rawName
    const program = body.program?.trim()
    const yearLevel = body.yearLevel?.trim()
    const syTerm = body.syTerm?.trim()
    const projectType = body.projectType?.trim()
    const members = Array.isArray(body.members)
      ? body.members.filter((member) => typeof member === "string" && member.trim())
      : []
    const advisers = Array.isArray(body.advisers)
      ? body.advisers.filter((adviser) => typeof adviser === "string" && adviser.trim())
      : []
    const sprintCreatorUserIds = Array.isArray(body.sprintCreatorUserIds)
      ? body.sprintCreatorUserIds.filter(
          (memberUserId) => typeof memberUserId === "string" && memberUserId.trim()
        )
      : []
    const memberUserIds = Array.isArray(body.memberUserIds)
      ? body.memberUserIds.filter((memberUserId) => typeof memberUserId === "string" && memberUserId.trim())
      : []
    const memberAccess = Array.isArray(body.memberAccess)
      ? body.memberAccess
          .map((member) => ({
            userId: typeof member.userId === "string" ? member.userId.trim() : "",
            role: typeof member.role === "string" ? member.role.trim().toLowerCase() : "",
            canCreateSprint: member.canCreateSprint === true,
          }))
          .filter((member) => member.userId.length > 0)
      : []
    const normalizedMemberUserIds =
      memberAccess.length > 0
        ? memberAccess
            .filter((member) => member.role !== "faculty" && member.role !== "admin")
            .map((member) => member.userId)
        : memberUserIds

    if (!name) {
      return NextResponse.json({ error: "Project title is required" }, { status: 400 })
    }

    const nameValidationError = validateDisplayName(name, "Project title")

    if (nameValidationError) {
      return NextResponse.json({ error: nameValidationError }, { status: 400 })
    }

    if (members.length === 0) {
      return NextResponse.json({ error: "Member is required" }, { status: 400 })
    }

    if (!program) {
      return NextResponse.json({ error: "Program is required" }, { status: 400 })
    }

    if (!yearLevel) {
      return NextResponse.json({ error: "Year level is required" }, { status: 400 })
    }

    if (!projectType) {
      return NextResponse.json({ error: "Project type is required" }, { status: 400 })
    }

    if (!syTerm) {
      return NextResponse.json({ error: "SY term is required" }, { status: 400 })
    }

    const project = await createProject({
      name: name.slice(0, PROJECT_TITLE_MAX_LENGTH),
      members,
      advisers,
      sprintCreatorUserIds,
      starred: body.starred === true,
      memberUserIds: normalizedMemberUserIds,
      memberAccess,
      program: program.slice(0, PROJECT_METADATA_MAX_LENGTH),
      yearLevel: yearLevel.slice(0, PROJECT_METADATA_MAX_LENGTH),
      syTerm: syTerm.slice(0, PROJECT_METADATA_MAX_LENGTH),
      projectType: projectType.slice(0, PROJECT_METADATA_MAX_LENGTH),
    }, user.id)

    revalidateProjectData()

    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    if (error instanceof ProjectNameConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    console.error("Failed to create project", error)
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthenticatedUser()
    const body = (await request.json()) as {
      projectId?: string
      starred?: boolean
    }

    const projectId = body.projectId?.trim()

    if (!projectId) {
      return NextResponse.json({ error: "Project id is required" }, { status: 400 })
    }

    const project = await updateProjectStarred(projectId, user.id, body.starred === true)

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    revalidateProjectData()

    return NextResponse.json({ project })
  } catch (error) {
    console.error("Failed to update project", error)
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 })
  }
}
