create table if not exists projects (
  id uuid primary key,
  project_name text not null,
  project_description text default '',
  project_member text[] not null default '{}',
  program text not null default '',
  year_level text not null default '',
  sy_term text not null default '',
  project_type text not null default '',
  created_at timestamptz not null default now()
);

alter table projects
add column if not exists program text not null default '';

alter table projects
add column if not exists year_level text not null default '';

alter table projects
add column if not exists sy_term text not null default '';

alter table projects
add column if not exists project_type text not null default '';
