import { randomUUID } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

import { getPreferredStorageMode } from "@/backend/config/storage-mode"
import { getDb } from "@/backend/db/connection"

export type BacklogCommentRow = {
  id: string
  backlogItemId: string
  author: string
  body: string
  attachments: string[]
  createdAt: string
}

type CreateBacklogCommentInput = {
  backlogItemId: string
  author: string
  body: string
  attachments: string[]
}

type UpdateBacklogCommentInput = {
  body?: string
  attachments?: string[]
}

type BacklogCommentRecord = {
  id: string
  backlog_item_id: string
  author: string
  body: string
  attachments: string[] | null
  created_at: string
}

type CommentStorageMode = "database" | "file"

const commentsFilePath = path.join(process.cwd(), ".data", "backlog-comments.json")

let schemaReady: Promise<void> | null = null
let storageModePromise: Promise<CommentStorageMode> | null = null
let fallbackWarningShown = false

function canUseFileFallback() {
  return process.env.NODE_ENV !== "production"
}

function shouldUseFileFallback(error: unknown) {
  if (!canUseFileFallback()) {
    return false
  }

  const message = error instanceof Error ? error.message : String(error)

  return [
    "DATABASE_URL is not set",
    "Unable to establish connection to upstream database",
    "Circuit breaker open",
    "ECONNREFUSED",
    "ENOTFOUND",
    "ETIMEDOUT",
    "timeout expired",
    "server closed the connection unexpectedly",
  ].some((fragment) => message.includes(fragment))
}

function showFallbackWarning(error: unknown) {
  if (fallbackWarningShown) {
    return
  }

  fallbackWarningShown = true

  const message = error instanceof Error ? error.message : String(error)

  console.warn(
    `Comment storage is using local file data: ${message}`
  )
}

function mapRecord(record: BacklogCommentRecord): BacklogCommentRow {
  return {
    id: record.id,
    backlogItemId: record.backlog_item_id,
    author: record.author,
    body: record.body,
    attachments: record.attachments ?? [],
    createdAt: record.created_at,
  }
}

function toRecord(row: BacklogCommentRow): BacklogCommentRecord {
  return {
    id: row.id,
    backlog_item_id: row.backlogItemId,
    author: row.author,
    body: row.body,
    attachments: row.attachments,
    created_at: row.createdAt,
  }
}

async function ensureCommentSchema() {
  if (!schemaReady) {
    schemaReady = getDb()
      .query(`
        create table if not exists backlog_comments (
          id uuid primary key,
          backlog_item_id uuid not null references backlog_items(id) on delete cascade,
          author text not null,
          body text not null default '',
          attachments jsonb not null default '[]'::jsonb,
          created_at timestamptz not null default now()
        );
      `)
      .then(() =>
        getDb().query(`
          create index if not exists backlog_comments_backlog_item_id_idx
          on backlog_comments(backlog_item_id, created_at asc);
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

async function getStorageMode(): Promise<CommentStorageMode> {
  if (!storageModePromise) {
    storageModePromise = (async () => {
      if (getPreferredStorageMode() === "file") {
        showFallbackWarning(
          "LOCAL_STORAGE_MODE is set to file, or development mode is using file storage by default."
        )
        return "file"
      }

      if (!process.env.DATABASE_URL) {
        if (!canUseFileFallback()) {
          throw new Error(
            "DATABASE_URL is not set. Add your database connection string to .env.local and Vercel project settings."
          )
        }

        showFallbackWarning("DATABASE_URL is not set")
        return "file"
      }

      try {
        await ensureCommentSchema()
        return "database"
      } catch (error) {
        if (!shouldUseFileFallback(error)) {
          throw error
        }

        showFallbackWarning(error)
        return "file"
      }
    })()
  }

  return storageModePromise
}

async function withCommentStore<T>(
  databaseAction: () => Promise<T>,
  fileAction: () => Promise<T>
) {
  const storageMode = await getStorageMode()

  if (storageMode === "file") {
    return fileAction()
  }

  try {
    return await databaseAction()
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error
    }

    showFallbackWarning(error)
    storageModePromise = Promise.resolve("file")
    return fileAction()
  }
}

async function readFileRecords() {
  try {
    const raw = await readFile(commentsFilePath, "utf8")
    return JSON.parse(raw) as BacklogCommentRecord[]
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : null

    if (code === "ENOENT") {
      return []
    }

    throw error
  }
}

async function writeFileRecords(records: BacklogCommentRecord[]) {
  await mkdir(path.dirname(commentsFilePath), { recursive: true })
  await writeFile(commentsFilePath, JSON.stringify(records, null, 2), "utf8")
}

export async function listBacklogComments(backlogItemId: string) {
  return withCommentStore(
    async () => {
      const result = await getDb().query<BacklogCommentRecord>(
        `select
          id,
          backlog_item_id,
          author,
          body,
          attachments,
          created_at
        from backlog_comments
        where backlog_item_id = $1
        order by created_at asc`,
        [backlogItemId]
      )

      return result.rows.map(mapRecord)
    },
    async () => {
      const records = await readFileRecords()
      return records
        .filter((record) => record.backlog_item_id === backlogItemId)
        .map(mapRecord)
    }
  )
}

export async function createBacklogComment(input: CreateBacklogCommentInput) {
  return withCommentStore(
    async () => {
      const result = await getDb().query<BacklogCommentRecord>(
        `insert into backlog_comments (
          id,
          backlog_item_id,
          author,
          body,
          attachments
        ) values ($1, $2, $3, $4, $5::jsonb)
        returning
          id,
          backlog_item_id,
          author,
          body,
          attachments,
          created_at`,
        [
          randomUUID(),
          input.backlogItemId,
          input.author,
          input.body,
          JSON.stringify(input.attachments),
        ]
      )

      return mapRecord(result.rows[0])
    },
    async () => {
      const comment: BacklogCommentRow = {
        id: randomUUID(),
        backlogItemId: input.backlogItemId,
        author: input.author,
        body: input.body,
        attachments: input.attachments,
        createdAt: new Date().toISOString(),
      }

      const records = await readFileRecords()
      records.push(toRecord(comment))
      await writeFileRecords(records)

      return comment
    }
  )
}

export async function updateBacklogComment(
  id: string,
  input: UpdateBacklogCommentInput
) {
  return withCommentStore(
    async () => {
      const fields: string[] = []
      const values: Array<string> = []

      if (typeof input.body === "string") {
        fields.push(`body = $${fields.length + 1}`)
        values.push(input.body)
      }

      if (Array.isArray(input.attachments)) {
        fields.push(`attachments = $${fields.length + 1}::jsonb`)
        values.push(JSON.stringify(input.attachments))
      }

      if (fields.length === 0) {
        return null
      }

      values.push(id)

      const result = await getDb().query<BacklogCommentRecord>(
        `update backlog_comments
        set ${fields.join(", ")}
        where id = $${values.length}
        returning
          id,
          backlog_item_id,
          author,
          body,
          attachments,
          created_at`,
        values
      )

      return result.rows[0] ? mapRecord(result.rows[0]) : null
    },
    async () => {
      const records = await readFileRecords()
      const index = records.findIndex((record) => record.id === id)

      if (index === -1) {
        return null
      }

      const current = mapRecord(records[index])
      const next: BacklogCommentRow = {
        ...current,
        body: typeof input.body === "string" ? input.body : current.body,
        attachments: Array.isArray(input.attachments)
          ? input.attachments
          : current.attachments,
      }

      records[index] = toRecord(next)
      await writeFileRecords(records)

      return next
    }
  )
}

export async function deleteBacklogComment(id: string) {
  return withCommentStore(
    async () => {
      const result = await getDb().query<{ id: string }>(
        `delete from backlog_comments
        where id = $1
        returning id`,
        [id]
      )

      return (result.rowCount ?? 0) > 0
    },
    async () => {
      const records = await readFileRecords()
      const nextRecords = records.filter((record) => record.id !== id)

      if (nextRecords.length === records.length) {
        return false
      }

      await writeFileRecords(nextRecords)
      return true
    }
  )
}
