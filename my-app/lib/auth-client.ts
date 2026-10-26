"use client"

import type { UserRole } from "@/lib/rbac"

export const AUTH_STORAGE_KEY = "tracksphere_auth_session"
export const DASHBOARD_BOOTSTRAP_KEY = "tracksphere_dashboard_bootstrapped"
export const SESSION_REPLACED_KEY = "tracksphere_session_replaced"

const AUTH_CHANGE_EVENT = "tracksphere-auth-change"
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

export type AuthenticatedUser = {
  id: string
  name: string
  email: string
  role: UserRole
}

export type AuthSession = {
  user: AuthenticatedUser
  tenantId: string
  expiresAt: string
  sessionId?: string
}

function isBrowser() {
  return typeof window !== "undefined"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function emitAuthChange() {
  if (!isBrowser()) {
    return
  }

  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
}

function clearInvalidSession() {
  if (!isBrowser()) {
    return
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY)
  window.sessionStorage.removeItem(DASHBOARD_BOOTSTRAP_KEY)
  emitAuthChange()
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!isRecord(value) || !isRecord(value.user)) {
    return false
  }

  return (
    typeof value.user.id === "string" &&
    typeof value.user.name === "string" &&
    typeof value.user.email === "string" &&
    (value.user.role === "student" || value.user.role === "faculty" || value.user.role === "admin") &&
    typeof value.tenantId === "string" &&
    typeof value.expiresAt === "string"
  )
}

export function readClientAuthSession() {
  if (!isBrowser()) {
    return null
  }

  if (window.sessionStorage.getItem(SESSION_REPLACED_KEY) === "true") {
    return null
  }

  const storedValue = window.localStorage.getItem(AUTH_STORAGE_KEY)

  if (!storedValue) {
    return null
  }

  try {
    const parsedValue = JSON.parse(storedValue) as unknown

    if (!isAuthSession(parsedValue)) {
      clearInvalidSession()
      return null
    }

    if (new Date(parsedValue.expiresAt).getTime() <= Date.now()) {
      clearInvalidSession()
      return null
    }

    return parsedValue
  } catch {
    clearInvalidSession()
    return null
  }
}

export function saveClientAuthSession(user: AuthenticatedUser, tenantId: string, sessionId: string) {
  if (!isBrowser()) {
    return null
  }

  const session: AuthSession = {
    user,
    tenantId: tenantId.trim() || "common",
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
    sessionId,
  }

  window.sessionStorage.removeItem(SESSION_REPLACED_KEY)
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  emitAuthChange()

  return session
}

export function clearClientAuthSession() {
  if (!isBrowser()) {
    return
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY)
  window.sessionStorage.removeItem(DASHBOARD_BOOTSTRAP_KEY)
  window.sessionStorage.removeItem(SESSION_REPLACED_KEY)
  emitAuthChange()
}

export function markClientSessionReplaced() {
  if (!isBrowser()) return
  window.sessionStorage.setItem(SESSION_REPLACED_KEY, "true")
  window.sessionStorage.removeItem(DASHBOARD_BOOTSTRAP_KEY)
}

export function isClientSessionReplaced() {
  return isBrowser() && window.sessionStorage.getItem(SESSION_REPLACED_KEY) === "true"
}

export function hasBootstrappedDashboardSession() {
  if (!isBrowser()) {
    return false
  }

  return window.sessionStorage.getItem(DASHBOARD_BOOTSTRAP_KEY) === "true"
}

export function markDashboardSessionBootstrapped() {
  if (!isBrowser()) {
    return
  }

  window.sessionStorage.setItem(DASHBOARD_BOOTSTRAP_KEY, "true")
}

export function subscribeToAuthChange(callback: () => void) {
  if (!isBrowser()) {
    return () => undefined
  }

  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === AUTH_STORAGE_KEY) {
      callback()
    }
  }

  window.addEventListener(AUTH_CHANGE_EVENT, callback)
  window.addEventListener("storage", handleStorageChange)

  return () => {
    window.removeEventListener(AUTH_CHANGE_EVENT, callback)
    window.removeEventListener("storage", handleStorageChange)
  }
}

export function createMicrosoftLogoutUrl(tenantId: string, postLogoutPath = "/") {
  if (!isBrowser()) {
    return postLogoutPath
  }

  const logoutUrl = new URL(
    `https://login.microsoftonline.com/${tenantId.trim() || "common"}/oauth2/v2.0/logout`
  )

  logoutUrl.searchParams.set(
    "post_logout_redirect_uri",
    new URL(postLogoutPath, window.location.origin).toString()
  )

  return logoutUrl.toString()
}
