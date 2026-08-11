-- НищеMap 06: аватары + починка лимитов. Запустить в SQL Editor.
-- Чинит дыру: в 05 лимит пропускал запрос, если device не прислали вовсе.

-- ============ 1. аватар автора (без персональных данных) ============
alter table public.submissions add column if not exists avatar text;
alter table public.submissions drop constraint if exists sane_avatar;
alter table public.submissions add constraint sane_avatar
  check (avatar is null or avatar in ('student','office','doshik','investor','babushka'));

-- ============ 2. ЛИМИТЫ: device обязателен + общий предохранитель ============
create or replace function public.rl_submissions() returns trigger
language plpgsql security definer as $$
declare n int; g int;
begin
  -- без идентификатора устройства лимит обходился простым пропуском поля
  if new.device is null or length(new.device) < 6 then
    raise exception 'Нет идентификатора устройства.' using errcode = 'check_violation';
  end if;
  select count(*) into n from public.submissions
   where device = new.device and submitted_at > now() - interval '2 minutes';
  if n >= 5 then
    raise exception 'Слишком много точек подряд. Подожди пару минут.' using errcode = 'check_violation';
  end if;
  -- общий потолок: даже если менять device на каждый запрос, потоп не пройдёт
  select count(*) into g from public.submissions where submitted_at > now() - interval '1 minute';
  if g >= 40 then
    raise exception 'Карта сейчас перегружена, попробуй через минуту.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;

create or replace function public.rl_confirms() returns trigger
language plpgsql security definer as $$
declare n int; g int;
begin
  if new.device is null or length(new.device) < 6 then
    raise exception 'Нет идентификатора устройства.' using errcode = 'check_violation';
  end if;
  select count(*) into n from public.confirms
   where device = new.device and created_at > now() - interval '1 minute';
  if n >= 10 then
    raise exception 'Слишком много подтверждений подряд.' using errcode = 'check_violation';
  end if;
  select count(*) into g from public.confirms where created_at > now() - interval '1 minute';
  if g >= 120 then
    raise exception 'rate limit' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.submissions s
              where new.item_id = 'ui-' || s.id::text and s.device = new.device) then
    raise exception 'Свою же цену подтверждать нельзя.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;

create or replace function public.rl_photos() returns trigger
language plpgsql security definer as $$
declare g int;
begin
  select count(*) into g from public.item_photos where submitted_at > now() - interval '1 minute';
  if g >= 30 then
    raise exception 'rate limit' using errcode = 'check_violation';
  end if;
  return new;
end; $$;
drop trigger if exists rl_photos_trg on public.item_photos;
create trigger rl_photos_trg before insert on public.item_photos
  for each row execute function public.rl_photos();

-- ============ 3. счётчик просмотров места за неделю (для «12 человек смотрели») ============
create or replace function public.venue_views(vkey text)
returns int language sql security definer stable as $$
  select count(*)::int from public.views
   where venue_key = vkey and created_at > now() - interval '7 days';
$$;
grant execute on function public.venue_views(text) to anon;
