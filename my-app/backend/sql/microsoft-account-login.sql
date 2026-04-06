create table if not exists microsoft_account_logins (
  id bigserial primary key,
  microsoft_user_id text not null,
  email text not null,
  name text not null,
  tenant_id text not null,
  login_at timestamptz not null default now()
);

create index if not exists microsoft_account_logins_lookup_idx
  on microsoft_account_logins(microsoft_user_id, login_at desc);