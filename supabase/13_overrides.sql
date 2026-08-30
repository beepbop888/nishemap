-- НищеMap 13: серая монета и модерация из Telegram.
--
-- Зачем таблица, а не колонка в submissions: точки бывают двух пород — из
-- data/seed.json (лежат в репозитории, id вида i101) и присланные людьми
-- (id вида ui-<uuid>). Решение владельца должно накрывать обе, поэтому
-- отдельная таблица с ключом item_id.

create table if not exists public.overrides (
  item_id    text primary key,
  disputed   boolean not null default false,  -- серая монета: цене не верим, ждём настоящую
  hidden     boolean not null default false,  -- убрать из выдачи совсем
  note       text,
  updated_at timestamptz not null default now()
);
alter table public.overrides enable row level security;
drop policy if exists "anon read overrides" on public.overrides;
create policy "anon read overrides" on public.overrides for select to anon using (true);
-- политики на запись нет намеренно: пишет только воркер под service_role

-- Три жалобы больше не прячут точку молча. Молчаливое скрытие — подарок
-- троллю: три клика и место исчезло. Теперь монета сереет (цена под вопросом,
-- любой может прислать настоящую), а убрать может только человек.
create or replace function public.apply_report() returns trigger
language plpgsql security definer as $$
declare n int;
begin
  select count(*) into n from public.reports where item_id = new.item_id;
  if n >= 3 then
    insert into public.overrides (item_id, disputed, note)
         values (new.item_id, true, 'авто: 3 жалобы')
    on conflict (item_id) do update
       set disputed = true, updated_at = now()
     where public.overrides.hidden = false;   -- уже убранное не воскрешаем
  end if;
  return new;
end; $$;
drop trigger if exists apply_report_trg on public.reports;
create trigger apply_report_trg after insert on public.reports
  for each row execute function public.apply_report();

-- Очередь владельцу: та же, но со статусом решения
create or replace view public.moderation_queue as
select r.item_id,
       count(*)          as reports,
       max(r.created_at) as last_report,
       s.dish, s.price, s.venue, s.address, s.status,
       coalesce(o.disputed, false) as disputed,
       coalesce(o.hidden,   false) as hidden
  from public.reports r
  left join public.submissions s on 'ui-' || s.id::text = r.item_id
  left join public.overrides  o on o.item_id = r.item_id
 group by r.item_id, s.dish, s.price, s.venue, s.address, s.status, o.disputed, o.hidden
 order by count(*) desc, max(r.created_at) desc;
