import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { listProjects } from "@/lib/server-project-repository"
import { listCompletedChapterTasks } from "@/lib/server-task-chapter-repository"

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser()
    const projectId = new URL(request.url).searchParams.get("projectId")?.trim()
    if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 })

    const projects = await listProjects(user.id)
    if (!projects.some((project) => project.id === projectId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const tasks = await listCompletedChapterTasks(projectId)
    return NextResponse.json({ tasks }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Failed to load milestones", error)
    return NextResponse.json({ error: "Failed to load milestones" }, { status: 500 })
  }
}
