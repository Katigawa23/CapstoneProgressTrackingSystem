import { cookies } from "next/headers"

import { getDashboardProjectPageOpenCookieKey } from "@/lib/dashboard-first-open"
import { getUserScopedProjectCookieKey, PROJECT_COOKIE_KEY } from "@/lib/projects"
import { readAuthenticatedUser } from "@/lib/server-auth"

import { ArchiveLoadingSkeleton } from "./archive-loading-skeleton"

export default async function ArchiveLoading() {
  const cookieStore = await cookies()
  const authenticatedUser = await readAuthenticatedUser()
  const selectedProjectId =
    cookieStore.get(
      getUserScopedProjectCookieKey(PROJECT_COOKIE_KEY, authenticatedUser?.id)
    )?.value ?? null
  const hasSeenArchive =
    cookieStore.get(
      getDashboardProjectPageOpenCookieKey("archive", selectedProjectId, authenticatedUser?.id)
    )?.value === "1"

  if (hasSeenArchive) {
    return null
  }

  return <ArchiveLoadingSkeleton />
}
