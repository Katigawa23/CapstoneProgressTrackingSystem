export const PROJECT_STORAGE_KEY = "dashboard-project"
export const PROJECT_CHANGE_EVENT = "dashboard-project-change"
export const PROJECTS_STORAGE_KEY = "dashboard-projects"
export const PROJECTS_CHANGE_EVENT = "dashboard-projects-change"
export const PROJECT_TITLE_MAX_LENGTH = 40
export const PROJECT_DESCRIPTION_MAX_LENGTH = 120

export type DashboardProject = {
  id: string
  name: string
  description: string
  members: string[]
}

export type DashboardProjectCollection = {
  label: string
  items: DashboardProject[]
}

export type CreateDashboardProjectInput = {
  name: string
  description: string
  members: string[]
}

export const dashboardProjects: DashboardProject[] = []

function readStoredProjects() {
  if (typeof window === "undefined") {
    return dashboardProjects
  }

  const storedProjects = window.localStorage.getItem(PROJECTS_STORAGE_KEY)

  if (!storedProjects) {
    return dashboardProjects
  }

  try {
    const parsedProjects = JSON.parse(storedProjects) as DashboardProject[]
    return Array.isArray(parsedProjects) ? parsedProjects : dashboardProjects
  } catch {
    return dashboardProjects
  }
}

function writeStoredProjects(projects: DashboardProject[]) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects))
  window.dispatchEvent(new CustomEvent(PROJECTS_CHANGE_EVENT, { detail: projects }))
}

export function getDashboardProjects() {
  return readStoredProjects()
}

export function cacheDashboardProjects(projects: DashboardProject[]) {
  writeStoredProjects(projects)
}

export async function refreshDashboardProjects() {
  const response = await fetch("/api/projects", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    throw new Error("Failed to load projects")
  }

  const data = (await response.json()) as { projects: DashboardProject[] }
  cacheDashboardProjects(data.projects)
  return data.projects
}

export function findDashboardProject(projectId: string | null | undefined) {
  return getDashboardProjects().find((project) => project.id === projectId)
}

export function getSelectedDashboardProjectId() {
  if (typeof window === "undefined") {
    return null
  }

  return window.localStorage.getItem(PROJECT_STORAGE_KEY)
}

export function getDashboardProject(projectId: string | null | undefined) {
  return findDashboardProject(projectId) ?? getDashboardProjects()[0]
}

export function getStarredProjects(projects = getDashboardProjects()) {
  return projects.slice(0, 1)
}

export function getRecentProjects(projects = getDashboardProjects()) {
  return projects.slice(1)
}

export function getDashboardProjectCollections(
  projects = getDashboardProjects()
): DashboardProjectCollection[] {
  return [
    {
      label: "Starred",
      items: getStarredProjects(projects),
    },
    {
      label: "Recent",
      items: getRecentProjects(projects),
    },
  ]
}

export function createDashboardProject({
  name,
  description,
  members,
}: CreateDashboardProjectInput): Promise<DashboardProject> {
  return fetch("/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: name.trim().slice(0, PROJECT_TITLE_MAX_LENGTH),
      description: description.trim().slice(0, PROJECT_DESCRIPTION_MAX_LENGTH),
      members,
    }),
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error("Failed to create project")
    }

    const data = (await response.json()) as { project: DashboardProject }
    const nextProjects = [data.project, ...getDashboardProjects().filter((project) => project.id !== data.project.id)]
    cacheDashboardProjects(nextProjects)
    return data.project
  })
}

export function setDashboardProject(projectId: string) {
  window.localStorage.setItem(PROJECT_STORAGE_KEY, projectId)
  window.dispatchEvent(new CustomEvent(PROJECT_CHANGE_EVENT, { detail: projectId }))
}
