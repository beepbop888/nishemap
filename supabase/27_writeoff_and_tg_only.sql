-- НищеMap 27: два решения владельца.
--
-- 1) Долга не бывает. Скрыли позицию — монеты за неё сгорают, аватар остаётся.
--    Прошлый вариант снимал покупку, чтобы свести баланс, и человек терял
--    купленное. Решение: списываем недостачу, а не покупку.
-- 2) Монеты и аватары — только для тех, кто зашёл через Telegram. Там есть
--    подпись и настоящая личность; в браузере есть только строка из localStorage,
--    которую чистят одним движением. Цены с сайта принимаем как принимали —
--    карта важнее наград.

alter table public.coin_ledger drop constraint if exists coin_ledger_kind_check;
alter table public.coin_ledger add  constraint coin_ledger_kind_check
  check (kind in ('item','venue','photo','district','streak','milestone','update',
                  'report','dev','writeoff'));

-- ============ 1. Списание вместо изъятия ============
create or replace function public.settle_debt(p_device text) returns void
language plpgsql security definer as $$
declare earned int; spent int; gap int; i int;
begin
  select coalesce(sum(amount), 0)::int into earned
    from public.coin_ledger where device = p_device and status = 'credited';
  select coalesce(sum(price), 0)::int into spent
    from public.purchases where device = p_device;
  gap := spent - earned;
  if gap <= 0 then return; end if;
  -- Компенсирующая запись: баланс возвращается в ноль, аватар остаётся у
  -- человека, а сгоревшие монеты потрачены навсегда — второй раз ими не купишь.
  -- amount ограничен тысячей, поэтому кладём пачками.
  for i in 1..ceil(gap / 1000.0)::int loop
    insert into public.coin_ledger (device, kind, amount, ref, status, credit_after)
    values (p_device, 'writeoff', least(1000, gap - (i - 1) * 1000),
            'wo-' || extract(epoch from now())::bigint || '-' || i, 'credited', now())
    on conflict (device, kind, ref) do nothing;
  end loop;
end; $$;
revoke execute on function public.settle_debt(text) from anon, public;

-- ============ 2. Награды только через Telegram ============
-- Проверка стоит в award_coins, то есть распространяется сразу на все поводы:
-- позиции, фото, правки, жалобы, вехи. Ни один путь мимо неё не проходит.
create or replace function public.award_coins(
  p_device text, p_kind text, p_amount int, p_ref text, p_onsite boolean default false)
returns timestamptz language plpgsql security definer as $$
declare t timestamptz; cap int; per_day int; today int;
begin
  -- Монеты живут только у людей с подтверждённой личностью. Служебные и
  -- компенсирующие записи кладут другие функции, сюда они не заходят.
  if not exists (select 1 from public.tg_devices where device = p_device) then
    return null;
  end if;
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
  if today + p_amount > per_day then return null; end if;
  t := now() + case when p_onsite then interval '15 minutes' else interval '60 minutes' end;
  insert into public.coin_ledger (device, kind, amount, ref, credit_after)
  values (p_device, p_kind, p_amount, p_ref, t)
  on conflict (device, kind, ref) do nothing;
  return t;
end; $$;
revoke execute on function public.award_coins(text, text, int, text, boolean) from anon, public;

create or replace function public.buy_avatar(p_device text, p_avatar text)
returns table (ok boolean, balance int, reason text)
language plpgsql security definer as $$
declare p int; earned int; spent int;
begin
  perform pg_advisory_xact_lock(hashtext('nishemap.buy:' || p_device));

  if not exists (select 1 from public.tg_devices where device = p_device) then
    return query select false, 0, 'Аватары живут в приложении Telegram'; return;
  end if;

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

notify pgrst, 'reload schema';
