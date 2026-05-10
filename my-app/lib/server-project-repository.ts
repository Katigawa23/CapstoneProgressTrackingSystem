import { randomUUID } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

import { getPreferredStorageMode } from "@backend/config/storage-mode"
import { getDb } from "@/lib/server-db"
import {
  canUseLocalFileFallback,
  shouldFallbackToLocalStore,
} from "@backend/db/fallback"
import { ensureMicrosoftLoginSchema } from "@backend/repositories/microsoft-login-repository"
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

type ProjectMemberAccessRecord = {
  project_id: string
  member_user_id: string
  member_role: string
  can_create_sprint: boolean
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
        create table if not exists project_member_access (
          project_id uuid not null references projects(id) on delete cascade,
          member_user_id text not null references microsoft_account_logins(microsoft_user_id) on delete cascade,
          member_role text not null default 'student',
          can_create_sprint boolean not null default false,
          created_at timestamptz not null default now(),
          primary key (project_id, member_user_id)
        );
      `)
      )
      .then(() =>
        getDb().query(`
        create table if not exists project_starred_preferences (
          project_id uuid not null references projects(id) on delete cascade,
          user_id text not null references microsoft_account_logins(microsoft_user_id) on delete cascade,
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
          alter table project_member_access
          add column if not exists member_role text not null default 'student';
        `)
      )
      .then(() =>
        getDb().query(`
          alter table project_member_access
          add column if not exists can_create_sprint boolean not null default false;
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists project_member_access_member_user_id_idx
          on project_member_access(member_user_id);
        `)
      )
      .then(() =>
        getDb().query(`
          create index if not exists project_member_access_project_id_idx
          on project_member_access(project_id);
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
              foreign key (owner_user_id) references microsoft_account_logins(microsoft_user_id)
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
          insert into project_member_access (
            project_id,
            member_user_id,
            member_role,
            can_create_sprint
          )
          select
            p.id,
            login.microsoft_user_id,
            'student',
            login.microsoft_user_id = any(p.sprint_creator_user_ids)
          from projects p
          cross join unnest(p.member_user_ids) as member_user_id
          inner join microsoft_account_logins login
            on login.microsoft_user_id = member_user_id
          on conflict (project_id, member_user_id) do update
          set can_create_sprint = excluded.can_create_sprint;
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

function mapRecord(record: ProjectRecord): DashboardProject {
  return {
    id: record.id,
    name: record.project_name,
    members: record.project_member,
    advisers: record.project_adviser,
    sprintCreatorUserIds: record.sprint_creator_user_ids,
    starred: record.is_starred,
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
           from microsoft_account_logins
           order by microsoft_user_id, login_at desc
         )
         select
           projects.id,
           projects.owner_user_id,
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
    return
  }

  const placeholders = normalizedAccess
    .map((_, index) => `($1, $${index * 3 + 2}, $${index * 3 + 3}, $${index * 3 + 4})`)
    .join(", ")
  const parameters: Array<string | boolean> = [projectId]

  for (const member of normalizedAccess) {
    parameters.push(member.userId, member.role, member.canCreateSprint)
  }

  await getDb().query<ProjectMemberAccessRecord>(
    `insert into project_member_access (
       project_id,
       member_user_id,
       member_role,
       can_create_sprint
     )
     select
       incoming.project_id,
       login.microsoft_user_id,
       incoming.member_role,
       incoming.can_create_sprint
     from (
       values ${placeholders}
     ) as incoming(project_id, member_user_id, member_role, can_create_sprint)
     inner join microsoft_account_logins login
       on login.microsoft_user_id = incoming.member_user_id
     on conflict (project_id, member_user_id) do update
     set member_role = excluded.member_role,
         can_create_sprint = excluded.can_create_sprint`,
    parameters
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
           or coalesce(pma.can_create_sprint, false)
         ) as can_create_sprint
         from projects p
         left join project_member_access pma
           on pma.project_id = p.id
          and pma.member_user_id = $2
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
