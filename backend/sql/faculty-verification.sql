alter table public.users add column if not exists faculty_verification_status text not null default 'approved' check (faculty_verification_status in ('pending','approved','rejected'));
alter table public.users alter column faculty_verification_status set default 'pending';
alter table public.users add column if not exists faculty_reviewed_by text;
alter table public.users add column if not exists faculty_reviewed_at timestamptz;
alter table public.users add column if not exists faculty_rejection_reason text;
