create table if not exists backlog_items (
  id uuid primary key,
  project_id uuid not null,
  title text not null,
  description text not null default '',
  start_date date,
  due_date date,
  status text not null check (
    status in ('todo', 'inprogress', 'inreview', 'revision', 'completed')
  ),
  checked boolean not null default false,
  assignee_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table backlog_items
add constraint fk_backlog_items_project_id
foreign key (project_id) references projects(id) on delete cascade;

