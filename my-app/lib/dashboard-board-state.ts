export const DASHBOARD_BOARD_STATE_STORAGE_KEY = "dashboard-board-state"
export const DASHBOARD_PROJECT_STORAGE_KEY = "dashboard-project"

export type DashboardBoardState = {
  todoCount: number
  inprogressCount: number
  revisionCount: number
  completedCount: number
}

function normalizeStorageKeyPart(value: string | null | undefined, fallback: string) {
  const normalizedValue = value?.trim()

  if (!normalizedValue) {
    return fallback
  }

  return normalizedValue.replace(/[^A-Za-z0-9_-]/g, "_")
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

function readCurrentClientProjectId() {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const userScopedProjectKey = `${DASHBOARD_PROJECT_STORAGE_KEY}:${normalizeStorageKeyPart(
      readCurrentClientUserId(),
      "guest"
    )}`

    const projectId = window.localStorage.getItem(userScopedProjectKey)

    return typeof projectId === "string" && projectId.trim() ? projectId.trim() : null
  } catch {
    return null
  }
}

function getUserScopedStorageKey(baseKey: string) {
  if (typeof window === "undefined") {
    return baseKey
  }

  const userKeyPart = normalizeStorageKeyPart(readCurrentClientUserId(), "guest")
  const projectKeyPart = normalizeStorageKeyPart(readCurrentClientProjectId(), "no-project")

  return `${baseKey}:${userKeyPart}:${projectKeyPart}`
}

function normalizeCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.min(Math.floor(value), 12)
    : 0
}

export function readDashboardBoardState(): DashboardBoardState {
  if (typeof window === "undefined") {
    return {
      todoCount: 0,
      inprogressCount: 0,
      revisionCount: 0,
      completedCount: 0,
    }
  }

  try {
    const storedValue = window.localStorage.getItem(
      getUserScopedStorageKey(DASHBOARD_BOARD_STATE_STORAGE_KEY)
    )

    if (!storedValue) {
      return {
        todoCount: 0,
        inprogressCount: 0,
        revisionCount: 0,
        completedCount: 0,
      }
    }

    const parsedValue = JSON.parse(storedValue) as Partial<DashboardBoardState>

    return {
      todoCount: normalizeCount(parsedValue.todoCount),
      inprogressCount: normalizeCount(parsedValue.inprogressCount),
      revisionCount: normalizeCount(parsedValue.revisionCount),
      completedCount: normalizeCount(parsedValue.completedCount),
    }
  } catch {
    return {
      todoCount: 0,
      inprogressCount: 0,
      revisionCount: 0,
      completedCount: 0,
    }
  }
}

export function writeDashboardBoardState(state: DashboardBoardState) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(
    getUserScopedStorageKey(DASHBOARD_BOARD_STATE_STORAGE_KEY),
    JSON.stringify({
      todoCount: normalizeCount(state.todoCount),
      inprogressCount: normalizeCount(state.inprogressCount),
      revisionCount: normalizeCount(state.revisionCount),
      completedCount: normalizeCount(state.completedCount),
    })
  )
}
