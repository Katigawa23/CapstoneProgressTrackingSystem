import { Pool } from "pg"

declare global {
  var __backlogPool: Pool | undefined
}

function shouldUseSsl(connectionString: string) {
  try {
    const { hostname, searchParams } = new URL(connectionString)
    const isLocalHost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"

    if (isLocalHost) {
      return false
    }

    return searchParams.get("sslmode") !== "disable"
  } catch {
    return process.env.NODE_ENV === "production"
  }
}

function createPool() {
  const connectionString = process.env.DATABASE_URL
  const configuredConnectionTimeoutMillis = Number.parseInt(
    process.env.DB_CONNECTION_TIMEOUT_MS ??
      (process.env.NODE_ENV === "production" ? "30000" : "5000"),
    10
  )
  const connectionTimeoutMillis = Number.isNaN(configuredConnectionTimeoutMillis)
    ? process.env.NODE_ENV === "production" ? 30_000 : 5_000
    : process.env.NODE_ENV === "production"
      ? Math.max(configuredConnectionTimeoutMillis, 30_000)
      : configuredConnectionTimeoutMillis
  const maxConnections = Number.parseInt(
    process.env.DB_POOL_MAX ??
      (process.env.NODE_ENV === "production" ? "4" : "10"),
    10
  )

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add your database connection string to .env.local and Vercel project settings."
    )
  }

  const pool = new Pool({
    connectionString,
    ssl: shouldUseSsl(connectionString)
      ? { rejectUnauthorized: false }
      : false,
    max: Number.isNaN(maxConnections) ? 4 : maxConnections,
    idleTimeoutMillis: 30_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    connectionTimeoutMillis,
    allowExitOnIdle: process.env.NODE_ENV !== "production",
  })

  const originalQuery = pool.query.bind(pool) as (...args: unknown[]) => Promise<unknown>
  pool.query = (async (...args: unknown[]) => {
    try {
      return await originalQuery(...args)
    } catch (error) {
      if (!isReadOnlyQuery(args[0]) || !isRetryableConnectionError(error)) throw error

      console.warn("Database connection was interrupted; retrying query once.")
      await new Promise((resolve) => setTimeout(resolve, 250))
      return originalQuery(...args)
    }
  }) as typeof pool.query

  pool.on("error", (error) => {
    console.warn("Idle database connection was closed.", error.message)
  })

  return pool
}

function isReadOnlyQuery(query: unknown) {
  if (typeof query === "string") return /^\s*select\b/i.test(query)
  if (typeof query === "object" && query && "text" in query) {
    return /^\s*select\b/i.test(String(query.text))
  }
  return false
}

function isRetryableConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  const code = typeof error === "object" && error && "code" in error
    ? String(error.code).toUpperCase()
    : ""

  return ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "57P01", "57P02", "57P03"].includes(code) || [
    "connection terminated",
    "connection timeout",
    "connection closed unexpectedly",
    "server closed the connection unexpectedly",
    "timeout expired",
  ].some((fragment) => message.includes(fragment))
}

export function getDb() {
  const pool = global.__backlogPool ?? createPool()

  global.__backlogPool = pool

  return pool
}
