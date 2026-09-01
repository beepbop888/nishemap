-- НищеMap 25: монета приходит за ПОДТВЕРЖДЁННУЮ цену, как и написано везде.
--
-- Расхождение поймал предзапусковый разбор. Главная страница обещает «Монета —
-- это твоя цена, которую подтвердил район», медали подписаны «подтверждённых
-- цен», а award_for_submission платил в момент вставки строки — то есть за
-- всё подряд, включая выдуманное. Одновременно и ложь в интерфейсе, и кран.
--
-- Правило подтверждения — то же, что в приложении (isVerified): есть живое фото
-- позиции ЛИБО два разных устройства её подтвердили.
create or replace function public.item_verified(p_item text) returns boolean
language sql stable security definer as $$
  select exists (select 1 from public.item_photos
                  where item_id = p_item and status = 'live')
      or (select count(distinct device) from public.confirms
           where item_id = p_item) >= 2;
$$;

-- Начисляем за позицию (и за первую цену в заведении) в момент подтверждения.
create or replace function public.award_if_verified(p_item text) returns void
language plpgsql security definer as $$
declare s record; first_here boolean;
begin
  if p_item !~ '^ui-[0-9a-f-]{36}$' then return; end if;     -- посевные точки не оплачиваем
  select * into s from public.submissions
   where 'ui-' || id::text = p_item and status = 'live';
  if not found or s.device is null then return; end if;
  if not public.item_verified(p_item) then return; end if;

  perform public.award_coins(s.device, 'item', 1, p_item,
                             s.lat is not null and s.lon is not null);
  select not exists (
    select 1 from public.submissions o
     where o.id <> s.id and o.status = 'live'
       and lower(o.venue) = lower(s.venue) and lower(o.address) = lower(s.address)
       and o.submitted_at < s.submitted_at
  ) into first_here;
  if first_here then
    perform public.award_coins(s.device, 'venue', 2,
                               lower(s.venue) || '|' || lower(s.address),
                               s.lat is not null and s.lon is not null);
  end if;
end; $$;
revoke execute on function public.award_if_verified(text) from anon, public;

-- Вставка цены больше НЕ платит. Платят подтверждения и фото.
create or replace function public.award_for_submission() returns trigger
language plpgsql security definer as $$
begin
  return new;                       -- см. award_if_verified: платим за подтверждение
end; $$;

create or replace function public.award_on_confirm() returns trigger
language plpgsql security definer as $$
begin
  perform public.award_if_verified(new.item_id);
  return new;
end; $$;
drop trigger if exists award_on_confirm_trg on public.confirms;
create trigger award_on_confirm_trg after insert on public.confirms
  for each row execute function public.award_on_confirm();

drop trigger if exists award_on_photo_trg on public.item_photos;
create trigger award_on_photo_trg after insert on public.item_photos
  for each row execute function public.award_on_confirm();

-- Позиции, которые уже успели стать подтверждёнными до этой миграции,
-- не должны остаться без монеты.
do $$
declare r record;
begin
  for r in select distinct 'ui-' || id::text as item from public.submissions where status = 'live'
  loop
    perform public.award_if_verified(r.item);
  end loop;
end $$;

notify pgrst, 'reload schema';
