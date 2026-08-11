-- НищеMap: вехи, антиспам и еженедельная рассылка. Запустить один раз в SQL Editor.

-- 1) кто отправил позицию (для защиты от «сам сдал — сам подтвердил»)
alter table public.submissions add column if not exists device text;

-- 2) просмотры карточек — из них считаем «топ-5 мест недели»
create table if not exists public.views (
  id bigserial primary key,
  venue_key text not null,          -- название|адрес в нижнем регистре
  venue_name text,
  created_at timestamptz not null default now()
);
alter table public.views enable row level security;
drop policy if exists "anon insert views" on public.views;
create policy "anon insert views" on public.views for insert to anon with check (true);
drop policy if exists "anon read views" on public.views;
create policy "anon read views" on public.views for select to anon using (true);
create index if not exists views_time_idx on public.views (created_at desc);

-- 3) подписчики телеграм-бота (кто нажал Start) — для пятничной рассылки
create table if not exists public.subscribers (
  chat_id bigint primary key,
  first_name text,
  joined_at timestamptz not null default now(),
  active boolean not null default true
);
alter table public.subscribers enable row level security;
-- пишет только бот (через service_role в GitHub Actions), анониму сюда нельзя

-- 4) служебная таблица (offset телеграма для сбора подписчиков)
create table if not exists public.kv (
  key text primary key,
  value text
);
alter table public.kv enable row level security;
-- доступ только у service_role (GitHub Actions), политик для anon нет
