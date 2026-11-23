-- =====================================================================
-- supabase_pricing.sql — تحكم الإدارة بأسعار كل خدمة (idempotent)
-- يُشغَّل بعد supabase_upgrade.sql (يعيد تعريف send_quote بنفس توقيعها الجديد).
-- الافتراضي لا يغيّر السلوك: كل الخدمات «مزايدة» بلا حد أدنى/أقصى حتى تضبطها من لوحة الإدارة.
--   الخدمات: taxi (تكسي) · delivery_motor (توصيل متور) · delivery_car (توصيل سيارة)
--   mode = bid  : السائق يضع سعره ضمن [min,max] إن وُجدا
--   mode = fixed: السعر = base + per_km × المسافة (تقريب للأعلى لأقرب price_round)، والسائق لا يستطيع تغييره
--   الشحن والباصات: أسعار الرحلات المفتوحة تُعدَّل بالجملة أو لكل رحلة (الحجوزات السابقة لا تتغيّر)
-- =====================================================================
begin;

create table if not exists public.price_log (
  id bigint generated always as identity primary key,
  admin_id uuid,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
alter table public.price_log enable row level security;
drop policy if exists price_log_admin_read on public.price_log;
create policy price_log_admin_read on public.price_log for select to authenticated using (public.is_admin());
create index if not exists price_log_created_idx on public.price_log (created_at desc);

insert into public.settings(key, value)
select v.k, v.v from (
  select 'price_' || s || '_' || f as k, case f when 'mode' then 'bid' else '0' end as v
    from unnest(array['taxi', 'delivery_motor', 'delivery_car']) s, unnest(array['mode', 'min', 'max', 'base', 'per_km']) f
  union all select 'price_round', '500'
  union all select 'price_road_factor', '1.3'
) v
where not exists (select 1 from public.settings x where x.key = v.k);

create or replace function private.ss(p_key text, p_def text) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select nullif(btrim(s.value), '') from public.settings s where s.key = p_key limit 1), p_def);
$$;

create or replace function private.rnd(p_x numeric, p_step numeric) returns numeric
language sql immutable set search_path = '' as $$
  select case when coalesce(p_step, 0) <= 1 then round(p_x) else round(p_x / p_step) * p_step end;
$$;

-- السعر الثابت للخدمة بحسب المسافة (null = غير مضبوط)
create or replace function private.fare_for(p_service text, p_km numeric) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare base numeric := private.sn('price_' || p_service || '_base', 0); pk numeric := private.sn('price_' || p_service || '_per_km', 0);
        step numeric := greatest(private.sn('price_round', 500), 1);
        mn numeric := private.sn('price_' || p_service || '_min', 0); mx numeric := private.sn('price_' || p_service || '_max', 0); f numeric;
begin
  f := base + pk * coalesce(p_km, 0);
  if f <= 0 then return null; end if;
  f := ceil(f / step) * step;
  if mn > 0 then f := greatest(f, mn); end if;
  if mx > 0 then f := least(f, mx); end if;
  return f::integer;
end $$;

-- قواعد الأسعار للقراءة من الواجهة (لا أسرار فيها)
create or replace function public.pricing_rules() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from public.settings where key like 'price\_%';
$$;

-- عرض السعر: تطبيق الوضع الثابت أو الحدّين الأدنى/الأقصى
create or replace function public.send_quote(p_ride_id bigint, p_price integer, p_eta integer default null, p_mock boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r public.rides; v_service text; v_km numeric; v_price integer := p_price; v_fare integer; v_min numeric; v_max numeric;
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
  select * into r from public.rides where id = p_ride_id;
  if not found or r.status <> 'searching' or r.created_at < pg_catalog.now() - interval '15 minutes' then
    raise exception 'الطلب لم يعد متاحاً';
  end if;

  v_service := case when r.kind = 'delivery' then case when r.vehicle_type = 'motor' then 'delivery_motor' else 'delivery_car' end else 'taxi' end;
  v_km := private.hav(r.pickup_lat, r.pickup_lng, r.dropoff_lat, r.dropoff_lng) / 1000.0 * private.sn('price_road_factor', 1.3);
  if private.ss('price_' || v_service || '_mode', 'bid') = 'fixed' then
    v_fare := private.fare_for(v_service, v_km);
    if v_fare is null then raise exception 'price_not_set'; end if;
    v_price := v_fare;
  else
    v_min := private.sn('price_' || v_service || '_min', 0); v_max := private.sn('price_' || v_service || '_max', 0);
    if v_min > 0 and v_price < v_min then raise exception 'price_too_low:%', v_min::bigint; end if;
    if v_max > 0 and v_price > v_max then raise exception 'price_too_high:%', v_max::bigint; end if;
  end if;

  insert into public.ride_quotes as q(ride_id, provider_id, price, eta_minutes)
  values (p_ride_id, uid, v_price, p_eta)
  on conflict (ride_id, provider_id) do update
    set price = excluded.price, eta_minutes = excluded.eta_minutes, state = 'sent', updated_at = pg_catalog.now()
    where q.state in ('sent', 'withdrawn');
end $$;

-- ---------------------------------------------------------------
-- إدارة: حفظ قواعد الأسعار دفعة واحدة (atomic) مع سجل تدقيق
-- ---------------------------------------------------------------
create or replace function public.admin_set_prices(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare k text; v text; s text;
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  if jsonb_typeof(p) <> 'object' then raise exception 'بيانات غير صحيحة'; end if;
  for k, v in select key, value #>> '{}' from jsonb_each(p) loop
    if k ~ '^price_(taxi|delivery_motor|delivery_car)_mode$' then
      if v not in ('bid', 'fixed') then raise exception 'وضع غير صحيح: %', k; end if;
    elsif k ~ '^price_(taxi|delivery_motor|delivery_car)_(min|max|base|per_km)$' or k in ('price_round', 'price_road_factor') then
      if v !~ '^[0-9]{1,9}(\.[0-9]{1,3})?$' then raise exception 'قيمة غير صحيحة: %', k; end if;
    else raise exception 'مفتاح غير مسموح: %', k; end if;
    insert into public.settings(key, value) values (k, v) on conflict (key) do update set value = excluded.value;
  end loop;
  foreach s in array array['taxi', 'delivery_motor', 'delivery_car'] loop
    if private.sn('price_' || s || '_max', 0) > 0 and private.sn('price_' || s || '_min', 0) > private.sn('price_' || s || '_max', 0) then
      raise exception 'الحد الأدنى أكبر من الأقصى في %', s;
    end if;
  end loop;
  insert into public.price_log(admin_id, action, detail) values (auth.uid(), 'set_prices', p);
end $$;

-- رفع/خفض بنسبة: scope = all | taxi | delivery_motor | delivery_car | cargo | bus
create or replace function public.admin_scale_prices(p_pct numeric, p_scope text default 'all') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare f numeric; s text; fld text; step numeric := greatest(private.sn('price_round', 500), 1); n_rules int := 0; n_cargo int := 0; n_bus int := 0;
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  if p_pct is null or p_pct < -90 or p_pct > 300 then raise exception 'النسبة بين -90 و 300'; end if;
  if p_scope not in ('all', 'taxi', 'delivery_motor', 'delivery_car', 'cargo', 'bus') then raise exception 'نطاق غير صحيح'; end if;
  f := 1 + p_pct / 100.0;
  foreach s in array array['taxi', 'delivery_motor', 'delivery_car'] loop
    continue when p_scope not in ('all', s);
    foreach fld in array array['min', 'max', 'base', 'per_km'] loop
      update public.settings set value = private.rnd(value::numeric * f, case when fld = 'per_km' then 10 else step end)::text
       where key = 'price_' || s || '_' || fld and value ~ '^[0-9]+(\.[0-9]+)?$' and value::numeric > 0;
      n_rules := n_rules + 1;
    end loop;
  end loop;
  if p_scope in ('all', 'cargo') then
    update public.cargo_trips set price_per_kg = greatest(1, private.rnd(price_per_kg * f, 1)), min_charge = private.rnd(min_charge * f, step) where status = 'open';
    get diagnostics n_cargo = row_count;
  end if;
  if p_scope in ('all', 'bus') then
    update public.bus_trips set price = least(100000000, greatest(0, private.rnd(price * f, step)))::integer, updated_at = pg_catalog.now() where status = 'open';
    get diagnostics n_bus = row_count;
  end if;
  insert into public.price_log(admin_id, action, detail) values (auth.uid(), 'scale', jsonb_build_object('pct', p_pct, 'scope', p_scope, 'cargo_trips', n_cargo, 'bus_trips', n_bus));
  return jsonb_build_object('cargo_trips', n_cargo, 'bus_trips', n_bus);
end $$;

-- سعر رحلة واحدة (p_trip) أو كل الرحلات المفتوحة (p_trip = null)
-- cargo: p_price = سعر الكغ، p_min = أقل أجرة | bus: p_price = سعر المقعد
create or replace function public.admin_set_trip_price(p_service text, p_trip bigint, p_price numeric, p_min numeric default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare n int := 0;
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  if p_price is null or p_price < 0 or p_price > 100000000 or (p_min is not null and (p_min < 0 or p_min > 100000000)) then raise exception 'سعر غير صحيح'; end if;
  if p_service = 'cargo' then
    if p_price < 1 then raise exception 'سعر الكغ يجب أن يكون 1 على الأقل'; end if;
    update public.cargo_trips set price_per_kg = p_price, min_charge = coalesce(p_min, min_charge)
     where status = 'open' and (p_trip is null or id = p_trip);
  elsif p_service = 'bus' then
    update public.bus_trips set price = round(p_price)::integer, updated_at = pg_catalog.now()
     where status = 'open' and (p_trip is null or id = p_trip);
  else raise exception 'خدمة غير صحيحة'; end if;
  get diagnostics n = row_count;
  insert into public.price_log(admin_id, action, detail) values (auth.uid(), 'trip_price', jsonb_build_object('service', p_service, 'trip', p_trip, 'price', p_price, 'min', p_min, 'rows', n));
  return n;
end $$;

create or replace function public.admin_price_log(p_limit integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  return coalesce((select jsonb_agg(x) from (
    select l.created_at, l.action, l.detail, p.full_name as admin from public.price_log l left join public.profiles p on p.id = l.admin_id
     order by l.created_at desc limit least(greatest(coalesce(p_limit, 30), 1), 100)) x), '[]'::jsonb);
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.pricing_rules()', 'public.send_quote(bigint,integer,integer,boolean)', 'public.admin_set_prices(jsonb)',
      'public.admin_scale_prices(numeric,text)', 'public.admin_set_trip_price(text,bigint,numeric,numeric)', 'public.admin_price_log(integer)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  revoke all on function private.ss(text, text), private.rnd(numeric, numeric), private.fare_for(text, numeric) from public, anon, authenticated;
end $$;

commit;
