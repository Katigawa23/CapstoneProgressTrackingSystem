import { cache } from "react"
import { cookies } from "next/headers"

import { AUTH_USER_COOKIE, readUserCookieValue } from "@backend/auth/session"
import { isActiveSession } from "@/lib/server-active-session"

export const readAuthenticatedUser = cache(async () => {
  const cookieStore = await cookies()
  const user = readUserCookieValue(cookieStore.get(AUTH_USER_COOKIE)?.value)
  if (!user) return null

  return (await isActiveSession(user.id, user.sessionId)) ? user : null
})

export async function requireAuthenticatedUser() {
  const user = await readAuthenticatedUser()

  if (!user?.id) {
    throw new Error("Unauthorized")
  }

  return user
}
