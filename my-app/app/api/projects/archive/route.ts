import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { listArchivedProjects } from "@backend/repositories/projects-repository"

export async function GET() {
  try {
    const user = await requireAuthenticatedUser()
    if (user.id !== "tester-coordinator") {
      return NextResponse.json({ error: "Coordinator access is required." }, { status: 403 })
    }

    const projects = await listArchivedProjects()
    return NextResponse.json({ projects }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Failed to load archived projects", error)
    return NextResponse.json({ error: "Failed to load archived projects" }, { status: 500 })
  }
}
