-- НищеMap 14: доводка журнала монет. Запускать после 12_ledger.sql и 13_overrides.sql.

-- 1) Журнал не читаем даже построчно.
--    RLS без политики и так не отдаёт строк, но 200 в ответ на запрос чужого
--    журнала — плохой сигнал. Пусть будет прямой отказ.
revoke select on public.coin_ledger from anon, public;

-- 2) Скрыл владелец — монеты за позицию сгорают.
--    Триггер из 12_ledger.sql ловил только submissions.status='hidden', а
--    решения владельца с 13_overrides.sql лежат в overrides. Без этого «скрыть»
--    убирало позицию с карты, но оплаченные ею монеты оставались.
create or replace function public.void_coins_on_override() returns trigger
language plpgsql security definer as $$
begin
  if new.hidden then
    update public.coin_ledger set status = 'void'
     where ref = new.item_id and status <> 'void';
  end if;
  return new;
end; $$;
drop trigger if exists void_coins_on_override_trg on public.overrides;
create trigger void_coins_on_override_trg after insert or update on public.overrides
  for each row execute function public.void_coins_on_override();

-- 3) Таблица лидеров по РЕАЛЬНЫМ монетам — из журнала, не из localStorage.
--    Аноним её не видит: устройства случайные, показывать чужие балансы незачем,
--    а владельцу видно через сервисный ключ.
create or replace view public.coin_top as
select l.device,
       sum(l.amount) filter (where l.status = 'credited')            as coins,
       sum(l.amount) filter (where l.status = 'pending')             as pending,
       count(*)      filter (where l.kind = 'item'   and l.status = 'credited') as items,
       count(*)      filter (where l.kind = 'photo'  and l.status = 'credited') as photos,
       count(*)      filter (where l.kind = 'update' and l.status = 'credited') as updates,
       sum(l.amount) filter (where l.status = 'void')                as burned,
       min(l.created_at)                                             as first_seen,
       max(l.created_at)                                             as last_seen
  from public.coin_ledger l
 group by l.device
 order by 2 desc nulls last;
revoke all on public.coin_top from anon, public;
