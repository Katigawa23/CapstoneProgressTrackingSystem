import { randomUUID } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

import { getPreferredStorageMode } from "@backend/config/storage-mode"
import { getDb } from "@/lib/server-db"
import {
  canUseLocalFileFallback,
  shouldFallbackToLocalStore,
} from "@backend/db/fallback"
import { ensureMicrosoftLoginSchema } from "@backend/repositories/users-repository"
import {
  dashboardProjects,
  PROJECT_METADATA_MAX_LENGTH,
  PROJECT_TITLE_MAX_LENGTH,
  type DashboardProject,
} from "@/lib/projects"

type ProjectRecord = {
  id: string
  owner_user_id: string
  owner_name?: string | null
  owner_email?: string | null
  member_user_ids: string[]
  sprint_creator_user_ids: string[]
  project_name: string
  project_member: string[]
  project_adviser: string[]
  is_starred: boolean
  program: string
  year_level: string
  sy_term: string
  project_type: string
  created_at: string
}

type ProjectStarredPreferenceRecord = {
  project_id: string
  user_id: string
}

type RawProjectRecord = Partial<ProjectRecord> & {
  project_description?: string
}

type CreateProjectInput = {
  name: string
  members: string[]
  advisers?: string[]
  starred?: boolean
  sprintCreatorUserIds?: string[]
  memberUserIds: string[]
  memberAccess?: Array<{
    userId: string
    role: string
    canCreateSprint: boolean
  }>
  program: string
  yearLevel: string
  syTerm: string
  projectType: string
}

export type ProjectMemberAccessView = {
  userId: string
  name: string
  email: string
  role: "student" | "faculty" | "admin"
  projectRole: string
  canCreateSprint: boolean
  isOwner: boolean
}

type ProjectStorageMode = "database" | "file"

const projectsFilePath = path.join(process.cwd(), ".data", "projects.json")
const projectStarredPreferencesFilePath = path.join(
  process.cwd(),
  ".data",
  "project-starred-preferences.json"
)

let schemaReady: Promise<void> | null = null
let storageModePromise: Promise<ProjectStorageMode> | null = null
let fallbackWarningShown = false

export class ProjectNameConflictError extends Error {
  constructor(projectName: string) {
    super(`Project "${projectName}" already exists.`)
    this.name = "ProjectNameConflictError"
  }
}

function uppercaseFirstCharacter(value: string) {
  if (!value) {
    return value
  }

  return value.charAt(0).toUpperCase() + value.slice(1)
}

function normalizeProjectNameForComparison(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
}

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
    sprint_creator_user_ids: Array.isArray(
      (record as { sprint_creator_user_ids?: unknown[] }).sprint_creator_user_ids
    )
      ? ((record as { sprint_creator_user_ids?: unknown[] }).sprint_creator_user_ids ?? []).filter(
          (memberUserId): memberUserId is string => typeof memberUserId === "string"
        )
      : [],
    project_name:
      typeof record.project_name === "string" ? record.project_name : "",
    project_member: Array.isArray(record.project_member)
      ? record.project_member.filter((member): member is string => typeof member === "string")
      : [],
    project_adviser: Array.isArray((record as { project_adviser?: unknown[] }).project_adviser)
      ? ((record as { project_adviser?: unknown[] }).project_adviser ?? []).filter(
          (adviser): adviser is string => typeof adviser === "string"
        )
      : [],
    is_starred: record.is_starred === true,
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
    schemaReady = ensureMicrosoftLoginSchema()
      .then(() =>
        getDb().query(`
        create table if not exists projects (
          id uuid primary key,
          owner_user_id text not null default '',
          member_user_ids text[] not null default '{}',
          sprint_creator_user_ids text[] not null default '{}',
          project_name text not null,
          project_member text[] not null default '{}',
          project_adviser text[] not null default '{}',
          is_starred boolean not null default false,
          program text not null default '',
          year_level text not null default '',
          sy_term text not null default '',
          project_type text not null default '',
          created_at timestamptz not null default now()
        );
      `)
      )
      .then(() =>
        getDb().query(`
        create table if not exists groups (
          id uuid primary key default gen_random_uuid(),
          project_id uuid not null references projects(id) on delete cascade,
          group_name text not null default '',
          adviser_user_id text references users(microsoft_user_id) on delete set null,
          created_by_user_id text references users(microsoft_user_id) on delete set null,
          member_user_ids text[] not null default '{}',
          sprint_creator_user_ids text[] not null default '{}',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
      `)
      )
      .then(() =>
        getDb().query(`
        create table if not exists project_starred_preferences (
          project_id uuid not null references projects(id) on delete cascade,
          user_id text not null references users(microsoft_user_id) on delete cascade,
          created_at timestamptz not null default now(),
          primary key (project_id, user_id)
        );
      `)
      )
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
          alter table projects
          add column if not exists sprint_creator_user_ids text[] not null default '{}';
        `)
      )
      .then(() =>
        getDb().query(`
          alter table projects
          add column if not exists project_adviser text[] not null default '{}';
        `)
      )
      .then(() =>
        getDb().query(`
          alter table projects
          add column if not exists is_starred boolean not null default false;
        `)
      )
      .then(() =>
        getDb().query(`
          alter table groups
          add column if not exists member_user_ids text[] not null default '{}';
        `)
      )
      .then(() =>
        getDb().query(`
          alter table groups
          add column if not exists sprint_creator_user_ids text[] not null default '{}';
        `)
      )
      .then(() =>
        getDb().query(`
          create unique index if not exists groups_project_id_idx
          on groups(project_id);
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists groups_adviser_user_id_idx
          on groups(adviser_user_id);
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists project_starred_preferences_user_id_idx
          on project_starred_preferences(user_id, created_at desc);
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
          insert into project_starred_preferences (project_id, user_id)
          select id, owner_user_id
          from projects
          where is_starred = true
            and owner_user_id <> ''
          on conflict (project_id, user_id) do nothing;
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists projects_owner_user_id_idx
          on projects(owner_user_id);
        `)
      )
      .then(() =>
        getDb().query(`
          do $$
          begin
            if not exists (
              select 1
              from pg_constraint
              where conname = 'fk_projects_owner_user_id'
            ) then
              alter table projects
              add constraint fk_projects_owner_user_id
              foreign key (owner_user_id) references users(microsoft_user_id)
              on delete restrict;
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
          update groups
          set group_name = p.project_name,
              created_by_user_id = p.owner_user_id,
              member_user_ids = p.member_user_ids,
              sprint_creator_user_ids = p.sprint_creator_user_ids,
              updated_at = now()
          from projects p
          where groups.project_id = p.id;

          insert into groups (
            project_id,
            group_name,
            adviser_user_id,
            created_by_user_id,
            member_user_ids,
            sprint_creator_user_ids
          )
          select
            p.id,
            p.project_name,
            null,
            p.owner_user_id,
            p.member_user_ids,
            p.sprint_creator_user_ids
          from projects p
          where not exists (
            select 1
            from groups g
            where g.project_id = p.id
          );
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

async function readFileStarredPreferences() {
  try {
    const raw = await readFile(projectStarredPreferencesFilePath, "utf8")
    const parsed = JSON.parse(raw) as unknown

    if (!Array.isArray(parsed)) {
      return [] as ProjectStarredPreferenceRecord[]
    }

    return parsed.filter(
      (record): record is ProjectStarredPreferenceRecord =>
        Boolean(
          record &&
            typeof record === "object" &&
            "project_id" in record &&
            "user_id" in record &&
            typeof (record as { project_id?: unknown }).project_id === "string" &&
            typeof (record as { user_id?: unknown }).user_id === "string"
        )
    )
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

async function writeFileStarredPreferences(records: ProjectStarredPreferenceRecord[]) {
  await mkdir(path.dirname(projectStarredPreferencesFilePath), { recursive: true })
  await writeFile(
    projectStarredPreferencesFilePath,
    JSON.stringify(records, null, 2),
    "utf8"
  )
}

function normalizeProjectCreatedAt(value: unknown) {
  if (value instanceof Date) {
    const timestamp = value.getTime()

    if (!Number.isNaN(timestamp) && value.getUTCFullYear() > 1971) {
      return value.toISOString()
    }
  }

  if (typeof value !== "string") {
    return new Date().toISOString()
  }

  const timestamp = new Date(value).getTime()

  if (Number.isNaN(timestamp) || new Date(timestamp).getUTCFullYear() <= 1971) {
    return new Date().toISOString()
  }

  return value
}

function mapRecord(record: ProjectRecord): DashboardProject {
  return {
    id: record.id,
    name: record.project_name,
    ownerUserId: record.owner_user_id,
    ownerName: record.owner_name ?? undefined,
    ownerEmail: record.owner_email ?? undefined,
    members: record.project_member,
    advisers: record.project_adviser,
    sprintCreatorUserIds: record.sprint_creator_user_ids,
    starred: record.is_starred,
    memberUserIds: record.member_user_ids,
    program: typeof record.program === "string" ? record.program : "",
    yearLevel: typeof record.year_level === "string" ? record.year_level : "",
    syTerm: typeof record.sy_term === "string" ? record.sy_term : "",
    projectType: typeof record.project_type === "string" ? record.project_type : "",
    createdAt: normalizeProjectCreatedAt(record.created_at),
  }
}

function toRecord(project: DashboardProject, ownerUserId: string): ProjectRecord {
  return {
    id: project.id,
    owner_user_id: ownerUserId,
    member_user_ids: project.memberUserIds,
    sprint_creator_user_ids: project.sprintCreatorUserIds,
    project_name: project.name,
    project_member: project.members,
    project_adviser: project.advisers,
    is_starred: project.starred,
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
       sprint_creator_user_ids,
       project_name,
       project_member,
       project_adviser,
       is_starred,
       program,
       year_level,
       sy_term,
       project_type,
       created_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     on conflict (id) do nothing`,
    [
      record.id,
      record.owner_user_id,
      record.member_user_ids,
      record.sprint_creator_user_ids,
      record.project_name,
      record.project_member,
      record.project_adviser,
      record.is_starred,
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
    name: uppercaseFirstCharacter(input.name.trim()).slice(0, PROJECT_TITLE_MAX_LENGTH),
    members: input.members,
    advisers: Array.isArray(input.advisers) ? input.advisers.filter(Boolean) : [],
    sprintCreatorUserIds: Array.isArray(input.sprintCreatorUserIds)
      ? input.sprintCreatorUserIds.filter(Boolean)
      : [],
    starred: input.starred === true,
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
        `with latest_logins as (
           select distinct on (microsoft_user_id)
             microsoft_user_id,
             name,
             email
           from users
           order by microsoft_user_id, login_at desc
         )
         select
           projects.id,
           projects.owner_user_id,
           owner_login.name as owner_name,
           owner_login.email as owner_email,
           coalesce(member_logins.member_user_ids, projects.member_user_ids) as member_user_ids,
           projects.sprint_creator_user_ids,
           projects.project_name,
           coalesce(member_logins.project_member, projects.project_member) as project_member,
           projects.project_adviser,
           (project_starred_preferences.project_id is not null) as is_starred,
           projects.program,
           projects.year_level,
           projects.sy_term,
           projects.project_type,
           projects.created_at
         from projects
         left join latest_logins owner_login
           on owner_login.microsoft_user_id = projects.owner_user_id
         left join lateral (
           select
             array_agg(login.microsoft_user_id order by login.name asc, login.email asc) as member_user_ids,
             array_agg(login.name order by login.name asc, login.email asc) as project_member
           from unnest(projects.member_user_ids) as member_user_id
           inner join latest_logins login
             on login.microsoft_user_id = member_user_id
         ) as member_logins on true
         left join project_starred_preferences
           on project_starred_preferences.project_id = projects.id
          and project_starred_preferences.user_id = $1
         where projects.owner_user_id = $1
            or $1 = any(projects.member_user_ids)
         order by projects.created_at desc`,
        [ownerUserId]
      )

      return [...dashboardProjects, ...result.rows.map(mapRecord)]
    },
    async () => {
      const records = await readFileRecords()
      const starredPreferences = await readFileStarredPreferences()
      const starredProjectIds = new Set(
        starredPreferences
          .filter((record) => record.user_id === ownerUserId)
          .map((record) => record.project_id)
      )

      return [
        ...dashboardProjects,
        ...records
          .filter(
            (record) =>
              record.owner_user_id === ownerUserId ||
              record.member_user_ids.includes(ownerUserId)
          )
          .map((record) =>
            mapRecord({
              ...record,
              is_starred: starredProjectIds.has(record.id),
            })
          ),
      ]
    }
  )
}

export async function createProject(input: CreateProjectInput, ownerUserId: string) {
  return withProjectStore(
    async () => {
      const project = normalizeProject(input)
      const normalizedProjectName = normalizeProjectNameForComparison(project.name)

      const existingProjectResult = await getDb().query<{ id: string }>(
        `select id
         from projects
         where regexp_replace(lower(btrim(project_name)), '[^a-z0-9]+', '', 'g') = $1
         limit 1`,
        [normalizedProjectName]
      )

      if ((existingProjectResult.rowCount ?? 0) > 0) {
        throw new ProjectNameConflictError(project.name)
      }

      const result = await getDb().query<ProjectRecord>(
        `insert into projects (
           id,
           owner_user_id,
           member_user_ids,
           sprint_creator_user_ids,
           project_name,
           project_member,
           project_adviser,
           is_starred,
           program,
           year_level,
           sy_term,
           project_type
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         returning
           id,
           owner_user_id,
           member_user_ids,
           sprint_creator_user_ids,
           project_name,
           project_member,
           project_adviser,
           is_starred,
           program,
           year_level,
           sy_term,
           project_type,
           created_at`,
        [
          project.id,
          ownerUserId,
          input.memberUserIds.filter((memberUserId) => memberUserId !== ownerUserId),
          (input.sprintCreatorUserIds ?? []).filter((memberUserId) => memberUserId !== ownerUserId),
          project.name,
          project.members,
          project.advisers,
          project.starred,
          project.program,
          project.yearLevel,
          project.syTerm,
          project.projectType,
        ]
      )

      try {
        await insertProjectMemberAccessRecords(
          project.id,
          ownerUserId,
          Array.isArray(input.memberAccess) ? input.memberAccess : []
        )
      } catch (error) {
        console.error("Failed to sync project member access records after project creation", {
          projectId: project.id,
          ownerUserId,
          error: error instanceof Error ? error.message : String(error),
        })
      }

      await syncProjectGroupFromProject(project.id)

      return mapRecord(result.rows[0])
    },
    async () => {
      const project = normalizeProject(input)
      const records = await readFileRecords()
      const normalizedProjectName = normalizeProjectNameForComparison(project.name)

      const duplicateProject = records.find(
        (record) =>
          normalizeProjectNameForComparison(record.project_name) === normalizedProjectName
      )

      if (duplicateProject) {
        throw new ProjectNameConflictError(project.name)
      }

      records.unshift({
        ...toRecord(project, ownerUserId),
        member_user_ids: input.memberUserIds.filter((memberUserId) => memberUserId !== ownerUserId),
        sprint_creator_user_ids: (input.sprintCreatorUserIds ?? []).filter(
          (memberUserId) => memberUserId !== ownerUserId
        ),
      })
      await writeFileRecords(records)
      return project
    }
  )
}

export async function updateProjectStarred(
  projectId: string,
  ownerUserId: string,
  starred: boolean
) {
  return withProjectStore(
    async () => {
      const accessResult = await getDb().query<{ id: string }>(
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

      if ((accessResult.rowCount ?? 0) === 0) {
        return null
      }

      if (starred) {
        await getDb().query(
          `insert into project_starred_preferences (project_id, user_id)
           values ($1, $2)
           on conflict (project_id, user_id) do nothing`,
          [projectId, ownerUserId]
        )
      } else {
        await getDb().query(
          `delete from project_starred_preferences
           where project_id = $1
             and user_id = $2`,
          [projectId, ownerUserId]
        )
      }

      const result = await getDb().query<ProjectRecord>(
        `select
           projects.id,
           projects.owner_user_id,
           projects.member_user_ids,
           projects.sprint_creator_user_ids,
           projects.project_name,
           projects.project_member,
           projects.project_adviser,
           (project_starred_preferences.project_id is not null) as is_starred,
           projects.program,
           projects.year_level,
           projects.sy_term,
           projects.project_type,
           projects.created_at
         from projects
         left join project_starred_preferences
           on project_starred_preferences.project_id = projects.id
          and project_starred_preferences.user_id = $2
         where projects.id = $1`,
        [projectId, ownerUserId]
      )

      return result.rows[0] ? mapRecord(result.rows[0]) : null
    },
    async () => {
      const records = await readFileRecords()
      const matchingRecord = records.find(
        (record) =>
          record.id === projectId &&
          (
            record.owner_user_id === ownerUserId ||
            record.member_user_ids.includes(ownerUserId)
          )
      )

      if (!matchingRecord) {
        return null
      }

      const preferences = await readFileStarredPreferences()
      const nextPreferences = starred
        ? preferences.some(
            (record) =>
              record.project_id === projectId && record.user_id === ownerUserId
          )
          ? preferences
          : [...preferences, { project_id: projectId, user_id: ownerUserId }]
        : preferences.filter(
            (record) =>
              !(
                record.project_id === projectId && record.user_id === ownerUserId
              )
          )

      await writeFileStarredPreferences(nextPreferences)

      return mapRecord({
        ...matchingRecord,
        is_starred: starred,
      })
    }
  )
}

async function insertProjectMemberAccessRecords(
  projectId: string,
  ownerUserId: string,
  memberAccess: Array<{
    userId: string
    role: string
    canCreateSprint: boolean
  }>
) {
  const normalizedAccessByUserId = new Map<
    string,
    {
      userId: string
      role: string
      canCreateSprint: boolean
    }
  >()

  for (const member of memberAccess) {
    const userId = member.userId.trim()

    if (!userId || userId === ownerUserId) {
      continue
    }

    const role =
      member.role === "faculty" || member.role === "admin" || member.role === "student"
        ? member.role
        : "student"
    const canCreateSprint =
      role === "faculty" || role === "admin" ? true : member.canCreateSprint === true

    normalizedAccessByUserId.set(userId, {
      userId,
      role,
      canCreateSprint,
    })
  }

  const normalizedAccess = [...normalizedAccessByUserId.values()]

  if (normalizedAccess.length === 0) {
    await syncProjectGroupFromProject(projectId)
    return
  }

  const memberUserIds = normalizedAccess.map((member) => member.userId)
  const sprintCreatorUserIds = normalizedAccess
    .filter((member) => member.canCreateSprint)
    .map((member) => member.userId)

  await getDb().query(
    `update groups
     set created_by_user_id = $2,
         member_user_ids = $3::text[],
         sprint_creator_user_ids = $4::text[],
         updated_at = now()
     where project_id = $1`,
    [projectId, ownerUserId, memberUserIds, sprintCreatorUserIds]
  )

  await getDb().query(
    `insert into groups (
       project_id,
       group_name,
       adviser_user_id,
       created_by_user_id,
       member_user_ids,
       sprint_creator_user_ids
     )
     select
       p.id,
       p.project_name,
       null,
       $2,
       $3::text[],
       $4::text[]
     from projects p
     where p.id = $1
       and not exists (
         select 1
         from groups g
         where g.project_id = p.id
       )`,
    [projectId, ownerUserId, memberUserIds, sprintCreatorUserIds]
  )
}

async function syncProjectGroupFromProject(projectId: string) {
  await getDb().query(
    `update groups
     set group_name = projects.project_name,
         created_by_user_id = projects.owner_user_id,
         member_user_ids = projects.member_user_ids,
         sprint_creator_user_ids = projects.sprint_creator_user_ids,
         updated_at = now()
     from projects
     where projects.id = $1
       and groups.project_id = projects.id`,
    [projectId]
  )

  await getDb().query(
    `insert into groups (
       project_id,
       group_name,
       adviser_user_id,
       created_by_user_id,
       member_user_ids,
       sprint_creator_user_ids
     )
     select
       p.id,
       p.project_name,
       null,
       p.owner_user_id,
       p.member_user_ids,
       p.sprint_creator_user_ids
     from projects p
     where p.id = $1
       and not exists (
         select 1
         from groups g
         where g.project_id = p.id
       )`,
    [projectId]
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

export async function canUserCreateSprintInProject(
  projectId: string,
  userId: string,
  userRole: "student" | "faculty" | "admin"
) {
  if (userRole === "faculty" || userRole === "admin") {
    return true
  }

  return withProjectStore(
    async () => {
      const result = await getDb().query<{ can_create_sprint: boolean }>(
        `select (
           p.owner_user_id = $2
           or $2 = any(coalesce(g.sprint_creator_user_ids, p.sprint_creator_user_ids))
         ) as can_create_sprint
         from projects p
         left join groups g
           on g.project_id = p.id
         where p.id = $1
           and (
             p.owner_user_id = $2
             or $2 = any(p.member_user_ids)
           )
         limit 1`,
        [projectId, userId]
      )

      return result.rows[0]?.can_create_sprint === true
    },
    async () => {
      const records = await readFileRecords()
      const project = records.find(
        (record) =>
          record.id === projectId &&
          (record.owner_user_id === userId || record.member_user_ids.includes(userId))
      )

      if (!project) {
        return false
      }

      return project.owner_user_id === userId || project.sprint_creator_user_ids.includes(userId)
    }
  )
}

function normalizeProjectMemberRole(role: string): "student" | "faculty" | "admin" {
  if (role === "faculty" || role === "admin") {
    return role
  }

  return "student"
}

function canManageProjectMembers(userRole: "student" | "faculty" | "admin") {
  return userRole === "faculty" || userRole === "admin"
}

export async function listProjectMembers(
  projectId: string,
  userId: string,
  userRole: "student" | "faculty" | "admin"
): Promise<ProjectMemberAccessView[]> {
  return withProjectStore(
    async () => {
      const access = await getDb().query<{ can_access: boolean }>(
        `select exists (
           select 1
           from projects p
           where p.id = $1
             and (
               p.owner_user_id = $2
               or $2 = any(p.member_user_ids)
               or $3 in ('faculty', 'admin')
             )
         ) as can_access`,
        [projectId, userId, userRole]
      )

      if (access.rows[0]?.can_access !== true) {
        return []
      }

      const result = await getDb().query<{
        user_id: string
        name: string
        email: string
        role: string
        can_create_sprint: boolean
        is_owner: boolean
      }>(
        `with project_scope as (
           select *
           from projects
           where id = $1
           limit 1
         ),
         group_scope as (
           select *
           from groups
           where project_id = $1
           limit 1
         ),
         project_people as (
           select owner_user_id as user_id
           from project_scope
           union
           select unnest(member_user_ids) as user_id
           from project_scope
         ),
         latest_logins as (
           select distinct on (microsoft_user_id)
             microsoft_user_id,
             name,
             email,
             role
           from users
           order by microsoft_user_id, login_at desc
         )
         select
           people.user_id,
           coalesce(login.name, people.user_id) as name,
           coalesce(login.email, '') as email,
           case
             when project_scope.owner_user_id = people.user_id then coalesce(nullif(login.role, ''), 'faculty')
             else coalesce(nullif(login.role, ''), 'student')
          end as role,
          case
            when project_scope.owner_user_id = people.user_id then true
            else people.user_id = any(
              coalesce(group_scope.sprint_creator_user_ids, project_scope.sprint_creator_user_ids)
            )
           end as can_create_sprint,
           project_scope.owner_user_id = people.user_id as is_owner
         from project_people people
         cross join project_scope
         left join group_scope
           on true
         left join latest_logins login
           on login.microsoft_user_id = people.user_id
         where project_scope.owner_user_id <> people.user_id
           and coalesce(login.role, 'student') not in ('faculty', 'admin')
         order by is_owner desc, name asc, email asc`,
        [projectId]
      )

      return result.rows.map((row) => ({
        userId: row.user_id,
        name: row.name,
        email: row.email,
        role: normalizeProjectMemberRole(row.role),
        projectRole: "",
        canCreateSprint: row.can_create_sprint === true,
        isOwner: row.is_owner === true,
      }))
    },
    async () => {
      const records = await readFileRecords()
      const project = records.find(
        (record) =>
          record.id === projectId &&
          (
            record.owner_user_id === userId ||
            record.member_user_ids.includes(userId) ||
            canManageProjectMembers(userRole)
          )
      )

      if (!project) {
        return []
      }

      return project.member_user_ids.map((memberUserId, index) => ({
        userId: memberUserId,
        name: project.project_member[index] ?? memberUserId,
        email: "",
        role: "student",
        projectRole: "",
        canCreateSprint: project.sprint_creator_user_ids.includes(memberUserId),
        isOwner: false,
      }))
    }
  )
}

export async function updateProjectMemberAccess(
  projectId: string,
  targetUserId: string,
  input: {
    projectRole: string
    canCreateSprint: boolean
  },
  actorUserId: string,
  actorRole: "student" | "faculty" | "admin"
): Promise<ProjectMemberAccessView | null> {
  return withProjectStore(
    async () => {
      const target = await getDb().query<{
        owner_user_id: string
        target_name: string
        target_email: string
        target_role: string
        current_can_create_sprint: boolean
        actor_can_access: boolean
      }>(
        `select
           p.owner_user_id,
           login.name as target_name,
           login.email as target_email,
           coalesce(login.role, 'student') as target_role,
           $2 = any(coalesce(g.sprint_creator_user_ids, p.sprint_creator_user_ids)) as current_can_create_sprint,
           (
             p.owner_user_id = $3
             or $3 = any(p.member_user_ids)
             or $4 in ('faculty', 'admin')
           ) as actor_can_access
         from projects p
         inner join users login
           on login.microsoft_user_id = $2
         left join groups g
           on g.project_id = p.id
         where p.id = $1
         limit 1`,
        [projectId, targetUserId, actorUserId, actorRole]
      )

      const targetRow = target.rows[0]

      if (
        !targetRow ||
        targetRow.owner_user_id === targetUserId ||
        ["faculty", "admin"].includes(targetRow.target_role) ||
        targetRow.actor_can_access !== true
      ) {
        return null
      }

      const nextProjectRole = input.projectRole.trim().slice(0, 40)
      const nextCanCreateSprint = canManageProjectMembers(actorRole)
        ? input.canCreateSprint === true
        : targetRow.current_can_create_sprint === true

      await getDb().query(
        `update projects
         set member_user_ids = case
               when $2 = any(member_user_ids) then member_user_ids
               else array_append(member_user_ids, $2)
             end,
             project_member = case
               when not ($4 = any(project_member)) then array_append(project_member, $4)
               else project_member
             end,
             sprint_creator_user_ids = case
               when $3 = true and not ($2 = any(sprint_creator_user_ids)) then array_append(sprint_creator_user_ids, $2)
               when $3 = false then array_remove(sprint_creator_user_ids, $2)
               else sprint_creator_user_ids
             end
         where id = $1`,
        [
          projectId,
          targetUserId,
          nextCanCreateSprint,
          targetRow.target_name,
        ]
      )

      await syncProjectGroupFromProject(projectId)

      return {
        userId: targetUserId,
        name: targetRow.target_name,
        email: targetRow.target_email,
        role: "student",
        projectRole: nextProjectRole,
        canCreateSprint: nextCanCreateSprint,
        isOwner: false,
      }
    },
    async () => null
  )
}

export async function addProjectStudentMember(
  projectId: string,
  targetUserId: string,
  actorUserId: string,
  actorRole: "student" | "faculty" | "admin"
): Promise<ProjectMemberAccessView | null> {
  if (!canManageProjectMembers(actorRole)) {
    return null
  }

  return withProjectStore(
    async () => {
      const target = await getDb().query<{
        owner_user_id: string
        target_name: string
        target_email: string
        target_role: string
      }>(
        `select
           p.owner_user_id,
           login.name as target_name,
           login.email as target_email,
           coalesce(login.role, 'student') as target_role
         from projects p
         inner join users login
           on login.microsoft_user_id = $2
         where p.id = $1
           and (
             p.owner_user_id = $3
             or $3 = any(p.member_user_ids)
             or $4 in ('faculty', 'admin')
           )
         limit 1`,
        [projectId, targetUserId, actorUserId, actorRole]
      )

      const targetRow = target.rows[0]

      if (
        !targetRow ||
        targetRow.owner_user_id === targetUserId ||
        ["faculty", "admin"].includes(targetRow.target_role)
      ) {
        return null
      }

      await getDb().query(
        `update projects
         set member_user_ids = case
               when $2 = any(member_user_ids) then member_user_ids
               else array_append(member_user_ids, $2)
             end,
             project_member = case
               when $3 = any(project_member) then project_member
               else array_append(project_member, $3)
             end,
             sprint_creator_user_ids = array_remove(sprint_creator_user_ids, $2)
         where id = $1`,
        [projectId, targetUserId, targetRow.target_name]
      )

      await syncProjectGroupFromProject(projectId)

      return {
        userId: targetUserId,
        name: targetRow.target_name,
        email: targetRow.target_email,
        role: "student",
        projectRole: "",
        canCreateSprint: false,
        isOwner: false,
      }
    },
    async () => null
  )
}

export async function removeProjectStudentMember(
  projectId: string,
  targetUserId: string,
  actorUserId: string,
  actorRole: "student" | "faculty" | "admin"
): Promise<boolean> {
  if (!canManageProjectMembers(actorRole)) {
    return false
  }

  return withProjectStore(
    async () => {
      const target = await getDb().query<{
        owner_user_id: string
        target_name: string
        target_role: string
      }>(
        `select
           p.owner_user_id,
           coalesce(login.name, '') as target_name,
           coalesce(login.role, 'student') as target_role
         from projects p
         left join users login
           on login.microsoft_user_id = $2
         where p.id = $1
           and (
             p.owner_user_id = $3
             or $3 = any(p.member_user_ids)
             or $4 in ('faculty', 'admin')
           )
         limit 1`,
        [projectId, targetUserId, actorUserId, actorRole]
      )

      const targetRow = target.rows[0]

      if (
        !targetRow ||
        targetRow.owner_user_id === targetUserId ||
        ["faculty", "admin"].includes(targetRow.target_role)
      ) {
        return false
      }

      await getDb().query(
        `update projects
         set member_user_ids = array_remove(member_user_ids, $2),
             sprint_creator_user_ids = array_remove(sprint_creator_user_ids, $2),
             project_member = case
               when $3 <> '' then array_remove(project_member, $3)
               else project_member
             end
         where id = $1`,
        [projectId, targetUserId, targetRow.target_name]
      )

      await syncProjectGroupFromProject(projectId)

      return true
    },
    async () => false
  )
}
