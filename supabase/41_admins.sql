-- Админы и автопроверка их цен.
--
-- Владелец по-прежнему живёт секретом воркера OWNER_CHAT_ID. Остальные админы —
-- строками этой таблицы: воркер читает её на каждый запрос, поэтому снять или
-- добавить человека можно одним insert/delete, без деплоя.
--
-- auto_verify: цена, которую прислал такой человек, сразу считается проверенной.
-- Подписи «device = tg<id>» для этого мало: submissions принимает от анонима
-- любую строку device, и назвался бы админом кто угодно. Поэтому вместе с
-- позицией приходит секрет устройства (dkey), триггер сверяет его хеш с
-- device_keys и стирает до записи — в таблице секрет не остаётся.

create table if not exists public.admins (
  tg_id       bigint primary key,
  note        text,
  auto_verify boolean not null default true,
  added_at    timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

alter table public.submissions add column if not exists verified_at timestamptz;
alter table public.submissions add column if not exists dkey text;

create or replace function public.admin_autoverify() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  -- verified_at из тела запроса не принимаем никогда: аноним мог бы прислать его сам.
  new.verified_at := null;
  if new.dkey is not null and new.device is not null and exists (
       select 1
         from public.device_keys k
         join public.tg_devices d on d.device = k.device
         join public.admins a     on a.tg_id = d.tg_id and a.auto_verify
        where k.device = new.device
          and k.key_hash = encode(extensions.digest(new.dkey, 'sha256'), 'hex'))
  then
    new.verified_at := now();
  end if;
  new.dkey := null;
  return new;
end $$;
revoke execute on function public.admin_autoverify() from anon, authenticated, public;

drop trigger if exists admin_autoverify_trg on public.submissions;
create trigger admin_autoverify_trg before insert on public.submissions
  for each row execute function public.admin_autoverify();

insert into public.admins (tg_id, note) values (768092193, '@shar_ondan')
  on conflict (tg_id) do nothing;
