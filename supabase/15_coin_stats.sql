-- НищеMap 15: медали тоже считает сервер.
--
-- 12_ledger.sql увёл на сервер БАЛАНС, но медали остались на клиенте:
-- earnedTrophies() брала verifiedCount() из localStorage. То есть дописать себе
-- десяток выдуманных id — и открыты все двенадцать медалей, включая картинку
-- «похвастаться», которую человек отправляет другим. Ровно то, чего не хотели.
--
-- coin_stats отдаёт и баланс, и число зачтённых позиций — из журнала, который
-- анониму не виден и в который пишут только триггеры.
create or replace function public.coin_stats(p_device text)
returns table (balance int, pending int, next_at timestamptz, items int, photos int)
language plpgsql security definer as $$
begin
  update public.coin_ledger set status = 'credited'
   where device = p_device and status = 'pending' and credit_after <= now();
  return query
    select coalesce(sum(amount) filter (where status = 'credited'), 0)::int,
           coalesce(sum(amount) filter (where status = 'pending'), 0)::int,
           min(credit_after) filter (where status = 'pending'),
           count(*) filter (where kind = 'item'  and status = 'credited')::int,
           count(*) filter (where kind = 'photo' and status = 'credited')::int
      from public.coin_ledger where device = p_device;
end; $$;
grant execute on function public.coin_stats(text) to anon;
