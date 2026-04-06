import { randomBytes } from "crypto"

export type MicrosoftUser = {
  id: string
  name: string
  email: string
  role?: string
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

function sanitizeEnvValue(value: string | undefined) {
  const trimmedValue = value?.trim()

  if (!trimmedValue) {
    return ""
  }

  const hasMatchingQuotes =
    (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
    (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))

  return hasMatchingQuotes ? trimmedValue.slice(1, -1).trim() : trimmedValue
}

function readEnv(...names: string[]) {
  for (const name of names) {
    const value = sanitizeEnvValue(process.env[name])

    if (value) {
      return value
    }
  }

  return ""
}

export function getMicrosoftTenantId() {
  return (
    readEnv(
      "MICROSOFT_TENANT_ID",
      "TENANT_ID",
      "AZURE_TENANT_ID",
      "AZURE_AD_TENANT_ID",
      "microsoft_tenant_id"
    ) || "common"
  )
}

export function getMicrosoftClientId() {
  const value = readEnv(
    "MICROSOFT_CLIENT_ID",
    "CLIENT_ID",
    "NEXT_PUBLIC_MICROSOFT_CLIENT_ID",
    "AZURE_CLIENT_ID",
    "AZURE_AD_CLIENT_ID",
    "client_id",
    "microsoft_client_id"
  )

  if (!value) {
    throw new Error("MICROSOFT_CLIENT_ID is not set")
  }

  return value
}

export function getMicrosoftClientSecret() {
  const value = readEnv(
    "MICROSOFT_CLIENT_SECRET",
    "CLIENT_SECRET",
    "AZURE_CLIENT_SECRET",
    "AZURE_AD_CLIENT_SECRET",
    "client_secret",
    "microsoft_client_secret"
  )

  if (!value) {
    throw new Error("MICROSOFT_CLIENT_SECRET is not set")
  }

  return value
}

function getMicrosoftScopes() {
  return "openid profile email offline_access User.Read"
}


function getAppBaseUrl(request: Request) {
  const appUrl = process.env.APP_URL

  // ✅ Always use APP_URL if set
  if (appUrl && appUrl.trim() !== "") {
    return appUrl.replace(/\/+$/, "")
  }

  // fallback (only if env missing)
  return new URL(request.url).origin
}

export function getMicrosoftCallbackUrl(request: Request) {
  return new URL(
    "/api/auth/microsoft/callback",
    getAppBaseUrl(request)
  ).toString()
}

export function createOauthState() {
  return randomBytes(24).toString("hex")
}

export function createMicrosoftAuthorizeUrl(
  request: Request,
  state: string
) {
  const tenantId = getMicrosoftTenantId()

  const url = new URL(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`
  )

  url.searchParams.set("client_id", getMicrosoftClientId())
  url.searchParams.set("response_type", "code")
  url.searchParams.set(
    "redirect_uri",
    getMicrosoftCallbackUrl(request)
  )
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

  return JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8")
  ) as T
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

export async function redeemMicrosoftCode(
  request: Request,
  code: string
) {
  const tenantId = getMicrosoftTenantId()

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
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
    }
  )

  const data = (await response.json()) as MicrosoftTokenResponse

  if (!response.ok || data.error) {
    throw new Error(
      data.error_description ||
        data.error ||
        "Microsoft token exchange failed"
    )
  }

  if (!data.id_token) {
    throw new Error("Microsoft did not return an ID token")
  }

  return getUserFromIdToken(data.id_token)
}
