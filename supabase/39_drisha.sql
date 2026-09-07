-- НищеMap 39: ДрищMap — платный слой «где пожалеешь, что поел».
--
-- Три источника в одной таблице, потому что показываются они вместе, а вот
-- отвечать за них приходится по-разному:
--   crowd — наши пользователи нажали «мне поплохело». Наш контент, наша
--           модерация, снимается одной строкой.
--   link  — мы храним только ссылку на чужой отзыв. Текста у нас нет.
--   ext   — цитата из чужого отзыва с датой и ссылкой. Именно этот источник
--           несёт юридический вес, поэтому он ВСЕГДА показывается как цитата
--           с автором и ссылкой, и никогда как утверждение приложения.
--
-- Три месяца — не украшение: протухший отзыв о еде ничего не говорит о
-- сегодняшней кухне, а обвинение живёт вечно. Всё старое выпадает само.

create table if not exists public.sick_reports (
  id          uuid primary key default gen_random_uuid(),
  venue_key   text not null,                    -- lower(venue)||'|'||lower(address)
  venue_name  text,
  address     text,
  lat         double precision,
  lon         double precision,
  source      text not null check (source in ('crowd', 'link', 'ext')),
  kind        text not null check (kind in ('poisoning', 'diarrhea', 'vomit', 'bad')),
  happened_on date not null,                    -- когда человеку стало плохо / дата отзыва
  quote       text,                             -- только для ext, обрезается до 400
  url         text,                             -- откуда цитата или куда вести
  author      text,                             -- как подписан отзыв на том сайте
  site        text,                             -- yandex / 2gis / google / tripadvisor
  device      text,                             -- только для crowd
  status      text not null default 'live' check (status in ('live', 'hidden')),
  created_at  timestamptz not null default now()
);
create index if not exists sick_venue on public.sick_reports (venue_key, happened_on desc);
create index if not exists sick_fresh on public.sick_reports (happened_on desc) where status = 'live';
-- один человек — одна жалоба на заведение в месяц: иначе это не сигнал, а месть.
-- Месяц держим отдельной колонкой: date_trunc над date не IMMUTABLE, в индекс её не взять.
-- to_char и date::text зависят от DateStyle, то есть только STABLE — в
-- генерируемую колонку их не взять. extract над date иммутабелен.
alter table public.sick_reports
  add column if not exists month_key int
  generated always as ((extract(year from happened_on)::int) * 100
                     + (extract(month from happened_on)::int)) stored;
create unique index if not exists sick_crowd_once
  on public.sick_reports (venue_key, device, month_key)
  where source = 'crowd' and device is not null;

alter table public.sick_reports enable row level security;
-- Читать напрямую нельзя НИКОМУ: слой платный, и решает это сервер.
-- Писать может только воркер (жалобы людей идут через него же).
revoke all on public.sick_reports from anon, public;

-- ============ Подписки ============
create table if not exists public.subscriptions (
  tg_id      bigint primary key,
  until      timestamptz not null,
  last_paid  timestamptz,
  stars_paid int not null default 0,
  note       text
);
alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, public;

create or replace function public.sub_active(p_tg_id bigint) returns boolean
language sql stable security definer as $$
  select exists (select 1 from public.subscriptions
                  where tg_id = p_tg_id and until > now());
$$;
revoke execute on function public.sub_active(bigint) from anon, public;

-- ============ Что показывает слой ============
-- Свежесть считаем от happened_on, а не от created_at: отзыв полугодовой
-- давности, найденный сегодня, всё равно полугодовой давности.
create or replace view public.drisha_points as
select venue_key,
       max(venue_name)                                      as venue_name,
       max(address)                                         as address,
       avg(lat)                                             as lat,
       avg(lon)                                             as lon,
       count(*)                                             as reports,
       count(*) filter (where source = 'crowd')             as crowd,
       count(*) filter (where source = 'ext')               as quoted,
       count(*) filter (where source = 'link')              as linked,
       count(*) filter (where kind in ('poisoning', 'vomit')) as severe,
       count(distinct site) filter (where site is not null) as sites,
       max(happened_on)                                     as last_case,
       -- Тяжесть: отравление весит больше, чем «невкусно», а подтверждение с
       -- разных сайтов — больше, чем десять отзывов с одного.
       (count(*) filter (where kind = 'poisoning') * 3
      + count(*) filter (where kind = 'vomit')     * 3
      + count(*) filter (where kind = 'diarrhea')  * 2
      + count(*) filter (where kind = 'bad')       * 1
      + greatest(count(distinct site) - 1, 0)      * 2)     as score
  from public.sick_reports
 where status = 'live'
   and happened_on >= (current_date - interval '3 months')
 group by venue_key;
revoke all on public.drisha_points from anon, public;

notify pgrst, 'reload schema';
