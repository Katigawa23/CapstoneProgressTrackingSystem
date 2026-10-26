import { NextRequest, NextResponse } from "next/server"

import { getMicrosoftTenantId } from "@backend/auth/microsoft"
import {
  AUTH_USER_COOKIE,
  createUserCookieValue,
  getAuthCookieOptions,
} from "@backend/auth/session"
import { saveMicrosoftAccountLogin } from "@backend/repositories/users-repository"
import { createActiveSession } from "@/lib/server-active-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TEST_ADMIN_USER = {
  id: "tester-admin",
  name: "Admin Tester",
  email: "admin.tester@alabang.sti.edu.ph",
  role: "admin" as const,
}

function createCompletionUrl(request: NextRequest, sessionId: string) {
  const redirect = new URL(request.url).searchParams.get("redirect") || "/dashboard"
  const tenantId = getMicrosoftTenantId()
  const payload = Buffer.from(
    JSON.stringify({
      user: TEST_ADMIN_USER,
      tenantId,
      sessionId,
    }),
    "utf8"
  ).toString("base64url")

  const url = new URL("/auth/microsoft/complete", request.url)
  url.hash = `session=${payload}&redirect=${encodeURIComponent(
    redirect.startsWith("/") ? redirect : "/dashboard"
  )}`

  return url
}

export async function GET(request: NextRequest) {
  const tenantId = getMicrosoftTenantId()
  let sessionId: string

  try {
    await saveMicrosoftAccountLogin(TEST_ADMIN_USER, tenantId)
    sessionId = await createActiveSession(TEST_ADMIN_USER.id)
  } catch (error) {
    // Tester sign-in must remain usable when a local database is not configured.
    console.error(
      "Could not persist the admin tester login:",
      error instanceof Error ? error.message : error
    )
    return NextResponse.redirect(new URL("/?authError=session", request.url))
  }

  const response = NextResponse.redirect(createCompletionUrl(request, sessionId))
  response.cookies.set(
    AUTH_USER_COOKIE,
    createUserCookieValue({
      ...TEST_ADMIN_USER,
      tenantId,
      sessionId,
    }),
    getAuthCookieOptions(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  )

  return response
}
