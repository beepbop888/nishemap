-- НищеMap 24: обещанные монеты начинают начисляться, просмотры перестают накручиваться.

-- ============ 1. «Первая цена в заведении» — +2 ============
-- Обещание висело в интерфейсе с самого начала, а начислял его только браузер.
-- Считаем на сервере и по той же паре «заведение + адрес», по которой карта
-- склеивает точки.
create or replace function public.award_for_submission() returns trigger
language plpgsql security definer as $$
declare first_here boolean;
begin
  perform public.award_coins(new.device, 'item', 1, 'ui-' || new.id::text,
                             new.lat is not null and new.lon is not null);
  -- первым считается тот, до кого цен здесь не сдавал НИКТО, включая его самого
  select not exists (
    select 1 from public.submissions s
     where s.id <> new.id and s.status = 'live'
       and lower(s.venue) = lower(new.venue) and lower(s.address) = lower(new.address)
  ) into first_here;
  if first_here then
    perform public.award_coins(new.device, 'venue', 2,
                               lower(new.venue) || '|' || lower(new.address),
                               new.lat is not null and new.lon is not null);
  end if;
  return new;
end; $$;

-- ============ 2. Медали приносят премию ============
-- Карточка медали печатает «+10 монет», но начислить их было некому: ни один
-- вызов award_coins не передавал kind='milestone'. Выдаём при вызревании.
create or replace function public.award_milestones(p_device text) returns void
language plpgsql security definer as $$
declare n int; m int;
begin
  select count(*) into n from public.coin_ledger
   where device = p_device and kind = 'item' and status = 'credited';
  foreach m in array array[10,25,50,100,175,200,275,400,500,1000,2000,2500] loop
    if n >= m then
      perform public.award_coins(p_device, 'milestone', 10, 'm' || m, true);
    end if;
  end loop;
end; $$;
revoke execute on function public.award_milestones(text) from anon, public;

create or replace function public.coin_stats(p_device text)
returns table (balance int, earned int, spent int, pending int,
               next_at timestamptz, items int, photos int, reports int, owned text[])
language plpgsql security definer as $$
declare e int; s int;
begin
  update public.coin_ledger set status = 'credited'
   where device = p_device and status = 'pending' and credit_after <= now();
  perform public.award_milestones(p_device);       -- вехи считаем по вызревшим позициям
  update public.coin_ledger set status = 'credited'
   where device = p_device and status = 'pending' and credit_after <= now();
  select coalesce(sum(amount), 0)::int into e
    from public.coin_ledger where device = p_device and status = 'credited';
  select coalesce(sum(price), 0)::int into s
    from public.purchases where device = p_device;
  return query
    select (e - s), e, s,
           coalesce((select sum(amount)::int from public.coin_ledger
                      where device = p_device and status = 'pending'), 0),
           (select min(credit_after) from public.coin_ledger
             where device = p_device and status = 'pending'),
           (select count(*)::int from public.coin_ledger
             where device = p_device and kind = 'item'   and status = 'credited'),
           (select count(*)::int from public.coin_ledger
             where device = p_device and kind = 'photo'  and status = 'credited'),
           (select count(*)::int from public.coin_ledger
             where device = p_device and kind = 'report' and status = 'credited'),
           coalesce((select array_agg(avatar_id) from public.purchases
                      where device = p_device), '{}'::text[]);
end; $$;
grant execute on function public.coin_stats(text) to anon;

-- ============ 3. Просмотры: пятничный топ был выбираемым ============
-- В views не было устройства вообще, а лимит стоял только общий — 600 строк в
-- минуту на всех. То есть один человек мог накрутить своё заведение в рассылку.
alter table public.views add column if not exists device text;
create index if not exists views_dev_day on public.views (device, created_at desc);

create or replace function public.rl_views() returns trigger
language plpgsql security definer as $$
declare n int; g int;
begin
  if new.device is not null then
    -- одно устройство — один просмотр точки в сутки; остальное не считается
    select count(*) into n from public.views
     where device = new.device and venue_key = new.venue_key
       and created_at > now() - interval '1 day';
    if n > 0 then return null; end if;
    select count(*) into n from public.views
     where device = new.device and created_at > now() - interval '1 hour';
    if n >= 120 then return null; end if;
  end if;
  select count(*) into g from public.views where created_at > now() - interval '1 minute';
  if g >= 600 then return null; end if;
  return new;
end; $$;
drop trigger if exists rl_views_trg on public.views;
create trigger rl_views_trg before insert on public.views
  for each row execute function public.rl_views();

-- ============ 4. Длина ключей ============
-- item_id — свободный текст от анонима; без потолка он растит таблицы мусором.
alter table public.reports   drop constraint if exists reports_item_len;
alter table public.reports   add  constraint reports_item_len   check (length(item_id) <= 60);
alter table public.overrides drop constraint if exists overrides_item_len;
alter table public.overrides add  constraint overrides_item_len check (length(item_id) <= 60);

notify pgrst, 'reload schema';
