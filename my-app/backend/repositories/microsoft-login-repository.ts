import { getDb } from "@/backend/db/connection"

import type { MicrosoftUser } from "@/backend/auth/microsoft"

type MicrosoftLoginRecord = {
  id: string
  microsoft_user_id: string
  email: string
  name: string
  role: string
  tenant_id: string
  login_at: string
}

let schemaReady: Promise<void> | null = null

async function ensureMicrosoftLoginSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      try {
        // Create table
        await getDb().query(`
          create table if not exists microsoft_account_logins (
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
            create unique index if not exists microsoft_account_logins_unique_user_idx
            on microsoft_account_logins(microsoft_user_id);
          `)
        } catch (err) {
          // Index creation can fail if duplicates exist - that's okay
          console.warn("Could not create unique index (might have duplicate data):", err instanceof Error ? err.message : err)
        }

        // Create lookup index
        await getDb().query(`
          create index if not exists microsoft_account_logins_lookup_idx
          on microsoft_account_logins(microsoft_user_id, login_at desc);
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
  await ensureMicrosoftLoginSchema()

  const result = await getDb().query<MicrosoftLoginRecord>(
    `insert into microsoft_account_logins (
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
  await ensureMicrosoftLoginSchema()

  const result = await getDb().query<MicrosoftLoginRecord>(
    `select role from microsoft_account_logins where microsoft_user_id = $1 order by login_at desc limit 1`,
    [userId]
  )

  return result.rows[0]?.role ?? null
}

export async function updateUserRole(userId: string, newRole: "student" | "adviser"): Promise<boolean> {
  await ensureMicrosoftLoginSchema()

  const result = await getDb().query(
    `update microsoft_account_logins set role = $1 where microsoft_user_id = $2`,
    [newRole, userId]
  )

  return (result.rowCount ?? 0) > 0
}