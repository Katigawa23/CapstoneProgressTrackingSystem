import { unstable_cache } from "next/cache"
import { cookies } from "next/headers"

import {
  listBacklogItemsWithStats,
  listProjectBacklogActivities,
} from "@/backend/repositories/backlog-repository"
import { listProjects } from "@/backend/repositories/project-repository"
import { PROJECT_COOKIE_KEY, type DashboardProject } from "@/lib/projects"

const getCachedProjects = unstable_cache(async () => listProjects(), ["dashboard-projects"], {
  revalidate: 300,
  tags: ["projects"],
})

const getCachedBacklogItemsWithStats = unstable_cache(
  async (projectId: string) => listBacklogItemsWithStats(projectId, { limit: 500, offset: 0 }),
  ["dashboard-backlog-items"],
  {
    revalidate: 60,
    tags: ["backlog-items", "backlog-comments"],
  }
)

const getCachedProjectActivities = unstable_cache(
  async (projectIds: string[]) => listProjectBacklogActivities(projectIds),
  ["dashboard-project-activities"],
  {
    revalidate: 60,
    tags: ["projects", "backlog-items", "backlog-comments"],
  }
)

export async function getDashboardProjectsData() {
  return getCachedProjects()
}

export async function getSelectedProjectData() {
  const projects = await getCachedProjects()
  const cookieStore = await cookies()
  const selectedProjectId = cookieStore.get(PROJECT_COOKIE_KEY)?.value ?? null
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null

  const items = selectedProject
    ? await getCachedBacklogItemsWithStats(selectedProject.id)
    : []

  return {
    projects,
    selectedProject,
    items,
  }
}

export async function getDashboardHomeData() {
  const projects = await getCachedProjects()
  const activities = await getCachedProjectActivities(projects.map((project) => project.id))

  return {
    projects,
    activities,
  }
}

export type DashboardProjectsData = Awaited<ReturnType<typeof getDashboardProjectsData>>
export type SelectedProjectData = Awaited<ReturnType<typeof getSelectedProjectData>>
export type DashboardHomeData = Awaited<ReturnType<typeof getDashboardHomeData>>
export type ServerDashboardProject = DashboardProject
