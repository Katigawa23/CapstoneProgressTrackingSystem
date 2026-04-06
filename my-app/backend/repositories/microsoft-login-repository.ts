import { getDb } from "@/backend/db/connection"

import type { MicrosoftUser } from "@/backend/auth/microsoft"

type MicrosoftLoginRecord = {
  id: string
  microsoft_user_id: string
  email: string
  name: string
  tenant_id: string
  login_at: string
}

let schemaReady: Promise<void> | null = null

async function ensureMicrosoftLoginSchema() {
  if (!schemaReady) {
    schemaReady = getDb()
      .query(`
        create table if not exists microsoft_account_logins (
          id bigserial primary key,
          microsoft_user_id text not null,
          email text not null,
          name text not null,
          tenant_id text not null,
          login_at timestamptz not null default now()
        );
      `)
      .then(() =>
        getDb().query(`
          create index if not exists microsoft_account_logins_lookup_idx
          on microsoft_account_logins(microsoft_user_id, login_at desc);
        `)
      )
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null
        throw error
      })
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
      tenant_id
    ) values ($1, $2, $3, $4)
    returning
      id,
      microsoft_user_id,
      email,
      name,
      tenant_id,
      login_at`,
    [user.id, user.email, user.name, tenantId]
  )

  return result.rows[0]
}