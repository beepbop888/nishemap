-- НищеMap: народные подтверждения цен. Запустить один раз в SQL Editor.
create table if not exists public.confirms (
  id uuid primary key default gen_random_uuid(),
  item_id text not null,
  device text not null,          -- случайный id устройства (не персональные данные)
  created_at timestamptz not null default now(),
  unique (item_id, device)       -- одно устройство = один голос за позицию
);
alter table public.confirms enable row level security;
drop policy if exists "anon insert confirms" on public.confirms;
create policy "anon insert confirms" on public.confirms for insert to anon with check (true);
drop policy if exists "anon read confirms" on public.confirms;
create policy "anon read confirms" on public.confirms for select to anon using (true);
