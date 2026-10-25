import { getDb } from "@/lib/server-db"
import {
  PROJECT_PROGRAM_OPTIONS,
  PROJECT_SY_TERM_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  PROJECT_YEAR_LEVEL_OPTIONS,
} from "@/lib/projects"

export type ProjectConfigurationCategory = "program" | "year_level" | "group_type" | "sy_term"

export type ProjectConfigurationOption = {
  id: string
  category: ProjectConfigurationCategory
  label: string
  displayOrder: number
}

type OptionRow = {
  id: string
  category: ProjectConfigurationCategory
  label: string
  display_order: number
}

let schemaReady: Promise<void> | null = null

const defaults: Record<ProjectConfigurationCategory, readonly string[]> = {
  program: PROJECT_PROGRAM_OPTIONS,
  year_level: PROJECT_YEAR_LEVEL_OPTIONS,
  group_type: PROJECT_TYPE_OPTIONS,
  sy_term: PROJECT_SY_TERM_OPTIONS,
}

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = getDb().query(`
      create table if not exists project_configuration_options (
        id uuid primary key default gen_random_uuid(),
        category text not null check (category in ('program', 'year_level', 'group_type', 'sy_term')),
        label text not null,
        display_order integer not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create unique index if not exists project_configuration_category_label_idx
      on project_configuration_options (category, lower(label));
      create table if not exists application_migrations (
        key text primary key,
        applied_at timestamptz not null default now()
      );
    `).then(async () => {
      const seedClaim = await getDb().query(
        `insert into application_migrations (key)
         values ('project_configuration_defaults_v1')
         on conflict do nothing
         returning key`
      )
      if (!seedClaim.rowCount) return
      for (const [category, labels] of Object.entries(defaults) as Array<[
        ProjectConfigurationCategory,
        readonly string[],
      ]>) {
        for (const [index, label] of labels.entries()) {
          await getDb().query(
            `insert into project_configuration_options (category, label, display_order)
             values ($1, $2, $3)
             on conflict do nothing`,
            [category, label, index]
          )
        }
      }
    }).catch((error) => {
      schemaReady = null
      throw error
    })
  }
  await schemaReady
}

function mapRow(row: OptionRow): ProjectConfigurationOption {
  return { id: row.id, category: row.category, label: row.label, displayOrder: row.display_order }
}

export async function listProjectConfigurationOptions() {
  await ensureSchema()
  const result = await getDb().query<OptionRow>(
    `select id, category, label, display_order
     from project_configuration_options
     order by category, display_order, label`
  )
  return result.rows.map(mapRow)
}

export async function createProjectConfigurationOption(
  category: ProjectConfigurationCategory,
  label: string
) {
  await ensureSchema()
  const result = await getDb().query<OptionRow>(
    `insert into project_configuration_options (category, label, display_order)
     values (
       $1,
       $2,
       coalesce((select max(display_order) + 1 from project_configuration_options where category = $1), 0)
     )
     returning id, category, label, display_order`,
    [category, label]
  )
  return mapRow(result.rows[0])
}

export async function updateProjectConfigurationOption(id: string, label: string) {
  await ensureSchema()
  const result = await getDb().query<OptionRow>(
    `update project_configuration_options
     set label = $2, updated_at = now()
     where id = $1
     returning id, category, label, display_order`,
    [id, label]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function deleteProjectConfigurationOption(id: string) {
  await ensureSchema()
  const result = await getDb().query(`delete from project_configuration_options where id = $1`, [id])
  return (result.rowCount ?? 0) > 0
}
