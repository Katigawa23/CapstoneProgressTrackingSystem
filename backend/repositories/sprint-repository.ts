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
import { ensureProjectExists } from "@backend/repositories/project-repository"

export type SprintRow = {
  id: string
  projectId: string
  sequenceNumber: number
  name: string
  duration: string
  startDate: string
  endDate: string
  description: string
  backlogItemIds: string[]
  createdByUserId: string
  createdAt: string
  archived: boolean
  archivedAt: string | null
  archivedByUserId: string
  deleted: boolean
  deletedAt: string | null
  deletedByUserId: string
}

type SprintRecord = {
  id: string
  project_id: string
  sequence_number: number
  name: string
  duration: string
  start_date: string
  end_date: string
  description: string
  created_by_user_id: string
  created_at: string
  is_archived?: boolean | null
  archived_at?: string | null
  archived_by_user_id?: string | null
  is_deleted?: boolean | null
  deleted_at?: string | null
  deleted_by_user_id?: string | null
}

type SprintRecordWithItems = SprintRecord & {
  backlog_item_ids?: string[] | null
}

type RawSprintRecord = Partial<SprintRecord> & {
  projectId?: string
  sequenceNumber?: number
  startDate?: string
  endDate?: string
  backlogItemIds?: string[]
  createdByUserId?: string
  createdAt?: string
  archived?: boolean
  archivedAt?: string | null
  archivedByUserId?: string | null
  deleted?: boolean
  deletedAt?: string | null
  deletedByUserId?: string | null
}

type CreateSprintInput = {
  projectId: string
  name: string
  duration: string
  startDate: string
  endDate: string
  description: string
  backlogItemIds: string[]
}

type UpdateSprintInput = {
  id: string
  projectId: string
  name: string
  duration: string
  startDate: string
  endDate: string
  description: string
}

type SprintActionRole = "student" | "faculty" | "admin"

type SprintStorageMode = "database" | "file"

const sprintsFilePath = path.join(process.cwd(), ".data", "sprints.json")
const backlogFilePath = path.join(process.cwd(), ".data", "backlog-items.json")

let schemaReady: Promise<void> | null = null
let storageModePromise: Promise<SprintStorageMode> | null = null
let fallbackWarningShown = false

export class SprintNameConflictError extends Error {
  constructor(sprintName: string) {
    super(`Sprint "${sprintName}" already exists.`)
    this.name = "SprintNameConflictError"
  }
}

type RawBacklogRecord = {
  id?: string
  status?: string | null
  checked?: boolean | null
}

function normalizeSprintNameForComparison(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase()
}

function normalizeSprintRecord(record: RawSprintRecord): SprintRow {
  return {
    id: typeof record.id === "string" ? record.id : randomUUID(),
    projectId:
      typeof record.project_id === "string"
        ? record.project_id
        : typeof record.projectId === "string"
        ? record.projectId
        : "",
    sequenceNumber:
      typeof record.sequence_number === "number" && Number.isFinite(record.sequence_number)
        ? record.sequence_number
        : typeof record.sequenceNumber === "number" && Number.isFinite(record.sequenceNumber)
        ? record.sequenceNumber
        : 0,
    name: typeof record.name === "string" ? record.name : "",
    duration: typeof record.duration === "string" ? record.duration : "",
    startDate:
      typeof record.start_date === "string"
        ? record.start_date
        : typeof record.startDate === "string"
        ? record.startDate
        : "",
    endDate:
      typeof record.end_date === "string"
        ? record.end_date
        : typeof record.endDate === "string"
        ? record.endDate
        : "",
    description: typeof record.description === "string" ? record.description : "",
    backlogItemIds: Array.isArray(record.backlogItemIds)
      ? record.backlogItemIds.filter((value): value is string => typeof value === "string")
      : [],
    createdByUserId:
      typeof record.created_by_user_id === "string"
        ? record.created_by_user_id
        : typeof record.createdByUserId === "string"
        ? record.createdByUserId
        : "",
    createdAt:
      typeof record.created_at === "string"
        ? record.created_at
        : typeof record.createdAt === "string"
        ? record.createdAt
        : new Date().toISOString(),
    archived:
      typeof record.is_archived === "boolean"
        ? record.is_archived
        : record.archived === true,
    archivedAt:
      typeof record.archived_at === "string"
        ? record.archived_at
        : typeof record.archivedAt === "string"
        ? record.archivedAt
        : null,
    archivedByUserId:
      typeof record.archived_by_user_id === "string"
        ? record.archived_by_user_id
        : typeof record.archivedByUserId === "string"
        ? record.archivedByUserId
        : "",
    deleted:
      typeof record.is_deleted === "boolean"
        ? record.is_deleted
        : record.deleted === true,
    deletedAt:
      typeof record.deleted_at === "string"
        ? record.deleted_at
        : typeof record.deletedAt === "string"
        ? record.deletedAt
        : null,
    deletedByUserId:
      typeof record.deleted_by_user_id === "string"
        ? record.deleted_by_user_id
        : typeof record.deletedByUserId === "string"
        ? record.deletedByUserId
        : "",
  }
}

function mapRecord(record: SprintRecordWithItems): SprintRow {
  return {
    id: record.id,
    projectId: record.project_id,
    sequenceNumber: record.sequence_number,
    name: record.name,
    duration: record.duration,
    startDate: record.start_date,
    endDate: record.end_date,
    description: record.description,
    backlogItemIds: Array.isArray(record.backlog_item_ids)
      ? record.backlog_item_ids.filter((value): value is string => typeof value === "string")
      : [],
    createdByUserId: record.created_by_user_id,
    createdAt: record.created_at,
    archived: record.is_archived === true,
    archivedAt: record.archived_at ?? null,
    archivedByUserId: record.archived_by_user_id ?? "",
    deleted: record.is_deleted === true,
    deletedAt: record.deleted_at ?? null,
    deletedByUserId: record.deleted_by_user_id ?? "",
  }
}

function normalizeSprintSequenceNumbers(records: SprintRow[]) {
  const recordsByProject = new Map<string, SprintRow[]>()

  for (const record of records) {
    const projectRecords = recordsByProject.get(record.projectId) ?? []
    projectRecords.push(record)
    recordsByProject.set(record.projectId, projectRecords)
  }

  return Array.from(recordsByProject.values()).flatMap((projectRecords) => {
    const sortedRecords = [...projectRecords].sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
    )
    const usedSequenceNumbers = new Set<number>()
    let nextSequenceNumber = 1

    return sortedRecords.map((record) => {
      const candidateSequenceNumber = record.sequenceNumber

      if (
        Number.isInteger(candidateSequenceNumber) &&
        candidateSequenceNumber > 0 &&
        !usedSequenceNumbers.has(candidateSequenceNumber)
      ) {
        usedSequenceNumbers.add(candidateSequenceNumber)
        nextSequenceNumber = Math.max(nextSequenceNumber, candidateSequenceNumber + 1)
        return record
      }

      const normalizedRecord = {
        ...record,
        sequenceNumber: nextSequenceNumber,
      }

      usedSequenceNumbers.add(nextSequenceNumber)
      nextSequenceNumber += 1

      return normalizedRecord
    })
  })
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

  console.warn(`Sprint storage is using local file data: ${message}`)
}

async function ensureSprintSchema() {
  if (!schemaReady) {
    schemaReady = ensureMicrosoftLoginSchema()
      .then(() =>
        getDb().query(`
        create table if not exists sprints (
          id uuid primary key,
          project_id uuid not null references projects(id) on delete cascade,
          name text not null,
          sequence_number integer not null default 0,
          duration text not null default '',
          start_date date not null,
          end_date date not null,
          description text not null default '',
          created_by_user_id text not null default '',
          is_archived boolean not null default false,
          archived_at timestamptz,
          archived_by_user_id text,
          is_deleted boolean not null default false,
          deleted_at timestamptz,
          deleted_by_user_id text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
      `)
      )
      .then(() =>
        getDb().query(`
          alter table sprints
          add column if not exists duration text not null default '';
        `)
      )
      .then(() =>
        getDb().query(`
          alter table sprints
          add column if not exists sequence_number integer not null default 0;
        `)
      )
      .then(() =>
        getDb().query(`
          with ranked_sprints as (
            select
              id,
              row_number() over (
                partition by project_id
                order by created_at asc, id asc
              ) as next_sequence_number
            from sprints
          )
          update sprints
          set sequence_number = ranked_sprints.next_sequence_number
          from ranked_sprints
          where sprints.id = ranked_sprints.id
            and sprints.sequence_number = 0;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table sprints
          add column if not exists description text not null default '';
        `)
      )
      .then(() =>
        getDb().query(`
          alter table sprints
          add column if not exists created_by_user_id text not null default '';
        `)
      )
      .then(() =>
        getDb().query(`
          alter table sprints
          add column if not exists is_archived boolean not null default false,
          add column if not exists archived_at timestamptz,
          add column if not exists archived_by_user_id text,
          add column if not exists is_deleted boolean not null default false,
          add column if not exists deleted_at timestamptz,
          add column if not exists deleted_by_user_id text;
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists sprints_project_created_at_idx
          on sprints(project_id, created_at desc);
        `)
      )
      .then(() =>
        getDb().query(`
          create unique index if not exists sprints_project_sequence_number_idx
          on sprints(project_id, sequence_number);
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists sprints_created_by_user_id_idx
          on sprints(created_by_user_id);
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists sprints_project_active_idx
          on sprints(project_id, created_at desc)
          where is_archived = false and is_deleted = false;
        `)
      )
      .then(() =>
        getDb().query(`
          do $$
          begin
            if not exists (
              select 1
              from pg_constraint
              where conname = 'fk_sprints_created_by_user_id'
            ) then
              alter table sprints
              add constraint fk_sprints_created_by_user_id
              foreign key (created_by_user_id) references microsoft_account_logins(microsoft_user_id)
              on delete restrict;
            end if;
          end $$;
        `)
      )
      .then(() =>
        getDb().query(`
          create table if not exists sprint_backlog_items (
            sprint_id uuid not null references sprints(id) on delete cascade,
            backlog_item_id uuid not null references backlog_items(id) on delete cascade,
            created_at timestamptz not null default now(),
            primary key (sprint_id, backlog_item_id)
          );
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists sprint_backlog_items_backlog_item_id_idx
          on sprint_backlog_items(backlog_item_id);
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

async function getStorageMode(): Promise<SprintStorageMode> {
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
        await ensureSprintSchema()
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

async function withSprintStore<T>(
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
    const raw = await readFile(sprintsFilePath, "utf8")
    const parsed = JSON.parse(raw) as RawSprintRecord[]
    return normalizeSprintSequenceNumbers(parsed.map(normalizeSprintRecord))
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

async function writeFileRecords(records: SprintRow[]) {
  await mkdir(path.dirname(sprintsFilePath), { recursive: true })
  await writeFile(sprintsFilePath, JSON.stringify(records, null, 2), "utf8")
}

async function resetBacklogStatusesInFile(backlogItemIds: string[]) {
  if (backlogItemIds.length === 0) {
    return
  }

  try {
    const raw = await readFile(backlogFilePath, "utf8")
    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return
    }

    const targetIds = new Set(backlogItemIds)
    let hasChanges = false
    const nextRecords = parsed.map((record) => {
      if (
        !record ||
        typeof record !== "object" ||
        !("id" in record) ||
        typeof (record as RawBacklogRecord).id !== "string" ||
        !targetIds.has((record as RawBacklogRecord).id as string)
      ) {
        return record
      }

      hasChanges = true
      return {
        ...record,
        status: "todo",
        checked: false,
      }
    })

    if (hasChanges) {
      await mkdir(path.dirname(backlogFilePath), { recursive: true })
      await writeFile(backlogFilePath, JSON.stringify(nextRecords, null, 2), "utf8")
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error
    }
  }
}

export async function listSprints(projectId: string, ownerUserId: string) {
  return withSprintStore(
    async () => {
      await ensureProjectExists(projectId, ownerUserId)

      const result = await getDb().query<SprintRecordWithItems>(
        `select
          sprints.id,
          sprints.project_id,
          sprints.sequence_number,
          sprints.name,
          sprints.duration,
          sprints.start_date::text,
          sprints.end_date::text,
          sprints.description,
          sprints.created_by_user_id,
          sprints.created_at,
          sprints.is_archived,
          sprints.archived_at,
          sprints.archived_by_user_id,
          sprints.is_deleted,
          sprints.deleted_at,
          sprints.deleted_by_user_id,
          coalesce(
            array_agg(sprint_backlog_items.backlog_item_id order by sprint_backlog_items.created_at)
              filter (where sprint_backlog_items.backlog_item_id is not null),
            '{}'::uuid[]
          )::text[] as backlog_item_ids
        from sprints
        inner join projects
          on projects.id = sprints.project_id
        left join sprint_backlog_items
          on sprint_backlog_items.sprint_id = sprints.id
        where sprints.project_id = $1
          and sprints.is_archived = false
          and sprints.is_deleted = false
          and (
            projects.owner_user_id = $2
            or $2 = any(projects.member_user_ids)
          )
        group by sprints.id
        order by sprints.created_at desc`,
        [projectId, ownerUserId]
      )

      return result.rows.map(mapRecord)
    },
    async () => {
      const records = await readFileRecords()
      return records
        .filter((record) => record.projectId === projectId && !record.archived && !record.deleted)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    }
  )
}

export async function createSprint(input: CreateSprintInput, ownerUserId: string) {
  return withSprintStore(
    async () => {
      await ensureProjectExists(input.projectId, ownerUserId)
      const normalizedComparableName = normalizeSprintNameForComparison(input.name)
      const duplicateResult = await getDb().query<{ id: string }>(
        `select sprints.id
         from sprints
         inner join projects
           on projects.id = sprints.project_id
         where sprints.project_id = $1
           and lower(regexp_replace(btrim(sprints.name), '\s+', ' ', 'g')) = $2
           and sprints.is_archived = false
           and sprints.is_deleted = false
           and (
             projects.owner_user_id = $3
             or $3 = any(projects.member_user_ids)
           )
         limit 1`,
        [input.projectId, normalizedComparableName, ownerUserId]
      )

      if ((duplicateResult.rowCount ?? 0) > 0) {
        throw new SprintNameConflictError(input.name)
      }

      const sprintId = randomUUID()
      const backlogItemIds = Array.from(
        new Set(
          input.backlogItemIds
            .map((value) => value.trim())
            .filter(Boolean)
        )
      )
      const client = await getDb().connect()

      try {
        await client.query("begin")
        await client.query(
          `select id
          from projects
          where id = $1
          for update`,
          [input.projectId]
        )
        const sequenceResult = await client.query<{ next_sequence_number: number }>(
          `select coalesce(max(sequence_number), 0) + 1 as next_sequence_number
          from sprints
          where project_id = $1`,
          [input.projectId]
        )
        const nextSequenceNumber = sequenceResult.rows[0]?.next_sequence_number ?? 1

        const sprintResult = await client.query<SprintRecord>(
          `insert into sprints (
            id,
            project_id,
            name,
            sequence_number,
            duration,
            start_date,
            end_date,
            description,
            created_by_user_id
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
            $9
          from projects
          where projects.id = $2
            and (
              projects.owner_user_id = $9
              or $9 = any(projects.member_user_ids)
            )
          returning
            id,
            project_id,
            sequence_number,
            name,
            duration,
            start_date::text,
            end_date::text,
            description,
            created_by_user_id,
            created_at`,
          [
            sprintId,
            input.projectId,
            input.name,
            nextSequenceNumber,
            input.duration,
            input.startDate,
            input.endDate,
            input.description,
            ownerUserId,
          ]
        )

        const sprintRecord = sprintResult.rows[0]

        if (!sprintRecord) {
          throw new Error("Project not found")
        }

        if (backlogItemIds.length > 0) {
          const relationResult = await client.query<{ backlog_item_id: string }>(
            `insert into sprint_backlog_items (sprint_id, backlog_item_id)
            select
              $1,
              backlog_items.id
            from backlog_items
            inner join projects
              on projects.id = backlog_items.project_id
            where backlog_items.project_id = $2
              and backlog_items.id = any($3::uuid[])
              and (
                projects.owner_user_id = $4
                or $4 = any(projects.member_user_ids)
              )
            returning backlog_item_id::text`,
            [sprintId, input.projectId, backlogItemIds, ownerUserId]
          )

          if (relationResult.rowCount !== backlogItemIds.length) {
            throw new Error("One or more work items could not be linked to the sprint")
          }

          await client.query(
            `update backlog_items
            set status = 'todo',
                checked = false,
                updated_at = now()
            where project_id = $1
              and id = any($2::uuid[])`,
            [input.projectId, backlogItemIds]
          )
        }

        await client.query("commit")

        return mapRecord({
          ...sprintRecord,
          backlog_item_ids: backlogItemIds,
        })
      } catch (error) {
        await client.query("rollback")
        throw error
      } finally {
        client.release()
      }
    },
    async () => {
      const records = await readFileRecords()
      const normalizedComparableName = normalizeSprintNameForComparison(input.name)
      const duplicateRecord = records.find(
        (record) =>
          record.projectId === input.projectId &&
          !record.archived &&
          !record.deleted &&
          normalizeSprintNameForComparison(record.name) === normalizedComparableName
      )

      if (duplicateRecord) {
        throw new SprintNameConflictError(input.name)
      }

      const nextSequenceNumber =
        records
          .filter((record) => record.projectId === input.projectId)
          .reduce((maxValue, record) => Math.max(maxValue, record.sequenceNumber), 0) + 1
      const sprint: SprintRow = {
        id: randomUUID(),
        projectId: input.projectId,
        sequenceNumber: nextSequenceNumber,
        name: input.name,
        duration: input.duration,
        startDate: input.startDate,
        endDate: input.endDate,
        description: input.description,
        backlogItemIds: Array.from(
          new Set(
            input.backlogItemIds
              .map((value) => value.trim())
              .filter(Boolean)
          )
        ),
        createdByUserId: ownerUserId,
        createdAt: new Date().toISOString(),
        archived: false,
        archivedAt: null,
        archivedByUserId: "",
        deleted: false,
        deletedAt: null,
        deletedByUserId: "",
      }

      records.unshift(sprint)
      await writeFileRecords(records)
      await resetBacklogStatusesInFile(sprint.backlogItemIds)

      return sprint
    }
  )
}

export async function updateSprint(
  input: UpdateSprintInput,
  actorUserId: string,
  actorRole: SprintActionRole
) {
  return withSprintStore(
    async () => {
      await ensureSprintSchema()

      const sprintLookup = await getDb().query<{ project_id: string }>(
        `select sprints.project_id
        from sprints
        inner join projects
          on projects.id = sprints.project_id
        where sprints.id = $1
          and sprints.project_id = $4
          and sprints.is_deleted = false
          and (
            $3 in ('faculty', 'admin')
            or projects.owner_user_id = $2
            or $2 = any(projects.member_user_ids)
          )
        limit 1`,
        [input.id, actorUserId, actorRole, input.projectId]
      )
      const projectId = sprintLookup.rows[0]?.project_id

      if (!projectId) {
        return null
      }

      const normalizedComparableName = normalizeSprintNameForComparison(input.name)
      const duplicateResult = await getDb().query<{ id: string }>(
        `select id
        from sprints
        where project_id = $1
          and id <> $2
          and lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) = $3
          and is_archived = false
          and is_deleted = false
        limit 1`,
        [projectId, input.id, normalizedComparableName]
      )

      if ((duplicateResult.rowCount ?? 0) > 0) {
        throw new SprintNameConflictError(input.name)
      }

      const result = await getDb().query<SprintRecordWithItems>(
        `update sprints
        set name = $2,
            duration = $3,
            start_date = $4,
            end_date = $5,
            description = $6,
            updated_at = now()
        where id = $1
          and is_deleted = false
        returning
          id,
          project_id,
          sequence_number,
          name,
          duration,
          start_date::text,
          end_date::text,
          description,
          created_by_user_id,
          created_at,
          is_archived,
          archived_at,
          archived_by_user_id,
          is_deleted,
          deleted_at,
          deleted_by_user_id,
          coalesce(
            array(
              select sprint_backlog_items.backlog_item_id::text
              from sprint_backlog_items
              where sprint_backlog_items.sprint_id = sprints.id
              order by sprint_backlog_items.created_at
            ),
            '{}'::text[]
          ) as backlog_item_ids`,
        [
          input.id,
          input.name,
          input.duration,
          input.startDate,
          input.endDate,
          input.description,
        ]
      )

      const sprint = result.rows[0]
      return sprint ? mapRecord(sprint) : null
    },
    async () => {
      const records = await readFileRecords()
      const sprintIndex = records.findIndex(
        (record) =>
          record.id === input.id &&
          record.projectId === input.projectId &&
          !record.deleted
      )

      if (sprintIndex === -1) {
        return null
      }

      const currentSprint = records[sprintIndex]
      const normalizedComparableName = normalizeSprintNameForComparison(input.name)
      const duplicateRecord = records.find(
        (record) =>
          record.id !== input.id &&
          record.projectId === currentSprint.projectId &&
          !record.archived &&
          !record.deleted &&
          normalizeSprintNameForComparison(record.name) === normalizedComparableName
      )

      if (duplicateRecord) {
        throw new SprintNameConflictError(input.name)
      }

      records[sprintIndex] = {
        ...currentSprint,
        name: input.name,
        duration: input.duration,
        startDate: input.startDate,
        endDate: input.endDate,
        description: input.description,
      }

      await writeFileRecords(records)
      return records[sprintIndex]
    }
  )
}

export async function archiveSprint(
  sprintId: string,
  projectId: string,
  actorUserId: string,
  actorRole: SprintActionRole
) {
  return withSprintStore(
    async () => {
      await ensureSprintSchema()

      const result = await getDb().query<{ id: string }>(
        `update sprints
        set is_archived = true,
            archived_at = now(),
            archived_by_user_id = $2,
            updated_at = now()
        from projects
        where sprints.project_id = projects.id
          and sprints.id = $1
          and sprints.project_id = $4
          and sprints.is_deleted = false
          and sprints.is_archived = false
          and (
            $3 in ('faculty', 'admin')
            or projects.owner_user_id = $2
            or $2 = any(projects.member_user_ids)
          )
        returning sprints.id`,
        [sprintId, actorUserId, actorRole, projectId]
      )

      return (result.rowCount ?? 0) > 0
    },
    async () => {
      const records = await readFileRecords()
      const sprintIndex = records.findIndex(
        (record) =>
          record.id === sprintId &&
          record.projectId === projectId &&
          !record.archived &&
          !record.deleted
      )

      if (sprintIndex === -1) {
        return false
      }

      records[sprintIndex] = {
        ...records[sprintIndex],
        archived: true,
        archivedAt: new Date().toISOString(),
        archivedByUserId: actorUserId,
      }

      await writeFileRecords(records)
      return true
    }
  )
}

export async function deleteSprint(
  sprintId: string,
  projectId: string,
  actorUserId: string,
  actorRole: SprintActionRole
) {
  return withSprintStore(
    async () => {
      await ensureSprintSchema()

      const result = await getDb().query<{ id: string }>(
        `update sprints
        set is_deleted = true,
            deleted_at = now(),
            deleted_by_user_id = $2,
            updated_at = now()
        from projects
        where sprints.project_id = projects.id
          and sprints.id = $1
          and sprints.project_id = $4
          and sprints.is_deleted = false
          and (
            $3 in ('faculty', 'admin')
            or projects.owner_user_id = $2
            or $2 = any(projects.member_user_ids)
          )
        returning sprints.id`,
        [sprintId, actorUserId, actorRole, projectId]
      )

      return (result.rowCount ?? 0) > 0
    },
    async () => {
      const records = await readFileRecords()
      const sprintIndex = records.findIndex(
        (record) => record.id === sprintId && record.projectId === projectId && !record.deleted
      )

      if (sprintIndex === -1) {
        return false
      }

      records[sprintIndex] = {
        ...records[sprintIndex],
        deleted: true,
        deletedAt: new Date().toISOString(),
        deletedByUserId: actorUserId,
      }

      await writeFileRecords(records)
      return true
    }
  )
}

export async function addBacklogItemToSprint(
  sprintId: string,
  backlogItemId: string,
  ownerUserId: string
) {
  return withSprintStore(
    async () => {
      await ensureSprintSchema()

      const client = await getDb().connect()

      try {
        await client.query("begin")

        const sprintLookup = await client.query<{ project_id: string }>(
          `select sprints.project_id
          from sprints
          inner join projects
            on projects.id = sprints.project_id
          where sprints.id = $1
            and (
              projects.owner_user_id = $2
              or $2 = any(projects.member_user_ids)
            )
          limit 1`,
          [sprintId, ownerUserId]
        )

        const projectId = sprintLookup.rows[0]?.project_id

        if (!projectId) {
          await client.query("rollback")
          return false
        }

        await client.query(
          `delete from sprint_backlog_items
          using sprints
          where sprint_backlog_items.sprint_id = sprints.id
            and sprints.project_id = $1
            and sprint_backlog_items.backlog_item_id = $2`,
          [projectId, backlogItemId]
        )

        const result = await client.query<{ sprint_id: string; backlog_item_id: string }>(
          `insert into sprint_backlog_items (sprint_id, backlog_item_id)
          select
            sprints.id,
            backlog_items.id
          from sprints
          inner join projects
            on projects.id = sprints.project_id
          inner join backlog_items
            on backlog_items.project_id = sprints.project_id
           and backlog_items.id = $2
          where sprints.id = $1
            and (
              projects.owner_user_id = $3
              or $3 = any(projects.member_user_ids)
            )
          on conflict (sprint_id, backlog_item_id) do nothing
          returning sprint_id, backlog_item_id`,
          [sprintId, backlogItemId, ownerUserId]
        )

        if ((result.rowCount ?? 0) > 0) {
          await client.query(
            `update backlog_items
            set status = 'todo',
                checked = false,
                updated_at = now()
            where project_id = $1
              and id = $2`,
            [projectId, backlogItemId]
          )
        }

        await client.query("commit")
        return (result.rowCount ?? 0) > 0
      } catch (error) {
        await client.query("rollback")
        throw error
      } finally {
        client.release()
      }
    },
    async () => {
      const records = await readFileRecords()
      const sprintIndex = records.findIndex((record) => record.id === sprintId)

      if (sprintIndex === -1) {
        return false
      }

      const projectId = records[sprintIndex]?.projectId
      const nextRecords = records.map((record) =>
        record.projectId === projectId
          ? {
              ...record,
              backlogItemIds: record.backlogItemIds.filter((id) => id !== backlogItemId),
            }
          : record
      )
      const currentSprint = records[sprintIndex]

      nextRecords[sprintIndex] = {
        ...currentSprint,
        backlogItemIds: [...nextRecords[sprintIndex].backlogItemIds, backlogItemId],
      }

      await writeFileRecords(nextRecords)
      await resetBacklogStatusesInFile([backlogItemId])
      return true
    }
  )
}

export async function removeBacklogItemFromSprint(
  sprintId: string,
  backlogItemId: string,
  ownerUserId: string
) {
  return withSprintStore(
    async () => {
      await ensureSprintSchema()

      const client = await getDb().connect()

      try {
        await client.query("begin")

        const sprintLookup = await client.query<{ project_id: string }>(
          `select sprints.project_id
          from sprints
          inner join projects
            on projects.id = sprints.project_id
          where sprints.id = $1
            and (
              projects.owner_user_id = $2
              or $2 = any(projects.member_user_ids)
            )
          limit 1`,
          [sprintId, ownerUserId]
        )

        const projectId = sprintLookup.rows[0]?.project_id

        if (!projectId) {
          await client.query("rollback")
          return false
        }

        const result = await client.query<{ backlog_item_id: string }>(
          `delete from sprint_backlog_items
          using sprints
          where sprint_backlog_items.sprint_id = sprints.id
            and sprints.id = $1
            and sprints.project_id = $2
            and sprint_backlog_items.backlog_item_id = $3
          returning sprint_backlog_items.backlog_item_id::text`,
          [sprintId, projectId, backlogItemId]
        )

        await client.query("commit")
        return (result.rowCount ?? 0) > 0
      } catch (error) {
        await client.query("rollback")
        throw error
      } finally {
        client.release()
      }
    },
    async () => {
      const records = await readFileRecords()
      const sprintIndex = records.findIndex((record) => record.id === sprintId)

      if (sprintIndex === -1) {
        return false
      }

      const currentSprint = records[sprintIndex]
      const nextBacklogItemIds = currentSprint.backlogItemIds.filter(
        (id) => id !== backlogItemId
      )

      if (nextBacklogItemIds.length === currentSprint.backlogItemIds.length) {
        return false
      }

      records[sprintIndex] = {
        ...currentSprint,
        backlogItemIds: nextBacklogItemIds,
      }

      await writeFileRecords(records)
      return true
    }
  )
}
