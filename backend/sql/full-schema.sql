create extension if not exists pgcrypto;

create table if not exists users (
  id bigserial primary key,
  microsoft_user_id text not null unique,
  email text not null,
  name text not null,
  role text not null,
  tenant_id text not null,
  login_at timestamptz not null default now()
);

create unique index if not exists users_unique_user_idx
  on users(microsoft_user_id);

create index if not exists users_lookup_idx
  on users(microsoft_user_id, login_at desc);

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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_projects_owner_user_id'
  ) then
    alter table projects
    add constraint fk_projects_owner_user_id
    foreign key (owner_user_id) references users(microsoft_user_id)
    on delete restrict;
  end if;
end $$;

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

create table if not exists backlog (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  parent_id uuid references backlog(id) on delete cascade,
  sequence_number integer not null,
  order_index integer not null,
  created_by_user_id text references users(microsoft_user_id) on delete set null,
  archived_by_user_id text references users(microsoft_user_id) on delete set null,
  deleted_by_user_id text references users(microsoft_user_id) on delete set null,
  title text not null,
  description text not null default '',
  start_date date,
  due_date date,
  status text not null default 'todo' check (
    status in ('todo', 'inprogress', 'inreview', 'revision', 'completed')
  ),
  checked boolean not null default false,
  assignee_id text references users(microsoft_user_id) on delete set null,
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High')),
  is_archived boolean not null default false,
  archived_at timestamptz,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists backlog_project_order_idx
  on backlog(project_id, order_index asc, created_at asc);

create index if not exists backlog_created_by_user_id_idx
  on backlog(created_by_user_id);

create index if not exists backlog_project_parent_idx
  on backlog(project_id, parent_id, sequence_number asc);

create index if not exists backlog_parent_id_idx
  on backlog(parent_id);

create index if not exists backlog_assignee_id_idx
  on backlog(assignee_id);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  sequence_number integer not null,
  order_index integer not null,
  created_by_user_id text references users(microsoft_user_id) on delete set null,
  archived_by_user_id text references users(microsoft_user_id) on delete set null,
  deleted_by_user_id text references users(microsoft_user_id) on delete set null,
  title text not null,
  description text not null default '',
  start_date date,
  due_date date,
  status text not null default 'todo' check (
    status in ('todo', 'inprogress', 'inreview', 'revision', 'completed')
  ),
  checked boolean not null default false,
  assignee_id text references users(microsoft_user_id) on delete set null,
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High')),
  is_archived boolean not null default false,
  archived_at timestamptz,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  sequence_number integer not null,
  order_index integer not null,
  created_by_user_id text references users(microsoft_user_id) on delete set null,
  archived_by_user_id text references users(microsoft_user_id) on delete set null,
  deleted_by_user_id text references users(microsoft_user_id) on delete set null,
  title text not null,
  description text not null default '',
  start_date date,
  due_date date,
  status text not null default 'todo' check (
    status in ('todo', 'inprogress', 'inreview', 'revision', 'completed')
  ),
  checked boolean not null default false,
  assignee_id text references users(microsoft_user_id) on delete set null,
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High')),
  is_archived boolean not null default false,
  archived_at timestamptz,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_project_order_idx
  on tasks(project_id, order_index asc, created_at asc);

create index if not exists tasks_assignee_id_idx
  on tasks(assignee_id);

create index if not exists subtasks_task_id_idx
  on subtasks(task_id, sequence_number asc);

create index if not exists subtasks_project_order_idx
  on subtasks(project_id, order_index asc, created_at asc);

create index if not exists subtasks_assignee_id_idx
  on subtasks(assignee_id);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  backlog_item_id uuid not null references backlog(id) on delete cascade,
  author_user_id text references users(microsoft_user_id) on delete set null,
  author text not null,
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  constraint comments_check check (
    nullif(btrim(body), '') is not null
    or jsonb_array_length(attachments) > 0
  ),
  created_at timestamptz not null default now()
);

create index if not exists comments_backlog_item_id_idx
  on comments(backlog_item_id, created_at asc);

create index if not exists comments_author_user_id_idx
  on comments(author_user_id);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  backlog_item_id uuid not null references backlog(id) on delete cascade,
  uploaded_by_user_id text references users(microsoft_user_id) on delete set null,
  archived_by_user_id text references users(microsoft_user_id) on delete set null,
  deleted_by_user_id text references users(microsoft_user_id) on delete set null,
  attachment_type text not null default 'file' check (
    attachment_type in ('file', 'link')
  ),
  file_name text not null,
  file_url text not null,
  file_type text not null default 'application/octet-stream',
  file_size integer not null default 0,
  file_data bytea,
  link_label text not null default '',
  is_archived boolean not null default false,
  archived_at timestamptz,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  uploaded_at timestamptz not null default now()
);

create index if not exists attachments_backlog_item_id_idx
  on attachments(backlog_item_id, uploaded_at desc);

create index if not exists attachments_uploaded_by_user_id_idx
  on attachments(uploaded_by_user_id);

create index if not exists attachments_type_idx
  on attachments(backlog_item_id, attachment_type, uploaded_at desc);

create table if not exists weblinks (
  id uuid primary key default gen_random_uuid(),
  backlog_item_id uuid not null references backlog(id) on delete cascade,
  uploaded_by_user_id text references users(microsoft_user_id) on delete set null,
  archived_by_user_id text references users(microsoft_user_id) on delete set null,
  deleted_by_user_id text references users(microsoft_user_id) on delete set null,
  url text not null,
  label text not null default '',
  is_archived boolean not null default false,
  archived_at timestamptz,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  uploaded_at timestamptz not null default now()
);

create index if not exists weblinks_backlog_item_id_idx
  on weblinks(backlog_item_id, uploaded_at desc);

create index if not exists weblinks_uploaded_by_user_id_idx
  on weblinks(uploaded_by_user_id);
