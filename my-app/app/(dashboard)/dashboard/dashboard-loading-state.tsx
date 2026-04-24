"use client"

import * as React from "react"

import { readDashboardHomeState, type DashboardHomeState } from "@/lib/dashboard-home-state"

import { DashboardHomeSkeleton } from "./dashboard-home-skeleton"

export function DashboardLoadingState({
  initialDashboardHomeState,
}: {
  initialDashboardHomeState: DashboardHomeState
}) {
  const [loadingState, setLoadingState] = React.useState({
    hasProjects: initialDashboardHomeState.recentProjectsCount > 0,
    projectCount: initialDashboardHomeState.recentProjectsCount,
    workedOnCount: initialDashboardHomeState.workedOnCount,
  })

  React.useEffect(() => {
    const dashboardHomeState = readDashboardHomeState()

    setLoadingState({
      hasProjects: dashboardHomeState.recentProjectsCount > 0,
      projectCount: dashboardHomeState.recentProjectsCount,
      workedOnCount: dashboardHomeState.workedOnCount,
    })
  }, [])

  return (
    <DashboardHomeSkeleton
      hasProjects={loadingState.hasProjects}
      projectCount={loadingState.projectCount}
      workedOnCount={loadingState.workedOnCount}
      showEmptyState={!loadingState.hasProjects}
    />
  )
}
