/**
 * НищеMap: вебхук телеграм-бота на Cloudflare Worker.
 *
 * Зачем он есть: без сервера ответ на «Запустить» приходил из GitHub Actions —
 * то есть в худшем случае через шесть часов. Человек жал кнопку и не получал
 * ничего. Воркер отвечает за десятки миллисекунд и сразу даёт кнопку, которая
 * открывает карту внутри Telegram.
 *
 * Он же ведёт список подписчиков: включённый вебхук ломает getUpdates (409),
 * поэтому digest.mjs больше не собирает их сам — только рассылает.
 *
 * Секреты (wrangler secret put): BOT_TOKEN, WEBHOOK_SECRET, SUPABASE_SERVICE_KEY.
 */

// Кнопку «Запустить» Telegram не даёт повесить на мини-апп: она всегда шлёт
// /start. Значит задача ответа — не рассказать (описание человек уже прочитал
// на этом же экране), а исчезнуть, оставив кнопку. Отсюда две строки.
const WELCOME =
  "\u{1F35C} Держи карту — где поесть в Москве дёшево.\n" +
  "\u{1F4E9} По пятницам присылаю топ-5 мест недели.";

const NUDGE = "\u{1F5FA} Карта здесь — жми кнопку.";

/** Полезная нагрузка из t.me/bot?start=v_<id> ведёт сразу к нужной точке:
 *  openDeepLink() в app.js читает ?v= из адреса. */
function appUrl(site, payload) {
  if (!payload) return site;
  if (payload === "dev") return site + "?dev=1";
  if (payload.startsWith("v_")) {
    return site + "?v=" + encodeURIComponent(payload.slice(2).replace(/_/g, "-"));
  }
  return site;
}

const tg = (token, method, body) =>
  fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

/** Подписчик в Supabase. Молча пропускаем, если ключ ещё не заведён:
 *  приветствие важнее и не должно падать вместе с базой. */
async function remember(env, chat) {
  if (!env.SUPABASE_SERVICE_KEY || !env.SUPABASE_URL) return;
  try {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/subscribers`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify({ chat_id: chat.id, first_name: chat.first_name || "" }),
    });
    // Тихая потеря подписчика — самая незаметная поломка здесь: человек получает
    // приветствие, а в пятничную рассылку не попадает. Видно в `wrangler tail`.
    if (!r.ok) console.log("subscribers insert", r.status, await r.text());
  } catch (e) { console.log("subscribers insert failed", String(e)); }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("nishemap bot ok");

    // Адрес вебхука знает только Telegram, но заголовок дешевле доверия к адресу.
    if (env.WEBHOOK_SECRET &&
        request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
      return new Response("no", { status: 401 });
    }

    let upd;
    try { upd = await request.json(); } catch { return new Response("ok"); }

    const msg = upd.message || upd.edited_message;
    // Telegram повторяет доставку на любой не-200, поэтому всё, что нам не
    // интересно, тоже подтверждаем.
    if (!msg || !msg.chat || msg.chat.type !== "private") return new Response("ok");

    const text = (msg.text || "").trim();
    const start = text.split(/\s+/)[0] === "/start";
    const payload = start ? text.split(/\s+/)[1] || "" : "";

    ctx.waitUntil(remember(env, msg.chat));
    await tg(env.BOT_TOKEN, "sendMessage", {
      chat_id: msg.chat.id,
      text: start ? WELCOME : NUDGE,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{
          text: "\u{1F5FA} Открыть карту",
          web_app: { url: appUrl(env.SITE, payload) },
        }]],
      },
    });
    return new Response("ok");
  },
};
