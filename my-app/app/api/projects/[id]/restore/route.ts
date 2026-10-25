import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import {
  ArchivedProjectRestoreConflictError,
  restoreArchivedProject,
} from "@backend/repositories/projects-repository"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthenticatedUser()
    if (user.id !== "tester-coordinator") {
      return NextResponse.json({ error: "Coordinator access is required." }, { status: 403 })
    }

    const { id } = await context.params
    const body = (await request.json().catch(() => ({}))) as { transferMemberUserIds?: string[] }
    const project = await restoreArchivedProject(
      id,
      Array.isArray(body.transferMemberUserIds) ? body.transferMemberUserIds : []
    )
    if (!project) return NextResponse.json({ error: "Archived project not found" }, { status: 404 })

    revalidateTag("projects", "max")
    return NextResponse.json({ project })
  } catch (error) {
    if (error instanceof ArchivedProjectRestoreConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "ACTIVE_GROUP_CONFLICT",
          conflictingUserIds: error.conflictingUserIds,
        },
        { status: 409 }
      )
    }
    console.error("Failed to restore project", error)
    return NextResponse.json({ error: "Failed to restore project" }, { status: 500 })
  }
}
