create table if not exists sprints (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  duration text not null default '',
  start_date date not null,
  end_date date not null,
  description text not null default '',
  created_by_user_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table sprints
add column if not exists duration text not null default '';

alter table sprints
add column if not exists description text not null default '';

alter table sprints
add column if not exists created_by_user_id text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_sprints_created_by_user_id'
  ) then
    alter table sprints
    add constraint fk_sprints_created_by_user_id
    foreign key (created_by_user_id) references microsoft_account_logins(microsoft_user_id)
    on delete restrict;
  end if;
end $$;

create index if not exists sprints_project_created_at_idx
  on sprints(project_id, created_at desc);

create index if not exists sprints_created_by_user_id_idx
  on sprints(created_by_user_id);

create table if not exists sprint_backlog_items (
  sprint_id uuid not null references sprints(id) on delete cascade,
  backlog_item_id uuid not null references backlog_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sprint_id, backlog_item_id)
);

create index if not exists sprint_backlog_items_backlog_item_id_idx
  on sprint_backlog_items(backlog_item_id);
