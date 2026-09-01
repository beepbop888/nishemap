-- НищеMap 32: хвост второго разбора.

-- ============ 1. Подтверждать цены может только подтверждённый человек ============
-- identity_of выдаёт непривязанному браузеру личность вида 'dev:<строка>', то
-- есть две очищенные вкладки — «два разных человека», и своя же цена
-- подтверждается сама. Раз монеты и так только у Telegram-устройств, пусть и
-- подтверждение считается только от них.
create or replace function public.item_verified(p_item text) returns boolean
language sql stable security definer as $$
  select exists (select 1 from public.item_photos
                  where item_id = p_item and status = 'live'
                    and photo_url like 'https://svfnjfpawljkdcehzkgv.supabase.co/storage/v1/object/public/menus/%')
      or (select count(distinct public.identity_of(c.device))
            from public.confirms c
            join public.tg_devices d on d.device = c.device
           where c.item_id = p_item) >= 2;
$$;
revoke execute on function public.item_verified(text) from anon, public;

-- ============ 2. Гашение разбирает долг КАЖДОГО, а не первого попавшегося ============
-- За одну позицию монеты получают и автор, и все, чью жалобу владелец поддержал.
-- settle_debt звался для одного устройства (limit 1) — остальные оставались в минусе.
create or replace function public.void_coins_on_override() returns trigger
language plpgsql security definer as $$
declare d text; devs text[];
begin
  if new.hidden then
    select array_agg(distinct device) into devs from public.coin_ledger
     where ref in (new.item_id, 'v:' || new.item_id) and status <> 'void';
    update public.coin_ledger set status = 'void'
     where ref in (new.item_id, 'v:' || new.item_id) and status <> 'void';
    if devs is not null then
      foreach d in array devs loop perform public.settle_debt(d); end loop;
    end if;
  end if;
  return new;
end; $$;

create or replace function public.void_coins_on_hide() returns trigger
language plpgsql security definer as $$
declare d text; devs text[]; it text;
begin
  if new.status = 'hidden' and old.status <> 'hidden' then
    it := 'ui-' || new.id::text;
    select array_agg(distinct device) into devs from public.coin_ledger
     where ref in (it, 'v:' || it) and status <> 'void';
    update public.coin_ledger set status = 'void'
     where ref in (it, 'v:' || it) and status <> 'void';
    if devs is not null then
      foreach d in array devs loop perform public.settle_debt(d); end loop;
    end if;
  end if;
  return new;
end; $$;

-- ============ 3. Списание не должно проглатываться уникальным ключом ============
-- ref собирался из секунд: второе гашение в ту же секунду попадало в
-- on conflict do nothing, компенсация не появлялась, баланс оставался в минусе.
create or replace function public.settle_debt(p_device text) returns void
language plpgsql security definer as $$
declare earned int; spent int; gap int; i int; stamp text;
begin
  select coalesce(sum(amount), 0)::int into earned
    from public.coin_ledger where device = p_device and status = 'credited';
  select coalesce(sum(price), 0)::int into spent
    from public.purchases where device = p_device;
  gap := spent - earned;
  if gap <= 0 then return; end if;
  stamp := replace(gen_random_uuid()::text, '-', '');
  for i in 1..ceil(gap / 1000.0)::int loop
    insert into public.coin_ledger (device, kind, amount, ref, status, credit_after)
    values (p_device, 'writeoff', least(1000, gap - (i - 1) * 1000),
            'wo-' || stamp || '-' || i, 'credited', now());
  end loop;
end; $$;
revoke execute on function public.settle_debt(text) from anon, public;

-- ============ 4. Жалоба без устройства обходила оба лимита ============
create or replace function public.rl_reports() returns trigger
language plpgsql security definer as $$
declare n int; g int;
begin
  -- Раньше все проверки стояли под «if new.device is not null»: пропусти поле —
  -- и жалуйся сколько хочешь, хоть тысячу раз на одну позицию.
  if new.device is null or length(new.device) < 6 then
    raise exception 'Нет идентификатора устройства.' using errcode = 'check_violation';
  end if;
  select count(*) into n from public.reports
   where device = new.device and created_at > now() - interval '1 day';
  if n >= 20 then
    raise exception 'Слишком много жалоб за сутки.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.reports
              where item_id = new.item_id and device = new.device) then
    return null;
  end if;
  select count(*) into g from public.reports where created_at > now() - interval '1 minute';
  if g >= 30 then
    raise exception 'Слишком много жалоб сразу.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;

-- ============ 5. Таблица лидеров считает людей ============
drop view if exists public.user_top;
create view public.user_top as
with ident as (
  select l.device,
         coalesce('tg:' || d.tg_id::text, 'dev:' || l.device) as who,
         d.tg_id
    from public.coin_ledger l
    left join public.tg_devices d on d.device = l.device
   group by l.device, d.tg_id
)
select coalesce(max(u.username), '')  as username,
       max(u.first_name)              as first_name,
       max(i.tg_id)                   as tg_id,
       i.who,
       coalesce(sum(l.amount) filter (where l.status = 'credited'), 0)::int as coins,
       coalesce(sum(l.amount) filter (where l.status = 'pending'),  0)::int as pending,
       count(*) filter (where l.kind = 'item'   and l.status = 'credited')  as items,
       count(*) filter (where l.kind = 'photo'  and l.status = 'credited')  as photos,
       count(*) filter (where l.kind = 'report' and l.status = 'credited')  as reports,
       coalesce(sum(l.amount) filter (where l.status = 'void'), 0)::int     as burned,
       coalesce((select sum(p.price) from public.purchases p
                  join ident i2 on i2.device = p.device
                 where i2.who = i.who), 0)                                  as spent,
       max(u.opens)     as opens,
       max(u.last_seen) as last_seen
  from public.coin_ledger l
  join ident i on i.device = l.device
  left join public.tg_users u on u.tg_id = i.tg_id
 group by i.who
 order by 5 desc;
revoke all on public.user_top from anon, public;

notify pgrst, 'reload schema';
