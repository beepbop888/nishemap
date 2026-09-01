-- НищеMap 30: ключ устройства хранится под sha256, а не под md5.
--
-- Автоматический разбор безопасности справедливо указал на два слабых места
-- в свежем механизме ключей: генератор на клиенте и хеш на сервере. Ключ
-- теперь единственное, что отделяет чужого от твоих монет, — оба поправлены.
-- md5 для случайной 128-битной строки не взламывается перебором смысла, но
-- сравнивать хеши дёшево, а радужные таблицы существуют: sha256 стоит того же.
--
-- Таблица device_keys пуста (ключи ещё никто не завёл), поэтому переносить
-- нечего — просто меняем функцию.
create or replace function public.device_ok(p_device text, p_key text) returns boolean
language plpgsql security definer as $$
declare h text; is_tg boolean; want text;
begin
  if p_device is null or p_key is null or length(p_key) < 16 then return false; end if;
  want := encode(extensions.digest(p_key, 'sha256'), 'hex');
  select key_hash into h from public.device_keys where device = p_device;
  if h is not null then return h = want; end if;

  select exists (select 1 from public.tg_devices where device = p_device) into is_tg;
  if is_tg then
    -- Ключа ещё нет, но за устройством стоит подтверждённая личность. Завести
    -- его «по факту обращения» нельзя: именно так чужой и становился хозяином.
    return false;
  end if;
  insert into public.device_keys (device, key_hash) values (p_device, want)
  on conflict (device) do nothing;
  select key_hash into h from public.device_keys where device = p_device;
  return h = want;
end; $$;
revoke execute on function public.device_ok(text, text) from anon, public;

create or replace function public.bind_device_key(p_device text, p_key text) returns boolean
language plpgsql security definer as $$
declare want text;
begin
  if p_device is null or p_key is null or length(p_key) < 16 then return false; end if;
  want := encode(extensions.digest(p_key, 'sha256'), 'hex');
  insert into public.device_keys (device, key_hash) values (p_device, want)
  on conflict (device) do nothing;
  return exists (select 1 from public.device_keys
                  where device = p_device and key_hash = want);
end; $$;
revoke execute on function public.bind_device_key(text, text) from anon, public;

notify pgrst, 'reload schema';
