-- НищеMap 20: монеты для проверки — с сервера, а не из localStorage.
--
-- Пока баланс считал браузер, кнопка «+10000» в панели работала. Теперь баланс
-- берётся из журнала, и надбавка в localStorage не влияет ни на покупку аватара
-- (её решает buy_avatar), ни на медали (их считает coin_stats) — то есть
-- проверить нечего. Значит выдавать тестовые монеты должен тот же сервер.
--
-- Вызвать может только воркер под сервисным ключом, по команде из чата
-- владельца. Анониму функция не выдана — иначе это ровно та дыра, которую
-- закрывали.
alter table public.coin_ledger drop constraint if exists coin_ledger_kind_check;
alter table public.coin_ledger add  constraint coin_ledger_kind_check
  check (kind in ('item','venue','photo','district','streak','milestone','update','report','dev'));

create or replace function public.dev_grant(p_device text, p_amount int)
returns int language plpgsql security definer as $$
declare total int;
begin
  delete from public.coin_ledger where device = p_device and kind = 'dev';
  if p_amount > 0 then
    -- Одной строкой нельзя: amount ограничен тысячей, чтобы обычное начисление
    -- не могло выписать состояние. Тестовые монеты кладём пачками по 1000.
    insert into public.coin_ledger (device, kind, amount, ref, status, credit_after)
    select p_device, 'dev', least(1000, p_amount - (i - 1) * 1000),
           'dev-' || i, 'credited', now()
      from generate_series(1, ceil(p_amount / 1000.0)::int) i;
  end if;
  select coalesce(sum(amount), 0)::int into total
    from public.coin_ledger where device = p_device and status = 'credited';
  return total;
end; $$;
revoke execute on function public.dev_grant(text, int) from anon, public;
notify pgrst, 'reload schema';
