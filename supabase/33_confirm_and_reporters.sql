-- НищеMap 33: подтверждают только люди из Telegram, и за одну позицию платят один раз.

-- ============ 1. Подтверждение — только с подтверждённой личностью ============
-- 32 уже перестал ЗАСЧИТЫВАТЬ подтверждения от непривязанных устройств, но сама
-- строка всё равно ложилась в базу: человек жал кнопку, видел «спасибо» и не
-- понимал, почему ничего не изменилось. Отказываем сразу и словами.
create or replace function public.rl_confirms() returns trigger
language plpgsql security definer as $$
declare n int; g int;
begin
  if new.device is null or length(new.device) < 6 then
    raise exception 'Нет идентификатора устройства.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.tg_devices where device = new.device) then
    raise exception 'Подтверждать цены можно из приложения Telegram.'
      using errcode = 'check_violation';
  end if;
  select count(*) into n from public.confirms
   where device = new.device and created_at > now() - interval '1 minute';
  if n >= 10 then
    raise exception 'Слишком много подтверждений подряд.' using errcode = 'check_violation';
  end if;
  select count(*) into g from public.confirms where created_at > now() - interval '1 minute';
  if g >= 120 then
    raise exception 'rate limit' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.submissions s
              where new.item_id = 'ui-' || s.id::text
                and public.identity_of(s.device) = public.identity_of(new.device)) then
    raise exception 'Свою же цену подтверждать нельзя.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.confirms c
              where c.item_id = new.item_id
                and public.identity_of(c.device) = public.identity_of(new.device)) then
    return null;
  end if;
  return new;
end; $$;

-- ============ 2. За жалобу платим тому, кто заметил ПЕРВЫМ ============
-- Было: владелец жмёт ⚪ — и монету получает каждый пожаловавшийся. Десять
-- сговорившихся аккаунтов жалуются на одну позицию и получают десять монет за
-- одно нажатие. Заметил проблему первый; остальные присоединились к известному.
--
-- Заодно это ставит потолок на всю позицию: 1 (цена) + 2 (первая в заведении)
-- + 1 (жалоба) = не больше четырёх монет, сколько бы людей вокруг ни ходило.
create or replace function public.pay_reporters() returns trigger
language plpgsql security definer as $$
declare d text;
begin
  if new.disputed and new.by_owner then
    select device into d from public.reports
     where item_id = new.item_id and device is not null
     order by created_at asc limit 1;
    if d is not null then
      perform public.award_coins(d, 'report', 1, new.item_id, false);
    end if;
  end if;
  return new;
end; $$;

notify pgrst, 'reload schema';
