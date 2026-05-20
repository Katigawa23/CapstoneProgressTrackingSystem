import { hasEmoji, stripEmoji } from "@/lib/text-validation"

export const PROJECT_STORAGE_KEY = "dashboard-project"
export const PROJECT_COOKIE_KEY = "dashboard-project"
export const PROJECTS_COOKIE_KEY = "dashboard-projects"
export const PROJECT_CHANGE_EVENT = "dashboard-project-change"
export const PROJECTS_STORAGE_KEY = "dashboard-projects"
export const PROJECTS_CHANGE_EVENT = "dashboard-projects-change"
export const PROJECT_ACCESS_STORAGE_KEY = "dashboard-project-access"
export const PROJECT_ARCHIVE_STORAGE_KEY = "dashboard-project-archive"
export const PROJECT_TITLE_MAX_LENGTH = 40
export const PROJECT_METADATA_MAX_LENGTH = 60
export const OTHER_PROJECT_OPTION = "__other__"

export const PROJECT_PROGRAM_OPTIONS = [
  "BS Information Technology",
  "BS Computer Science",
  "BS Information Systems",
] as const

export const PROJECT_YEAR_LEVEL_OPTIONS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
] as const

export const PROJECT_SY_TERM_OPTIONS = [
  "1st term",
  "2nd term",
] as const

export const PROJECT_TYPE_OPTIONS = [
  "Capstone",
  "Thesis",
] as const

export type DashboardProject = {
  id: string
  name: string
  ownerUserId?: string
  ownerName?: string
  ownerEmail?: string
  members: string[]
  advisers: string[]
  sprintCreatorUserIds: string[]
  starred: boolean
  memberUserIds: string[]
  program: string
  yearLevel: string
  syTerm: string
  projectType: string
  createdAt: string
}

export type ProjectMemberAccessInput = {
  userId: string
  role: string
  canCreateSprint: boolean
}

export type DashboardProjectCollection = {
  label: string
  items: DashboardProject[]
}

export type DashboardProjectAccessRecord = {
  projectId: string
  accessedAt: string
}

export type DashboardArchivedProject = DashboardProject & {
  archivedAt: string
  archivedBy?: string
}

type CookieStoreLike = {
  get: (name: string) => { value: string } | undefined
}

export type CreateDashboardProjectInput = {
  name: string
  members: string[]
  advisers?: string[]
  sprintCreatorUserIds?: string[]
  memberUserIds?: string[]
  memberAccess?: ProjectMemberAccessInput[]
  program: string
  yearLevel: string
  syTerm: string
  projectType: string
}

export function stripEmojiFromProjectTitle(value: string) {
  return stripEmoji(value)
}

export function hasEmojiInProjectTitle(value: string) {
  return hasEmoji(value)
}

export const dashboardProjects: DashboardProject[] = []

function normalizeUserScopedKeyPart(userId: string | null | undefined) {
  const normalizedUserId = userId?.trim()

  if (!normalizedUserId) {
    return "guest"
  }

  return normalizedUserId.replace(/[^A-Za-z0-9_-]/g, "_")
}

export function getUserScopedProjectCookieKey(
  baseKey: string,
  userId: string | null | undefined
) {
  return `${baseKey}-${normalizeUserScopedKeyPart(userId)}`
}

function readCurrentClientUserId() {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const sessionValue = window.localStorage.getItem("tracksphere_auth_session")

    if (!sessionValue) {
      return null
    }

    const session = JSON.parse(sessionValue) as {
      user?: { id?: string }
    }
    const userId = session?.user?.id

    return typeof userId === "string" && userId.trim() ? userId.trim() : null
  } catch {
    return null
  }
}

function getUserScopedStorageKey(baseKey: string) {
  return `${baseKey}:${normalizeUserScopedKeyPart(readCurrentClientUserId())}`
}

function getClientProjectCookieKey(baseKey: string) {
  return getUserScopedProjectCookieKey(baseKey, readCurrentClientUserId())
}

function expireLegacyCookie(baseKey: string) {
  document.cookie = `${baseKey}=; path=/; max-age=0; samesite=lax`
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function normalizeProjectCreatedAt(value: unknown) {
  if (typeof value !== "string") {
    return new Date().toISOString()
  }

  const timestamp = new Date(value).getTime()

  if (Number.isNaN(timestamp) || new Date(timestamp).getUTCFullYear() <= 1971) {
    return new Date().toISOString()
  }

  return value
}

function normalizeProjectAccessRecord(record: unknown): DashboardProjectAccessRecord | null {
  if (!record || typeof record !== "object") {
    return null
  }

  const candidate = record as Record<string, unknown>

  if (typeof candidate.projectId !== "string" || typeof candidate.accessedAt !== "string") {
    return null
  }

  if (Number.isNaN(new Date(candidate.accessedAt).getTime())) {
    return null
  }

  return {
    projectId: candidate.projectId,
    accessedAt: candidate.accessedAt,
  }
}

function normalizeArchivedProject(project: unknown): DashboardArchivedProject | null {
  const normalizedProject = normalizeStoredProject(project)

  if (!normalizedProject || !project || typeof project !== "object") {
    return null
  }

  const candidate = project as Record<string, unknown>

  return {
    ...normalizedProject,
    archivedAt: normalizeProjectCreatedAt(candidate.archivedAt),
    archivedBy:
      typeof candidate.archivedBy === "string" && candidate.archivedBy.trim()
        ? candidate.archivedBy.trim()
        : undefined,
  }
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
    ownerUserId:
      typeof candidate.ownerUserId === "string" ? candidate.ownerUserId : undefined,
    ownerName:
      typeof candidate.ownerName === "string" ? candidate.ownerName : undefined,
    ownerEmail:
      typeof candidate.ownerEmail === "string" ? candidate.ownerEmail : undefined,
    members: candidate.members,
    advisers: isStringArray(candidate.advisers) ? candidate.advisers : [],
    sprintCreatorUserIds: isStringArray(candidate.sprintCreatorUserIds)
      ? candidate.sprintCreatorUserIds
      : [],
    starred: candidate.starred === true,
    memberUserIds: isStringArray(candidate.memberUserIds) ? candidate.memberUserIds : [],
    program: typeof candidate.program === "string" ? candidate.program : "",
    yearLevel: typeof candidate.yearLevel === "string" ? candidate.yearLevel : "",
    syTerm: typeof candidate.syTerm === "string" ? candidate.syTerm : "",
    projectType: typeof candidate.projectType === "string" ? candidate.projectType : "",
    createdAt: normalizeProjectCreatedAt(candidate.createdAt),
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
  const projectsCookieKey = getClientProjectCookieKey(PROJECTS_COOKIE_KEY)

  window.localStorage.setItem(
    getUserScopedStorageKey(PROJECTS_STORAGE_KEY),
    serializedProjects
  )
  document.cookie = `${projectsCookieKey}=${encodeURIComponent(serializedProjects)}; path=/; max-age=31536000; samesite=lax`
  expireLegacyCookie(PROJECTS_COOKIE_KEY)
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
  const archivedProjectIds =
    typeof window === "undefined"
      ? new Set<string>()
      : new Set(getArchivedDashboardProjects().map((project) => project.id))
  const activeProjects = projects.filter((project) => !archivedProjectIds.has(project.id))

  writeStoredProjects(prioritizeProject(activeProjects, getSelectedDashboardProjectId()))
}

function writeArchivedDashboardProjects(projects: DashboardArchivedProject[]) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(
    getUserScopedStorageKey(PROJECT_ARCHIVE_STORAGE_KEY),
    JSON.stringify(projects)
  )
  window.dispatchEvent(new CustomEvent(PROJECTS_CHANGE_EVENT, { detail: getDashboardProjects() }))
}

export function getArchivedDashboardProjects() {
  if (typeof window === "undefined") {
    return [] as DashboardArchivedProject[]
  }

  try {
    const storedProjects = window.localStorage.getItem(
      getUserScopedStorageKey(PROJECT_ARCHIVE_STORAGE_KEY)
    )

    if (!storedProjects) {
      return []
    }

    const parsedProjects = JSON.parse(storedProjects) as unknown

    if (!Array.isArray(parsedProjects)) {
      return []
    }

    return parsedProjects
      .map(normalizeArchivedProject)
      .filter((project): project is DashboardArchivedProject => project !== null)
      .sort(
        (left, right) =>
          new Date(right.archivedAt).getTime() - new Date(left.archivedAt).getTime()
      )
  } catch {
    return []
  }
}

function clearSelectedDashboardProject() {
  const projectCookieKey = getClientProjectCookieKey(PROJECT_COOKIE_KEY)

  window.localStorage.removeItem(getUserScopedStorageKey(PROJECT_STORAGE_KEY))
  document.cookie = `${projectCookieKey}=; path=/; max-age=0; samesite=lax`
  expireLegacyCookie(PROJECT_COOKIE_KEY)
  window.dispatchEvent(new CustomEvent(PROJECT_CHANGE_EVENT, { detail: null }))
}

export function archiveDashboardProject(projectId: string, archivedBy?: string) {
  const project = getDashboardProjects().find((item) => item.id === projectId)

  if (!project) {
    return null
  }

  const archivedProject: DashboardArchivedProject = {
    ...project,
    archivedAt: new Date().toISOString(),
    archivedBy: archivedBy?.trim() || undefined,
  }
  const nextArchivedProjects = [
    archivedProject,
    ...getArchivedDashboardProjects().filter((item) => item.id !== projectId),
  ]
  const nextProjects = getDashboardProjects().filter((item) => item.id !== projectId)

  writeArchivedDashboardProjects(nextArchivedProjects)
  cacheDashboardProjects(nextProjects)

  if (getSelectedDashboardProjectId() === projectId) {
    const nextProjectId = nextProjects[0]?.id

    if (nextProjectId) {
      setDashboardProject(nextProjectId)
    } else {
      clearSelectedDashboardProject()
    }
  }

  return archivedProject
}

export function restoreArchivedDashboardProject(projectId: string) {
  const archivedProject = getArchivedDashboardProjects().find(
    (project) => project.id === projectId
  )

  if (!archivedProject) {
    return null
  }

  const project = normalizeStoredProject(archivedProject)

  if (!project) {
    return null
  }

  writeArchivedDashboardProjects(
    getArchivedDashboardProjects().filter((item) => item.id !== projectId)
  )
  cacheDashboardProjects([
    project,
    ...getDashboardProjects().filter((item) => item.id !== projectId),
  ])

  return project
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
  return getDashboardProjects()
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

export function canCreateSprintForProject(
  project: DashboardProject | null | undefined,
  user: { id?: string; role?: string } | null | undefined
) {
  if (!project || !user?.id) {
    return false
  }

  if (user.role === "faculty" || user.role === "admin") {
    return true
  }

  return project.sprintCreatorUserIds.includes(user.id)
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
  sprintCreatorUserIds,
  memberUserIds,
  memberAccess,
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
      sprintCreatorUserIds: Array.isArray(sprintCreatorUserIds) ? sprintCreatorUserIds : [],
      starred: false,
      memberUserIds: Array.isArray(memberUserIds) ? memberUserIds : [],
      memberAccess: Array.isArray(memberAccess) ? memberAccess : [],
      program: program.trim().slice(0, PROJECT_METADATA_MAX_LENGTH),
      yearLevel: yearLevel.trim().slice(0, PROJECT_METADATA_MAX_LENGTH),
      syTerm: syTerm.trim().slice(0, PROJECT_METADATA_MAX_LENGTH),
      projectType: projectType.trim().slice(0, PROJECT_METADATA_MAX_LENGTH),
    }),
  }).then(async (response) => {
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      throw new Error(data?.error || "Failed to create project")
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

export function getDashboardProjectAccessRecords() {
  if (typeof window === "undefined") {
    return [] as DashboardProjectAccessRecord[]
  }

  try {
    const storedRecords = window.localStorage.getItem(
      getUserScopedStorageKey(PROJECT_ACCESS_STORAGE_KEY)
    )

    if (!storedRecords) {
      return []
    }

    const parsedRecords = JSON.parse(storedRecords) as unknown

    if (!Array.isArray(parsedRecords)) {
      return []
    }

    return parsedRecords
      .map(normalizeProjectAccessRecord)
      .filter((record): record is DashboardProjectAccessRecord => record !== null)
      .sort(
        (left, right) =>
          new Date(right.accessedAt).getTime() - new Date(left.accessedAt).getTime()
      )
  } catch {
    return []
  }
}

function recordDashboardProjectAccess(projectId: string) {
  const nextRecords = [
    { projectId, accessedAt: new Date().toISOString() },
    ...getDashboardProjectAccessRecords().filter((record) => record.projectId !== projectId),
  ].slice(0, 20)

  window.localStorage.setItem(
    getUserScopedStorageKey(PROJECT_ACCESS_STORAGE_KEY),
    JSON.stringify(nextRecords)
  )
}

export function setDashboardProject(projectId: string) {
  const projectCookieKey = getClientProjectCookieKey(PROJECT_COOKIE_KEY)

  window.localStorage.setItem(getUserScopedStorageKey(PROJECT_STORAGE_KEY), projectId)
  document.cookie = `${projectCookieKey}=${encodeURIComponent(projectId)}; path=/; max-age=31536000; samesite=lax`
  expireLegacyCookie(PROJECT_COOKIE_KEY)
  recordDashboardProjectAccess(projectId)
  writeStoredProjects(prioritizeProject(getDashboardProjects(), projectId))
  window.dispatchEvent(new CustomEvent(PROJECT_CHANGE_EVENT, { detail: projectId }))
}

export function readDashboardProjectsFromCookieStore(
  cookieStore: CookieStoreLike,
  userId?: string | null
) {
  const storedProjects = cookieStore.get(
    getUserScopedProjectCookieKey(PROJECTS_COOKIE_KEY, userId)
  )?.value

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
