-- НищеMap 28: device перестаёт быть паролем.
--
-- Разбор правок нашёл дыру, которую я же и открыл, и она оказалась шире:
--   GET /rest/v1/views?select=device        -> чужие device (колонка добавлена в 24)
--   GET /rest/v1/submissions?select=device  -> чужие device (было и раньше:
--       колоночный revoke из 05_hardening не работает, пока у роли есть право
--       на таблицу целиком — Supabase выдаёт его по умолчанию)
-- А coin_stats и buy_avatar принимали device как предъявительский пропуск.
-- То есть любой мог прочитать чужой баланс и потратить чужие монеты на аватар,
-- который тот не выбирал. Проверено curl'ом, обе выдачи вернули живые строки.
--
-- Лечим корень: device остаётся публичным именем, а право действовать от его
-- имени даёт отдельный секрет, который живёт только в браузере владельца и
-- никуда, кроме этих двух вызовов, не уходит.

create table if not exists public.device_keys (
  device     text primary key,
  key_hash   text not null,
  created_at timestamptz not null default now()
);
alter table public.device_keys enable row level security;
revoke all on public.device_keys from anon, public;

-- Привязка при первом обращении: у кого ключ, тот и хозяин. Гонку «злоумышленник
-- успел раньше» закрывает то, что настоящий владелец обращается сюда при каждом
-- открытии мини-аппа, то есть практически сразу.
create or replace function public.device_ok(p_device text, p_key text) returns boolean
language plpgsql security definer as $$
declare h text;
begin
  if p_device is null or p_key is null or length(p_key) < 16 then return false; end if;
  select key_hash into h from public.device_keys where device = p_device;
  if h is null then
    insert into public.device_keys (device, key_hash) values (p_device, md5(p_key))
    on conflict (device) do nothing;
    select key_hash into h from public.device_keys where device = p_device;
  end if;
  return h = md5(p_key);
end; $$;
revoke execute on function public.device_ok(text, text) from anon, public;

-- Старые двухаргументные двери закрываем: пока они открыты, ключ обходится.
drop function if exists public.coin_stats(text);
drop function if exists public.coin_balance(text);
drop function if exists public.buy_avatar(text, text);

create or replace function public.coin_stats(p_device text, p_key text)
returns table (balance int, earned int, spent int, pending int,
               next_at timestamptz, items int, photos int, reports int, owned text[])
language plpgsql security definer as $$
declare e int; s int;
begin
  if not public.device_ok(p_device, p_key) then
    return query select 0, 0, 0, 0, null::timestamptz, 0, 0, 0, '{}'::text[]; return;
  end if;
  update public.coin_ledger set status = 'credited'
   where device = p_device and status = 'pending' and credit_after <= now();
  perform public.award_milestones(p_device);
  update public.coin_ledger set status = 'credited'
   where device = p_device and status = 'pending' and credit_after <= now();
  select coalesce(sum(amount), 0)::int into e
    from public.coin_ledger where device = p_device and status = 'credited';
  select coalesce(sum(price), 0)::int into s
    from public.purchases where device = p_device;
  return query
    select (e - s), e, s,
           coalesce((select sum(amount)::int from public.coin_ledger
                      where device = p_device and status = 'pending'), 0),
           (select min(credit_after) from public.coin_ledger
             where device = p_device and status = 'pending'),
           (select count(*)::int from public.coin_ledger
             where device = p_device and kind = 'item'   and status = 'credited'),
           (select count(*)::int from public.coin_ledger
             where device = p_device and kind = 'photo'  and status = 'credited'),
           (select count(*)::int from public.coin_ledger
             where device = p_device and kind = 'report' and status = 'credited'),
           coalesce((select array_agg(avatar_id) from public.purchases
                      where device = p_device), '{}'::text[]);
end; $$;
grant execute on function public.coin_stats(text, text) to anon;

create or replace function public.buy_avatar(p_device text, p_key text, p_avatar text)
returns table (ok boolean, balance int, reason text)
language plpgsql security definer as $$
declare p int; earned int; spent int;
begin
  perform pg_advisory_xact_lock(hashtext('nishemap.buy:' || coalesce(p_device, '')));
  if not public.device_ok(p_device, p_key) then
    return query select false, 0, 'Не твоё устройство'; return;
  end if;
  if not exists (select 1 from public.tg_devices where device = p_device) then
    return query select false, 0, 'Аватары живут в приложении Telegram'; return;
  end if;
  select price into p from public.avatar_prices where avatar_id = p_avatar;
  if p is null then return query select false, 0, 'нет такого аватара'; return; end if;

  update public.coin_ledger set status = 'credited'
   where device = p_device and status = 'pending' and credit_after <= now();
  select coalesce(sum(amount), 0)::int into earned
    from public.coin_ledger where device = p_device and status = 'credited';
  select coalesce(sum(price), 0)::int into spent
    from public.purchases where device = p_device;

  if exists (select 1 from public.purchases where device = p_device and avatar_id = p_avatar) then
    return query select true, earned - spent, 'уже куплен'; return;
  end if;
  if earned - spent < p then
    return query select false, earned - spent, 'не хватает монет'; return;
  end if;
  insert into public.purchases (device, avatar_id, price) values (p_device, p_avatar, p);
  return query select true, earned - spent - p, 'куплен';
end; $$;
grant execute on function public.buy_avatar(text, text, text) to anon;

-- ============ identity_of наружу не выдаётся ============
-- SECURITY DEFINER плюс право EXECUTE у PUBLIC по умолчанию = аноним отображал
-- любой device в номер телеграм-аккаунта, в обход revoke на самой tg_devices.
revoke execute on function public.identity_of(text) from anon, public;
revoke execute on function public.item_verified(text) from anon, public;

-- ============ views больше не хранит device в открытом виде ============
-- Счётчику нужен не сам ключ, а только «тот же или другой». Кладём отпечаток:
-- утечка отпечатка никому ничего не даёт.
create or replace function public.rl_views() returns trigger
language plpgsql security definer as $$
declare n int; g int;
begin
  if new.device is not null then
    new.device := md5(new.device);                  -- дальше по коду только отпечаток
    select count(*) into n from public.views
     where device = new.device and venue_key = new.venue_key
       and created_at > now() - interval '1 day';
    if n > 0 then return null; end if;
    select count(*) into n from public.views
     where device = new.device and created_at > now() - interval '1 hour';
    if n >= 120 then return null; end if;
  end if;
  select count(*) into g from public.views where created_at > now() - interval '1 minute';
  if g >= 600 then return null; end if;
  return new;
end; $$;
update public.views set device = md5(device)
 where device is not null and device !~ '^[0-9a-f]{32}$';

-- ============ фото должно лежать в нашем хранилище ============
-- Оплата шла за любую строку item_photos, а photo_url никто не проверял:
-- достаточно было прислать ссылку на чужой сайт. Файла при этом не существовало.
create or replace function public.item_verified(p_item text) returns boolean
language sql stable security definer as $$
  select exists (select 1 from public.item_photos
                  where item_id = p_item and status = 'live'
                    and photo_url like 'https://svfnjfpawljkdcehzkgv.supabase.co/storage/v1/object/public/menus/%')
      or (select count(distinct device) from public.confirms
           where item_id = p_item) >= 2;
$$;
revoke execute on function public.item_verified(text) from anon, public;

notify pgrst, 'reload schema';
