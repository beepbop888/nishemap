-- НищеMap 34: кто жалуется и не пытается ли кто-то ломать карту.
--
-- До сих пор жалоба приходила без автора: владелец видел «пожаловались 3 раза»
-- и не знал, три это человека или один настойчивый. Здесь появляются два
-- взгляда: досье на жалобщика (его показываем прямо в карточке модерации) и
-- общий список подозрительного поведения.

-- ============ Досье жалобщика ============
create or replace view public.reporter_profile as
select r.device,
       coalesce('@' || u.username, u.first_name, 'без Telegram') as who,
       u.tg_id,
       count(*)                                                   as reports,
       count(*) filter (where o.disputed or o.hidden)             as upheld,
       count(*) filter (where o.item_id is not null
                          and not o.disputed and not o.hidden)    as rejected,
       count(distinct r.item_id)                                  as items,
       min(r.created_at)                                          as first_report,
       max(r.created_at)                                          as last_report
  from public.reports r
  left join public.tg_devices d on d.device = r.device
  left join public.tg_users   u on u.tg_id  = d.tg_id
  left join public.overrides  o on o.item_id = r.item_id and o.by_owner
 where r.device is not null
 group by r.device, u.username, u.first_name, u.tg_id;
revoke all on public.reporter_profile from anon, public;

-- Короткая справка одной строкой — её печатает воркер в карточке модерации.
create or replace function public.reporter_note(p_item text) returns text
language sql stable security definer as $$
  with last_one as (
    select device from public.reports
     where item_id = p_item and device is not null
     order by created_at desc limit 1
  )
  select coalesce(
    (select p.who || ' · жалоб: ' || p.reports ||
            ', поддержано: ' || p.upheld ||
            ', отклонено: ' || p.rejected ||
            case when p.reports >= 5 and p.upheld = 0 then ' ⚠️ ни одной по делу' else '' end
       from public.reporter_profile p join last_one l on l.device = p.device),
    'жалоба без устройства');
$$;
revoke execute on function public.reporter_note(text) from anon, public;

-- ============ Что похоже на вредительство ============
-- Ни один признак сам по себе не приговор, поэтому считаем их вместе и
-- показываем причины словами: решать всё равно человеку.
create or replace view public.abuse_watch as
with dev as (
  select d.device, d.tg_id, coalesce('@' || u.username, u.first_name, '—') as who,
         u.first_seen
    from public.tg_devices d
    left join public.tg_users u on u.tg_id = d.tg_id
  union
  select r.device, null::bigint, 'без Telegram', null::timestamptz
    from public.reports r
   where r.device is not null
     and not exists (select 1 from public.tg_devices t where t.device = r.device)
),
rep as (
  select device,
         count(*) n,
         count(*) filter (where exists (select 1 from public.overrides o
                                         where o.item_id = reports.item_id and o.by_owner
                                           and (o.disputed or o.hidden))) upheld,
         count(distinct item_id) items,
         count(*) filter (where created_at > now() - interval '1 day') today
    from public.reports where device is not null group by device
),
sub as (
  select device,
         count(*) n,
         count(*) filter (where status = 'hidden') hidden
    from public.submissions where device is not null group by device
),
conf as (
  select c.device, count(*) n, max(cnt) max_same_author
    from public.confirms c
    join lateral (
      select count(*) cnt from public.confirms c2
       join public.submissions s on 'ui-' || s.id::text = c2.item_id
      where c2.device = c.device
        and public.identity_of(s.device) = (
          select public.identity_of(s2.device) from public.submissions s2
           where 'ui-' || s2.id::text = c.item_id)
    ) q on true
   group by c.device
)
select dev.who, dev.device, dev.tg_id,
       coalesce(rep.n, 0)      as reports,
       coalesce(rep.upheld, 0) as upheld,
       coalesce(rep.today, 0)  as reports_today,
       coalesce(sub.n, 0)      as submissions,
       coalesce(sub.hidden, 0) as hidden_submissions,
       coalesce(conf.n, 0)     as confirms,
       coalesce(conf.max_same_author, 0) as confirms_to_one_author,
       trim(both ' ' from
         case when coalesce(rep.n,0) >= 5 and coalesce(rep.upheld,0) = 0
              then 'жалуется много, ни одной по делу; ' else '' end ||
         case when coalesce(rep.today,0) >= 10
              then 'всплеск жалоб за сутки; ' else '' end ||
         case when coalesce(sub.hidden,0) >= 3
              then 'скрытых точек три и больше; ' else '' end ||
         case when coalesce(conf.max_same_author,0) >= 4
              then 'подтверждает одного и того же человека; ' else '' end ||
         case when coalesce(rep.n,0) >= 3 and coalesce(rep.items,0) = 1
              then 'бьёт в одну позицию; ' else '' end
       ) as suspicion
  from dev
  left join rep  on rep.device  = dev.device
  left join sub  on sub.device  = dev.device
  left join conf on conf.device = dev.device;
revoke all on public.abuse_watch from anon, public;

notify pgrst, 'reload schema';
