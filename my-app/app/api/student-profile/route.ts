import { NextResponse } from "next/server"
import { readAuthenticatedUser } from "@/lib/server-auth"
import { listProjectConfigurationOptions } from "@/lib/server-project-configuration"
import { getStudentProfile, saveStudentProfile, getStudentAccessState } from "@/lib/server-student-profile"

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await readAuthenticatedUser(true)
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 })
  if (user.role !== "student") return NextResponse.json({ error: "Students only." }, { status: 403 })
  return NextResponse.json({ profile: await getStudentProfile(user.id) }, { headers: { "Cache-Control": "no-store" } })
}

export async function PUT(request: Request) {
  const user = await readAuthenticatedUser(true)
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })
  if (user.role !== "student") return NextResponse.json({ error: "Students only." }, { status: 403 })
  let body: Record<string, unknown>
  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid body")
    body = parsed as Record<string, unknown>
  } catch { return NextResponse.json({ error: "Invalid profile details." }, { status: 400 }) }
  const program = typeof body.program === "string" ? body.program.trim() : ""
  const yearLevel = typeof body.yearLevel === "string" ? body.yearLevel.trim() : ""
  if (!program || program.length > 200 || !yearLevel || yearLevel.length > 100) {
    return NextResponse.json({ error: "Select your course and year level." }, { status: 400 })
  }
  try {
    const access = await getStudentAccessState(user.id)
    if (access.profileComplete && access.status !== "rejected") {
      return NextResponse.json({ error: "Your profile has already been submitted." }, { status: 409 })
    }
    const options = await listProjectConfigurationOptions()
    if (!options.some((option) => option.category === "program" && option.label === program) ||
        !options.some((option) => option.category === "year_level" && option.label === yearLevel)) {
      return NextResponse.json({ error: "These options are no longer available. Refresh and select again." }, { status: 400 })
    }
    // Identity always comes from the authenticated account; never accept a client-supplied name or user ID.
    const programId = options.find((option) => option.category === "program" && option.label === program)!.id
    await saveStudentProfile(user.id, { program, yearLevel }, programId)
    return NextResponse.json({ saved: true })
  } catch {
    return NextResponse.json({ error: "Could not save your profile. Please try again." }, { status: 503 })
  }
}
