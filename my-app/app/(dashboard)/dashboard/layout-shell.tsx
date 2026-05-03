"use client"

import dynamic from "next/dynamic"

import type { AuthSession } from "@/lib/auth-client"
import type { DashboardHomeState } from "@/lib/dashboard-home-state"
import type { DashboardProject } from "@/lib/projects"

const DashboardLayoutClient = dynamic(
  () => import("./layout-client").then((module) => module.DashboardLayoutClient),
  {
    ssr: false,
  }
)

export function DashboardLayoutShell({
  children,
  initialAuthSession,
  initialDashboardHomeState,
  initialProjects,
  initialTeam,
}: {
  children: React.ReactNode
  initialAuthSession: AuthSession | null
  initialDashboardHomeState: DashboardHomeState
  initialProjects: DashboardProject[]
  initialTeam: DashboardProject | null
}) {
  return (
    <DashboardLayoutClient
      initialAuthSession={initialAuthSession}
      initialDashboardHomeState={initialDashboardHomeState}
      initialProjects={initialProjects}
      initialTeam={initialTeam}
    >
      {children}
    </DashboardLayoutClient>
  )
}
