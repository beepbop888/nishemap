-- НищеMap: защита от злоупотреблений. Запустить один раз в SQL Editor.
-- Закрывает находки аудита безопасности (2026-08-11).

-- ============ 1. КРИТИЧНО: хранилище фото ============
-- без этого любой может залить любой файл любого размера: фишинг-страницы,
-- нелегальный контент под нашим доменом, и выжрать бесплатный гигабайт за минуты
update storage.buckets
   set file_size_limit = 8388608,                                   -- 8 МБ
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic']
 where id = 'menus';

drop policy if exists "anon upload menus" on storage.objects;
create policy "anon upload menus" on storage.objects
  for insert to anon
  with check (
    bucket_id = 'menus'
    and (storage.foldername(name))[1] = 'items'
    and name ~* '\.(jpe?g|png|webp|heic)$'
  );

-- ============ 2. Лимит частоты: одна машина не зальёт базу ============
create or replace function public.rl_check(tbl regclass, dev text, lim int, win interval)
returns void language plpgsql security definer as $$
declare n int;
begin
  if dev is null then return; end if;
  execute format('select count(*) from %s where device = $1 and created_at > now() - $2', tbl)
    into n using dev, win;
  if n >= lim then
    raise exception 'Слишком часто. Подожди минуту.' using errcode = 'check_violation';
  end if;
end; $$;

create or replace function public.rl_submissions() returns trigger
language plpgsql security definer as $$
declare n int;
begin
  select count(*) into n from public.submissions
   where device = new.device and submitted_at > now() - interval '2 minutes';
  if new.device is not null and n >= 5 then
    raise exception 'Слишком много точек подряд. Подожди пару минут.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;
drop trigger if exists rl_submissions_trg on public.submissions;
create trigger rl_submissions_trg before insert on public.submissions
  for each row execute function public.rl_submissions();

create or replace function public.rl_confirms() returns trigger
language plpgsql security definer as $$
declare n int;
begin
  select count(*) into n from public.confirms
   where device = new.device and created_at > now() - interval '1 minute';
  if n >= 10 then
    raise exception 'Слишком много подтверждений подряд.' using errcode = 'check_violation';
  end if;
  -- нельзя подтверждать собственную точку
  if exists (select 1 from public.submissions s
              where new.item_id = 'ui-' || s.id::text and s.device = new.device) then
    raise exception 'Свою же цену подтверждать нельзя.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;
drop trigger if exists rl_confirms_trg on public.confirms;
create trigger rl_confirms_trg before insert on public.confirms
  for each row execute function public.rl_confirms();

create or replace function public.rl_views() returns trigger
language plpgsql security definer as $$
declare n int;
begin
  select count(*) into n from public.views where created_at > now() - interval '1 minute';
  if n >= 600 then   -- общий предохранитель от накрутки топ-5
    raise exception 'rate limit' using errcode = 'check_violation';
  end if;
  return new;
end; $$;
drop trigger if exists rl_views_trg on public.views;
create trigger rl_views_trg before insert on public.views
  for each row execute function public.rl_views();

-- ============ 3. Мусорные данные ============
alter table public.submissions drop constraint if exists sane_coords;
alter table public.submissions add constraint sane_coords
  check (lat is null or (lat between 54.5 and 57.0 and lon between 35.5 and 40.5));  -- Москва и область

-- фото можно вешать только на существующие позиции пользователей или на наши id
alter table public.item_photos drop constraint if exists sane_item;
alter table public.item_photos add constraint sane_item
  check (char_length(item_id) between 2 and 64);

-- ============ 4. Не отдаём служебные колонки анониму ============
revoke select (device, ip_hash) on public.submissions from anon;
revoke select (device) on public.confirms from anon;
