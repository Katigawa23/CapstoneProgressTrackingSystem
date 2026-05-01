import { createHmac, timingSafeEqual } from "crypto"

export const AUTH_STATE_COOKIE = "tracksphere_oauth_state"
export const AUTH_USER_COOKIE = "tracksphere_auth_user"

type AuthCookieUser = {
  id: string
  name: string
  email: string
  role: "student" | "adviser" | "admin"
  tenantId: string
  expiresAt: number
}

function getSessionSecret() {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.auth_secret?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.MICROSOFT_CLIENT_SECRET?.trim() ||
    process.env.client_secret?.trim() ||
    process.env.microsoft_client_secret?.trim() ||
    ""
  )
}

function signValue(value: string) {
  const secret = getSessionSecret()

  if (!secret) {
    return null
  }

  return createHmac("sha256", secret).update(value).digest("base64url")
}

function encodeSignedPayload(payload: object) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const signature = signValue(encodedPayload)

  if (!signature) {
    return encodedPayload
  }

  return `${encodedPayload}.${signature}`
}

function decodeSignedPayload<T>(value: string | undefined) {
  if (!value) {
    return null
  }

  const [encodedPayload, signature] = value.split(".")

  if (!encodedPayload) {
    return null
  }

  if (signature) {
    const expectedSignature = signValue(encodedPayload)

    if (!expectedSignature) {
      return null
    }

    const signatureBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expectedSignature)

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null
    }
  }

  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as T
  } catch {
    return null
  }
}

export function createStateCookieValue(state: string) {
  return encodeSignedPayload({
    state,
    expiresAt: Date.now() + 10 * 60 * 1000,
  })
}

export function createUserCookieValue(user: {
  id: string
  name: string
  email: string
  role: "student" | "adviser" | "admin"
  tenantId: string
}) {
  return encodeSignedPayload({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  })
}

export function readStateCookieValue(value: string | undefined) {
  const payload = decodeSignedPayload<{ state: string; expiresAt: number }>(value)

  if (!payload || payload.expiresAt < Date.now()) {
    return null
  }

  return payload.state
}

export function readUserCookieValue(value: string | undefined) {
  const payload = decodeSignedPayload<AuthCookieUser>(value)

  if (
    !payload ||
    typeof payload.id !== "string" ||
    typeof payload.name !== "string" ||
    typeof payload.email !== "string" ||
    (payload.role !== "student" && payload.role !== "adviser" && payload.role !== "admin") ||
    typeof payload.tenantId !== "string" ||
    typeof payload.expiresAt !== "number" ||
    payload.expiresAt < Date.now()
  ) {
    return null
  }

  return payload
}

export function getAuthCookieOptions(expires?: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(expires ? { expires } : {}),
  }
}
