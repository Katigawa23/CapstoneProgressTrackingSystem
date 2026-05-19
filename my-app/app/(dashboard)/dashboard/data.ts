import { unstable_cache } from "next/cache"
import { cookies } from "next/headers"

import { readAuthenticatedUser } from "@/lib/server-auth"
import { listProjects } from "@/lib/server-project-repository"
import {
  listBacklogItemsWithStats,
  listProjectBacklogActivities,
} from "@backend/repositories/tasks-repository"
import {
  getUserScopedProjectCookieKey,
  PROJECT_COOKIE_KEY,
  type DashboardProject,
} from "@/lib/projects"

const useDashboardCache = process.env.NODE_ENV === "production"

const getCachedProjects = unstable_cache(
  async (userId: string) => listProjects(userId),
  ["dashboard-projects"],
  {
  revalidate: 300,
  tags: ["projects"],
}
)

const getCachedBacklogItemsWithStats = unstable_cache(
  async (projectId: string, userId: string) =>
    listBacklogItemsWithStats(projectId, userId, { limit: 500, offset: 0 }),
  ["dashboard-backlog-items"],
  {
    revalidate: 60,
    tags: ["backlog-items", "backlog-comments"],
  }
)

const getCachedProjectActivities = unstable_cache(
  async (projectIds: string[], userId: string) =>
    listProjectBacklogActivities(projectIds, userId),
  ["dashboard-project-activities"],
  {
    revalidate: 60,
    tags: ["projects", "backlog-items", "backlog-comments"],
  }
)

export async function getDashboardProjectsData() {
  const user = await readAuthenticatedUser()

  if (!user?.id) {
    return []
  }

  if (useDashboardCache) {
    return getCachedProjects(user.id)
  }

  return listProjects(user.id)
}

export async function getSelectedProjectData() {
  const user = await readAuthenticatedUser()

  if (!user?.id) {
    return {
      projects: [],
      selectedProject: null,
      items: [],
    }
  }

  const projects = await (
    useDashboardCache ? getCachedProjects(user.id) : listProjects(user.id)
  )
  const cookieStore = await cookies()
  const selectedProjectId =
    cookieStore.get(getUserScopedProjectCookieKey(PROJECT_COOKIE_KEY, user.id))
      ?.value ?? null
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null

  const items = selectedProject
    ? await (
        useDashboardCache
          ? getCachedBacklogItemsWithStats(selectedProject.id, user.id)
          : listBacklogItemsWithStats(selectedProject.id, user.id, {
              limit: 500,
              offset: 0,
            })
      )
    : []

  return {
    projects,
    selectedProject,
    items,
  }
}

export async function getDashboardHomeData() {
  const user = await readAuthenticatedUser()

  if (!user?.id) {
    return {
      projects: [],
      activities: [],
    }
  }

  const projects = await (
    useDashboardCache ? getCachedProjects(user.id) : listProjects(user.id)
  )
  const cookieStore = await cookies()
  const selectedProjectId =
    cookieStore.get(getUserScopedProjectCookieKey(PROJECT_COOKIE_KEY, user.id))
      ?.value ?? null
  const orderedProjects = selectedProjectId
    ? [
        ...projects.filter((project) => project.id === selectedProjectId),
        ...projects.filter((project) => project.id !== selectedProjectId),
      ]
    : projects
  const activities = await (
    useDashboardCache
      ? getCachedProjectActivities(
          orderedProjects.map((project) => project.id),
          user.id
        )
      : listProjectBacklogActivities(
          orderedProjects.map((project) => project.id),
          user.id
        )
  )

  return {
    projects: orderedProjects,
    activities,
  }
}

export type DashboardProjectsData = Awaited<ReturnType<typeof getDashboardProjectsData>>
export type SelectedProjectData = Awaited<ReturnType<typeof getSelectedProjectData>>
export type DashboardHomeData = Awaited<ReturnType<typeof getDashboardHomeData>>
export type ServerDashboardProject = DashboardProject
