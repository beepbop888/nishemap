/**
 * НищеMap: пятничная рассылка «топ-5 мест недели» в Telegram.
 * Запускается GitHub Actions. Секреты: BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY.
 * Каждый запуск: подбирает новых подписчиков (/start), по пятницам — шлёт дайджест.
 */
import { readFileSync } from "node:fs";

/** Экранируем всё, что пришло от пользователей: имя заведения — недоверенные данные. */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Обрезаем и чистим управляющие символы, чтобы никто не ломал вёрстку сообщения. */
const clean = (s) => esc(String(s).replace(/[\u0000-\u001f\u007f]/g, " ").trim()).slice(0, 60);

const BOT = process.env.BOT_TOKEN;
const SB = process.env.SUPABASE_URL;
const SKEY = process.env.SUPABASE_SERVICE_KEY;
const SEND = process.env.SEND_DIGEST === "true";
const SITE = "https://beepbop888.github.io/nishemap/";
const MINIAPP = "https://t.me/nishemap_bot/map";
/** Устойчивый id народной точки — ТА ЖЕ формула, что в js/app.js (venueKeyId).
 *  Раньше здесь стоял id первой строки submissions, а приложение с коммита
 *  8fb7b05 ищет точку по хешу «заведение|адрес» — и все ссылки в рассылке вели
 *  в никуда: openDeepLink молча ничего не находил. Формулы обязаны совпадать
 *  символ в символ; менять её можно только в обоих местах сразу. */
function venueKeyId(key) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = ((h1 ^ c) * 16777619) >>> 0;
    h2 = ((h2 + c * (i + 1)) * 2654435761) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}

/** id → ссылка, открывающая ровно эту точку в мини-аппе Telegram */
const spotLink = (id) => `${MINIAPP}?startapp=v_${String(id).replace(/-/g, "_").replace(/[^A-Za-z0-9_]/g, "")}`;

if (!BOT || !SB || !SKEY) {
  console.log("Секреты рассылки ещё не заведены (BOT_TOKEN / SUPABASE_URL / SUPABASE_SERVICE_KEY) — пропускаю запуск.");
  console.log("Инструкция: DIGEST-SETUP.md");
  process.exit(0);   // выходим успешно, чтобы GitHub не слал письма о падении
}
const sbHeaders = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, "Content-Type": "application/json" };
const tg = (m, body) => fetch(`https://api.telegram.org/bot${BOT}/${m}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
}).then(r => r.json());

/* ---- 1. собираем новых подписчиков ---- */
async function collectSubscribers() {
  let offset = 0;
  try {
    const st = await fetch(`${SB}/rest/v1/kv?key=eq.tg_offset&select=value`, { headers: sbHeaders }).then(r => r.ok ? r.json() : []);
    if (st?.[0]?.value) offset = parseInt(st[0].value, 10) || 0;
  } catch {}
  const upd = await fetch(`https://api.telegram.org/bot${BOT}/getUpdates?offset=${offset}&limit=100&timeout=0`).then(r => r.json());
  if (!upd.ok || !upd.result?.length) return 0;
  let last = offset, added = 0;
  for (const u of upd.result) {
    last = Math.max(last, u.update_id + 1);
    const msg = u.message;
    if (!msg?.chat?.id) continue;
    const r = await fetch(`${SB}/rest/v1/subscribers`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ chat_id: msg.chat.id, first_name: msg.chat.first_name || "" }),
    });
    if (r.ok) added++;
    if ((msg.text || "").startsWith("/start")) {
      // Кнопка web_app открывает карту прямо в Telegram — человеку не нужно
      // искать меню-кнопку. Ответ приходит с задержкой (Actions раз в 6 часов),
      // поэтому текст не притворяется мгновенным.
      await tg("sendMessage", {
        chat_id: msg.chat.id,
        text: "\uD83C\uDF5C <b>НищеMap</b> — карта дешёвой еды в Москве.\n\n"
            + "\uD83D\uDCCD Смотри, где поесть рядом и за сколько.\n"
            + "➕ Нашёл дешевле — добавь точку и забери монеты.\n"
            + "\uD83C\uDFC5 На монеты открываются аватары, медали и другие сюрпризы впереди.\n\n"
            + "\uD83D\uDCE9 Каждую пятницу присылаю топ-5 мест недели.",
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[
          { text: "\uD83D\uDDFA Открыть карту", web_app: { url: SITE } },
        ]] },
      });
    }
  }
  await fetch(`${SB}/rest/v1/kv`, {
    method: "POST", headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ key: "tg_offset", value: String(last) }),
  }).catch(() => {});
  return added;
}

/** Доверенные названия: из собственных данных репозитория + отправок пользователей.
 *  Таблица views открыта на запись анониму, поэтому venue_name оттуда НЕ печатаем. */
function loadTrustedNames() {
  const map = new Map();
  const add = (name, address, id) => {
    if (!name) return;
    map.set((name + "|" + (address || "")).toLowerCase(), { name, id });
  };
  for (const f of ["data/seed.json", "data/osm.json"]) {
    try {
      const j = JSON.parse(readFileSync(new URL("../" + f, import.meta.url), "utf8"));
      (j.venues || []).forEach(v => add(v.name, v.address, v.id));
    } catch {}
  }
  return map;
}

/* ---- 2. топ-5 мест недели по просмотрам ---- */
async function topFive() {
  const trusted = loadTrustedNames();
  try { // названия из пользовательских точек тоже считаем известными
    const subs = await fetch(`${SB}/rest/v1/submissions?select=id,venue,address&limit=5000`, { headers: sbHeaders })
      .then(r => r.ok ? r.json() : []);
    subs.forEach(s2 => {
      const key = ((s2.venue || "") + "|" + (s2.address || "")).toLowerCase();
      trusted.set(key, { name: s2.venue, id: "u-" + venueKeyId(key) });
    });
  } catch {}
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const rows = await fetch(`${SB}/rest/v1/views?select=venue_key,venue_name&created_at=gte.${since}&limit=10000`,
    { headers: sbHeaders }).then(r => r.ok ? r.json() : []);
  const count = {};
  for (const v of rows) {
    const k = String(v.venue_key || "").toLowerCase();
    const canonical = trusted.get(k);
    if (!canonical) continue;                 // неизвестный ключ — накрутка, пропускаем
    count[k] = count[k] || { n: 0, name: canonical.name, id: canonical.id };
    count[k].n++;
  }
  return Object.values(count).sort((a, b) => b.n - a.n).slice(0, 5);
}

/* ---- 3. рассылка ---- */
async function sendDigest() {
  const top = await topFive();
  if (!top.length) { console.log("no views this week — skip"); return; }
  const subs = await fetch(`${SB}/rest/v1/subscribers?select=chat_id&active=is.true`, { headers: sbHeaders })
    .then(r => r.ok ? r.json() : []);
  if (!subs.length) { console.log("no subscribers"); return; }
  const medals = ["🥇", "🥈", "🥉", "4.", "5."];
  const text = "<b>Топ-5 мест недели</b>\nКуда народ ходил есть за копейки:\n\n" +
    top.map((t, i) => t.id
      ? `${medals[i]} <a href="${spotLink(t.id)}">${clean(t.name)}</a> — смотрели ${Number(t.n) | 0} раз`
      : `${medals[i]} ${clean(t.name)} — смотрели ${Number(t.n) | 0} раз`).join("\n") +
    `\n\n<a href="${MINIAPP}">Открыть карту</a> · сдай свою точку и получи монету`;
  let ok = 0, dead = 0;
  for (const s of subs) {
    const r = await tg("sendMessage", { chat_id: s.chat_id, text, parse_mode: "HTML", disable_web_page_preview: false });
    if (r.ok) ok++;
    else if (r.error_code === 403) {           // пользователь заблокировал бота
      dead++;
      await fetch(`${SB}/rest/v1/subscribers?chat_id=eq.${s.chat_id}`, {
        method: "PATCH", headers: sbHeaders, body: JSON.stringify({ active: false }),
      }).catch(() => {});
    }
    await new Promise(r2 => setTimeout(r2, 60));   // лимит телеграма ~30 msg/sec
  }
  console.log(`digest sent: ${ok}, deactivated: ${dead}`);
}

/* Вебхук и getUpdates взаимно исключают друг друга: пока вебхук включён,
   getUpdates отвечает 409, а подписчиков пишет воркер (worker/src/index.js).
   Проверяем, а не выпиливаем: если вебхук снимут, сбор снова заработает сам. */
const hook = await fetch(`https://api.telegram.org/bot${BOT}/getWebhookInfo`)
  .then(r => r.json()).catch(() => null);
if (hook?.result?.url) {
  console.log("подписчиков собирает вебхук:", hook.result.url);
} else {
  const added = await collectSubscribers();
  console.log("new subscribers:", added);
}
if (SEND) await sendDigest();
