create table if not exists backlog_weblinks (
  id uuid primary key,
  backlog_item_id uuid not null references backlog_items(id) on delete cascade,
  url text not null,
  label text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists backlog_weblinks_backlog_item_id_idx
  on backlog_weblinks(backlog_item_id, created_at desc);

-- Example insert query:
-- replace the sample values before running
--
-- insert into backlog_weblinks (
--   id,
--   backlog_item_id,
--   url,
--   label
-- )
-- values (
--   gen_random_uuid(),
--   '00000000-0000-0000-0000-000000000000',
--   'https://example.com',
--   coalesce('Reference link', '')
-- )
-- returning id, backlog_item_id, url, label, created_at;

-- Example list query:
--
-- select
--   id,
--   backlog_item_id,
--   url,
--   label,
--   created_at
-- from backlog_weblinks
-- where backlog_item_id = '00000000-0000-0000-0000-000000000000'
-- order by created_at desc;

-- Example delete query:
--
-- delete from backlog_weblinks
-- where id = '00000000-0000-0000-0000-000000000000'
--   and backlog_item_id = '00000000-0000-0000-0000-000000000000'
-- returning id, backlog_item_id, url, label, created_at;
