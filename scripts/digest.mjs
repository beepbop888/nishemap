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

if (!BOT || !SB || !SKEY) { console.error("missing secrets"); process.exit(1); }
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
      await tg("sendMessage", {
        chat_id: msg.chat.id,
        text: "Ты в деле. Каждую пятницу пришлю топ-5 мест недели — куда народ ходил есть за копейки.\n\nКарта: " + SITE,
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
  const add = (name, address) => {
    if (!name) return;
    map.set((name + "|" + (address || "")).toLowerCase(), name);
  };
  for (const f of ["data/seed.json", "data/osm.json"]) {
    try {
      const j = JSON.parse(readFileSync(new URL("../" + f, import.meta.url), "utf8"));
      (j.venues || []).forEach(v => add(v.name, v.address));
    } catch {}
  }
  return map;
}

/* ---- 2. топ-5 мест недели по просмотрам ---- */
async function topFive() {
  const trusted = loadTrustedNames();
  try { // названия из пользовательских точек тоже считаем известными
    const subs = await fetch(`${SB}/rest/v1/submissions?select=venue,address&limit=5000`, { headers: sbHeaders })
      .then(r => r.ok ? r.json() : []);
    subs.forEach(s2 => trusted.set(((s2.venue || "") + "|" + (s2.address || "")).toLowerCase(), s2.venue));
  } catch {}
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const rows = await fetch(`${SB}/rest/v1/views?select=venue_key,venue_name&created_at=gte.${since}&limit=10000`,
    { headers: sbHeaders }).then(r => r.ok ? r.json() : []);
  const count = {};
  for (const v of rows) {
    const k = String(v.venue_key || "").toLowerCase();
    const canonical = trusted.get(k);
    if (!canonical) continue;                 // неизвестный ключ — накрутка, пропускаем
    count[k] = count[k] || { n: 0, name: canonical };
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
    top.map((t, i) => `${medals[i]} ${clean(t.name)} — смотрели ${Number(t.n) | 0} раз`).join("\n") +
    `\n\nСдай свою точку: ${SITE}`;
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

const added = await collectSubscribers();
console.log("new subscribers:", added);
if (SEND) await sendDigest();
