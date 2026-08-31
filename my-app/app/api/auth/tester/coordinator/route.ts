import { NextRequest, NextResponse } from "next/server"

import { getMicrosoftTenantId } from "@backend/auth/microsoft"
import {
  AUTH_USER_COOKIE,
  createUserCookieValue,
  getAuthCookieOptions,
} from "@backend/auth/session"
import { saveMicrosoftAccountLogin } from "@backend/repositories/users-repository"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TEST_COORDINATOR_USER = {
  id: "tester-coordinator",
  name: "Coordinator Tester",
  email: "coordinator.tester@alabang.sti.edu.ph",
  role: "admin" as const,
}

function createCompletionUrl(request: NextRequest) {
  const redirect = new URL(request.url).searchParams.get("redirect") || "/coordinator"
  const tenantId = getMicrosoftTenantId()
  const payload = Buffer.from(
    JSON.stringify({
      user: TEST_COORDINATOR_USER,
      tenantId,
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

  try {
    await saveMicrosoftAccountLogin(TEST_COORDINATOR_USER, tenantId)
  } catch (error) {
    // Tester sign-in must remain usable when a local database is not configured.
    console.warn(
      "Could not persist the coordinator tester login:",
      error instanceof Error ? error.message : error
    )
  }

  const response = NextResponse.redirect(createCompletionUrl(request))
  response.cookies.set(
    AUTH_USER_COOKIE,
    createUserCookieValue({
      ...TEST_COORDINATOR_USER,
      tenantId,
    }),
    getAuthCookieOptions(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  )

  return response
}
