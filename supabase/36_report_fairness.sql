-- НищеMap 36: честные цифры в досье и один повод — одна монета.

-- ============ 1. Досье считало жалобы, а не позиции ============
-- У владельца выходило «жалоб 4, поддержано 3», хотя монет он получил две:
-- на позицию i115 он пожаловался дважды (до того, как появился запрет), и обе
-- строки посчитались поддержанными. Считаем ПОЗИЦИИ — их и оплачивают.
drop view if exists public.reporter_profile;
create view public.reporter_profile as
select r.device,
       coalesce('@' || u.username, u.first_name, 'без Telegram') as who,
       u.tg_id,
       count(distinct r.item_id)                                  as reports,
       count(distinct r.item_id) filter (where o.disputed or o.hidden) as upheld,
       count(distinct r.item_id) filter (where o.item_id is not null
                          and not o.disputed and not o.hidden)    as rejected,
       count(distinct r.item_id) filter (where o.item_id is null)  as pending,
       min(r.created_at)                                          as first_report,
       max(r.created_at)                                          as last_report
  from public.reports r
  left join public.tg_devices d on d.device = r.device
  left join public.tg_users   u on u.tg_id  = d.tg_id
  left join public.overrides  o on o.item_id = r.item_id and o.by_owner
 where r.device is not null
 group by r.device, u.username, u.first_name, u.tg_id;
revoke all on public.reporter_profile from anon, public;

create or replace function public.reporter_note(p_item text) returns text
language sql stable security definer as $$
  with last_one as (
    select device from public.reports
     where item_id = p_item and device is not null
     order by created_at desc limit 1
  )
  select coalesce(
    (select p.who || ' · позиций: ' || p.reports ||
            ', поддержано: ' || p.upheld ||
            ', отклонено: ' || p.rejected ||
            case when p.reports >= 5 and p.upheld = 0 then ' ⚠️ ни одной по делу' else '' end
       from public.reporter_profile p join last_one l on l.device = p.device),
    'жалоба без устройства');
$$;
revoke execute on function public.reporter_note(text) from anon, public;

-- ============ 2. Повтор — по человеку, а не по устройству ============
-- Запрет «одна жалоба на позицию» стоял на device: два браузера одного человека
-- обходили его и раздували счётчик «пожаловались: N», по которому владелец
-- судит, серьёзно ли дело.
create or replace function public.rl_reports() returns trigger
language plpgsql security definer as $$
declare n int; g int;
begin
  if new.device is null or length(new.device) < 6 then
    raise exception 'Нет идентификатора устройства.' using errcode = 'check_violation';
  end if;
  select count(*) into n from public.reports r
   where public.identity_of(r.device) = public.identity_of(new.device)
     and r.created_at > now() - interval '1 day';
  if n >= 20 then
    raise exception 'Слишком много жалоб за сутки.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.reports r
              where r.item_id = new.item_id
                and public.identity_of(r.device) = public.identity_of(new.device)) then
    return null;                       -- тихо: человеку уже сказали «спасибо»
  end if;
  select count(*) into g from public.reports where created_at > now() - interval '1 minute';
  if g >= 30 then
    raise exception 'Слишком много жалоб сразу.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;

-- ============ 3. Потолок на монеты за жалобы ============
-- «Одна монета за позицию» уже держится ключом (device, kind, ref) и выплатой
-- только первому. Осталась дырка размером в меню: пожалуйся на все пять блюд
-- одного заведения — получишь пять монет. Ставим два предела: три монеты за
-- жалобы в сутки на человека и одна за заведение в неделю.
create or replace function public.pay_reporters() returns trigger
language plpgsql security definer as $$
declare d text; ident text; venue_key text; n int;
begin
  if not (new.disputed and new.by_owner) then return new; end if;

  select device into d from public.reports
   where item_id = new.item_id and device is not null
   order by created_at asc limit 1;
  if d is null then return new; end if;
  ident := public.identity_of(d);

  -- три в сутки на человека, а не на устройство
  select count(*) into n from public.coin_ledger l
   where l.kind = 'report' and l.status <> 'void'
     and public.identity_of(l.device) = ident
     and l.created_at > now() - interval '1 day';
  if n >= 3 then return new; end if;

  -- одно заведение — одна монета в неделю (там, где заведение вообще известно)
  select lower(s.venue) || '|' || lower(s.address) into venue_key
    from public.submissions s where 'ui-' || s.id::text = new.item_id;
  if venue_key is not null then
    select count(*) into n from public.coin_ledger l
      join public.submissions s2 on 'ui-' || s2.id::text = l.ref
     where l.kind = 'report' and l.status <> 'void'
       and public.identity_of(l.device) = ident
       and lower(s2.venue) || '|' || lower(s2.address) = venue_key
       and l.created_at > now() - interval '7 days';
    if n >= 1 then return new; end if;
  end if;

  perform public.award_coins(d, 'report', 1, new.item_id, false);
  return new;
end; $$;

notify pgrst, 'reload schema';
