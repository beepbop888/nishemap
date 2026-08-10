-- НищеMap: одна таблица приёма пользовательских цен (вердикт совета #2)
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  dish text not null check (char_length(dish) <= 80),
  price int not null check (price between 1 and 500),
  category text not null check (category in ('street','salad','main','soup','bakery','drink','dessert')),
  venue text not null check (char_length(venue) <= 80),
  address text not null check (char_length(address) <= 160),
  photo_url text,                      -- фото меню/ценника (Supabase Storage, bucket 'menus')
  ip_hash text,                        -- для рейт-лимита, не персональные данные
  flagged int not null default 0,      -- счётчик «пожаловаться»
  status text not null default 'live', -- live | hidden (модерация постфактум, очереди нет)
  submitted_at timestamptz not null default now()
);

alter table public.submissions enable row level security;
-- аноним может добавлять и читать только живые записи
create policy "anon insert" on public.submissions for insert to anon with check (true);
create policy "anon read live" on public.submissions for select to anon using (status = 'live');

-- Storage: создать публичный bucket 'menus' в UI (Storage → New bucket → public).

-- фото к существующим позициям (кнопка «📷 фото» в шторке). ТОЛЬКО меню/ценник/еда — модерация постфактум.
create table public.item_photos (
  id uuid primary key default gen_random_uuid(),
  item_id text not null,               -- id позиции из seed или submissions
  photo_url text not null,             -- Storage bucket 'menus'
  ip_hash text,
  flagged int not null default 0,
  status text not null default 'live',
  submitted_at timestamptz not null default now()
);
alter table public.item_photos enable row level security;
create policy "anon insert photos" on public.item_photos for insert to anon with check (true);
create policy "anon read live photos" on public.item_photos for select to anon using (status = 'live');
