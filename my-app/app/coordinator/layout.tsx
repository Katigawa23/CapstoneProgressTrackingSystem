import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { DashboardLayoutShell } from "@/app/(dashboard)/dashboard/layout-shell"
import { getDashboardProjectsData } from "@/app/(dashboard)/dashboard/data"
import { getUserScopedProjectCookieKey, PROJECT_COOKIE_KEY } from "@/lib/projects"
import { readAuthenticatedUser } from "@/lib/server-auth"

export default async function CoordinatorLayout({ children }: { children: React.ReactNode }) {
  const [cookieStore, user, initialProjects] = await Promise.all([
    cookies(),
    readAuthenticatedUser(),
    getDashboardProjectsData(),
  ])

  if (!user) redirect("/")
  if (user.id !== "tester-coordinator") redirect("/dashboard")

  const selectedProjectId =
    cookieStore.get(getUserScopedProjectCookieKey(PROJECT_COOKIE_KEY, user.id))?.value ?? null
  const initialTeam =
    initialProjects.find((project) => project.id === selectedProjectId) ?? initialProjects[0] ?? null

  return (
    <DashboardLayoutShell
      coordinatorMode
      initialAuthSession={{
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        tenantId: user.tenantId,
        expiresAt: new Date(user.expiresAt).toISOString(),
      }}
      initialProjects={initialProjects}
      initialTeam={initialTeam}
    >
      {children}
    </DashboardLayoutShell>
  )
}
