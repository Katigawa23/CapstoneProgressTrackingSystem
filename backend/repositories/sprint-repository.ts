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
  name: string
  duration: string
  startDate: string
  endDate: string
  description: string
  backlogItemIds: string[]
  createdByUserId: string
  createdAt: string
}

type SprintRecord = {
  id: string
  project_id: string
  name: string
  duration: string
  start_date: string
  end_date: string
  description: string
  created_by_user_id: string
  created_at: string
}

type SprintRecordWithItems = SprintRecord & {
  backlog_item_ids?: string[] | null
}

type RawSprintRecord = Partial<SprintRecord> & {
  projectId?: string
  startDate?: string
  endDate?: string
  backlogItemIds?: string[]
  createdByUserId?: string
  createdAt?: string
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

type SprintStorageMode = "database" | "file"

const sprintsFilePath = path.join(process.cwd(), ".data", "sprints.json")

let schemaReady: Promise<void> | null = null
let storageModePromise: Promise<SprintStorageMode> | null = null
let fallbackWarningShown = false

function normalizeSprintRecord(record: RawSprintRecord): SprintRow {
  return {
    id: typeof record.id === "string" ? record.id : randomUUID(),
    projectId:
      typeof record.project_id === "string"
        ? record.project_id
        : typeof record.projectId === "string"
        ? record.projectId
        : "",
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
  }
}

function mapRecord(record: SprintRecordWithItems): SprintRow {
  return {
    id: record.id,
    projectId: record.project_id,
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
          duration text not null default '',
          start_date date not null,
          end_date date not null,
          description text not null default '',
          created_by_user_id text not null default '',
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
          create index if not exists sprints_project_created_at_idx
          on sprints(project_id, created_at desc);
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
    return parsed.map(normalizeSprintRecord)
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

export async function listSprints(projectId: string, ownerUserId: string) {
  return withSprintStore(
    async () => {
      await ensureProjectExists(projectId, ownerUserId)

      const result = await getDb().query<SprintRecordWithItems>(
        `select
          sprints.id,
          sprints.project_id,
          sprints.name,
          sprints.duration,
          sprints.start_date::text,
          sprints.end_date::text,
          sprints.description,
          sprints.created_by_user_id,
          sprints.created_at,
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
        .filter((record) => record.projectId === projectId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    }
  )
}

export async function createSprint(input: CreateSprintInput, ownerUserId: string) {
  return withSprintStore(
    async () => {
      await ensureProjectExists(input.projectId, ownerUserId)

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

        const sprintResult = await client.query<SprintRecord>(
          `insert into sprints (
            id,
            project_id,
            name,
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
            $8
          from projects
          where projects.id = $2
            and (
              projects.owner_user_id = $8
              or $8 = any(projects.member_user_ids)
            )
          returning
            id,
            project_id,
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
      const sprint: SprintRow = {
        id: randomUUID(),
        projectId: input.projectId,
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
      }

      records.unshift(sprint)
      await writeFileRecords(records)

      return sprint
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

      const result = await getDb().query<{ sprint_id: string; backlog_item_id: string }>(
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

      return (result.rowCount ?? 0) > 0
    },
    async () => {
      const records = await readFileRecords()
      const sprintIndex = records.findIndex((record) => record.id === sprintId)

      if (sprintIndex === -1) {
        return false
      }

      const currentSprint = records[sprintIndex]

      if (currentSprint.backlogItemIds.includes(backlogItemId)) {
        return true
      }

      records[sprintIndex] = {
        ...currentSprint,
        backlogItemIds: [...currentSprint.backlogItemIds, backlogItemId],
      }

      await writeFileRecords(records)
      return true
    }
  )
}
