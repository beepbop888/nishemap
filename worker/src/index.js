/**
 * НищеMap: телеграм-бот и пульт модерации на Cloudflare Worker.
 *
 * Две работы:
 *   POST /        — вебхук Telegram. Отвечает на /start кнопкой карты и
 *                   обрабатывает нажатия кнопок модерации (callback_query).
 *   POST /report  — сайт зовёт сюда, когда человек жмёт «неверно». Воркер
 *                   считает жалобы и присылает владельцу карточку с кнопками.
 *
 * Почему модерация в Telegram, а не в самой карте: решение писать в базу может
 * только service_role, а такому ключу не место в браузере. Здесь он лежит
 * секретом воркера и наружу не выходит — владелец жмёт кнопку, ключ остаётся тут.
 *
 * Секреты: BOT_TOKEN, WEBHOOK_SECRET, SUPABASE_SERVICE_KEY, OWNER_CHAT_ID.
 */

// Кнопку «Запустить» Telegram не даёт повесить на мини-апп: она всегда шлёт
// /start. Значит задача ответа — не рассказать (описание человек уже прочитал
// на этом же экране), а исчезнуть, оставив кнопку. Отсюда две строки.
const WELCOME =
  "\u{1F35C} Держи карту — где поесть в Москве дёшево.\n" +
  "\u{1F4E9} По пятницам присылаю топ-5 мест недели.";

const NUDGE = "\u{1F5FA} Карта здесь — жми кнопку.";

/** Жалобы приходят от анонимов: в сообщение владельцу они попадают как текст,
 *  а значит должны быть обезврежены и укорочены. */
const esc = (s) => String(s == null ? "" : s)
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .trim().slice(0, 80);

/** Полезная нагрузка из t.me/bot?start=v_<id> ведёт сразу к нужной точке:
 *  openDeepLink() в app.js читает ?v= из адреса. */
function appUrl(site, payload) {
  if (!payload) return site;
  if (payload.startsWith("v_")) {
    return site + "?v=" + encodeURIComponent(payload.slice(2).replace(/_/g, "-"));
  }
  // Остальное — ключ панели разработчика. Проверяет его сам сайт по хешу,
  // воркер ключа не знает и знать не должен.
  return site + "?dev=" + encodeURIComponent(payload);
}

const tg = (env, method, body) =>
  fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(r => r.json()).catch(e => ({ ok: false, error: String(e) }));

const sbHeaders = (env) => ({
  apikey: env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
});

/** Подписчик в Supabase. Молча пропускаем, если ключ ещё не заведён:
 *  приветствие важнее и не должно падать вместе с базой. */
async function remember(env, chat) {
  if (!env.SUPABASE_SERVICE_KEY || !env.SUPABASE_URL) return;
  try {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/subscribers`, {
      method: "POST",
      headers: { ...sbHeaders(env), Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ chat_id: chat.id, first_name: chat.first_name || "" }),
    });
    // Тихая потеря подписчика — самая незаметная поломка здесь: человек получает
    // приветствие, а в пятничную рассылку не попадает. Видно в `wrangler tail`.
    if (!r.ok) console.log("subscribers insert", r.status, await r.text());
  } catch (e) { console.log("subscribers insert failed", String(e)); }
}

/* ---------- модерация ---------- */

/** Решение владельца. Одна таблица на сидовые точки и на присланные людьми. */
async function setOverride(env, itemId, patch) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/overrides`, {
    method: "POST",
    headers: { ...sbHeaders(env), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ item_id: itemId, updated_at: new Date().toISOString(), ...patch }),
  });
  // Длина ключа в логе не случайна: пустой секрет выглядит точно так же,
  // как неверный, и один раз уже стоил получаса поисков.
  if (!r.ok) console.log("override failed", r.status, await r.text(),
                         "| длина ключа:", (env.SUPABASE_SERVICE_KEY || "").length);
  return r.ok;
}

async function reportCount(env, itemId) {
  const r = await fetch(
    `${env.SUPABASE_URL}/rest/v1/reports?item_id=eq.${encodeURIComponent(itemId)}&select=id`,
    { headers: { ...sbHeaders(env), Prefer: "count=exact", Range: "0-0" } });
  return parseInt((r.headers.get("content-range") || "").split("/")[1] || "0", 10);
}

/** Кнопки короче 64 байт — иначе Telegram молча не отдаст callback_data.
 *  «ui-<uuid>» это 39 символов, с префиксом влезаем с запасом. */
const modKeyboard = (id) => ({
  inline_keyboard: [
    [{ text: "\u{1F6AB} Скрыть", callback_data: "h:" + id },
     { text: "⚪ Серая монета", callback_data: "g:" + id }],
    [{ text: "✅ Всё верно", callback_data: "o:" + id }],
  ],
});

/** Сайт зовёт /report с другого домена — без CORS ответ до него не доедет. */
function json(body) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      } });
    }
    if (request.method !== "POST") return new Response("nishemap bot ok");

    /* ---- жалоба с сайта ---- */
    if (path === "/report") {
      let b; try { b = await request.json(); } catch { return json({ ok: false }); }
      const id = String(b.item_id || "").slice(0, 60);
      if (!id) return json({ ok: false });
      ctx.waitUntil((async () => {
        const n = await reportCount(env, id);
        // Не каждая жалоба стоит сообщения: тролль с кнопкой «неверно» иначе
        // засыплет чат. Шумим на первой, третьей и дальше всё реже.
        if (![1, 3, 10, 30, 100].includes(n)) return;
        await tg(env, "sendMessage", {
          chat_id: env.OWNER_CHAT_ID,
          text: (n >= 3 ? "⚠️" : "\u{1F4E5}") + ` Жалоба #${n} на позицию\n\n` +
                `<b>${esc(b.dish) || id}</b>` + (b.price ? ` — ${esc(b.price)} ₽` : "") + "\n" +
                (b.venue ? esc(b.venue) + "\n" : "") +
                (b.address ? esc(b.address) + "\n" : "") +
                `\nПожаловались: ${n} раз` +
                (n >= 3 ? "\n<i>Монета уже посерела автоматически.</i>" : ""),
          parse_mode: "HTML",
          reply_markup: modKeyboard(id),
        });
      })());
      return json({ ok: true });
    }

    /* ---- вебхук Telegram ---- */
    // Адрес вебхука знает только Telegram, но заголовок дешевле доверия к адресу.
    if (env.WEBHOOK_SECRET &&
        request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
      return new Response("no", { status: 401 });
    }

    let upd;
    try { upd = await request.json(); } catch { return new Response("ok"); }

    /* нажата кнопка модерации */
    const cb = upd.callback_query;
    if (cb) {
      // Кнопки видит только владелец, но сообщение можно переслать: проверяем,
      // кто нажал, а не где лежит сообщение.
      if (String(cb.from && cb.from.id) !== String(env.OWNER_CHAT_ID)) {
        await tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: "Не твоя кнопка" });
        return new Response("ok");
      }
      const cut = String(cb.data || "").indexOf(":");
      const act = cut > 0 ? cb.data.slice(0, cut) : "";
      const id = cut > 0 ? cb.data.slice(cut + 1) : "";
      const plan = { h: { hidden: true, disputed: false, note: "скрыто владельцем" },
                     g: { disputed: true, hidden: false, note: "цена под вопросом" },
                     o: { disputed: false, hidden: false, note: "проверено владельцем" } }[act];
      const done = { h: "\u{1F6AB} Скрыто",
                     g: "⚪ Серая монета — ждём настоящую цену",
                     o: "✅ Оставлено как есть" }[act];
      const ok = plan && id ? await setOverride(env, id, plan) : false;
      await tg(env, "answerCallbackQuery", {
        callback_query_id: cb.id, text: ok ? done : "Не вышло — смотри логи",
      });
      if (ok && cb.message) {
        await tg(env, "editMessageText", {
          chat_id: cb.message.chat.id, message_id: cb.message.message_id,
          text: (cb.message.text || "") + "\n\n— " + done,
        });
      }
      return new Response("ok");
    }

    const msg = upd.message || upd.edited_message;
    // Telegram повторяет доставку на любой не-200, поэтому всё, что нам не
    // интересно, тоже подтверждаем.
    if (!msg || !msg.chat || msg.chat.type !== "private") return new Response("ok");

    const text = (msg.text || "").trim();
    // Нужен один раз при настройке: OWNER_CHAT_ID неоткуда взять, пока вебхук
    // включён — getUpdates при нём отвечает 409.
    if (text === "/id") {
      await tg(env, "sendMessage", { chat_id: msg.chat.id, text: "chat_id: " + msg.chat.id });
      return new Response("ok");
    }
    const start = text.split(/\s+/)[0] === "/start";
    const payload = start ? text.split(/\s+/)[1] || "" : "";

    ctx.waitUntil(remember(env, msg.chat));
    await tg(env, "sendMessage", {
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
