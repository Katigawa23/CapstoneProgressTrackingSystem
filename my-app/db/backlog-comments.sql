create table if not exists backlog_comments (
  id uuid primary key,
  backlog_item_id uuid not null references backlog_items(id) on delete cascade,
  author text not null,
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists backlog_comments_backlog_item_id_idx
  on backlog_comments(backlog_item_id, created_at asc);
