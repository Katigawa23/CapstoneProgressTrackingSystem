export const APP_TIME_ZONE = "Asia/Singapore"

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

type TrustedTimeSyncState = {
  serverNowMs: number
  performanceNowMs: number
  timeZone: string
}

declare global {
  interface Window {
    __TRACKSPHERE_TIME_SYNC__?: TrustedTimeSyncState
  }
}

function getDatePartsFormatter(timeZone = APP_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

function getDisplayDateFormatter(timeZone = APP_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function getDisplayDateTimeFormatter(timeZone = APP_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0")
}

function getBrowserTrustedTimeState() {
  if (typeof window === "undefined") {
    return null
  }

  if (!window.__TRACKSPHERE_TIME_SYNC__) {
    window.__TRACKSPHERE_TIME_SYNC__ = {
      serverNowMs: Date.now(),
      performanceNowMs:
        typeof window.performance?.now === "function" ? window.performance.now() : 0,
      timeZone: APP_TIME_ZONE,
    }
  }

  return window.__TRACKSPHERE_TIME_SYNC__
}

export function getTrustedNowMs() {
  const browserState = getBrowserTrustedTimeState()

  if (!browserState) {
    return Date.now()
  }

  const elapsedMs =
    typeof window.performance?.now === "function"
      ? Math.max(window.performance.now() - browserState.performanceNowMs, 0)
      : 0

  return browserState.serverNowMs + elapsedMs
}

export function getTrustedNowDate() {
  return new Date(getTrustedNowMs())
}

export function getDateStringInTimeZone(
  value: Date | number,
  timeZone = APP_TIME_ZONE
) {
  const date = typeof value === "number" ? new Date(value) : value
  const parts = getDatePartsFormatter(timeZone).formatToParts(date)

  const year = parts.find((part) => part.type === "year")?.value ?? "1970"
  const month = parts.find((part) => part.type === "month")?.value ?? "01"
  const day = parts.find((part) => part.type === "day")?.value ?? "01"

  return `${year}-${month}-${day}`
}

export function getTrustedTodayDateString(timeZone = APP_TIME_ZONE) {
  return getDateStringInTimeZone(getTrustedNowMs(), timeZone)
}

export function getTrustedCurrentYear(timeZone = APP_TIME_ZONE) {
  return Number.parseInt(getTrustedTodayDateString(timeZone).slice(0, 4), 10)
}

export function getLocalDateString(value: Date) {
  return `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}-${padDatePart(value.getDate())}`
}

export function parseDateStringToDayNumber(value: string) {
  const [yearRaw, monthRaw, dayRaw] = value.split("-")
  const year = Number.parseInt(yearRaw ?? "", 10)
  const month = Number.parseInt(monthRaw ?? "", 10)
  const day = Number.parseInt(dayRaw ?? "", 10)

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day)
  ) {
    return Number.NaN
  }

  return Math.floor(Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY)
}

export function getTrustedTodayDayNumber(timeZone = APP_TIME_ZONE) {
  return parseDateStringToDayNumber(getTrustedTodayDateString(timeZone))
}

export function formatTrustedDate(dateString: string, timeZone = APP_TIME_ZONE) {
  if (!dateString) {
    return "No deadline"
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const safeMiddayUtcDate = new Date(`${dateString}T12:00:00Z`)
    return getDisplayDateFormatter(timeZone).format(safeMiddayUtcDate)
  }

  const parsedDate = new Date(dateString)

  if (Number.isNaN(parsedDate.getTime())) {
    return dateString
  }

  return getDisplayDateFormatter(timeZone).format(parsedDate)
}

export function formatTrustedDateTime(dateString: string, timeZone = APP_TIME_ZONE) {
  const parsedDate = new Date(dateString)

  if (Number.isNaN(parsedDate.getTime())) {
    return dateString
  }

  return getDisplayDateTimeFormatter(timeZone).format(parsedDate)
}
