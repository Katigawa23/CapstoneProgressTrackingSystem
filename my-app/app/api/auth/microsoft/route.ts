import { NextResponse } from "next/server"
import { cookies } from "next/headers"

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
    const pendingNotification = (await cookies()).get("pending_email_notification")?.value
    const emailRedirect = pendingNotification &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pendingNotification)
      ? `/api/notifications/email/open?notificationId=${pendingNotification}`
      : undefined
    const redirect = searchParams.get("redirect") || emailRedirect || "/dashboard"

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
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    })
    response.cookies.set("pending_email_notification", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    })

    return response
  } catch (error) {
    console.error("Failed to start Microsoft login", error)
    return NextResponse.redirect(new URL("/?authError=setup", request.url))
  }
}
