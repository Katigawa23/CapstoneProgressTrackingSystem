import { NextRequest, NextResponse } from "next/server"
import { readClientAuthSession } from "@/lib/auth-client"
import { updateUserRole, getStoredUserRole } from "@backend/repositories/microsoft-login-repository"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/auth/user-role
 * Returns the current user's stored role from the database
 */
export async function GET(request: NextRequest) {
  try {
    // In a real app, validate the session from a secure HTTP-only cookie
    // For testing, we'll accept the user ID from the Authorization header
    const authHeader = request.headers.get("authorization")
    
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = authHeader.slice(7)

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
 * For testing purposes only
 */
export async function PUT(request: NextRequest) {
  try {
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
