-- НищеMap 35: наблюдение считает людей, а не устройства.
--
-- abuse_watch группировался по device, и человек с телефоном и ноутбуком шёл
-- двумя строками — ровно та ошибка, которую в таблице лидеров уже исправляли.
-- Для поиска накрутки это хуже вдвойне: сговор — это как раз про то, сколько
-- устройств у одного человека, и разносить их по строкам значит его прятать.
drop view if exists public.abuse_watch;
create view public.abuse_watch as
with dev as (
  select d.device, coalesce('tg:' || d.tg_id::text, 'dev:' || d.device) as who_key,
         d.tg_id
    from public.tg_devices d
  union
  select x.device, 'dev:' || x.device, null::bigint from (
    select device from public.reports    where device is not null
    union select device from public.submissions where device is not null
    union select device from public.confirms    where device is not null
  ) x
   where not exists (select 1 from public.tg_devices t where t.device = x.device)
),
ident as (
  select who_key, max(tg_id) as tg_id, count(*) as devices,
         array_agg(device) as devs
    from dev group by who_key
),
rep as (
  select d.who_key,
         count(*) n,
         count(*) filter (where exists (select 1 from public.overrides o
                                         where o.item_id = r.item_id and o.by_owner
                                           and (o.disputed or o.hidden))) upheld,
         count(distinct r.item_id) items,
         count(*) filter (where r.created_at > now() - interval '1 day') today
    from public.reports r join dev d on d.device = r.device
   group by d.who_key
),
sub as (
  select d.who_key, count(*) n, count(*) filter (where s.status = 'hidden') hidden
    from public.submissions s join dev d on d.device = s.device
   group by d.who_key
),
conf as (
  select d.who_key, count(*) n from public.confirms c join dev d on d.device = c.device
   group by d.who_key
)
select coalesce('@' || u.username, u.first_name, 'без Telegram') as who,
       i.who_key, i.tg_id, i.devices, i.devs,
       coalesce(rep.n, 0) as reports, coalesce(rep.upheld, 0) as upheld,
       coalesce(rep.today, 0) as reports_today,
       coalesce(sub.n, 0) as submissions, coalesce(sub.hidden, 0) as hidden_submissions,
       coalesce(conf.n, 0) as confirms,
       trim(both ' ' from
         case when coalesce(rep.n,0) >= 5 and coalesce(rep.upheld,0) = 0
              then 'жалуется много, ни одной по делу; ' else '' end ||
         case when coalesce(rep.today,0) >= 10
              then 'всплеск жалоб за сутки; ' else '' end ||
         case when coalesce(sub.hidden,0) >= 3
              then 'скрытых точек три и больше; ' else '' end ||
         case when coalesce(rep.n,0) >= 3 and coalesce(rep.items,0) = 1
              then 'бьёт в одну позицию; ' else '' end ||
         -- Много устройств у одного аккаунта — само по себе нормально (телефон
         -- и ноутбук), но вместе с потоком подтверждений это уже похоже на
         -- попытку изобразить толпу.
         case when i.devices >= 4 and coalesce(conf.n,0) >= 10
              then 'много устройств и много подтверждений; ' else '' end
       ) as suspicion
  from ident i
  left join public.tg_users u on u.tg_id = i.tg_id
  left join rep  on rep.who_key  = i.who_key
  left join sub  on sub.who_key  = i.who_key
  left join conf on conf.who_key = i.who_key;
revoke all on public.abuse_watch from anon, public;

notify pgrst, 'reload schema';
