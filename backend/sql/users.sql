create extension if not exists pgcrypto;

create table if not exists users (
  id bigserial primary key,
  microsoft_user_id text not null unique,
  email text not null,
  name text not null,
  role text not null,
  tenant_id text not null,
  login_at timestamptz not null default now()
);

create unique index if not exists users_unique_user_idx
  on users(microsoft_user_id);

create index if not exists users_lookup_idx
  on users(microsoft_user_id, login_at desc);

-- Sample data
insert into users (microsoft_user_id, email, name, role, tenant_id)
values 
  ('5b-ace-94eb5216078d', 'morte.360342@alabang.sti.edu.ph', 'Morte, Kerby Bryan T.', 'student', 'common'),
  ('7c-def-12fg6327189e', 'nguyen.faculty@alabang.sti.edu.ph', 'Nguyen, Maria Santos', 'adviser', 'common'),
  ('test-adviser-001', 'adviser.test@alabang.sti.edu.ph', 'Test Adviser, Faculty', 'adviser', 'common')
on conflict do nothing;
