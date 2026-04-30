create table if not exists projects (
  id uuid primary key,
  owner_user_id text not null default '',
  member_user_ids text[] not null default '{}',
  project_name text not null,
  project_member text[] not null default '{}',
  project_adviser text[] not null default '{}',
  is_starred boolean not null default false,
  program text not null default '',
  year_level text not null default '',
  sy_term text not null default '',
  project_type text not null default '',
  created_at timestamptz not null default now()
);

alter table projects
add column if not exists owner_user_id text not null default '';

alter table projects
add column if not exists member_user_ids text[] not null default '{}';

alter table projects
add column if not exists project_adviser text[] not null default '{}';

alter table projects
add column if not exists is_starred boolean not null default false;

alter table projects
add column if not exists program text not null default '';

alter table projects
add column if not exists year_level text not null default '';

alter table projects
add column if not exists sy_term text not null default '';

alter table projects
add column if not exists project_type text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_projects_owner_user_id'
  ) then
    alter table projects
    add constraint fk_projects_owner_user_id
    foreign key (owner_user_id) references microsoft_account_logins(microsoft_user_id)
    on delete restrict;
  end if;
end $$;

create index if not exists projects_owner_user_id_idx
  on projects(owner_user_id);
