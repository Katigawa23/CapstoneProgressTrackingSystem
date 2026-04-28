import { NextResponse } from "next/server"

import {
  createMicrosoftAuthorizeUrl,
  createOauthState,
} from "@backend/auth/microsoft"

import {
  AUTH_STATE_COOKIE,
  createStateCookieValue,
  getAuthCookieOptions,
} from "@backend/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    // âœ… fallback redirect (default = dashboard)
    const redirect = searchParams.get("redirect") || "/dashboard"

    const state = createOauthState()
    const authUrl = createMicrosoftAuthorizeUrl(request, state)

    const response = NextResponse.redirect(authUrl)

    // âœ… existing state cookie (KEEP THIS)
    response.cookies.set(
      AUTH_STATE_COOKIE,
      createStateCookieValue(state),
      getAuthCookieOptions(new Date(Date.now() + 10 * 60 * 1000))
    )

    // âœ… NEW: store redirect destination
    response.cookies.set("redirect_after_login", redirect, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    })

    return response
  } catch (error) {
    console.error("Failed to start Microsoft login", error)
    return NextResponse.redirect(new URL("/?authError=setup", request.url))
  }
}