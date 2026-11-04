import { NextResponse } from "next/server"

import { isSuperAdminViewer } from "@backend/auth/access-control"

export { isSuperAdminViewer }

export function rejectSuperAdminMutation(userId: string) {
  if (!isSuperAdminViewer(userId)) {
    return null
  }

  return NextResponse.json(
    { error: "The super admin account has view-only access." },
    { status: 403 }
  )
}
