-- НищеMap 10: защита подтверждений и фото от накрутки. Запустить в SQL Editor.

-- ============ 1. Кольца сговора ============
-- одно устройство не может подтверждать больше 5 позиций одного и того же автора.
-- Так «я подтверждаю тебе, ты мне» перестаёт масштабироваться.
create or replace function public.no_confirm_ring() returns trigger
language plpgsql security definer as $$
declare author text; n int;
begin
  select s.device into author from public.submissions s
   where 'ui-' || s.id::text = new.item_id;
  if author is null then return new; end if;          -- позиция не пользовательская (наши данные)
  select count(*) into n
    from public.confirms c
    join public.submissions s on 'ui-' || s.id::text = c.item_id
   where c.device = new.device and s.device = author;
  if n >= 5 then
    raise exception 'Слишком много подтверждений одному и тому же человеку.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;
drop trigger if exists no_confirm_ring_trg on public.confirms;
create trigger no_confirm_ring_trg before insert on public.confirms
  for each row execute function public.no_confirm_ring();

-- ============ 2. Фото: не больше одного на позицию в неделю и трёх всего ============
create or replace function public.photo_limits() returns trigger
language plpgsql security definer as $$
declare n int;
begin
  select count(*) into n from public.item_photos where item_id = new.item_id;
  if n >= 3 then
    raise exception 'У этой позиции уже достаточно фото.' using errcode = 'check_violation';
  end if;
  select count(*) into n from public.item_photos
   where item_id = new.item_id and submitted_at > now() - interval '7 days';
  if n >= 1 then
    raise exception 'Свежее фото этого меню уже есть. Приходи через неделю.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;
drop trigger if exists photo_limits_trg on public.item_photos;
create trigger photo_limits_trg before insert on public.item_photos
  for each row execute function public.photo_limits();
