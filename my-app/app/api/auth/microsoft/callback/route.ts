import { NextRequest, NextResponse } from "next/server"

import { redeemMicrosoftCode } from "@/backend/auth/microsoft"
import {
  AUTH_SESSION_COOKIE,
  AUTH_STATE_COOKIE,
  createSessionCookieValue,
  getAuthCookieOptions,
  readStateCookieValue,
} from "@/backend/auth/session"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")

  try {
    const expectedState = readStateCookieValue(request.cookies.get(AUTH_STATE_COOKIE)?.value)

    if (!code || !state || !expectedState || state !== expectedState) {
      return NextResponse.redirect(new URL("/?authError=state", request.url))
    }

    const user = await redeemMicrosoftCode(request, code)
    const response = NextResponse.redirect(new URL("/dashboard", request.url))

    response.cookies.set(
      AUTH_SESSION_COOKIE,
      createSessionCookieValue(user),
      getAuthCookieOptions(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
    )
    response.cookies.set(AUTH_STATE_COOKIE, "", {
      ...getAuthCookieOptions(new Date(0)),
      maxAge: 0,
    })

    return response
  } catch (error) {
    console.error("Failed to complete Microsoft login", error)
    const response = NextResponse.redirect(new URL("/?authError=callback", request.url))

    response.cookies.set(AUTH_STATE_COOKIE, "", {
      ...getAuthCookieOptions(new Date(0)),
      maxAge: 0,
    })

    return response
  }
}
