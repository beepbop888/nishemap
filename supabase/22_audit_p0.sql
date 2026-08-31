-- НищеMap 22: закрываем то, что нашёл предзапусковый разбор.
-- Всё здесь — про дыры, которые открывались публичным anon-ключом из curl.

-- ============ 1. Купленный аватар ломал отправку цен ============
-- avatar_prices продаёт 28 аватаров, а sane_avatar из 09_avatars_v3 знал 17.
-- Триггер из 18 стирает чужие аватары, но КУПЛЕННЫЙ доживал до CHECK — и цена
-- отбивалась. Причём клиент этой ошибки не показывал. Список продаваемого
-- теперь один: avatar_prices.
alter table public.submissions drop constraint if exists sane_avatar;
alter table public.submissions drop constraint if exists submissions_avatar_fkey;
alter table public.submissions
  add constraint submissions_avatar_fkey
  foreign key (avatar) references public.avatar_prices(avatar_id) on update cascade;

-- ============ 2. Кран монет: menu_photos ============
-- anon мог слать строки пачками, каждая давала монету: ref = новый uuid, значит
-- защита от повтора не срабатывала, а лимит был только «то же item_id раз в 7 дней».
create or replace function public.rl_menu_photos() returns trigger
language plpgsql security definer as $$
declare n int; g int;
begin
  if new.device is null or length(new.device) < 6 then
    raise exception 'Нет идентификатора устройства.' using errcode = 'check_violation';
  end if;
  select count(*) into n from public.menu_photos
   where device = new.device and created_at > now() - interval '1 day';
  if n >= 5 then
    raise exception 'Больше пяти меню в сутки — это уже не про еду.' using errcode = 'check_violation';
  end if;
  select count(*) into g from public.menu_photos where created_at > now() - interval '1 minute';
  if g >= 20 then
    raise exception 'Слишком много загрузок сразу, попробуй через минуту.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;
drop trigger if exists rl_menu_photos_trg on public.menu_photos;
create trigger rl_menu_photos_trg before insert on public.menu_photos
  for each row execute function public.rl_menu_photos();

-- ============ 3. Кран монет: price_updates ============
-- Геофенс пропускал всё, чему не нашёл координат, — то есть любую строку с
-- выдуманным item_id. Теперь наоборот: не смогли проверить — не пускаем.
create or replace function public.price_update_geofence() returns trigger
language plpgsql security definer as $$
declare ilat double precision; ilon double precision; d double precision;
begin
  select s.lat, s.lon into ilat, ilon from public.submissions s
   where 'ui-' || s.id::text = new.item_id;
  if ilat is null or ilon is null then
    -- Раньше здесь было `return new` — и это был кран монет: любой item_id,
    -- которому не нашлось координат, проходил без единой проверки.
    raise exception 'Правку можно прислать только для точки с координатами.'
      using errcode = 'check_violation';
  end if;
  d := public.meters_between(new.lat, new.lon, ilat, ilon);
  if d > 50 then
    raise exception 'Правку принимаем только на месте: до точки % м.', round(d)
      using errcode = 'check_violation';
  end if;
  return new;
end; $$;

create or replace function public.rl_price_updates() returns trigger
language plpgsql security definer as $$
declare n int;
begin
  if new.device is null or length(new.device) < 6 then
    raise exception 'Нет идентификатора устройства.' using errcode = 'check_violation';
  end if;
  select count(*) into n from public.price_updates
   where device = new.device and created_at > now() - interval '1 day';
  if n >= 5 then
    raise exception 'Больше пяти правок в сутки не принимаем.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;
drop trigger if exists rl_price_updates_trg on public.price_updates;
create trigger rl_price_updates_trg before insert on public.price_updates
  for each row execute function public.rl_price_updates();

-- ============ 4. Потолок начислений на устройство в сутки ============
-- Даже с лимитами выше поводов начислить много. Пусть у монет будет суточный
-- потолок по каждому виду: это последний рубеж, если найдётся ещё один кран.
create or replace function public.award_coins(
  p_device text, p_kind text, p_amount int, p_ref text, p_onsite boolean default false)
returns timestamptz language plpgsql security definer as $$
declare t timestamptz; cap int; per_day int; today int;
begin
  cap := case p_kind when 'item' then 1 when 'photo' then 1 when 'update' then 1
                     when 'report' then 1
                     when 'venue' then 2 when 'district' then 5
                     when 'milestone' then 10 else 0 end;
  if cap = 0 or p_amount > cap then
    raise exception 'Недопустимое начисление: % / %', p_kind, p_amount using errcode = 'check_violation';
  end if;
  per_day := case p_kind when 'item' then 20 when 'photo' then 5 when 'update' then 5
                         when 'report' then 10 else 50 end;
  select coalesce(sum(amount), 0) into today from public.coin_ledger
   where device = p_device and kind = p_kind and created_at > now() - interval '1 day';
  if today + p_amount > per_day then
    return null;                       -- молча: работу засчитали, монету — нет
  end if;
  t := now() + case when p_onsite then interval '15 minutes' else interval '60 minutes' end;
  insert into public.coin_ledger (device, kind, amount, ref, credit_after)
  values (p_device, p_kind, p_amount, p_ref, t)
  on conflict (device, kind, ref) do nothing;
  return t;
end; $$;
revoke execute on function public.award_coins(text, text, int, text, boolean) from anon, public;

-- ============ 5. Таблица лидеров отдавала device ============
-- device — единственный идентификатор в системе, и по нему читается чужой
-- баланс. Из публичного представления он уходит совсем.
drop view if exists public.leaderboard;
create view public.leaderboard as
with mine as (
  select s.device,
         count(*) filter (where s.status = 'live')                       as items,
         count(distinct (lower(s.venue) || '|' || lower(s.address)))     as venues,
         min(s.submitted_at)                                             as first_seen,
         max(s.submitted_at)                                             as last_seen
    from public.submissions s
   where s.device is not null
   group by s.device
)
select md5(device) as who,          -- стабильная метка без самого ключа
       items, venues, first_seen, last_seen,
       (items + venues * 2) as score
  from mine
 order by score desc
 limit 100;

-- ============ 6. Автоматическое посерение убрано ============
-- Три жалобы с трёх вкладок делали серой любую точку на карте. Теперь владелец
-- видит КАЖДУЮ жалобу в Telegram и решает сам — автоматике здесь делать нечего.
create or replace function public.apply_report() returns trigger
language plpgsql security definer as $$
begin
  return new;
end; $$;

-- ============ 7. Жалобы тоже надо ограничивать ============
create or replace function public.rl_reports() returns trigger
language plpgsql security definer as $$
declare n int; g int;
begin
  if new.device is not null then
    select count(*) into n from public.reports
     where device = new.device and created_at > now() - interval '1 day';
    if n >= 20 then
      raise exception 'Слишком много жалоб за сутки.' using errcode = 'check_violation';
    end if;
  end if;
  -- одна жалоба на позицию от устройства: остальное — накрутка
  if exists (select 1 from public.reports
              where item_id = new.item_id and device is not null and device = new.device) then
    return null;                       -- тихо: человеку уже сказали «спасибо»
  end if;
  select count(*) into g from public.reports where created_at > now() - interval '1 minute';
  if g >= 30 then
    raise exception 'Слишком много жалоб сразу.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;
drop trigger if exists rl_reports_trg on public.reports;
create trigger rl_reports_trg before insert on public.reports
  for each row execute function public.rl_reports();

notify pgrst, 'reload schema';
