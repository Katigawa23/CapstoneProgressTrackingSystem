import { cookies } from "next/headers"

import { readAuthenticatedUser } from "@/lib/server-auth"
import { readDashboardHomeStateFromCookieStore } from "@/lib/dashboard-home-state"
import { PROJECT_COOKIE_KEY } from "@/lib/projects"

import { DashboardLayoutClient } from "./layout-client"
import { getDashboardProjectsData } from "./data"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const authenticatedUser = await readAuthenticatedUser()
  const initialDashboardHomeState = readDashboardHomeStateFromCookieStore(cookieStore)
  const initialProjects = await getDashboardProjectsData()
  const selectedProjectId = cookieStore.get(PROJECT_COOKIE_KEY)?.value ?? null
  const initialTeam =
    initialProjects.find((project) => project.id === selectedProjectId) ?? initialProjects[0] ?? null

  return (
    <DashboardLayoutClient
      initialAuthSession={
        authenticatedUser?.id
          ? {
              user: {
                id: authenticatedUser.id,
                name: authenticatedUser.name,
                email: authenticatedUser.email,
              },
              tenantId: authenticatedUser.tenantId,
              expiresAt: new Date(authenticatedUser.expiresAt).toISOString(),
            }
          : null
      }
      initialDashboardHomeState={initialDashboardHomeState}
      initialProjects={initialProjects}
      initialTeam={initialTeam}
    >
      {children}
    </DashboardLayoutClient>
  )
}
