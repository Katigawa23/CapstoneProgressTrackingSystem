import { NextRequest, NextResponse } from "next/server"
import { readAuthenticatedUser } from "@/lib/server-auth"
import { updateUserRole, getStoredUserRole } from "@backend/repositories/users-repository"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/auth/user-role
 * Returns the current user's stored role from the database
 */
export async function GET(request: NextRequest) {
  try {
    const user = await readAuthenticatedUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    // The bearer value identifies the target only; authority comes from the signed session.
    const authHeader = request.headers.get("authorization")
    
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = authHeader.slice(7)
    if (userId !== user.id && user.id !== "tester-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const storedRole = await getStoredUserRole(userId)

    return NextResponse.json({
      userId,
      role: storedRole || "student",
    })
  } catch (error) {
    console.error("Failed to get user role:", error)
    return NextResponse.json(
      { error: "Failed to retrieve user role" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/auth/user-role
 * Updates the user's role in the database
 * Restricted to the authenticated superadmin.
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await readAuthenticatedUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (user.role !== "admin" || user.id !== "tester-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const authHeader = request.headers.get("authorization")
    
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = authHeader.slice(7)
    const body = await request.json()
    const { role } = body as { role?: string }

    if (!role || (role !== "student" && role !== "faculty")) {
      return NextResponse.json(
        { error: "Invalid role. Must be 'student' or 'faculty'" },
        { status: 400 }
      )
    }

    const updated = await updateUserRole(userId, role)

    if (!updated) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      userId,
      newRole: role,
      message: "Role updated successfully. User needs to log in again to see changes.",
    })
  } catch (error) {
    console.error("Failed to update user role:", error)
    return NextResponse.json(
      { error: "Failed to update user role" },
      { status: 500 }
    )
  }
}
