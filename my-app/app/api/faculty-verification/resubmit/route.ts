import { NextResponse } from "next/server"
import { readAuthenticatedUser } from "@/lib/server-auth"
import { getFacultyAccessState, resubmitFacultyVerification } from "@/lib/server-faculty-verification"
export const dynamic = "force-dynamic"
export async function POST() {
  const user = await readAuthenticatedUser(true)
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })
  if (user.role !== "faculty") return NextResponse.json({ error: "Faculty accounts only." }, { status: 403 })
  try {
    const saved = await resubmitFacultyVerification(user.id, user.tenantId)
    const access = await getFacultyAccessState(user.id)
    if (saved) return NextResponse.json({ saved: true })
    if (access.status === "rejected" && access.retryAt) {
      return NextResponse.json({ error: "You have reached the limit of 5 verification requests in 24 hours.", retryAt: access.retryAt }, { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((Date.parse(access.retryAt)-Date.now())/1000))) } })
    }
    return NextResponse.json({ error: "Only rejected requests can be resubmitted. Check your current status." }, { status: 409 })
  } catch {
    return NextResponse.json({ error: "Could not submit your request. Please try again." }, { status: 503 })
  }
}
