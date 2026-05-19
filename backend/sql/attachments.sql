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
