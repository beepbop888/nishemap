-- НищеMap 26: две последние находки разбора.

-- ============ 1. Погашенные монеты больше не оставляют долг ============
-- Владелец скрывает позицию — начисления по ней сгорают. Но аватар, купленный
-- на эти монеты, оставался, и баланс уходил в минус: человек не мог купить
-- ничего, пока не заработает заново ровно столько же. Хуже того, это делало
-- скрытие беззубым: сдай мусор, купи «Золотого», получи скрытие, оставь аватар.
--
-- Теперь долг разбирается покупками: пока баланс отрицательный, снимаем
-- последнюю покупку. Заработанное честно не трогается — снимается ровно то,
-- что было оплачено сгоревшими монетами.
create or replace function public.settle_debt(p_device text) returns void
language plpgsql security definer as $$
declare earned int; spent int; victim record;
begin
  loop
    select coalesce(sum(amount), 0)::int into earned
      from public.coin_ledger where device = p_device and status = 'credited';
    select coalesce(sum(price), 0)::int into spent
      from public.purchases where device = p_device;
    exit when earned - spent >= 0;
    select * into victim from public.purchases
     where device = p_device order by created_at desc limit 1;
    exit when not found;                   -- покупок больше нет, дальше некуда
    delete from public.purchases
     where device = victim.device and avatar_id = victim.avatar_id;
  end loop;
end; $$;
revoke execute on function public.settle_debt(text) from anon, public;

create or replace function public.void_coins_on_override() returns trigger
language plpgsql security definer as $$
declare d text;
begin
  if new.hidden then
    -- запоминаем, у кого гасим, чтобы сразу же разобрать возникший долг
    select device into d from public.coin_ledger
     where ref = new.item_id and status <> 'void' limit 1;
    update public.coin_ledger set status = 'void'
     where ref = new.item_id and status <> 'void';
    if d is not null then perform public.settle_debt(d); end if;
  end if;
  return new;
end; $$;

create or replace function public.void_coins_on_hide() returns trigger
language plpgsql security definer as $$
declare d text;
begin
  if new.status = 'hidden' and old.status <> 'hidden' then
    select device into d from public.coin_ledger
     where ref = 'ui-' || new.id::text and status <> 'void' limit 1;
    update public.coin_ledger set status = 'void'
     where ref = 'ui-' || new.id::text and status <> 'void';
    if d is not null then perform public.settle_debt(d); end if;
  end if;
  return new;
end; $$;

-- ============ 2. Личность вместо строки из localStorage ============
-- Защита от самоподтверждения и от колец сговора сравнивала device — строку,
-- которую выбирает сам клиент. Почистил браузер — другой человек. Для тех, кто
-- заходит через Telegram, настоящая личность у нас уже есть: воркер проверяет
-- подпись initData ключом бота. Привязываем к ней устройства и сравниваем ЛЮДЕЙ.
create table if not exists public.tg_devices (
  device   text primary key,          -- одно устройство — один человек, первый и навсегда
  tg_id    bigint not null,
  bound_at timestamptz not null default now()
);
create index if not exists tg_devices_tg on public.tg_devices (tg_id);
alter table public.tg_devices enable row level security;
revoke all on public.tg_devices from anon, public;   -- пишет только воркер

-- Кто стоит за устройством. Без Telegram человек остаётся сам себе личностью —
-- хуже, чем было, не становится; лучше становится для всех, кто зашёл из бота.
create or replace function public.identity_of(p_device text) returns text
language sql stable security definer as $$
  select coalesce((select 'tg:' || tg_id::text from public.tg_devices where device = p_device),
                  'dev:' || coalesce(p_device, ''));
$$;

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
  -- Сравниваем людей, а не строки: три вкладки одного телеграм-аккаунта — это
  -- по-прежнему один человек, и свою цену он не подтвердит ни из одной из них.
  if exists (select 1 from public.submissions s
              where new.item_id = 'ui-' || s.id::text
                and public.identity_of(s.device) = public.identity_of(new.device)) then
    raise exception 'Свою же цену подтверждать нельзя.' using errcode = 'check_violation';
  end if;
  -- и один человек подтверждает позицию один раз, с какого бы устройства ни пришёл
  if exists (select 1 from public.confirms c
              where c.item_id = new.item_id
                and public.identity_of(c.device) = public.identity_of(new.device)) then
    return null;
  end if;
  return new;
end; $$;

create or replace function public.no_confirm_ring() returns trigger
language plpgsql security definer as $$
declare author text; n int;
begin
  select public.identity_of(s.device) into author from public.submissions s
   where 'ui-' || s.id::text = new.item_id;
  if author is null then return new; end if;
  select count(*) into n
    from public.confirms c
    join public.submissions s on 'ui-' || s.id::text = c.item_id
   where public.identity_of(c.device) = public.identity_of(new.device)
     and public.identity_of(s.device) = author;
  if n >= 5 then
    raise exception 'Слишком много подтверждений одному и тому же человеку.'
      using errcode = 'check_violation';
  end if;
  return new;
end; $$;

-- Таблица лидеров тоже должна считать людей, а не браузеры.
drop view if exists public.user_top;
create view public.user_top as
select coalesce(u.username, '') as username,
       u.first_name,
       u.tg_id,
       coalesce('tg:' || u.tg_id::text, l.device) as who,
       coalesce(sum(l.amount) filter (where l.status = 'credited'), 0)::int as coins,
       coalesce(sum(l.amount) filter (where l.status = 'pending'),  0)::int as pending,
       count(*) filter (where l.kind = 'item'   and l.status = 'credited')  as items,
       count(*) filter (where l.kind = 'photo'  and l.status = 'credited')  as photos,
       count(*) filter (where l.kind = 'report' and l.status = 'credited')  as reports,
       coalesce(sum(l.amount) filter (where l.status = 'void'), 0)::int     as burned,
       coalesce((select sum(p.price) from public.purchases p where p.device = l.device), 0) as spent,
       max(u.opens)     as opens,
       max(u.last_seen) as last_seen
  from public.coin_ledger l
  left join public.tg_devices d on d.device = l.device
  left join public.tg_users   u on u.tg_id  = d.tg_id
 group by u.username, u.first_name, u.tg_id, l.device
 order by 5 desc;
revoke all on public.user_top from anon, public;

notify pgrst, 'reload schema';
