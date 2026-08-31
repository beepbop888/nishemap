-- НищеMap 21: /coins прибавляет, а не заменяет.
--
-- Поймано на владельце. dev_grant стирал прежние тестовые монеты и клал новые,
-- а покупки аватаров оставались. Порядок «выдал 10000 → купил на 6200 →
-- выдал ещё 500» давал баланс 500 − 6200 = −5700, витрина показывала ноль, и
-- со стороны это выглядело как «команда перестала работать».
--
-- Тестовый режим должен вести себя как ожидает человек: /coins 500 добавляет
-- пятьсот. Начать с чистого листа — /coins reset: он же снимает и покупки,
-- иначе от прошлого прогона остаётся долг.
create or replace function public.dev_grant(p_device text, p_amount int, p_reset boolean default false)
returns table (total int, granted int, spent int)
language plpgsql security definer as $$
declare have int; add_n int; s int;
begin
  if p_reset then
    delete from public.coin_ledger where device = p_device and kind = 'dev';
    delete from public.purchases   where device = p_device;
  end if;

  add_n := greatest(0, coalesce(p_amount, 0));
  if add_n > 0 then
    select coalesce(count(*), 0) into have
      from public.coin_ledger where device = p_device and kind = 'dev';
    -- amount ограничен тысячей, чтобы обычное начисление не выписало состояние,
    -- поэтому тестовые монеты кладём пачками по 1000, продолжая нумерацию.
    insert into public.coin_ledger (device, kind, amount, ref, status, credit_after)
    select p_device, 'dev', least(1000, add_n - (i - 1) * 1000),
           'dev-' || (have + i), 'credited', now()
      from generate_series(1, ceil(add_n / 1000.0)::int) i;
  end if;

  select coalesce(sum(price), 0)::int into s
    from public.purchases where device = p_device;
  return query
    select coalesce((select sum(amount)::int from public.coin_ledger
                      where device = p_device and status = 'credited'), 0) - s,
           add_n, s;
end; $$;
revoke execute on function public.dev_grant(text, int, boolean) from anon, public;
drop function if exists public.dev_grant(text, int);
notify pgrst, 'reload schema';
