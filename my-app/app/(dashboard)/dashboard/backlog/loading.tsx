import { cookies } from "next/headers"

import { getDashboardProjectPageOpenCookieKey } from "@/lib/dashboard-first-open"
import { getUserScopedProjectCookieKey, PROJECT_COOKIE_KEY } from "@/lib/projects"
import { readAuthenticatedUser } from "@/lib/server-auth"

import { BacklogLoadingSkeleton } from "./backlog-loading-skeleton"

export default async function BacklogLoading() {
  const cookieStore = await cookies()
  const authenticatedUser = await readAuthenticatedUser()
  const selectedProjectId =
    cookieStore.get(
      getUserScopedProjectCookieKey(PROJECT_COOKIE_KEY, authenticatedUser?.id)
    )?.value ?? null
  const hasSeenBacklog =
    cookieStore.get(
      getDashboardProjectPageOpenCookieKey("backlog", selectedProjectId, authenticatedUser?.id)
    )?.value === "1"

  if (hasSeenBacklog) {
    return null
  }

  return <BacklogLoadingSkeleton />
}
