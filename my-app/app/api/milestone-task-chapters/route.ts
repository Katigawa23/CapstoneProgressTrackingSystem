import { NextResponse } from "next/server"

import { assignTaskToMilestoneChapter } from "@/lib/server-milestone-repository"
import { listProjects } from "@/lib/server-project-repository"
import { requireAuthenticatedUser } from "@/lib/server-auth"

export async function PUT(request: Request) {
  try {
    const user = await requireAuthenticatedUser()
    if (user.role === "student") {
      return NextResponse.json({ error: "Only advisers and coordinators can organize milestone chapters." }, { status: 403 })
    }
    const body = await request.json() as Record<string, unknown>
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : ""
    const taskId = typeof body.taskId === "string" ? body.taskId.trim() : ""
    const chapter = body.chapter === null ? null : Number(body.chapter)
    if (!projectId || !taskId || (chapter !== null && (!Number.isInteger(chapter) || chapter < 1 || chapter > 5))) {
      return NextResponse.json({ error: "Invalid milestone assignment." }, { status: 400 })
    }
    const projects = await listProjects(user.id)
    if (!projects.some((project) => project.id === projectId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const saved = await assignTaskToMilestoneChapter({ projectId, taskId, chapter, updatedBy: user.id })
    if (!saved) return NextResponse.json({ error: "Task not found." }, { status: 404 })
    return NextResponse.json({ assignment: { taskId, chapter } })
  } catch (error) {
    console.error("Failed to assign milestone chapter", error)
    return NextResponse.json({ error: "Failed to update milestone chapter." }, { status: 500 })
  }
}
