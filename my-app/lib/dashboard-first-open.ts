const DASHBOARD_HOME_OPEN_COOKIE_KEY = "dashboard-home-open"
const DASHBOARD_BOARD_OPEN_COOKIE_KEY = "dashboard-board-open"
const DASHBOARD_PROJECT_PAGE_OPEN_COOKIE_KEY = "dashboard-project-page-open"

function normalizeCookieKeyPart(value: string | null | undefined, fallback: string) {
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

function readCookieValue(cookieKey: string) {
  if (typeof document === "undefined") {
    return null
  }

  const cookiePrefix = `${cookieKey}=`
  const matchedCookie = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(cookiePrefix))

  if (!matchedCookie) {
    return null
  }

  return decodeURIComponent(matchedCookie.slice(cookiePrefix.length))
}

function writeSessionCookie(cookieKey: string, value: string) {
  if (typeof document === "undefined") {
    return
  }

  document.cookie = `${cookieKey}=${encodeURIComponent(value)}; path=/; samesite=lax`
}

export function getDashboardHomeOpenCookieKey(userId?: string | null) {
  return `${DASHBOARD_HOME_OPEN_COOKIE_KEY}:${normalizeCookieKeyPart(userId, "guest")}`
}

export function getDashboardBoardOpenCookieKey(
  projectId?: string | null,
  userId?: string | null
) {
  return `${DASHBOARD_BOARD_OPEN_COOKIE_KEY}:${normalizeCookieKeyPart(
    userId,
    "guest"
  )}:${normalizeCookieKeyPart(projectId, "no-project")}`
}

export function getDashboardProjectPageOpenCookieKey(
  page: "backlog" | "members" | "archive",
  projectId?: string | null,
  userId?: string | null
) {
  return `${DASHBOARD_PROJECT_PAGE_OPEN_COOKIE_KEY}:${page}:${normalizeCookieKeyPart(
    userId,
    "guest"
  )}:${normalizeCookieKeyPart(projectId, "no-project")}`
}

export function hasSeenDashboardHomeInSession() {
  return readCookieValue(
    getDashboardHomeOpenCookieKey(readCurrentClientUserId())
  ) === "1"
}

export function markDashboardHomeSeenInSession() {
  writeSessionCookie(
    getDashboardHomeOpenCookieKey(readCurrentClientUserId()),
    "1"
  )
}

export function hasSeenDashboardBoardInSession(projectId?: string | null) {
  return (
    readCookieValue(
      getDashboardBoardOpenCookieKey(projectId, readCurrentClientUserId())
    ) === "1"
  )
}

export function markDashboardBoardSeenInSession(projectId?: string | null) {
  writeSessionCookie(
    getDashboardBoardOpenCookieKey(projectId, readCurrentClientUserId()),
    "1"
  )
}

export function hasSeenDashboardProjectPageInSession(
  page: "backlog" | "members" | "archive",
  projectId?: string | null
) {
  return (
    readCookieValue(
      getDashboardProjectPageOpenCookieKey(page, projectId, readCurrentClientUserId())
    ) === "1"
  )
}

export function markDashboardProjectPageSeenInSession(
  page: "backlog" | "members" | "archive",
  projectId?: string | null
) {
  writeSessionCookie(
    getDashboardProjectPageOpenCookieKey(page, projectId, readCurrentClientUserId()),
    "1"
  )
}
