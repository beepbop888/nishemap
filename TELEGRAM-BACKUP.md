# Backing the batch up to Telegram — how to switch it on

Written so you can come back to it in a month, or in a fresh session, and be done
in five minutes without remembering anything.

**Goal:** get the approved batch (28 avatars, 12 medals, the review page) delivered
to your private Telegram chat as two files. It's insurance — if the laptop or the
session goes, the artwork still sits in your chat with the bot.

---

## Short version

```bash
cd "~/Desktop/Claude Projects/Jaison"
echo 'PASTE_TOKEN_HERE' > .telegram_token
python3 tools/send_telegram.py
```

Worked if `review.html` and `art_backup.zip` show up in your chat with **@nishemap_bot**.
If not, read on — the long version covers all three places this usually trips.

---

## What a "bot token" actually is

You already have a bot: **@nishemap_bot**. It runs the map mini-app and the Friday
digest. A bot isn't a person or a program on your machine — it's just an account
that gets controlled over the internet.

The **token** is the password to that account. It looks like this:

```
7123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw
```

Bot number on the left, the secret on the right. Anyone holding the token controls
the bot and can message every subscriber as it. That's why it isn't in the site's
code and never goes into git.

## Why I can't fetch the token myself

You already have it — it lives in **GitHub Actions secrets** (repo `nishemap` →
Settings → Secrets and variables → Actions), where the Friday digest reads it.

The catch: GitHub secrets are **one-way**. You can put one in or replace it, but
nothing can read it back — not the web UI, not `gh secret list` (names only), not
the API. That's deliberate; otherwise anyone reaching the repo would walk off with
every password at once.

It isn't on the machine either. I searched `.env` files, configs and the whole
source tree — `config.js` holds only the public Yandex and Supabase keys.

So: **only a human can supply this token**, from a password manager or fresh from
@BotFather.

## Step 1. Find the token, or issue a new one

**If you saved it** (password manager, notes) — grab it and go to step 2.

**If it's lost:**

1. Open Telegram and find **@BotFather** — Telegram's official bot-management bot,
   the one with the blue check.
2. Send it `/mybots`.
3. Pick **nishemap_bot** from the list.
4. Tap **API Token**. It arrives as a message — copy it.

The **Revoke current token** button next to it issues a new token and **kills the old
one instantly**. You don't need it. If you do press it, the Friday digest stops
working until you put the new token into GitHub secrets the same way
(Settings → Secrets → Actions → `BOT_TOKEN` → Update).

## Step 2. Message the bot so it can see you

This is where people trip most often.

A bot can't message first. Telegram only lets a bot write to someone who **started
the conversation**. So:

1. Open the chat with **@nishemap_bot**.
2. Send `/start` (any message works).

The script then finds your `chat_id` on its own — it asks Telegram for recent
messages and picks your private chat out of them.

⚠️ **This expires.** Telegram keeps messages a bot hasn't collected for roughly 24
hours. If you sent `/start` last week and nothing since, the script won't find you
and will say so: "бот не видит ни одного личного чата". One fresh message to the bot
right before running fixes it.

## Step 3. Put the token in a file

Create `.telegram_token` in the project root with the token on a single line:

```bash
cd "~/Desktop/Claude Projects/Jaison"
echo '7123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw' > .telegram_token
```

Why a file rather than the command line: commands linger in shell history and in the
session transcript. `.telegram_token` is already in `.gitignore`, so it can't ride
along into git or reach GitHub.

If you prefer no file:

```bash
export BOT_TOKEN='7123456789:AAH...'
python3 tools/send_telegram.py
```

## Step 4. Run it

```bash
python3 tools/send_telegram.py
```

Expected output:

```
чат: yourname (123456789)
отправлено: review.html (1055 КБ)
отправлено: art_backup.zip (4200 КБ)
```

Two files land in the chat:

| File | What's inside |
|---|---|
| `review.html` | The whole review page. All 40 images are embedded as base64, so it opens on a double-click with no internet and no project folder. |
| `art_backup.zip` | The `art/` folder as-is: avatar sources, shield cutouts, medals, backgrounds. Everything else can be rebuilt from this. |

You can send specific files instead of those two:

```bash
python3 tools/send_telegram.py art/trophies/t25.webp review.html
```

## When it doesn't work

| Message | What happened | Fix |
|---|---|---|
| `нет токена: положи его в .telegram_token` | File missing or empty | Step 3. Check with `cat .telegram_token` |
| `бот не видит ни одного личного чата` | You never messaged the bot, or it was over 24h ago | Send `/start`, run again |
| `getUpdates не ответил: ... 401 Unauthorized` | Token wrong or revoked | Get a fresh one from @BotFather, step 1 |
| `getUpdates не ответил: ... 409 Conflict` | Another process is listening on the same token (the mini-app webhook) | Wait a minute, retry |
| Nothing arrives, no error | Telegram caps bot uploads at 50 MB | Send in pieces by naming files explicitly |

## How safe this is

- The token sits only on your disk in `.telegram_token`, which is gitignored.
- The script talks to `api.telegram.org` and nowhere else — no analytics, no third
  parties. All of it is in `tools/send_telegram.py`, 90 lines, a minute to read.
- Files go to **your private chat**, not to subscribers. The broadcast is separate
  (`scripts/digest.mjs`) and only runs on the GitHub Actions schedule.
- If the token does leak: @BotFather → `/mybots` → nishemap_bot → **Revoke current
  token**, then put the new one into GitHub secrets or the Friday digest stops.

## What's already backed up, Telegram aside

Even if you never get to this, the batch isn't in one place:

- **Commit `29644b3`** in local git — the whole batch plus the tools.
- **Artifact** https://claude.ai/code/artifact/559968d0-b9ba-47f2-8b03-a07f22394efc —
  the review page on claude.ai servers, independent of your machine.
- Rejected takes kept at `.gen/backup_dosh/` and `.gen/backup_gold/` (not in git —
  `.gen/` is gitignored).
