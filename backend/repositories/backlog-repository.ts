import { randomUUID } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

import { getPreferredStorageMode } from "@backend/config/storage-mode"
import { getDb } from "@backend/db/connection"
import {
  canUseLocalFileFallback,
  shouldFallbackToLocalStore,
} from "@backend/db/fallback"
import { ensureMicrosoftLoginSchema } from "@backend/repositories/microsoft-login-repository"
import {
  canUserCreateSprintInProject,
  ensureProjectExists,
  listProjects,
} from "@backend/repositories/project-repository"

export type BacklogRow = {
  id: string
  projectId: string
  parentId: string | null
  sequenceNumber: number
  orderIndex: number
  createdByUserId: string | null
  archivedByUserId: string | null
  title: string
  description: string
  startDate: string | null
  dueDate: string | null
  status: string
  checked: boolean
  assigneeId: string | null
  archived: boolean
  archivedAt: string | null
  createdAt: string
  commentCount?: number
}

type CreateBacklogItemInput = {
  projectId: string
  parentId: string | null
  title: string
  description: string
  startDate: string | null
  dueDate: string | null
  status: string
  checked: boolean
  assigneeId: string | null
}

type UpdateBacklogItemInput = {
  parentId?: string | null
  title?: string
  description?: string
  startDate?: string | null
  dueDate?: string | null
  status?: string
  checked?: boolean
  assigneeId?: string | null
  orderIndex?: number
}

type BacklogRecord = {
  id: string
  project_id: string
  parent_id: string | null
  sequence_number: number
  order_index: number
  created_by_user_id: string | null
  archived_by_user_id: string | null
  title: string
  description: string
  start_date: string | null
  due_date: string | null
  status: string
  checked: boolean
  assignee_id: string | null
  is_archived: boolean
  archived_at: string | null
  created_at: string
}

type BacklogRecordWithStats = BacklogRecord & {
  comment_count?: number | string | null
}

type ListBacklogItemsOptions = {
  archived?: boolean
  limit?: number
  offset?: number
}

type BacklogStorageMode = "database" | "file"

const backlogFilePath = path.join(process.cwd(), ".data", "backlog-items.json")

let schemaReady: Promise<void> | null = null
let storageModePromise: Promise<BacklogStorageMode> | null = null
let fallbackWarningShown = false

export class BacklogItemNameConflictError extends Error {
  constructor(itemName: string, itemType: "task" | "subtask") {
    super(
      `${itemType === "subtask" ? "Subtask" : "Task"} "${itemName}" already exists.`
    )
    this.name = "BacklogItemNameConflictError"
  }
}

function uppercaseFirstCharacter(value: string) {
  if (!value) {
    return value
  }

  return value.charAt(0).toUpperCase() + value.slice(1)
}

function normalizeItemNameForComparison(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase()
}

type RawBacklogRecord = Partial<BacklogRecord> & {
  projectId?: string | null
  parentId?: string | null
  sequenceNumber?: number | null
  orderIndex?: number | null
  createdByUserId?: string | null
  startDate?: string | null
  dueDate?: string | null
  assigneeId?: string | null
  archivedByUserId?: string | null
  archived?: boolean
  archivedAt?: string | null
  createdAt?: string | null
  file_name?: string | null
  file_size?: string | null
  file_type?: string | null
}

function readStringAlias(
  record: RawBacklogRecord,
  ...keys: Array<keyof RawBacklogRecord>
) {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === "string") {
      return value
    }
  }

  return null
}

function readNumberAlias(
  record: RawBacklogRecord,
  ...keys: Array<keyof RawBacklogRecord>
) {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }
  }

  return null
}

function readBooleanAlias(
  record: RawBacklogRecord,
  ...keys: Array<keyof RawBacklogRecord>
) {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === "boolean") {
      return value
    }
  }

  return null
}

function mapRecord(record: BacklogRecordWithStats): BacklogRow {
  return {
    id: record.id,
    projectId: record.project_id,
    parentId: record.parent_id,
    sequenceNumber: record.sequence_number,
    orderIndex: record.order_index,
    createdByUserId: record.created_by_user_id,
    archivedByUserId: record.archived_by_user_id,
    title: record.title,
    description: record.description,
    startDate: record.start_date,
    dueDate: record.due_date,
    status: record.status,
    checked: record.checked,
    assigneeId: record.assignee_id,
    archived: record.is_archived,
    archivedAt: record.archived_at,
    createdAt: record.created_at,
    commentCount:
      typeof record.comment_count === "number"
        ? record.comment_count
        : typeof record.comment_count === "string"
        ? Number.parseInt(record.comment_count, 10)
        : undefined,
  }
}

function toRecord(input: BacklogRow): BacklogRecord {
  return {
    id: input.id,
    project_id: input.projectId,
    parent_id: input.parentId,
    sequence_number: input.sequenceNumber,
    order_index: input.orderIndex,
    created_by_user_id: input.createdByUserId ?? null,
    archived_by_user_id: input.archivedByUserId ?? null,
    title: input.title,
    description: input.description,
    start_date: input.startDate,
    due_date: input.dueDate,
    status: input.status,
    checked: input.checked,
    assignee_id: input.assigneeId,
    is_archived: input.archived,
    archived_at: input.archivedAt,
    created_at: input.createdAt,
  }
}

function sanitizeJsonArray(raw: string) {
  const trimmedValue = raw.trim()
  const firstBracket = trimmedValue.indexOf("[")
  const lastBracket = trimmedValue.lastIndexOf("]")

  if (firstBracket === -1 || lastBracket === -1 || lastBracket < firstBracket) {
    throw new Error("Backlog file does not contain a valid JSON array.")
  }

  return trimmedValue.slice(firstBracket, lastBracket + 1)
}

function normalizeRecord(record: RawBacklogRecord): BacklogRecord {
  const projectId = readStringAlias(record, "project_id", "projectId")
  const parentId = readStringAlias(record, "parent_id", "parentId")
  const sequenceNumber = readNumberAlias(
    record,
    "sequence_number",
    "sequenceNumber"
  )
  const orderIndex = readNumberAlias(record, "order_index", "orderIndex")
  const createdByUserId = readStringAlias(
    record,
    "created_by_user_id",
    "createdByUserId"
  )
  const archivedByUserId = readStringAlias(
    record,
    "archived_by_user_id",
    "archivedByUserId"
  )
  const startDate = readStringAlias(record, "start_date", "startDate")
  const dueDate = readStringAlias(record, "due_date", "dueDate")
  const assigneeId = readStringAlias(record, "assignee_id", "assigneeId")
  const archivedAt = readStringAlias(record, "archived_at", "archivedAt")
  const createdAt = readStringAlias(record, "created_at", "createdAt")
  const isArchived = readBooleanAlias(record, "is_archived", "archived")

  return {
    id: typeof record.id === "string" ? record.id : randomUUID(),
    project_id: projectId ?? "",
    parent_id: parentId,
    sequence_number:
      sequenceNumber ?? 1,
    order_index:
      orderIndex ?? 1,
    created_by_user_id: createdByUserId,
    archived_by_user_id: archivedByUserId,
    title: typeof record.title === "string" ? record.title : "",
    description: typeof record.description === "string" ? record.description : "",
    start_date: startDate,
    due_date: dueDate,
    status: typeof record.status === "string" ? record.status : "todo",
    checked: typeof record.checked === "boolean" ? record.checked : false,
    assignee_id: assigneeId,
    is_archived: isArchived ?? false,
    archived_at: archivedAt,
    created_at: createdAt ?? new Date().toISOString(),
  }
}

function shouldUseFileFallback(error: unknown) {
  return shouldFallbackToLocalStore(error)
}

function showFallbackWarning(error: unknown) {
  if (fallbackWarningShown) {
    return
  }

  fallbackWarningShown = true

  const message = error instanceof Error ? error.message : String(error)

  console.warn(
    `Backlog storage is using local file data: ${message}`
  )
}

async function ensureBacklogSchema() {
  if (!schemaReady) {
    schemaReady = ensureMicrosoftLoginSchema()
      .then(() =>
        getDb().query(`
          create table if not exists backlog_items (
          id uuid primary key,
          project_id uuid references projects(id) on delete cascade,
          parent_id uuid references backlog_items(id) on delete cascade,
          sequence_number integer,
          order_index integer,
          created_by_user_id text,
          archived_by_user_id text,
          title text not null,
          description text not null default '',
          start_date date,
          due_date date,
          status text not null check (
            status in ('todo', 'inprogress', 'inreview', 'revision', 'completed')
          ),
          checked boolean not null default false,
          assignee_id text,
          is_archived boolean not null default false,
          archived_at timestamptz,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
      `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog_items
          add column if not exists created_by_user_id text;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog_items
          add column if not exists archived_by_user_id text;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog_items
          add column if not exists start_date date;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog_items
          add column if not exists due_date date;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog_items
          add column if not exists assignee_id text;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog_items
          add column if not exists is_archived boolean not null default false;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog_items
          add column if not exists archived_at timestamptz;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog_items
          add column if not exists project_id uuid references projects(id) on delete cascade;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog_items
          add column if not exists parent_id uuid;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog_items
          add column if not exists sequence_number integer;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog_items
          add column if not exists order_index integer;
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists backlog_items_project_order_idx
          on backlog_items(project_id, order_index asc, created_at asc);
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists backlog_items_created_by_user_id_idx
          on backlog_items(created_by_user_id);
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists backlog_items_project_parent_idx
          on backlog_items(project_id, parent_id, sequence_number asc);
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists backlog_items_parent_id_idx
          on backlog_items(parent_id);
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists backlog_items_assignee_id_idx
          on backlog_items(assignee_id);
        `)
      )
      .then(() =>
        getDb().query(`
          create table if not exists backlog_comments (
            id uuid primary key,
            backlog_item_id uuid not null references backlog_items(id) on delete cascade,
            author_user_id text,
            author text not null,
            body text not null default '',
            attachments jsonb not null default '[]'::jsonb,
            created_at timestamptz not null default now()
          );
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog_comments
          add column if not exists author_user_id text;
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists backlog_comments_backlog_item_id_idx
          on backlog_comments(backlog_item_id, created_at asc);
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists backlog_comments_author_user_id_idx
          on backlog_comments(author_user_id);
        `)
      )
      .then(() =>
        getDb().query(`
          with numbered_items as (
            select
              id,
              row_number() over (
                partition by project_id
                order by created_at asc, id asc
              ) as next_sequence_number
            from backlog_items
          )
          update backlog_items
          set sequence_number = numbered_items.next_sequence_number
          from numbered_items
          where backlog_items.id = numbered_items.id
            and backlog_items.sequence_number is null;
        `)
      )
      .then(() =>
        getDb().query(`
          with ordered_items as (
            select
              id,
              row_number() over (
                partition by project_id
                order by created_at asc, id asc
              ) as next_order_index
            from backlog_items
          )
          update backlog_items
          set order_index = ordered_items.next_order_index
          from ordered_items
          where backlog_items.id = ordered_items.id
            and backlog_items.order_index is null;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog_items
          alter column sequence_number set not null;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog_items
          alter column order_index set not null;
        `)
      )
      .then(() =>
        getDb().query(`
          do $$
          begin
            if not exists (
              select 1
              from pg_constraint
              where conname = 'fk_backlog_items_parent_id'
            ) then
              alter table backlog_items
              add constraint fk_backlog_items_parent_id
              foreign key (parent_id) references backlog_items(id) on delete cascade;
            end if;
          end $$;
        `)
      )
      .then(() =>
        getDb().query(`
          do $$
          begin
            if not exists (
              select 1
              from pg_constraint
              where conname = 'fk_backlog_items_assignee_id'
            ) then
              alter table backlog_items
              add constraint fk_backlog_items_assignee_id
              foreign key (assignee_id) references microsoft_account_logins(microsoft_user_id)
              on delete set null;
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

async function getStorageMode(): Promise<BacklogStorageMode> {
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
    const parsed = JSON.parse(sanitizeJsonArray(raw)) as RawBacklogRecord[]
    return parsed.map(normalizeRecord)
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

export async function listBacklogItems(
  projectId: string,
  ownerUserId: string,
  options?: ListBacklogItemsOptions
) {
  return listBacklogItemsWithStats(projectId, ownerUserId, options)
}

export async function listBacklogItemsWithStats(
  projectId: string,
  ownerUserId: string,
  options: ListBacklogItemsOptions = {}
) {
  return withBacklogStore(
    async () => {
      const archived = options.archived === true
      const limit = Math.max(1, Math.min(options.limit ?? 200, 500))
      const offset = Math.max(0, options.offset ?? 0)
      const result = await getDb().query<BacklogRecordWithStats>(
        `select
          backlog_items.id,
          backlog_items.project_id,
          backlog_items.parent_id,
          backlog_items.sequence_number,
          backlog_items.order_index,
          backlog_items.created_by_user_id,
          backlog_items.archived_by_user_id,
          backlog_items.title,
          backlog_items.description,
          backlog_items.start_date,
          backlog_items.due_date,
          backlog_items.status,
          backlog_items.checked,
          backlog_items.assignee_id,
          backlog_items.is_archived,
          backlog_items.archived_at,
          backlog_items.created_at,
          coalesce(comment_counts.comment_count, 0) as comment_count
        from backlog_items
        inner join projects
          on projects.id = backlog_items.project_id
        left join (
          select
            backlog_comments.backlog_item_id,
            count(*)::int as comment_count
          from backlog_comments
          inner join backlog_items as scoped_items
            on scoped_items.id = backlog_comments.backlog_item_id
          where scoped_items.project_id = $1
          group by backlog_comments.backlog_item_id
        ) as comment_counts
          on comment_counts.backlog_item_id = backlog_items.id
        where backlog_items.project_id = $1
          and backlog_items.is_archived = $3
          and (
            projects.owner_user_id = $2
            or $2 = any(projects.member_user_ids)
          )
        order by backlog_items.order_index asc, backlog_items.created_at asc
        limit $4
        offset $5`,
        [projectId, ownerUserId, archived, limit, offset]
      )

      return result.rows.map(mapRecord)
    },
    async () => {
      const archived = options.archived === true
      const records = await readFileRecords()
      return records
        .filter(
          (record) => record.project_id === projectId && record.is_archived === archived
        )
        .sort((left, right) => left.order_index - right.order_index)
        .slice(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? 200))
        .map(mapRecord)
    }
  )
}

export async function listProjectBacklogActivities(
  projectIds: string[],
  ownerUserId: string
) {
  if (projectIds.length === 0) {
    return []
  }

  return withBacklogStore(
    async () => {
      const result = await getDb().query<
        BacklogRecordWithStats & {
          project_name: string
          project_type: string
          project_member: string[] | null
        }
      >(
        `select
          backlog_items.id,
          backlog_items.project_id,
          backlog_items.parent_id,
          backlog_items.sequence_number,
          backlog_items.order_index,
          backlog_items.created_by_user_id,
          backlog_items.archived_by_user_id,
          backlog_items.title,
          backlog_items.description,
          backlog_items.start_date,
          backlog_items.due_date,
          backlog_items.status,
          backlog_items.checked,
          backlog_items.assignee_id,
          backlog_items.is_archived,
          backlog_items.archived_at,
          backlog_items.created_at,
          coalesce(comment_counts.comment_count, 0) as comment_count,
          projects.project_name,
          projects.project_type,
          projects.project_member
        from backlog_items
        inner join projects
          on projects.id = backlog_items.project_id
        left join (
          select
            backlog_comments.backlog_item_id,
            count(*)::int as comment_count
          from backlog_comments
          group by backlog_comments.backlog_item_id
        ) as comment_counts
          on comment_counts.backlog_item_id = backlog_items.id
        where backlog_items.project_id = any($1::uuid[])
          and backlog_items.is_archived = false
          and (
            projects.owner_user_id = $2
            or $2 = any(projects.member_user_ids)
          )
        order by backlog_items.created_at desc`,
        [projectIds, ownerUserId]
      )

      return result.rows.map((record) => ({
        ...mapRecord(record),
        projectName: record.project_name,
        projectType: record.project_type,
        projectMembers: record.project_member ?? [],
      }))
    },
    async () => {
      const records = await readFileRecords()
      return records
        .filter((record) => projectIds.includes(record.project_id))
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .map((record) => ({
          ...mapRecord(record),
          projectName: "",
          projectType: "",
          projectMembers: [],
        }))
    }
  )
}

export async function createBacklogItem(
  input: CreateBacklogItemInput,
  ownerUserId: string
) {
  return withBacklogStore(
    async () => {
      await ensureProjectExists(input.projectId, ownerUserId)
      const normalizedTitle = uppercaseFirstCharacter(input.title)
      const normalizedComparableTitle = normalizeItemNameForComparison(normalizedTitle)
      const duplicateType = input.parentId ? "subtask" : "task"

      const duplicateResult = await getDb().query<{ id: string }>(
        `select backlog_items.id
         from backlog_items
         inner join projects
           on projects.id = backlog_items.project_id
         where backlog_items.project_id = $1
           and (
             ($2::uuid is null and backlog_items.parent_id is null)
             or backlog_items.parent_id = $2::uuid
           )
           and lower(regexp_replace(btrim(backlog_items.title), '\s+', ' ', 'g')) = $3
           and (
             projects.owner_user_id = $4
             or $4 = any(projects.member_user_ids)
           )
         limit 1`,
        [input.projectId, input.parentId, normalizedComparableTitle, ownerUserId]
      )

      if ((duplicateResult.rowCount ?? 0) > 0) {
        throw new BacklogItemNameConflictError(normalizedTitle, duplicateType)
      }

      const result = await getDb().query<BacklogRecord>(
        `with next_sequence as (
          select coalesce(max(sequence_number), 0) + 1 as value
          from backlog_items
          where project_id = $2
        ), next_order as (
          select coalesce(max(order_index), 0) + 1 as value
          from backlog_items
          where project_id = $2
        )
        insert into backlog_items (
          id,
          project_id,
          parent_id,
          sequence_number,
          order_index,
          created_by_user_id,
          title,
          description,
          start_date,
          due_date,
          status,
          checked,
          assignee_id
        )
        select
          $1,
          $2,
          $3,
          next_sequence.value,
          next_order.value,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11
        from next_sequence, next_order, projects
        where projects.id = $2
          and (
            projects.owner_user_id = $12
            or $12 = any(projects.member_user_ids)
          )
        returning
          id,
          project_id,
          parent_id,
          sequence_number,
          order_index,
          created_by_user_id,
          title,
          description,
          start_date,
          due_date,
          status,
          checked,
          assignee_id,
          created_at`,
        [
          randomUUID(),
          input.projectId,
          input.parentId,
          ownerUserId,
          normalizedTitle,
          input.description,
          input.startDate,
            input.dueDate,
            input.status,
            input.checked,
            input.assigneeId,
            ownerUserId,
          ]
      )

      if (!result.rows[0]) {
        return null
      }

      let createdRecord = mapRecord(result.rows[0])

      // Defensively repair the parent link for subtasks if the inserted row
      // comes back without parent_id for any reason.
      if (input.parentId && !createdRecord.parentId) {
        const repaired = await getDb().query<BacklogRecord>(
          `update backlog_items
          set parent_id = $1, updated_at = now()
          where id = $2
          returning
            id,
            project_id,
            parent_id,
            sequence_number,
            order_index,
            created_by_user_id,
            title,
            description,
            start_date,
            due_date,
            status,
            checked,
            assignee_id,
            created_at`,
          [input.parentId, createdRecord.id]
        )

        if (repaired.rows[0]) {
          createdRecord = mapRecord(repaired.rows[0])
        }
      }

      return createdRecord
    },
    async () => {
      const records = await readFileRecords()
      const normalizedTitle = uppercaseFirstCharacter(input.title)
      const normalizedComparableTitle = normalizeItemNameForComparison(normalizedTitle)
      const duplicateRecord = records.find(
        (record) =>
          record.project_id === input.projectId &&
          record.parent_id === input.parentId &&
          normalizeItemNameForComparison(record.title) === normalizedComparableTitle
      )

      if (duplicateRecord) {
        throw new BacklogItemNameConflictError(
          normalizedTitle,
          input.parentId ? "subtask" : "task"
        )
      }

      const nextSequenceNumber =
        records
          .filter((record) => record.project_id === input.projectId)
          .reduce(
            (maxValue, record) => Math.max(maxValue, record.sequence_number),
            0
          ) + 1
      const nextOrderIndex =
        records
          .filter((record) => record.project_id === input.projectId)
          .reduce(
            (maxValue, record) => Math.max(maxValue, record.order_index),
            0
          ) + 1

      const item: BacklogRow = {
        id: randomUUID(),
        projectId: input.projectId,
        parentId: input.parentId,
        sequenceNumber: nextSequenceNumber,
        orderIndex: nextOrderIndex,
        createdByUserId: ownerUserId,
        archivedByUserId: null,
        title: normalizedTitle,
        description: input.description,
        startDate: input.startDate,
        dueDate: input.dueDate,
        status: input.status,
        checked: input.checked,
        assigneeId: input.assigneeId,
        archived: false,
        archivedAt: null,
        createdAt: new Date().toISOString(),
      }

      records.unshift(toRecord(item))
      await writeFileRecords(records)

      return item
    }
  )
}

export async function updateBacklogItem(
  id: string,
  ownerUserId: string,
  input: UpdateBacklogItemInput,
  ownerUserRole: "student" | "faculty" | "admin" = "student"
) {
  return withBacklogStore(
    async () => {
      const fields: string[] = []
      const values: Array<string | number | boolean | null> = []

      if (typeof input.title === "string") {
        fields.push(`title = $${fields.length + 1}`)
        values.push(input.title)
      }

      if (typeof input.description === "string") {
        fields.push(`description = $${fields.length + 1}`)
        values.push(input.description)
      }

      if ("parentId" in input) {
        fields.push(`parent_id = $${fields.length + 1}`)
        values.push(input.parentId ?? null)
      }

      if ("startDate" in input) {
        fields.push(`start_date = $${fields.length + 1}`)
        values.push(input.startDate ?? null)
      }

      if ("dueDate" in input) {
        fields.push(`due_date = $${fields.length + 1}`)
        values.push(input.dueDate ?? null)
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

      if (typeof input.orderIndex === "number" && Number.isFinite(input.orderIndex)) {
        fields.push(`order_index = $${fields.length + 1}`)
        values.push(input.orderIndex)
      }

      if (fields.length === 0) {
        return null
      }

      fields.push(`updated_at = now()`)
      values.push(id)

      const result = await getDb().query<BacklogRecord>(
        `update backlog_items
        set ${fields.join(", ")}
        from projects
        left join project_member_access
          on project_member_access.project_id = projects.id
         and project_member_access.member_user_id = $${values.length + 2}
        where backlog_items.id = $${values.length}
          and projects.id = backlog_items.project_id
          and (
            projects.owner_user_id = $${values.length + 1}
            or $${values.length + 1} = any(projects.member_user_ids)
          )
          and (
            backlog_items.parent_id is null
            or backlog_items.created_by_user_id = $${values.length + 1}
            or projects.owner_user_id = $${values.length + 1}
            or $${values.length + 2} in ('faculty', 'admin')
            or coalesce(project_member_access.can_create_sprint, false)
          )
        returning
          id,
          project_id,
          parent_id,
          sequence_number,
          order_index,
          created_by_user_id,
          title,
          description,
          start_date,
          due_date,
          status,
          checked,
          assignee_id,
          created_at`,
        [...values, ownerUserId, ownerUserRole]
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
      const canManageOthers = await canUserCreateSprintInProject(
        current.projectId,
        ownerUserId,
        ownerUserRole
      ).catch(() => ownerUserRole === "faculty" || ownerUserRole === "admin")

      if (
        current.parentId !== null &&
        current.createdByUserId !== ownerUserId &&
        !canManageOthers
      ) {
        return null
      }

      const next: BacklogRow = {
        ...current,
        title: typeof input.title === "string" ? input.title : current.title,
        parentId: "parentId" in input ? input.parentId ?? null : current.parentId,
        description:
          typeof input.description === "string"
            ? input.description
            : current.description,
        startDate:
          "startDate" in input ? input.startDate ?? null : current.startDate,
        dueDate: "dueDate" in input ? input.dueDate ?? null : current.dueDate,
        status: typeof input.status === "string" ? input.status : current.status,
        checked:
          typeof input.checked === "boolean" ? input.checked : current.checked,
        assigneeId:
          "assigneeId" in input ? input.assigneeId ?? null : current.assigneeId,
        orderIndex:
          typeof input.orderIndex === "number" && Number.isFinite(input.orderIndex)
            ? input.orderIndex
            : current.orderIndex,
      }

      records[index] = toRecord(next)
      await writeFileRecords(records)

      return next
    }
  )
}

export async function deleteBacklogItem(
  id: string,
  ownerUserId: string,
  ownerUserRole: "student" | "faculty" | "admin" = "student"
) {
  return withBacklogStore(
    async () => {
      const result = await getDb().query<{ id: string }>(
        `delete from backlog_items
        using projects
        left join project_member_access
          on project_member_access.project_id = projects.id
         and project_member_access.member_user_id = $2
        where backlog_items.id = $1
          and projects.id = backlog_items.project_id
          and (
            projects.owner_user_id = $2
            or $2 = any(projects.member_user_ids)
          )
          and (
            backlog_items.parent_id is null
            or backlog_items.created_by_user_id = $2
            or projects.owner_user_id = $2
            or $3 in ('faculty', 'admin')
            or coalesce(project_member_access.can_create_sprint, false)
          )
        returning backlog_items.id`,
        [id, ownerUserId, ownerUserRole]
      )

      return (result.rowCount ?? 0) > 0
    },
    async () => {
      const records = await readFileRecords()
      const targetRecord = records.find((record) => record.id === id)

      if (!targetRecord) {
        return false
      }

      const canManageOthers = await canUserCreateSprintInProject(
        targetRecord.project_id,
        ownerUserId,
        ownerUserRole
      ).catch(() => ownerUserRole === "faculty" || ownerUserRole === "admin")
      const projectRecords = await listProjects(ownerUserId).catch(() => [])

      const isProjectMember = projectRecords.some(
        (projectRecord) =>
          projectRecord.id === targetRecord.project_id
      )

      if (
        targetRecord.parent_id !== null &&
        !isProjectMember &&
        targetRecord.created_by_user_id !== ownerUserId &&
        !canManageOthers
      ) {
        return false
      }

      const nextRecords = records.filter(
        (record) => record.id !== id && record.parent_id !== id
      )

      if (nextRecords.length === records.length) {
        return false
      }

      await writeFileRecords(nextRecords)
      return true
    }
  )
}

export async function archiveBacklogItem(
  id: string,
  ownerUserId: string,
  ownerUserRole: "student" | "faculty" | "admin" = "student"
) {
  return withBacklogStore(
    async () => {
      const targetResult = await getDb().query<BacklogRecord>(
        `select backlog_items.*
         from backlog_items
         inner join projects
           on projects.id = backlog_items.project_id
         left join project_member_access
           on project_member_access.project_id = projects.id
          and project_member_access.member_user_id = $2
         where backlog_items.id = $1
           and backlog_items.is_archived = false
           and (
             projects.owner_user_id = $2
             or $2 = any(projects.member_user_ids)
           )
           and (
             backlog_items.parent_id is null
             or backlog_items.created_by_user_id = $2
             or backlog_items.archived_by_user_id = $2
             or projects.owner_user_id = $2
             or $3 in ('faculty', 'admin')
             or coalesce(project_member_access.can_create_sprint, false)
           )
         limit 1`,
        [id, ownerUserId, ownerUserRole]
      )

      const target = targetResult.rows[0]

      if (!target) {
        return []
      }

      const result = await getDb().query<BacklogRecord>(
        `update backlog_items
         set is_archived = true,
             archived_at = now(),
             archived_by_user_id = $2,
             updated_at = now()
         where id = $1
            or ($3::uuid is null and parent_id = $1)
         returning
           id,
           project_id,
           parent_id,
           sequence_number,
           order_index,
           created_by_user_id,
           archived_by_user_id,
           title,
           description,
           start_date,
           due_date,
           status,
           checked,
           assignee_id,
           is_archived,
           archived_at,
           created_at`,
        [id, ownerUserId, target.parent_id]
      )

      return result.rows.map(mapRecord)
    },
    async () => {
      const records = await readFileRecords()
      const targetRecord = records.find((record) => record.id === id)

      if (!targetRecord || targetRecord.is_archived) {
        return []
      }

      const canManageOthers = await canUserCreateSprintInProject(
        targetRecord.project_id,
        ownerUserId,
        ownerUserRole
      ).catch(() => ownerUserRole === "faculty" || ownerUserRole === "admin")
      const projectRecords = await listProjects(ownerUserId).catch(() => [])
      const isProjectMember = projectRecords.some(
        (projectRecord) => projectRecord.id === targetRecord.project_id
      )

      if (
        !isProjectMember ||
        (targetRecord.parent_id !== null &&
          targetRecord.created_by_user_id !== ownerUserId &&
          targetRecord.archived_by_user_id !== ownerUserId &&
          !canManageOthers)
      ) {
        return []
      }

      const archivedAt = new Date().toISOString()
      const updatedRecords = records.map((record) => {
        if (
          record.id === id ||
          (targetRecord.parent_id === null && record.parent_id === id)
        ) {
          return {
            ...record,
            is_archived: true,
            archived_at: archivedAt,
            archived_by_user_id: ownerUserId,
          }
        }

        return record
      })

      await writeFileRecords(updatedRecords)
      return updatedRecords
        .filter(
          (record) =>
            record.id === id ||
            (targetRecord.parent_id === null && record.parent_id === id)
        )
        .map(mapRecord)
    }
  )
}

export async function restoreBacklogItem(
  id: string,
  ownerUserId: string,
  ownerUserRole: "student" | "faculty" | "admin" = "student"
) {
  return withBacklogStore(
    async () => {
      const targetResult = await getDb().query<BacklogRecord>(
        `select backlog_items.*
         from backlog_items
         inner join projects
           on projects.id = backlog_items.project_id
         left join project_member_access
           on project_member_access.project_id = projects.id
          and project_member_access.member_user_id = $2
         where backlog_items.id = $1
           and backlog_items.is_archived = true
           and (
             projects.owner_user_id = $2
             or $2 = any(projects.member_user_ids)
           )
           and (
             backlog_items.parent_id is null
             or backlog_items.created_by_user_id = $2
             or projects.owner_user_id = $2
             or $3 in ('faculty', 'admin')
             or coalesce(project_member_access.can_create_sprint, false)
           )
         limit 1`,
        [id, ownerUserId, ownerUserRole]
      )

      const target = targetResult.rows[0]

      if (!target) {
        return []
      }

      const result = await getDb().query<BacklogRecord>(
        `update backlog_items
         set is_archived = false,
             archived_at = null,
             archived_by_user_id = null,
             updated_at = now()
         where id = $1
            or ($3::uuid is null and parent_id = $1)
         returning
           id,
           project_id,
           parent_id,
           sequence_number,
           order_index,
           created_by_user_id,
           archived_by_user_id,
           title,
           description,
           start_date,
           due_date,
           status,
           checked,
           assignee_id,
           is_archived,
           archived_at,
           created_at`,
        [id, ownerUserId, target.parent_id]
      )

      return result.rows.map(mapRecord)
    },
    async () => {
      const records = await readFileRecords()
      const targetRecord = records.find((record) => record.id === id)

      if (!targetRecord || !targetRecord.is_archived) {
        return []
      }

      const canManageOthers = await canUserCreateSprintInProject(
        targetRecord.project_id,
        ownerUserId,
        ownerUserRole
      ).catch(() => ownerUserRole === "faculty" || ownerUserRole === "admin")
      const projectRecords = await listProjects(ownerUserId).catch(() => [])
      const isProjectMember = projectRecords.some(
        (projectRecord) => projectRecord.id === targetRecord.project_id
      )

      if (
        !isProjectMember ||
        (targetRecord.parent_id !== null &&
          targetRecord.created_by_user_id !== ownerUserId &&
          !canManageOthers)
      ) {
        return []
      }

      const updatedRecords = records.map((record) => {
        if (
          record.id === id ||
          (targetRecord.parent_id === null && record.parent_id === id)
        ) {
          return {
            ...record,
            is_archived: false,
            archived_at: null,
            archived_by_user_id: null,
          }
        }

        return record
      })

      await writeFileRecords(updatedRecords)
      return updatedRecords
        .filter(
          (record) =>
            record.id === id ||
            (targetRecord.parent_id === null && record.parent_id === id)
        )
        .map(mapRecord)
    }
  )
}
