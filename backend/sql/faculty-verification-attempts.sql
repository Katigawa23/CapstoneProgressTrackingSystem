alter table public.users add column if not exists faculty_submission_attempts timestamptz[] not null default '{}';
alter table public.users alter column faculty_submission_attempts set default array[now()];
alter table public.users add column if not exists faculty_requested_at timestamptz not null default now();
update public.users set faculty_submission_attempts=array[now()] where role='faculty' and faculty_verification_status in ('pending','rejected') and cardinality(faculty_submission_attempts)=0;
