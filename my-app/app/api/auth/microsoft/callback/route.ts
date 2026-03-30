import { NextRequest, NextResponse } from "next/server"

import {
  getMicrosoftTenantId,
  redeemMicrosoftCode,
} from "@/backend/auth/microsoft"

import {
  AUTH_STATE_COOKIE,
  getAuthCookieOptions,
  readStateCookieValue,
} from "@/backend/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Build redirect to /auth/microsoft/complete
 * Includes:
 * - session payload
 * - redirect fallback (/dashboard)
 */
function createCompletionUrl(
  request: NextRequest,
  user: { id: string; name: string; email: string }
) {
  // ✅ encode session
  const payload = Buffer.from(
    JSON.stringify({
      user,
      tenantId: getMicrosoftTenantId(),
    }),
    "utf8"
  ).toString("base64url")

  // ✅ read redirect cookie (fallback = /dashboard)
  const redirectCookie =
    request.cookies.get("redirect_after_login")?.value || "/dashboard"

  const url = new URL("/auth/microsoft/complete", request.url)

  // ✅ pass both session + redirect
  url.hash = `session=${payload}&redirect=${encodeURIComponent(
    redirectCookie
  )}`

  return url
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)

  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")

  try {
    // ✅ validate state (CSRF protection)
    const expectedState = readStateCookieValue(
      request.cookies.get(AUTH_STATE_COOKIE)?.value
    )

    if (!code || !state || !expectedState || state !== expectedState) {
      return NextResponse.redirect(
        new URL("/?authError=state", request.url)
      )
    }

    // ✅ exchange code → user
    const user = await redeemMicrosoftCode(request, code)

    // ✅ redirect to completion page
    const response = NextResponse.redirect(
      createCompletionUrl(request, user)
    )

    // ✅ clear auth state cookie
    response.cookies.set(AUTH_STATE_COOKIE, "", {
      ...getAuthCookieOptions(new Date(0)),
      maxAge: 0,
    })

    // ✅ clear redirect cookie (optional but recommended)
    response.cookies.set("redirect_after_login", "", {
      path: "/",
      maxAge: 0,
    })

    return response
  } catch (error) {
    console.error("Failed to complete Microsoft login", error)

    const response = NextResponse.redirect(
      new URL("/?authError=callback", request.url)
    )

    // cleanup cookies even on error
    response.cookies.set(AUTH_STATE_COOKIE, "", {
      ...getAuthCookieOptions(new Date(0)),
      maxAge: 0,
    })

    response.cookies.set("redirect_after_login", "", {
      path: "/",
      maxAge: 0,
    })

    return response
  }
}