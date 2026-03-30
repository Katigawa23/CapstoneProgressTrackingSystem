import { randomBytes } from "crypto"

export type MicrosoftUser = {
  id: string
  name: string
  email: string
}

type MicrosoftTokenResponse = {
  access_token?: string
  id_token?: string
  error?: string
  error_description?: string
}

type MicrosoftIdTokenClaims = {
  sub?: string
  oid?: string
  name?: string
  email?: string
  preferred_username?: string
}

function readEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim()

    if (value) {
      return value
    }
  }

  return ""
}

function readFirstHeaderValue(request: Request, name: string) {
  const value = request.headers.get(name)?.trim()

  if (!value) {
    return ""
  }

  return value
    .split(",")
    .map((part) => part.trim())
    .find(Boolean) ?? ""
}

function normalizeBaseUrl(value: string) {
  const withProtocol = value.startsWith("http") ? value : `https://${value}`

  return withProtocol.replace(/\/+$/, "")
}

function hasEnvValue(...names: string[]) {
  return Boolean(readEnv(...names))
}

export function getMicrosoftTenantId() {
  return readEnv("MICROSOFT_TENANT_ID", "microsoft_tenant_id") || "common"
}

export function getMicrosoftClientId() {
  const value = readEnv("MICROSOFT_CLIENT_ID", "client_id", "microsoft_client_id")

  if (!value) {
    throw new Error("MICROSOFT_CLIENT_ID is not set")
  }

  return value
}

export function getMicrosoftClientSecret() {
  const value = readEnv("MICROSOFT_CLIENT_SECRET", "client_secret", "microsoft_client_secret")

  if (!value) {
    throw new Error("MICROSOFT_CLIENT_SECRET is not set")
  }

  return value
}

function getMicrosoftScopes() {
  return "openid profile email offline_access User.Read"
}

function getAppBaseUrl(request: Request) {
  const configuredUrl = readEnv(
    "APP_URL",
    "NEXT_PUBLIC_APP_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
    "app_url"
  )

  if (configuredUrl) {
    return normalizeBaseUrl(configuredUrl)
  }

  const forwardedHost = readFirstHeaderValue(request, "x-forwarded-host")
  const forwardedProto = readFirstHeaderValue(request, "x-forwarded-proto")

  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`
  }

  const host = readFirstHeaderValue(request, "host")

  if (host) {
    const requestUrl = new URL(request.url)

    return `${requestUrl.protocol}//${host}`
  }

  const vercelUrl = process.env.VERCEL_URL?.trim()

  if (vercelUrl) {
    return normalizeBaseUrl(vercelUrl)
  }

  return new URL(request.url).origin
}

export function getMicrosoftCallbackUrl(request: Request) {
  return new URL("/api/auth/microsoft/callback", getAppBaseUrl(request)).toString()
}

export function getMicrosoftAuthDebugInfo(request: Request) {
  return {
    requestUrl: request.url,
    appUrlConfigured: hasEnvValue("APP_URL", "NEXT_PUBLIC_APP_URL", "VERCEL_PROJECT_PRODUCTION_URL", "app_url"),
    clientIdConfigured: hasEnvValue("MICROSOFT_CLIENT_ID", "client_id", "microsoft_client_id"),
    clientSecretConfigured: hasEnvValue(
      "MICROSOFT_CLIENT_SECRET",
      "client_secret",
      "microsoft_client_secret"
    ),
    authSecretConfigured: hasEnvValue("AUTH_SECRET", "auth_secret", "NEXTAUTH_SECRET"),
    tenantId: getMicrosoftTenantId(),
    resolvedBaseUrl: getAppBaseUrl(request),
    resolvedCallbackUrl: getMicrosoftCallbackUrl(request),
    forwardedHost: readFirstHeaderValue(request, "x-forwarded-host"),
    forwardedProto: readFirstHeaderValue(request, "x-forwarded-proto"),
    host: readFirstHeaderValue(request, "host"),
    vercelUrl: process.env.VERCEL_URL?.trim() || "",
    vercelProjectProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || "",
    nodeEnv: process.env.NODE_ENV?.trim() || "",
  }
}

export function createOauthState() {
  return randomBytes(24).toString("hex")
}

export function createMicrosoftAuthorizeUrl(request: Request, state: string) {
  const tenantId = getMicrosoftTenantId()
  const url = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`)

  url.searchParams.set("client_id", getMicrosoftClientId())
  url.searchParams.set("response_type", "code")
  url.searchParams.set("redirect_uri", getMicrosoftCallbackUrl(request))
  url.searchParams.set("response_mode", "query")
  url.searchParams.set("scope", getMicrosoftScopes())
  url.searchParams.set("state", state)
  url.searchParams.set("prompt", "select_account")

  return url.toString()
}

function parseJwtPayload<T>(token: string) {
  const [, payload] = token.split(".")

  if (!payload) {
    throw new Error("Invalid token payload")
  }

  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T
}

function getUserFromIdToken(idToken: string): MicrosoftUser {
  const claims = parseJwtPayload<MicrosoftIdTokenClaims>(idToken)
  const email = claims.email ?? claims.preferred_username ?? ""
  const id = claims.oid ?? claims.sub ?? email

  if (!id || !email) {
    throw new Error("Microsoft account details are incomplete")
  }

  return {
    id,
    email,
    name: claims.name ?? email,
  }
}

export async function redeemMicrosoftCode(request: Request, code: string) {
  const tenantId = getMicrosoftTenantId()
  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: getMicrosoftClientId(),
      client_secret: getMicrosoftClientSecret(),
      code,
      redirect_uri: getMicrosoftCallbackUrl(request),
      grant_type: "authorization_code",
      scope: getMicrosoftScopes(),
    }),
  })

  const data = (await response.json()) as MicrosoftTokenResponse

  if (!response.ok || data.error) {
    throw new Error(
      JSON.stringify({
        message: "Microsoft token exchange failed",
        status: response.status,
        statusText: response.statusText,
        error: data.error || null,
        errorDescription: data.error_description || null,
        callbackUrl: getMicrosoftCallbackUrl(request),
      })
    )
  }

  if (!data.id_token) {
    throw new Error("Microsoft did not return an ID token")
  }

  return getUserFromIdToken(data.id_token)
}
