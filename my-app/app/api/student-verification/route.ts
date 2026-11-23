import { NextResponse } from "next/server"
import { readAuthenticatedUser } from "@/lib/server-auth"
import { isAssignedCoordinator } from "@/lib/server-coordinator-assignments"
import { listStudentVerifications, reviewStudentVerification } from "@/lib/server-student-verification"
import { notifyVerificationDecision } from "@/lib/server-verification-notification"

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await readAuthenticatedUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "faculty" || !await isAssignedCoordinator(user.id)) return NextResponse.json({ error: "Assigned coordinators only." }, { status: 403 })
  return NextResponse.json({ students: await listStudentVerifications(user.id, user.tenantId) }, { headers: { "Cache-Control": "no-store" } })
}

export async function PUT(request: Request) {
  const user = await readAuthenticatedUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "faculty" || !await isAssignedCoordinator(user.id)) return NextResponse.json({ error: "Assigned coordinators only." }, { status: 403 })
  let body: Record<string, unknown>
  try {
    const data: unknown = await request.json()
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid body")
    body = data as Record<string, unknown>
  } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }) }
  const studentId = typeof body.studentId === "string" ? body.studentId.trim() : ""
  const reason = typeof body.reason === "string" ? body.reason.trim() : ""
  const status = body.status
  if (!studentId || studentId.length > 200 || (status !== "approved" && status !== "rejected" && status !== "revoked" && status !== "restore") ||
      reason.length > 1000 || (status === "rejected" && !reason)) {
    return NextResponse.json({ error: "Select a student and provide a reason when rejecting (up to 1,000 characters)." }, { status: 400 })
  }
  const saved = await reviewStudentVerification({ coordinatorId: user.id, tenantId: user.tenantId, studentId, status, reason })
  if (!saved) return NextResponse.json({ error: "Account status changed or is outside your assigned program." }, { status: 409 })
  await notifyVerificationDecision({ kind: "student", recipientUserId: studentId, reviewerId: user.id, status, reason, reviewedAt: saved.reviewedAt })
  return NextResponse.json({ saved: true })
}
