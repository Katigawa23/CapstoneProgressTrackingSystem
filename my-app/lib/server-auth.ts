import { cookies } from "next/headers"

import { AUTH_USER_COOKIE, readUserCookieValue } from "@backend/auth/session"

export async function readAuthenticatedUser() {
  const cookieStore = await cookies()
  return readUserCookieValue(cookieStore.get(AUTH_USER_COOKIE)?.value)
}

export async function requireAuthenticatedUser() {
  const user = await readAuthenticatedUser()

  if (!user?.id) {
    throw new Error("Unauthorized")
  }

  return user
}
