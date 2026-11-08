import { cache } from "react"
import { cookies } from "next/headers"

import { AUTH_USER_COOKIE, readUserCookieValue } from "@backend/auth/session"
import { isActiveSession } from "@/lib/server-active-session"
import { getStudentAccessState } from "@/lib/server-student-profile"

export const readAuthenticatedUser = cache(async (allowUnverified = false) => {
  const cookieStore = await cookies()
  const user = readUserCookieValue(cookieStore.get(AUTH_USER_COOKIE)?.value)
  if (!user) return null

  if (!await isActiveSession(user.id, user.sessionId)) return null
  if (user.role === "student" && !allowUnverified) {
    const access = await getStudentAccessState(user.id)
    if (access.required && access.status !== "approved") return null
  }
  return user
})

export async function requireAuthenticatedUser() {
  const user = await readAuthenticatedUser()

  if (!user?.id) {
    throw new Error("Unauthorized")
  }

  return user
}
