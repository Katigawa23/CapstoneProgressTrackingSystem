import { NextRequest, NextResponse } from "next/server"

import { getMicrosoftTenantId, redeemMicrosoftCode } from "@/backend/auth/microsoft"
import {
  AUTH_STATE_COOKIE,
  getAuthCookieOptions,
  readStateCookieValue,
} from "@/backend/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function createCompletionUrl(request: NextRequest, user: { id: string; name: string; email: string }) {
  const payload = Buffer.from(
    JSON.stringify({
      user,
      tenantId: getMicrosoftTenantId(),
    }),
    "utf8"
  ).toString("base64url")

  const url = new URL("/auth/microsoft/complete", request.url)
  url.hash = `session=${payload}`
  return url
}

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
    const response = NextResponse.redirect(createCompletionUrl(request, user))

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
