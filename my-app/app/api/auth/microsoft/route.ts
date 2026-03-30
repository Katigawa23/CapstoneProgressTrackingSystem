import { NextResponse } from "next/server"

import {
  createMicrosoftAuthorizeUrl,
  createOauthState,
  getMicrosoftAuthDebugInfo,
} from "@/backend/auth/microsoft"
import {
  AUTH_STATE_COOKIE,
  createStateCookieValue,
  getAuthCookieOptions,
} from "@/backend/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const state = createOauthState()
    const response = NextResponse.redirect(createMicrosoftAuthorizeUrl(request, state))

    response.cookies.set(
      AUTH_STATE_COOKIE,
      createStateCookieValue(state),
      getAuthCookieOptions(new Date(Date.now() + 10 * 60 * 1000))
    )

    return response
  } catch (error) {
    console.error("Failed to start Microsoft login", {
      error,
      debug: getMicrosoftAuthDebugInfo(request),
    })
    return NextResponse.redirect(new URL("/?authError=setup", request.url))
  }
}
