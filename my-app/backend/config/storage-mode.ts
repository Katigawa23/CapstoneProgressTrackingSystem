export type LocalStorageMode = "database" | "file"

export function getPreferredStorageMode(): LocalStorageMode {
  const configuredMode = process.env.LOCAL_STORAGE_MODE?.trim().toLowerCase()
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim())

  if (configuredMode === "database" || configuredMode === "file") {
    return configuredMode
  }

  if (hasDatabaseUrl) {
    return "database"
  }

  return process.env.NODE_ENV === "production" ? "database" : "file"
}
