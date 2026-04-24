export const DASHBOARD_HOME_STATE_STORAGE_KEY = "dashboard-home-state"
export const DASHBOARD_HOME_PROJECT_COUNT_COOKIE_KEY = "dashboard-home-project-count"
export const DASHBOARD_HOME_WORKED_ON_COUNT_COOKIE_KEY = "dashboard-home-worked-on-count"

export type DashboardHomeState = {
  recentProjectsCount: number
  workedOnCount: number
}

type CookieStoreLike = {
  get: (name: string) => { value: string } | undefined
}

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

function normalizeCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0
}

export function readDashboardHomeState(): DashboardHomeState {
  if (typeof window === "undefined") {
    return {
      recentProjectsCount: 0,
      workedOnCount: 0,
    }
  }

  try {
    const storedValue = window.localStorage.getItem(
      getUserScopedStorageKey(DASHBOARD_HOME_STATE_STORAGE_KEY)
    )

    if (!storedValue) {
      return {
        recentProjectsCount: 0,
        workedOnCount: 0,
      }
    }

    const parsedValue = JSON.parse(storedValue) as Partial<DashboardHomeState>

    return {
      recentProjectsCount: normalizeCount(parsedValue.recentProjectsCount),
      workedOnCount: normalizeCount(parsedValue.workedOnCount),
    }
  } catch {
    return {
      recentProjectsCount: 0,
      workedOnCount: 0,
    }
  }
}

export function writeDashboardHomeState(state: DashboardHomeState) {
  if (typeof window === "undefined") {
    return
  }

  const recentProjectsCount = normalizeCount(state.recentProjectsCount)
  const workedOnCount = normalizeCount(state.workedOnCount)

  window.localStorage.setItem(
    getUserScopedStorageKey(DASHBOARD_HOME_STATE_STORAGE_KEY),
    JSON.stringify({
      recentProjectsCount,
      workedOnCount,
    })
  )

  document.cookie = `${DASHBOARD_HOME_PROJECT_COUNT_COOKIE_KEY}=${recentProjectsCount}; path=/; max-age=31536000; samesite=lax`
  document.cookie = `${DASHBOARD_HOME_WORKED_ON_COUNT_COOKIE_KEY}=${workedOnCount}; path=/; max-age=31536000; samesite=lax`
}

export function readDashboardHomeStateFromCookieStore(cookieStore: CookieStoreLike): DashboardHomeState {
  const recentProjectsCookieValue =
    cookieStore.get(DASHBOARD_HOME_PROJECT_COUNT_COOKIE_KEY)?.value
  const workedOnCookieValue =
    cookieStore.get(DASHBOARD_HOME_WORKED_ON_COUNT_COOKIE_KEY)?.value

  return {
    recentProjectsCount: normalizeCount(Number(recentProjectsCookieValue)),
    workedOnCount: normalizeCount(Number(workedOnCookieValue)),
  }
}
