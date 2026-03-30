export type LocalStorageMode = "database" | "file"

export function getPreferredStorageMode(): LocalStorageMode {
  const configuredMode = process.env.LOCAL_STORAGE_MODE?.trim().toLowerCase()

  if (configuredMode === "database" || configuredMode === "file") {
    return configuredMode
  }

  return process.env.NODE_ENV === "production" ? "database" : "file"
}
