import { NextResponse } from "next/server"

import {
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_TITLE_MAX_LENGTH,
} from "@/lib/projects"
import { createProject, listProjects } from "@/backend/repositories/project-repository"

export async function GET() {
  try {
    const projects = await listProjects()
    return NextResponse.json({ projects })
  } catch (error) {
    console.error("Failed to load projects", error)
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string
      description?: string
      members?: string[]
    }

    const name = body.name?.trim()
    const description = body.description?.trim()
    const members = Array.isArray(body.members)
      ? body.members.filter((member) => typeof member === "string" && member.trim())
      : []

    if (!name) {
      return NextResponse.json({ error: "Project title is required" }, { status: 400 })
    }

    if (!description) {
      return NextResponse.json({ error: "Short description is required" }, { status: 400 })
    }

    if (members.length === 0) {
      return NextResponse.json({ error: "Member is required" }, { status: 400 })
    }

    const project = await createProject({
      name: name.slice(0, PROJECT_TITLE_MAX_LENGTH),
      description: description.slice(0, PROJECT_DESCRIPTION_MAX_LENGTH),
      members,
    })

    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    console.error("Failed to create project", error)
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
}
