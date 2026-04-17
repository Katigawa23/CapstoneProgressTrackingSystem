import { randomUUID } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

import { getPreferredStorageMode } from "@/backend/config/storage-mode"
import { getDb } from "@/backend/db/connection"

export type BacklogSubmissionRow = {
  id: string
  backlogItemId: string
  fileName: string
  fileUrl: string
  fileType: string
  fileSize: number
  uploadedAt: string
}

type CreateBacklogSubmissionInput = {
  backlogItemId: string
  fileName: string
  fileUrl: string
  fileType: string
  fileSize: number
}

type BacklogSubmissionRecord = {
  id: string
  backlog_item_id: string
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  uploaded_at: string
}

type SubmissionStorageMode = "database" | "file"

const submissionsFilePath = path.join(
  process.cwd(),
  ".data",
  "backlog-submissions.json"
)

let schemaReady: Promise<void> | null = null
let storageModePromise: Promise<SubmissionStorageMode> | null = null
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

  console.warn(`Submission storage is using local file data: ${message}`)
}

function mapRecord(record: BacklogSubmissionRecord): BacklogSubmissionRow {
  return {
    id: record.id,
    backlogItemId: record.backlog_item_id,
    fileName: record.file_name,
    fileUrl: record.file_url,
    fileType: record.file_type,
    fileSize: record.file_size,
    uploadedAt: record.uploaded_at,
  }
}

function toRecord(row: BacklogSubmissionRow): BacklogSubmissionRecord {
  return {
    id: row.id,
    backlog_item_id: row.backlogItemId,
    file_name: row.fileName,
    file_url: row.fileUrl,
    file_type: row.fileType,
    file_size: row.fileSize,
    uploaded_at: row.uploadedAt,
  }
}

async function ensureSubmissionSchema() {
  if (!schemaReady) {
    schemaReady = getDb()
      .query(`
        create table if not exists backlog_submissions (
          id uuid primary key,
          backlog_item_id uuid not null references backlog_items(id) on delete cascade,
          file_name text not null,
          file_url text not null,
          file_type text not null default 'application/octet-stream',
          file_size integer not null default 0,
          uploaded_at timestamptz not null default now()
        );
      `)
      .then(() =>
        getDb().query(`
          create index if not exists backlog_submissions_backlog_item_id_idx
          on backlog_submissions(backlog_item_id, uploaded_at desc);
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

async function getStorageMode(): Promise<SubmissionStorageMode> {
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
        await ensureSubmissionSchema()
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

async function withSubmissionStore<T>(
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
    const raw = await readFile(submissionsFilePath, "utf8")
    return JSON.parse(raw) as BacklogSubmissionRecord[]
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

async function writeFileRecords(records: BacklogSubmissionRecord[]) {
  await mkdir(path.dirname(submissionsFilePath), { recursive: true })
  await writeFile(submissionsFilePath, JSON.stringify(records, null, 2), "utf8")
}

export async function listBacklogSubmissions(backlogItemId: string) {
  return withSubmissionStore(
    async () => {
      const result = await getDb().query<BacklogSubmissionRecord>(
        `select
          id,
          backlog_item_id,
          file_name,
          file_url,
          file_type,
          file_size,
          uploaded_at
        from backlog_submissions
        where backlog_item_id = $1
        order by uploaded_at desc`,
        [backlogItemId]
      )

      return result.rows.map(mapRecord)
    },
    async () => {
      const records = await readFileRecords()
      return records
        .filter((record) => record.backlog_item_id === backlogItemId)
        .sort((left, right) => right.uploaded_at.localeCompare(left.uploaded_at))
        .map(mapRecord)
    }
  )
}

export async function createBacklogSubmission(
  input: CreateBacklogSubmissionInput
) {
  return withSubmissionStore(
    async () => {
      const result = await getDb().query<BacklogSubmissionRecord>(
        `insert into backlog_submissions (
          id,
          backlog_item_id,
          file_name,
          file_url,
          file_type,
          file_size
        ) values ($1, $2, $3, $4, $5, $6)
        returning
          id,
          backlog_item_id,
          file_name,
          file_url,
          file_type,
          file_size,
          uploaded_at`,
        [
          randomUUID(),
          input.backlogItemId,
          input.fileName,
          input.fileUrl,
          input.fileType,
          input.fileSize,
        ]
      )

      return mapRecord(result.rows[0])
    },
    async () => {
      const submission: BacklogSubmissionRow = {
        id: randomUUID(),
        backlogItemId: input.backlogItemId,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        fileType: input.fileType,
        fileSize: input.fileSize,
        uploadedAt: new Date().toISOString(),
      }

      const records = await readFileRecords()
      records.unshift(toRecord(submission))
      await writeFileRecords(records)

      return submission
    }
  )
}

export async function deleteBacklogSubmission(
  backlogItemId: string,
  submissionId: string
) {
  return withSubmissionStore(
    async () => {
      const result = await getDb().query<BacklogSubmissionRecord>(
        `delete from backlog_submissions
        where id = $1 and backlog_item_id = $2
        returning
          id,
          backlog_item_id,
          file_name,
          file_url,
          file_type,
          file_size,
          uploaded_at`,
        [submissionId, backlogItemId]
      )

      return result.rows[0] ? mapRecord(result.rows[0]) : null
    },
    async () => {
      const records = await readFileRecords()
      const recordIndex = records.findIndex(
        (record) =>
          record.id === submissionId && record.backlog_item_id === backlogItemId
      )

      if (recordIndex < 0) {
        return null
      }

      const [removedRecord] = records.splice(recordIndex, 1)
      await writeFileRecords(records)

      return mapRecord(removedRecord)
    }
  )
}
