-- НищеMap 18: под ценой стоит только тот аватар, который куплен.
--
-- 16 закрыл покупку, но подпись под работой (submissions.avatar) клиент всё
-- ещё присылал сам — то есть надеть «Олигарха», не покупая его, мешало только
-- приличие. А эту подпись видят все, кто открыл карточку.
--
-- Не отклоняем, а стираем: цена полезна, даже если человек соврал про аватар.
create or replace function public.check_avatar_owned() returns trigger
language plpgsql security definer as $$
declare p int;
begin
  if new.avatar is null or new.avatar = '' then return new; end if;
  select price into p from public.avatar_prices where avatar_id = new.avatar;
  if p is null then new.avatar := null; return new; end if;     -- нет такого аватара
  if p = 0 then return new; end if;                             -- бесплатный, покупать нечего
  if not exists (select 1 from public.purchases
                  where device = new.device and avatar_id = new.avatar) then
    new.avatar := null;
  end if;
  return new;
end; $$;
drop trigger if exists check_avatar_owned_trg on public.submissions;
create trigger check_avatar_owned_trg before insert or update on public.submissions
  for each row execute function public.check_avatar_owned();
