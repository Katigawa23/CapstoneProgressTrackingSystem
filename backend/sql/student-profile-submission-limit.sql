alter table public.student_profiles add column if not exists submission_attempts timestamptz[] not null default '{}';
