import { randomUUID } from "node:crypto"
import { canAssignStudentsToProgram } from "@/lib/server-student-program-access"
import { getDb } from "@/lib/server-db"
import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import {
  PROJECT_METADATA_MAX_LENGTH,
  PROJECT_TITLE_MAX_LENGTH,
  isResearchApproach,
  isThesisGroupType,
} from "@/lib/projects"
import { canCreateProject, isUserRole } from "@/lib/rbac"
import { isAssignedCoordinator, listAssignedCoordinatorProgramLabels } from "@/lib/server-coordinator-assignments"
import { hasInvalidTaskTitleCharacters, TASK_TITLE_CHARACTERS_ERROR, validateDisplayName } from "@/lib/text-validation"
import { notifyProjectEmailEvent } from "@/lib/server-project-email-events"
import { isProjectWorkflowPreset } from "@/lib/project-workflow-presets"
import {
  createProject,
  ProjectNameConflictError,
  ProjectWorkflowStorageError,
  StudentAlreadyAssignedError,
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
  const requestId = randomUUID()
  let stage = "authentication"
  try {
    const user = await requireAuthenticatedUser()

    const coordinatorAssigned = user.role === "faculty" && await isAssignedCoordinator(user.id)
    if (!isUserRole(user.role) || (!canCreateProject(user.role, user.id) && !coordinatorAssigned)) {
      return NextResponse.json(
        { error: "You do not have permission to create a project." },
        { status: 403 }
      )
    }

    stage = "validation"
    const input: unknown = await request.json().catch(() => null)
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return NextResponse.json({ error: "Invalid group form data." }, { status: 400 })
    }
    const body = input as {
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
      transferMemberUserIds?: string[]
      program?: string
      yearLevel?: string
      syTerm?: string
      projectType?: string
      workflowPreset?: unknown
      researchApproach?: unknown
    }
    const workflowPreset = body.workflowPreset ?? "existing"
    if (!isProjectWorkflowPreset(workflowPreset)) {
      return NextResponse.json({ error: "Invalid workflow preset" }, { status: 400 })
    }

    const rawName = typeof body.name === "string" ? body.name : ""
    if (hasInvalidTaskTitleCharacters(rawName)) {
      return NextResponse.json({ error: TASK_TITLE_CHARACTERS_ERROR }, { status: 400 })
    }
    const name = rawName.trim()
    const program = typeof body.program === "string" ? body.program.trim() : ""
    const yearLevel = typeof body.yearLevel === "string" ? body.yearLevel.trim() : ""
    const syTerm = typeof body.syTerm === "string" ? body.syTerm.trim() : ""
    const projectType = typeof body.projectType === "string" ? body.projectType.trim() : ""
    if (user.role === "faculty" && program) {
      const assignedPrograms = await listAssignedCoordinatorProgramLabels(user.id)
      if (!assignedPrograms.length) {
        return NextResponse.json({ error: "This coordinator has no assigned program. Ask the administrator to assign one before creating a group." }, { status: 403 })
      }
      if (!assignedPrograms.some((assignedProgram) => assignedProgram.toLowerCase() === program.toLowerCase())) {
        return NextResponse.json({ error: "You can only create groups for your assigned program." }, { status: 403 })
      }
    }
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
          .filter((member) => member && typeof member === "object")
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
            .map((member) => member.userId)
        : memberUserIds
    const transferMemberUserIds = Array.isArray(body.transferMemberUserIds)
      ? body.transferMemberUserIds.filter((userId) => typeof userId === "string" && userId.trim())
      : []

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

    if (advisers.length > 1) {
      return NextResponse.json(
        { error: "Only one adviser can be assigned to a group." },
        { status: 400 }
      )
    }

    if (advisers.length) {
      const eligible = await getDb().query<{ name: string }>(
        "select name from users where tenant_id=$1 and role in ('faculty','adviser') and faculty_verification_status='approved' and name=any($2::text[])",
        [user.tenantId, advisers])
      if (advisers.some((name) => !eligible.rows.some((row) => row.name === name))) {
        return NextResponse.json({ error: "Only verified faculty can be assigned as adviser." }, { status: 403 })
      }
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
    const isThesis = isThesisGroupType(projectType)
    const researchApproach = isResearchApproach(body.researchApproach) ? body.researchApproach : undefined
    if (isThesis && !researchApproach) {
      return NextResponse.json({ error: "Choose a research approach for the thesis group." }, { status: 400 })
    }

    if (!syTerm) {
      return NextResponse.json({ error: "SY term is required" }, { status: 400 })
    }

    if (user.role === "faculty") {
      // Read actual roles from the database; never trust memberAccess.role from the browser.
      const candidates = [...new Set([...memberUserIds, ...normalizedMemberUserIds])].filter((id) => id !== user.id)
      const records = await getDb().query<{ id: string; role: string }>(
        "select microsoft_user_id as id, role from users where microsoft_user_id=any($1::text[]) and tenant_id=$2", [candidates, user.tenantId])
      const studentIds = records.rows.filter((row) => row.role === "student").map((row) => row.id)
      if (candidates.some((id) => !records.rows.some((row) => row.id === id)) ||
          !await canAssignStudentsToProgram(user.id, user.tenantId, program, studentIds)) {
        return NextResponse.json({ error: "Only verified students in your assigned program can be added to this group." }, { status: 403 })
      }
    }

    stage = "save-group"
    const project = await createProject({
      name: name.slice(0, PROJECT_TITLE_MAX_LENGTH),
      members,
      advisers,
      sprintCreatorUserIds,
      starred: body.starred === true,
      memberUserIds: normalizedMemberUserIds,
      exclusiveStudentUserIds: memberUserIds,
      memberAccess,
      transferMemberUserIds,
      program: program.slice(0, PROJECT_METADATA_MAX_LENGTH),
      yearLevel: yearLevel.slice(0, PROJECT_METADATA_MAX_LENGTH),
      syTerm: syTerm.slice(0, PROJECT_METADATA_MAX_LENGTH),
      projectType: projectType.slice(0, PROJECT_METADATA_MAX_LENGTH),
      workflowPreset: workflowPreset === "existing" ? undefined : workflowPreset,
      researchApproach: isThesis ? researchApproach : undefined,
    }, user.id, requestId)

    revalidateProjectData()

    await notifyProjectEmailEvent({ projectId: project.id, actorUserId: user.id,
      actorName: user.name, type: "adviser_assigned", eventId: project.id })
    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Your session expired. Sign in again to create a group." }, { status: 401 })
    }
    if (error instanceof ProjectNameConflictError || error instanceof ProjectWorkflowStorageError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    if (error instanceof StudentAlreadyAssignedError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    const code = typeof error === "object" && error && "code" in error ? error.code : undefined
    console.error("Failed to create group", { requestId, stage, code })
    return NextResponse.json({ error: "Could not save the group.", requestId }, {
      status: 500,
      headers: { "X-Request-ID": requestId },
    })
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
