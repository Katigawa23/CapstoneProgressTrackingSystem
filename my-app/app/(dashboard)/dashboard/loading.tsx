import { cookies } from "next/headers"

import { readDashboardHomeStateFromCookieStore } from "@/lib/dashboard-home-state"

import { DashboardLoadingState } from "./dashboard-loading-state"

export default async function DashboardLoading() {
  const cookieStore = await cookies()

  return (
    <DashboardLoadingState
      initialDashboardHomeState={readDashboardHomeStateFromCookieStore(cookieStore)}
    />
  )
}
