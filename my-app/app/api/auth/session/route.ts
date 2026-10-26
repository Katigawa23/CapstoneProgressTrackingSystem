import { NextRequest, NextResponse } from "next/server"

import { isActiveSession } from "@/lib/server-active-session"
import { AUTH_USER_COOKIE, readUserCookieValue } from "@backend/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const user = readUserCookieValue(request.cookies.get(AUTH_USER_COOKIE)?.value)
  if (!user) {
    return NextResponse.json({ active: false }, { status: 401 })
  }

  let active: boolean
  try {
    active = await isActiveSession(user.id, user.sessionId)
  } catch (error) {
    console.error("Could not verify active login session:", error)
    return NextResponse.json({ active: false }, { status: 503 })
  }

  if (!active) {
    return NextResponse.json({ active: false }, { status: 401 })
  }

  return NextResponse.json({ active: true })
}
