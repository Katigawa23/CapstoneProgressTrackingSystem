-- Existing accounts are exempt. New students require coordinator verification.

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

