import { createHmac, timingSafeEqual } from "crypto"

export const AUTH_SESSION_COOKIE = "tracksphere_session"
export const AUTH_STATE_COOKIE = "tracksphere_oauth_state"

export type AuthenticatedUser = {
  id: string
  name: string
  email: string
}

export type AuthSession = {
  user: AuthenticatedUser
  expiresAt: string
}

function getSessionSecret() {
  const value =
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.MICROSOFT_CLIENT_SECRET?.trim()

  if (!value) {
    throw new Error("AUTH_SECRET or MICROSOFT_CLIENT_SECRET is not set")
  }

  return value
}

function signValue(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url")
}

function encodeSignedPayload(payload: object) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const signature = signValue(encodedPayload)
  return `${encodedPayload}.${signature}`
}

function decodeSignedPayload<T>(value: string | undefined) {
  if (!value) {
    return null
  }

  const [encodedPayload, signature] = value.split(".")

  if (!encodedPayload || !signature) {
    return null
  }

  const expectedSignature = signValue(encodedPayload)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null
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

export function readStateCookieValue(value: string | undefined) {
  const payload = decodeSignedPayload<{ state: string; expiresAt: number }>(value)

  if (!payload || payload.expiresAt < Date.now()) {
    return null
  }

  return payload.state
}

export function createSessionCookieValue(user: AuthenticatedUser) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  return encodeSignedPayload({
    user,
    expiresAt,
  })
}

export function readSessionCookieValue(value: string | undefined) {
  const session = decodeSignedPayload<AuthSession>(value)

  if (!session) {
    return null
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    return null
  }

  return session
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
