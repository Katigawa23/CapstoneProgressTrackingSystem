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
