-- НищеMap 16: монета жалобщику, аватары на сервере, личность из Telegram.
--
-- 1) Жалобу теперь подписывает устройство. Без этого некому платить за то, что
--    человек оказался прав: в reports лежали только item_id и причина.
alter table public.reports    add column if not exists device text;
-- 2) Кто посерел монету: владелец кнопкой или автоматика по трём жалобам.
--    Различать обязательно — платим только за решение владельца, иначе трое
--    сговорившихся жалуются друг другу и печатают себе монеты.
alter table public.overrides  add column if not exists by_owner boolean not null default false;

-- 3) Новый повод для начисления
alter table public.coin_ledger drop constraint if exists coin_ledger_kind_check;
alter table public.coin_ledger add  constraint coin_ledger_kind_check
  check (kind in ('item','venue','photo','district','streak','milestone','update','report'));

create or replace function public.award_coins(
  p_device text, p_kind text, p_amount int, p_ref text, p_onsite boolean default false)
returns timestamptz language plpgsql security definer as $$
declare t timestamptz; cap int;
begin
  cap := case p_kind when 'item' then 1 when 'photo' then 1 when 'update' then 1
                     when 'report' then 1
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

-- 4) Пожаловался — и владелец согласился: монета жалобщику.
--    Уникальность (device, kind, ref) в журнале сама не даст заплатить дважды.
create or replace function public.pay_reporters() returns trigger
language plpgsql security definer as $$
declare d text;
begin
  if new.disputed and new.by_owner then
    for d in select distinct device from public.reports
              where item_id = new.item_id and device is not null loop
      perform public.award_coins(d, 'report', 1, new.item_id, false);
    end loop;
  end if;
  return new;
end; $$;
drop trigger if exists pay_reporters_trg on public.overrides;
create trigger pay_reporters_trg after insert or update on public.overrides
  for each row execute function public.pay_reporters();

-- 5) АВАТАРЫ. Цена — на сервере: иначе «куплю за 0» решается в консоли,
--    а купленный аватар видно другим (submissions.avatar) — значит это не косметика.
create table if not exists public.avatar_prices (
  avatar_id text primary key,
  price int not null check (price >= 0)
);
alter table public.avatar_prices enable row level security;
drop policy if exists "anon read prices" on public.avatar_prices;
create policy "anon read prices" on public.avatar_prices for select to anon using (true);
insert into public.avatar_prices (avatar_id, price) values
  ('student_m', 0),
  ('student_f', 0),
  ('office_m', 0),
  ('office_f', 0),
  ('zapas_m', 0),
  ('zapas_f', 0),
  ('doshik_m', 50),
  ('doshik_f', 50),
  ('barista_f', 75),
  ('barista_m', 75),
  ('samokat_m', 100),
  ('samokat_f', 100),
  ('pvz_f', 125),
  ('pvz_m', 125),
  ('shaurmaster', 150),
  ('shaurmaster_f', 150),
  ('itshnik_m', 225),
  ('itshnik_f', 225),
  ('tsar', 275),
  ('tsar_f', 275),
  ('kosmonavt', 425),
  ('kosmonavt_f', 425),
  ('oligarkh', 650),
  ('oligarkh_f', 650),
  ('legenda', 900),
  ('legenda_f', 900),
  ('zoloto', 1650),
  ('zoloto_f', 1650)
on conflict (avatar_id) do update set price = excluded.price;

create table if not exists public.purchases (
  device     text not null,
  avatar_id  text not null references public.avatar_prices(avatar_id),
  price      int  not null,
  created_at timestamptz not null default now(),
  primary key (device, avatar_id)
);
alter table public.purchases enable row level security;
-- читать свои покупки можно только через buy_avatar/coin_stats; таблица закрыта
revoke all on public.purchases from anon, public;

-- Покупка целиком на сервере: цену берём из таблицы, баланс считаем из журнала.
create or replace function public.buy_avatar(p_device text, p_avatar text)
returns table (ok boolean, balance int, reason text)
language plpgsql security definer as $$
declare p int; earned int; spent int;
begin
  select price into p from public.avatar_prices where avatar_id = p_avatar;
  if p is null then return query select false, 0, 'нет такого аватара'; return; end if;

  update public.coin_ledger set status = 'credited'
   where device = p_device and status = 'pending' and credit_after <= now();
  select coalesce(sum(amount), 0)::int into earned
    from public.coin_ledger where device = p_device and status = 'credited';
  select coalesce(sum(price), 0)::int into spent
    from public.purchases where device = p_device;

  if exists (select 1 from public.purchases where device = p_device and avatar_id = p_avatar) then
    return query select true, earned - spent, 'уже куплен'; return;
  end if;
  if earned - spent < p then
    return query select false, earned - spent, 'не хватает монет'; return;
  end if;
  insert into public.purchases (device, avatar_id, price) values (p_device, p_avatar, p);
  return query select true, earned - spent - p, 'куплен';
end; $$;
grant execute on function public.buy_avatar(text, text) to anon;

-- 6) Баланс, медали и купленное — одним запросом.
--    owned отдаём массивом: иначе клиент решает, что у него открыто.
drop function if exists public.coin_stats(text);
create or replace function public.coin_stats(p_device text)
returns table (balance int, earned int, spent int, pending int,
               next_at timestamptz, items int, photos int, reports int, owned text[])
language plpgsql security definer as $$
declare e int; s int;
begin
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

-- 7) Личность из Telegram. Пишет только воркер: он один умеет проверить
--    подпись initData ключом бота. Аноним сюда не ходит вовсе.
create table if not exists public.tg_users (
  tg_id        bigint primary key,
  username     text,
  first_name   text,
  last_name    text,
  language     text,
  is_premium   boolean,
  device       text,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  opens        int not null default 1
);
create index if not exists tg_users_device on public.tg_users (device);
alter table public.tg_users enable row level security;
revoke all on public.tg_users from anon, public;

notify pgrst, 'reload schema';
