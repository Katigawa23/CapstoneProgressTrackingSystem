"use client"

export const DASHBOARD_ACTIVITY_SYNC_EVENT = "tracksphere-dashboard-activity-sync"
const DASHBOARD_ACTIVITY_SYNC_STORAGE_KEY = "tracksphere-dashboard-activity-sync"

export type DashboardActivitySyncPayload = {
  itemId: string
  assigneeId?: string | null
  checked?: boolean
  orderIndex?: number
  status?: "todo" | "inprogress" | "revision" | "completed"
}

function isBrowser() {
  return typeof window !== "undefined"
}

function isPayload(value: unknown): value is DashboardActivitySyncPayload {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.itemId === "string" &&
    (
      !("assigneeId" in candidate) ||
      typeof candidate.assigneeId === "string" ||
      candidate.assigneeId === null
    ) &&
    (
      !("checked" in candidate) ||
      typeof candidate.checked === "boolean"
    ) &&
    (
      !("orderIndex" in candidate) ||
      typeof candidate.orderIndex === "number"
    ) &&
    (
      !("status" in candidate) ||
      candidate.status === "todo" ||
      candidate.status === "inprogress" ||
      candidate.status === "revision" ||
      candidate.status === "completed"
    )
  )
}

export function broadcastDashboardActivitySync(payload: DashboardActivitySyncPayload) {
  if (!isBrowser()) {
    return
  }

  window.localStorage.setItem(
    DASHBOARD_ACTIVITY_SYNC_STORAGE_KEY,
    JSON.stringify({
      ...payload,
      syncedAt: Date.now(),
    })
  )

  window.dispatchEvent(
    new CustomEvent(DASHBOARD_ACTIVITY_SYNC_EVENT, {
      detail: payload,
    })
  )
}

export function subscribeToDashboardActivitySync(
  callback: (payload: DashboardActivitySyncPayload) => void
) {
  if (!isBrowser()) {
    return () => undefined
  }

  const handleCustomEvent = (event: Event) => {
    const customEvent = event as CustomEvent<DashboardActivitySyncPayload>

    if (isPayload(customEvent.detail)) {
      callback(customEvent.detail)
    }
  }

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key !== DASHBOARD_ACTIVITY_SYNC_STORAGE_KEY ||
      !event.newValue
    ) {
      return
    }

    try {
      const parsedValue = JSON.parse(event.newValue) as unknown

      if (isPayload(parsedValue)) {
        callback(parsedValue)
      }
    } catch {
      return
    }
  }

  window.addEventListener(DASHBOARD_ACTIVITY_SYNC_EVENT, handleCustomEvent)
  window.addEventListener("storage", handleStorage)

  return () => {
    window.removeEventListener(DASHBOARD_ACTIVITY_SYNC_EVENT, handleCustomEvent)
    window.removeEventListener("storage", handleStorage)
  }
}
