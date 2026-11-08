import { NextResponse } from "next/server"
import { readAuthenticatedUser } from "@/lib/server-auth"
import { listFacultyVerifications, reviewFacultyVerification } from "@/lib/server-faculty-verification"

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await readAuthenticatedUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin" || user.id !== "tester-admin") return NextResponse.json({ error: "Superadmin only." }, { status: 403 })
  return NextResponse.json({ faculty: await listFacultyVerifications(user.tenantId) }, { headers: { "Cache-Control": "no-store" } })
}

export async function PUT(request: Request) {
  const user = await readAuthenticatedUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin" || user.id !== "tester-admin") return NextResponse.json({ error: "Superadmin only." }, { status: 403 })
  let body: Record<string, unknown>
  try {
    const data: unknown = await request.json()
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid body")
    body = data as Record<string, unknown>
  } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }) }
  const facultyId = typeof body.facultyId === "string" ? body.facultyId.trim() : ""
  const reason = typeof body.reason === "string" ? body.reason.trim() : ""
  const status = body.status
  if (!facultyId || facultyId.length > 200 || !["approved", "rejected"].includes(String(status)) ||
      reason.length > 1000 || (status === "rejected" && !reason)) {
    return NextResponse.json({ error: "Select a faculty account and provide a reason when rejecting (up to 1,000 characters)." }, { status: 400 })
  }
  const saved = await reviewFacultyVerification({ reviewerId: user.id, tenantId: user.tenantId, userId: facultyId, status: status as "approved" | "rejected", reason })
  if (!saved) return NextResponse.json({ error: "Request is no longer pending or unavailable to this account." }, { status: 409 })
  return NextResponse.json({ saved: true })
}
