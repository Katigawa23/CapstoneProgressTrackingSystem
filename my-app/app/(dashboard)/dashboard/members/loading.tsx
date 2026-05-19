import { cookies } from "next/headers"

import { getDashboardProjectPageOpenCookieKey } from "@/lib/dashboard-first-open"
import { getUserScopedProjectCookieKey, PROJECT_COOKIE_KEY } from "@/lib/projects"
import { readAuthenticatedUser } from "@/lib/server-auth"

import { MembersLoadingSkeleton } from "./members-loading-skeleton"

export default async function MembersLoading() {
  const cookieStore = await cookies()
  const authenticatedUser = await readAuthenticatedUser()
  const selectedProjectId =
    cookieStore.get(
      getUserScopedProjectCookieKey(PROJECT_COOKIE_KEY, authenticatedUser?.id)
    )?.value ?? null
  const hasSeenMembers =
    cookieStore.get(
      getDashboardProjectPageOpenCookieKey("members", selectedProjectId, authenticatedUser?.id)
    )?.value === "1"

  if (hasSeenMembers) {
    return null
  }

  return <MembersLoadingSkeleton />
}
