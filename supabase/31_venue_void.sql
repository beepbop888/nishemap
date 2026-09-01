-- НищеMap 31: премия «первая цена в заведении» тоже сгорает при скрытии.
--
-- Гашение искало строки журнала по ref = 'ui-<id>', а премия за заведение
-- лежала под ref «название|адрес» — они не совпадали никогда. Скрытие мусорной
-- точки забирало одну монету из трёх, а две оставались. Привязываем премию к
-- той же позиции, что её заработала.
create or replace function public.award_if_verified(p_item text) returns void
language plpgsql security definer as $$
declare s record; first_here boolean;
begin
  if p_item !~ '^ui-[0-9a-f-]{36}$' then return; end if;
  select * into s from public.submissions
   where 'ui-' || id::text = p_item and status = 'live';
  if not found or s.device is null then return; end if;
  if not public.item_verified(p_item) then return; end if;

  perform public.award_coins(s.device, 'item', 1, p_item,
                             s.lat is not null and s.lon is not null);
  -- Первым считается тот, до кого живых цен здесь не сдавал никто.
  -- Скрытая позиция «освобождает» место — и это правильно: если первую цену
  -- убрали как мусор, следующий человек действительно первый.
  select not exists (
    select 1 from public.submissions o
     where o.id <> s.id and o.status = 'live'
       and lower(o.venue) = lower(s.venue) and lower(o.address) = lower(s.address)
       and o.submitted_at < s.submitted_at
  ) into first_here;
  if first_here then
    -- ref привязан к позиции, а не к названию: иначе гашение его не находит.
    -- Повторную выплату за то же место держит проверка first_here выше.
    perform public.award_coins(s.device, 'venue', 2, 'v:' || p_item,
                               s.lat is not null and s.lon is not null);
  end if;
end; $$;
revoke execute on function public.award_if_verified(text) from anon, public;

create or replace function public.void_coins_on_override() returns trigger
language plpgsql security definer as $$
declare d text;
begin
  if new.hidden then
    select device into d from public.coin_ledger
     where ref in (new.item_id, 'v:' || new.item_id) and status <> 'void' limit 1;
    update public.coin_ledger set status = 'void'
     where ref in (new.item_id, 'v:' || new.item_id) and status <> 'void';
    if d is not null then perform public.settle_debt(d); end if;
  end if;
  return new;
end; $$;

create or replace function public.void_coins_on_hide() returns trigger
language plpgsql security definer as $$
declare d text; it text;
begin
  if new.status = 'hidden' and old.status <> 'hidden' then
    it := 'ui-' || new.id::text;
    select device into d from public.coin_ledger
     where ref in (it, 'v:' || it) and status <> 'void' limit 1;
    update public.coin_ledger set status = 'void'
     where ref in (it, 'v:' || it) and status <> 'void';
    if d is not null then perform public.settle_debt(d); end if;
  end if;
  return new;
end; $$;

-- Переносим уже выданные премии на новый ref, иначе старые останутся негасимыми.
update public.coin_ledger l set ref = 'v:ui-' || s.id::text
  from public.submissions s
 where l.kind = 'venue'
   and l.ref = lower(s.venue) || '|' || lower(s.address)
   and l.device = s.device;

notify pgrst, 'reload schema';
