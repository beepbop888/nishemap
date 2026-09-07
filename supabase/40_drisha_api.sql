-- НищеMap 40: двери в ДрищMap.
--
-- Платный слой нельзя гейтить на клиенте: спрятанный в браузере ответ не
-- спрятан вовсе. Поэтому наружу торчат две функции, и обе сами проверяют
-- подписку — данные к неоплатившему просто не выезжают.

-- ============ Что видно БЕЗ подписки ============
-- Ровно счётчик: сколько мест в городе отмечено. Витрина, а не товар.
create or replace function public.drisha_teaser()
returns table (venues int, severe int, last_case date)
language sql stable security definer as $$
  select count(*)::int,
         count(*) filter (where severe > 0)::int,
         max(last_case)
    from public.drisha_points;
$$;
grant execute on function public.drisha_teaser() to anon;

-- ============ Сам слой ============
create or replace function public.drisha_map(p_device text, p_key text)
returns table (venue_key text, venue_name text, address text,
               lat double precision, lon double precision,
               reports bigint, severe bigint, sites bigint,
               last_case date, score bigint)
language plpgsql stable security definer as $$
declare tg bigint;
begin
  if not public.device_ok(p_device, p_key) then return; end if;
  select d.tg_id into tg from public.tg_devices d where d.device = p_device;
  if tg is null or not public.sub_active(tg) then return; end if;
  return query
    select p.venue_key, p.venue_name, p.address, p.lat, p.lon,
           p.reports, p.severe, p.sites, p.last_case, p.score
      from public.drisha_points p
     order by p.score desc;
end; $$;
grant execute on function public.drisha_map(text, text) to anon;

-- ============ Что именно писали про одно место ============
-- Цитаты чужих отзывов отдаём ТОЛЬКО вместе с автором, датой и ссылкой:
-- приложение ничего не утверждает, оно показывает, что написали другие.
create or replace function public.drisha_venue(p_device text, p_key text, p_venue text)
returns table (source text, kind text, happened_on date,
               quote text, url text, author text, site text)
language plpgsql stable security definer as $$
declare tg bigint;
begin
  if not public.device_ok(p_device, p_key) then return; end if;
  select d.tg_id into tg from public.tg_devices d where d.device = p_device;
  if tg is null or not public.sub_active(tg) then return; end if;
  return query
    select r.source, r.kind, r.happened_on,
           case when r.source = 'ext' then left(r.quote, 400) else null end,
           r.url, r.author, r.site
      from public.sick_reports r
     where r.venue_key = p_venue and r.status = 'live'
       and r.happened_on >= (current_date - interval '3 months')
     order by r.happened_on desc
     limit 50;
end; $$;
grant execute on function public.drisha_venue(text, text, text) to anon;

-- ============ «Мне поплохело» ============
-- Пишет сам человек, поэтому проверок больше, чем на чтении: подписка тут НЕ
-- нужна (сигнал ценен от всех), но личность из Telegram — нужна, иначе слой
-- превращается в оружие против конкурента.
create or replace function public.drisha_report(
  p_device text, p_key text, p_venue text, p_name text, p_address text,
  p_kind text, p_when date, p_lat double precision, p_lon double precision)
returns table (ok boolean, reason text)
language plpgsql security definer as $$
declare n int;
begin
  if not public.device_ok(p_device, p_key) then
    return query select false, 'Не твоё устройство'; return;
  end if;
  if not exists (select 1 from public.tg_devices where device = p_device) then
    return query select false, 'Отмечать можно из приложения Telegram'; return;
  end if;
  if p_kind not in ('poisoning', 'diarrhea', 'vomit', 'bad') then
    return query select false, 'Непонятно что'; return;
  end if;
  -- Задним числом дальше трёх месяцев смысла нет: слой всё равно это не покажет.
  if p_when > current_date or p_when < current_date - interval '3 months' then
    return query select false, 'Дата вне последних трёх месяцев'; return;
  end if;
  select count(*) into n from public.sick_reports
   where device = p_device and source = 'crowd'
     and created_at > now() - interval '1 day';
  if n >= 3 then
    return query select false, 'Больше трёх отметок в сутки не принимаем'; return;
  end if;
  insert into public.sick_reports
    (venue_key, venue_name, address, lat, lon, source, kind, happened_on, device)
  values (p_venue, left(p_name, 120), left(p_address, 160), p_lat, p_lon,
          'crowd', p_kind, p_when, p_device)
  on conflict do nothing;
  return query select true, 'Отметили';
end; $$;
grant execute on function public.drisha_report(text, text, text, text, text, text, date,
                                               double precision, double precision) to anon;

notify pgrst, 'reload schema';

-- ============ Продление подписки после оплаты ============
-- Зовёт только воркер, получив от Telegram successful_payment. Продлеваем от
-- текущей даты окончания, если она ещё не прошла: оплативший заранее не теряет
-- остаток месяца.
create or replace function public.sub_extend(p_tg_id bigint, p_days int, p_stars int)
returns timestamptz language plpgsql security definer as $$
declare cur timestamptz; new_until timestamptz;
begin
  select until into cur from public.subscriptions where tg_id = p_tg_id;
  new_until := greatest(coalesce(cur, now()), now()) + make_interval(days => p_days);
  insert into public.subscriptions (tg_id, until, last_paid, stars_paid)
  values (p_tg_id, new_until, now(), coalesce(p_stars, 0))
  on conflict (tg_id) do update
     set until = excluded.until, last_paid = now(),
         stars_paid = public.subscriptions.stars_paid + coalesce(p_stars, 0);
  return new_until;
end; $$;
revoke execute on function public.sub_extend(bigint, int, int) from anon, public;
notify pgrst, 'reload schema';
