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
  const connectionTimeoutMillis = Number.parseInt(
    process.env.DB_CONNECTION_TIMEOUT_MS ??
      (process.env.NODE_ENV === "production" ? "10000" : "2000"),
    10
  )

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add your database connection string to .env.local and Vercel project settings."
    )
  }

  return new Pool({
    connectionString,
    ssl: shouldUseSsl(connectionString)
      ? { rejectUnauthorized: false }
      : false,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: Number.isNaN(connectionTimeoutMillis)
      ? 2_000
      : connectionTimeoutMillis,
    allowExitOnIdle: process.env.NODE_ENV !== "production",
  })
}

export function getDb() {
  const pool = global.__backlogPool ?? createPool()

  if (process.env.NODE_ENV !== "production") {
    global.__backlogPool = pool
  }

  return pool
}
