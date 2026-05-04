create table if not exists backlog_attachment (
  id uuid primary key,
  backlog_item_id uuid not null references backlog_items(id) on delete cascade,
  attachment_type text not null default 'file' check (
    attachment_type in ('file', 'link')
  ),
  file_name text not null,
  file_url text not null,
  file_type text not null default 'application/octet-stream',
  file_size integer not null default 0,
  link_label text not null default '',
  uploaded_at timestamptz not null default now()
);

create index if not exists backlog_attachment_backlog_item_id_idx
  on backlog_attachment(backlog_item_id, uploaded_at desc);

create index if not exists backlog_attachment_type_idx
  on backlog_attachment(backlog_item_id, attachment_type, uploaded_at desc);
