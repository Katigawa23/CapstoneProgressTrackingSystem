import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { archiveProject } from "@backend/repositories/projects-repository"

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthenticatedUser()
    if (user.id !== "tester-coordinator") {
      return NextResponse.json({ error: "Coordinator access is required." }, { status: 403 })
    }

    const { id } = await context.params
    const project = await archiveProject(id, user.id)
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    revalidateTag("projects", "max")
    return NextResponse.json({ project })
  } catch (error) {
    console.error("Failed to archive project", error)
    return NextResponse.json({ error: "Failed to archive project" }, { status: 500 })
  }
}
