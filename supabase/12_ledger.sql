-- НищеMap 12: монеты считает СЕРВЕР + правки цен с геометкой.
-- Запускать после 11_moderation.sql.
--
-- Зачем: до сих пор баланс считался в браузере из localStorage. Пока монета
-- чисто косметическая, это терпимо; как только за неё что-то дают — правка
-- одного числа в localStorage и есть весь взлом. Здесь появляется журнал
-- начислений на сервере, и клиент только ЧИТАЕТ баланс.
--
-- Начисление не мгновенное: событие ложится в журнал со временем созревания.
-- С геометкой — 15 минут, без неё — 60. Это и «в течение минут-часа», как
-- просили, и заметно мешает набивать монеты пачками.

-- ── расстояние по земле, без расширений (haversine, метры)
create or replace function public.meters_between(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision) returns double precision
language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lon2 - lon1) / 2), 2)));
$$;

-- ── фото меню: один и тот же кадр нельзя залить дважды
create table if not exists public.menu_photos (
  id uuid primary key default gen_random_uuid(),
  item_id text not null,
  device text not null,
  phash text not null,               -- перцептивный хеш, считает клиент
  photo_url text,
  lat double precision,
  lon double precision,
  shot_at timestamptz,               -- EXIF DateTimeOriginal, если удалось прочитать
  created_at timestamptz not null default now()
);
create unique index if not exists menu_photos_phash_uniq on public.menu_photos (phash);
create index if not exists menu_photos_item_dev on public.menu_photos (item_id, device, created_at desc);
alter table public.menu_photos enable row level security;
drop policy if exists "anon insert menu_photos" on public.menu_photos;
create policy "anon insert menu_photos" on public.menu_photos for insert to anon with check (true);
drop policy if exists "anon read menu_photos" on public.menu_photos;
create policy "anon read menu_photos" on public.menu_photos for select to anon using (true);

-- одно устройство не заливает меню одной и той же позиции чаще раза в 7 дней:
-- именно это правило и просили — чтобы не фотографировали одно меню день за днём
create or replace function public.menu_photo_limits() returns trigger
language plpgsql security definer as $$
declare n int;
begin
  select count(*) into n from public.menu_photos
   where item_id = new.item_id and device = new.device
     and created_at > now() - interval '7 days';
  if n > 0 then
    raise exception 'Меню этого места вы уже присылали на этой неделе.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;
drop trigger if exists menu_photo_limits_trg on public.menu_photos;
create trigger menu_photo_limits_trg before insert on public.menu_photos
  for each row execute function public.menu_photo_limits();

-- ── правки цен: «пришёл, а ценник другой»
create table if not exists public.price_updates (
  id uuid primary key default gen_random_uuid(),
  item_id text not null,
  device text not null,
  old_price int,
  new_price int not null check (new_price between 1 and 500),
  lat double precision not null,     -- геометка ОБЯЗАТЕЛЬНА для правки
  lon double precision not null,
  photo_id uuid references public.menu_photos(id),
  created_at timestamptz not null default now(),
  unique (item_id, device, created_at)
);
alter table public.price_updates enable row level security;
drop policy if exists "anon insert price_updates" on public.price_updates;
create policy "anon insert price_updates" on public.price_updates for insert to anon with check (true);
drop policy if exists "anon read price_updates" on public.price_updates;
create policy "anon read price_updates" on public.price_updates for select to anon using (true);

-- правку принимаем только если телефон РЯДОМ с точкой: 50 метров.
-- Фото можно подделать (тем же ChatGPT), физическое присутствие — нет.
create or replace function public.price_update_geofence() returns trigger
language plpgsql security definer as $$
declare ilat double precision; ilon double precision; d double precision;
begin
  select s.lat, s.lon into ilat, ilon from public.submissions s
   where 'ui-' || s.id::text = new.item_id;
  if ilat is null or ilon is null then
    return new;                                   -- у наших посевных точек координат нет
  end if;
  d := public.meters_between(new.lat, new.lon, ilat, ilon);
  if d > 50 then
    raise exception 'Правку принимаем только на месте: до точки % м.', round(d)
      using errcode = 'check_violation';
  end if;
  return new;
end; $$;
drop trigger if exists price_update_geofence_trg on public.price_updates;
create trigger price_update_geofence_trg before insert on public.price_updates
  for each row execute function public.price_update_geofence();

-- ── ЖУРНАЛ МОНЕТ
create table if not exists public.coin_ledger (
  id uuid primary key default gen_random_uuid(),
  device text not null,
  kind text not null check (kind in ('item','venue','photo','district','streak','milestone','update')),
  amount int not null check (amount between 1 and 1000),
  ref text,                                    -- item_id или иной повод
  status text not null default 'pending' check (status in ('pending','credited','void')),
  credit_after timestamptz not null,           -- когда монета созреет
  created_at timestamptz not null default now(),
  unique (device, kind, ref)                   -- один повод — одно начисление
);
create index if not exists coin_ledger_dev on public.coin_ledger (device, status, credit_after);
alter table public.coin_ledger enable row level security;
-- Ни читать таблицу целиком, ни писать в неё анониму нельзя: единственная дверь —
-- функция coin_balance ниже. Раньше политика стояла using(true) и позволяла выгрузить
-- журнал всех устройств разом.
revoke insert, update, delete on public.coin_ledger from anon, public;

-- начисление кладём с задержкой: с геометкой 15 минут, без неё 60.
-- ВАЖНО: функция НЕ выдаётся анониму. Иначе любой мог бы вызвать её из консоли
-- и выписать себе 1000 монет — сервер лишь послушно записал бы. Начисляют только
-- триггеры ниже, и сумму с поводом определяет сервер по уже проверенной строке.
create or replace function public.award_coins(
  p_device text, p_kind text, p_amount int, p_ref text, p_onsite boolean default false)
returns timestamptz language plpgsql security definer as $$
declare t timestamptz; cap int;
begin
  cap := case p_kind when 'item' then 1 when 'photo' then 1 when 'update' then 1
                     when 'venue' then 2 when 'district' then 5
                     when 'milestone' then 10 else 0 end;
  if cap = 0 or p_amount > cap then
    raise exception 'Недопустимое начисление: % / %', p_kind, p_amount using errcode = 'check_violation';
  end if;
  t := now() + case when p_onsite then interval '15 minutes' else interval '60 minutes' end;
  insert into public.coin_ledger (device, kind, amount, ref, credit_after)
  values (p_device, p_kind, p_amount, p_ref, t)
  on conflict (device, kind, ref) do nothing;
  return t;
end; $$;
revoke execute on function public.award_coins(text, text, int, text, boolean) from anon, public;

-- ── НАЧИСЛЯЮТ ТРИГГЕРЫ. Устройство, повод и «был ли на месте» берутся из строки,
--    которая уже прошла все проверки, а не из аргументов клиента.
create or replace function public.award_for_submission() returns trigger
language plpgsql security definer as $$
begin
  perform public.award_coins(new.device, 'item', 1, 'ui-' || new.id::text,
                             new.lat is not null and new.lon is not null);
  return new;
end; $$;
drop trigger if exists award_for_submission_trg on public.submissions;
create trigger award_for_submission_trg after insert on public.submissions
  for each row execute function public.award_for_submission();

create or replace function public.award_for_menu_photo() returns trigger
language plpgsql security definer as $$
begin
  perform public.award_coins(new.device, 'photo', 1, new.id::text,
                             new.lat is not null and new.lon is not null);
  return new;
end; $$;
drop trigger if exists award_for_menu_photo_trg on public.menu_photos;
create trigger award_for_menu_photo_trg after insert on public.menu_photos
  for each row execute function public.award_for_menu_photo();

-- правка цены всегда «на месте»: геофенс 50 м её иначе не пропустит
create or replace function public.award_for_price_update() returns trigger
language plpgsql security definer as $$
begin
  perform public.award_coins(new.device, 'update', 1, new.id::text, true);
  return new;
end; $$;
drop trigger if exists award_for_price_update_trg on public.price_updates;
create trigger award_for_price_update_trg after insert on public.price_updates
  for each row execute function public.award_for_price_update();

-- баланс: сначала «созреваем» отложенные начисления, потом считаем.
-- pg_cron на бесплатном тарифе может не быть, поэтому дозревание ленивое — на чтении.
--
-- ОГОВОРКА ПРО ДОСТУП: в v1 нет учёток (сознательно — чтобы не попасть под
-- локализацию персданных), значит и auth.uid() нет, и привязать device к сеансу
-- нечем. Поэтому чужой id, если его узнать, позволяет посмотреть чужой баланс и
-- «доварить» чужие отложенные монеты. Ни то, ни другое ничего не даёт: id
-- случайный и ничей, а созревание всё равно произошло бы по времени. Как только
-- появится Telegram initData с подписью — device берём оттуда, а не из аргумента.
create or replace function public.coin_balance(p_device text)
returns table (balance int, pending int, next_at timestamptz)
language plpgsql security definer as $$
begin
  update public.coin_ledger set status = 'credited'
   where device = p_device and status = 'pending' and credit_after <= now();
  return query
    select coalesce(sum(amount) filter (where status = 'credited'), 0)::int,
           coalesce(sum(amount) filter (where status = 'pending'), 0)::int,
           min(credit_after) filter (where status = 'pending')
      from public.coin_ledger where device = p_device;
end; $$;
grant execute on function public.coin_balance(text) to anon;

-- позицию скрыли модерацией — начисления по ней аннулируются
create or replace function public.void_coins_on_hide() returns trigger
language plpgsql security definer as $$
begin
  if new.status = 'hidden' and old.status <> 'hidden' then
    update public.coin_ledger set status = 'void'
     where ref = 'ui-' || new.id::text and status <> 'void';
  end if;
  return new;
end; $$;
drop trigger if exists void_coins_on_hide_trg on public.submissions;
create trigger void_coins_on_hide_trg after update on public.submissions
  for each row execute function public.void_coins_on_hide();
