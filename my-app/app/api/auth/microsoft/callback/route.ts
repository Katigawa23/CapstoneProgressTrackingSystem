import { NextRequest, NextResponse } from "next/server"

import {
  getMicrosoftTenantId,
  normalizeMicrosoftRole,
  redeemMicrosoftCode,
} from "@backend/auth/microsoft"

import {
  AUTH_STATE_COOKIE,
  AUTH_USER_COOKIE,
  createUserCookieValue,
  getAuthCookieOptions,
  readStateCookieValue,
} from "@backend/auth/session"

import { saveMicrosoftAccountLogin, getStoredUserRole } from "@backend/repositories/microsoft-login-repository"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function createCompletionUrl(
  request: NextRequest,
  user: { id: string; name: string; email: string; role: "student" | "faculty" }
) {
  const payload = Buffer.from(
    JSON.stringify({
      user,
      tenantId: getMicrosoftTenantId(),
    }),
    "utf8"
  ).toString("base64url")

  const redirectCookie =
    request.cookies.get("redirect_after_login")?.value || "/dashboard"

  const url = new URL("/auth/microsoft/complete", request.url)

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
    const expectedState = readStateCookieValue(
      request.cookies.get(AUTH_STATE_COOKIE)?.value
    )

    if (!code || !state || !expectedState || state !== expectedState) {
      return NextResponse.redirect(
        new URL("/?authError=state", request.url)
      )
    }

    // âœ… exchange code â†’ user
    const user = await redeemMicrosoftCode(request, code)

    // âœ… Check database for stored role (for testing: if admin edited role in DB, use it)
    const storedRole = await getStoredUserRole(user.id)
    if (storedRole) {
      user.role = normalizeMicrosoftRole(storedRole)
    }

    // âœ… SAVE TO DATABASE
    await saveMicrosoftAccountLogin(user, getMicrosoftTenantId())

    // âœ… redirect to completion page
    const response = NextResponse.redirect(
      createCompletionUrl(request, user)
    )

    response.cookies.set(AUTH_STATE_COOKIE, "", {
      ...getAuthCookieOptions(new Date(0)),
      maxAge: 0,
    })

    response.cookies.set("redirect_after_login", "", {
      path: "/",
      maxAge: 0,
    })
    response.cookies.set(
      AUTH_USER_COOKIE,
      createUserCookieValue({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: getMicrosoftTenantId(),
      }),
      getAuthCookieOptions(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
    )

    return response
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("Failed to complete Microsoft login:", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    })

    const authError = errorMessage.includes("Only @alabang.sti.edu.ph Microsoft accounts can sign in")
      ? "domain"
      : "callback"

    const response = NextResponse.redirect(
      new URL(`/?authError=${authError}`, request.url)
    )

    response.cookies.set(AUTH_STATE_COOKIE, "", {
      ...getAuthCookieOptions(new Date(0)),
      maxAge: 0,
    })

    response.cookies.set("redirect_after_login", "", {
      path: "/",
      maxAge: 0,
    })
    response.cookies.set(AUTH_USER_COOKIE, "", {
      ...getAuthCookieOptions(new Date(0)),
      maxAge: 0,
    })

    return response
  }
}
