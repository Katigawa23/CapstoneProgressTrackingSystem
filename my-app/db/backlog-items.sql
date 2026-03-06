create table if not exists backlog_items (
  id uuid primary key,
  title text not null,
  description text not null default '',
  due_date date,
  status text not null check (
    status in ('todo', 'inprogress', 'inreview', 'revision', 'completed')
  ),
  checked boolean not null default false,
  file_name text,
  file_size text,
  file_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
