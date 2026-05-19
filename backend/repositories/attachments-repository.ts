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
  uploadedByUserId: string | null
  archivedByUserId: string | null
  deletedByUserId: string | null
  fileName: string
  fileUrl: string
  fileType: string
  fileSize: number
  archived: boolean
  archivedAt: string | null
  deleted: boolean
  deletedAt: string | null
  uploadedAt: string
}

export type BacklogWebLinkRow = {
  id: string
  backlogItemId: string
  uploadedByUserId: string | null
  archivedByUserId: string | null
  deletedByUserId: string | null
  url: string
  label: string
  archived: boolean
  archivedAt: string | null
  deleted: boolean
  deletedAt: string | null
  uploadedAt: string
}

export type ArchivedBacklogAttachmentRow = {
  id: string
  backlogItemId: string
  backlogItemParentId: string | null
  backlogItemSequenceNumber: number
  parentSequenceNumber: number | null
  attachmentType: "file" | "link"
  uploadedByUserId: string | null
  archivedByUserId: string | null
  fileName: string
  fileUrl: string
  fileType: string
  fileSize: number
  label: string
  uploadedAt: string
  archivedAt: string | null
}

export type DeletedBacklogAttachmentRow = ArchivedBacklogAttachmentRow & {
  deletedByUserId: string | null
  deletedAt: string | null
}

type CreateBacklogSubmissionInput = {
  id?: string
  backlogItemId: string
  fileName: string
  fileUrl: string
  fileType: string
  fileSize: number
  fileData: Buffer
}

type BacklogSubmissionRecord = {
  id: string
  backlog_item_id: string
  uploaded_by_user_id: string | null
  archived_by_user_id: string | null
  deleted_by_user_id: string | null
  attachment_type: "file" | "link"
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  link_label: string
  file_data?: Buffer | string | null
  is_archived: boolean
  archived_at: string | null
  is_deleted: boolean
  deleted_at: string | null
  uploaded_at: string
}

export type BacklogSubmissionAsset = {
  id: string
  backlogItemId: string
  fileName: string
  fileType: string
  fileSize: number
  fileUrl: string
  uploadedAt: string
  fileData: Buffer | null
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
    uploadedByUserId: record.uploaded_by_user_id,
    archivedByUserId: record.archived_by_user_id ?? null,
    deletedByUserId: record.deleted_by_user_id ?? null,
    fileName: record.file_name,
    fileUrl: record.file_url,
    fileType: record.file_type,
    fileSize: record.file_size,
    archived: record.is_archived ?? false,
    archivedAt: record.archived_at ?? null,
    deleted: record.is_deleted ?? false,
    deletedAt: record.deleted_at ?? null,
    uploadedAt: record.uploaded_at,
  }
}

function mapWebLinkRecord(record: BacklogSubmissionRecord): BacklogWebLinkRow {
  return {
    id: record.id,
    backlogItemId: record.backlog_item_id,
    uploadedByUserId: record.uploaded_by_user_id,
    archivedByUserId: record.archived_by_user_id ?? null,
    deletedByUserId: record.deleted_by_user_id ?? null,
    url: record.file_url,
    label: record.link_label,
    archived: record.is_archived ?? false,
    archivedAt: record.archived_at ?? null,
    deleted: record.is_deleted ?? false,
    deletedAt: record.deleted_at ?? null,
    uploadedAt: record.uploaded_at,
  }
}

function toBuffer(value: Buffer | string | null | undefined) {
  if (Buffer.isBuffer(value)) {
    return value
  }

  if (typeof value === "string" && value.length > 0) {
    return Buffer.from(value, "base64")
  }

  return null
}

function toRecord(row: BacklogSubmissionRow): BacklogSubmissionRecord {
  return {
    id: row.id,
    backlog_item_id: row.backlogItemId,
    uploaded_by_user_id: row.uploadedByUserId ?? null,
    archived_by_user_id: row.archivedByUserId ?? null,
    deleted_by_user_id: row.deletedByUserId ?? null,
    attachment_type: "file",
    file_name: row.fileName,
    file_url: row.fileUrl,
    file_type: row.fileType,
    file_size: row.fileSize,
    link_label: "",
    is_archived: row.archived,
    archived_at: row.archivedAt,
    is_deleted: row.deleted ?? false,
    deleted_at: row.deletedAt ?? null,
    uploaded_at: row.uploadedAt,
  }
}

function toWebLinkRecord(row: BacklogWebLinkRow): BacklogSubmissionRecord {
  return {
    id: row.id,
    backlog_item_id: row.backlogItemId,
    uploaded_by_user_id: row.uploadedByUserId ?? null,
    archived_by_user_id: row.archivedByUserId ?? null,
    deleted_by_user_id: row.deletedByUserId ?? null,
    attachment_type: "link",
    file_name: row.label || row.url,
    file_url: row.url,
    file_type: "text/uri-list",
    file_size: 0,
    link_label: row.label,
    is_archived: row.archived,
    archived_at: row.archivedAt,
    is_deleted: row.deleted ?? false,
    deleted_at: row.deletedAt ?? null,
    uploaded_at: row.uploadedAt,
  }
}

async function ensureSubmissionSchema() {
  if (!schemaReady) {
    schemaReady = getDb()
      .query(`
        create table if not exists attachments (
          id uuid primary key,
          backlog_item_id uuid not null references backlog(id) on delete cascade,
          uploaded_by_user_id text,
          archived_by_user_id text,
          deleted_by_user_id text,
          attachment_type text not null default 'file' check (
            attachment_type in ('file', 'link')
          ),
          file_name text not null,
          file_url text not null,
          file_type text not null default 'application/octet-stream',
          file_size integer not null default 0,
          file_data bytea,
          link_label text not null default '',
          is_archived boolean not null default false,
          archived_at timestamptz,
          is_deleted boolean not null default false,
          deleted_at timestamptz,
          uploaded_at timestamptz not null default now()
        );

        create table if not exists weblinks (
          id uuid primary key,
          backlog_item_id uuid not null references backlog(id) on delete cascade,
          uploaded_by_user_id text,
          archived_by_user_id text,
          deleted_by_user_id text,
          url text not null,
          label text not null default '',
          is_archived boolean not null default false,
          archived_at timestamptz,
          is_deleted boolean not null default false,
          deleted_at timestamptz,
          uploaded_at timestamptz not null default now()
        );

        alter table attachments
          add column if not exists backlog_item_id uuid;

        alter table attachments
          add column if not exists uploaded_by_user_id text;

        alter table attachments
          add column if not exists archived_by_user_id text;

        alter table attachments
          add column if not exists deleted_by_user_id text;

        alter table attachments
          add column if not exists attachment_type text not null default 'file';

        alter table attachments
          add column if not exists file_name text not null default '';

        alter table attachments
          add column if not exists file_url text not null default '';

        alter table attachments
          add column if not exists file_type text not null default 'application/octet-stream';

        alter table attachments
          add column if not exists file_size integer not null default 0;

        alter table attachments
          add column if not exists file_data bytea;

        alter table attachments
          add column if not exists link_label text not null default '';

        alter table attachments
          add column if not exists is_archived boolean not null default false;

        alter table attachments
          add column if not exists archived_at timestamptz;

        alter table attachments
          add column if not exists is_deleted boolean not null default false;

        alter table attachments
          add column if not exists deleted_at timestamptz;

        alter table attachments
          add column if not exists uploaded_at timestamptz not null default now();

        alter table attachments
          drop constraint if exists attachments_check;

        alter table weblinks
          add column if not exists backlog_item_id uuid;

        alter table weblinks
          add column if not exists uploaded_by_user_id text;

        alter table weblinks
          add column if not exists archived_by_user_id text;

        alter table weblinks
          add column if not exists deleted_by_user_id text;

        alter table weblinks
          add column if not exists url text not null default '';

        alter table weblinks
          add column if not exists label text not null default '';

        alter table weblinks
          add column if not exists is_archived boolean not null default false;

        alter table weblinks
          add column if not exists archived_at timestamptz;

        alter table weblinks
          add column if not exists is_deleted boolean not null default false;

        alter table weblinks
          add column if not exists deleted_at timestamptz;

        alter table weblinks
          add column if not exists uploaded_at timestamptz not null default now();

        alter table weblinks
          drop constraint if exists weblinks_check;

        create index if not exists attachments_backlog_item_id_idx
          on attachments(backlog_item_id, uploaded_at desc);

        create index if not exists attachments_uploaded_by_user_id_idx
          on attachments(uploaded_by_user_id);

        create index if not exists attachments_type_idx
          on attachments(backlog_item_id, attachment_type, uploaded_at desc);

        create index if not exists weblinks_backlog_item_id_idx
          on weblinks(backlog_item_id, uploaded_at desc);

        create index if not exists weblinks_uploaded_by_user_id_idx
          on weblinks(uploaded_by_user_id);
        `)
      .then(() =>
        getDb().query(`
          do $$
          begin
            if exists (
              select 1
              from information_schema.tables
              where table_schema = 'public'
                and table_name = 'backlog_submissions'
            ) and exists (
              select 1
              from information_schema.columns
              where table_schema = 'public'
                and table_name = 'backlog_submissions'
                and column_name = 'backlog_item_id'
            ) then
              insert into attachments (
                id,
                backlog_item_id,
                uploaded_by_user_id,
                attachment_type,
                file_name,
                file_url,
                file_type,
                file_size,
                link_label,
                is_archived,
                archived_at,
                uploaded_at
              )
              select
                backlog_submissions.id,
                backlog_submissions.backlog_item_id,
                null,
                'file',
                backlog_submissions.file_name,
                backlog_submissions.file_url,
                backlog_submissions.file_type,
                backlog_submissions.file_size,
                '',
                false,
                null,
                backlog_submissions.uploaded_at
              from backlog_submissions
              on conflict (id) do nothing;
            end if;

            if exists (
              select 1
              from information_schema.tables
              where table_schema = 'public'
                and table_name = 'attachments'
            ) and exists (
              select 1
              from information_schema.columns
              where table_schema = 'public'
                and table_name = 'attachments'
                and column_name = 'attachment_type'
            ) then
              insert into weblinks (
                id,
                backlog_item_id,
                uploaded_by_user_id,
                archived_by_user_id,
                deleted_by_user_id,
                url,
                label,
                is_archived,
                archived_at,
                is_deleted,
                deleted_at,
                uploaded_at
              )
              select
                attachments.id,
                attachments.backlog_item_id,
                attachments.uploaded_by_user_id,
                attachments.archived_by_user_id,
                attachments.deleted_by_user_id,
                attachments.file_url,
                attachments.link_label,
                attachments.is_archived,
                attachments.archived_at,
                attachments.is_deleted,
                attachments.deleted_at,
                attachments.uploaded_at
              from attachments
              where attachments.attachment_type = 'link'
              on conflict (id) do nothing;
            end if;
          end $$;
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

async function readFileRecords(): Promise<BacklogSubmissionRecord[]> {
  try {
    const raw = await readFile(submissionsFilePath, "utf8")
    return (JSON.parse(raw) as BacklogSubmissionRecord[]).map((record) => ({
      ...record,
      archived_by_user_id: record.archived_by_user_id ?? null,
      deleted_by_user_id: record.deleted_by_user_id ?? null,
      is_archived: record.is_archived ?? false,
      archived_at: record.archived_at ?? null,
      is_deleted: record.is_deleted ?? false,
      deleted_at: record.deleted_at ?? null,
    }))
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

        return legacyRecords.map(
          (record): BacklogSubmissionRecord => ({
            ...record,
            attachment_type: "file",
            link_label: "",
            file_data: null,
            deleted_by_user_id: null,
            is_deleted: false,
            deleted_at: null,
          })
        )
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

async function canManageOtherProjectAttachments(
  _backlogItemId: string,
  _userId: string,
  userRole: "student" | "faculty" | "admin"
) {
  return userRole === "faculty" || userRole === "admin"
}

export async function listBacklogSubmissions(
  backlogItemId: string,
  ownerUserId: string
) {
  return withSubmissionStore(
    async () => {
      const result = await getDb().query<BacklogSubmissionRecord>(
        `select
          attachments.id,
          attachments.backlog_item_id,
          attachments.uploaded_by_user_id,
          attachments.archived_by_user_id,
          attachments.deleted_by_user_id,
          attachments.attachment_type,
          attachments.file_name,
          attachments.file_url,
          attachments.file_type,
          attachments.file_size,
          attachments.link_label,
          attachments.is_archived,
          attachments.archived_at,
          attachments.is_deleted,
          attachments.deleted_at,
          attachments.uploaded_at
        from attachments
        inner join backlog
          on backlog.id = attachments.backlog_item_id
        inner join projects
          on projects.id = backlog.project_id
        where attachments.backlog_item_id = $1
          and attachments.attachment_type = 'file'
          and attachments.is_archived = false
          and attachments.is_deleted = false
          and (
            projects.owner_user_id = $2
            or $2 = any(projects.member_user_ids)
          )
        order by attachments.uploaded_at desc`,
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
            record.attachment_type === "file" &&
            record.is_archived === false &&
            record.is_deleted === false
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
      const submissionId = input.id ?? randomUUID()
      const result = await getDb().query<BacklogSubmissionRecord>(
        `insert into attachments (
          id,
          backlog_item_id,
          uploaded_by_user_id,
          attachment_type,
          file_name,
          file_url,
          file_type,
          file_size,
          file_data,
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
          $8,
          $9,
          $10
        from backlog
        inner join projects
          on projects.id = backlog.project_id
        where backlog.id = $2
          and (
            projects.owner_user_id = $11
            or $11 = any(projects.member_user_ids)
          )
        returning
          id,
          backlog_item_id,
          uploaded_by_user_id,
          archived_by_user_id,
          attachment_type,
          file_name,
          file_url,
          file_type,
          file_size,
          file_data,
          link_label,
          is_archived,
          archived_at,
          uploaded_at`,
          [
            submissionId,
            input.backlogItemId,
            ownerUserId,
            "file",
            input.fileName,
            input.fileUrl,
            input.fileType,
            input.fileSize,
            input.fileData,
            "",
            ownerUserId,
          ]
      )

      return result.rows[0] ? mapRecord(result.rows[0]) : null
    },
    async () => {
      const submission: BacklogSubmissionRow = {
        id: input.id ?? randomUUID(),
        backlogItemId: input.backlogItemId,
        uploadedByUserId: ownerUserId,
        archivedByUserId: null,
        deletedByUserId: null,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        fileType: input.fileType,
        fileSize: input.fileSize,
        archived: false,
        archivedAt: null,
        deleted: false,
        deletedAt: null,
        uploadedAt: new Date().toISOString(),
      }

      const records = await readFileRecords()
      records.unshift({
        ...toRecord(submission),
        file_data: input.fileData.toString("base64"),
      })
      await writeFileRecords(records)

      return submission
    }
  )
}

export async function deleteBacklogSubmission(
  backlogItemId: string,
  submissionId: string,
  ownerUserId: string,
  ownerUserRole: "student" | "faculty" | "admin"
) {
  return withSubmissionStore(
    async () => {
      const result = await getDb().query<BacklogSubmissionRecord>(
        `update attachments
        set is_deleted = true,
            deleted_at = now(),
            deleted_by_user_id = $3
        where attachments.id = $1
          and attachments.backlog_item_id = $2
          and attachments.attachment_type = 'file'
          and attachments.is_deleted = false
          and exists (
            select 1
            from backlog
            inner join projects
              on projects.id = backlog.project_id
            where backlog.id = attachments.backlog_item_id
              and (
                projects.owner_user_id = $3
                or $3 = any(projects.member_user_ids)
              )
              and (
                attachments.uploaded_by_user_id = $3
                or projects.owner_user_id = $3
                or $4 in ('faculty', 'admin')
                or $3 = any(projects.sprint_creator_user_ids)
              )
          )
        returning
          attachments.id,
          attachments.backlog_item_id,
          attachments.uploaded_by_user_id,
          attachments.archived_by_user_id,
          attachments.deleted_by_user_id,
          attachments.deleted_by_user_id,
          attachments.attachment_type,
          attachments.file_name,
          attachments.file_url,
          attachments.file_type,
          attachments.file_size,
          attachments.link_label,
          attachments.is_archived,
          attachments.archived_at,
          attachments.is_deleted,
          attachments.deleted_at,
          attachments.is_deleted,
          attachments.deleted_at,
          attachments.uploaded_at`,
        [submissionId, backlogItemId, ownerUserId, ownerUserRole]
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

      if (
        records[recordIndex].uploaded_by_user_id !== ownerUserId &&
        !(await canManageOtherProjectAttachments(
          backlogItemId,
          ownerUserId,
          ownerUserRole
        ))
      ) {
        return null
      }

      records[recordIndex] = {
        ...records[recordIndex],
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by_user_id: ownerUserId,
      }
      await writeFileRecords(records)

      return mapRecord(records[recordIndex])
    }
  )
}

export async function getBacklogSubmissionAsset(
  backlogItemId: string,
  submissionId: string,
  ownerUserId: string
) {
  return withSubmissionStore(
    async () => {
      const result = await getDb().query<BacklogSubmissionRecord>(
        `select
          attachments.id,
          attachments.backlog_item_id,
          attachments.uploaded_by_user_id,
          attachments.archived_by_user_id,
          attachments.attachment_type,
          attachments.file_name,
          attachments.file_url,
          attachments.file_type,
          attachments.file_size,
          attachments.file_data,
          attachments.link_label,
          attachments.is_archived,
          attachments.archived_at,
          attachments.uploaded_at
        from attachments
        inner join backlog
          on backlog.id = attachments.backlog_item_id
        inner join projects
          on projects.id = backlog.project_id
        where attachments.id = $1
          and attachments.backlog_item_id = $2
          and attachments.attachment_type = 'file'
          and attachments.is_archived = false
          and attachments.is_deleted = false
          and (
            projects.owner_user_id = $3
            or $3 = any(projects.member_user_ids)
          )
        limit 1`,
        [submissionId, backlogItemId, ownerUserId]
      )

      const record = result.rows[0]

      if (!record) {
        return null
      }

      return {
        id: record.id,
        backlogItemId: record.backlog_item_id,
        fileName: record.file_name,
        fileType: record.file_type,
        fileSize: record.file_size,
        fileUrl: record.file_url,
        uploadedAt: record.uploaded_at,
        fileData: toBuffer(record.file_data),
      } satisfies BacklogSubmissionAsset
    },
    async () => {
      const records = await readFileRecords()
      const record = records.find(
        (entry) =>
          entry.id === submissionId &&
          entry.backlog_item_id === backlogItemId &&
          entry.attachment_type === "file" &&
          entry.is_archived === false
      )

      if (!record) {
        return null
      }

      return {
        id: record.id,
        backlogItemId: record.backlog_item_id,
        fileName: record.file_name,
        fileType: record.file_type,
        fileSize: record.file_size,
        fileUrl: record.file_url,
        uploadedAt: record.uploaded_at,
        fileData: toBuffer(record.file_data),
      } satisfies BacklogSubmissionAsset
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
          weblinks.id,
          weblinks.backlog_item_id,
          weblinks.uploaded_by_user_id,
          weblinks.archived_by_user_id,
          weblinks.deleted_by_user_id,
          'link' as attachment_type,
          coalesce(nullif(weblinks.label, ''), weblinks.url) as file_name,
          weblinks.url as file_url,
          'text/uri-list' as file_type,
          0 as file_size,
          weblinks.label as link_label,
          weblinks.is_archived,
          weblinks.archived_at,
          weblinks.is_deleted,
          weblinks.deleted_at,
          weblinks.uploaded_at
        from weblinks
        inner join backlog
          on backlog.id = weblinks.backlog_item_id
        inner join projects
          on projects.id = backlog.project_id
        where weblinks.backlog_item_id = $1
          and weblinks.is_archived = false
          and weblinks.is_deleted = false
          and (
            projects.owner_user_id = $2
            or $2 = any(projects.member_user_ids)
          )
        order by weblinks.uploaded_at desc`,
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
            record.attachment_type === "link" &&
            record.is_archived === false &&
            record.is_deleted === false
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
        `insert into weblinks (
          id,
          backlog_item_id,
          uploaded_by_user_id,
          url,
          label
        )
        select
          $1,
          $2,
          $3,
          $4,
          $5
        from backlog
        inner join projects
          on projects.id = backlog.project_id
        where backlog.id = $2
          and (
            projects.owner_user_id = $6
            or $6 = any(projects.member_user_ids)
          )
        returning
          id,
          backlog_item_id,
          uploaded_by_user_id,
          archived_by_user_id,
          deleted_by_user_id,
          'link' as attachment_type,
          coalesce(nullif(label, ''), url) as file_name,
          url as file_url,
          'text/uri-list' as file_type,
          0 as file_size,
          label as link_label,
          is_archived,
          archived_at,
          is_deleted,
          deleted_at,
          uploaded_at`,
          [
            randomUUID(),
            input.backlogItemId,
            ownerUserId,
            input.url,
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
        uploadedByUserId: ownerUserId,
        archivedByUserId: null,
        deletedByUserId: null,
        url: input.url,
        label: input.label,
        archived: false,
        archivedAt: null,
        deleted: false,
        deletedAt: null,
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
  ownerUserId: string,
  ownerUserRole: "student" | "faculty" | "admin"
) {
  return withSubmissionStore(
    async () => {
      const result = await getDb().query<BacklogSubmissionRecord>(
        `update weblinks
        set is_deleted = true,
            deleted_at = now(),
            deleted_by_user_id = $3
        where weblinks.id = $1
          and weblinks.backlog_item_id = $2
          and weblinks.is_deleted = false
          and exists (
            select 1
            from backlog
            inner join projects
              on projects.id = backlog.project_id
            where backlog.id = weblinks.backlog_item_id
              and (
                projects.owner_user_id = $3
                or $3 = any(projects.member_user_ids)
              )
              and (
                weblinks.uploaded_by_user_id = $3
                or projects.owner_user_id = $3
                or $4 in ('faculty', 'admin')
                or $3 = any(projects.sprint_creator_user_ids)
              )
          )
        returning
          id,
          backlog_item_id,
          uploaded_by_user_id,
          archived_by_user_id,
          deleted_by_user_id,
          'link' as attachment_type,
          coalesce(nullif(label, ''), url) as file_name,
          url as file_url,
          'text/uri-list' as file_type,
          0 as file_size,
          label as link_label,
          is_archived,
          archived_at,
          is_deleted,
          deleted_at,
          uploaded_at`,
        [linkId, backlogItemId, ownerUserId, ownerUserRole]
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

      if (
        records[recordIndex].uploaded_by_user_id !== ownerUserId &&
        !(await canManageOtherProjectAttachments(
          backlogItemId,
          ownerUserId,
          ownerUserRole
        ))
      ) {
        return null
      }

      records[recordIndex] = {
        ...records[recordIndex],
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by_user_id: ownerUserId,
      }
      await writeFileRecords(records)

      return mapWebLinkRecord(records[recordIndex])
    }
  )
}

export async function archiveBacklogSubmission(
  backlogItemId: string,
  submissionId: string,
  ownerUserId: string,
  ownerUserRole: "student" | "faculty" | "admin"
) {
  return withSubmissionStore(
    async () => {
      const result = await getDb().query<BacklogSubmissionRecord>(
        `update attachments
         set is_archived = true,
             archived_at = now(),
             archived_by_user_id = $3
         where attachments.id = $1
           and attachments.backlog_item_id = $2
           and attachments.attachment_type = 'file'
           and attachments.is_archived = false
           and attachments.is_deleted = false
           and exists (
             select 1
             from backlog
             inner join projects
               on projects.id = backlog.project_id
             where backlog.id = attachments.backlog_item_id
               and (
                 projects.owner_user_id = $3
                 or $3 = any(projects.member_user_ids)
               )
                and (
                  attachments.uploaded_by_user_id = $3
                  or projects.owner_user_id = $3
                  or $4 in ('faculty', 'admin')
                 or $3 = any(projects.sprint_creator_user_ids)
               )
           )
         returning
           id,
           backlog_item_id,
           uploaded_by_user_id,
           archived_by_user_id,
           attachment_type,
           file_name,
           file_url,
           file_type,
           file_size,
           link_label,
           is_archived,
           archived_at,
           uploaded_at`,
        [submissionId, backlogItemId, ownerUserId, ownerUserRole]
      )

      return result.rows[0] ? mapRecord(result.rows[0]) : null
    },
    async () => {
      const records = await readFileRecords()
      const recordIndex = records.findIndex(
        (record) =>
          record.id === submissionId &&
          record.backlog_item_id === backlogItemId &&
          record.attachment_type === "file" &&
          record.is_archived === false
      )

      if (recordIndex < 0) {
        return null
      }

      if (
        records[recordIndex].uploaded_by_user_id !== ownerUserId &&
        !(await canManageOtherProjectAttachments(
          backlogItemId,
          ownerUserId,
          ownerUserRole
        ))
      ) {
        return null
      }

      records[recordIndex] = {
        ...records[recordIndex],
        is_archived: true,
        archived_at: new Date().toISOString(),
        archived_by_user_id: ownerUserId,
      }
      await writeFileRecords(records)

      return mapRecord(records[recordIndex])
    }
  )
}

export async function restoreBacklogSubmission(
  backlogItemId: string,
  submissionId: string,
  ownerUserId: string,
  ownerUserRole: "student" | "faculty" | "admin"
) {
  return withSubmissionStore(
    async () => {
      const result = await getDb().query<BacklogSubmissionRecord>(
        `update attachments
         set is_archived = false,
             archived_at = null,
             archived_by_user_id = null
         where attachments.id = $1
           and attachments.backlog_item_id = $2
           and attachments.attachment_type = 'file'
           and attachments.is_archived = true
           and attachments.is_deleted = false
           and exists (
             select 1
             from backlog
             inner join projects
               on projects.id = backlog.project_id
             where backlog.id = attachments.backlog_item_id
               and (
                 projects.owner_user_id = $3
                 or $3 = any(projects.member_user_ids)
               )
               and (
                 attachments.uploaded_by_user_id = $3
                 or projects.owner_user_id = $3
                 or $4 in ('faculty', 'admin')
                 or $3 = any(projects.sprint_creator_user_ids)
               )
           )
         returning
           id,
           backlog_item_id,
           uploaded_by_user_id,
           archived_by_user_id,
           attachment_type,
           file_name,
           file_url,
           file_type,
           file_size,
           link_label,
           is_archived,
           archived_at,
           uploaded_at`,
        [submissionId, backlogItemId, ownerUserId, ownerUserRole]
      )

      return result.rows[0] ? mapRecord(result.rows[0]) : null
    },
    async () => {
      const records = await readFileRecords()
      const recordIndex = records.findIndex(
        (record) =>
          record.id === submissionId &&
          record.backlog_item_id === backlogItemId &&
          record.attachment_type === "file" &&
          record.is_archived === true
      )

      if (recordIndex < 0) {
        return null
      }

      if (
        records[recordIndex].uploaded_by_user_id !== ownerUserId &&
        !(await canManageOtherProjectAttachments(
          backlogItemId,
          ownerUserId,
          ownerUserRole
        ))
      ) {
        return null
      }

      records[recordIndex] = {
        ...records[recordIndex],
        is_archived: false,
        archived_at: null,
        archived_by_user_id: null,
      }
      await writeFileRecords(records)

      return mapRecord(records[recordIndex])
    }
  )
}

export async function archiveBacklogWebLink(
  backlogItemId: string,
  linkId: string,
  ownerUserId: string,
  ownerUserRole: "student" | "faculty" | "admin"
) {
  return withSubmissionStore(
    async () => {
      const result = await getDb().query<BacklogSubmissionRecord>(
        `update weblinks
         set is_archived = true,
             archived_at = now(),
             archived_by_user_id = $3
         where weblinks.id = $1
           and weblinks.backlog_item_id = $2
           and weblinks.is_archived = false
           and weblinks.is_deleted = false
           and exists (
             select 1
             from backlog
             inner join projects
               on projects.id = backlog.project_id
             where backlog.id = weblinks.backlog_item_id
               and (
                 projects.owner_user_id = $3
                 or $3 = any(projects.member_user_ids)
               )
               and (
                 weblinks.uploaded_by_user_id = $3
                 or projects.owner_user_id = $3
                 or $4 in ('faculty', 'admin')
                 or $3 = any(projects.sprint_creator_user_ids)
               )
           )
         returning
           id,
           backlog_item_id,
           uploaded_by_user_id,
           archived_by_user_id,
           deleted_by_user_id,
           'link' as attachment_type,
           coalesce(nullif(label, ''), url) as file_name,
           url as file_url,
           'text/uri-list' as file_type,
           0 as file_size,
           label as link_label,
           is_archived,
           archived_at,
           is_deleted,
           deleted_at,
           uploaded_at`,
        [linkId, backlogItemId, ownerUserId, ownerUserRole]
      )

      return result.rows[0] ? mapWebLinkRecord(result.rows[0]) : null
    },
    async () => {
      const records = await readFileRecords()
      const recordIndex = records.findIndex(
        (record) =>
          record.id === linkId &&
          record.backlog_item_id === backlogItemId &&
          record.attachment_type === "link" &&
          record.is_archived === false
      )

      if (recordIndex < 0) {
        return null
      }

      if (
        records[recordIndex].uploaded_by_user_id !== ownerUserId &&
        !(await canManageOtherProjectAttachments(
          backlogItemId,
          ownerUserId,
          ownerUserRole
        ))
      ) {
        return null
      }

      records[recordIndex] = {
        ...records[recordIndex],
        is_archived: true,
        archived_at: new Date().toISOString(),
        archived_by_user_id: ownerUserId,
      }
      await writeFileRecords(records)

      return mapWebLinkRecord(records[recordIndex])
    }
  )
}

export async function restoreBacklogWebLink(
  backlogItemId: string,
  linkId: string,
  ownerUserId: string,
  ownerUserRole: "student" | "faculty" | "admin"
) {
  return withSubmissionStore(
    async () => {
      const result = await getDb().query<BacklogSubmissionRecord>(
        `update weblinks
         set is_archived = false,
             archived_at = null,
             archived_by_user_id = null
         where weblinks.id = $1
           and weblinks.backlog_item_id = $2
           and weblinks.is_archived = true
           and weblinks.is_deleted = false
           and exists (
             select 1
             from backlog
             inner join projects
               on projects.id = backlog.project_id
             where backlog.id = weblinks.backlog_item_id
               and (
                 projects.owner_user_id = $3
                 or $3 = any(projects.member_user_ids)
               )
               and (
                 weblinks.uploaded_by_user_id = $3
                 or projects.owner_user_id = $3
                 or $4 in ('faculty', 'admin')
                 or $3 = any(projects.sprint_creator_user_ids)
               )
           )
         returning
           id,
           backlog_item_id,
           uploaded_by_user_id,
           archived_by_user_id,
           deleted_by_user_id,
           'link' as attachment_type,
           coalesce(nullif(label, ''), url) as file_name,
           url as file_url,
           'text/uri-list' as file_type,
           0 as file_size,
           label as link_label,
           is_archived,
           archived_at,
           is_deleted,
           deleted_at,
           uploaded_at`,
        [linkId, backlogItemId, ownerUserId, ownerUserRole]
      )

      return result.rows[0] ? mapWebLinkRecord(result.rows[0]) : null
    },
    async () => {
      const records = await readFileRecords()
      const recordIndex = records.findIndex(
        (record) =>
          record.id === linkId &&
          record.backlog_item_id === backlogItemId &&
          record.attachment_type === "link" &&
          record.is_archived === true
      )

      if (recordIndex < 0) {
        return null
      }

      if (
        records[recordIndex].uploaded_by_user_id !== ownerUserId &&
        !(await canManageOtherProjectAttachments(
          backlogItemId,
          ownerUserId,
          ownerUserRole
        ))
      ) {
        return null
      }

      records[recordIndex] = {
        ...records[recordIndex],
        is_archived: false,
        archived_at: null,
        archived_by_user_id: null,
      }
      await writeFileRecords(records)

      return mapWebLinkRecord(records[recordIndex])
    }
  )
}

export async function archiveBacklogAttachmentsForItems(
  backlogItemIds: string[],
  ownerUserId: string
) {
  const normalizedIds = Array.from(
    new Set(backlogItemIds.map((id) => id.trim()).filter(Boolean))
  )

  if (normalizedIds.length === 0) {
    return 0
  }

  return withSubmissionStore(
    async () => {
      const result = await getDb().query(
        `update attachments
         set is_archived = true,
             archived_at = now(),
             archived_by_user_id = $2
         where backlog_item_id::text = any($1::text[])
          and is_archived = false
          and is_deleted = false`,
        [normalizedIds, ownerUserId]
      )

      return result.rowCount ?? 0
    },
    async () => {
      const idSet = new Set(normalizedIds)
      const archivedAt = new Date().toISOString()
      let changedCount = 0
      const records = await readFileRecords()
      const nextRecords = records.map((record) => {
        if (!idSet.has(record.backlog_item_id) || record.is_archived) {
          return record
        }

        changedCount += 1
        return {
          ...record,
          is_archived: true,
          archived_at: archivedAt,
          archived_by_user_id: ownerUserId,
        }
      })

      if (changedCount > 0) {
        await writeFileRecords(nextRecords)
      }

      return changedCount
    }
  )
}

export async function restoreBacklogAttachmentsForItems(backlogItemIds: string[]) {
  const normalizedIds = Array.from(
    new Set(backlogItemIds.map((id) => id.trim()).filter(Boolean))
  )

  if (normalizedIds.length === 0) {
    return 0
  }

  return withSubmissionStore(
    async () => {
      const result = await getDb().query(
        `update attachments
         set is_archived = false,
             archived_at = null,
             archived_by_user_id = null
         where backlog_item_id::text = any($1::text[])
          and is_archived = true
          and is_deleted = false`,
        [normalizedIds]
      )

      return result.rowCount ?? 0
    },
    async () => {
      const idSet = new Set(normalizedIds)
      let changedCount = 0
      const records = await readFileRecords()
      const nextRecords = records.map((record) => {
        if (!idSet.has(record.backlog_item_id) || !record.is_archived) {
          return record
        }

        changedCount += 1
        return {
          ...record,
          is_archived: false,
          archived_at: null,
          archived_by_user_id: null,
        }
      })

      if (changedCount > 0) {
        await writeFileRecords(nextRecords)
      }

      return changedCount
    }
  )
}

export async function listArchivedBacklogAttachments(
  projectId: string,
  ownerUserId: string
) {
  return withSubmissionStore(
    async () => {
      const result = await getDb().query<
        BacklogSubmissionRecord & {
          parent_id: string | null
          sequence_number: number
          parent_sequence_number: number | null
        }
      >(
        `select
          attachments.id,
          attachments.backlog_item_id,
          attachments.uploaded_by_user_id,
          attachments.archived_by_user_id,
          attachments.attachment_type,
          attachments.file_name,
          attachments.file_url,
          attachments.file_type,
          attachments.file_size,
          attachments.link_label,
          attachments.is_archived,
          attachments.archived_at,
          attachments.uploaded_at,
          backlog.parent_id,
          backlog.sequence_number,
          parent_item.sequence_number as parent_sequence_number
        from attachments
        inner join backlog
          on backlog.id = attachments.backlog_item_id
        inner join projects
          on projects.id = backlog.project_id
        left join backlog as parent_item
          on parent_item.id = backlog.parent_id
        where backlog.project_id = $1
          and attachments.is_archived = true
          and attachments.is_deleted = false
          and (
            projects.owner_user_id = $2
            or $2 = any(projects.member_user_ids)
          )
        order by attachments.archived_at desc nulls last, attachments.uploaded_at desc`,
        [projectId, ownerUserId]
      )

      const linkResult = await getDb().query<
        BacklogSubmissionRecord & {
          parent_id: string | null
          sequence_number: number
          parent_sequence_number: number | null
        }
      >(
        `select
          weblinks.id,
          weblinks.backlog_item_id,
          weblinks.uploaded_by_user_id,
          weblinks.archived_by_user_id,
          'link' as attachment_type,
          coalesce(nullif(weblinks.label, ''), weblinks.url) as file_name,
          weblinks.url as file_url,
          'text/uri-list' as file_type,
          0 as file_size,
          weblinks.label as link_label,
          weblinks.is_archived,
          weblinks.archived_at,
          weblinks.uploaded_at,
          backlog.parent_id,
          backlog.sequence_number,
          parent_item.sequence_number as parent_sequence_number
        from weblinks
        inner join backlog
          on backlog.id = weblinks.backlog_item_id
        inner join projects
          on projects.id = backlog.project_id
        left join backlog as parent_item
          on parent_item.id = backlog.parent_id
        where backlog.project_id = $1
          and weblinks.is_archived = true
          and weblinks.is_deleted = false
          and (
            projects.owner_user_id = $2
            or $2 = any(projects.member_user_ids)
          )
        order by weblinks.archived_at desc nulls last, weblinks.uploaded_at desc`,
        [projectId, ownerUserId]
      )

      return [...result.rows, ...linkResult.rows].map((record) => ({
        id: record.id,
        backlogItemId: record.backlog_item_id,
        backlogItemParentId: record.parent_id,
        backlogItemSequenceNumber: record.sequence_number,
        parentSequenceNumber: record.parent_sequence_number,
        attachmentType: record.attachment_type,
        uploadedByUserId: record.uploaded_by_user_id,
        archivedByUserId: record.archived_by_user_id,
        fileName: record.file_name,
        fileUrl: record.file_url,
        fileType: record.file_type,
        fileSize: record.file_size,
        label: record.link_label,
        uploadedAt: record.uploaded_at,
        archivedAt: record.archived_at,
      }))
    },
    async () => {
      const records = await readFileRecords()
      return records
        .filter((record) => record.is_archived === true)
        .map((record) => ({
          id: record.id,
          backlogItemId: record.backlog_item_id,
          backlogItemParentId: null,
          backlogItemSequenceNumber: 0,
          parentSequenceNumber: null,
          attachmentType: record.attachment_type,
          uploadedByUserId: record.uploaded_by_user_id,
          archivedByUserId: record.archived_by_user_id,
          fileName: record.file_name,
          fileUrl: record.file_url,
          fileType: record.file_type,
          fileSize: record.file_size,
          label: record.link_label,
          uploadedAt: record.uploaded_at,
          archivedAt: record.archived_at,
        }))
    }
  )
}

export async function listDeletedBacklogAttachments(
  projectId: string,
  ownerUserId: string
) {
  return withSubmissionStore(
    async () => {
      const result = await getDb().query<
        BacklogSubmissionRecord & {
          parent_id: string | null
          sequence_number: number
          parent_sequence_number: number | null
        }
      >(
        `select
          attachments.id,
          attachments.backlog_item_id,
          attachments.uploaded_by_user_id,
          attachments.archived_by_user_id,
          attachments.deleted_by_user_id,
          attachments.attachment_type,
          attachments.file_name,
          attachments.file_url,
          attachments.file_type,
          attachments.file_size,
          attachments.link_label,
          attachments.is_archived,
          attachments.archived_at,
          attachments.is_deleted,
          attachments.deleted_at,
          attachments.uploaded_at,
          backlog.parent_id,
          backlog.sequence_number,
          parent_item.sequence_number as parent_sequence_number
        from attachments
        inner join backlog
          on backlog.id = attachments.backlog_item_id
        inner join projects
          on projects.id = backlog.project_id
        left join backlog as parent_item
          on parent_item.id = backlog.parent_id
        where backlog.project_id = $1
          and attachments.is_deleted = true
          and (
            projects.owner_user_id = $2
            or $2 = any(projects.member_user_ids)
          )
        order by attachments.deleted_at desc nulls last, attachments.uploaded_at desc`,
        [projectId, ownerUserId]
      )

      const linkResult = await getDb().query<
        BacklogSubmissionRecord & {
          parent_id: string | null
          sequence_number: number
          parent_sequence_number: number | null
        }
      >(
        `select
          weblinks.id,
          weblinks.backlog_item_id,
          weblinks.uploaded_by_user_id,
          weblinks.archived_by_user_id,
          weblinks.deleted_by_user_id,
          'link' as attachment_type,
          coalesce(nullif(weblinks.label, ''), weblinks.url) as file_name,
          weblinks.url as file_url,
          'text/uri-list' as file_type,
          0 as file_size,
          weblinks.label as link_label,
          weblinks.is_archived,
          weblinks.archived_at,
          weblinks.is_deleted,
          weblinks.deleted_at,
          weblinks.uploaded_at,
          backlog.parent_id,
          backlog.sequence_number,
          parent_item.sequence_number as parent_sequence_number
        from weblinks
        inner join backlog
          on backlog.id = weblinks.backlog_item_id
        inner join projects
          on projects.id = backlog.project_id
        left join backlog as parent_item
          on parent_item.id = backlog.parent_id
        where backlog.project_id = $1
          and weblinks.is_deleted = true
          and (
            projects.owner_user_id = $2
            or $2 = any(projects.member_user_ids)
          )
        order by weblinks.deleted_at desc nulls last, weblinks.uploaded_at desc`,
        [projectId, ownerUserId]
      )

      return [...result.rows, ...linkResult.rows].map((record): DeletedBacklogAttachmentRow => ({
        id: record.id,
        backlogItemId: record.backlog_item_id,
        backlogItemParentId: record.parent_id,
        backlogItemSequenceNumber: record.sequence_number,
        parentSequenceNumber: record.parent_sequence_number,
        attachmentType: record.attachment_type,
        uploadedByUserId: record.uploaded_by_user_id,
        archivedByUserId: record.archived_by_user_id,
        deletedByUserId: record.deleted_by_user_id,
        fileName: record.file_name,
        fileUrl: record.file_url,
        fileType: record.file_type,
        fileSize: record.file_size,
        label: record.link_label,
        uploadedAt: record.uploaded_at,
        archivedAt: record.archived_at,
        deletedAt: record.deleted_at,
      }))
    },
    async () => {
      const records = await readFileRecords()
      return records
        .filter((record) => record.is_deleted === true)
        .map((record): DeletedBacklogAttachmentRow => ({
          id: record.id,
          backlogItemId: record.backlog_item_id,
          backlogItemParentId: null,
          backlogItemSequenceNumber: 0,
          parentSequenceNumber: null,
          attachmentType: record.attachment_type,
          uploadedByUserId: record.uploaded_by_user_id,
          archivedByUserId: record.archived_by_user_id,
          deletedByUserId: record.deleted_by_user_id,
          fileName: record.file_name,
          fileUrl: record.file_url,
          fileType: record.file_type,
          fileSize: record.file_size,
          label: record.link_label,
          uploadedAt: record.uploaded_at,
          archivedAt: record.archived_at,
          deletedAt: record.deleted_at,
        }))
    }
  )
}

export async function restoreDeletedBacklogAttachment(
  attachmentId: string,
  ownerUserId: string,
  ownerUserRole: "student" | "faculty" | "admin"
) {
  return withSubmissionStore(
    async () => {
      const result = await getDb().query<BacklogSubmissionRecord>(
        `update attachments
         set is_deleted = false,
             deleted_at = null,
             deleted_by_user_id = null
         where attachments.id = $1
           and attachments.is_deleted = true
           and exists (
             select 1
             from backlog
             inner join projects
               on projects.id = backlog.project_id
             where backlog.id = attachments.backlog_item_id
               and (
                 projects.owner_user_id = $2
                 or $2 = any(projects.member_user_ids)
               )
               and (
                 attachments.deleted_by_user_id = $2
                 or projects.owner_user_id = $2
                 or $3 in ('faculty', 'admin')
                 or $2 = any(projects.sprint_creator_user_ids)
               )
           )
         returning *`,
        [attachmentId, ownerUserId, ownerUserRole]
      )

      return result.rows[0]
        ? result.rows[0].attachment_type === "link"
          ? mapWebLinkRecord(result.rows[0])
          : mapRecord(result.rows[0])
        : null
    },
    async () => {
      const records = await readFileRecords()
      const recordIndex = records.findIndex(
        (record) => record.id === attachmentId && record.is_deleted === true
      )

      if (recordIndex < 0) {
        return null
      }

      const record = records[recordIndex]

      if (
        record.deleted_by_user_id !== ownerUserId &&
        !(await canManageOtherProjectAttachments(
          record.backlog_item_id,
          ownerUserId,
          ownerUserRole
        ))
      ) {
        return null
      }

      records[recordIndex] = {
        ...record,
        is_deleted: false,
        deleted_at: null,
        deleted_by_user_id: null,
      }
      await writeFileRecords(records)

      return records[recordIndex].attachment_type === "link"
        ? mapWebLinkRecord(records[recordIndex])
        : mapRecord(records[recordIndex])
    }
  )
}

export async function permanentlyDeleteBacklogAttachment(
  attachmentId: string,
  ownerUserId: string,
  ownerUserRole: "student" | "faculty" | "admin"
) {
  return withSubmissionStore(
    async () => {
      const result = await getDb().query<{ id: string }>(
        `delete from attachments
         where attachments.id = $1
           and attachments.is_deleted = true
           and exists (
             select 1
             from backlog
             inner join projects
               on projects.id = backlog.project_id
             where backlog.id = attachments.backlog_item_id
               and (
                 projects.owner_user_id = $2
                 or $2 = any(projects.member_user_ids)
               )
               and (
                 attachments.deleted_by_user_id = $2
                 or projects.owner_user_id = $2
                 or $3 in ('faculty', 'admin')
                 or $2 = any(projects.sprint_creator_user_ids)
               )
           )
         returning id`,
        [attachmentId, ownerUserId, ownerUserRole]
      )

      return (result.rowCount ?? 0) > 0
    },
    async () => {
      const records = await readFileRecords()
      const recordIndex = records.findIndex(
        (record) => record.id === attachmentId && record.is_deleted === true
      )

      if (recordIndex < 0) {
        return false
      }

      const record = records[recordIndex]

      if (
        record.deleted_by_user_id !== ownerUserId &&
        !(await canManageOtherProjectAttachments(
          record.backlog_item_id,
          ownerUserId,
          ownerUserRole
        ))
      ) {
        return false
      }

      records.splice(recordIndex, 1)
      await writeFileRecords(records)
      return true
    }
  )
}
