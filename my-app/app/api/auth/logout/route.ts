import { NextResponse } from "next/server"

import { AUTH_USER_COOKIE, getAuthCookieOptions } from "@/backend/auth/session"

export async function POST() {
  const response = NextResponse.json({ success: true })

  response.cookies.set(AUTH_USER_COOKIE, "", {
    ...getAuthCookieOptions(new Date(0)),
    maxAge: 0,
  })

  return response
}
