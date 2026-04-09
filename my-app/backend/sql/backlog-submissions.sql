create table if not exists backlog_submissions (
  id uuid primary key,
  backlog_item_id uuid not null references backlog_items(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_type text not null default 'application/octet-stream',
  file_size integer not null default 0,
  uploaded_at timestamptz not null default now()
);

create index if not exists backlog_submissions_backlog_item_id_idx
  on backlog_submissions(backlog_item_id, uploaded_at desc);
