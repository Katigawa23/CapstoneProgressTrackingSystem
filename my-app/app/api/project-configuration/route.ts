import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import {
  createProjectConfigurationOption,
  deleteProjectConfigurationOption,
  listProjectConfigurationOptions,
  type ProjectConfigurationCategory,
  updateProjectConfigurationOption,
} from "@/lib/server-project-configuration"
import { PROJECT_METADATA_MAX_LENGTH } from "@/lib/projects"

const categories = new Set<ProjectConfigurationCategory>([
  "program",
  "year_level",
  "group_type",
  "sy_term",
])

function isDuplicateError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505"
}

export async function GET() {
  try {
    await requireAuthenticatedUser()
    return NextResponse.json({ options: await listProjectConfigurationOptions() })
  } catch (error) {
    console.error("Failed to load project configuration", error)
    return NextResponse.json({ error: "Failed to load configuration options." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser()
    if (user.id !== "tester-admin") return NextResponse.json({ error: "Superadmin access is required." }, { status: 403 })
    const body = (await request.json()) as { category?: ProjectConfigurationCategory; label?: string }
    const label = body.label?.trim() ?? ""
    if (!body.category || !categories.has(body.category) || !label || label.length > PROJECT_METADATA_MAX_LENGTH) {
      return NextResponse.json({ error: "A valid category and label are required." }, { status: 400 })
    }
    const option = await createProjectConfigurationOption(body.category, label)
    return NextResponse.json({ option }, { status: 201 })
  } catch (error) {
    if (isDuplicateError(error)) return NextResponse.json({ error: "This option already exists." }, { status: 409 })
    console.error("Failed to create project configuration option", error)
    return NextResponse.json({ error: "Failed to add option." }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthenticatedUser()
    if (user.id !== "tester-admin") return NextResponse.json({ error: "Superadmin access is required." }, { status: 403 })
    const body = (await request.json()) as { id?: string; label?: string }
    const label = body.label?.trim() ?? ""
    if (!body.id || !label || label.length > PROJECT_METADATA_MAX_LENGTH) {
      return NextResponse.json({ error: "A valid option and label are required." }, { status: 400 })
    }
    const option = await updateProjectConfigurationOption(body.id, label)
    if (!option) return NextResponse.json({ error: "Option not found." }, { status: 404 })
    return NextResponse.json({ option })
  } catch (error) {
    if (isDuplicateError(error)) return NextResponse.json({ error: "This option already exists." }, { status: 409 })
    console.error("Failed to update project configuration option", error)
    return NextResponse.json({ error: "Failed to update option." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuthenticatedUser()
    if (user.id !== "tester-admin") return NextResponse.json({ error: "Superadmin access is required." }, { status: 403 })
    const id = new URL(request.url).searchParams.get("id")?.trim()
    if (!id) return NextResponse.json({ error: "Option id is required." }, { status: 400 })
    const deleted = await deleteProjectConfigurationOption(id)
    if (!deleted) return NextResponse.json({ error: "Option not found." }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete project configuration option", error)
    return NextResponse.json({ error: "Failed to delete option." }, { status: 500 })
  }
}
