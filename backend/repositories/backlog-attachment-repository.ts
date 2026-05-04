import { randomUUID } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

import { getPreferredStorageMode } from "@backend/config/storage-mode"
import { getDb } from "@backend/db/connection"
import {
  canUseLocalFileFallback,
  shouldFallbackToLocalStore,
} from "@backend/db/fallback"

export type BacklogSubmissionRow = {
  id: string
  backlogItemId: string
  fileName: string
  fileUrl: string
  fileType: string
  fileSize: number
  uploadedAt: string
}

export type BacklogWebLinkRow = {
  id: string
  backlogItemId: string
  url: string
  label: string
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
  attachment_type: "file" | "link"
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  link_label: string
  uploaded_at: string
}

type CreateBacklogWebLinkInput = {
  backlogItemId: string
  url: string
  label: string
}

type SubmissionStorageMode = "database" | "file"

const submissionsFilePath = path.join(
  process.cwd(),
  ".data",
  "backlog-attachments.json"
)

const legacySubmissionsFilePath = path.join(
  process.cwd(),
  ".data",
  "backlog-submissions.json"
)

let schemaReady: Promise<void> | null = null
let storageModePromise: Promise<SubmissionStorageMode> | null = null
let fallbackWarningShown = false

function shouldUseFileFallback(error: unknown) {
  return shouldFallbackToLocalStore(error)
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

function mapWebLinkRecord(record: BacklogSubmissionRecord): BacklogWebLinkRow {
  return {
    id: record.id,
    backlogItemId: record.backlog_item_id,
    url: record.file_url,
    label: record.link_label,
    uploadedAt: record.uploaded_at,
  }
}

function toRecord(row: BacklogSubmissionRow): BacklogSubmissionRecord {
  return {
    id: row.id,
    backlog_item_id: row.backlogItemId,
    attachment_type: "file",
    file_name: row.fileName,
    file_url: row.fileUrl,
    file_type: row.fileType,
    file_size: row.fileSize,
    link_label: "",
    uploaded_at: row.uploadedAt,
  }
}

function toWebLinkRecord(row: BacklogWebLinkRow): BacklogSubmissionRecord {
  return {
    id: row.id,
    backlog_item_id: row.backlogItemId,
    attachment_type: "link",
    file_name: row.label || row.url,
    file_url: row.url,
    file_type: "text/uri-list",
    file_size: 0,
    link_label: row.label,
    uploaded_at: row.uploadedAt,
  }
}

async function ensureSubmissionSchema() {
  if (!schemaReady) {
    schemaReady = getDb()
      .query(`
        create table if not exists backlog_attachment (
          id uuid primary key,
          backlog_item_id uuid not null references backlog_items(id) on delete cascade,
          attachment_type text not null default 'file' check (
            attachment_type in ('file', 'link')
          ),
          file_name text not null,
          file_url text not null,
          file_type text not null default 'application/octet-stream',
          file_size integer not null default 0,
          link_label text not null default '',
          uploaded_at timestamptz not null default now()
        );
      `)
      .then(() =>
        getDb().query(`
          alter table backlog_attachment
          add column if not exists attachment_type text not null default 'file';
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog_attachment
          add column if not exists link_label text not null default '';
        `)
      )
      .then(() =>
        getDb().query(`
          do $$
          begin
            if exists (
              select 1
              from information_schema.tables
              where table_schema = 'public'
                and table_name = 'backlog_submissions'
            ) then
              insert into backlog_attachment (
                id,
                backlog_item_id,
                attachment_type,
                file_name,
                file_url,
                file_type,
                file_size,
                link_label,
                uploaded_at
              )
              select
                backlog_submissions.id,
                backlog_submissions.backlog_item_id,
                'file',
                backlog_submissions.file_name,
                backlog_submissions.file_url,
                backlog_submissions.file_type,
                backlog_submissions.file_size,
                '',
                backlog_submissions.uploaded_at
              from backlog_submissions
              on conflict (id) do nothing;
            end if;
          end $$;
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists backlog_attachment_backlog_item_id_idx
          on backlog_attachment(backlog_item_id, uploaded_at desc);
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists backlog_attachment_type_idx
          on backlog_attachment(backlog_item_id, attachment_type, uploaded_at desc);
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
        if (!canUseLocalFileFallback()) {
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
      try {
        const raw = await readFile(legacySubmissionsFilePath, "utf8")
        const legacyRecords = JSON.parse(raw) as Array<
          Omit<BacklogSubmissionRecord, "attachment_type" | "link_label">
        >

        return legacyRecords.map((record) => ({
          ...record,
          attachment_type: "file",
          link_label: "",
        }))
      } catch (legacyError) {
        const legacyCode =
          typeof legacyError === "object" && legacyError && "code" in legacyError
            ? String(legacyError.code)
            : null

        if (legacyCode === "ENOENT") {
          return []
        }

        throw legacyError
      }
    }

    throw error
  }
}

async function writeFileRecords(records: BacklogSubmissionRecord[]) {
  await mkdir(path.dirname(submissionsFilePath), { recursive: true })
  await writeFile(submissionsFilePath, JSON.stringify(records, null, 2), "utf8")
}

export async function listBacklogSubmissions(
  backlogItemId: string,
  ownerUserId: string
) {
  return withSubmissionStore(
    async () => {
      const result = await getDb().query<BacklogSubmissionRecord>(
        `select
          backlog_attachment.id,
          backlog_attachment.backlog_item_id,
          backlog_attachment.attachment_type,
          backlog_attachment.file_name,
          backlog_attachment.file_url,
          backlog_attachment.file_type,
          backlog_attachment.file_size,
          backlog_attachment.link_label,
          backlog_attachment.uploaded_at
        from backlog_attachment
        inner join backlog_items
          on backlog_items.id = backlog_attachment.backlog_item_id
        inner join projects
          on projects.id = backlog_items.project_id
        where backlog_attachment.backlog_item_id = $1
          and backlog_attachment.attachment_type = 'file'
          and (
            projects.owner_user_id = $2
            or $2 = any(projects.member_user_ids)
          )
        order by backlog_attachment.uploaded_at desc`,
        [backlogItemId, ownerUserId]
      )

      return result.rows.map(mapRecord)
    },
    async () => {
      const records = await readFileRecords()
      return records
        .filter(
          (record) =>
            record.backlog_item_id === backlogItemId &&
            record.attachment_type === "file"
        )
        .sort((left, right) => right.uploaded_at.localeCompare(left.uploaded_at))
        .map(mapRecord)
    }
  )
}

export async function createBacklogSubmission(
  input: CreateBacklogSubmissionInput,
  ownerUserId: string
) {
  return withSubmissionStore(
    async () => {
      const result = await getDb().query<BacklogSubmissionRecord>(
        `insert into backlog_attachment (
          id,
          backlog_item_id,
          attachment_type,
          file_name,
          file_url,
          file_type,
          file_size,
          link_label
        )
        select
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8
        from backlog_items
        inner join projects
          on projects.id = backlog_items.project_id
        where backlog_items.id = $2
          and (
            projects.owner_user_id = $9
            or $9 = any(projects.member_user_ids)
          )
        returning
          id,
          backlog_item_id,
          attachment_type,
          file_name,
          file_url,
          file_type,
          file_size,
          link_label,
          uploaded_at`,
        [
          randomUUID(),
          input.backlogItemId,
          "file",
          input.fileName,
          input.fileUrl,
          input.fileType,
          input.fileSize,
          "",
          ownerUserId,
        ]
      )

      return result.rows[0] ? mapRecord(result.rows[0]) : null
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
  submissionId: string,
  ownerUserId: string
) {
  return withSubmissionStore(
    async () => {
      const result = await getDb().query<BacklogSubmissionRecord>(
        `delete from backlog_attachment
        where id = $1 and backlog_item_id = $2
          and attachment_type = 'file'
          and backlog_item_id in (
            select backlog_items.id
            from backlog_items
            inner join projects
              on projects.id = backlog_items.project_id
            where projects.owner_user_id = $3
              or $3 = any(projects.member_user_ids)
          )
        returning
          id,
          backlog_item_id,
          attachment_type,
          file_name,
          file_url,
          file_type,
          file_size,
          link_label,
          uploaded_at`,
        [submissionId, backlogItemId, ownerUserId]
      )

      return result.rows[0] ? mapRecord(result.rows[0]) : null
    },
    async () => {
      const records = await readFileRecords()
      const recordIndex = records.findIndex(
        (record) =>
          record.id === submissionId &&
          record.backlog_item_id === backlogItemId &&
          record.attachment_type === "file"
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

export async function listBacklogWebLinks(
  backlogItemId: string,
  ownerUserId: string
) {
  return withSubmissionStore(
    async () => {
      const result = await getDb().query<BacklogSubmissionRecord>(
        `select
          backlog_attachment.id,
          backlog_attachment.backlog_item_id,
          backlog_attachment.attachment_type,
          backlog_attachment.file_name,
          backlog_attachment.file_url,
          backlog_attachment.file_type,
          backlog_attachment.file_size,
          backlog_attachment.link_label,
          backlog_attachment.uploaded_at
        from backlog_attachment
        inner join backlog_items
          on backlog_items.id = backlog_attachment.backlog_item_id
        inner join projects
          on projects.id = backlog_items.project_id
        where backlog_attachment.backlog_item_id = $1
          and backlog_attachment.attachment_type = 'link'
          and (
            projects.owner_user_id = $2
            or $2 = any(projects.member_user_ids)
          )
        order by backlog_attachment.uploaded_at desc`,
        [backlogItemId, ownerUserId]
      )

      return result.rows.map(mapWebLinkRecord)
    },
    async () => {
      const records = await readFileRecords()
      return records
        .filter(
          (record) =>
            record.backlog_item_id === backlogItemId &&
            record.attachment_type === "link"
        )
        .sort((left, right) => right.uploaded_at.localeCompare(left.uploaded_at))
        .map(mapWebLinkRecord)
    }
  )
}

export async function createBacklogWebLink(
  input: CreateBacklogWebLinkInput,
  ownerUserId: string
) {
  return withSubmissionStore(
    async () => {
      const result = await getDb().query<BacklogSubmissionRecord>(
        `insert into backlog_attachment (
          id,
          backlog_item_id,
          attachment_type,
          file_name,
          file_url,
          file_type,
          file_size,
          link_label
        )
        select
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8
        from backlog_items
        inner join projects
          on projects.id = backlog_items.project_id
        where backlog_items.id = $2
          and (
            projects.owner_user_id = $9
            or $9 = any(projects.member_user_ids)
          )
        returning
          id,
          backlog_item_id,
          attachment_type,
          file_name,
          file_url,
          file_type,
          file_size,
          link_label,
          uploaded_at`,
        [
          randomUUID(),
          input.backlogItemId,
          "link",
          input.label || input.url,
          input.url,
          "text/uri-list",
          0,
          input.label,
          ownerUserId,
        ]
      )

      return result.rows[0] ? mapWebLinkRecord(result.rows[0]) : null
    },
    async () => {
      const link: BacklogWebLinkRow = {
        id: randomUUID(),
        backlogItemId: input.backlogItemId,
        url: input.url,
        label: input.label,
        uploadedAt: new Date().toISOString(),
      }

      const records = await readFileRecords()
      records.unshift(toWebLinkRecord(link))
      await writeFileRecords(records)

      return link
    }
  )
}

export async function deleteBacklogWebLink(
  backlogItemId: string,
  linkId: string,
  ownerUserId: string
) {
  return withSubmissionStore(
    async () => {
      const result = await getDb().query<BacklogSubmissionRecord>(
        `delete from backlog_attachment
        where id = $1 and backlog_item_id = $2
          and attachment_type = 'link'
          and backlog_item_id in (
            select backlog_items.id
            from backlog_items
            inner join projects
              on projects.id = backlog_items.project_id
            where projects.owner_user_id = $3
              or $3 = any(projects.member_user_ids)
          )
        returning
          id,
          backlog_item_id,
          attachment_type,
          file_name,
          file_url,
          file_type,
          file_size,
          link_label,
          uploaded_at`,
        [linkId, backlogItemId, ownerUserId]
      )

      return result.rows[0] ? mapWebLinkRecord(result.rows[0]) : null
    },
    async () => {
      const records = await readFileRecords()
      const recordIndex = records.findIndex(
        (record) =>
          record.id === linkId &&
          record.backlog_item_id === backlogItemId &&
          record.attachment_type === "link"
      )

      if (recordIndex < 0) {
        return null
      }

      const [removedRecord] = records.splice(recordIndex, 1)
      await writeFileRecords(records)

      return mapWebLinkRecord(removedRecord)
    }
  )
}
