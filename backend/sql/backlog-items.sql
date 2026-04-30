create table if not exists backlog_items (
  id uuid primary key,
  project_id uuid not null,
  parent_id uuid,
  sequence_number integer,
  order_index integer,
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

alter table backlog_items
add column if not exists parent_id uuid;

alter table backlog_items
add column if not exists sequence_number integer;

alter table backlog_items
add column if not exists order_index integer;

alter table backlog_items
add column if not exists assignee_id text;

with numbered_items as (
  select
    id,
    row_number() over (
      partition by project_id
      order by created_at asc, id asc
    ) as next_sequence_number
  from backlog_items
)
update backlog_items
set sequence_number = numbered_items.next_sequence_number
from numbered_items
where backlog_items.id = numbered_items.id
  and backlog_items.sequence_number is null;

alter table backlog_items
alter column sequence_number set not null;

with ordered_items as (
  select
    id,
    row_number() over (
      partition by project_id
      order by created_at asc, id asc
    ) as next_order_index
  from backlog_items
)
update backlog_items
set order_index = ordered_items.next_order_index
from ordered_items
where backlog_items.id = ordered_items.id
  and backlog_items.order_index is null;

alter table backlog_items
alter column order_index set not null;

create index if not exists backlog_items_project_order_idx
  on backlog_items(project_id, order_index asc, created_at asc);

create index if not exists backlog_items_project_parent_idx
  on backlog_items(project_id, parent_id, sequence_number asc);

create index if not exists backlog_items_parent_id_idx
  on backlog_items(parent_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_backlog_items_parent_id'
  ) then
    alter table backlog_items
    add constraint fk_backlog_items_parent_id
    foreign key (parent_id) references backlog_items(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_backlog_items_assignee_id'
  ) then
    alter table backlog_items
    add constraint fk_backlog_items_assignee_id
    foreign key (assignee_id) references microsoft_account_logins(microsoft_user_id)
    on delete set null;
  end if;
end $$;

create index if not exists backlog_items_assignee_id_idx
  on backlog_items(assignee_id);
