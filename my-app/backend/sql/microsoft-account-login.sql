create table if not exists microsoft_account_logins (
  id bigserial primary key,
  microsoft_user_id text not null,
  email text not null,
  name text not null,
  role text not null,
  tenant_id text not null,
  login_at timestamptz not null default now()
);

create unique index if not exists microsoft_account_logins_unique_user_idx
  on microsoft_account_logins(microsoft_user_id);

create index if not exists microsoft_account_logins_lookup_idx
  on microsoft_account_logins(microsoft_user_id, login_at desc);

-- Sample data
insert into microsoft_account_logins (microsoft_user_id, email, name, role, tenant_id)
values 
  ('5b-ace-94eb5216078d', 'morte.360342@alabang.sti.edu.ph', 'Morte, Kerby Bryan T.', 'student', 'common'),
  ('7c-def-12fg6327189e', 'nguyen.faculty@alabang.sti.edu.ph', 'Nguyen, Maria Santos', 'faculty', 'common')
on conflict do nothing;
