import { getDb } from "@/lib/server-db"
import { listProjectConfigurationOptions } from "@/lib/server-project-configuration"

export type StudentProfile = { program: string; yearLevel: string }

export const studentProfileSchema = `
  alter table public.users add column if not exists student_profile_required boolean not null default false;
  alter table public.users alter column student_profile_required set default true;
  create table if not exists public.student_profiles (
    user_id text primary key references public.users(microsoft_user_id) on delete cascade,
    program text not null check (char_length(btrim(program)) between 1 and 200),
    year_level text not null check (char_length(btrim(year_level)) between 1 and 100),
    section text check (char_length(btrim(section)) between 1 and 40),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  alter table public.student_profiles alter column section drop not null;
  alter table public.student_profiles add column if not exists program_option_id uuid references public.project_configuration_options(id) on delete set null;
  alter table public.student_profiles add column if not exists verification_status text not null default 'pending' check (verification_status in ('pending', 'approved', 'rejected'));
  alter table public.student_profiles add column if not exists reviewed_by_user_id text;
  alter table public.student_profiles add column if not exists reviewed_at timestamptz;
  alter table public.student_profiles add column if not exists rejection_reason text;
  update public.student_profiles p set program_option_id=o.id
    from public.project_configuration_options o
    where p.program_option_id is null and o.category='program' and o.label=p.program;
  create index if not exists student_profiles_program_status_idx on public.student_profiles(program_option_id, verification_status);
  alter table public.student_profiles enable row level security;
  revoke all on public.student_profiles from anon, authenticated;
`

let ready: Promise<unknown> | null = null
export async function ensureStudentProfileSchema() {
  ready ??= listProjectConfigurationOptions().then(() => getDb().query(studentProfileSchema)).catch((error) => { ready = null; throw error })
  await ready
}

export async function getStudentProfile(userId: string): Promise<StudentProfile | null> {
  await ensureStudentProfileSchema()
  const result = await getDb().query<StudentProfile>(
    `select program, year_level as "yearLevel" from public.student_profiles where user_id = $1`, [userId]
  )
  return result.rows[0] ?? null
}

export async function needsStudentProfileSetup(userId: string) {
  await ensureStudentProfileSchema()
  const result = await getDb().query<{ required: boolean }>(
    `select exists(select 1 from public.users u where u.microsoft_user_id = $1
       and u.student_profile_required = true
       and not exists(select 1 from public.student_profiles p where p.user_id = u.microsoft_user_id)) as required`,
    [userId]
  )
  return result.rows[0]?.required === true
}

export async function saveStudentProfile(userId: string, profile: StudentProfile, programId: string) {
  await ensureStudentProfileSchema()
  await getDb().query(
    `insert into public.student_profiles(user_id, program, year_level, program_option_id) values ($1,$2,$3,$4)
     on conflict (user_id) do update set program = excluded.program,
       year_level = excluded.year_level, program_option_id = excluded.program_option_id,
       verification_status = 'pending', reviewed_by_user_id = null, reviewed_at = null,
       rejection_reason = null, updated_at = now()
     where student_profiles.verification_status = 'rejected'`,
    [userId, profile.program, profile.yearLevel, programId]
  )
}

export type StudentAccessState = {
  required: boolean; profileComplete: boolean
  status: "pending" | "approved" | "rejected" | null
  reason: string | null; program: string | null; yearLevel: string | null
}

export async function getStudentAccessState(userId: string): Promise<StudentAccessState> {
  await ensureStudentProfileSchema()
  const result = await getDb().query<StudentAccessState>(
    `select u.student_profile_required as required, (p.user_id is not null) as "profileComplete",
       p.verification_status as status, p.rejection_reason as reason,
       coalesce(o.label,p.program) as program, p.year_level as "yearLevel"
     from public.users u left join public.student_profiles p on p.user_id=u.microsoft_user_id
     left join public.project_configuration_options o on o.id=p.program_option_id
     where u.microsoft_user_id=$1 order by u.login_at desc limit 1`, [userId]
  )
  return result.rows[0] ?? { required: true, profileComplete: false, status: null, reason: null, program: null, yearLevel: null }
}
