import type { AuthSession } from "@/lib/auth-client"
import type { DashboardProject } from "@/lib/projects"
import { DashboardLayoutClient } from "./layout-client"

export function DashboardLayoutShell({
  children,
  initialAuthSession,
  initialProjects,
  initialTeam,
  coordinatorMode = false,
}: {
  children: React.ReactNode
  initialAuthSession: AuthSession | null
  initialProjects: DashboardProject[]
  initialTeam: DashboardProject | null
  coordinatorMode?: boolean
}) {
  return (
    <DashboardLayoutClient
      initialAuthSession={initialAuthSession}
      initialProjects={initialProjects}
      initialTeam={initialTeam}
      coordinatorMode={coordinatorMode}
    >
      {children}
    </DashboardLayoutClient>
  )
}
