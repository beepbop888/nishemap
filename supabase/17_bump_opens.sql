-- НищеMap 17: счётчик заходов в мини-апп.
-- Отдельной функцией, потому что upsert с merge-duplicates умеет только
-- перезаписывать колонки из тела запроса, а тут нужно «прибавить единицу».
create or replace function public.bump_opens(p_tg_id bigint)
returns void language sql security definer as $$
  update public.tg_users set opens = opens + 1, last_seen = now() where tg_id = p_tg_id;
$$;
revoke execute on function public.bump_opens(bigint) from anon, public;
-- Первый заход — это уже один заход: строка создаётся с нулём, а bump_opens
-- сразу делает единицу. С прежним default 1 первый визит считался за два.
alter table public.tg_users alter column opens set default 0;

notify pgrst, 'reload schema';
