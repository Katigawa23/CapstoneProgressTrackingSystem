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

const TEST_COORDINATOR_USER = {
  id: "tester-coordinator",
  name: "Coordinator Tester",
  email: "coordinator.tester@alabang.sti.edu.ph",
  role: "faculty" as const,
}

function createCompletionUrl(request: NextRequest, sessionId: string) {
  const redirect = new URL(request.url).searchParams.get("redirect") || "/coordinator"
  const tenantId = getMicrosoftTenantId()
  const payload = Buffer.from(
    JSON.stringify({
      user: TEST_COORDINATOR_USER,
      tenantId,
      sessionId,
    }),
    "utf8"
  ).toString("base64url")

  const url = new URL("/auth/microsoft/complete", request.url)
  url.hash = `session=${payload}&redirect=${encodeURIComponent(
    redirect.startsWith("/") ? redirect : "/coordinator"
  )}`

  return url
}

export async function GET(request: NextRequest) {
  const tenantId = getMicrosoftTenantId()
  let sessionId: string

  try {
    await saveMicrosoftAccountLogin(TEST_COORDINATOR_USER, tenantId)
    sessionId = await createActiveSession(TEST_COORDINATOR_USER.id)
  } catch (error) {
    // Tester sign-in must remain usable when a local database is not configured.
    console.error(
      "Could not persist the coordinator tester login:",
      error instanceof Error ? error.message : error
    )
    return NextResponse.redirect(new URL("/?authError=session", request.url))
  }

  const response = NextResponse.redirect(createCompletionUrl(request, sessionId))
  response.cookies.set(
    AUTH_USER_COOKIE,
    createUserCookieValue({
      ...TEST_COORDINATOR_USER,
      tenantId,
      sessionId,
    }),
    getAuthCookieOptions(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  )

  return response
}
