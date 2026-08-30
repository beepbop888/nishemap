# НищеMap в Telegram

Мини-апп уже живёт: **t.me/nishemap_bot/map** → открывает карту прямо в Telegram
(на весь экран, шапка чёрная как вывеска, системная «Назад» закрывает карточки, вибро при отправке цены).

## Витрина бота: что видно, когда открываешь чат

Настраивается скриптом `python3 tools/tg_setup.py` (токен из `.telegram_token`), правится там же в файле:

| Что | Метод API | Где видно |
|---|---|---|
| Описание | `setMyDescription` | Пустой чат, над кнопкой «Запустить» |
| Короткое описание | `setMyShortDescription` | Профиль бота и превью ссылки |
| Список команд | `setMyCommands` | Меню «/» |
| Меню-кнопка | `setChatMenuButton` | Слева от поля ввода, открывает карту в один тап |

Меню-кнопка работает даже до нажатия «Запустить» — это единственная дорога к
карте для человека, который ещё не написал боту ни слова.

### Два шага, которые делаются только руками в @BotFather

API их не умеет — только сам BotFather:

1. **Главное мини-приложение** — сделано. `/mybots` → nishemap_bot → Bot Settings →
   Configure Mini App. Проверка: в `getMe` поле `has_main_web_app` = `true`.
2. **Картинка и имя.** Bot Settings → Botpic — квадратная аватарка;
   `/setname`, если захочется поменять отображаемое имя.

### Мгновенный ответ на «Запустить» — Cloudflare Worker

Живёт в `worker/`, крутится на **https://nishemap-bot.leonardabramov888.workers.dev**.
Telegram шлёт туда апдейты вебхуком, воркер отвечает за десятки миллисекунд:
приветствие плюс кнопка, открывающая карту внутри Telegram. Он же пишет
подписчика в Supabase — вебхук ломает `getUpdates` (409), поэтому `digest.mjs`
теперь проверяет `getWebhookInfo` и сбор пропускает.

`/start v_<id>` открывает сразу нужную точку, `/start dev` — панель разработчика.

```bash
npx wrangler deploy --config worker/wrangler.toml    # выкатить изменения
npx wrangler tail   --config worker/wrangler.toml    # смотреть живые запросы
```

Секреты воркера (в файлах их нет):

| Секрет | Откуда | Без него |
|---|---|---|
| `BOT_TOKEN` | @BotFather | воркер не сможет отвечать |
| `WEBHOOK_SECRET` | `openssl rand -hex 24`, лежит в `.webhook_secret` | чужой сможет слать боту апдейты |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → service_role | человек получит ответ, но в рассылку не попадёт |

Ставятся по одному: `npx wrangler secret put ИМЯ --config worker/wrangler.toml`.

Переключить вебхук на другой адрес или снять:

```bash
T=$(cat .telegram_token); S=$(cat .webhook_secret)
curl -s -X POST "https://api.telegram.org/bot$T/setWebhook" -H 'Content-Type: application/json' \
  -d "{\"url\":\"https://nishemap-bot.leonardabramov888.workers.dev/\",\"secret_token\":\"$S\",\"allowed_updates\":[\"message\"]}"
curl -s "https://api.telegram.org/bot$T/deleteWebhook"   # обратно на GitHub Actions
```

## Пятничная рассылка «Топ-5 мест недели»

Каждую пятницу в 15:00 МСК бот присылает подписчикам пять мест, которые за неделю
чаще всего открывали на карте, и зовёт сдать свою точку. Всё считается автоматически
из просмотров карточек (таблица `views`), рассылку шлёт GitHub Actions — сервер не нужен, бесплатно.

### Что нужно включить один раз (5 минут)

**Шаг 1. Запусти `supabase/04_digest.sql`** (SQL Editor → New query → вставить → Run).
Создаст: `views` (просмотры), `subscribers` (кто нажал Start), `kv` (служебная), плюс колонку `device` у submissions.

**Шаг 2. Возьми три значения:**
1. `BOT_TOKEN` — токен бота от @BotFather (если потерял: напиши ему `/mybots` → выбери бота → API Token).
2. `SUPABASE_URL` — `https://svfnjfpawljkdcehzkgv.supabase.co`
3. `SUPABASE_SERVICE_KEY` — Supabase → Settings → API → ключ **service_role** (секретный!).

**Шаг 3. Положи их в секреты репозитория:**
GitHub → репозиторий `nishemap` → **Settings** → **Secrets and variables** → **Actions** →
**New repository secret** → добавь три штуки с именами ровно как выше.

**Шаг 4. Проверь вручную:** вкладка **Actions** → «НищеMap Telegram digest» → **Run workflow** →
галочка «Отправить дайджест сейчас» → Run. Если ты нажимал Start у бота — придёт сообщение.

⚠️ `service_role` — это ключ с полным доступом к базе. Он живёт ТОЛЬКО в секретах GitHub,
никогда в коде сайта. Если засветишь — перевыпусти его в Supabase.

## Как люди подписываются
Пишут боту `/start` → бот отвечает приветствием и добавляет их в рассылку.
Бот собирает новых подписчиков каждые 6 часов (Telegram хранит сообщения только сутки).
