import { NextResponse } from "next/server"

import {
  PROJECT_METADATA_MAX_LENGTH,
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
      members?: string[]
      program?: string
      yearLevel?: string
      syTerm?: string
      projectType?: string
    }

    const name = body.name?.trim()
    const program = body.program?.trim()
    const yearLevel = body.yearLevel?.trim()
    const syTerm = body.syTerm?.trim()
    const projectType = body.projectType?.trim()
    const members = Array.isArray(body.members)
      ? body.members.filter((member) => typeof member === "string" && member.trim())
      : []

    if (!name) {
      return NextResponse.json({ error: "Project title is required" }, { status: 400 })
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
      program: program.slice(0, PROJECT_METADATA_MAX_LENGTH),
      yearLevel: yearLevel.slice(0, PROJECT_METADATA_MAX_LENGTH),
      syTerm: syTerm.slice(0, PROJECT_METADATA_MAX_LENGTH),
      projectType: projectType.slice(0, PROJECT_METADATA_MAX_LENGTH),
    })

    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    console.error("Failed to create project", error)
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
}
