-- НищеMap 37: темп полевой прогулки.
--
-- rl_submissions пускал 5 точек за 2 минуты. Для случайного посетителя это с
-- запасом, а для того, кто обходит район по SEEDING.md, — стена: пять блюд в
-- одном заведении укладываются в минуту, и следующее кафе встречает отказом.
--
-- Поднимаем предел тем, у кого есть подтверждённая личность Telegram: завести
-- такую ради потопа дороже, чем он стоит. Остальным — как было.
create or replace function public.rl_submissions() returns trigger
language plpgsql security definer as $$
declare n int; g int; lim int;
begin
  if new.device is null or length(new.device) < 6 then
    raise exception 'Нет идентификатора устройства.' using errcode = 'check_violation';
  end if;
  lim := case when exists (select 1 from public.tg_devices where device = new.device)
              then 12 else 5 end;
  select count(*) into n from public.submissions
   where device = new.device and submitted_at > now() - interval '2 minutes';
  if n >= lim then
    raise exception 'Слишком много точек подряд. Подожди пару минут.' using errcode = 'check_violation';
  end if;
  -- общий потолок: даже если менять device на каждый запрос, потоп не пройдёт
  select count(*) into g from public.submissions where submitted_at > now() - interval '1 minute';
  if g >= 40 then
    raise exception 'Карта сейчас перегружена, попробуй через минуту.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;

-- Свои же цены за прогулку человек сдаёт десятками — потолок в 20 монет за
-- позиции в сутки при этом остаётся: карта важнее монет, и это нормально.
notify pgrst, 'reload schema';
