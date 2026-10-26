import { randomUUID } from "crypto"

import { getDb } from "@/lib/server-db"
import { ensureMicrosoftLoginSchema } from "@backend/repositories/users-repository"

let schemaReady: Promise<void> | null = null

async function ensureActiveSessionSchema() {
  await ensureMicrosoftLoginSchema()

  schemaReady ??= getDb()
    .query(`alter table users add column if not exists active_session_id text`)
    .then(() => undefined)
    .catch((error) => {
      schemaReady = null
      throw error
    })

  await schemaReady
}

export async function createActiveSession(userId: string) {
  await ensureActiveSessionSchema()
  const sessionId = randomUUID()
  await getDb().query(
    `update users set active_session_id = $2 where microsoft_user_id = $1`,
    [userId, sessionId]
  )
  return sessionId
}

export async function isActiveSession(userId: string, sessionId: string) {
  await ensureActiveSessionSchema()
  const result = await getDb().query<{ active: boolean }>(
    `select exists(
       select 1 from users
       where microsoft_user_id = $1 and active_session_id = $2
     ) as active`,
    [userId, sessionId]
  )
  return result.rows[0]?.active === true
}
