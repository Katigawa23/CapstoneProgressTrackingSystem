import { createSign, randomUUID } from "crypto"

type GoogleDriveUploadResult = {
  id: string
  webViewLink: string
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

function getGooglePrivateKey() {
  return process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim()
}

export function isGoogleDriveUploadConfigured() {
  return Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_EMAIL?.trim() &&
      getGooglePrivateKey()
  )
}

async function getGoogleDriveAccessToken() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL?.trim()
  const privateKey = getGooglePrivateKey()

  if (!clientEmail || !privateKey) {
    throw new Error("Google Drive service account is not configured.")
  }

  const now = Math.floor(Date.now() / 1000)
  const header = base64UrlEncode(
    JSON.stringify({
      alg: "RS256",
      typ: "JWT",
    })
  )
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  )
  const unsignedJwt = `${header}.${payload}`
  const signer = createSign("RSA-SHA256")

  signer.update(unsignedJwt)
  signer.end()

  const signature = base64UrlEncode(signer.sign(privateKey))
  const jwt = `${unsignedJwt}.${signature}`
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`Google Drive auth failed: ${detail || response.statusText}`)
  }

  const data = (await response.json()) as { access_token?: string }

  if (!data.access_token) {
    throw new Error("Google Drive auth did not return an access token.")
  }

  return data.access_token
}

async function shareDriveFileForComments(fileId: string, accessToken: string) {
  const shareType = process.env.GOOGLE_DRIVE_SHARE_TYPE?.trim() || "anyone"
  const shareDomain = process.env.GOOGLE_DRIVE_SHARE_DOMAIN?.trim()
  const permission =
    shareType === "domain" && shareDomain
      ? { type: "domain", role: "commenter", domain: shareDomain }
      : { type: "anyone", role: "commenter" }
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId
    )}/permissions?supportsAllDrives=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(permission),
    }
  )

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`Google Drive sharing failed: ${detail || response.statusText}`)
  }
}

export async function uploadAttachmentToGoogleDrive({
  fileName,
  fileType,
  fileData,
}: {
  fileName: string
  fileType: string
  fileData: Buffer
}): Promise<GoogleDriveUploadResult> {
  const accessToken = await getGoogleDriveAccessToken()
  const boundary = `tracksphere-${randomUUID()}`
  const metadata: Record<string, unknown> = {
    name: fileName,
  }
  const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID?.trim()

  if (parentFolderId) {
    metadata.parents = [parentFolderId]
  }

  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
        metadata
      )}\r\n--${boundary}\r\nContent-Type: ${
        fileType || "application/octet-stream"
      }\r\n\r\n`
    ),
    fileData,
    Buffer.from(`\r\n--${boundary}--`),
  ])
  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  )

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`Google Drive upload failed: ${detail || response.statusText}`)
  }

  const data = (await response.json()) as GoogleDriveUploadResult

  if (!data.id) {
    throw new Error("Google Drive upload did not return a file id.")
  }

  await shareDriveFileForComments(data.id, accessToken)

  return {
    id: data.id,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
  }
}
