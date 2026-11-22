-- =====================================================================
-- supabase_upgrade.sql  —  وين؟ (Wuyn)   |   idempotent: آمن للتشغيل أكثر من مرة
-- يبني فوق المخطط الحيّ الحالي (rides/profiles/customer_identity/settings/...)
-- لا يحذف أي بيانات. الدوال القديمة request_ride/request_delivery/send_quote
-- تُستبدل بنسخ تقبل معاملات إضافية (device_id, GPS الحيّ, mock).
-- شغّله ثم انشر الواجهة مباشرة (انظر RELEASE_CHECKLIST_UPGRADE.md).
-- =====================================================================
begin;

create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------
-- 0) إعدادات افتراضية (لا تُستبدل إن كانت موجودة). كلها قابلة للتعديل من لوحة الإدارة
--    first_ride_discount / daily_promo_cap = 0  ⇒ الخصومات مغلقة حتى يفعّلها المدير
-- ---------------------------------------------------------------
insert into public.settings(key, value)
select v.k, v.v from (values
  ('commission_individual', '15'),
  ('commission_fleet',      '10'),
  ('fleet_min_vehicles',    '5'),
  ('launch_promo_days',     '30'),
  ('launch_promo_global_until', ''),
  ('daily_promo_cap',       '0'),
  ('first_ride_discount',   '0'),
  ('referral_credit',       '0'),
  ('min_promo_distance_m',  '1000'),
  ('pickup_radius_m',       '500'),
  ('collusion_gps_m',       '30'),
  ('cancel_move_m',         '300'),
  ('cancel_strike_limit',   '2'),
  ('cargo_kyc_threshold',   '500000'),
  ('cargo_kyc_all',         '0'),
  ('require_device',        '1')
) as v(k, v)
where not exists (select 1 from public.settings s where s.key = v.k);

create or replace function private.sn(p_key text, p_def numeric) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce((select case when btrim(s.value) ~ '^[0-9]+(\.[0-9]+)?$' then btrim(s.value)::numeric end
                     from public.settings s where s.key = p_key limit 1), p_def);
$$;

-- ---------------------------------------------------------------
-- 1) أعمدة جديدة على rides (تُحفظ على كل طلب ولا تتغير تاريخياً)
-- ---------------------------------------------------------------
alter table public.rides add column if not exists commission_rate   numeric(5,2);
alter table public.rides add column if not exists commission_amount integer;
alter table public.rides add column if not exists promo_discount    integer not null default 0;
alter table public.rides add column if not exists net_to_driver     integer;

create index if not exists rides_accepted_status_idx on public.rides (accepted_by, status);
create index if not exists rides_customer_status_idx on public.rides (customer_id, status);
create index if not exists rides_completed_idx       on public.rides (completed_at) where status = 'completed';
create index if not exists ride_track_ride_kind_idx  on public.ride_track (ride_id, kind, t, id);

-- ---------------------------------------------------------------
-- 2) جداول خاصة (schema private غير مكشوف عبر API) لمكافحة الاحتيال
-- ---------------------------------------------------------------
create table if not exists private.user_flags (
  user_id uuid primary key,
  strikes int not null default 0,
  kyc_required boolean not null default false,
  restricted_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists private.device_flags (
  device_id text primary key,
  strikes int not null default 0,
  restricted boolean not null default false,
  banned boolean not null default false,
  restricted_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists private.devices (
  device_id text not null,
  user_id uuid not null,
  first_seen timestamptz not null default now(),
  primary key (device_id, user_id)
);
create index if not exists devices_user_idx on private.devices (user_id);
create table if not exists private.ride_meta (
  ride_id bigint primary key references public.rides(id) on delete cascade,
  device_id text,
  customer_ip text,
  provider_ip text,
  cust_lat double precision,
  cust_lng double precision,
  near_m double precision,
  pin text,
  pin_tries int not null default 0,
  pin_ok boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ride_meta_device_idx on private.ride_meta (device_id);
alter table private.user_flags   enable row level security;
alter table private.device_flags enable row level security;
alter table private.devices      enable row level security;
alter table private.ride_meta    enable row level security;

-- ---------------------------------------------------------------
-- 3) جداول عامة بسياسات RLS (قراءة فقط للمالك/المدير، الكتابة عبر RPC فقط)
-- ---------------------------------------------------------------
create table if not exists public.provider_terms (
  provider_id uuid primary key references public.profiles(id) on delete cascade,
  commission_override numeric(5,2) check (commission_override between 0 and 100),
  promo_until timestamptz,
  note text,
  updated_at timestamptz not null default now()
);
create table if not exists public.commission_ledger (
  id bigint generated always as identity primary key,
  ride_id bigint references public.rides(id) on delete set null,
  user_id uuid not null,
  kind text not null check (kind in ('commission','promo_refund','referral_credit','credit_used','adjust')),
  amount integer not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists ledger_user_idx on public.commission_ledger (user_id, created_at desc);
create index if not exists ledger_kind_idx on public.commission_ledger (kind, created_at);
create table if not exists public.referral_codes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.referrals (
  id bigint generated always as identity primary key,
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','rewarded','rejected')),
  device_id text,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id);

alter table public.provider_terms   enable row level security;
alter table public.commission_ledger enable row level security;
alter table public.referral_codes   enable row level security;
alter table public.referrals        enable row level security;

drop policy if exists provider_terms_read on public.provider_terms;
create policy provider_terms_read on public.provider_terms for select to authenticated
  using (provider_id = (select auth.uid()) or public.is_admin());
drop policy if exists provider_terms_admin on public.provider_terms;
create policy provider_terms_admin on public.provider_terms for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists ledger_read on public.commission_ledger;
create policy ledger_read on public.commission_ledger for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
drop policy if exists referral_codes_read on public.referral_codes;
create policy referral_codes_read on public.referral_codes for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
drop policy if exists referrals_read on public.referrals;
create policy referrals_read on public.referrals for select to authenticated
  using (referrer_id = (select auth.uid()) or referred_id = (select auth.uid()) or public.is_admin());

-- ---------------------------------------------------------------
-- 4) دوال مساعدة خاصة
-- ---------------------------------------------------------------
create or replace function private.client_ip() returns text
language sql stable set search_path = '' as $$
  select nullif(btrim(split_part(coalesce((nullif(pg_catalog.current_setting('request.headers', true), ''))::json ->> 'x-forwarded-for', ''), ',', 1)), '');
$$;

create or replace function private.valid_device(p_device text) returns boolean
language sql immutable set search_path = '' as $$
  select p_device is not null and p_device ~ '^[A-Za-z0-9_-]{16,128}$';
$$;

-- حالة الحارس: ok | identity_required | banned
create or replace function private.guard_state(p_uid uuid, p_device text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_ver timestamptz; v_kyc boolean; v_kyc_at timestamptz;
  v_dres boolean; v_dat timestamptz; v_ban boolean;
begin
  select verified_at into v_ver from public.customer_identity where user_id = p_uid;
  select kyc_required, restricted_at into v_kyc, v_kyc_at from private.user_flags where user_id = p_uid;
  if p_device is not null then
    select restricted, restricted_at, banned into v_dres, v_dat, v_ban from private.device_flags where device_id = p_device;
  end if;
  if coalesce(v_ban, false) then return 'banned'; end if;
  if (coalesce(v_kyc, false) and (v_ver is null or v_ver <= coalesce(v_kyc_at, '-infinity')))
     or (coalesce(v_dres, false) and (v_ver is null or v_ver <= coalesce(v_dat, '-infinity'))) then
    return 'identity_required';
  end if;
  return 'ok';
end $$;

create or replace function private.guard_check(p_uid uuid, p_device text) returns void
language plpgsql stable security definer set search_path = '' as $$
declare s text := private.guard_state(p_uid, p_device);
begin
  if s = 'banned' then raise exception 'account_restricted'; end if;
  if s = 'identity_required' then raise exception 'identity_required'; end if;
end $$;

create or replace function private.commission_rate_for(p_provider uuid, p_at timestamptz) returns numeric
language plpgsql stable security definer set search_path = '' as $$
declare
  p record; t record; v_global timestamptz; v_fleet uuid; v_n int;
begin
  select role, office_id, created_at into p from public.profiles where id = p_provider;
  select commission_override, promo_until into t from public.provider_terms where provider_id = p_provider;
  begin
    select nullif(btrim(s.value), '')::timestamptz into v_global from public.settings s where s.key = 'launch_promo_global_until';
  exception when others then v_global := null; end;
  if (t.promo_until is not null and t.promo_until > p_at)
     or (v_global is not null and v_global > p_at)
     or (p.created_at is not null and p.created_at + pg_catalog.make_interval(days => private.sn('launch_promo_days', 30)::int) > p_at) then
    return 0;
  end if;
  if t.commission_override is not null then return t.commission_override; end if;
  v_fleet := coalesce(p.office_id, case when p.role = 'office' then p_provider end);
  if v_fleet is not null then
    select count(*) into v_n from public.profiles
     where office_id = v_fleet and status = 'active' and role in ('driver', 'office');
    if v_n >= private.sn('fleet_min_vehicles', 5) then return private.sn('commission_fleet', 10); end if;
  end if;
  return private.sn('commission_individual', 15);
end $$;

-- ---------------------------------------------------------------
-- 5) تسجيل الجهاز (يربط device_id بالحساب بصمت)
-- ---------------------------------------------------------------
create or replace function public.register_device(p_device_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'يجب تسجيل الدخول'; end if;
  if not private.valid_device(p_device_id) then return jsonb_build_object('ok', false); end if;
  if not private.hit('dev:' || uid::text, 30, 3600) then return jsonb_build_object('ok', false, 'reason', 'rate_limited'); end if;
  insert into private.devices(device_id, user_id) values (p_device_id, uid) on conflict do nothing;
  return jsonb_build_object('ok', true, 'state', private.guard_state(uid, p_device_id));
end $$;

create or replace function public.guard_status(p_device_id text default null) returns text
language sql stable security definer set search_path = '' as $$
  select private.guard_state(auth.uid(), case when private.valid_device(p_device_id) then p_device_id end);
$$;

-- ---------------------------------------------------------------
-- 6) طلب رحلة: بلا توثيق إلزامي + device_id + قاعدة 500م + كشف mock
-- ---------------------------------------------------------------
drop function if exists public.request_ride(text, text, double precision, double precision, double precision, double precision, text, integer, text, jsonb);
create or replace function public.request_ride(
  p_pickup text, p_dropoff text,
  p_pickup_lat double precision, p_pickup_lng double precision,
  p_dropoff_lat double precision, p_dropoff_lng double precision,
  p_vehicle_type text default 'economy', p_passengers integer default 1,
  p_notes text default null, p_options jsonb default '{}'::jsonb,
  p_device_id text default null,
  p_live_lat double precision default null, p_live_lng double precision default null,
  p_mock boolean default false)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); v_id bigint; v_offers integer; v_opts jsonb := '{}'::jsonb; v_notes text; k text;
  v_dev text := case when private.valid_device(p_device_id) then p_device_id end;
begin
  if uid is null then raise exception 'يجب تسجيل الدخول'; end if;
  if not public.is_active_customer() then raise exception 'حساب الزبون غير مفعّل'; end if;
  if v_dev is null and private.sn('require_device', 1) >= 1 then raise exception 'device_required'; end if;
  if coalesce(p_mock, false) then raise exception 'mock_location'; end if;
  perform private.guard_check(uid, v_dev);
  if exists (select 1 from public.rides where customer_id = uid
             and status in ('searching','accepted','on_the_way','arrived','started','no_driver')) then
    raise exception 'لديك رحلة جارية بالفعل';
  end if;
  if not private.hit('ride:' || uid::text, 6, 3600) then raise exception 'rate_limited'; end if;
  if char_length(btrim(coalesce(p_pickup, ''))) not between 1 and 200
     or char_length(btrim(coalesce(p_dropoff, ''))) not between 1 and 200 then
    raise exception 'أدخل مكان الانطلاق والوجهة (حتى 200 حرف)';
  end if;
  if p_pickup_lat is null or p_pickup_lng is null or p_dropoff_lat is null or p_dropoff_lng is null
     or p_pickup_lat not between -90 and 90 or p_pickup_lng not between -180 and 180
     or p_dropoff_lat not between -90 and 90 or p_dropoff_lng not between -180 and 180 then
    raise exception 'حدد نقطتي الانطلاق والوجهة على الخريطة';
  end if;
  if p_live_lat is null or p_live_lng is null or p_live_lat not between -90 and 90 or p_live_lng not between -180 and 180 then
    raise exception 'location_required';
  end if;
  if private.hav(p_pickup_lat, p_pickup_lng, p_live_lat, p_live_lng) > private.sn('pickup_radius_m', 500) then
    raise exception 'pickup_too_far';
  end if;
  if private.hav(p_pickup_lat, p_pickup_lng, p_dropoff_lat, p_dropoff_lng) > 150000 then
    raise exception 'المسافة بين النقطتين بعيدة جداً';
  end if;
  if coalesce(p_vehicle_type, 'economy') not in ('economy', 'comfort') then raise exception 'نوع السيارة غير صحيح'; end if;
  if p_passengers is null or p_passengers not between 1 and 8 then raise exception 'عدد الركاب بين 1 و 8'; end if;
  v_notes := nullif(left(btrim(coalesce(p_notes, '')), 300), '');
  foreach k in array array['luggage', 'ac', 'child_seat', 'pets'] loop
    if coalesce(p_options ->> k, '') = 'true' then v_opts := v_opts || jsonb_build_object(k, true); end if;
  end loop;

  insert into public.rides(customer_id, pickup, dropoff, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
                           vehicle_type, passengers, notes, options, status, accepted_by, updated_at)
  values (uid, btrim(p_pickup), btrim(p_dropoff), p_pickup_lat, p_pickup_lng, p_dropoff_lat, p_dropoff_lng,
          coalesce(p_vehicle_type, 'economy'), p_passengers, v_notes, v_opts, 'searching', null, pg_catalog.now())
  returning id into v_id;
  insert into private.ride_meta(ride_id, device_id, customer_ip, cust_lat, cust_lng)
  values (v_id, v_dev, private.client_ip(), p_live_lat, p_live_lng);
  if v_dev is not null then insert into private.devices(device_id, user_id) values (v_dev, uid) on conflict do nothing; end if;

  insert into public.ride_offers(ride_id, recipient_id, recipient_role)
  select v_id, p.id, p.role from public.profiles p
  where p.role in ('driver', 'office') and p.status = 'active' and p.available = true and p.vehicle_kind = 'car' and p.id <> uid
  on conflict (ride_id, recipient_id) do nothing;
  get diagnostics v_offers = row_count;
  if v_offers = 0 then raise exception 'لا يوجد سائق أو مكتب متاح الآن. حاول بعد قليل'; end if;
  return v_id;
end $$;

drop function if exists public.request_delivery(text, text, double precision, double precision, double precision, double precision, text, text, text, text);
create or replace function public.request_delivery(
  p_pickup text, p_dropoff text,
  p_pickup_lat double precision, p_pickup_lng double precision,
  p_dropoff_lat double precision, p_dropoff_lng double precision,
  p_item text, p_vehicle text default 'motor', p_size text default 'small', p_notes text default null,
  p_device_id text default null, p_mock boolean default false)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); v_id bigint; v_offers integer; v_notes text;
        v_dev text := case when private.valid_device(p_device_id) then p_device_id end;
begin
  if uid is null then raise exception 'يجب تسجيل الدخول'; end if;
  if not public.is_active_customer() then raise exception 'حساب الزبون غير مفعّل'; end if;
  if v_dev is null and private.sn('require_device', 1) >= 1 then raise exception 'device_required'; end if;
  if coalesce(p_mock, false) then raise exception 'mock_location'; end if;
  perform private.guard_check(uid, v_dev);
  if exists (select 1 from public.rides where customer_id = uid and status in ('searching','accepted','on_the_way','arrived','started','no_driver')) then raise exception 'لديك طلب جارٍ بالفعل'; end if;
  if not private.hit('ride:' || uid::text, 6, 3600) then raise exception 'rate_limited'; end if;
  if char_length(btrim(coalesce(p_pickup,''))) not between 1 and 200 or char_length(btrim(coalesce(p_dropoff,''))) not between 1 and 200 then raise exception 'أدخل مكان الاستلام ومكان التسليم'; end if;
  if char_length(btrim(coalesce(p_item,''))) not between 2 and 200 then raise exception 'اكتب ماذا تريد توصيله'; end if;
  if p_pickup_lat is null or p_pickup_lng is null or p_dropoff_lat is null or p_dropoff_lng is null
     or p_pickup_lat not between -90 and 90 or p_pickup_lng not between -180 and 180
     or p_dropoff_lat not between -90 and 90 or p_dropoff_lng not between -180 and 180 then raise exception 'حدد نقطتي الاستلام والتسليم على الخريطة'; end if;
  if private.hav(p_pickup_lat, p_pickup_lng, p_dropoff_lat, p_dropoff_lng) > 60000 then raise exception 'المسافة بعيدة جداً للتوصيل'; end if;
  if coalesce(p_vehicle,'motor') not in ('motor','car') then raise exception 'نوع التوصيل غير صحيح'; end if;
  if coalesce(p_size,'small') not in ('small','medium','large') then raise exception 'حجم الطلب غير صحيح'; end if;
  v_notes := nullif(left(btrim(coalesce(p_notes,'')), 300), '');
  insert into public.rides(customer_id, kind, item, pickup, dropoff, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, vehicle_type, passengers, notes, options, status, accepted_by, updated_at)
  values (uid, 'delivery', btrim(p_item), btrim(p_pickup), btrim(p_dropoff), p_pickup_lat, p_pickup_lng, p_dropoff_lat, p_dropoff_lng, coalesce(p_vehicle,'motor'), 1, v_notes,
          jsonb_build_object('size', coalesce(p_size,'small')), 'searching', null, pg_catalog.now())
  returning id into v_id;
  insert into private.ride_meta(ride_id, device_id, customer_ip) values (v_id, v_dev, private.client_ip());
  if v_dev is not null then insert into private.devices(device_id, user_id) values (v_dev, uid) on conflict do nothing; end if;
  insert into public.ride_offers(ride_id, recipient_id, recipient_role)
  select v_id, p.id, p.role from public.profiles p
  where p.role in ('driver','office') and p.status = 'active' and p.available = true and p.id <> uid
    and ((coalesce(p_vehicle,'motor') = 'motor' and p.role = 'driver' and p.vehicle_kind = 'motor')
      or (coalesce(p_vehicle,'motor') = 'car' and p.vehicle_kind = 'car'))
  on conflict (ride_id, recipient_id) do nothing;
  get diagnostics v_offers = row_count;
  if v_offers = 0 then raise exception 'لا يوجد %', case when coalesce(p_vehicle,'motor') = 'motor' then 'متور متاح الآن' else 'سائق أو مكتب متاح الآن' end; end if;
  return v_id;
end $$;

-- ---------------------------------------------------------------
-- 7) عرض السعر: رفض محاكاة الموقع (best-effort من العميل)
-- ---------------------------------------------------------------
drop function if exists public.send_quote(bigint, integer, integer);
create or replace function public.send_quote(p_ride_id bigint, p_price integer, p_eta integer default null, p_mock boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); v_status text; v_created timestamptz;
begin
  if uid is null then raise exception 'يجب تسجيل الدخول'; end if;
  if coalesce(p_mock, false) then raise exception 'mock_location'; end if;
  if not public.is_active_provider() then raise exception 'فعّل التوفر أولاً لإرسال عرض'; end if;
  if p_price is null or p_price not between 1 and 100000000 then raise exception 'أدخل سعراً صحيحاً'; end if;
  if p_eta is not null and p_eta not between 1 and 120 then raise exception 'وقت الوصول غير صحيح'; end if;
  if not private.hit('quote:' || uid::text, 60, 3600) then raise exception 'rate_limited'; end if;
  if exists (select 1 from public.rides where accepted_by = uid and status in ('accepted','on_the_way','arrived','started')) then
    raise exception 'لديك رحلة جارية، أنهِها أولاً';
  end if;
  select status, created_at into v_status, v_created from public.rides where id = p_ride_id;
  if not found or v_status <> 'searching' or v_created < pg_catalog.now() - interval '15 minutes' then
    raise exception 'الطلب لم يعد متاحاً';
  end if;
  insert into public.ride_quotes as q(ride_id, provider_id, price, eta_minutes)
  values (p_ride_id, uid, p_price, p_eta)
  on conflict (ride_id, provider_id) do update
    set price = excluded.price, eta_minutes = excluded.eta_minutes, state = 'sent', updated_at = pg_catalog.now()
    where q.state in ('sent', 'withdrawn');
end $$;

-- ---------------------------------------------------------------
-- 8) اختيار العرض: تثبيت نسبة العمولة + توليد PIN البدء + قياس قرب الطرفين
-- ---------------------------------------------------------------
create or replace function public.choose_quote(p_quote_id bigint) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); q record; v_status text;
  v_pin text := lpad((('x' || encode(extensions.gen_random_bytes(3), 'hex'))::bit(24)::int % 10000)::text, 4, '0');
  v_near double precision;
begin
  if uid is null then raise exception 'يجب تسجيل الدخول'; end if;
  select * into q from public.ride_quotes where id = p_quote_id;
  if not found then return 'gone'; end if;
  select status into v_status from public.rides where id = q.ride_id and customer_id = uid for update;
  if not found then raise exception 'غير مصرّح'; end if;
  if v_status <> 'searching' then return 'taken'; end if;
  select * into q from public.ride_quotes where id = p_quote_id;
  if q.state <> 'sent' then return 'gone'; end if;
  if not exists (select 1 from public.profiles where id = q.provider_id and status = 'active') then return 'gone'; end if;
  if exists (select 1 from public.rides where accepted_by = q.provider_id and status in ('accepted','on_the_way','arrived','started')) then return 'busy'; end if;
  update public.rides
     set status = 'accepted', accepted_by = q.provider_id, price = q.price,
         commission_rate = private.commission_rate_for(q.provider_id, pg_catalog.now()),
         accepted_at = pg_catalog.now(), updated_at = pg_catalog.now()
   where id = q.ride_id and status = 'searching';
  update public.ride_quotes set state = case when id = q.id then 'chosen' else 'lost' end, updated_at = pg_catalog.now()
   where ride_id = q.ride_id and state = 'sent';
  update public.ride_offers set state = case when recipient_id = q.provider_id then 'accepted' else 'lost' end
   where ride_id = q.ride_id and state = 'sent';
  select private.hav(pl.lat, pl.lng, m.cust_lat, m.cust_lng) into v_near
    from public.provider_locations pl, private.ride_meta m
   where pl.provider_id = q.provider_id and m.ride_id = q.ride_id and m.cust_lat is not null;
  insert into private.ride_meta(ride_id, pin, near_m) values (q.ride_id, v_pin, v_near)
  on conflict (ride_id) do update set pin = excluded.pin, pin_ok = false, pin_tries = 0, near_m = excluded.near_m;
  return 'ok';
end $$;

-- ---------------------------------------------------------------
-- 9) PIN البدء: الزبون يقرؤه، السائق يدخله
-- ---------------------------------------------------------------
create or replace function public.get_start_pin(p_ride_id bigint) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v text;
begin
  select m.pin into v from private.ride_meta m join public.rides r on r.id = m.ride_id
   where r.id = p_ride_id and r.customer_id = auth.uid() and r.status in ('accepted','on_the_way','arrived','started');
  return v;
end $$;

create or replace function public.verify_start_pin(p_ride_id bigint, p_pin text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); m private.ride_meta;
begin
  perform 1 from public.rides where id = p_ride_id and accepted_by = uid and status = 'arrived' for update;
  if not found then raise exception 'غير مصرّح'; end if;
  select * into m from private.ride_meta where ride_id = p_ride_id for update;
  if m.ride_id is null or m.pin is null then raise exception 'pin_missing'; end if;
  if m.pin_ok then return true; end if;
  if m.pin_tries >= 5 then raise exception 'pin_locked'; end if;
  if btrim(coalesce(p_pin, '')) = m.pin then
    update private.ride_meta set pin_ok = true, provider_ip = private.client_ip() where ride_id = p_ride_id;
    return true;
  end if;
  update private.ride_meta set pin_tries = pin_tries + 1 where ride_id = p_ride_id;
  return false;
end $$;

-- ---------------------------------------------------------------
-- 10) إلغاء الزبون: عدّ المخالفات بعد تحرك السائق > 300م
-- ---------------------------------------------------------------
create or replace function public.cancel_ride(p_ride_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); cur text; v_moved double precision; v_dev text; v_strikes int; v_limit int;
begin
  select status into cur from public.rides where id = p_ride_id and customer_id = uid for update;
  if cur is null or cur not in ('searching','no_driver','accepted','on_the_way','arrived') then
    raise exception 'لا يمكن إلغاء هذا الطلب';
  end if;
  if cur in ('accepted','on_the_way','arrived') then
    select private.hav(f.lat, f.lng, l.lat, l.lng) into v_moved
      from (select lat, lng from public.ride_track where ride_id = p_ride_id and kind = 'approach' order by t, id limit 1) f,
           (select lat, lng from public.ride_track where ride_id = p_ride_id and kind = 'approach' order by t desc, id desc limit 1) l;
    if coalesce(v_moved, 0) > private.sn('cancel_move_m', 300) then
      v_limit := private.sn('cancel_strike_limit', 2)::int;
      insert into private.user_flags(user_id, strikes) values (uid, 1)
      on conflict (user_id) do update set strikes = private.user_flags.strikes + 1, updated_at = pg_catalog.now()
      returning strikes into v_strikes;
      select device_id into v_dev from private.ride_meta where ride_id = p_ride_id;
      if v_dev is not null then
        insert into private.device_flags(device_id, strikes) values (v_dev, 1)
        on conflict (device_id) do update set strikes = private.device_flags.strikes + 1, updated_at = pg_catalog.now();
      end if;
      if v_strikes >= v_limit then
        update private.user_flags set kyc_required = true, restricted_at = pg_catalog.now() where user_id = uid;
        if v_dev is not null then
          update private.device_flags set restricted = true, restricted_at = pg_catalog.now() where device_id = v_dev;
        end if;
      end if;
    end if;
  end if;
  update public.rides set status = 'cancelled', cancelled_by = 'customer', updated_at = pg_catalog.now() where id = p_ride_id;
  update public.ride_quotes set state = 'lost', updated_at = pg_catalog.now() where ride_id = p_ride_id and state = 'sent';
  update public.ride_offers set state = 'withdrawn' where ride_id = p_ride_id and state = 'sent';
end $$;

-- ---------------------------------------------------------------
-- 11) إنهاء الرحلة: عمولة مثبّتة + خصم/إحالة بشروط مكافحة الاحتيال
-- ---------------------------------------------------------------
create or replace function private.finalize_ride(p_ride bigint, p_dist double precision) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.rides; m private.ride_meta; v_ref public.referrals;
  v_rate numeric; v_comm int; v_disc int := 0; v_block text; v_cap numeric; v_spent numeric;
  v_first numeric; v_credit numeric; v_repeat int; v_use_credit boolean := false; v_reward numeric;
begin
  select * into r from public.rides where id = p_ride;
  select * into m from private.ride_meta where ride_id = p_ride;
  v_rate := coalesce(r.commission_rate, private.commission_rate_for(r.accepted_by, pg_catalog.now()));
  v_comm := round(coalesce(r.price, 0) * v_rate / 100.0)::int;

  if coalesce(p_dist, 0) < private.sn('min_promo_distance_m', 1000) then v_block := 'short_trip';
  elsif m.ride_id is null or not coalesce(m.pin_ok, false) then v_block := 'no_pin';
  elsif m.near_m is not null and m.near_m < private.sn('collusion_gps_m', 30) then v_block := 'same_place';
  elsif m.customer_ip is not null and m.customer_ip = m.provider_ip then v_block := 'same_network';
  else
    select count(*) into v_repeat from public.rides x
     where x.customer_id = r.customer_id and x.accepted_by = r.accepted_by and x.status = 'completed'
       and x.id <> p_ride and x.completed_at > pg_catalog.now() - interval '7 days';
    if v_repeat >= 2 then v_block := 'repeat_pair'; end if;
  end if;

  if v_block is null and coalesce(r.price, 0) > 0 then
    v_first := private.sn('first_ride_discount', 0);
    if v_first > 0 and m.device_id is not null
       and not exists (select 1 from public.rides x where x.customer_id = r.customer_id and x.status = 'completed' and x.id <> p_ride)
       and not exists (select 1 from public.rides x join private.ride_meta xm on xm.ride_id = x.id
                        where x.promo_discount > 0 and (x.customer_id = r.customer_id or xm.device_id = m.device_id)) then
      v_disc := least(v_first, r.price)::int;
    else
      select coalesce(sum(amount), 0) into v_credit from public.commission_ledger
       where user_id = r.customer_id and kind in ('referral_credit', 'credit_used');
      if v_credit > 0 then v_disc := least(v_credit, r.price)::int; v_use_credit := true; end if;
    end if;
    if v_disc > 0 then
      v_cap := private.sn('daily_promo_cap', 0);
      select coalesce(sum(promo_discount), 0) into v_spent from public.rides
       where status = 'completed' and promo_discount > 0 and completed_at >= date_trunc('day', pg_catalog.now());
      if v_cap <= 0 or v_spent + v_disc > v_cap then v_disc := 0; v_use_credit := false; end if;
    end if;
  end if;

  update public.rides set commission_rate = v_rate, commission_amount = v_comm, promo_discount = v_disc,
         net_to_driver = coalesce(price, 0) - v_comm where id = p_ride;
  if r.price is not null then
    insert into public.commission_ledger(ride_id, user_id, kind, amount, note)
    values (p_ride, r.accepted_by, 'commission', -v_comm, 'rate ' || v_rate::text);
  end if;
  if v_disc > 0 then
    insert into public.commission_ledger(ride_id, user_id, kind, amount, note)
    values (p_ride, r.accepted_by, 'promo_refund', v_disc, 'promo');
    if v_use_credit then
      insert into public.commission_ledger(ride_id, user_id, kind, amount, note)
      values (p_ride, r.customer_id, 'credit_used', -v_disc, 'referral credit');
    end if;
  end if;

  update private.user_flags set strikes = 0, updated_at = pg_catalog.now() where user_id = r.customer_id;
  if m.device_id is not null then update private.device_flags set strikes = 0, updated_at = pg_catalog.now() where device_id = m.device_id; end if;

  if v_block is null then
    select * into v_ref from public.referrals where referred_id = r.customer_id and status = 'pending';
    if found then
      if m.device_id is not null
         and not exists (select 1 from private.devices d where d.device_id = m.device_id and d.user_id = v_ref.referrer_id)
         and not exists (select 1 from public.referrals q where q.device_id = m.device_id and q.status = 'rewarded') then
        v_reward := private.sn('referral_credit', 0);
        update public.referrals set status = 'rewarded', rewarded_at = pg_catalog.now(), device_id = m.device_id where id = v_ref.id;
        if v_reward > 0 then
          insert into public.commission_ledger(ride_id, user_id, kind, amount, note)
          values (p_ride, v_ref.referrer_id, 'referral_credit', v_reward::int, 'referral');
        end if;
      else
        update public.referrals set status = 'rejected', device_id = m.device_id where id = v_ref.id;
      end if;
    end if;
  end if;
end $$;

create or replace function public.update_ride_status(p_ride_id bigint, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); cur text; v_loc timestamptz; v_dist double precision; v_pin_ok boolean;
begin
  select status into cur from public.rides where id = p_ride_id and accepted_by = uid for update;
  if cur is null then raise exception 'غير مصرّح'; end if;
  if not ((cur = 'accepted' and p_status = 'on_the_way')
       or (cur = 'on_the_way' and p_status = 'arrived')
       or (cur = 'arrived' and p_status = 'started')
       or (cur = 'started' and p_status = 'completed')) then
    raise exception 'انتقال غير مسموح';
  end if;
  if p_status in ('on_the_way', 'arrived', 'started') then
    select updated_at into v_loc from public.provider_locations where provider_id = uid;
    if v_loc is null or v_loc < pg_catalog.now() - interval '120 seconds' then raise exception 'location_required'; end if;
  end if;
  if p_status = 'started' then
    -- PIN إلزامي لرحلات الركاب فقط؛ التوصيل يُستثنى (قد لا يكون المرسل حاضراً عند الاستلام)
    if (select kind from public.rides where id = p_ride_id) <> 'delivery' then
      select coalesce(pin_ok, false) into v_pin_ok from private.ride_meta where ride_id = p_ride_id;
      if not coalesce(v_pin_ok, false) then raise exception 'pin_required'; end if;
    end if;
    update public.rides set status = p_status, started_at = pg_catalog.now(), updated_at = pg_catalog.now() where id = p_ride_id;
  elsif p_status = 'completed' then
    select coalesce(sum(private.hav(s.plat, s.plng, s.lat, s.lng)), 0) into v_dist
      from (select t.lat, t.lng,
                   lag(t.lat) over (order by t.t, t.id) as plat,
                   lag(t.lng) over (order by t.t, t.id) as plng
              from public.ride_track t where t.ride_id = p_ride_id and t.kind = 'trip') s
     where s.plat is not null;
    update public.rides set status = p_status, completed_at = pg_catalog.now(),
           distance_m = round(v_dist)::integer, updated_at = pg_catalog.now() where id = p_ride_id;
    perform private.finalize_ride(p_ride_id, v_dist);
  else
    update public.rides set status = p_status, updated_at = pg_catalog.now() where id = p_ride_id;
  end if;
end $$;

-- ---------------------------------------------------------------
-- 12) الشحن: توثيق مطلوب فقط للشحنات عالية القيمة (أو الكل إن فعّله المدير)
-- ---------------------------------------------------------------
create or replace function public.cargo_book_internal(
  p_user uuid, p_trip bigint, p_weight numeric, p_desc text, p_cat text, p_packages integer, p_fragile boolean,
  p_pickup text, p_rname text, p_rphone text, p_raddr text, p_shop text, p_group uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.cargo_trips; used numeric; v_price numeric; v_pin text; v_id bigint; v_role text;
begin
  select * into t from public.cargo_trips where id = p_trip for update;
  if not found or t.status <> 'open' then raise exception 'not_open'; end if;
  select coalesce(sum(weight_kg), 0) into used from public.cargo_items where trip_id = p_trip and status <> 'cancelled';
  if used + p_weight > t.capacity_kg then raise exception 'full:%', (t.capacity_kg - used); end if;
  v_price := greatest(t.min_charge, round(p_weight * t.price_per_kg));
  perform private.guard_check(p_user, null);
  select role into v_role from public.profiles where id = p_user;
  if v_role = 'customer'
     and (v_price >= private.sn('cargo_kyc_threshold', 500000) or private.sn('cargo_kyc_all', 0) >= 1)
     and not exists (select 1 from public.customer_identity where user_id = p_user) then
    raise exception 'identity_required';
  end if;
  v_pin := lpad((('x' || encode(extensions.gen_random_bytes(3), 'hex'))::bit(24)::int % 10000)::text, 4, '0');
  insert into public.cargo_items(trip_id, group_id, owner_id, shop_name, description, category, weight_kg, packages, fragile, pickup_address,
    receiver_name, receiver_phone, receiver_address, price, pin)
  values (p_trip, p_group, p_user, nullif(trim(p_shop), ''), left(trim(p_desc), 200), p_cat, p_weight, greatest(1, p_packages), coalesce(p_fragile, false), left(trim(p_pickup), 200),
    left(trim(p_rname), 100), left(trim(p_rphone), 30), left(trim(p_raddr), 200), v_price, v_pin) returning id into v_id;
  return jsonb_build_object('id', v_id, 'trip_id', p_trip, 'weight_kg', p_weight, 'price', v_price, 'pin', v_pin);
end $$;

-- ---------------------------------------------------------------
-- 13) الإحالة
-- ---------------------------------------------------------------
create or replace function public.my_referral() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); v_code text; v_n int := 0;
begin
  if uid is null then raise exception 'يجب تسجيل الدخول'; end if;
  select code into v_code from public.referral_codes where user_id = uid;
  while v_code is null and v_n < 8 loop
    v_n := v_n + 1;
    begin
      insert into public.referral_codes(user_id, code)
      values (uid, upper(substr(translate(encode(extensions.gen_random_bytes(6), 'base64'), '+/=Ili01OoQ', ''), 1, 6)))
      returning code into v_code;
    exception when unique_violation then
      select code into v_code from public.referral_codes where user_id = uid;
    end;
  end loop;
  return jsonb_build_object(
    'code', v_code,
    'rewarded', (select count(*) from public.referrals where referrer_id = uid and status = 'rewarded'),
    'pending',  (select count(*) from public.referrals where referrer_id = uid and status = 'pending'),
    'credit',   (select coalesce(sum(amount), 0) from public.commission_ledger where user_id = uid and kind in ('referral_credit', 'credit_used')));
end $$;

create or replace function public.use_referral(p_code text, p_device_id text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); v_ref uuid; v_dev text := case when private.valid_device(p_device_id) then p_device_id end;
begin
  if uid is null then raise exception 'يجب تسجيل الدخول'; end if;
  if not public.is_active_customer() then raise exception 'حساب الزبون غير مفعّل'; end if;
  if not private.hit('ref:' || uid::text, 5, 86400) then raise exception 'rate_limited'; end if;
  if v_dev is null then return jsonb_build_object('ok', false, 'reason', 'device_required'); end if;
  select user_id into v_ref from public.referral_codes where code = upper(btrim(coalesce(p_code, '')));
  if v_ref is null then return jsonb_build_object('ok', false, 'reason', 'bad_code'); end if;
  if v_ref = uid then return jsonb_build_object('ok', false, 'reason', 'self'); end if;
  if exists (select 1 from public.rides where customer_id = uid and status = 'completed') then
    return jsonb_build_object('ok', false, 'reason', 'not_new');
  end if;
  if exists (select 1 from private.devices d where d.device_id = v_dev and d.user_id = v_ref) then
    return jsonb_build_object('ok', false, 'reason', 'same_device');
  end if;
  insert into private.devices(device_id, user_id) values (v_dev, uid) on conflict do nothing;
  insert into public.referrals(referrer_id, referred_id, device_id) values (v_ref, uid, v_dev) on conflict (referred_id) do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------
-- 14) واجهات المزوّد والإدارة
-- ---------------------------------------------------------------
create or replace function public.provider_balance() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); v_from timestamptz := date_trunc('month', pg_catalog.now()); t record;
begin
  select commission_override, promo_until into t from public.provider_terms where provider_id = uid;
  return jsonb_build_object(
    'rate', private.commission_rate_for(uid, pg_catalog.now()),
    'promo_until', coalesce(t.promo_until, (select p.created_at + pg_catalog.make_interval(days => private.sn('launch_promo_days', 30)::int) from public.profiles p where p.id = uid)),
    'month_commission', (select coalesce(-sum(amount), 0) from public.commission_ledger where user_id = uid and kind = 'commission' and created_at >= v_from),
    'month_refund',     (select coalesce(sum(amount), 0)  from public.commission_ledger where user_id = uid and kind = 'promo_refund' and created_at >= v_from),
    'balance',          (select coalesce(sum(amount), 0)  from public.commission_ledger where user_id = uid and kind in ('commission','promo_refund','adjust')));
end $$;

create or replace function public.admin_set_provider_terms(p_provider uuid, p_override numeric default null, p_promo_days integer default null, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  insert into public.provider_terms(provider_id, commission_override, promo_until, note, updated_at)
  values (p_provider, p_override, case when p_promo_days is not null then pg_catalog.now() + pg_catalog.make_interval(days => p_promo_days) end, left(p_note, 200), pg_catalog.now())
  on conflict (provider_id) do update set commission_override = excluded.commission_override,
    promo_until = excluded.promo_until, note = excluded.note, updated_at = pg_catalog.now();
end $$;

create or replace function public.admin_commissions(p_from timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_from timestamptz := coalesce(p_from, date_trunc('month', pg_catalog.now()));
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  return coalesce((select jsonb_agg(x order by x->>'name') from (
    select jsonb_build_object('id', p.id, 'name', p.full_name, 'role', p.role, 'rate', private.commission_rate_for(p.id, pg_catalog.now()),
      'rides', (select count(*) from public.rides r where r.accepted_by = p.id and r.status = 'completed' and r.completed_at >= v_from),
      'gross', (select coalesce(sum(r.price), 0) from public.rides r where r.accepted_by = p.id and r.status = 'completed' and r.completed_at >= v_from),
      'commission', (select coalesce(-sum(l.amount), 0) from public.commission_ledger l where l.user_id = p.id and l.kind = 'commission' and l.created_at >= v_from),
      'refunds', (select coalesce(sum(l.amount), 0) from public.commission_ledger l where l.user_id = p.id and l.kind = 'promo_refund' and l.created_at >= v_from)) as x
    from public.profiles p where p.role in ('driver', 'office')) s), '[]'::jsonb);
end $$;

create or replace function public.admin_fraud_flags() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  return jsonb_build_object(
    'users',   coalesce((select jsonb_agg(jsonb_build_object('user_id', f.user_id, 'name', p.full_name, 'phone', p.phone, 'strikes', f.strikes, 'kyc_required', f.kyc_required, 'restricted_at', f.restricted_at))
                         from private.user_flags f left join public.profiles p on p.id = f.user_id where f.strikes > 0 or f.kyc_required), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('device_id', left(d.device_id, 8) || '…', 'strikes', d.strikes, 'restricted', d.restricted, 'banned', d.banned))
                         from private.device_flags d where d.strikes > 0 or d.restricted or d.banned), '[]'::jsonb));
end $$;

create or replace function public.admin_clear_restriction(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  update private.user_flags set strikes = 0, kyc_required = false, updated_at = pg_catalog.now() where user_id = p_user;
  update private.device_flags set strikes = 0, restricted = false, updated_at = pg_catalog.now()
   where device_id in (select device_id from private.devices where user_id = p_user) and banned = false;
end $$;

-- ---------------------------------------------------------------
-- 15) صلاحيات التنفيذ: لا anon على الدوال الجديدة
-- ---------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.register_device(text)', 'public.guard_status(text)',
    'public.request_ride(text,text,double precision,double precision,double precision,double precision,text,integer,text,jsonb,text,double precision,double precision,boolean)',
    'public.request_delivery(text,text,double precision,double precision,double precision,double precision,text,text,text,text,text,boolean)',
    'public.send_quote(bigint,integer,integer,boolean)', 'public.choose_quote(bigint)',
    'public.get_start_pin(bigint)', 'public.verify_start_pin(bigint,text)', 'public.cancel_ride(bigint)',
    'public.update_ride_status(bigint,text)', 'public.my_referral()', 'public.use_referral(text,text)',
    'public.provider_balance()', 'public.admin_set_provider_terms(uuid,numeric,integer,text)',
    'public.admin_commissions(timestamptz)', 'public.admin_fraud_flags()', 'public.admin_clear_restriction(uuid)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  -- دوال داخلية: لا تُستدعى من API إطلاقاً
  revoke all on function public.cargo_book_internal(uuid,bigint,numeric,text,text,integer,boolean,text,text,text,text,text,uuid) from public, anon, authenticated;
end $$;
-- دوال private الجديدة فقط (لا نلمس دوال private القديمة: office_id/co_id/bus_set_status قد تستعملها سياسات RLS)
revoke all on function private.sn(text, numeric), private.client_ip(), private.valid_device(text),
  private.guard_state(uuid, text), private.guard_check(uuid, text),
  private.commission_rate_for(uuid, timestamptz), private.finalize_ride(bigint, double precision)
  from public, anon, authenticated;

commit;
