import { cookies } from "next/headers"

import { readAuthenticatedUser } from "@/lib/server-auth"
import {
  getUserScopedProjectCookieKey,
  PROJECT_COOKIE_KEY,
} from "@/lib/projects"

import { DashboardLayoutShell } from "./layout-shell"
import { getDashboardProjectsData } from "./data"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const authenticatedUser = await readAuthenticatedUser()
  const initialProjects = await getDashboardProjectsData()
  const selectedProjectId =
    cookieStore.get(
      getUserScopedProjectCookieKey(PROJECT_COOKIE_KEY, authenticatedUser?.id)
    )?.value ?? null
  const initialTeam =
    initialProjects.find((project) => project.id === selectedProjectId) ?? initialProjects[0] ?? null

  return (
    <DashboardLayoutShell
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
