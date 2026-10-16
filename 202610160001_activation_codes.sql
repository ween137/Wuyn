-- Safe one-time activation-code storage. No raw activation code is stored.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.activation_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  assigned_role text not null check (assigned_role in ('driver','office','customer')),
  full_name text not null default '',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique(phone, code_hash)
);
revoke all on private.activation_codes from public, anon, authenticated;

-- Only service_role can consume a code. The update is atomic, so parallel requests cannot redeem it twice.
create or replace function public.consume_activation_code(p_phone text, p_code_hash text)
returns table(activation_id uuid, assigned_role text, full_name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update private.activation_codes a
     set used_at = pg_catalog.now()
   where a.phone = p_phone
     and a.code_hash = p_code_hash
     and a.used_at is null
     and a.expires_at > pg_catalog.now()
  returning a.id, a.assigned_role, a.full_name;
end;
$$;
revoke all on function public.consume_activation_code(text,text) from public, anon, authenticated;
grant execute on function public.consume_activation_code(text,text) to service_role;

-- Do not allow the browser roles to read or mutate invitation codes.

-- Per-phone throttling: allow at most 8 activation attempts per 15-minute window.
create table if not exists private.activation_attempts (
  phone text primary key,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now()
);
revoke all on private.activation_attempts from public, anon, authenticated;
create or replace function public.allow_activation_attempt(p_phone text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  insert into private.activation_attempts(phone, attempts, window_started_at)
  values (p_phone, 1, pg_catalog.now())
  on conflict (phone) do update set
    attempts = case when private.activation_attempts.window_started_at < pg_catalog.now() - interval '15 minutes' then 1 else private.activation_attempts.attempts + 1 end,
    window_started_at = case when private.activation_attempts.window_started_at < pg_catalog.now() - interval '15 minutes' then pg_catalog.now() else private.activation_attempts.window_started_at end
  returning attempts into n;
  return n <= 8;
end;
$$;
revoke all on function public.allow_activation_attempt(text) from public, anon, authenticated;
grant execute on function public.allow_activation_attempt(text) to service_role;
