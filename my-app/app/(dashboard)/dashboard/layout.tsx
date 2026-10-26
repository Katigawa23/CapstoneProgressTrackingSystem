import { cookies } from "next/headers"

import { readAuthenticatedUser } from "@/lib/server-auth"
import {
  getUserScopedProjectCookieKey,
  PROJECT_COOKIE_KEY,
} from "@/lib/projects"

import { DashboardLayoutShell } from "./layout-shell"
import { getDashboardProjectsData } from "./data"
import { isAssignedCoordinator } from "@/lib/server-coordinator-assignments"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [cookieStore, authenticatedUser, initialProjects] = await Promise.all([
    cookies(),
    readAuthenticatedUser(),
    getDashboardProjectsData(),
  ])
  const coordinatorMode = authenticatedUser?.id
    ? authenticatedUser.id === "tester-coordinator" || await isAssignedCoordinator(authenticatedUser.id)
    : false
  const selectedProjectId =
    cookieStore.get(
      getUserScopedProjectCookieKey(PROJECT_COOKIE_KEY, authenticatedUser?.id)
    )?.value ?? null
  const initialTeam =
    initialProjects.find((project) => project.id === selectedProjectId) ?? initialProjects[0] ?? null

  return (
    <DashboardLayoutShell
      coordinatorMode={coordinatorMode}
      initialAuthSession={
        authenticatedUser?.id
          ? {
              user: {
                id: authenticatedUser.id,
                name: authenticatedUser.name,
                email: authenticatedUser.email,
                role: authenticatedUser.role,
              },
              tenantId: authenticatedUser.tenantId,
              sessionId: authenticatedUser.sessionId,
              expiresAt: new Date(authenticatedUser.expiresAt).toISOString(),
            }
          : null
      }
      initialProjects={initialProjects}
      initialTeam={initialTeam}
    >
      {children}
    </DashboardLayoutShell>
  )
}
