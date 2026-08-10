-- НищеMap: добавка к schema.sql. Запустить один раз в SQL Editor.

-- 1) жалобы на позиции («неверно» в шторке)
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  item_id text not null,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
drop policy if exists "anon insert reports" on public.reports;
create policy "anon insert reports" on public.reports for insert to anon with check (true);

-- 2) разрешить анониму заливать фото в bucket 'menus'
--    (bucket создать в Storage → New bucket → menus → Public)
drop policy if exists "anon upload menus" on storage.objects;
create policy "anon upload menus" on storage.objects
  for insert to anon with check (bucket_id = 'menus');
drop policy if exists "public read menus" on storage.objects;
create policy "public read menus" on storage.objects
  for select to anon using (bucket_id = 'menus');
