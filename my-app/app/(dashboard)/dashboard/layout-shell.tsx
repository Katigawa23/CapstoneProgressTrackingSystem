import type { AuthSession } from "@/lib/auth-client"
import type { DashboardProject } from "@/lib/projects"
import { DashboardLayoutClient } from "./layout-client"

export function DashboardLayoutShell({
  children,
  initialAuthSession,
  initialProjects,
  initialTeam,
}: {
  children: React.ReactNode
  initialAuthSession: AuthSession | null
  initialProjects: DashboardProject[]
  initialTeam: DashboardProject | null
}) {
  return (
    <DashboardLayoutClient
      initialAuthSession={initialAuthSession}
      initialProjects={initialProjects}
      initialTeam={initialTeam}
    >
      {children}
    </DashboardLayoutClient>
  )
}
