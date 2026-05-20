import { randomUUID } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

import { getPreferredStorageMode } from "@backend/config/storage-mode"
import { getDb } from "@backend/db/connection"
import {
  canUseLocalFileFallback,
  shouldFallbackToLocalStore,
} from "@backend/db/fallback"
import { ensureMicrosoftLoginSchema } from "@backend/repositories/users-repository"
import {
  archiveBacklogAttachmentsForItems,
  restoreBacklogAttachmentsForItems,
} from "@backend/repositories/attachments-repository"
import {
  canUserCreateSprintInProject,
  ensureProjectExists,
  listProjects,
} from "@backend/repositories/projects-repository"

export type BacklogRow = {
  id: string
  projectId: string
  parentId: string | null
  sequenceNumber: number
  orderIndex: number
  createdByUserId: string | null
  archivedByUserId: string | null
  deletedByUserId: string | null
  title: string
  description: string
  startDate: string | null
  dueDate: string | null
  status: string
  checked: boolean
  assigneeId: string | null
  priority: "Low" | "Medium" | "High"
  archived: boolean
  archivedAt: string | null
  deleted: boolean
  deletedAt: string | null
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
  priority?: "Low" | "Medium" | "High"
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
  priority?: "Low" | "Medium" | "High"
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
  deleted_by_user_id: string | null
  title: string
  description: string
  start_date: string | null
  due_date: string | null
  status: string
  checked: boolean
  assignee_id: string | null
  priority: "Low" | "Medium" | "High"
  is_archived: boolean
  archived_at: string | null
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
}

type BacklogRecordWithStats = BacklogRecord & {
  comment_count?: number | string | null
}

type ListBacklogItemsOptions = {
  archived?: boolean
  deleted?: boolean
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
  priority?: "Low" | "Medium" | "High" | null
  archivedByUserId?: string | null
  deletedByUserId?: string | null
  archived?: boolean
  archivedAt?: string | null
  deleted?: boolean
  deletedAt?: string | null
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
    archivedByUserId: record.archived_by_user_id ?? null,
    deletedByUserId: record.deleted_by_user_id ?? null,
    title: record.title,
    description: record.description,
    startDate: record.start_date,
    dueDate: record.due_date,
    status: record.status,
    checked: record.checked,
    assigneeId: record.assignee_id,
    priority: record.priority ?? "Medium",
    archived: record.is_archived ?? false,
    archivedAt: record.archived_at ?? null,
    deleted: record.is_deleted ?? false,
    deletedAt: record.deleted_at ?? null,
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
    deleted_by_user_id: input.deletedByUserId ?? null,
    title: input.title,
    description: input.description,
    start_date: input.startDate,
    due_date: input.dueDate,
    status: input.status,
    checked: input.checked,
    assignee_id: input.assigneeId,
    priority: input.priority,
    is_archived: input.archived,
    archived_at: input.archivedAt,
    is_deleted: input.deleted ?? false,
    deleted_at: input.deletedAt ?? null,
    created_at: input.createdAt,
  }
}

async function syncBacklogMirrorItems(backlogItemIds: string[]) {
  const normalizedIds = Array.from(
    new Set(backlogItemIds.map((id) => id.trim()).filter(Boolean))
  )

  if (normalizedIds.length === 0) {
    return
  }

  const db = getDb()
  const client = await db.connect()

  try {
    await client.query("begin")

    await client.query(
      `delete from subtasks
       where id::text = any($1::text[])
         and not exists (
           select 1
           from backlog
           where backlog.id = subtasks.id
             and backlog.parent_id is not null
         )`,
      [normalizedIds]
    )

    await client.query(
      `delete from tasks
       where id::text = any($1::text[])
         and not exists (
           select 1
           from backlog
           where backlog.id = tasks.id
             and backlog.parent_id is null
         )`,
      [normalizedIds]
    )

    await client.query(
      `insert into tasks (
         id,
         project_id,
         sequence_number,
         order_index,
         created_by_user_id,
         archived_by_user_id,
         deleted_by_user_id,
         title,
         description,
         start_date,
         due_date,
         status,
         checked,
         assignee_id,
         priority,
         is_archived,
         archived_at,
         is_deleted,
         deleted_at,
         created_at,
         updated_at
       )
       select
         backlog.id,
         backlog.project_id,
         backlog.sequence_number,
         backlog.order_index,
         backlog.created_by_user_id,
         backlog.archived_by_user_id,
         backlog.deleted_by_user_id,
         backlog.title,
         backlog.description,
         backlog.start_date,
         backlog.due_date,
         backlog.status,
         backlog.checked,
         backlog.assignee_id,
         backlog.priority,
         backlog.is_archived,
         backlog.archived_at,
         backlog.is_deleted,
         backlog.deleted_at,
         backlog.created_at,
         backlog.updated_at
       from backlog
       where backlog.id::text = any($1::text[])
         and backlog.parent_id is null
       on conflict (id) do update
       set project_id = excluded.project_id,
           sequence_number = excluded.sequence_number,
           order_index = excluded.order_index,
           created_by_user_id = excluded.created_by_user_id,
           archived_by_user_id = excluded.archived_by_user_id,
           deleted_by_user_id = excluded.deleted_by_user_id,
           title = excluded.title,
           description = excluded.description,
           start_date = excluded.start_date,
           due_date = excluded.due_date,
           status = excluded.status,
           checked = excluded.checked,
           assignee_id = excluded.assignee_id,
           priority = excluded.priority,
           is_archived = excluded.is_archived,
           archived_at = excluded.archived_at,
           is_deleted = excluded.is_deleted,
           deleted_at = excluded.deleted_at,
           created_at = excluded.created_at,
           updated_at = excluded.updated_at`,
      [normalizedIds]
    )

    await client.query(
      `insert into subtasks (
         id,
         task_id,
         project_id,
         sequence_number,
         order_index,
         created_by_user_id,
         archived_by_user_id,
         deleted_by_user_id,
         title,
         description,
         start_date,
         due_date,
         status,
         checked,
         assignee_id,
         priority,
         is_archived,
         archived_at,
         is_deleted,
         deleted_at,
         created_at,
         updated_at
       )
       select
         backlog.id,
         backlog.parent_id,
         backlog.project_id,
         backlog.sequence_number,
         backlog.order_index,
         backlog.created_by_user_id,
         backlog.archived_by_user_id,
         backlog.deleted_by_user_id,
         backlog.title,
         backlog.description,
         backlog.start_date,
         backlog.due_date,
         backlog.status,
         backlog.checked,
         backlog.assignee_id,
         backlog.priority,
         backlog.is_archived,
         backlog.archived_at,
         backlog.is_deleted,
         backlog.deleted_at,
         backlog.created_at,
         backlog.updated_at
       from backlog
       where backlog.id::text = any($1::text[])
         and backlog.parent_id is not null
       on conflict (id) do update
       set task_id = excluded.task_id,
           project_id = excluded.project_id,
           sequence_number = excluded.sequence_number,
           order_index = excluded.order_index,
           created_by_user_id = excluded.created_by_user_id,
           archived_by_user_id = excluded.archived_by_user_id,
           deleted_by_user_id = excluded.deleted_by_user_id,
           title = excluded.title,
           description = excluded.description,
           start_date = excluded.start_date,
           due_date = excluded.due_date,
           status = excluded.status,
           checked = excluded.checked,
           assignee_id = excluded.assignee_id,
           priority = excluded.priority,
           is_archived = excluded.is_archived,
           archived_at = excluded.archived_at,
           is_deleted = excluded.is_deleted,
           deleted_at = excluded.deleted_at,
           created_at = excluded.created_at,
           updated_at = excluded.updated_at`,
      [normalizedIds]
    )

    await client.query("commit")
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
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
  const deletedByUserId = readStringAlias(
    record,
    "deleted_by_user_id",
    "deletedByUserId"
  )
  const startDate = readStringAlias(record, "start_date", "startDate")
  const dueDate = readStringAlias(record, "due_date", "dueDate")
  const assigneeId = readStringAlias(record, "assignee_id", "assigneeId")
  const archivedAt = readStringAlias(record, "archived_at", "archivedAt")
  const deletedAt = readStringAlias(record, "deleted_at", "deletedAt")
  const createdAt = readStringAlias(record, "created_at", "createdAt")
  const isArchived = readBooleanAlias(record, "is_archived", "archived")
  const isDeleted = readBooleanAlias(record, "is_deleted", "deleted")
  const priority =
    record.priority === "Low" || record.priority === "Medium" || record.priority === "High"
      ? record.priority
      : "Medium"

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
    deleted_by_user_id: deletedByUserId,
    title: typeof record.title === "string" ? record.title : "",
    description: typeof record.description === "string" ? record.description : "",
    start_date: startDate,
    due_date: dueDate,
    status: typeof record.status === "string" ? record.status : "todo",
    checked: typeof record.checked === "boolean" ? record.checked : false,
    assignee_id: assigneeId,
    priority,
    is_archived: isArchived ?? false,
    archived_at: archivedAt,
    is_deleted: isDeleted ?? false,
    deleted_at: deletedAt,
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
          create table if not exists backlog (
          id uuid primary key,
          project_id uuid references projects(id) on delete cascade,
          parent_id uuid references backlog(id) on delete cascade,
          sequence_number integer,
          order_index integer,
          created_by_user_id text,
          archived_by_user_id text,
          deleted_by_user_id text,
          title text not null,
          description text not null default '',
          start_date date,
          due_date date,
          status text not null check (
            status in ('todo', 'inprogress', 'inreview', 'revision', 'completed')
          ),
          checked boolean not null default false,
          assignee_id text,
          priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High')),
          is_archived boolean not null default false,
          archived_at timestamptz,
          is_deleted boolean not null default false,
          deleted_at timestamptz,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
      `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog
          add column if not exists created_by_user_id text;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog
          add column if not exists archived_by_user_id text;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog
          add column if not exists deleted_by_user_id text;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog
          add column if not exists start_date date;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog
          add column if not exists due_date date;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog
          add column if not exists assignee_id text;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog
          add column if not exists priority text not null default 'Medium';
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog
          add column if not exists is_archived boolean not null default false;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog
          add column if not exists archived_at timestamptz;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog
          add column if not exists is_deleted boolean not null default false;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog
          add column if not exists deleted_at timestamptz;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog
          add column if not exists project_id uuid references projects(id) on delete cascade;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog
          add column if not exists parent_id uuid;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog
          add column if not exists sequence_number integer;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog
          add column if not exists order_index integer;
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists backlog_project_order_idx
          on backlog(project_id, order_index asc, created_at asc);
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists backlog_created_by_user_id_idx
          on backlog(created_by_user_id);
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists backlog_project_parent_idx
          on backlog(project_id, parent_id, sequence_number asc);
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists backlog_parent_id_idx
          on backlog(parent_id);
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists backlog_assignee_id_idx
          on backlog(assignee_id);
        `)
      )
      .then(() =>
        getDb().query(`
          create table if not exists tasks (
            id uuid primary key,
            project_id uuid references projects(id) on delete cascade,
            sequence_number integer,
            order_index integer,
            created_by_user_id text,
            archived_by_user_id text,
            deleted_by_user_id text,
            title text not null,
            description text not null default '',
            start_date date,
            due_date date,
            status text not null check (
              status in ('todo', 'inprogress', 'inreview', 'revision', 'completed')
            ),
            checked boolean not null default false,
            assignee_id text,
            priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High')),
            is_archived boolean not null default false,
            archived_at timestamptz,
            is_deleted boolean not null default false,
            deleted_at timestamptz,
            created_at timestamptz not null default now(),
            updated_at timestamptz not null default now()
          );

          create table if not exists subtasks (
            id uuid primary key,
            task_id uuid not null references tasks(id) on delete cascade,
            project_id uuid references projects(id) on delete cascade,
            sequence_number integer,
            order_index integer,
            created_by_user_id text,
            archived_by_user_id text,
            deleted_by_user_id text,
            title text not null,
            description text not null default '',
            start_date date,
            due_date date,
            status text not null check (
              status in ('todo', 'inprogress', 'inreview', 'revision', 'completed')
            ),
            checked boolean not null default false,
            assignee_id text,
            priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High')),
            is_archived boolean not null default false,
            archived_at timestamptz,
            is_deleted boolean not null default false,
            deleted_at timestamptz,
            created_at timestamptz not null default now(),
            updated_at timestamptz not null default now()
          );

          create index if not exists tasks_project_order_idx
            on tasks(project_id, order_index asc, created_at asc);

          create index if not exists tasks_assignee_id_idx
            on tasks(assignee_id);

          create index if not exists subtasks_task_id_idx
            on subtasks(task_id, sequence_number asc);

          create index if not exists subtasks_project_order_idx
            on subtasks(project_id, order_index asc, created_at asc);

          create index if not exists subtasks_assignee_id_idx
            on subtasks(assignee_id);
        `)
      )
      .then(() =>
        getDb().query(`
          create table if not exists comments (
            id uuid primary key,
            backlog_item_id uuid not null references backlog(id) on delete cascade,
            author_user_id text,
            author text not null,
            body text not null default '',
            attachments jsonb not null default '[]'::jsonb,
            constraint comments_check check (
              nullif(btrim(body), '') is not null
              or jsonb_array_length(attachments) > 0
            ),
            created_at timestamptz not null default now()
          );
        `)
      )
      .then(() =>
        getDb().query(`
          alter table comments
          add column if not exists backlog_item_id uuid;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table comments
          add column if not exists author_user_id text;
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists comments_backlog_item_id_idx
          on comments(backlog_item_id, created_at asc);
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists comments_author_user_id_idx
          on comments(author_user_id);
        `)
      )
      .then(() =>
        getDb().query(`
          delete from subtasks
          where not exists (
            select 1
            from backlog
            where backlog.id = subtasks.id
              and backlog.parent_id is not null
          );

          delete from tasks
          where not exists (
            select 1
            from backlog
            where backlog.id = tasks.id
              and backlog.parent_id is null
          );

          insert into tasks (
            id,
            project_id,
            sequence_number,
            order_index,
            created_by_user_id,
            archived_by_user_id,
            deleted_by_user_id,
            title,
            description,
            start_date,
            due_date,
            status,
            checked,
            assignee_id,
            priority,
            is_archived,
            archived_at,
            is_deleted,
            deleted_at,
            created_at,
            updated_at
          )
          select
            backlog.id,
            backlog.project_id,
            backlog.sequence_number,
            backlog.order_index,
            backlog.created_by_user_id,
            backlog.archived_by_user_id,
            backlog.deleted_by_user_id,
            backlog.title,
            backlog.description,
            backlog.start_date,
            backlog.due_date,
            backlog.status,
            backlog.checked,
            backlog.assignee_id,
            backlog.priority,
            backlog.is_archived,
            backlog.archived_at,
            backlog.is_deleted,
            backlog.deleted_at,
            backlog.created_at,
            backlog.updated_at
          from backlog
          where backlog.parent_id is null
          on conflict (id) do update
          set project_id = excluded.project_id,
              sequence_number = excluded.sequence_number,
              order_index = excluded.order_index,
              created_by_user_id = excluded.created_by_user_id,
              archived_by_user_id = excluded.archived_by_user_id,
              deleted_by_user_id = excluded.deleted_by_user_id,
              title = excluded.title,
              description = excluded.description,
              start_date = excluded.start_date,
              due_date = excluded.due_date,
              status = excluded.status,
              checked = excluded.checked,
              assignee_id = excluded.assignee_id,
              priority = excluded.priority,
              is_archived = excluded.is_archived,
              archived_at = excluded.archived_at,
              is_deleted = excluded.is_deleted,
              deleted_at = excluded.deleted_at,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at;

          insert into subtasks (
            id,
            task_id,
            project_id,
            sequence_number,
            order_index,
            created_by_user_id,
            archived_by_user_id,
            deleted_by_user_id,
            title,
            description,
            start_date,
            due_date,
            status,
            checked,
            assignee_id,
            priority,
            is_archived,
            archived_at,
            is_deleted,
            deleted_at,
            created_at,
            updated_at
          )
          select
            backlog.id,
            backlog.parent_id,
            backlog.project_id,
            backlog.sequence_number,
            backlog.order_index,
            backlog.created_by_user_id,
            backlog.archived_by_user_id,
            backlog.deleted_by_user_id,
            backlog.title,
            backlog.description,
            backlog.start_date,
            backlog.due_date,
            backlog.status,
            backlog.checked,
            backlog.assignee_id,
            backlog.priority,
            backlog.is_archived,
            backlog.archived_at,
            backlog.is_deleted,
            backlog.deleted_at,
            backlog.created_at,
            backlog.updated_at
          from backlog
          where backlog.parent_id is not null
          on conflict (id) do update
          set task_id = excluded.task_id,
              project_id = excluded.project_id,
              sequence_number = excluded.sequence_number,
              order_index = excluded.order_index,
              created_by_user_id = excluded.created_by_user_id,
              archived_by_user_id = excluded.archived_by_user_id,
              deleted_by_user_id = excluded.deleted_by_user_id,
              title = excluded.title,
              description = excluded.description,
              start_date = excluded.start_date,
              due_date = excluded.due_date,
              status = excluded.status,
              checked = excluded.checked,
              assignee_id = excluded.assignee_id,
              priority = excluded.priority,
              is_archived = excluded.is_archived,
              archived_at = excluded.archived_at,
              is_deleted = excluded.is_deleted,
              deleted_at = excluded.deleted_at,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at;
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
            from backlog
          )
          update backlog
          set sequence_number = numbered_items.next_sequence_number
          from numbered_items
          where backlog.id = numbered_items.id
            and backlog.sequence_number is null;
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
            from backlog
          )
          update backlog
          set order_index = ordered_items.next_order_index
          from ordered_items
          where backlog.id = ordered_items.id
            and backlog.order_index is null;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog
          alter column sequence_number set not null;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table backlog
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
              where conname = 'fk_backlog_parent_id'
            ) then
              alter table backlog
              add constraint fk_backlog_parent_id
              foreign key (parent_id) references backlog(id) on delete cascade;
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
              where conname = 'fk_backlog_assignee_id'
            ) then
              alter table backlog
              add constraint fk_backlog_assignee_id
              foreign key (assignee_id) references users(microsoft_user_id)
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
      const deleted = options.deleted === true
      const limit = Math.max(1, Math.min(options.limit ?? 200, 500))
      const offset = Math.max(0, options.offset ?? 0)
      const result = await getDb().query<BacklogRecordWithStats>(
        `select
          backlog.id,
          backlog.project_id,
          backlog.parent_id,
          backlog.sequence_number,
          backlog.order_index,
          backlog.created_by_user_id,
          backlog.archived_by_user_id,
          backlog.deleted_by_user_id,
          backlog.deleted_by_user_id,
          backlog.title,
          backlog.description,
          backlog.start_date,
          backlog.due_date,
          backlog.status,
          backlog.checked,
          backlog.assignee_id,
          backlog.priority,
          backlog.is_archived,
          backlog.archived_at,
          backlog.is_deleted,
          backlog.deleted_at,
          backlog.is_deleted,
          backlog.deleted_at,
          backlog.created_at,
          coalesce(comment_counts.comment_count, 0) as comment_count
        from backlog
        inner join projects
          on projects.id = backlog.project_id
        left join (
          select
            comments.backlog_item_id,
            count(*)::int as comment_count
          from comments
          inner join backlog as scoped_items
            on scoped_items.id = comments.backlog_item_id
          where scoped_items.project_id = $1
          group by comments.backlog_item_id
        ) as comment_counts
          on comment_counts.backlog_item_id = backlog.id
        where backlog.project_id = $1
          and backlog.is_archived = $3
          and backlog.is_deleted = $6
          and (
            projects.owner_user_id = $2
            or $2 = any(projects.member_user_ids)
          )
        order by backlog.order_index asc, backlog.created_at asc
        limit $4
        offset $5`,
        [projectId, ownerUserId, archived, limit, offset, deleted]
      )

      return result.rows.map(mapRecord)
    },
    async () => {
      const archived = options.archived === true
      const deleted = options.deleted === true
      const records = await readFileRecords()
      return records
        .filter(
          (record) =>
            record.project_id === projectId &&
            record.is_archived === archived &&
            record.is_deleted === deleted
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
          backlog.id,
          backlog.project_id,
          backlog.parent_id,
          backlog.sequence_number,
          backlog.order_index,
          backlog.created_by_user_id,
          backlog.archived_by_user_id,
          backlog.title,
          backlog.description,
          backlog.start_date,
          backlog.due_date,
          backlog.status,
          backlog.checked,
          backlog.assignee_id,
          backlog.priority,
          backlog.is_archived,
          backlog.archived_at,
          backlog.created_at,
          coalesce(comment_counts.comment_count, 0) as comment_count,
          projects.project_name,
          projects.project_type,
          projects.project_member
        from backlog
        inner join projects
          on projects.id = backlog.project_id
        left join (
          select
            comments.backlog_item_id,
            count(*)::int as comment_count
          from comments
          group by comments.backlog_item_id
        ) as comment_counts
          on comment_counts.backlog_item_id = backlog.id
        where backlog.project_id = any($1::uuid[])
          and backlog.is_archived = false
          and backlog.is_deleted = false
          and (
            projects.owner_user_id = $2
            or $2 = any(projects.member_user_ids)
          )
        order by backlog.created_at desc`,
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
        .filter((record) => projectIds.includes(record.project_id) && !record.is_deleted)
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
        `select backlog.id
         from backlog
         inner join projects
           on projects.id = backlog.project_id
         where backlog.project_id = $1
           and (
             ($2::uuid is null and backlog.parent_id is null)
             or backlog.parent_id = $2::uuid
           )
           and lower(regexp_replace(btrim(backlog.title), '\\s+', ' ', 'g')) = $3
           and backlog.is_archived = false
           and backlog.is_deleted = false
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
          from backlog
          where project_id = $2
        ), next_order as (
          select coalesce(max(order_index), 0) + 1 as value
          from backlog
          where project_id = $2
        )
        insert into backlog (
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
          priority
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
          $11,
          $12
        from next_sequence, next_order, projects
        where projects.id = $2
          and (
            projects.owner_user_id = $13
            or $13 = any(projects.member_user_ids)
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
          priority,
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
          input.priority ?? "Medium",
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
          `update backlog
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
            priority,
            created_at`,
          [input.parentId, createdRecord.id]
        )

        if (repaired.rows[0]) {
          createdRecord = mapRecord(repaired.rows[0])
        }
      }

      await syncBacklogMirrorItems([createdRecord.id])

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
        deletedByUserId: null,
        title: normalizedTitle,
        description: input.description,
        startDate: input.startDate,
        dueDate: input.dueDate,
        status: input.status,
        checked: input.checked,
        assigneeId: input.assigneeId,
        priority: input.priority ?? "Medium",
        archived: false,
        archivedAt: null,
        deleted: false,
        deletedAt: null,
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

      if (input.priority === "Low" || input.priority === "Medium" || input.priority === "High") {
        fields.push(`priority = $${fields.length + 1}`)
        values.push(input.priority)
      }

      if (typeof input.orderIndex === "number" && Number.isFinite(input.orderIndex)) {
        fields.push(`order_index = $${fields.length + 1}`)
        values.push(input.orderIndex)
      }

      if (fields.length === 0) {
        return null
      }

      if (typeof input.title === "string" || "parentId" in input) {
        const currentResult = await getDb().query<BacklogRecord>(
          `select backlog.*
           from backlog
           inner join projects
             on projects.id = backlog.project_id
           where backlog.id = $1
             and (
               projects.owner_user_id = $2
               or $2 = any(projects.member_user_ids)
             )
           limit 1`,
          [id, ownerUserId]
        )
        const currentRecord = currentResult.rows[0]

        if (currentRecord) {
          const nextParentId =
            "parentId" in input ? input.parentId ?? null : currentRecord.parent_id
          const nextTitle =
            typeof input.title === "string" ? input.title : currentRecord.title
          const normalizedComparableTitle = normalizeItemNameForComparison(nextTitle)
          const duplicateType = nextParentId ? "subtask" : "task"
          const duplicateResult = await getDb().query<{ id: string }>(
            `select id
             from backlog
             where project_id = $1
               and id <> $2
               and is_archived = false
               and is_deleted = false
               and (
                 ($3::uuid is null and parent_id is null)
                 or parent_id = $3::uuid
               )
               and lower(regexp_replace(btrim(title), '\\s+', ' ', 'g')) = $4
             limit 1`,
            [
              currentRecord.project_id,
              id,
              nextParentId,
              normalizedComparableTitle,
            ]
          )

          if ((duplicateResult.rowCount ?? 0) > 0) {
            throw new BacklogItemNameConflictError(nextTitle, duplicateType)
          }
        }
      }

      fields.push(`updated_at = now()`)
      values.push(id)

      const result = await getDb().query<BacklogRecord>(
        `update backlog
        set ${fields.join(", ")}
        from projects
        where backlog.id = $${values.length}
          and projects.id = backlog.project_id
          and (
            projects.owner_user_id = $${values.length + 1}
            or $${values.length + 1} = any(projects.member_user_ids)
          )
        returning
          backlog.id,
          backlog.project_id,
          backlog.parent_id,
          backlog.sequence_number,
          backlog.order_index,
          backlog.created_by_user_id,
          backlog.title,
          backlog.description,
          backlog.start_date,
          backlog.due_date,
          backlog.status,
          backlog.checked,
          backlog.assignee_id,
          backlog.priority,
          backlog.created_at`,
        [...values, ownerUserId]
      )

      if (result.rows[0]) {
        await syncBacklogMirrorItems([result.rows[0].id])
      }

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
        priority: input.priority ?? current.priority,
        orderIndex:
          typeof input.orderIndex === "number" && Number.isFinite(input.orderIndex)
            ? input.orderIndex
            : current.orderIndex,
      }
      const shouldCheckDuplicate =
        typeof input.title === "string" || "parentId" in input

      if (shouldCheckDuplicate) {
        const normalizedComparableTitle = normalizeItemNameForComparison(next.title)
        const duplicateRecord = records.find(
          (record) =>
            record.id !== id &&
            record.project_id === next.projectId &&
            record.is_archived === false &&
            record.parent_id === next.parentId &&
            normalizeItemNameForComparison(record.title) === normalizedComparableTitle
        )

        if (duplicateRecord) {
          throw new BacklogItemNameConflictError(
            next.title,
            next.parentId ? "subtask" : "task"
          )
        }
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
        `update backlog
        set is_deleted = true,
            deleted_at = now(),
            deleted_by_user_id = $2,
            updated_at = now()
        from projects
        where (backlog.id = $1 or backlog.parent_id = $1)
          and projects.id = backlog.project_id
          and backlog.is_deleted = false
          and (
            projects.owner_user_id = $2
            or $2 = any(projects.member_user_ids)
          )
          and (
            backlog.created_by_user_id = $2
            or projects.owner_user_id = $2
            or $3 in ('faculty', 'admin')
            or $2 = any(projects.sprint_creator_user_ids)
          )
        returning backlog.id`,
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
        !isProjectMember ||
        (targetRecord.created_by_user_id !== ownerUserId && !canManageOthers)
      ) {
        return false
      }

      let changed = false
      const deletedAt = new Date().toISOString()
      const nextRecords = records.map((record) => {
        if ((record.id !== id && record.parent_id !== id) || record.is_deleted) {
          return record
        }

        changed = true
        return {
          ...record,
          is_deleted: true,
          deleted_at: deletedAt,
          deleted_by_user_id: ownerUserId,
        }
      })

      if (!changed) {
        return false
      }

      await writeFileRecords(nextRecords)
      return true
    }
  )
}

export async function restoreDeletedBacklogItem(
  id: string,
  ownerUserId: string,
  ownerUserRole: "student" | "faculty" | "admin" = "student"
) {
  return withBacklogStore(
    async () => {
      const result = await getDb().query<{ id: string }>(
        `update backlog
        set is_deleted = false,
            deleted_at = null,
            deleted_by_user_id = null,
            updated_at = now()
        from projects
        where (backlog.id = $1 or backlog.parent_id = $1)
          and projects.id = backlog.project_id
          and backlog.is_deleted = true
          and (
            projects.owner_user_id = $2
            or $2 = any(projects.member_user_ids)
          )
          and (
            backlog.deleted_by_user_id = $2
            or projects.owner_user_id = $2
            or $3 in ('faculty', 'admin')
            or $2 = any(projects.sprint_creator_user_ids)
          )
        returning backlog.id`,
        [id, ownerUserId, ownerUserRole]
      )

      return (result.rowCount ?? 0) > 0
    },
    async () => {
      const records = await readFileRecords()
      const targetRecord = records.find((record) => record.id === id)

      if (!targetRecord || !targetRecord.is_deleted) {
        return false
      }

      const canManageOthers = await canUserCreateSprintInProject(
        targetRecord.project_id,
        ownerUserId,
        ownerUserRole
      ).catch(() => ownerUserRole === "faculty" || ownerUserRole === "admin")

      if (targetRecord.deleted_by_user_id !== ownerUserId && !canManageOthers) {
        return false
      }

      let changed = false
      const nextRecords = records.map((record) => {
        if ((record.id !== id && record.parent_id !== id) || !record.is_deleted) {
          return record
        }

        changed = true
        return {
          ...record,
          is_deleted: false,
          deleted_at: null,
          deleted_by_user_id: null,
        }
      })

      if (!changed) {
        return false
      }

      await writeFileRecords(nextRecords)
      return true
    }
  )
}

export async function permanentlyDeleteBacklogItem(
  id: string,
  ownerUserId: string,
  ownerUserRole: "student" | "faculty" | "admin" = "student"
) {
  return withBacklogStore(
    async () => {
      const result = await getDb().query<{ id: string }>(
        `delete from backlog
        using projects
        where (backlog.id = $1 or backlog.parent_id = $1)
          and projects.id = backlog.project_id
          and backlog.is_deleted = true
          and (
            projects.owner_user_id = $2
            or $2 = any(projects.member_user_ids)
          )
          and (
            backlog.deleted_by_user_id = $2
            or projects.owner_user_id = $2
            or $3 in ('faculty', 'admin')
            or $2 = any(projects.sprint_creator_user_ids)
          )
        returning backlog.id`,
        [id, ownerUserId, ownerUserRole]
      )

      return (result.rowCount ?? 0) > 0
    },
    async () => {
      const records = await readFileRecords()
      const targetRecord = records.find((record) => record.id === id)

      if (!targetRecord || !targetRecord.is_deleted) {
        return false
      }

      const canManageOthers = await canUserCreateSprintInProject(
        targetRecord.project_id,
        ownerUserId,
        ownerUserRole
      ).catch(() => ownerUserRole === "faculty" || ownerUserRole === "admin")

      if (targetRecord.deleted_by_user_id !== ownerUserId && !canManageOthers) {
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
        `select backlog.*
         from backlog
         inner join projects
           on projects.id = backlog.project_id
         where backlog.id = $1
          and backlog.is_archived = false
           and backlog.is_deleted = false
           and (
             projects.owner_user_id = $2
             or $2 = any(projects.member_user_ids)
           )
           and (
             backlog.created_by_user_id = $2
             or projects.owner_user_id = $2
             or $3 in ('faculty', 'admin')
             or $2 = any(projects.sprint_creator_user_ids)
           )
         limit 1`,
        [id, ownerUserId, ownerUserRole]
      )

      const target = targetResult.rows[0]

      if (!target) {
        return []
      }

      const result = await getDb().query<BacklogRecord>(
        `update backlog
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
           priority,
           is_archived,
           archived_at,
           created_at`,
        [id, ownerUserId, target.parent_id]
      )

      const archivedItems = result.rows.map(mapRecord)
      await archiveBacklogAttachmentsForItems(
        archivedItems.map((item) => item.id),
        ownerUserId
      ).catch((error) => {
        console.error("Failed to archive contained backlog attachments", error)
      })

      return archivedItems
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
        (targetRecord.created_by_user_id !== ownerUserId && !canManageOthers)
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
      const archivedItems = updatedRecords
        .filter(
          (record) =>
            record.id === id ||
            (targetRecord.parent_id === null && record.parent_id === id)
        )
        .map(mapRecord)
      await archiveBacklogAttachmentsForItems(
        archivedItems.map((item) => item.id),
        ownerUserId
      ).catch((error) => {
        console.error("Failed to archive contained backlog attachments", error)
      })

      return archivedItems
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
        `select backlog.*
         from backlog
         inner join projects
           on projects.id = backlog.project_id
         where backlog.id = $1
          and backlog.is_archived = true
           and backlog.is_deleted = false
           and (
             projects.owner_user_id = $2
             or $2 = any(projects.member_user_ids)
           )
           and (
             backlog.parent_id is null
             or backlog.created_by_user_id = $2
             or projects.owner_user_id = $2
             or $3 in ('faculty', 'admin')
             or $2 = any(projects.sprint_creator_user_ids)
           )
         limit 1`,
        [id, ownerUserId, ownerUserRole]
      )

      const target = targetResult.rows[0]

      if (!target) {
        return []
      }

      const result = await getDb().query<BacklogRecord>(
        `update backlog
         set is_archived = false,
             archived_at = null,
             archived_by_user_id = null,
             updated_at = now()
         where id = $1
            or ($2::boolean and parent_id = $1)
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
           priority,
           is_archived,
           archived_at,
           created_at`,
        [id, target.parent_id === null]
      )

      const restoredItems = result.rows.map(mapRecord)
      await restoreBacklogAttachmentsForItems(restoredItems.map((item) => item.id)).catch((error) => {
        console.error("Failed to restore contained backlog attachments", error)
      })

      return restoredItems
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
      const restoredItems = updatedRecords
        .filter(
          (record) =>
            record.id === id ||
            (targetRecord.parent_id === null && record.parent_id === id)
        )
        .map(mapRecord)
      await restoreBacklogAttachmentsForItems(restoredItems.map((item) => item.id)).catch((error) => {
        console.error("Failed to restore contained backlog attachments", error)
      })

      return restoredItems
    }
  )
}
