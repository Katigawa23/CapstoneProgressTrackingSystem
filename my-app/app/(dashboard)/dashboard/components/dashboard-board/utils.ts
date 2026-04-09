export function formatCommentTime(createdAt: string) {
  const createdAtTime = new Date(createdAt).getTime()
  const minutesAgo = Math.max(
    0,
    Math.floor((Date.now() - createdAtTime) / (1000 * 60))
  )

  if (minutesAgo < 1) {
    return "now"
  }

  if (minutesAgo === 1) {
    return "1 minute ago"
  }

  if (minutesAgo < 60) {
    return `${minutesAgo} minutes ago`
  }

  const hoursAgo = Math.floor(minutesAgo / 60)
  return hoursAgo === 1 ? "1 hour ago" : `${hoursAgo} hours ago`
}

export function formatSubmissionTime(uploadedAt: string) {
  const uploadedDate = new Date(uploadedAt)

  if (Number.isNaN(uploadedDate.getTime())) {
    return "Uploaded recently"
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(uploadedDate)
}

export function formatSubmissionSize(fileSize: number) {
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return "Unknown size"
  }

  if (fileSize < 1024) {
    return `${fileSize} B`
  }

  if (fileSize < 1024 * 1024) {
    return `${(fileSize / 1024).toFixed(1)} KB`
  }

  return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
}
