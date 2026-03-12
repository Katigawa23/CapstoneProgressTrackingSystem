import { randomUUID } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

import { getDb } from "@/lib/db"

export type BacklogRow = {
  id: string
  projectId: string
  title: string
  description: string
  dueDate: string | null
  status: string
  checked: boolean
  assigneeId: string | null
  file: {
    name: string
    size: string
    type: string
  } | null
  createdAt: string
}

type CreateBacklogItemInput = {
  projectId: string
  title: string
  description: string
  dueDate: string | null
  status: string
  checked: boolean
  assigneeId: string | null
  file: {
    name: string
    size: string
    type: string
  } | null
}

type UpdateBacklogItemInput = {
  title?: string
  description?: string
  status?: string
  checked?: boolean
  assigneeId?: string | null
}

type BacklogRecord = {
  id: string
  project_id: string
  title: string
  description: string
  due_date: string | null
  status: string
  checked: boolean
  assignee_id: string | null
  file_name: string | null
  file_size: string | null
  file_type: string | null
  created_at: string
}

type BacklogStorageMode = "database" | "file"

const backlogFilePath = path.join(process.cwd(), ".data", "backlog-items.json")

let schemaReady: Promise<void> | null = null
let storageModePromise: Promise<BacklogStorageMode> | null = null
let fallbackWarningShown = false

function mapRecord(record: BacklogRecord): BacklogRow {
  return {
    id: record.id,
    projectId: record.project_id,
    title: record.title,
    description: record.description,
    dueDate: record.due_date,
    status: record.status,
    checked: record.checked,
    assigneeId: record.assignee_id,
    file:
      record.file_name && record.file_size && record.file_type
        ? {
            name: record.file_name,
            size: record.file_size,
            type: record.file_type,
          }
        : null,
    createdAt: record.created_at,
  }
}

function toRecord(input: BacklogRow): BacklogRecord {
  return {
    id: input.id,
    project_id: input.projectId,
    title: input.title,
    description: input.description,
    due_date: input.dueDate,
    status: input.status,
    checked: input.checked,
    assignee_id: input.assigneeId,
    file_name: input.file?.name ?? null,
    file_size: input.file?.size ?? null,
    file_type: input.file?.type ?? null,
    created_at: input.createdAt,
  }
}

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
    `Backlog storage is falling back to local file data because PostgreSQL is unavailable: ${message}`
  )
}

async function ensureBacklogSchema() {
  if (!schemaReady) {
    schemaReady = getDb()
      .query(`
        create table if not exists backlog_items (
          id uuid primary key,
          project_id uuid references projects(id) on delete cascade,
          title text not null,
          description text not null default '',
          due_date date,
          status text not null check (
            status in ('todo', 'inprogress', 'inreview', 'revision', 'completed')
          ),
          checked boolean not null default false,
          assignee_id text,
          file_name text,
          file_size text,
          file_type text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
      `)
      .then(() =>
        getDb().query(`
          alter table backlog_items
          add column if not exists assignee_id text;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog_items
          add column if not exists project_id uuid references projects(id) on delete cascade;
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

async function getStorageMode(): Promise<BacklogStorageMode> {
  if (!storageModePromise) {
    storageModePromise = (async () => {
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
        await ensureBacklogSchema()
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

async function withBacklogStore<T>(
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
    const raw = await readFile(backlogFilePath, "utf8")
    return JSON.parse(raw) as BacklogRecord[]
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

async function writeFileRecords(records: BacklogRecord[]) {
  await mkdir(path.dirname(backlogFilePath), { recursive: true })
  await writeFile(backlogFilePath, JSON.stringify(records, null, 2), "utf8")
}

export async function listBacklogItems(projectId: string) {
  return withBacklogStore(
    async () => {
      const result = await getDb().query<BacklogRecord>(
        `select
          id,
          project_id,
          title,
          description,
          due_date,
          status,
          checked,
          assignee_id,
          file_name,
          file_size,
          file_type,
          created_at
        from backlog_items
        where project_id = $1
        order by created_at desc`,
        [projectId]
      )

      return result.rows.map(mapRecord)
    },
    async () => {
      const records = await readFileRecords()
      return records.filter((record) => record.project_id === projectId).map(mapRecord)
    }
  )
}

export async function createBacklogItem(input: CreateBacklogItemInput) {
  return withBacklogStore(
    async () => {
      const result = await getDb().query<BacklogRecord>(
        `insert into backlog_items (
          id,
          project_id,
          title,
          description,
          due_date,
          status,
          checked,
          assignee_id,
          file_name,
          file_size,
          file_type
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        returning
          id,
          project_id,
          title,
          description,
          due_date,
          status,
          checked,
          assignee_id,
          file_name,
          file_size,
          file_type,
          created_at`,
        [
          randomUUID(),
          input.projectId,
          input.title,
          input.description,
          input.dueDate,
          input.status,
          input.checked,
          input.assigneeId,
          input.file?.name ?? null,
          input.file?.size ?? null,
          input.file?.type ?? null,
        ]
      )

      return mapRecord(result.rows[0])
    },
    async () => {
      const item: BacklogRow = {
        id: randomUUID(),
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate,
        status: input.status,
        checked: input.checked,
        assigneeId: input.assigneeId,
        file: input.file,
        createdAt: new Date().toISOString(),
      }

      const records = await readFileRecords()
      records.unshift(toRecord(item))
      await writeFileRecords(records)

      return item
    }
  )
}

export async function updateBacklogItem(id: string, input: UpdateBacklogItemInput) {
  return withBacklogStore(
    async () => {
      const fields: string[] = []
      const values: Array<string | boolean | null> = []

      if (typeof input.title === "string") {
        fields.push(`title = $${fields.length + 1}`)
        values.push(input.title)
      }

      if (typeof input.description === "string") {
        fields.push(`description = $${fields.length + 1}`)
        values.push(input.description)
      }

      if (typeof input.status === "string") {
        fields.push(`status = $${fields.length + 1}`)
        values.push(input.status)
      }

      if (typeof input.checked === "boolean") {
        fields.push(`checked = $${fields.length + 1}`)
        values.push(input.checked)
      }

      if ("assigneeId" in input) {
        fields.push(`assignee_id = $${fields.length + 1}`)
        values.push(input.assigneeId ?? null)
      }

      if (fields.length === 0) {
        return null
      }

      fields.push(`updated_at = now()`)
      values.push(id)

      const result = await getDb().query<BacklogRecord>(
        `update backlog_items
        set ${fields.join(", ")}
        where id = $${values.length}
        returning
          id,
          project_id,
          title,
          description,
          due_date,
          status,
          checked,
          assignee_id,
          file_name,
          file_size,
          file_type,
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

      if (Object.keys(input).length === 0) {
        return mapRecord(records[index])
      }

      const current = mapRecord(records[index])
      const next: BacklogRow = {
        ...current,
        title: typeof input.title === "string" ? input.title : current.title,
        description:
          typeof input.description === "string"
            ? input.description
            : current.description,
        status: typeof input.status === "string" ? input.status : current.status,
        checked:
          typeof input.checked === "boolean" ? input.checked : current.checked,
        assigneeId:
          "assigneeId" in input ? input.assigneeId ?? null : current.assigneeId,
      }

      records[index] = toRecord(next)
      await writeFileRecords(records)

      return next
    }
  )
}

export async function deleteBacklogItem(id: string) {
  return withBacklogStore(
    async () => {
      const result = await getDb().query<{ id: string }>(
        `delete from backlog_items
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
