import { getDb } from "@/lib/server-db"
import { listProjectConfigurationOptions } from "@/lib/server-project-configuration"
import { ensureMicrosoftLoginSchema } from "@backend/repositories/users-repository"

export type CoordinatorAssignment = {
  programId: string
  programLabel: string
  facultyUserId: string | null
  facultyName: string | null
  facultyEmail: string | null
  assignedAt: string | null
}

let schemaReady: Promise<void> | null = null

async function ensureSchema() {
  await Promise.all([listProjectConfigurationOptions(), ensureMicrosoftLoginSchema()])
  if (!schemaReady) {
    schemaReady = getDb().query(`
      create table if not exists program_coordinator_assignments (
        program_option_id uuid primary key references project_configuration_options(id) on delete restrict,
        faculty_user_id text not null,
        assigned_by_user_id text not null,
        assigned_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create index if not exists program_coordinator_faculty_idx
      on program_coordinator_assignments(faculty_user_id);
      delete from program_coordinator_assignments older_assignment
      using program_coordinator_assignments newer_assignment
      where older_assignment.faculty_user_id = newer_assignment.faculty_user_id
        and (
          older_assignment.updated_at < newer_assignment.updated_at
          or (
            older_assignment.updated_at = newer_assignment.updated_at
            and older_assignment.program_option_id::text < newer_assignment.program_option_id::text
          )
        );
      create unique index if not exists program_coordinator_one_program_per_faculty_idx
      on program_coordinator_assignments(faculty_user_id);
      update users
      set role = 'faculty'
      where microsoft_user_id = 'tester-coordinator';
    `).then(() => undefined).catch((error) => { schemaReady = null; throw error })
  }
  await schemaReady
}

export const ensureCoordinatorAssignmentSchema = ensureSchema

export async function listCoordinatorAssignments(): Promise<CoordinatorAssignment[]> {
  await ensureSchema()
  const result = await getDb().query<{
    program_id: string; program_label: string; faculty_user_id: string | null
    faculty_name: string | null; faculty_email: string | null; assigned_at: string | null
  }>(`
    with latest_users as (
      select distinct on (microsoft_user_id) microsoft_user_id, name, email
      from users order by microsoft_user_id, login_at desc
    )
    select option.id as program_id, option.label as program_label,
      assignment.faculty_user_id, faculty.name as faculty_name,
      faculty.email as faculty_email, assignment.assigned_at::text
    from project_configuration_options option
    left join program_coordinator_assignments assignment on assignment.program_option_id = option.id
    left join latest_users faculty on faculty.microsoft_user_id = assignment.faculty_user_id
    where option.category = 'program'
    order by option.display_order, option.label
  `)
  return result.rows.map((row) => ({
    programId: row.program_id, programLabel: row.program_label,
    facultyUserId: row.faculty_user_id, facultyName: row.faculty_name,
    facultyEmail: row.faculty_email, assignedAt: row.assigned_at,
  }))
}

export async function assignProgramCoordinator(programId: string, facultyUserId: string, assignedBy: string) {
  await ensureSchema()
  const validation = await getDb().query<{ valid_program: boolean; valid_faculty: boolean; assigned_elsewhere: boolean }>(`
    select
      exists(select 1 from project_configuration_options where id = $1 and category = 'program') as valid_program,
      exists(
        select 1 from users where microsoft_user_id = $2
        and lower(role) in ('faculty', 'adviser')
      ) as valid_faculty,
      exists(
        select 1 from program_coordinator_assignments
        where faculty_user_id = $2 and program_option_id <> $1
      ) as assigned_elsewhere
  `, [programId, facultyUserId])
  if (!validation.rows[0]?.valid_program) throw new Error("INVALID_PROGRAM")
  if (!validation.rows[0]?.valid_faculty) throw new Error("INVALID_FACULTY")
  if (validation.rows[0]?.assigned_elsewhere) throw new Error("COORDINATOR_ALREADY_ASSIGNED")
  await getDb().query(`
    insert into program_coordinator_assignments
      (program_option_id, faculty_user_id, assigned_by_user_id)
    values ($1, $2, $3)
    on conflict (program_option_id) do update set
      faculty_user_id = excluded.faculty_user_id,
      assigned_by_user_id = excluded.assigned_by_user_id,
      assigned_at = now(), updated_at = now()
  `, [programId, facultyUserId, assignedBy])
}

export async function removeProgramCoordinator(programId: string) {
  await ensureSchema()
  const result = await getDb().query(`delete from program_coordinator_assignments where program_option_id = $1`, [programId])
  return (result.rowCount ?? 0) > 0
}

export async function isAssignedCoordinator(userId: string) {
  await ensureSchema()
  const result = await getDb().query<{ assigned: boolean }>(
    `select exists(select 1 from program_coordinator_assignments where faculty_user_id = $1) as assigned`,
    [userId]
  )
  return result.rows[0]?.assigned === true
}

export async function listAssignedCoordinatorProgramLabels(userId: string) {
  await ensureSchema()
  const result = await getDb().query<{ label: string }>(`
    select option.label
    from program_coordinator_assignments assignment
    inner join project_configuration_options option on option.id = assignment.program_option_id
    where assignment.faculty_user_id = $1 and option.category = 'program'
    order by option.display_order, option.label
  `, [userId])
  return result.rows.map((row) => row.label)
}
