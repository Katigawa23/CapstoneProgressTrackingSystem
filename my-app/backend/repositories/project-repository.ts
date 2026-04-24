import { randomUUID } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

import { getPreferredStorageMode } from "@/backend/config/storage-mode"
import { getDb } from "@/backend/db/connection"
import {
  canUseLocalFileFallback,
  shouldFallbackToLocalStore,
} from "@/backend/db/fallback"
import {
  dashboardProjects,
  PROJECT_METADATA_MAX_LENGTH,
  PROJECT_TITLE_MAX_LENGTH,
  type DashboardProject,
} from "@/lib/projects"

type ProjectRecord = {
  id: string
  owner_user_id: string
  member_user_ids: string[]
  project_name: string
  project_member: string[]
  program: string
  year_level: string
  sy_term: string
  project_type: string
  created_at: string
}

type RawProjectRecord = Partial<ProjectRecord> & {
  project_description?: string
}

type CreateProjectInput = {
  name: string
  members: string[]
  memberUserIds: string[]
  program: string
  yearLevel: string
  syTerm: string
  projectType: string
}

type ProjectStorageMode = "database" | "file"

const projectsFilePath = path.join(process.cwd(), ".data", "projects.json")

let schemaReady: Promise<void> | null = null
let storageModePromise: Promise<ProjectStorageMode> | null = null
let fallbackWarningShown = false

function normalizeRawProjectRecord(record: RawProjectRecord): ProjectRecord {
  return {
    id: typeof record.id === "string" ? record.id : randomUUID(),
    owner_user_id:
      typeof (record as { owner_user_id?: string }).owner_user_id === "string"
        ? (record as { owner_user_id?: string }).owner_user_id ?? ""
        : "",
    member_user_ids: Array.isArray((record as { member_user_ids?: unknown[] }).member_user_ids)
      ? ((record as { member_user_ids?: unknown[] }).member_user_ids ?? []).filter(
          (memberUserId): memberUserId is string => typeof memberUserId === "string"
        )
      : [],
    project_name:
      typeof record.project_name === "string" ? record.project_name : "",
    project_member: Array.isArray(record.project_member)
      ? record.project_member.filter((member): member is string => typeof member === "string")
      : [],
    program: typeof record.program === "string" ? record.program : "",
    year_level: typeof record.year_level === "string" ? record.year_level : "",
    sy_term: typeof record.sy_term === "string" ? record.sy_term : "",
    project_type: typeof record.project_type === "string" ? record.project_type : "",
    created_at:
      typeof record.created_at === "string"
        ? record.created_at
        : new Date().toISOString(),
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
    `Project storage is using local file data: ${message}`
  )
}

async function ensureProjectsSchema() {
  if (!schemaReady) {
    schemaReady = getDb()
      .query(`
        create table if not exists projects (
          id uuid primary key,
          owner_user_id text not null default '',
          member_user_ids text[] not null default '{}',
          project_name text not null,
          project_member text[] not null default '{}',
          program text not null default '',
          year_level text not null default '',
          sy_term text not null default '',
          project_type text not null default '',
          created_at timestamptz not null default now()
        );
      `)
      .then(() =>
        getDb().query(`
          alter table projects
          add column if not exists owner_user_id text not null default '';
        `)
      )
      .then(() =>
        getDb().query(`
          alter table projects
          add column if not exists member_user_ids text[] not null default '{}';
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists projects_created_at_idx
          on projects(created_at desc);
        `)
      )
      .then(() =>
        getDb().query(`
          do $$
          begin
            if exists (
              select 1
              from information_schema.columns
              where table_name = 'projects' and column_name = 'name'
            ) and not exists (
              select 1
              from information_schema.columns
              where table_name = 'projects' and column_name = 'project_name'
            ) then
              alter table projects rename column name to project_name;
            end if;
          end $$;
        `)
      )
      .then(() =>
        getDb().query(`
          do $$
          begin
            if exists (
              select 1
              from information_schema.columns
              where table_name = 'projects' and column_name = 'description'
            ) then
              alter table projects drop column description;
            end if;
          end $$;
        `)
      )
      .then(() =>
        getDb().query(`
          do $$
          begin
            if exists (
              select 1
              from information_schema.columns
              where table_name = 'projects' and column_name = 'members'
            ) and not exists (
              select 1
              from information_schema.columns
              where table_name = 'projects' and column_name = 'project_member'
            ) then
              alter table projects rename column members to project_member;
            end if;
          end $$;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table projects
          add column if not exists program text not null default '';
        `)
      )
      .then(() =>
        getDb().query(`
          alter table projects
          add column if not exists year_level text not null default '';
        `)
      )
      .then(() =>
        getDb().query(`
          alter table projects
          add column if not exists sy_term text not null default '';
        `)
      )
      .then(() =>
        getDb().query(`
          alter table projects
          add column if not exists project_type text not null default '';
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

async function getStorageMode(): Promise<ProjectStorageMode> {
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
        await ensureProjectsSchema()
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

async function withProjectStore<T>(
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
    const raw = await readFile(projectsFilePath, "utf8")
    const parsed = JSON.parse(raw) as RawProjectRecord[]
    return parsed.map(normalizeRawProjectRecord)
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

async function writeFileRecords(records: ProjectRecord[]) {
  await mkdir(path.dirname(projectsFilePath), { recursive: true })
  await writeFile(projectsFilePath, JSON.stringify(records, null, 2), "utf8")
}

function mapRecord(record: ProjectRecord): DashboardProject {
  return {
    id: record.id,
    name: record.project_name,
    members: record.project_member,
    memberUserIds: record.member_user_ids,
    program: typeof record.program === "string" ? record.program : "",
    yearLevel: typeof record.year_level === "string" ? record.year_level : "",
    syTerm: typeof record.sy_term === "string" ? record.sy_term : "",
    projectType: typeof record.project_type === "string" ? record.project_type : "",
    createdAt:
      typeof record.created_at === "string"
        ? record.created_at
        : new Date(0).toISOString(),
  }
}

function toRecord(project: DashboardProject, ownerUserId: string): ProjectRecord {
  return {
    id: project.id,
    owner_user_id: ownerUserId,
    member_user_ids: project.memberUserIds,
    project_name: project.name,
    project_member: project.members,
    program: project.program,
    year_level: project.yearLevel,
    sy_term: project.syTerm,
    project_type: project.projectType,
    created_at: new Date().toISOString(),
  }
}

async function insertProjectRecord(record: ProjectRecord) {
  await getDb().query(
    `insert into projects (
       id,
       owner_user_id,
       member_user_ids,
       project_name,
       project_member,
       program,
       year_level,
       sy_term,
       project_type,
       created_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (id) do nothing`,
    [
      record.id,
      record.owner_user_id,
      record.member_user_ids,
      record.project_name,
      record.project_member,
      record.program,
      record.year_level,
      record.sy_term,
      record.project_type,
      record.created_at,
    ]
  )
}

function normalizeProject(input: CreateProjectInput): DashboardProject {
  return {
    id: randomUUID(),
    name: input.name.trim().slice(0, PROJECT_TITLE_MAX_LENGTH),
    members: input.members,
    memberUserIds: input.memberUserIds.filter(Boolean),
    program: input.program.trim().slice(0, PROJECT_METADATA_MAX_LENGTH),
    yearLevel: input.yearLevel.trim().slice(0, PROJECT_METADATA_MAX_LENGTH),
    syTerm: input.syTerm.trim().slice(0, PROJECT_METADATA_MAX_LENGTH),
    projectType: input.projectType.trim().slice(0, PROJECT_METADATA_MAX_LENGTH),
    createdAt: new Date().toISOString(),
  }
}

export async function listProjects(ownerUserId: string) {
  return withProjectStore(
    async () => {
      const result = await getDb().query<ProjectRecord>(
        `select
           id,
           owner_user_id,
           member_user_ids,
           project_name,
           project_member,
           program,
           year_level,
           sy_term,
           project_type,
           created_at
         from projects
         where owner_user_id = $1
            or $1 = any(member_user_ids)
         order by created_at desc`,
        [ownerUserId]
      )

      return [...dashboardProjects, ...result.rows.map(mapRecord)]
    },
    async () => {
      const records = await readFileRecords()
      return [
        ...dashboardProjects,
        ...records
          .filter(
            (record) =>
              record.owner_user_id === ownerUserId ||
              record.member_user_ids.includes(ownerUserId)
          )
          .map(mapRecord),
      ]
    }
  )
}

export async function createProject(input: CreateProjectInput, ownerUserId: string) {
  return withProjectStore(
    async () => {
      const project = normalizeProject(input)

      const result = await getDb().query<ProjectRecord>(
        `insert into projects (
           id,
           owner_user_id,
           member_user_ids,
           project_name,
           project_member,
           program,
           year_level,
           sy_term,
           project_type
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         returning
           id,
           owner_user_id,
           member_user_ids,
           project_name,
           project_member,
           program,
           year_level,
           sy_term,
           project_type,
           created_at`,
        [
          project.id,
          ownerUserId,
          input.memberUserIds.filter((memberUserId) => memberUserId !== ownerUserId),
          project.name,
          project.members,
          project.program,
          project.yearLevel,
          project.syTerm,
          project.projectType,
        ]
      )

      return mapRecord(result.rows[0])
    },
    async () => {
      const project = normalizeProject(input)
      const records = await readFileRecords()
      records.unshift({
        ...toRecord(project, ownerUserId),
        member_user_ids: input.memberUserIds.filter((memberUserId) => memberUserId !== ownerUserId),
      })
      await writeFileRecords(records)
      return project
    }
  )
}

export async function ensureProjectExists(projectId: string, ownerUserId: string) {
  return withProjectStore(
    async () => {
      const existingProject = await getDb().query<{ id: string }>(
        `select id
         from projects
         where id = $1
           and (
             owner_user_id = $2
             or $2 = any(member_user_ids)
           )
         limit 1`,
        [projectId, ownerUserId]
      )

      if ((existingProject.rowCount ?? 0) > 0) {
        return
      }

      const fileRecords = await readFileRecords()
      const matchingRecord = fileRecords.find(
        (record) =>
          record.id === projectId &&
          (
            record.owner_user_id === ownerUserId ||
            record.member_user_ids.includes(ownerUserId)
          )
      )

      if (!matchingRecord) {
        return
      }

      await insertProjectRecord(matchingRecord)
    },
    async () => undefined
  )
}
