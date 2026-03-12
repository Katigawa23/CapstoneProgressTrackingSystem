create table if not exists projects (
  id uuid primary key,
  project_name text not null,
  project_description text not null default '',
  project_member text[] not null default '{}',
  created_at timestamptz not null default now()
);
