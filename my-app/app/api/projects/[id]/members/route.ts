import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { rejectSuperAdminMutation } from "@/lib/server-admin-viewer"
import { canCreateProject, isUserRole } from "@/lib/rbac"
import {
  addProjectStudentMember,
  listProjectMembers,
  removeProjectStudentMember,
  StudentAlreadyAssignedError,
  updateProjectMemberAccess,
} from "@backend/repositories/projects-repository"

function revalidateProjectData() {
  try {
    revalidateTag("projects", "max")
    revalidateTag("backlog-items", "max")
  } catch (error) {
    console.error("Failed to revalidate project member data", error)
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const { id } = await params
    const projectId = id.trim()

    if (!projectId) {
      return NextResponse.json({ error: "Project id is required" }, { status: 400 })
    }

    const members = await listProjectMembers(projectId, user.id, user.role)

    return NextResponse.json(
      { members },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isAuthError = errorMessage === "Unauthorized"

    return NextResponse.json(
      { error: "Failed to load project members" },
      { status: isAuthError ? 401 : 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const readOnlyResponse = rejectSuperAdminMutation(user.id)
    if (readOnlyResponse) return readOnlyResponse
    if (!isUserRole(user.role) || !canCreateProject(user.role, user.id)) {
      return NextResponse.json(
        { error: "Only the coordinator can manage group members." },
        { status: 403 }
      )
    }
    const { id } = await params
    const projectId = id.trim()
    const body = (await request.json()) as {
      userId?: string
      projectRole?: string
      canCreateSprint?: boolean
    }
    const targetUserId = body.userId?.trim()
    const projectRole =
      typeof body.projectRole === "string" ? body.projectRole.trim() : ""

    if (!projectId || !targetUserId) {
      return NextResponse.json(
        { error: "Project id and member id are required" },
        { status: 400 }
      )
    }

    const member = await updateProjectMemberAccess(
      projectId,
      targetUserId,
      {
        projectRole,
        canCreateSprint: body.canCreateSprint === true,
      },
      user.id,
      user.role
    )

    if (!member) {
      return NextResponse.json(
        { error: "You do not have permission to update this member" },
        { status: 403 }
      )
    }

    revalidateProjectData()

    return NextResponse.json({ member })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isAuthError = errorMessage === "Unauthorized"

    return NextResponse.json(
      { error: "Failed to update project member" },
      { status: isAuthError ? 401 : 500 }
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
    if (!isUserRole(user.role) || !canCreateProject(user.role, user.id)) {
      return NextResponse.json(
        { error: "Only the coordinator can manage group members." },
        { status: 403 }
      )
    }
    const { id } = await params
    const projectId = id.trim()
    const body = (await request.json()) as { userId?: string; transferApproved?: boolean }
    const targetUserId = body.userId?.trim()

    if (!projectId || !targetUserId) {
      return NextResponse.json(
        { error: "Project id and member id are required" },
        { status: 400 }
      )
    }

    const member = await addProjectStudentMember(
      projectId,
      targetUserId,
      user.id,
      user.role,
      body.transferApproved === true
    )

    if (!member) {
      return NextResponse.json(
        { error: "You do not have permission to add this member" },
        { status: 403 }
      )
    }

    revalidateProjectData()

    return NextResponse.json({ member }, { status: 201 })
  } catch (error) {
    if (error instanceof StudentAlreadyAssignedError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isAuthError = errorMessage === "Unauthorized"

    return NextResponse.json(
      { error: "Failed to add project member" },
      { status: isAuthError ? 401 : 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const readOnlyResponse = rejectSuperAdminMutation(user.id)
    if (readOnlyResponse) return readOnlyResponse
    if (!isUserRole(user.role) || !canCreateProject(user.role, user.id)) {
      return NextResponse.json(
        { error: "Only the coordinator can manage group members." },
        { status: 403 }
      )
    }
    const { id } = await params
    const projectId = id.trim()
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get("userId")?.trim()

    if (!projectId || !targetUserId) {
      return NextResponse.json(
        { error: "Project id and member id are required" },
        { status: 400 }
      )
    }

    const removed = await removeProjectStudentMember(
      projectId,
      targetUserId,
      user.id,
      user.role
    )

    if (!removed) {
      return NextResponse.json(
        { error: "You do not have permission to remove this member" },
        { status: 403 }
      )
    }

    revalidateProjectData()

    return NextResponse.json({ ok: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isAuthError = errorMessage === "Unauthorized"

    return NextResponse.json(
      { error: "Failed to remove project member" },
      { status: isAuthError ? 401 : 500 }
    )
  }
}
