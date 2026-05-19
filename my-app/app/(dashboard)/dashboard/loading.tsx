import { cookies } from "next/headers"

import { getDashboardHomeOpenCookieKey } from "@/lib/dashboard-first-open"
import { readDashboardHomeStateFromCookieStore } from "@/lib/dashboard-home-state"
import { readAuthenticatedUser } from "@/lib/server-auth"

import { DashboardLoadingState } from "./dashboard-loading-state"

export default async function DashboardLoading() {
  const cookieStore = await cookies()
  const authenticatedUser = await readAuthenticatedUser()
  const hasSeenDashboardHome =
    cookieStore.get(getDashboardHomeOpenCookieKey(authenticatedUser?.id))?.value === "1"

  if (hasSeenDashboardHome) {
    return null
  }

  const initialDashboardHomeState = readDashboardHomeStateFromCookieStore(cookieStore)

  return (
    <DashboardLoadingState initialDashboardHomeState={initialDashboardHomeState} />
  )
}
