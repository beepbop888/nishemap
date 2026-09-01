-- НищеMap 23: покупка аватара под замком.
--
-- buy_avatar читал баланс, сравнивал, потом вставлял покупку — тремя отдельными
-- шагами. Два одновременных запроса на РАЗНЫЕ аватары видели один и тот же
-- баланс, оба проходили проверку и оба вставляли строку: ключ (device, avatar_id)
-- их не сталкивал. Счёт уходил в минус на стоимость второго.
--
-- Лечится замком на устройство: второй запрос ждёт первого и видит уже списанный
-- баланс. Плюс сам счёт больше не может уйти ниже нуля — проверка перенесена
-- внутрь того же атомарного участка.
create or replace function public.buy_avatar(p_device text, p_avatar text)
returns table (ok boolean, balance int, reason text)
language plpgsql security definer as $$
declare p int; earned int; spent int;
begin
  -- Замок живёт до конца транзакции и снимается сам. Ключ — устройство:
  -- покупки разных людей друг друга не ждут.
  perform pg_advisory_xact_lock(hashtext('nishemap.buy:' || p_device));

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
