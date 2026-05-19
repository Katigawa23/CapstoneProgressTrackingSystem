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

const TEST_ADMIN_USER = {
  id: "tester-admin",
  name: "Admin Tester",
  email: "admin.tester@alabang.sti.edu.ph",
  role: "admin" as const,
}

function createCompletionUrl(request: NextRequest) {
  const redirect = new URL(request.url).searchParams.get("redirect") || "/dashboard"
  const tenantId = getMicrosoftTenantId()
  const payload = Buffer.from(
    JSON.stringify({
      user: TEST_ADMIN_USER,
      tenantId,
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
  await saveMicrosoftAccountLogin(TEST_ADMIN_USER, tenantId)

  const response = NextResponse.redirect(createCompletionUrl(request))
  response.cookies.set(
    AUTH_USER_COOKIE,
    createUserCookieValue({
      ...TEST_ADMIN_USER,
      tenantId,
    }),
    getAuthCookieOptions(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  )

  return response
}
