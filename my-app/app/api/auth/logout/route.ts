import { NextResponse } from "next/server"

import { AUTH_SESSION_COOKIE, getAuthCookieOptions } from "@/backend/auth/session"

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url))

  response.cookies.set(AUTH_SESSION_COOKIE, "", {
    ...getAuthCookieOptions(new Date(0)),
    maxAge: 0,
  })

  return response
}
