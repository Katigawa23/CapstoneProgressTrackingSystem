import { cookies } from "next/headers"

import { getUserScopedProjectCookieKey, PROJECT_COOKIE_KEY } from "@/lib/projects"
import { readAuthenticatedUser } from "@/lib/server-auth"
import { getDashboardProjectsData } from "../data"

import { WeeklyJournalView } from "./weekly-journal-view"

export default async function JournalPage() {
  const user = await readAuthenticatedUser()

  if (!user?.id) return null

  const [projects, cookieStore] = await Promise.all([getDashboardProjectsData(), cookies()])
  const selectedProjectId = cookieStore.get(
    getUserScopedProjectCookieKey(PROJECT_COOKIE_KEY, user.id)
  )?.value
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null

  if (!selectedProject) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a project or group to view its weekly journal.
      </div>
    )
  }

  return (
    <WeeklyJournalView
      groupCreatedAt={selectedProject.createdAt}
      projectName={selectedProject.name}
      initialNow={new Date().toISOString()}
      canApprove={user.id === "tester-coordinator"}
    />
  )
}
