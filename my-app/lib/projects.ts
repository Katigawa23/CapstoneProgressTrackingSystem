export const PROJECT_STORAGE_KEY = "dashboard-project"
export const PROJECT_COOKIE_KEY = "dashboard-project"
export const PROJECTS_COOKIE_KEY = "dashboard-projects"
export const PROJECT_CHANGE_EVENT = "dashboard-project-change"
export const PROJECTS_STORAGE_KEY = "dashboard-projects"
export const PROJECTS_CHANGE_EVENT = "dashboard-projects-change"
export const PROJECT_TITLE_MAX_LENGTH = 40
export const PROJECT_METADATA_MAX_LENGTH = 60
export const OTHER_PROJECT_OPTION = "__other__"

export const PROJECT_PROGRAM_OPTIONS = [
  "BS Information Technology",
  "BS Computer Science",
  "BS Information Systems",
  "Other",
] as const

export const PROJECT_YEAR_LEVEL_OPTIONS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "Other",
] as const

export const PROJECT_SY_TERM_OPTIONS = [
  "1st term",
  "2nd term",
  "Other",
] as const

export const PROJECT_TYPE_OPTIONS = [
  "Capstone",
  "Thesis",
  "Research",
  "System Development",
  "Other",
] as const

export type DashboardProject = {
  id: string
  name: string
  members: string[]
  advisers: string[]
  starred: boolean
  memberUserIds: string[]
  program: string
  yearLevel: string
  syTerm: string
  projectType: string
  createdAt: string
}

export type DashboardProjectCollection = {
  label: string
  items: DashboardProject[]
}

type CookieStoreLike = {
  get: (name: string) => { value: string } | undefined
}

export type CreateDashboardProjectInput = {
  name: string
  members: string[]
  advisers?: string[]
  memberUserIds?: string[]
  program: string
  yearLevel: string
  syTerm: string
  projectType: string
}

export const dashboardProjects: DashboardProject[] = []

function getUserScopedStorageKey(baseKey: string) {
  if (typeof window === "undefined") {
    return baseKey
  }

  try {
    const sessionValue = window.localStorage.getItem("tracksphere_auth_session")

    if (!sessionValue) {
      return `${baseKey}:guest`
    }

    const session = JSON.parse(sessionValue) as {
      user?: { id?: string }
    }
    const userId = session?.user?.id

    return typeof userId === "string" && userId.trim()
      ? `${baseKey}:${userId.trim()}`
      : `${baseKey}:guest`
  } catch {
    return `${baseKey}:guest`
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function normalizeStoredProject(project: unknown): DashboardProject | null {
  if (!project || typeof project !== "object") {
    return null
  }

  const candidate = project as Record<string, unknown>

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    !isStringArray(candidate.members)
  ) {
    return null
  }

  return {
    id: candidate.id,
    name: candidate.name,
    members: candidate.members,
    advisers: isStringArray(candidate.advisers) ? candidate.advisers : [],
    starred: candidate.starred === true,
    memberUserIds: isStringArray(candidate.memberUserIds) ? candidate.memberUserIds : [],
    program: typeof candidate.program === "string" ? candidate.program : "",
    yearLevel: typeof candidate.yearLevel === "string" ? candidate.yearLevel : "",
    syTerm: typeof candidate.syTerm === "string" ? candidate.syTerm : "",
    projectType: typeof candidate.projectType === "string" ? candidate.projectType : "",
    createdAt:
      typeof candidate.createdAt === "string" ? candidate.createdAt : new Date(0).toISOString(),
  }
}

function readStoredProjects() {
  if (typeof window === "undefined") {
    return dashboardProjects
  }

  const storedProjects = window.localStorage.getItem(
    getUserScopedStorageKey(PROJECTS_STORAGE_KEY)
  )

  if (!storedProjects) {
    return dashboardProjects
  }

  try {
    const parsedProjects = JSON.parse(storedProjects) as unknown

    if (!Array.isArray(parsedProjects)) {
      return dashboardProjects
    }

    return parsedProjects
      .map(normalizeStoredProject)
      .filter((project): project is DashboardProject => project !== null)
  } catch {
    return dashboardProjects
  }
}

function writeStoredProjects(projects: DashboardProject[]) {
  if (typeof window === "undefined") {
    return
  }

  const serializedProjects = JSON.stringify(projects)

  window.localStorage.setItem(
    getUserScopedStorageKey(PROJECTS_STORAGE_KEY),
    serializedProjects
  )
  document.cookie = `${PROJECTS_COOKIE_KEY}=${encodeURIComponent(serializedProjects)}; path=/; max-age=31536000; samesite=lax`
  window.dispatchEvent(new CustomEvent(PROJECTS_CHANGE_EVENT, { detail: projects }))
}

function prioritizeProject(
  projects: DashboardProject[],
  projectId: string | null | undefined
) {
  if (!projectId) {
    return projects
  }

  const prioritizedProject =
    projects.find((project) => project.id === projectId) ?? null

  if (!prioritizedProject) {
    return projects
  }

  return [
    prioritizedProject,
    ...projects.filter((project) => project.id !== projectId),
  ]
}

export function getDashboardProjects() {
  return readStoredProjects()
}

export function cacheDashboardProjects(projects: DashboardProject[]) {
  writeStoredProjects(prioritizeProject(projects, getSelectedDashboardProjectId()))
}

export async function refreshDashboardProjects() {
  const response = await fetch("/api/projects", {
    method: "GET",
    cache: "no-store",
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

  return window.localStorage.getItem(getUserScopedStorageKey(PROJECT_STORAGE_KEY))
}

export function getDashboardProject(projectId: string | null | undefined) {
  return findDashboardProject(projectId) ?? getDashboardProjects()[0]
}

export function getDashboardProjectCode(
  project: Pick<DashboardProject, "projectType"> | null | undefined
) {
  const projectType = project?.projectType?.trim().toUpperCase() ?? ""
  const explicitCodeMap: Record<string, string> = {
    CAPSTONE: "CP",
    THESIS: "TH",
    RESEARCH: "RS",
    "SYSTEM DEVELOPMENT": "SD",
  }

  if (projectType in explicitCodeMap) {
    return explicitCodeMap[projectType]
  }

  const words = projectType.split(/[^A-Z0-9]+/).filter(Boolean)

  if (words.length >= 2) {
    return `${words[0][0] ?? "P"}${words[1][0] ?? "J"}`
  }

  const normalized = words[0] ?? ""

  if (!normalized) {
    return "PJ"
  }

  const consonant = normalized
    .slice(1)
    .split("")
    .find((character) => !"AEIOU".includes(character))

  const fallback = normalized[1] ?? "X"

  return `${normalized[0]}${consonant ?? fallback}`.slice(0, 2)
}

export function getProjectMonogram(name: string) {
  const normalizedName = name.trim()

  if (!normalizedName) {
    return "P"
  }

  const words = normalizedName
    .split(/[^A-Za-z0-9]+/)
    .map((word) => word.trim())
    .filter(Boolean)

  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase()
  }

  const singleWord = words[0] ?? normalizedName.replace(/[^A-Za-z0-9]/g, "")

  if (!singleWord) {
    return "P"
  }

  if (singleWord.length <= 4) {
    return (singleWord[0] ?? "P").toUpperCase()
  }

  const lettersOnly = singleWord.replace(/[^A-Za-z]/g, "").toUpperCase()

  if (lettersOnly.length <= 1) {
    return (singleWord[0] ?? "P").toUpperCase()
  }

  const secondLetter =
    lettersOnly
      .slice(1)
      .split("")
      .find((character) => !"AEIOU".includes(character)) ?? lettersOnly[1]

  return `${lettersOnly[0]}${secondLetter ?? ""}`.slice(0, 2)
}

export function getStarredProjects(projects = getDashboardProjects()) {
  return projects.filter((project) => project.starred)
}

export function getRecentProjects(projects = getDashboardProjects()) {
  return projects.filter((project) => !project.starred)
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
  members,
  advisers,
  memberUserIds,
  program,
  yearLevel,
  syTerm,
  projectType,
}: CreateDashboardProjectInput): Promise<DashboardProject> {
  return fetch("/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: name.trim().slice(0, PROJECT_TITLE_MAX_LENGTH),
      members,
      advisers: Array.isArray(advisers) ? advisers : [],
      starred: false,
      memberUserIds: Array.isArray(memberUserIds) ? memberUserIds : [],
      program: program.trim().slice(0, PROJECT_METADATA_MAX_LENGTH),
      yearLevel: yearLevel.trim().slice(0, PROJECT_METADATA_MAX_LENGTH),
      syTerm: syTerm.trim().slice(0, PROJECT_METADATA_MAX_LENGTH),
      projectType: projectType.trim().slice(0, PROJECT_METADATA_MAX_LENGTH),
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

export async function setDashboardProjectStarred(projectId: string, starred: boolean) {
  const response = await fetch("/api/projects", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      starred,
    }),
  })

  if (!response.ok) {
    throw new Error("Failed to update project star")
  }

  const data = (await response.json()) as { project: DashboardProject }
  const nextProjects = getDashboardProjects().map((project) =>
    project.id === data.project.id ? data.project : project
  )

  cacheDashboardProjects(nextProjects)
  return data.project
}

export function setDashboardProject(projectId: string) {
  window.localStorage.setItem(getUserScopedStorageKey(PROJECT_STORAGE_KEY), projectId)
  document.cookie = `${PROJECT_COOKIE_KEY}=${encodeURIComponent(projectId)}; path=/; max-age=31536000; samesite=lax`
  writeStoredProjects(prioritizeProject(getDashboardProjects(), projectId))
  window.dispatchEvent(new CustomEvent(PROJECT_CHANGE_EVENT, { detail: projectId }))
}

export function readDashboardProjectsFromCookieStore(cookieStore: CookieStoreLike) {
  const storedProjects = cookieStore.get(PROJECTS_COOKIE_KEY)?.value

  if (!storedProjects) {
    return dashboardProjects
  }

  try {
    const parsedProjects = JSON.parse(decodeURIComponent(storedProjects)) as unknown

    if (!Array.isArray(parsedProjects)) {
      return dashboardProjects
    }

    return parsedProjects
      .map(normalizeStoredProject)
      .filter((project): project is DashboardProject => project !== null)
  } catch {
    return dashboardProjects
  }
}
