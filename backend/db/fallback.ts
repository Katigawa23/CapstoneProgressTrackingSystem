export function canUseLocalFileFallback() {
  return process.env.NODE_ENV !== "production"
}

export function shouldFallbackToLocalStore(error: unknown) {
  if (!canUseLocalFileFallback()) {
    return false
  }

  const message = error instanceof Error ? error.message : String(error)
  const normalizedMessage = message.toLowerCase()
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code).toUpperCase()
      : ""

  if (["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT"].includes(code)) {
    return true
  }

  return [
    "database_url is not set",
    "unable to establish connection to upstream database",
    "circuit breaker open",
    "timeout expired",
    "timeout exceeded when trying to connect",
    "connection timeout",
    "server closed the connection unexpectedly",
    "too many clients already",
    "remaining connection slots are reserved",
  ].some((fragment) => normalizedMessage.includes(fragment))
}
