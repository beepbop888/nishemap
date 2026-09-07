-- НищеMap 38: личность больше не зависит от localStorage.
--
-- Найдено на живом человеке: в webview Telegram localStorage не переживает
-- открытие приложения (а иногда и одну загрузку страницы). deviceId() при
-- каждом вызове заводил НОВОЕ устройство — семь личностей за четыре минуты.
-- Отсюда все три жалобы разом: «монеты пропали», «аватары пропали», «/coins
-- ничего не добавил». Монеты никуда не девались — они лежали на устройствах,
-- которыми телефон больше не пользуется.
--
-- Лечим корень: у человека из Telegram device теперь выводится из его tg_id
-- ('tg<id>'), а секрет — из ключа бота. И то и другое воркер отдаёт при каждом
-- открытии, хранить нечего и терять нечего.

-- ============ Сводим прошлое на канонический device ============
-- Монеты и покупки, разбросанные по временным устройствам, собираем на 'tg<id>'.
do $$
declare r record; canon text;
begin
  for r in select distinct tg_id from public.tg_devices where tg_id is not null loop
    canon := 'tg' || r.tg_id::text;

    insert into public.tg_devices (device, tg_id) values (canon, r.tg_id)
    on conflict (device) do nothing;

    -- Служебные и компенсирующие строки нумерованы одинаково на каждом
    -- устройстве, поэтому при слиянии их ref надо развести.
    update public.coin_ledger l
       set device = canon, ref = l.ref || ':' || substr(md5(l.device), 1, 6)
      from public.tg_devices d
     where d.device = l.device and d.tg_id = r.tg_id and l.device <> canon
       and l.kind in ('dev', 'writeoff');

    update public.coin_ledger l
       set device = canon
      from public.tg_devices d
     where d.device = l.device and d.tg_id = r.tg_id and l.device <> canon
       and l.kind not in ('dev', 'writeoff')
       and not exists (select 1 from public.coin_ledger x
                        where x.device = canon and x.kind = l.kind and x.ref = l.ref);
    delete from public.coin_ledger l using public.tg_devices d
     where d.device = l.device and d.tg_id = r.tg_id and l.device <> canon;

    insert into public.purchases (device, avatar_id, price, created_at)
    select canon, p.avatar_id, p.price, p.created_at
      from public.purchases p join public.tg_devices d on d.device = p.device
     where d.tg_id = r.tg_id and p.device <> canon
    on conflict (device, avatar_id) do nothing;
    delete from public.purchases p using public.tg_devices d
     where d.device = p.device and d.tg_id = r.tg_id and p.device <> canon;

    -- Работа человека тоже должна остаться его: иначе прошлые цены перестанут
    -- считаться своими и «свою цену подтверждать нельзя» перестанет работать.
    update public.submissions s set device = canon
      from public.tg_devices d where d.device = s.device and d.tg_id = r.tg_id;
    update public.confirms c set device = canon
      from public.tg_devices d where d.device = c.device and d.tg_id = r.tg_id
       and not exists (select 1 from public.confirms x
                        where x.item_id = c.item_id and x.device = canon);
    delete from public.confirms c using public.tg_devices d
     where d.device = c.device and d.tg_id = r.tg_id and c.device <> canon;
    update public.reports rp set device = canon
      from public.tg_devices d where d.device = rp.device and d.tg_id = r.tg_id;

    -- Временные устройства больше не нужны: они и были болезнью.
    delete from public.tg_devices where tg_id = r.tg_id and device <> canon;
    delete from public.device_keys where device not in (select device from public.tg_devices);
  end loop;
end $$;

notify pgrst, 'reload schema';
