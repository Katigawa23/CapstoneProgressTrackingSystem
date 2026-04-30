create table if not exists backlog_comments (
  id uuid primary key,
  backlog_item_id uuid not null references backlog_items(id) on delete cascade,
  author_user_id text,
  author text not null,
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table backlog_comments
add column if not exists author_user_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_backlog_comments_author_user_id'
  ) then
    alter table backlog_comments
    add constraint fk_backlog_comments_author_user_id
    foreign key (author_user_id) references microsoft_account_logins(microsoft_user_id)
    on delete set null;
  end if;
end $$;

create index if not exists backlog_comments_backlog_item_id_idx
  on backlog_comments(backlog_item_id, created_at asc);

create index if not exists backlog_comments_author_user_id_idx
  on backlog_comments(author_user_id);
