import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { requireAuthenticatedUser } from "@/lib/server-auth"
import { assignProgramCoordinator, listCoordinatorAssignments, removeProgramCoordinator } from "@/lib/server-coordinator-assignments"

async function requireSuperadmin() {
  const user = await requireAuthenticatedUser()
  if (user.id !== "tester-admin") throw new Error("FORBIDDEN")
  return user
}

function revalidateCoordinatorProjects() {
  try { revalidateTag("projects", "max") } catch { /* no-op outside cached rendering */ }
}

export async function GET() {
  try { await requireSuperadmin(); return NextResponse.json({ assignments: await listCoordinatorAssignments() }) }
  catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "FORBIDDEN" ? "Superadmin access is required." : "Failed to load coordinator assignments." }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 500 }) }
}

export async function POST(request: Request) {
  try {
    const user = await requireSuperadmin()
    const body = await request.json() as { programId?: string; facultyUserId?: string }
    if (!body.programId || !body.facultyUserId) return NextResponse.json({ error: "Program and faculty are required." }, { status: 400 })
    await assignProgramCoordinator(body.programId, body.facultyUserId, user.id)
    revalidateCoordinatorProjects()
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (message === "INVALID_FACULTY") return NextResponse.json({ error: "Only a registered faculty account can be assigned." }, { status: 400 })
    if (message === "INVALID_PROGRAM") return NextResponse.json({ error: "The selected program is invalid." }, { status: 400 })
    if (message === "COORDINATOR_ALREADY_ASSIGNED" || message.includes("program_coordinator_one_program_per_faculty_idx")) return NextResponse.json({ error: "This faculty account is already assigned as coordinator of another program. Remove that assignment first." }, { status: 409 })
    return NextResponse.json({ error: message === "FORBIDDEN" ? "Superadmin access is required." : "Failed to assign coordinator." }, { status: message === "FORBIDDEN" ? 403 : 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    await requireSuperadmin()
    const programId = new URL(request.url).searchParams.get("programId")
    if (!programId) return NextResponse.json({ error: "Program is required." }, { status: 400 })
    await removeProgramCoordinator(programId)
    revalidateCoordinatorProjects()
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    return NextResponse.json({ error: message === "FORBIDDEN" ? "Superadmin access is required." : "Failed to remove coordinator." }, { status: message === "FORBIDDEN" ? 403 : 500 })
  }
}
