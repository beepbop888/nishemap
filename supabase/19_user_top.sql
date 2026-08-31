-- НищеMap 19: монеты с именами.
--
-- coin_top знал только device — случайную строку, по которой не понять, кто это.
-- Теперь есть tg_users, и device связывает личность с работой: ценами, фото,
-- жалобами и монетами. Владельцу — через сервисный ключ, анониму закрыто.
create or replace view public.user_top as
select coalesce(u.username, '') as username,
       u.first_name,
       u.tg_id,
       l.device,
       coalesce(sum(l.amount) filter (where l.status = 'credited'), 0)::int as coins,
       coalesce(sum(l.amount) filter (where l.status = 'pending'),  0)::int as pending,
       count(*) filter (where l.kind = 'item'   and l.status = 'credited')  as items,
       count(*) filter (where l.kind = 'photo'  and l.status = 'credited')  as photos,
       count(*) filter (where l.kind = 'report' and l.status = 'credited')  as reports,
       coalesce(sum(l.amount) filter (where l.status = 'void'), 0)::int     as burned,
       coalesce((select sum(p.price) from public.purchases p where p.device = l.device), 0) as spent,
       u.opens,
       u.last_seen
  from public.coin_ledger l
  left join public.tg_users u on u.device = l.device
 group by u.username, u.first_name, u.tg_id, l.device, u.opens, u.last_seen
 order by 5 desc;
revoke all on public.user_top from anon, public;
