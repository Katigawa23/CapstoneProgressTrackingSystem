import { Pool } from "pg"

declare global {
  var __backlogPool: Pool | undefined
}

function createPool() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set")
  }

  return new Pool({
    connectionString,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  })
}

export function getDb() {
  const pool = global.__backlogPool ?? createPool()

  if (process.env.NODE_ENV !== "production") {
    global.__backlogPool = pool
  }

  return pool
}