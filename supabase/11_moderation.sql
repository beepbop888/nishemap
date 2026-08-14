-- НищеMap 11: жалобы доходят до владельца, автоскрытие мусора, лидерборд.

-- 1) счётчик жалоб на позицию + автоскрытие пользовательских точек с 3 жалобами
create or replace function public.apply_report() returns trigger
language plpgsql security definer as $$
declare n int; sid uuid;
begin
  select count(distinct reason) into n from public.reports where item_id = new.item_id;
  if new.item_id like 'ui-%' then
    begin sid := substring(new.item_id from 4)::uuid; exception when others then return new; end;
    select count(*) into n from public.reports where item_id = new.item_id;
    if n >= 3 then
      update public.submissions set status = 'hidden' where id = sid;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists apply_report_trg on public.reports;
create trigger apply_report_trg after insert on public.reports
  for each row execute function public.apply_report();

-- 2) очередь на разбор владельцу: что пожаловались, сколько раз, что за позиция
create or replace view public.moderation_queue as
select r.item_id,
       count(*)                        as reports,
       max(r.created_at)               as last_report,
       s.dish, s.price, s.venue, s.address, s.status
  from public.reports r
  left join public.submissions s on 'ui-' || s.id::text = r.item_id
 group by r.item_id, s.dish, s.price, s.venue, s.address, s.status
 order by count(*) desc, max(r.created_at) desc;

-- 3) таблица лидеров: считаем на сервере, врать нельзя
create or replace view public.leaderboard as
with mine as (
  select s.device,
         count(*) filter (where s.status = 'live')                       as items,
         count(distinct (lower(s.venue) || '|' || lower(s.address)))     as venues,
         min(s.submitted_at)                                             as first_seen,
         max(s.submitted_at)                                             as last_seen
    from public.submissions s
   where s.device is not null
   group by s.device
)
select device,
       items, venues, first_seen, last_seen,
       (items + venues * 2) as score          -- та же логика, что в приложении: позиции + новые места
  from mine
 order by score desc
 limit 100;

grant select on public.moderation_queue to anon;   -- владелец смотрит через дашборд; аноним видит только агрегат
grant select on public.leaderboard to anon;
