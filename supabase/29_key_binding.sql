-- НищеMap 29: ключ устройства выдаётся под подпись, а не первому спросившему.
--
-- 28 привязывал ключ по принципу «кто первый пришёл». Проверка тут же показала,
-- чего это стоит: чужой назвал device владельца со своим ключом, стал его
-- «хозяином», прочитал баланс и купил «Золотого» за 1650 чужих монет.
--
-- Правило теперь такое: у устройства, привязанного к телеграм-аккаунту, ключ
-- может завести только воркер — он один проверяет подпись initData. Всем
-- остальным устройствам ключ по-прежнему не нужен: монет у них нет.
create or replace function public.device_ok(p_device text, p_key text) returns boolean
language plpgsql security definer as $$
declare h text; is_tg boolean;
begin
  if p_device is null or p_key is null or length(p_key) < 16 then return false; end if;
  select key_hash into h from public.device_keys where device = p_device;
  if h is not null then return h = md5(p_key); end if;

  select exists (select 1 from public.tg_devices where device = p_device) into is_tg;
  if is_tg then
    -- Ключа ещё нет, но устройство принадлежит человеку с подтверждённой
    -- личностью. Заводить ключ «по факту обращения» здесь нельзя: именно так
    -- чужой и становился хозяином. Ждём воркера.
    return false;
  end if;
  insert into public.device_keys (device, key_hash) values (p_device, md5(p_key))
  on conflict (device) do nothing;
  select key_hash into h from public.device_keys where device = p_device;
  return h = md5(p_key);
end; $$;
revoke execute on function public.device_ok(text, text) from anon, public;

-- Дверь для воркера: он уже проверил подпись, значит вправе назвать ключ.
-- Перепривязать чужой ключ нельзя — только завести отсутствующий.
create or replace function public.bind_device_key(p_device text, p_key text) returns boolean
language plpgsql security definer as $$
begin
  if p_device is null or p_key is null or length(p_key) < 16 then return false; end if;
  insert into public.device_keys (device, key_hash) values (p_device, md5(p_key))
  on conflict (device) do nothing;
  return exists (select 1 from public.device_keys
                  where device = p_device and key_hash = md5(p_key));
end; $$;
revoke execute on function public.bind_device_key(text, text) from anon, public;

notify pgrst, 'reload schema';
