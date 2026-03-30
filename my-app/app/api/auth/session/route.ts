import { NextRequest, NextResponse } from "next/server"

import { AUTH_SESSION_COOKIE, readSessionCookieValue } from "@/backend/auth/session"

export async function GET(request: NextRequest) {
  const session = readSessionCookieValue(
    request.cookies.get(AUTH_SESSION_COOKIE)?.value
  )

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  return NextResponse.json({ authenticated: true, session })
}
