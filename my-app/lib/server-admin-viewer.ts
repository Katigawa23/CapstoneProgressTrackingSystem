import { NextResponse } from "next/server"

export function rejectSuperAdminMutation(userId: string) {
  if (userId !== "tester-admin") {
    return null
  }

  return NextResponse.json(
    { error: "The super admin account has view-only access." },
    { status: 403 }
  )
}
