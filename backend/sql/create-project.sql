create table if not exists projects (
  id uuid primary key,
  owner_user_id text not null default '',
  member_user_ids text[] not null default '{}',
  sprint_creator_user_ids text[] not null default '{}',
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
add column if not exists sprint_creator_user_ids text[] not null default '{}';

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

create table if not exists project_starred_preferences (
  project_id uuid not null references projects(id) on delete cascade,
  user_id text not null references microsoft_account_logins(microsoft_user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_starred_preferences_user_id_idx
  on project_starred_preferences(user_id, created_at desc);
