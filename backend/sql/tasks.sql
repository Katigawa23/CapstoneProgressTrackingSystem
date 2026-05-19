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
