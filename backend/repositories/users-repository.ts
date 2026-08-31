import { getDb } from "@backend/db/connection"

import type { MicrosoftUser } from "@backend/auth/microsoft"

type MicrosoftLoginRecord = {
  id: string
  microsoft_user_id: string
  email: string
  name: string
  role: string
  tenant_id: string
  login_at: string
}

export type RegisteredMicrosoftUser = {
  id: string
  email: string
  name: string
  role: string
  tenantId: string
  loginAt: string
}

let schemaReady: Promise<void> | null = null

function getSupabaseServerConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "")
  const key =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  return url && key ? { url, key } : null
}

async function saveMicrosoftAccountLoginWithSupabase(
  user: MicrosoftUser,
  tenantId: string
) {
  const config = getSupabaseServerConfig()
  if (!config) {
    throw new Error("DATABASE_URL or a Supabase server secret is required")
  }

  const url = new URL(`${config.url}/rest/v1/users`)
  url.searchParams.set("on_conflict", "microsoft_user_id")
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      microsoft_user_id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || "student",
      tenant_id: tenantId,
      login_at: new Date().toISOString(),
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Supabase user save failed (${response.status}): ${details}`)
  }

  return (await response.json()) as MicrosoftLoginRecord[]
}

async function getStoredUserRoleWithSupabase(userId: string) {
  const config = getSupabaseServerConfig()
  if (!config) return null

  const url = new URL(`${config.url}/rest/v1/users`)
  url.searchParams.set("select", "role")
  url.searchParams.set("microsoft_user_id", `eq.${userId}`)
  url.searchParams.set("order", "login_at.desc")
  url.searchParams.set("limit", "1")
  const response = await fetch(url, {
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    cache: "no-store",
  })

  if (!response.ok) return null
  const rows = (await response.json()) as Array<{ role?: string }>
  return rows[0]?.role ?? null
}

export async function ensureMicrosoftLoginSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      try {
        // Create table
        await getDb().query(`
          create table if not exists users (
            id bigserial primary key,
            microsoft_user_id text not null,
            email text not null,
            name text not null,
            role text not null,
            tenant_id text not null,
            login_at timestamptz not null default now()
          );
        `)

        // Try to create unique index (will fail silently if duplicates exist)
        try {
          await getDb().query(`
            create unique index if not exists users_unique_user_idx
            on users(microsoft_user_id);
          `)
        } catch (err) {
          // Index creation can fail if duplicates exist - that's okay
          console.warn("Could not create unique index (might have duplicate data):", err instanceof Error ? err.message : err)
        }

        // Create lookup index
        await getDb().query(`
          create index if not exists users_lookup_idx
          on users(microsoft_user_id, login_at desc);
        `)
      } catch (error) {
        schemaReady = null
        throw error
      }
    })()
  }

  await schemaReady
}

export async function saveMicrosoftAccountLogin(
  user: MicrosoftUser,
  tenantId: string
) {
  if (!process.env.DATABASE_URL?.trim()) {
    const rows = await saveMicrosoftAccountLoginWithSupabase(user, tenantId)
    return rows[0]
  }

  await ensureMicrosoftLoginSchema()

  const result = await getDb().query<MicrosoftLoginRecord>(
    `insert into users (
      microsoft_user_id,
      email,
      name,
      role,
      tenant_id
    ) values ($1, $2, $3, $4, $5)
    on conflict (microsoft_user_id) do update set
      email = $2,
      name = $3,
      role = $4,
      tenant_id = $5,
      login_at = now()
    returning
      id,
      microsoft_user_id,
      email,
      name,
      role,
      tenant_id,
      login_at`,
    [user.id, user.email, user.name, user.role || 'student', tenantId]
  )

  return result.rows[0]
}

export async function getStoredUserRole(userId: string): Promise<string | null> {
  if (!process.env.DATABASE_URL?.trim()) {
    return getStoredUserRoleWithSupabase(userId)
  }

  await ensureMicrosoftLoginSchema()

  const result = await getDb().query<MicrosoftLoginRecord>(
    `select role from users where microsoft_user_id = $1 order by login_at desc limit 1`,
    [userId]
  )

  return result.rows[0]?.role ?? null
}

export async function updateUserRole(userId: string, newRole: "student" | "faculty"): Promise<boolean> {
  await ensureMicrosoftLoginSchema()

  const result = await getDb().query(
    `update users set role = $1 where microsoft_user_id = $2`,
    [newRole, userId]
  )

  return (result.rowCount ?? 0) > 0
}

export async function searchRegisteredMicrosoftUsers({
  tenantId,
  query,
  limit = 8,
}: {
  tenantId: string
  query?: string
  limit?: number
}): Promise<RegisteredMicrosoftUser[]> {
  await ensureMicrosoftLoginSchema()

  const normalizedQuery = query?.trim() ?? ""
  const searchPattern = `%${normalizedQuery}%`

  const result = await getDb().query<{
    microsoft_user_id: string
    email: string
    name: string
    role: string
    tenant_id: string
    login_at: string
  }>(
    `with latest_users as (
       select distinct on (microsoft_user_id)
         microsoft_user_id,
         email,
         name,
         role,
         tenant_id,
         login_at
       from users
       where tenant_id = $1
         and (
           $2 = ''
           or name ilike $3
           or email ilike $3
         )
       order by microsoft_user_id, login_at desc
     )
     select
       microsoft_user_id,
       email,
       name,
       role,
       tenant_id,
       login_at
     from latest_users
     order by name asc, email asc
     limit $4`,
    [tenantId, normalizedQuery, searchPattern, Math.max(1, Math.min(limit, 20))]
  )

  return result.rows.map((row) => ({
    id: row.microsoft_user_id,
    email: row.email,
    name: row.name,
    role: row.role,
    tenantId: row.tenant_id,
    loginAt: row.login_at,
  }))
}
