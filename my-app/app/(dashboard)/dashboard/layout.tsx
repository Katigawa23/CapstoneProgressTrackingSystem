import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { readAuthenticatedUser } from "@/lib/server-auth"
import {
  getUserScopedProjectCookieKey,
  PROJECT_COOKIE_KEY,
} from "@/lib/projects"

import { DashboardLayoutShell } from "./layout-shell"
import { getDashboardProjectsData } from "./data"
import { isAssignedCoordinator } from "@/lib/server-coordinator-assignments"
import { needsStudentProfileSetup, getStudentAccessState } from "@/lib/server-student-profile"
import { listProjectConfigurationOptions } from "@/lib/server-project-configuration"
import { StudentProfileSetup } from "./components/student-profile-setup"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [cookieStore, authenticatedUser, initialProjects] = await Promise.all([
    cookies(),
    readAuthenticatedUser(true),
    getDashboardProjectsData(),
  ])
  if (authenticatedUser?.role === "student") {
    const access = await getStudentAccessState(authenticatedUser.id)
    if (access.required && access.profileComplete && access.status !== "approved") redirect("/student-verification")
  }
  const coordinatorMode = authenticatedUser?.id
    ? authenticatedUser.id === "tester-coordinator" || await isAssignedCoordinator(authenticatedUser.id)
    : false
  const selectedProjectId =
    cookieStore.get(
      getUserScopedProjectCookieKey(PROJECT_COOKIE_KEY, authenticatedUser?.id)
    )?.value ?? null
  const initialTeam =
    initialProjects.find((project) => project.id === selectedProjectId) ?? initialProjects[0] ?? null
  const needsStudentProfile = authenticatedUser?.role === "student" &&
    await needsStudentProfileSetup(authenticatedUser.id)
  const profileOptions = needsStudentProfile ? await listProjectConfigurationOptions() : []

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
      {needsStudentProfile && authenticatedUser ? <>
        <div aria-hidden="true" className="pointer-events-none select-none space-y-6 p-4 blur-sm">
          <div className="h-8 w-52 rounded bg-muted" />
          <div className="h-px bg-border" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-40 rounded-xl border bg-card" />)}</div>
        </div>
        <StudentProfileSetup
        key={authenticatedUser.id}
        name={authenticatedUser.name}
        email={authenticatedUser.email}
        programs={profileOptions.filter((option) => option.category === "program").map((option) => option.label)}
        yearLevels={profileOptions.filter((option) => option.category === "year_level").map((option) => option.label)}
      /></> : children}
    </DashboardLayoutShell>
  )
}
