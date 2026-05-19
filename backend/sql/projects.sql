create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null default '',
  project_name text not null,
  project_member text[] not null default '{}',
  project_adviser text[] not null default '{}',
  member_user_ids text[] not null default '{}',
  sprint_creator_user_ids text[] not null default '{}',
  is_starred boolean not null default false,
  program text not null default '',
  year_level text not null default '',
  sy_term text not null default '',
  project_type text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  group_name text not null default '',
  adviser_user_id text references users(microsoft_user_id) on delete set null,
  created_by_user_id text references users(microsoft_user_id) on delete set null,
  member_user_ids text[] not null default '{}',
  sprint_creator_user_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists groups_project_id_idx
  on groups(project_id);

create index if not exists groups_adviser_user_id_idx
  on groups(adviser_user_id);

create table if not exists project_starred_preferences (
  project_id uuid not null references projects(id) on delete cascade,
  user_id text not null references users(microsoft_user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists projects_owner_user_id_idx
  on projects(owner_user_id);

create index if not exists project_starred_preferences_user_id_idx
  on project_starred_preferences(user_id, created_at desc);
