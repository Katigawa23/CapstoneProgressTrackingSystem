import { randomUUID } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

import { getPreferredStorageMode } from "@/backend/config/storage-mode"
import { getDb } from "@/backend/db/connection"
import {
  dashboardProjects,
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_TITLE_MAX_LENGTH,
  type DashboardProject,
} from "@/lib/projects"

type ProjectRecord = {
  id: string
  project_name: string
  project_description: string
  project_member: string[]
  created_at: string
}

type CreateProjectInput = {
  name: string
  description: string
  members: string[]
}

type ProjectStorageMode = "database" | "file"

const projectsFilePath = path.join(process.cwd(), ".data", "projects.json")

let schemaReady: Promise<void> | null = null
let storageModePromise: Promise<ProjectStorageMode> | null = null
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
          project_name text not null,
          project_description text not null default '',
          project_member text[] not null default '{}',
          created_at timestamptz not null default now()
        );
      `)
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
            ) and not exists (
              select 1
              from information_schema.columns
              where table_name = 'projects' and column_name = 'project_description'
            ) then
              alter table projects rename column description to project_description;
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
        if (!canUseFileFallback()) {
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
    return JSON.parse(raw) as ProjectRecord[]
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
    description: record.project_description,
    members: record.project_member,
  }
}

function toRecord(project: DashboardProject): ProjectRecord {
  return {
    id: project.id,
    project_name: project.name,
    project_description: project.description,
    project_member: project.members,
    created_at: new Date().toISOString(),
  }
}

function normalizeProject(input: CreateProjectInput): DashboardProject {
  return {
    id: randomUUID(),
    name: input.name.trim().slice(0, PROJECT_TITLE_MAX_LENGTH),
    description: input.description.trim().slice(0, PROJECT_DESCRIPTION_MAX_LENGTH),
    members: input.members,
  }
}

export async function listProjects() {
  return withProjectStore(
    async () => {
      const result = await getDb().query<ProjectRecord>(
        `select id, project_name, project_description, project_member, created_at
         from projects
         order by created_at desc`
      )

      return [...dashboardProjects, ...result.rows.map(mapRecord)]
    },
    async () => {
      const records = await readFileRecords()
      return [...dashboardProjects, ...records.map(mapRecord)]
    }
  )
}

export async function createProject(input: CreateProjectInput) {
  return withProjectStore(
    async () => {
      const project = normalizeProject(input)

      const result = await getDb().query<ProjectRecord>(
        `insert into projects (id, project_name, project_description, project_member)
         values ($1, $2, $3, $4)
         returning id, project_name, project_description, project_member, created_at`,
        [project.id, project.name, project.description, project.members]
      )

      return mapRecord(result.rows[0])
    },
    async () => {
      const project = normalizeProject(input)
      const records = await readFileRecords()
      records.unshift(toRecord(project))
      await writeFileRecords(records)
      return project
    }
  )
}
