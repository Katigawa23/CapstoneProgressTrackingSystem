export const COMMENT_ASSET_LIMIT = 2 * 1024 * 1024
export const COMMENT_ASSET_ENCODED_LIMIT = Math.ceil(COMMENT_ASSET_LIMIT / 3) * 4 + 4096

export function readCommentAsset(value: string) {
  try {
    const asset = JSON.parse(value)
    if (typeof asset?.name === "string" && typeof asset.mime === "string" &&
        typeof asset.data === "string" && /^[A-Za-z0-9+/]+={0,2}$/.test(asset.data)) {
      return { name: asset.name as string, mime: asset.mime as string, data: asset.data as string }
    }
  } catch {
    // Older comments stored only the filename.
  }
  return null
}

export function isCommentImage(mime: string) {
  return ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"].includes(mime)
}
