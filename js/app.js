/* НищеMap v1 — карта еды до 300 ₽ */
(function () {
  "use strict";

  var CFG = window.NISHEMAP_CONFIG || {};
  var SEED = window.NISHEMAP_SEED || { venues: [] };
  /* Потолки по категориям: кофе за 300 — не наша экосистема. */
  var PRICE_CAP = { drink: 150 };
  function overCap(item) {
    var cap = PRICE_CAP[item.category];
    return cap && item.price > cap;
  }
  var STATIONS = window.NISHEMAP_STATIONS || [];   // [имя, lat, lon] — 240 станций

  /* Ближайшее метро в пределах 900 м. Дальше — «пешком не дойти», станции нет. */
  function nearestStation(lat, lon) {
    if (!lat || !lon) return "";
    var best = "", bd = 900;
    for (var i = 0; i < STATIONS.length; i++) {
      var s = STATIONS[i];
      var x = (s[2] - lon) * 63000, y = (s[1] - lat) * 111320;
      var d = Math.sqrt(x * x + y * y);
      if (d < bd) { bd = d; best = s[0]; }
    }
    return best;
  }
  /* Район в данных больше не используем: точка привязывается к станции. */
  SEED.venues.forEach(function (v) { v.district = nearestStation(v.lat, v.lon); });
  /* Позиции сверх потолка не показываем, откуда бы ни пришли. */
  SEED.venues.forEach(function (v) {
    if (v.items) v.items = v.items.filter(function (it) { return !overCap(it); });
  });
  SEED.venues = SEED.venues.filter(function (v) { return v.noPrice || (v.items && v.items.length); });
  var OSM = (function () {
    var r = (window.NISHEMAP_OSM_ROWS && window.NISHEMAP_OSM_ROWS.rows) || [];
    return r.map(function (a, i) {
      return { id: "osm-" + i, name: a[0], type: a[1], lat: a[2], lon: a[3],
               address: a[4] || "", district: "", source: "osm", noPrice: true,
               yandexUrl: "https://yandex.ru/maps/?text=" + encodeURIComponent(a[0] + " " + (a[4] || "")),
               items: [] };
    });
  })();
  var GRAY_MAX_ON_SCREEN = 220;   // больше глазу всё равно не нужно, а карте тяжело
  var GRAY_MIN_ZOOM = 14; // серые точки — только при приближении, чтобы обзор был монетным
  var STALE_DAYS = 14;

  var LS_CONFIRM = "nishemap.confirms"; // {itemId: "YYYY-MM-DD"}
  var LS_INBOX = "nishemap.inbox";      // [{...,sent:bool}] — неотправленные шлём позже

  var state = {
    bands: { 100: true, 200: true, 300: true, 500: true },
    query: "",
    category: "",
    districts: {}, // {район: true} — мультивыбор; пусто = все
    showGray: true,
    onlyVerified: false,
    near: false,
    pos: null,
    grayMarkers: [],
    map: null,
    markers: [],
    activeVenue: null,
  };

  /* ---------- Telegram Mini App ---------- */
  /* SDK телеграма подключён на любой странице и в обычном браузере ставит initData = ""
     — то есть !== undefined. Из-за этого сайт считал себя мини-аппом и прятал кнопку
     «Открыть в Telegram». Признак настоящего мини-аппа: непустой initData ИЛИ известная платформа. */
  var TG = (function () {
    var w = window.Telegram && window.Telegram.WebApp;
    if (!w) return null;
    var real = (typeof w.initData === "string" && w.initData.length > 0) ||
               (w.platform && w.platform !== "unknown");
    return real ? w : null;
  })();
  if (TG) document.body.classList.add("in-tg");   /* внутри телеграма кнопка «открыть» не нужна */
  if (TG) {
    try {
      TG.ready(); TG.expand();
      if (TG.setHeaderColor) TG.setHeaderColor("#232323");
      if (TG.setBackgroundColor) TG.setBackgroundColor("#f6f5f1");
      document.documentElement.classList.add("in-telegram");
    } catch (e) {}
  }
  function haptic(kind) {
    if (TG && TG.HapticFeedback) {
      try { TG.HapticFeedback.notificationOccurred(kind || "success"); } catch (e) {}
    }
  }

  /* ---------- личность устройства и вклад ---------- */
  function deviceId() {
    var d = localStorage.getItem("nishemap.device");
    if (!d) {
      d = "d" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("nishemap.device", d);
    }
    return d;
  }
  function myItems() {
    try { return JSON.parse(localStorage.getItem("nishemap.myitems")) || []; } catch (e) { return []; }
  }
  function addMyItem(id) {
    var a = myItems();
    if (a.indexOf(id) === -1) { a.push(id); localStorage.setItem("nishemap.myitems", JSON.stringify(a)); }
  }

  var CONFIRMS = {};   // itemId -> Set-подобный объект устройств
  function confirmCount(id) { return CONFIRMS[id] ? Object.keys(CONFIRMS[id]).length : 0; }
  function hasPhoto(id) { return !!(PHOTOS[id] && PHOTOS[id].length); }
  var VERIFY_TTL = 30; // дней: дальше проверка считается устаревшей
  function daysSinceISO(iso) {
    if (!iso) return 1e6;
    return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000));
  }
  /* когда позицию проверили в последний раз (фото или подтверждение) */
  function verifiedAt(id) {
    var best = null;
    if (PHOTO_AT[id]) best = PHOTO_AT[id];
    var c = CONFIRMS[id] || {};
    Object.keys(c).forEach(function (d) { if (c[d] && (!best || c[d] > best)) best = c[d]; });
    return best;
  }
  function verifyAgeDays(id) { return daysSinceISO(verifiedAt(id)); }
  /* позиция проверена: есть фото ИЛИ два разных устройства подтвердили */
  /* Проверка считается ОДИНАКОВО у всех: только по данным сервера.
     Никаких локальных привилегий — иначе автор видит «проверено», а район нет. */
  var CONFIRM_GAP_MS = 60 * 60 * 1000;   // час между подтверждениями: сговор «два телефона за минуту» не проходит
  function confirmsSpread(id) {
    var c = CONFIRMS[id] || {}, times = Object.keys(c).map(function (d) { return c[d]; })
      .filter(Boolean).map(function (t) { return new Date(t).getTime(); }).sort();
    if (times.length < 2) return 0;
    return times[times.length - 1] - times[0];
  }
  function isVerified(id) {
    if (verifyAgeDays(id) > VERIFY_TTL) return false;   // проверка протухла
    if (hasPhoto(id)) return true;
    return confirmCount(id) >= 2 && confirmsSpread(id) >= CONFIRM_GAP_MS;
  }

  /* ---------- helpers ---------- */
  function bandOf(price) { return price <= 100 ? 100 : price <= 200 ? 200 : price <= 300 ? 300 : 500; }

  function confirms() {
    try { return JSON.parse(localStorage.getItem(LS_CONFIRM)) || {}; } catch (e) { return {}; }
  }
  function confirmedAt(it) { return confirms()[it.id] || it.confirmedAt; }

  function daysAgo(iso) {
    var ms = Date.now() - new Date(iso + "T12:00:00").getTime();
    return Math.max(0, Math.round(ms / 86400000));
  }
  function ruDays(n) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return n + " день";
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return n + " дня";
    return n + " дней";
  }
  function freshBadge(it) {
    if (isVerified(it.id)) {
      var n = confirmCount(it.id), age = verifyAgeDays(it.id);
      var when = age === 0 ? "сегодня" : age + " дн. назад";
      return { text: (hasPhoto(it.id) ? "проверено фото · " : "проверено народом · ") + when, cls: "is-fresh" };
    }
    if (confirmCount(it.id) >= 2 && confirmsSpread(it.id) < CONFIRM_GAP_MS) {
      return { text: "проверяем цену…", cls: "" };
    }
    if (verifiedAt(it.id) && verifyAgeDays(it.id) > VERIFY_TTL) {
      return { text: "проверяли " + verifyAgeDays(it.id) + " дн. назад — уже неточно", cls: "is-stale" };
    }
    var ca = confirmedAt(it);
    if (!ca) return { text: "цена из подборки · не проверена", cls: "is-stale" };
    var d = daysAgo(ca);
    var stale = d > STALE_DAYS;
    var text = d === 0 ? "цена жива · проверено сегодня"
      : (stale ? "цена могла протухнуть · " : "цена жива · ") + ruDays(d) + " назад";
    return { text: text, cls: stale ? "is-stale" : "is-fresh" };
  }

  function venueItems(v) {
    var q = state.query.trim().toLowerCase();
    return v.items.filter(function (it) {
      if (!state.bands[bandOf(it.price)]) return false;
      if (state.category && it.category !== state.category) return false;
      if (state.onlyVerified && !isVerified(it.id)) return false;
      if (q && it.item.toLowerCase().indexOf(q) === -1 &&
          v.name.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }
  function visibleVenues() {
    var sel = Object.keys(state.districts).filter(function (k) { return state.districts[k]; });
    return SEED.venues.filter(function (v) {
      if (sel.length && !state.districts[v.district]) return false;
      return venueItems(v).length > 0;
    });
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }
  /* серия: 3+ подтверждённых цены за календарную неделю. Награда растёт на 1 каждые 4 недели. */
  var STREAK_NEED = 3;
  function weekKey(d) {
    var t = new Date(d); t.setHours(0, 0, 0, 0);
    t.setDate(t.getDate() - ((t.getDay() + 6) % 7));      // понедельник
    return t.toISOString().slice(0, 10);
  }
  function streakState() {
    var byWeek = {}, ids = myItems();
    SEED.venues.forEach(function (v) {
      v.items.forEach(function (it) {
        if (ids.indexOf(it.id) === -1 || !isVerified(it.id) || !it.confirmedAt) return;
        var w = weekKey(it.confirmedAt);
        byWeek[w] = (byWeek[w] || 0) + 1;
      });
    });
    var good = Object.keys(byWeek).filter(function (w) { return byWeek[w] >= STREAK_NEED; }).sort();
    // считаем подряд идущие недели, заканчивая текущей или прошлой
    var run = 0, cur = weekKey(new Date());
    for (var i = good.length - 1; i >= 0; i--) {
      if (good[i] === cur) { run++; var p = new Date(cur); p.setDate(p.getDate() - 7); cur = weekKey(p); }
      else break;
    }
    return { weeks: run, thisWeek: byWeek[weekKey(new Date())] || 0 };
  }
  function streakCoins() {
    var w = streakState().weeks, total = 0;
    for (var i = 1; i <= w; i++) total += Math.min(Math.floor((i - 1) / 4) + 1, 5);  // +1, каждые 4 недели +1, потолок +5
    return total;
  }

  var TROPHIES = {
    10:  { t: "Первый десяток",   s: "10 подтверждённых цен",  metal: "bronze" },
    25:  { t: "Разведчик",        s: "25 подтверждённых цен",  metal: "bronze" },
    50:  { t: "Полсотни",         s: "50 подтверждённых цен",  metal: "silver" },
    100: { t: "Сотня",            s: "100 подтверждённых цен", metal: "silver" },
    175: { t: "Знаток района",    s: "175 подтверждённых цен", metal: "gold"   },
    275: { t: "Хранитель карты",  s: "275 подтверждённых цен", metal: "gold"   },
    400: { t: "Ветеран копеек",   s: "400 подтверждённых цен", metal: "gold"   },
    550: { t: "Легенда НищеMap",  s: "550 подтверждённых цен", metal: "legend" },
  };
  function trophySvg(places, size) {
    var img = (window.NISHEMAP_TROPHY_IMG || {})[String(places)];
    if (img) return '<img class="trophy-img" src="' + img + '" style="width:' + (size||44) + 'px;height:' + (size||44) + 'px" alt="">';
    return badgeHtml("t" + places, size);
  }
  function earnedTrophies() {
    var v = verifiedCount();
    return Object.keys(TROPHIES).map(Number).sort(function (a, b) { return a - b; })
      .filter(function (p) { return v >= p; });
  }

  var MILESTONES = [
    { places: 10,  bonus: 5 },
    { places: 25,  bonus: 10 },
    { places: 50,  bonus: 15 },
    { places: 100, bonus: 25 },
    { places: 175, bonus: 40 },
    { places: 275, bonus: 60 },
    { places: 400, bonus: 90 },
    { places: 550, bonus: 150 },
  ];
  function bonusFor(verified) {
    var b = 0;
    MILESTONES.forEach(function (m) { if (verified >= m.places) b += m.bonus; });
    return b;
  }
  function nextMilestone(verified) {
    for (var i = 0; i < MILESTONES.length; i++) if (MILESTONES[i].places > verified) return MILESTONES[i];
    return null;
  }

  /* Состав берём из assets/avatars.js — он собирается из сгенерированной графики.
     Гопник, дворник, хоккеист, фигуристка и балерина отложены до следующей партии. */
  var AVMETA = window.NISHEMAP_AVMETA || [];
  var AVIMG  = window.NISHEMAP_AVATARS || {};
  var AVBG   = window.NISHEMAP_AVBG || {};
  var AVATARS = AVMETA.map(function (m) {
    return { id: m.id, t: m.t, price: m.p, bg: m.bg, sex: m.s, d: "" };
  });
  var BADGES = window.NISHEMAP_BADGES || {};
  function badgeHtml(key, size) {
    var s = size || 28, svg = BADGES[key];
    if (!svg) return '<span class="badge-miss" style="width:' + s + 'px;height:' + s + 'px"></span>';
    return '<span class="badge-wrap" style="width:' + s + 'px;height:' + s + 'px">' + svg + "</span>";
  }
  /* Аватар = вырезанный персонаж на своём фоне, всё в круге. */
  function avatarSvg(id, size) {
    var s = size || 28, m = AVMETA.filter(function (x) { return x.id === id; })[0];
    if (!m || !AVIMG[id]) return badgeHtml(id, s);
    return '<span class="av" style="width:' + s + 'px;height:' + s + 'px' +
      (AVBG[m.bg] ? ';background-image:url(' + AVBG[m.bg] + ')' : '') + '">' +
      '<img src="' + AVIMG[id] + '" alt=""></span>';
  }
  function myAvatar() { return localStorage.getItem("nishemap.avatar") || ""; }
  function ownedAvatars() {
    try { return JSON.parse(localStorage.getItem("nishemap.owned")) || []; } catch (e) { return []; }
  }
  function ownsAvatar(id) {
    var a = AVATARS.filter(function (x) { return x.id === id; })[0];
    return !a || !a.price || ownedAvatars().indexOf(id) !== -1;
  }
  function coinsSpent() {
    return ownedAvatars().reduce(function (s, id) {
      var a = AVATARS.filter(function (x) { return x.id === id; })[0];
      return s + (a ? a.price : 0);
    }, 0);
  }
  /* звание считаем по ЗАРАБОТАННЫМ за всё время, покупки его не сбивают */
  function coinsBalance() { return Math.max(0, myCoins() - coinsSpent()); }
  function buyAvatar(id) {
    var a = AVATARS.filter(function (x) { return x.id === id; })[0];
    if (!a || !a.price || ownsAvatar(id)) return false;
    if (coinsBalance() < a.price) return false;
    var own = ownedAvatars(); own.push(id);
    localStorage.setItem("nishemap.owned", JSON.stringify(own));
    return true;
  }
  function avatarTitle(id) {
    var a = AVATARS.filter(function (x) { return x.id === id; })[0];
    return a ? a.t : "";
  }

  var RANKS = [
    { n: 0,  t: "прохожий" },
    { n: 1,  t: "стажёр" },
    { n: 3,  t: "медяк района" },
    { n: 10, t: "серебро района" },
    { n: 25, t: "золотой нищеброд" },
  ];
  function myCount() { return parseInt(localStorage.getItem("nishemap.mine") || "0", 10); }
  function rankFor(n) {
    var r = RANKS[0];
    RANKS.forEach(function (x) { if (n >= x.n) r = x; });
    return r;
  }
  function nextRank(n) {
    for (var i = 0; i < RANKS.length; i++) if (RANKS[i].n > n) return RANKS[i];
    return null;
  }
  function paintRank() {
    var el0 = document.getElementById("rank");
    if (!el0) return;
    var coins = coinsBalance(), me = myAvatar() || (AVATARS[0] && AVATARS[0].id);
    el0.hidden = false;                       /* показываем всегда: это вход в лавку */
    el0.innerHTML =
      '<span class="rank-av">' + avatarSvg(me, 44) + '</span>' +
      '<span class="rank-coins"><b>' + coins + '</b><i>монет</i></span>';
    el0.title = "Твой аватар и монеты. Нажми, чтобы сменить аватар.";
  }

  function coordsFromLink(s) {
    if (!s) return null;
    var m = s.match(/[?&]ll=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/); // Яндекс: ll=lon,lat
    if (m) return [parseFloat(m[2]), parseFloat(m[1])];
    m = s.match(/(-?\d{2}\.\d{4,})[,\s]+(-?\d{2}\.\d{4,})/);      // просто «55.78, 37.63»
    if (m) {
      var a = parseFloat(m[1]), b = parseFloat(m[2]);
      return a > 50 ? [a, b] : [b, a];
    }
    return null;
  }

  function distM(a, b, c, d) { // грубое расстояние в метрах
    var x = (c - a) * 111320, y = (d - b) * 63000;
    return Math.sqrt(x * x + y * y);
  }
  function fmtDist(m) { return m < 950 ? Math.round(m / 10) * 10 + " м" : (m / 1000).toFixed(1) + " км"; }
  function toast(text) {
    var t = el("div", "toast", esc(text));
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* объясняем, зачем монеты — прямо в интерфейсе */
  var rankBtn = document.getElementById("rank");
  /* Нажатие на круг с аватаром открывает ЛАВКУ — так и просили.
     Разбор монет переехал внутрь лавки: раньше он вылезал отдельной панелью,
     у которой не было стилей, и в телеграме её выносило за экран. */
  if (rankBtn) rankBtn.addEventListener("click", function () { openShop(); });

  function coinsBreakdownHtml() {
    var b = coinBreakdown(), st = streakState(), nx = nextMilestone(verifiedCount());
    return '<details class="coins-info"><summary>Откуда берутся монеты</summary>' +
      "<p>Монета приходит, когда район подтвердит твою цену. Заработано: <b>" + myCoins() +
      "</b>, на руках: <b>" + coinsBalance() + "</b>.</p><ul>" +
      "<li>Позиции: <b>" + b.items + "</b> <span>(до 3 с одного места)</span></li>" +
      "<li>Новые заведения: <b>" + b.venues + "</b> <span>(+2 за первую цену в месте)</span></li>" +
      "<li>Фото меню: <b>" + b.photos + "</b> <span>(+1 за место)</span></li>" +
      "<li>Новые станции: <b>" + b.districts + "</b> <span>(+10 за станцию без цен)</span></li>" +
      "<li>Серия: <b>" + b.streak + "</b> · недель подряд: " + st.weeks +
        " · на этой неделе " + st.thisWeek + " из " + STREAK_NEED + "</li>" +
      (nx ? "<li>До вехи «" + nx.places + " позиций»: ещё <b>" + (nx.places - verifiedCount()) +
        "</b> (+" + nx.bonus + ")</li>" : "") + "</ul></details>";
  }

  /* плитка для шеринга: рисуем на canvas, чтобы можно было кинуть картинкой в чат */
  function shareTrophy(places) {
    var tr = TROPHIES[places];
    if (!tr) return;
    var W = 1080, c = document.createElement("canvas");
    c.width = W; c.height = W;
    var x = c.getContext("2d");

    // фон и рамка
    x.fillStyle = "#232323"; x.fillRect(0, 0, W, W);
    var g = x.createRadialGradient(W / 2, 430, 40, W / 2, 430, 620);
    g.addColorStop(0, "rgba(242,207,92,.16)"); g.addColorStop(1, "rgba(242,207,92,0)");
    x.fillStyle = g; x.fillRect(0, 0, W, W);
    x.strokeStyle = "#d9a514"; x.lineWidth = 3;
    x.strokeRect(34, 34, W - 68, W - 68);
    x.strokeStyle = "rgba(217,165,20,.35)"; x.lineWidth = 1;
    x.strokeRect(46, 46, W - 92, W - 92);
    x.fillStyle = "#ad2f26"; x.fillRect(34, 34, W - 68, 12);

    // логотип-монета + слово
    var lx = W / 2 - 168, ly = 128;
    var cg = x.createRadialGradient(lx - 6, ly - 8, 4, lx, ly, 40);
    cg.addColorStop(0, "#f2cf5c"); cg.addColorStop(.62, "#d9a514"); cg.addColorStop(1, "#a37c0a");
    x.beginPath(); x.arc(lx, ly, 34, 0, 6.2832); x.fillStyle = cg; x.fill();
    x.lineWidth = 3; x.strokeStyle = "#f7e6b0"; x.stroke();
    x.fillStyle = "#6e5104"; x.font = "700 38px Menlo, monospace";
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText("₽", lx, ly + 2);
    x.textBaseline = "alphabetic";
    x.textAlign = "left";
    x.font = '600 60px Oswald, "Arial Narrow", Impact, sans-serif';
    x.fillStyle = "#e0564a"; x.fillText("НИЩЕ", lx + 48, ly + 20);
    var wNishe = x.measureText("НИЩЕ").width;
    x.fillStyle = "#fdfdfb"; x.fillText("MAP", lx + 48 + wNishe, ly + 20);

    x.textAlign = "center";
    x.fillStyle = "#b3b1aa"; x.font = '26px -apple-system, Arial, sans-serif';
    x.fillText("карта еды до 500 ₽ в Москве", W / 2, 186);

    var img = new Image();
    img.onload = function () {
      x.drawImage(img, (W - 300) / 2, 210, 300, 549);   // медаль 200×366, пропорция сохранена
      // подпись трофея
      x.fillStyle = "#f2cf5c";
      x.font = '600 72px Oswald, "Arial Narrow", Impact, sans-serif';
      x.fillText(tr.t.toUpperCase(), W / 2, 812);
      x.strokeStyle = "rgba(217,165,20,.5)"; x.lineWidth = 2;
      x.beginPath(); x.moveTo(W / 2 - 150, 838); x.lineTo(W / 2 + 150, 838); x.stroke();
      x.fillStyle = "#fdfdfb"; x.font = '36px -apple-system, Arial, sans-serif';
      x.fillText(tr.s, W / 2, 890);
      x.fillStyle = "#8f8b84"; x.font = '26px -apple-system, Arial, sans-serif';
      x.fillText("единственная карта еды, которая нужна в Москве", W / 2, 936);
      x.fillStyle = "#d9a514"; x.font = '28px Menlo, monospace';
      x.fillText("t.me/nishemap_bot/map", W / 2, 1000);

      c.toBlob(function (blob) {
        if (!blob) return;
        var file = new File([blob], "nishemap-trophy.png", { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], text: tr.t + " — " + tr.s + " на НищеMap" }).catch(function () {});
        } else {
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "nishemap-" + places + ".png";
          a.click();
          toast("Плитка сохранена — кидай в чат");
        }
      }, "image/png");
    };
    img.onerror = function () { toast("Не получилось нарисовать плитку"); };
    img.src = "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent((BADGES["t" + places] || "").replace(' class="badge-svg"', ""));
  }


  /* ---------- награды: одна точка входа, разное движение по типу ---------- */
  /* Настоящая монета, а не значок: гурт, кант, рельефный рубль. Две грани — середина оборота не пустая. */
  var COIN_SVG = (function () {
    var mill = "";
    for (var i = 0; i < 60; i++) {
      var a = i * 6 * Math.PI / 180;
      mill += '<rect x="98.2" y="2" width="3.6" height="9" rx="1.4" fill="#8a6a1e"' +
              ' transform="rotate(' + (i * 6) + ' 100 100)"/>';
    }
    var base =
      '<defs>' +
      '<radialGradient id="cg" cx="36%" cy="28%" r="78%">' +
        '<stop offset="0" stop-color="#ffe9a8"/><stop offset="46%" stop-color="#e8b93c"/>' +
        '<stop offset="100%" stop-color="#a97c16"/></radialGradient>' +
      '<linearGradient id="cr" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#fff2c8"/><stop offset="100%" stop-color="#c9971f"/></linearGradient>' +
      '</defs>' +
      '<circle cx="100" cy="100" r="98" fill="#a97c16"/>' + mill +
      '<circle cx="100" cy="100" r="91" fill="url(#cg)"/>' +
      '<circle cx="100" cy="100" r="82" fill="none" stroke="url(#cr)" stroke-width="5"/>' +
      '<circle cx="100" cy="100" r="74" fill="none" stroke="#b98d20" stroke-width="2" opacity=".7"/>' +
      '<path d="M42 62 A76 76 0 0 1 118 34" fill="none" stroke="#fff6d8" stroke-width="7"' +
      ' stroke-linecap="round" opacity=".65"/>';
    var ruble =
      '<g fill="#8a6a1e" opacity=".45" transform="translate(3,4)">' +
      '<path d="M74 44h34a30 30 0 0 1 0 60H92v14h26v13H92v20H74v-20H58v-13h16v-14H58V90h16Zm18 47h16a17 17 0 0 0 0-34H92Z"/></g>' +
      '<g fill="#7a5a12">' +
      '<path d="M74 44h34a30 30 0 0 1 0 60H92v14h26v13H92v20H74v-20H58v-13h16v-14H58V90h16Zm18 47h16a17 17 0 0 0 0-34H92Z"/></g>';
    var star = function (cx, cy, r) {
      var d = "";
      for (var i = 0; i < 10; i++) {
        var an = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r;
        d += (i ? "L" : "M") + (cx + Math.cos(an) * rr).toFixed(1) + " " + (cy + Math.sin(an) * rr).toFixed(1);
      }
      return '<path d="' + d + 'Z" fill="#7a5a12"/>';
    };
    var wrap = function (inner) {
      return '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
             base + inner + "</svg>";
    };
    return {
      face: wrap(ruble + star(100, 172, 9)),
      back: wrap('<text x="100" y="118" text-anchor="middle" font-family="Oswald,Impact,sans-serif"' +
                 ' font-size="74" font-weight="700" fill="#7a5a12">1</text>' +
                 '<text x="100" y="150" text-anchor="middle" font-family="Oswald,Impact,sans-serif"' +
                 ' font-size="19" letter-spacing="3" fill="#8a6a1e">МОНЕТА</text>' +
                 star(100, 54, 12)),
    };
  })();

  /* Веер лучей как SVG-картинка: conic-gradient на весь экран рассыпается на ступеньки. */
  function rayImage(col, n, op) {
    var g = "", i, a, b, R = 100, w = Math.PI / n * 0.42;
    for (i = 0; i < n; i++) {
      a = i * 2 * Math.PI / n;
      b = "";
      b += "M0 0 L" + (Math.cos(a - w) * R).toFixed(2) + " " + (Math.sin(a - w) * R).toFixed(2);
      b += " L" + (Math.cos(a + w) * R).toFixed(2) + " " + (Math.sin(a + w) * R).toFixed(2) + "Z";
      g += '<path d="' + b + '"/>';
    }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200">'
            + '<g fill="' + col + '" fill-opacity="' + op + '">' + g + "</g></svg>";
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }

  function fx(parent, cls, styles, delay) {
    var n = el("span", cls);
    Object.keys(styles || {}).forEach(function (k) { n.style.setProperty(k, styles[k]); });
    if (delay) n.style.animationDelay = delay + "ms";
    parent.appendChild(n);
    return n;
  }
  function hapt(kind, delay) {
    setTimeout(function () {
      if (!TG || !TG.HapticFeedback) return;
      try {
        if (kind === "success") TG.HapticFeedback.notificationOccurred("success");
        else TG.HapticFeedback.impactOccurred(kind);
      } catch (e) {}
    }, delay || 0);
  }
  /* тень вешаем только после приземления: filter в движении = перерисовка каждого кадра */
  function shadowAfter(node) {
    node.addEventListener("animationend", function () { node.classList.add("is-done"); }, { once: true });
  }
  function autoClose(wrap, hold) {
    setTimeout(function () { wrap.classList.add("is-out"); }, hold);
    setTimeout(function () { wrap.remove(); }, hold + 300);
  }

  /* монета за подтверждённую цену */
  function coinCelebration(n) {
    var wrap = el("div", "coin-cheer");
    var arc = el("div", "coin-arc");
    arc.appendChild(el("div", "coin-face",
      "<span>" + COIN_SVG.face + "</span><span>" + COIN_SVG.back + "</span>"));
    wrap.appendChild(arc);
    wrap.appendChild(el("span", "coin-shadow"));
    wrap.appendChild(el("p", "coin-cheer-title", n > 1 ? "+" + n + " монеты" : "+1 монета"));
    wrap.appendChild(el("p", "coin-cheer-sub", "Твою цену подтвердил район"));
    document.body.appendChild(wrap);
    hapt("light", 0);          // бросок
    hapt("light", 1120);       // касание
    hapt("success", 1400);
    autoClose(wrap, 2500);
  }

  /* трофей: бронза катится, серебро всплывает с бликом, золото падает и бьёт */
  function showTrophy(places, bonus) {
    var tr = TROPHIES[places];
    if (!tr) return;
    var metal = tr.metal === "legend" ? "gold" : tr.metal;
    var wrap = el("div", "coin-cheer is-trophy" + (metal === "gold" ? " is-gold" : ""));
    /* в анимации — только диск: ленту показываем в коллекции наград */
    var art = el("div", "rw rw--" + metal, "<span>" + (BADGES["d" + places] || BADGES["t" + places] || "") + "</span>");
    art.style.width = "190px"; art.style.height = "190px";   /* диск квадратный — эффекты ложатся ровно */
    shadowAfter(art);
    wrap.appendChild(art);

    if (metal === "bronze") {
      fx(art, "dust", { left: "30%", top: "98%" }, 360);
      fx(art, "dust", { left: "70%", top: "99%" }, 560);
      hapt("light", 360); hapt("light", 560); hapt("success", 900);
    } else if (metal === "silver") {
      fx(wrap, "rays", { "--rimg": rayImage("#dfe4ea", 28, .12), "--rd": "800ms", "--rs2": "48s" }, 300);
      fx(art, "sweep", { "--swd": "760ms", "--rs": "210px" });
      fx(art, "ring", { "border-color": "var(--silver-hi)", "--rs": "200px" }, 620);
      fx(art, "ring", { "border-color": "var(--silver-hi)", "--rs": "200px" }, 780);
      for (var sp = 0; sp < 6; sp++) {
        var sa = -Math.PI / 2 + (sp - 2.5) * .42;
        fx(art, "spark", { "--sx": (Math.cos(sa) * 140).toFixed(0) + "px",
                           "--sy": (Math.sin(sa) * 140).toFixed(0) + "px" }, 700 + sp * 45);
      }
      hapt("light", 260); hapt("medium", 620); hapt("success", 1000);
    } else {
      /* удар — 66 % от 2200 мс. Всё событие собирается ровно в этот кадр. */
      var HIT = 1452;
      fx(wrap, "rays", { "--rimg": rayImage("#f2cf5c", 30, .30), "--rd": "1000ms", "--rs2": "34s" }, 120);
      /* ветер сбоку: шесть полос в узком окне вокруг удара */
      for (var w = 0; w < 6; w++) {
        fx(wrap, "wind", {
          top: (28 + w * 8) + "%",
          "--ww": (52 + (w % 3) * 20) + "vw",
          "--wh": (w === 1 || w === 4 ? 8 : 4) + "px",
          "--wc": w % 2 ? "#fff" : "var(--gold-hi)",
        }, HIT - 90 + w * 26);
      }
      fx(art, "ring", { "--rs": "210px" }, HIT);
      fx(art, "ring", { "--rs": "210px" }, HIT + 150);
      fx(art, "dust", { left: "50%", top: "96%" }, HIT + 10);
      fx(art, "dust", { left: "24%", top: "92%" }, HIT + 50);
      fx(art, "dust", { left: "76%", top: "92%" }, HIT + 50);
      var fl = el("span", "flash");
      fl.style.animationDelay = HIT + "ms";
      document.body.appendChild(fl);
      setTimeout(function () { fl.remove(); }, HIT + 500);
      hapt("light", 300);
      hapt("heavy", HIT);
      hapt("rigid", HIT + 110);
      hapt("success", HIT + 420);
    }

    wrap.appendChild(el("p", "coin-cheer-title", esc(tr.t)));
    wrap.appendChild(el("p", "coin-cheer-sub", esc(tr.s) + (bonus ? " · +" + bonus + " монет" : "")));
    var share = el("button", "btn btn-primary", "Похвастаться");
    var later = el("button", "btn", "Потом");
    wrap.appendChild(share); wrap.appendChild(later);
    document.body.appendChild(wrap);
    later.addEventListener("click", function () { wrap.remove(); });
    share.addEventListener("click", function () { shareTrophy(places); });
  }

  /* покупка: монеты по дуге улетают к балансу — видно, что заплатил */
  function spendAnimation(fromEl, done) {
    var to = document.getElementById("rank");
    var a = fromEl && fromEl.getBoundingClientRect();
    var b = to && to.getBoundingClientRect();
    if (!a || !b) { done(); return; }
    var n = 6;
    for (var i = 0; i < n; i++) {
      (function (i) {
        var c = el("span", "coin-fly");
        c.style.left = (a.left + a.width / 2 + (i - n / 2) * 9) + "px";
        c.style.top = (a.top + a.height / 2) + "px";
        c.style.setProperty("--dx", (b.left + b.width / 2 - a.left - a.width / 2 - (i - n / 2) * 9) + "px");
        c.style.setProperty("--dy", (b.top + b.height / 2 - a.top - a.height / 2) + "px");
        c.style.animationDelay = (i * 55) + "ms";
        document.body.appendChild(c);
        setTimeout(function () { c.remove(); }, 560 + i * 55);
        hapt("light", i * 55);
      })(i);
    }
    setTimeout(done, 420);
  }

  /* выдача аватара: лучи, конфетти, подача с перелётом — за это отдали монеты */
  var CONF = ["#f2cf5c", "#e8b93c", "#ffffff", "#c8492f", "#6d8299", "#e6c76a"];
  function revealAvatar(a) {
    var wrap = el("div", "coin-cheer is-buy");
    fx(wrap, "rays", { "--rimg": rayImage("#f2cf5c", 26, .22), "--rd": "600ms", "--rs2": "26s" }, 0);
    fx(wrap, "burst", {}, 180);
    var art = el("div", "rw rw--reveal", "<span>" + avatarSvg(a.id, 180) + "</span>");
    art.style.width = "180px"; art.style.height = "180px";
    art.style.animationDelay = "140ms";
    shadowAfter(art);
    wrap.appendChild(art);
    fx(art, "sweep", { "--swd": "820ms" });

    /* три источника: сверху дождём, слева и справа — залпом внутрь */
    var EMIT = [
      { l: 22,  t: -8,  ax: 0,  ay: 1,   n: 14, spread: 520 },   // сверху слева
      { l: 50,  t: -8,  ax: 0,  ay: 1,   n: 16, spread: 560 },   // сверху по центру
      { l: 78,  t: -8,  ax: 0,  ay: 1,   n: 14, spread: 520 },   // сверху справа
      { l: -6,  t: 22,  ax: 1,  ay: .3,  n: 12, spread: 300 },   // слева сверху
      { l: -6,  t: 58,  ax: 1,  ay: .1,  n: 10, spread: 300 },   // слева снизу
      { l: 106, t: 22,  ax: -1, ay: .3,  n: 12, spread: 300 },   // справа сверху
      { l: 106, t: 58,  ax: -1, ay: .1,  n: 10, spread: 300 },   // справа снизу
    ];
    var ci = 0;
    EMIT.forEach(function (e) {
      for (var i = 0; i < e.n; i++, ci++) {
        var sp = (i / e.n - .5) * 2;
        fx(wrap, "confetti", {
          "--cl": (e.l + sp * 6) + "%",
          "--ct": (e.t + Math.abs(sp) * 5) + "%",
          "--cc": CONF[ci % CONF.length],
          "--cx": (e.ax * (140 + Math.abs(sp) * e.spread) + sp * 90).toFixed(0) + "px",
          "--cy": (e.ay * (300 + Math.abs(sp) * 160) + 120).toFixed(0) + "px",
          "--cr": (300 + ci * 91) + "deg",
          "--cd": (2400 + (ci % 6) * 380) + "ms",
        }, 220 + (i % 7) * 70);
      }
    });
    for (var k = 0; k < 8; k++) {
      var an = (k / 8) * 6.2832;
      fx(wrap, "spark", { "--sx": Math.cos(an) * 120 + "px", "--sy": Math.sin(an) * 120 + "px" }, 620 + k * 35);
    }
    wrap.appendChild(el("p", "coin-cheer-title", esc(a.t)));
    wrap.appendChild(el("p", "coin-cheer-sub", "Твой. " + esc(a.d) + "."));
    var ok = el("button", "btn btn-primary", "Надеть");
    wrap.appendChild(ok);
    document.body.appendChild(wrap);
    ok.addEventListener("click", function () { wrap.classList.add("is-out"); setTimeout(function () { wrap.remove(); }, 300); });
    hapt("medium", 300);
    hapt("rigid", 480);        // момент прилёта
    hapt("success", 820);
    autoClose(wrap, 5600);
  }

  /* ---------- лавка аватаров ---------- */
  /* ---------- лавка: вкладки, уровни цветом, честные состояния карточек ---------- */
  var TIER_OF = function (p) { return p === 0 ? 0 : p < 200 ? 1 : p < 700 ? 2 : 3; };
  var TIER_META = [
    { t: "Бесплатные",      c: "#b9b1a1" },
    { t: "Бронза · 50–150", c: "#b87d3e" },
    { t: "Серебро · 225–650", c: "#8b98a5" },
    { t: "Золото · 900–1650", c: "#c9a23f" },
  ];
  var shopTab = "av";   // av | tr | coin

  function openShop() {
    var modal = document.getElementById("shop-modal");
    var body = document.getElementById("shop-body");
    var bal = coinsBalance();

    /* шапка: твой аватар крупно + баланс + до следующей покупки */
    var me = myAvatar() || (AVATARS[0] && AVATARS[0].id);
    var next = AVATARS.filter(function (a) { return a.price > 0 && !ownsAvatar(a.id) && a.price > bal; })
                      .sort(function (x, y) { return x.price - y.price; })[0];
    document.getElementById("shop-balance").innerHTML =
      '<span class="shop-me">' + avatarSvg(me, 56) + "</span>" +
      '<span class="shop-bal"><b>' + bal + '</b><i>монет на руках</i>' +
      (next ? '<u>до «' + esc(next.t) + '»: ещё ' + (next.price - bal) + "</u>" : "") + "</span>";

    /* вкладки */
    var tabs = el("div", "shop-tabs");
    [["av", "Аватары"], ["tr", "Трофеи"], ["coin", "Монеты"]].forEach(function (t) {
      var b2 = el("button", "shop-tab" + (shopTab === t[0] ? " is-on" : ""), t[1]);
      b2.type = "button";
      b2.addEventListener("click", function () { shopTab = t[0]; openShop(); });
      tabs.appendChild(b2);
    });
    body.innerHTML = "";
    body.appendChild(tabs);

    if (shopTab === "tr") {
      var got = earnedTrophies(), allT = Object.keys(TROPHIES).map(Number).sort(function (x, y) { return x - y; });
      var tw = el("div", "");
      tw.innerHTML = '<p class="shop-hint">Собрано ' + got.length + " из " + allT.length +
        ". Нажми на свой трофей, чтобы похвастаться.</p>";
      var trow = el("div", "trophy-row");
      allT.forEach(function (p) {
        var has = got.indexOf(p) !== -1;
        var b3 = el("button", "trophy-cell" + (has ? "" : " is-locked"));
        b3.type = "button";
        b3.innerHTML = trophySvg(p, 76) + "<span>" + esc(TROPHIES[p].t) + "</span>";
        b3.title = TROPHIES[p].s;
        if (has) b3.addEventListener("click", function () { shareTrophy(p); });
        trow.appendChild(b3);
      });
      tw.appendChild(trow);
      body.appendChild(tw);
    } else if (shopTab === "coin") {
      if (bal === 0 && myCoins() === 0)
        body.appendChild(el("p", "shop-hint",
          "Монет пока нет. Самый быстрый способ: сдай точку <b>с фото меню</b> — такая цена " +
          "считается проверенной сразу. Это +1 монета."));
      var ci = el("div", ""); ci.innerHTML = coinsBreakdownHtml();
      var det = ci.querySelector("details"); if (det) det.open = true;
      body.appendChild(ci);
    } else {
      /* аватары по уровням; пары м/ж стоят рядом сами (порядок AVMETA) */
      TIER_META.forEach(function (tm, ti) {
        var list = AVATARS.filter(function (a) { return TIER_OF(a.price) === ti; });
        if (!list.length) return;
        var h = el("h3", "shop-group");
        h.innerHTML = '<span class="tier-dot" style="background:' + tm.c + '"></span>' + tm.t;
        body.appendChild(h);
        var grid = el("div", "shop-grid");
        list.forEach(function (a) {
          var owned = ownsAvatar(a.id), active = myAvatar() === a.id, can = bal >= a.price;
          var card = el("button", "shop-card" +
            (active ? " is-active" : "") + (!owned && !can ? " is-locked" : ""));
          card.type = "button";
          card.style.setProperty("--tier", tm.c);
          card.innerHTML =
            '<span class="shop-av">' + avatarSvg(a.id, 64) + "</span>" +
            '<span class="shop-name">' + esc(a.t) + (a.sex ? ' <em>' + a.sex + "</em>" : "") + "</span>" +
            '<span class="shop-tag">' +
              (active ? "✓ надет" : owned ? "выбрать" :
               can && a.price ? '<span class="coin coin--gold"></span>' + a.price :
               a.price ? "ещё " + (a.price - bal) + " монет" : "выбрать") + "</span>";
          card.addEventListener("click", function () {
            if (owned || !a.price) {
              localStorage.setItem("nishemap.avatar", a.id);
              paintRank(); openShop();
              return;
            }
            if (!can) { toast("Не хватает " + (a.price - bal) + " монет. Сдавай цены — район подтвердит."); return; }
            if (buyAvatar(a.id)) {
              localStorage.setItem("nishemap.avatar", a.id);
              paintRank(); openShop();
              spendAnimation(card, function () { revealAvatar(a); });
            }
          });
          grid.appendChild(card);
        });
        body.appendChild(grid);
      });
    }
    modal.hidden = false; backdrop.hidden = false;
  }
  document.querySelectorAll("[data-close-shop]").forEach(function (b) {
    b.addEventListener("click", function () {
      document.getElementById("shop-modal").hidden = true;
      if (sheet.hidden && formModal.hidden) backdrop.hidden = true;
    });
  });

  /* ---------- «О карте» ---------- */
  var aboutModal = document.getElementById("about-modal");
  var aboutBtn = document.getElementById("about-btn");
  /* «?» работает как переключатель: нажал — открыл, нажал ещё раз — вернулся к карте */
  function closeAbout() {
    aboutModal.hidden = true;
    aboutBtn && aboutBtn.setAttribute("aria-expanded", "false");
    if (sheet.hidden && formModal.hidden) backdrop.hidden = true;
  }
  if (aboutBtn) {
    aboutBtn.setAttribute("aria-expanded", "false");
    aboutBtn.addEventListener("click", function () {
      if (!aboutModal.hidden) { closeAbout(); return; }
      aboutModal.hidden = false; backdrop.hidden = false;
      aboutBtn.setAttribute("aria-expanded", "true");
      var card = aboutModal.querySelector(".modal-card");
      if (card) card.scrollTop = 0;
    });
  }
  document.querySelectorAll("[data-close-about]").forEach(function (b) {
    b.addEventListener("click", closeAbout);
  });
  /* тап по затемнению рядом с окном тоже возвращает на карту */
  aboutModal.addEventListener("click", function (e) {
    if (e.target === aboutModal) closeAbout();
  });

  /* ---------- band chips ---------- */
  document.querySelectorAll(".chip[data-band]").forEach(function (chip) {
    chip.addEventListener("click", function () {
      var b = chip.dataset.band;
      state.bands[b] = !state.bands[b];
      chip.classList.toggle("is-on", state.bands[b]);
      chip.setAttribute("aria-pressed", String(state.bands[b]));
      render();
    });
  });

  var nearChip = document.querySelector("[data-near]");
  if (nearChip) nearChip.addEventListener("click", function () {
    if (state.near) { // выключаем
      state.near = false; nearChip.classList.remove("is-on");
      nearChip.setAttribute("aria-pressed", "false"); render(); return;
    }
    if (!navigator.geolocation) { toast("Геолокация недоступна"); return; }
    nearChip.textContent = "ищу…";
    navigator.geolocation.getCurrentPosition(function (p) {
      state.pos = [p.coords.latitude, p.coords.longitude];
      state.near = true;
      nearChip.innerHTML = '<span class="near-dot"></span>рядом';
      nearChip.classList.add("is-on");
      nearChip.setAttribute("aria-pressed", "true");
      if (state.map) state.map.setCenter(state.pos, Math.max(state.map.getZoom(), 15));
      render();
    }, function () {
      nearChip.innerHTML = '<span class="near-dot"></span>рядом';
      toast("Не даёшь геолокацию — не покажу, что рядом");
    }, { timeout: 8000, maximumAge: 60000 });
  });

  var okChip = document.querySelector("[data-verified]");
  if (okChip) okChip.addEventListener("click", function () {
    state.onlyVerified = !state.onlyVerified;
    okChip.classList.toggle("is-on", state.onlyVerified);
    okChip.setAttribute("aria-pressed", String(state.onlyVerified));
    render();
  });

  var grayChip = document.querySelector("[data-gray]");
  if (grayChip) grayChip.addEventListener("click", function () {
    state.showGray = !state.showGray;
    grayChip.classList.toggle("is-on", state.showGray);
    grayChip.setAttribute("aria-pressed", String(state.showGray));
    render();
  });

  /* ---------- search / category / district filters ---------- */
  var qInput = document.getElementById("q");
  var catSel = document.getElementById("f-category");
  var distPanel = document.getElementById("district-panel");
  var distToggle = document.getElementById("district-toggle");

  qInput.addEventListener("input", function () {
    state.query = qInput.value;
    render();
  });
  catSel.addEventListener("change", function () {
    state.category = catSel.value;
    catSel.classList.toggle("is-active", !!catSel.value);
    render();
  });
  distToggle.addEventListener("click", function () {
    var open = distToggle.parentElement.classList.toggle("is-open");
    distToggle.setAttribute("aria-expanded", String(open));
  });

  function updateDistToggle() {
    var n = Object.keys(state.districts).filter(function (k) { return state.districts[k]; }).length;
    distToggle.textContent = n ? "Метро · " + n : "Метро";
  }

  (function populateDistricts() {
    var counts = {};
    SEED.venues.forEach(function (v) {
      if (v.district) counts[v.district] = (counts[v.district] || 0) + v.items.length;
    });
    var names = STATIONS.map(function (s) { return s[0]; });
    Object.keys(counts).forEach(function (d) { if (names.indexOf(d) === -1) names.push(d); });
    names.sort(function (a, b) { return (counts[b] || 0) - (counts[a] || 0) || a.localeCompare(b, "ru"); });
    names.forEach(function (name) {
      var n = counts[name] || 0;
      var lab = el("label", "district-opt" + (n ? "" : " is-empty"));
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = name;
      cb.addEventListener("change", function () {
        state.districts[name] = cb.checked;
        updateDistToggle();
        render();
      });
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(name));
      lab.appendChild(el("span", "district-count", n ? String(n) : "0"));
      distPanel.appendChild(lab);
    });
  })();

  /* ---------- list mode (no API key fallback) ---------- */
  var listEl = document.getElementById("list");
  var emptyEl = document.getElementById("empty");
  var fallbackEl = document.getElementById("map-fallback");

  function renderList() {
    listEl.innerHTML = "";
    var rows = [];
    visibleVenues().forEach(function (v) {
      venueItems(v).forEach(function (it) { rows.push({ v: v, it: it }); });
    });
    if (state.near && state.pos) {
      rows.forEach(function (r) {
        r.d = r.v.lat ? distM(state.pos[0], state.pos[1], r.v.lat, r.v.lon) : 1e9;
      });
      rows.sort(function (a, b) { return a.d - b.d; }); // сначала ближайшее
    } else {
      rows.sort(function (a, b) { return a.it.price - b.it.price; }); // дешёвое сверху
    }
    rows.forEach(function (row) {
      var v = row.v, it = row.it;
      (function () {
        var b = bandOf(it.price);
        var fb = freshBadge(it);
        var li = el("li", "card");
        li.tabIndex = 0;
        li.setAttribute("role", "button");
        li.innerHTML =
          '<div class="card-top"><span class="card-item">' + esc(it.item) + "</span>" +
          '<span class="price price--' + b + '">' + esc(it.price) + ' ₽</span></div>' +
          '<div class="card-venue">' + (row.d !== undefined && row.d < 1e9 ? '<span class="dist">' + fmtDist(row.d) + "</span> · " : "") +
          esc(v.name) + " · " + esc(v.type) +
          (v.district ? " · " + esc(v.district) : "") + " · " + esc(v.address) + "</div>" +
          '<div class="fresh"><span class="badge ' + fb.cls + '">' + fb.text + "</span>" +
          '<button class="reconfirm" data-item="' + esc(it.id) + '">Ещё по этой цене?</button></div>';
        li.addEventListener("click", function (e) {
          if (e.target.closest(".reconfirm")) return;
          openSheet(v);
        });
        li.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSheet(v); }
        });
        listEl.appendChild(li);
      })();
    });
  }

  /* one-tap reconfirm (event delegation: list + sheet) */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".reconfirm");
    if (!btn || btn.disabled) return;
    var id = btn.dataset.item;
    var c = confirms();
    c[id] = new Date().toISOString().slice(0, 10);
    localStorage.setItem(LS_CONFIRM, JSON.stringify(c));
    btn.disabled = true;
    btn.textContent = "Спасибо, зафиксировали";
    if (CFG.SUPABASE_URL) {
      fetch(CFG.SUPABASE_URL + "/rest/v1/confirms", {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": CFG.SUPABASE_ANON_KEY,
                   "Authorization": "Bearer " + CFG.SUPABASE_ANON_KEY, "Prefer": "return=minimal" },
        body: JSON.stringify({ item_id: id, device: deviceId() }),
      }).then(function () {
        (CONFIRMS[id] = CONFIRMS[id] || {})[deviceId()] = 1;
        var badge = btn.parentElement.querySelector(".badge");
        if (badge && isVerified(id)) { badge.textContent = "проверено народом"; badge.className = "badge is-fresh"; }
      }).catch(function () {});
    }
    var badge = btn.parentElement.querySelector(".badge");
    if (badge) { badge.textContent = "цена жива · проверено сегодня"; badge.className = "badge is-fresh"; }
  });

  /* фото позиции: скрытый инпут, метаданные копим до подключения базы */
  var photoInput = document.createElement("input");
  photoInput.type = "file";
  photoInput.accept = "image/*";
  photoInput.setAttribute("capture", "environment");   // на телефоне открывается камера, а не галерея
  photoInput.hidden = true;
  document.body.appendChild(photoInput);
  var photoTarget = null;
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".photo-add");
    if (!btn || btn.disabled) return;
    photoTarget = btn;
    photoInput.click();
  });
  /* дата съёмки из EXIF: скачанную из интернета картинку так не подсунуть */
  function exifShotTime(file) {
    return new Promise(function (resolve) {
      var r = new FileReader();
      r.onload = function () {
        try {
          var v = new DataView(r.result);
          if (v.getUint16(0) !== 0xFFD8) return resolve(null);      // не JPEG — пропускаем
          var off = 2, len = v.byteLength;
          while (off < len - 4) {
            if (v.getUint16(off) === 0xFFE1) {                       // APP1 = EXIF
              var s = "";
              for (var i = off + 4; i < Math.min(off + 4 + v.getUint16(off + 2), len); i++) {
                s += String.fromCharCode(v.getUint8(i));
              }
              var m = s.match(/(20\d\d):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/);
              if (m) return resolve(new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
              return resolve(null);
            }
            if (v.getUint8(off) !== 0xFF) break;
            off += 2 + v.getUint16(off + 2);
          }
        } catch (e) {}
        resolve(null);
      };
      r.onerror = function () { resolve(null); };
      r.readAsArrayBuffer(file.slice(0, 131072));
    });
  }

  photoInput.addEventListener("change", function () {
    if (!photoInput.files.length || !photoTarget) return;
    var file = photoInput.files[0], btn = photoTarget, itemId = btn.dataset.item;
    photoInput.value = "";
    if (file.size > 8 * 1024 * 1024) { toast("Фото тяжелее 8 МБ — сожми"); return; }
    if (!CFG.SUPABASE_URL) { toast("Загрузка фото ещё не включена"); return; }
    // у места уже есть свежее фото — второе не нужно ни карте, ни хранилищу
    var venueFresh = (state.activeVenue && (state.activeVenue.items || []).some(function (x) {
      return PHOTO_AT[x.id] && daysSinceISO(PHOTO_AT[x.id]) <= 7;
    }));
    if (venueFresh) {
      btn.disabled = false;
      toast("У этого места уже есть свежее фото меню. Спасибо, но хватит одного в неделю.");
      return;
    }
    btn.disabled = true; btn.textContent = "проверяю…";
    exifShotTime(file).then(function (shot) {
      if (shot && (Date.now() - shot.getTime()) > 24 * 3600 * 1000) {
        btn.disabled = false; btn.textContent = "📷 фото";
        toast("Это фото снято " + shot.toLocaleDateString("ru-RU") + ". Нужно сегодняшнее — сфотографируй меню на месте.");
        return;
      }
      uploadPhoto(file, btn, itemId);
    });
  });

  function uploadPhoto(file, btn, itemId) {
    btn.textContent = "гружу…";
    var path = "items/" + itemId + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) +
               (file.name.match(/\.[a-z0-9]+$/i) || [".jpg"])[0];
    fetch(CFG.SUPABASE_URL + "/storage/v1/object/menus/" + path, {
      method: "POST",
      headers: { "apikey": CFG.SUPABASE_ANON_KEY, "Authorization": "Bearer " + CFG.SUPABASE_ANON_KEY,
                 "Content-Type": file.type || "image/jpeg", "x-upsert": "true" },
      body: file,
    }).then(function (r) {
      if (!r.ok) throw new Error("upload " + r.status);
      var url = CFG.SUPABASE_URL + "/storage/v1/object/public/menus/" + path;
      return fetch(CFG.SUPABASE_URL + "/rest/v1/item_photos", {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": CFG.SUPABASE_ANON_KEY,
                   "Authorization": "Bearer " + CFG.SUPABASE_ANON_KEY, "Prefer": "return=minimal" },
        body: JSON.stringify({ item_id: itemId, photo_url: url }),
      });
    }).then(function () {
      btn.textContent = "фото принято"; toast("Спасибо! Фото ушло на карту");
    }).catch(function () {
      btn.disabled = false; btn.textContent = "📷 фото";
      toast("Фото не загрузилось — включи политику Storage");
    });
  }

  function showViewCount(v) {
    var box = document.getElementById("sheet-views");
    if (!box || !CFG.SUPABASE_URL) return;
    box.hidden = true;
    var key = (v.name + "|" + (v.address || "")).toLowerCase();
    fetch(CFG.SUPABASE_URL + "/rest/v1/rpc/venue_views", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, sbHeaders()),
      body: JSON.stringify({ vkey: key }),
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (n) {
        if (state.activeVenue !== v || !n || n < 3) return;   // не хвастаемся единицами
        box.textContent = "За неделю сюда заглядывали " + n + " раз";
        box.hidden = false;
      }).catch(function () {});
  }

  var VIEWED = {};
  function logView(v) {
    if (!CFG.SUPABASE_URL || !v || !v.name) return;
    var key = (v.name + "|" + (v.address || "")).toLowerCase();
    if (VIEWED[key]) return;           // один раз за сессию
    VIEWED[key] = 1;
    fetch(CFG.SUPABASE_URL + "/rest/v1/views", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": CFG.SUPABASE_ANON_KEY,
                 "Authorization": "Bearer " + CFG.SUPABASE_ANON_KEY, "Prefer": "return=minimal" },
      body: JSON.stringify({ venue_key: key, venue_name: v.name }),
    }).catch(function () {});
  }

  /* ---------- bottom sheet ---------- */
  var sheet = document.getElementById("sheet");
  var backdrop = document.getElementById("backdrop");

  function openSheet(v) {
    state.activeVenue = v;
    document.getElementById("sheet-venue").textContent = v.name;
    document.getElementById("sheet-type").textContent = v.type + (v.district ? " · " + v.district : (v.noPrice ? " · цены нет" : ""));
    if (!v.district && v.lat) {
      v.district = nearestStation(v.lat, v.lon);
      if (v.district)
        document.getElementById("sheet-type").textContent = v.type + " · м. " + v.district;
    }
    document.getElementById("sheet-address").textContent = v.address;
    var prices = (v.items || []).map(function (i) { return i.price; });
    var cheap = document.getElementById("sheet-cheapest");
    if (cheap) {
      cheap.textContent = prices.length
        ? "Самое дешёвое здесь: " + Math.min.apply(null, prices) + " ₽ · позиций: " + prices.length
        : "";
      cheap.hidden = !prices.length;
    }
    var link = document.getElementById("sheet-yandex");
    link.href = v.yandexUrl || "https://yandex.ru/maps/?text=" + encodeURIComponent(v.name + " " + v.address);

    var ul = document.getElementById("sheet-items");
    ul.innerHTML = "";
    var cta = document.getElementById("sheet-cta");
    if (cta) cta.remove();
    if (!v.items.length) {
      var box = el("div", "sheet-cta",
        "<p>Цены тут ещё никто не сдал. Знаешь, почём здесь еда?</p>" +
        '<button class="btn btn-primary" data-first>Стать первым</button>');
      box.id = "sheet-cta";
      ul.parentNode.insertBefore(box, ul);
      box.querySelector("[data-first]").addEventListener("click", function () {
        closeSheet();
        document.querySelector(".fab").click();
        var f = document.getElementById("submit-form").elements;
        f.venue.value = v.name;
        f.address.value = v.address && v.address !== v.district ? v.address : "";
        if (v.lat && v.lon) {                       // координаты уже известны из OSM
          state.formPos = [v.lat, v.lon];
          if (hereBtn) { hereBtn.textContent = "✓ точка на карте есть"; hereBtn.classList.add("is-on"); }
        }
        f.dish.focus();
      });
    }
    v.items.forEach(function (it) {
      var b = bandOf(it.price);
      var fb = freshBadge(it);
      var li = el("li", "sheet-item");
      li.innerHTML =
        '<div class="sheet-item-top"><span class="card-item">' + esc(it.item) + "</span>" +
        '<span class="price price--' + b + '">' + esc(it.price) + " ₽</span></div>" +
        '<div class="fresh"><span class="badge ' + fb.cls + '">' + fb.text + "</span>" +
        '<button class="reconfirm" data-item="' + esc(it.id) + '">Ещё по этой цене?</button>' +
        '<button class="photo-add" data-item="' + esc(it.id) + '" title="Меню/вывеска с ценами — или сама еда">📷 фото</button>' +
        '<button class="flag" data-item="' + esc(it.id) + '" title="Цена неверна или это не еда">неверно</button></div>' +
        (it.avatar ? '<div class="by-who">' + avatarSvg(it.avatar, 20) + "сдал " + esc(avatarTitle(it.avatar)) + "</div>" : "") +
        photosHtml(it.id);
      ul.appendChild(li);
    });

    sheet.hidden = false;
    backdrop.hidden = false;
    tgBack(true);
    logView(v);
    showViewCount(v);
    sheet.querySelector(".sheet-close").focus();
  }
  function tgBack(show) {
    if (!TG || !TG.BackButton) return;
    try { show ? TG.BackButton.show() : TG.BackButton.hide(); } catch (e) {}
  }
  function closeSheet() {
    sheet.hidden = true;
    if (formModal.hidden) backdrop.hidden = true;
    state.activeVenue = null;
    tgBack(false);
  }
  sheet.querySelector("[data-close-sheet]").addEventListener("click", closeSheet);

  document.getElementById("sheet-share").addEventListener("click", function () {
    var v = state.activeVenue; if (!v) return;
    var url = location.origin + location.pathname + "?v=" + encodeURIComponent(v.id);
    var text = v.name + " — НищеMap";
    if (navigator.share) { navigator.share({ title: text, url: url }).catch(function () {}); return; }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () { toast("Ссылка скопирована"); });
    } else { prompt("Ссылка:", url); }
  });

  /* жалоба на позицию: пишем в reports, если таблица есть; локально прячем в любом случае */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".flag"); if (!btn) return;
    var id = btn.dataset.item;
    if (CFG.SUPABASE_URL) {
      fetch(CFG.SUPABASE_URL + "/rest/v1/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": CFG.SUPABASE_ANON_KEY,
                   "Authorization": "Bearer " + CFG.SUPABASE_ANON_KEY, "Prefer": "return=minimal" },
        body: JSON.stringify({ item_id: id, reason: "user_flag" }),
      }).catch(function () {});
    }
    var hid; try { hid = JSON.parse(localStorage.getItem("nishemap.hidden")) || []; } catch (er) { hid = []; }
    if (hid.indexOf(id) === -1) hid.push(id);
    localStorage.setItem("nishemap.hidden", JSON.stringify(hid));
    btn.textContent = "спасибо";
    btn.disabled = true;
    toast("Отметили. Проверим.");
  });

  /* ---------- submission form ---------- */
  var formModal = document.getElementById("form-modal");
  var form = document.getElementById("submit-form");
  var formDone = document.getElementById("form-done");
  var formError = document.getElementById("form-error");

  var againBtn = document.getElementById("again-btn");
  if (againBtn) againBtn.addEventListener("click", function () {
    var v = state.lastVenue || {};
    form.hidden = false; formDone.hidden = true; formError.hidden = true;
    form.reset();
    form.elements.venue.value = v.venue || "";
    form.elements.address.value = v.address || "";
    state.formPos = v.pos || null;              // координаты сохраняем — мы всё ещё здесь
    if (hereBtn && state.formPos) { hereBtn.textContent = "✓ точка на карте есть"; hereBtn.classList.add("is-on"); }
    form.elements.dish.focus();
  });

  document.querySelectorAll("[data-open-form]").forEach(function (b) {
    b.addEventListener("click", function () {
      form.hidden = false;
      formDone.hidden = true;
      formError.hidden = true;
      form.reset();
      state.formPos = null;
      if (hereBtn) { hereBtn.textContent = "📍 я сейчас здесь"; hereBtn.classList.remove("is-on"); }
      formModal.hidden = false;
      backdrop.hidden = false;
      form.elements.dish.focus();
    });
  });
  function closeForm() {
    formModal.hidden = true;
    if (sheet.hidden) backdrop.hidden = true;
  }
  formModal.querySelectorAll("[data-close-form]").forEach(function (b) {
    b.addEventListener("click", closeForm);
  });

  var hereBtn = document.getElementById("here-btn");
  if (hereBtn) hereBtn.addEventListener("click", function () {
    if (!navigator.geolocation) { toast("Геолокация недоступна"); return; }
    hereBtn.textContent = "ловлю…";
    navigator.geolocation.getCurrentPosition(function (p) {
      state.formPos = [p.coords.latitude, p.coords.longitude];
      hereBtn.textContent = "✓ точка на карте есть";
      hereBtn.classList.add("is-on");
    }, function () { hereBtn.textContent = "📍 я сейчас здесь"; toast("Не дали геолокацию"); },
    { enableHighAccuracy: true, timeout: 8000 });
  });

  /* Клавиатуру прячем ТОЛЬКО по реальному жесту пальцем (touchmove).
     Слушать scroll нельзя: браузер сам скроллит поле в зону видимости при фокусе,
     обработчик тут же снимал фокус — и форма дёргалась «мини-перезагрузкой». */
  var lastFocus = 0;
  document.addEventListener("focusin", function () { lastFocus = Date.now(); }, true);
  document.querySelectorAll(".modal-card").forEach(function (card) {
    card.addEventListener("touchmove", function () {
      if (Date.now() - lastFocus < 400) return;   // авто-скролл к полю — не жест
      var a = document.activeElement;
      if (a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) a.blur();
    }, { passive: true });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = form.elements;
    var price = parseInt(f.price.value, 10);
    var ok = f.dish.value.trim() && f.venue.value.trim() && f.address.value.trim() &&
      price >= 1 && price <= 500;
    if (!ok) { formError.hidden = false; formError.textContent = "Цена до 500 ₽ и все поля — иначе никак."; return; }
    if (PRICE_CAP[f.category.value] && price > PRICE_CAP[f.category.value]) {
      formError.hidden = false;
      formError.textContent = "Напиток дороже " + PRICE_CAP[f.category.value] +
        " ₽ — это уже не по-нищебродски. Кофе за 300 живёт в других приложениях.";
      return;
    }
    // антиспам: такое блюдо здесь уже сдавали?
    var normV = f.venue.value.trim().toLowerCase().replace(/[«»"'ё]/g, function (c) { return c === "ё" ? "е" : ""; });
    var normD = f.dish.value.trim().toLowerCase().replace(/ё/g, "е");
    var dup = null;
    SEED.venues.forEach(function (v) {
      var vn = (v.name || "").toLowerCase().replace(/[«»"'ё]/g, function (c) { return c === "ё" ? "е" : ""; });
      if (vn.indexOf(normV) === -1 && normV.indexOf(vn) === -1) return;
      v.items.forEach(function (it) {
        if ((it.item || "").toLowerCase().replace(/ё/g, "е") === normD) dup = { v: v, it: it };
      });
    });
    if (dup && !state.dupOverride) {
      formError.hidden = false;
      formError.innerHTML = "«" + esc(dup.it.item) + "» в «" + esc(dup.v.name) + "» уже на карте за " + esc(dup.it.price) +
        " ₽. Лучше подтверди её — <button type='button' class='linklike' id='go-dup'>открыть</button>." +
        " Если цена изменилась — <button type='button' class='linklike' id='dup-anyway'>всё равно отправить</button>.";
      document.getElementById("go-dup").onclick = function () { closeForm(); openSheet(dup.v); };
      document.getElementById("dup-anyway").onclick = function () {
        state.dupOverride = true; formError.hidden = true;
        form.querySelector("[type=submit]").click();
      };
      return;
    }
    state.dupOverride = false;
    var linkPos = coordsFromLink(f.address.value);
    if (linkPos) state.formPos = linkPos;
    if (!state.formPos && !GEO_FIX[f.address.value.trim().toLowerCase()] && !/[а-яё]/i.test(f.address.value)) {
      formError.hidden = false;
      formError.textContent = "Адрес латиницей карта не найдёт. Напиши по-русски, нажми «я сейчас здесь» или вставь ссылку из Яндекс Карт.";
      return;
    }
    var record = {
      dish: f.dish.value.trim(),
      price: price,
      category: f.category.value,
      venue: f.venue.value.trim(),
      address: f.address.value.trim(),
    };
    // бэкенд подключён — шлём в общую копилку (вердикт совета: мгновенно, без очереди)
    if (CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY) {
      var withGeo = Object.assign({ device: deviceId() }, record);
      if (myAvatar()) withGeo.avatar = myAvatar();
      if (state.formPos) { withGeo.lat = state.formPos[0]; withGeo.lon = state.formPos[1]; }
      function post(body) {
        return fetch(CFG.SUPABASE_URL + "/rest/v1/submissions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": CFG.SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + CFG.SUPABASE_ANON_KEY,
            "Prefer": "return=minimal",
          },
          body: JSON.stringify(body),
        });
      }
      post(withGeo).then(function (r) {
        if (r.ok) return r;
        return r.clone().json().catch(function () { return {}; }).then(function (err) {
          var msg = (err && (err.message || err.hint)) || "";
          // сервер отбил по лимиту/правилу — это не повод пересылать, это повод сказать человеку
          if (/Слишком|перегружена|подтверждать нельзя|устройства/i.test(msg)) {
            formDone.hidden = true; form.hidden = false;
            formError.hidden = false; formError.textContent = msg;
            throw new Error("rejected");
          }
          return post(record);   // скорее всего колонки ещё нет — шлём без необязательных полей
        });
      }).then(function (resp) {
        if (resp && resp.ok) {
          markSent(entry.at);
          resp.clone().json().then(function (rows) {
            if (rows && rows[0] && rows[0].id) addMyItem("ui-" + rows[0].id);
          }).catch(function () {});
          var mine = submissionToVenues([{
            id: "local-" + Date.now(), dish: record.dish, price: record.price,
            category: record.category, venue: record.venue, address: record.address,
            submitted_at: new Date().toISOString(),
          }]);
          mine.forEach(function (v) { v.district = v.district || nearestStation(v.lat, v.lon); });
          SEED.venues = SEED.venues.concat(mine);
          render();
          geocodeQueue(mine, render);
        }
      }).catch(function () { /* оффлайн — хотя бы локально сохранится ниже */ });
    }
    var inbox;
    try { inbox = JSON.parse(localStorage.getItem(LS_INBOX)) || []; } catch (err) { inbox = []; }
    var entry = {
      item: f.dish.value.trim(),
      price: price,
      category: f.category.value,
      venue: f.venue.value.trim(),
      address: f.address.value.trim(),
      at: new Date().toISOString(),
      sent: false,
      body: state.formPos ? Object.assign({}, record, { lat: state.formPos[0], lon: state.formPos[1] }) : record,
    };
    inbox.push(entry);
    localStorage.setItem(LS_INBOX, JSON.stringify(inbox));
    markSent(entry.at); // если POST уже прошёл — пометит; иначе останется в очереди
    state.lastVenue = { venue: record.venue, address: record.address, pos: state.formPos };
    localStorage.setItem("nishemap.mine", String(myCount() + 1));
    paintRank();
    haptic("success");
    var n = myCount(), nx = nextRank(n), sub = document.getElementById("done-sub");
    if (sub) {
      sub.textContent = "Сдано тобой: " + n + ". Звание — «" + rankFor(n).t + "»." +
        (nx ? " До «" + nx.t + "» осталось " + (nx.n - n) + "." : " Выше только звёзды.");
    }
    form.hidden = true;
    formDone.hidden = false;
  });

  backdrop.addEventListener("click", function () {
    closeSheet(); closeForm(); aboutModal.hidden = true;
    document.getElementById("shop-modal").hidden = true;
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeSheet(); closeForm(); aboutModal.hidden = true;
      document.getElementById("shop-modal").hidden = true;
    }
  });

  /* ---------- map <-> list toggle ---------- */
  var viewToggle = document.getElementById("view-toggle");
  var mapEl = document.getElementById("map");

  viewToggle.addEventListener("click", function () {
    var toList = mapEl.hidden === false;
    mapEl.hidden = toList;
    fallbackEl.hidden = !toList;
    viewToggle.textContent = toList ? "Карта" : "Список";
    // в списке карте нечего подсказывать: прячем и подсказку, и выбор районов не трогаем
    var hint = document.getElementById("gray-hint");
    if (hint && toList) hint.hidden = true;
    document.getElementById("district-box").classList.toggle("in-list", toList);
    render();
    if (!toList && state.map) state.map.container.fitToViewport();
  });

  /* ---------- Yandex map (JS API 2.1) ---------- */
  function initMap() {
    var key = (CFG.YANDEX_API_KEY || "").trim();
    if (!key) { enterListMode(); return; }
    document.querySelector(".nokey-note").hidden = true; // ключ есть — баннер не нужен

    var s = document.createElement("script");
    s.src = "https://api-maps.yandex.ru/2.1/?apikey=" + encodeURIComponent(key) + "&lang=ru_RU";
    s.onerror = enterListMode;
    s.onload = function () {
      if (typeof ymaps === "undefined") { enterListMode(); return; }
      ymaps.ready(function () {
        try {
          state.map = new ymaps.Map("map", {
            center: CFG.CITY_CENTER, // [lat, lon]
            zoom: CFG.CITY_ZOOM,
            controls: ["zoomControl", "geolocationControl"],
          }, { suppressMapOpenBlock: true });
          renderMarkers();
          renderGray();
          var grayTimer = null;
          state.map.events.add("boundschange", function () {
            clearTimeout(grayTimer);
            grayTimer = setTimeout(renderGray, 220);   // ждём, пока человек домотает
          });
          viewToggle.hidden = false; // карта живая — можно переключаться
          document.getElementById("map-loading").hidden = true;
        } catch (err) { enterListMode(); }
      });
    };
    document.head.appendChild(s);
  }

  function enterListMode() {
    document.getElementById("map-loading").hidden = true;
    document.getElementById("map").hidden = true;
    fallbackEl.hidden = false;
    render();
  }

  /* координаты: из данных, из кеша, или геокодим адрес через JS API (один раз) */
  var GEO_LS = "nishemap.geo";
  var geoCache;
  try { geoCache = JSON.parse(localStorage.getItem(GEO_LS)) || {}; } catch (e) { geoCache = {}; }

  function ensureCoords(v, done) {
    if (v.lat && v.lon) return done([v.lat, v.lon]);
    if (geoCache[v.id]) return done(geoCache[v.id]);
    ymaps.geocode("Москва, " + v.address, { results: 1 }).then(function (res) {
      var o = res.geoObjects.get(0);
      if (!o) return;
      var c = o.geometry.getCoordinates();
      geoCache[v.id] = c;
      localStorage.setItem(GEO_LS, JSON.stringify(geoCache));
      done(c);
    });
  }

  function renderMarkers() {
    if (!state.map) return;
    var gen = (state.renderGen = (state.renderGen || 0) + 1);
    state.markers.forEach(function (m) { state.map.geoObjects.remove(m); });
    state.markers = [];
    visibleVenues().forEach(function (v) {
      var items = venueItems(v);
      var min = Math.min.apply(null, items.map(function (i) { return i.price; }));
      var band = bandOf(min);
      ensureCoords(v, function (coords) {
        if (gen !== state.renderGen) return; // фильтры сменились, пока геокодили
        var Layout = ymaps.templateLayoutFactory.createClass(
          '<div class="coinpin coinpin--' + band + '">' +
          '<span class="coinpin-coin">₽</span>' +
          '<span class="coinpin-price">от ' + min + "</span></div>"
        );
        var pm = new ymaps.Placemark(coords, {
          hintContent: esc(v.name),
        }, {
          iconLayout: Layout,
          // кликабельная зона — круг вокруг монеты (центр выше точки привязки)
          iconShape: { type: "Circle", coordinates: [0, -26], radius: 22 },
        });
        pm.events.add("click", function () { openSheet(v); });
        state.map.geoObjects.add(pm);
        state.markers.push(pm);
      });
    });
  }

  /* ---------- серые точки (OSM, без цен) ---------- */
  function visibleGray() {
    if (!state.showGray) return [];
    var sel = Object.keys(state.districts).filter(function (k) { return state.districts[k]; });
    return OSM.filter(function (v) { return !sel.length || !v.district || state.districts[v.district]; });
  }

  function renderGray() {
    if (!state.map || typeof ymaps === "undefined") return;
    state.grayMarkers.forEach(function (m) { state.map.geoObjects.remove(m); });
    state.grayMarkers = [];
    var hint = document.getElementById("gray-hint");
    var inList = document.getElementById("map").hidden;
    if (inList) { if (hint) hint.hidden = true; return; }
    var zoom = state.map.getZoom();
    if (!state.showGray || !OSM.length) { if (hint) hint.hidden = true; return; }
    if (zoom < GRAY_MIN_ZOOM) {
      if (hint) hint.hidden = false;
      return;
    }
    if (hint) hint.hidden = true;
    var Layout = ymaps.templateLayoutFactory.createClass('<div class="graypin"></div>');
    // рисуем только то, что реально видно в кадре — иначе 2700 меток кладут карту
    var b = state.map.getBounds(), lo = b[0], hi = b[1], shown = 0;
    visibleGray().filter(function (v) {
      return v.lat >= lo[0] && v.lat <= hi[0] && v.lon >= lo[1] && v.lon <= hi[1];
    }).slice(0, GRAY_MAX_ON_SCREEN).forEach(function (v) {
      var pm = new ymaps.Placemark([v.lat, v.lon], { hintContent: esc(v.name) + " · цены нет" }, {
        iconLayout: Layout,
        iconShape: { type: "Circle", coordinates: [0, 0], radius: 11 },
      });
      pm.events.add("click", function () { openSheet(v); });
      state.map.geoObjects.add(pm);
      state.grayMarkers.push(pm);
    });
  }

  /* ---------- render ---------- */
  function render() {
    var any = visibleVenues().length > 0;
    emptyEl.hidden = any;
    if (!fallbackEl.hidden) renderList();
    if (state.map) { renderMarkers(); renderGray(); }
  }

  /* ---------- очередь неотправленных точек (метро, подвал, нет сети) ---------- */
  function inboxAll() {
    try { return JSON.parse(localStorage.getItem(LS_INBOX)) || []; } catch (e) { return []; }
  }
  function markSent(at) {
    var arr = inboxAll();
    arr.forEach(function (x) { if (x.at === at) x.sent = true; });
    localStorage.setItem(LS_INBOX, JSON.stringify(arr));
  }
  function flushInbox() {
    if (!CFG.SUPABASE_URL) return;
    var pending = inboxAll().filter(function (x) { return x.sent === false && x.body; });
    if (!pending.length) return;
    var okCount = 0;
    (function step(i) {
      if (i >= pending.length) {
        if (okCount) { toast("Досдали " + okCount + " точек из очереди"); loadSubmissions(); }
        return;
      }
      var x = pending[i];
      fetch(CFG.SUPABASE_URL + "/rest/v1/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": CFG.SUPABASE_ANON_KEY,
                   "Authorization": "Bearer " + CFG.SUPABASE_ANON_KEY, "Prefer": "return=minimal" },
        body: JSON.stringify(x.body),
      }).then(function (r) {
        if (r.ok) { markSent(x.at); okCount++; }
        step(i + 1);
      }).catch(function () { step(i + 1); });
    })(0);
  }
  window.addEventListener("online", flushInbox);

  /* ---------- фото позиций ---------- */
  var PHOTOS = {}, PHOTO_AT = {};
  function loadPhotos() {
    if (!CFG.SUPABASE_URL) return;
    fetch(CFG.SUPABASE_URL + "/rest/v1/item_photos?select=item_id,photo_url,status,submitted_at&limit=1000", { headers: sbHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        if (!Array.isArray(rows)) return;
        rows.forEach(function (p) {
          if (p.status && p.status !== "live") return;
          (PHOTOS[p.item_id] = PHOTOS[p.item_id] || []).push(p.photo_url);
          if (p.submitted_at && (!PHOTO_AT[p.item_id] || p.submitted_at > PHOTO_AT[p.item_id])) PHOTO_AT[p.item_id] = p.submitted_at;
        });
        if (state.activeVenue) openSheet(state.activeVenue); // перерисовать открытую шторку
        render(); checkNewCoins();
      }).catch(function () {});
  }
  function safePhoto(u) {
    if (typeof u !== "string") return null;
    var ok = CFG.SUPABASE_URL && u.indexOf(CFG.SUPABASE_URL + "/storage/v1/object/public/menus/") === 0;
    return ok ? u : null;
  }
  function photosHtml(itemId) {
    var list = (PHOTOS[itemId] || []).map(safePhoto).filter(Boolean);
    if (!list.length) return "";
    return '<div class="photos">' + list.slice(0, 4).map(function (u) {
      return '<img src="' + esc(u) + '" alt="Фото меню или блюда" loading="lazy" data-full="' + esc(u) + '">';
    }).join("") + "</div>";
  }
  document.addEventListener("click", function (e) {
    var img = e.target.closest(".photos img");
    if (!img) return;
    var u = safePhoto(img.dataset.full);
    if (!u) return;
    // показываем внутри страницы картинкой: файл не рендерится как документ,
    // поэтому подсунутый SVG/HTML не выполнит скрипт и не изобразит фишинг-страницу
    var lb = el("div", "lightbox");
    var im = document.createElement("img");
    im.src = u;
    im.alt = "Фото меню или блюда";
    lb.appendChild(im);
    lb.addEventListener("click", function () { lb.remove(); });
    document.body.appendChild(lb);
  });

  function loadConfirms(done) {
    if (!CFG.SUPABASE_URL) { done && done(); return; }
    fetch(CFG.SUPABASE_URL + "/rest/v1/confirms?select=item_id,device,created_at&limit=5000", { headers: sbHeaders() })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        if (Array.isArray(rows)) rows.forEach(function (c) {
          (CONFIRMS[c.item_id] = CONFIRMS[c.item_id] || {})[c.device] = c.created_at || "";
        });
        done && done();
      }).catch(function () { done && done(); });
  }

  var COIN_ITEMS_PER_VENUE = 3;   // больше трёх позиций в одном месте монет не приносят
  /* находим наши проверенные позиции и группируем по заведению */
  function myVerifiedByVenue() {
    var mine = {}, ids = myItems();
    SEED.venues.forEach(function (v) {
      v.items.forEach(function (it) {
        if (ids.indexOf(it.id) === -1 || !isVerified(it.id)) return;
        var k = v.id || (v.name + "|" + v.address);
        (mine[k] = mine[k] || { venue: v, items: [] }).items.push(it);
      });
    });
    return mine;
  }
  function verifiedCount() {
    var g = myVerifiedByVenue(), n = 0;
    Object.keys(g).forEach(function (k) { n += g[k].items.length; });
    return n;
  }
  /* сколько монет принесла работа: позиции (до 3 на место) + первопроходство + фото + районы */
  function coinBreakdown() {
    var g = myVerifiedByVenue(), b = { items: 0, venues: 0, photos: 0, districts: 0, streak: streakCoins() };
    var seenDistricts = {};
    Object.keys(g).forEach(function (k) {
      var grp = g[k];
      b.items += Math.min(grp.items.length, COIN_ITEMS_PER_VENUE);
      // первая цена в заведении: до нас у места не было ни одной цены не от нас
      var otherPriced = (grp.venue.items || []).some(function (it) {
        return myItems().indexOf(it.id) === -1;
      });
      if (!otherPriced) b.venues += 2;
      if (grp.items.some(function (it) { return hasPhoto(it.id); })) b.photos += 1;
      var d = grp.venue.district;
      if (d && !seenDistricts[d]) {
        seenDistricts[d] = 1;
        var districtHadOthers = SEED.venues.some(function (v) {
          return v.district === d && (v.items || []).some(function (it) { return myItems().indexOf(it.id) === -1; });
        });
        if (!districtHadOthers) b.districts += 5;
      }
    });
    b.total = b.items + b.venues + b.photos + b.districts + b.streak;
    return b;
  }
  function myCoins() { var b = coinBreakdown(); return b.total + bonusFor(verifiedCount()); }
  function checkMilestone() {
    var v = verifiedCount();
    var reached = MILESTONES.filter(function (m) { return v >= m.places; });
    if (!reached.length) return;
    var top = reached[reached.length - 1];
    var seen = parseInt(localStorage.getItem("nishemap.milestone") || "0", 10);
    if (top.places <= seen) return;
    localStorage.setItem("nishemap.milestone", String(top.places));
    setTimeout(function () { showTrophy(top.places, top.bonus); }, 900);
  }

  function checkNewCoins() {
    var known;
    try { known = JSON.parse(localStorage.getItem("nishemap.coins.known")) || []; } catch (e) { known = []; }
    var nowVerified = myItems().filter(isVerified);
    var fresh = nowVerified.filter(function (id) { return known.indexOf(id) === -1; });
    localStorage.setItem("nishemap.coins.known", JSON.stringify(nowVerified));
    if (fresh.length) coinCelebration(fresh.length);
    checkMilestone();
    paintRank();
  }

  /* ---------- народные точки из общей копилки ---------- */
  function sbHeaders() {
    return {
      "apikey": CFG.SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + CFG.SUPABASE_ANON_KEY,
    };
  }

  function submissionToVenues(rows) {
    var byVenue = {};
    rows.forEach(function (s) {
      var key = (s.venue + "|" + s.address).toLowerCase();
      if (!byVenue[key]) {
        byVenue[key] = {
          id: "u-" + s.id, name: s.venue, type: "от народа", district: "",
          address: s.address, lat: s.lat || null, lon: s.lon || null, source: "user",
          yandexUrl: "https://yandex.ru/maps/?text=" + encodeURIComponent(s.venue + " " + s.address),
          items: [],
        };
      }
      byVenue[key].items.push({
        id: "ui-" + s.id, item: s.dish, price: s.price, category: s.category,
        confirmedAt: (s.submitted_at || "").slice(0, 10), source: "user", avatar: s.avatar || "",
      });
    });
    return Object.keys(byVenue).map(function (k) { return byVenue[k]; });
  }

  // адреса, которые бесплатный геокодер не берёт (латиница, опечатки) — ставим руками
  var GEO_FIX = {
    "gilyarovscogo 60": [55.7875, 37.6334],
  };
  var userGeoCache;
  try { userGeoCache = JSON.parse(localStorage.getItem("nishemap.geo.user")) || {}; } catch (e) { userGeoCache = {}; }

  function geocodeQueue(venues, onDone) {
    var queue = venues.filter(function (v) {
      var fix = GEO_FIX[(v.address || "").trim().toLowerCase()];
      if (fix && !v.lat) { v.lat = fix[0]; v.lon = fix[1]; return false; }
      if (userGeoCache[v.address]) {
        v.lat = userGeoCache[v.address][0]; v.lon = userGeoCache[v.address][1];
        return false;
      }
      return !v.lat;
    });
    (function next() {
      if (!queue.length) { onDone(); return; }
      var v = queue.shift();
      function save(lat, lon) {
        v.lat = lat; v.lon = lon;
        userGeoCache[v.address] = [lat, lon];
        localStorage.setItem("nishemap.geo.user", JSON.stringify(userGeoCache));
      }
      function fallbackYandex() { setTimeout(next, 300); } // ключ Яндекса геокодер не даёт
      fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
        encodeURIComponent("Москва, " + v.address))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d[0]) { save(+d[0].lat, +d[0].lon); setTimeout(next, 1200); }
          else { fallbackYandex(); }   // транслит/кривой адрес — пусть попробует Яндекс
        })
        .catch(function () { fallbackYandex(); });
    })();
  }

  function loadTotals() {
    if (!CFG.SUPABASE_URL) return;
    fetch(CFG.SUPABASE_URL + "/rest/v1/submissions?select=id", {
      headers: Object.assign({ "Prefer": "count=exact", "Range": "0-0" }, sbHeaders()),
    }).then(function (r) {
      var cr = r.headers.get("content-range") || "";
      var total = parseInt((cr.split("/")[1] || "0"), 10);
      var note = document.getElementById("form-note");
      if (total && note) note.textContent = "Народ уже сдал " + total + " цен. Не наглей — район всё видит.";
    }).catch(function () {});
  }

  function loadSubmissions() {
    if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) return;
    fetch(CFG.SUPABASE_URL + "/rest/v1/submissions?select=id,dish,price,category,venue,address,lat,lon,submitted_at,avatar&order=submitted_at.desc&limit=500", { headers: sbHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        if (!Array.isArray(rows) || !rows.length) return;
        var vs = submissionToVenues(rows);
        SEED.venues = SEED.venues.concat(vs);
        render(); // список сразу, пины — по мере геокода
        geocodeQueue(vs, render);
      })
      .catch(function () { /* сеть упала — карта живёт на сиде */ });
  }

  function openDeepLink() {
    var id = null;
    var m = location.search.match(/[?&]v=([^&]+)/);
    if (m) id = decodeURIComponent(m[1]);
    // ссылка из телеграм-дайджеста: t.me/bot/map?startapp=v_<id>
    if (!id && TG && TG.initDataUnsafe && TG.initDataUnsafe.start_param) {
      var sp = String(TG.initDataUnsafe.start_param);
      if (sp.indexOf("v_") === 0) id = sp.slice(2).replace(/_/g, "-");
    }
    if (!id) return;
    var v = SEED.venues.concat(OSM).filter(function (x) { return x.id === id; })[0];
    if (!v) return;
    openSheet(v);
    if (state.map && v.lat) state.map.setCenter([v.lat, v.lon], 16);
  }

  if (TG && TG.BackButton) {
    try { TG.BackButton.onClick(function () { closeSheet(); closeForm(); }); } catch (e) {}
  }

  initMap();
  render();
  loadSubmissions();
  loadPhotos();
  loadConfirms(function () { render(); checkNewCoins(); });
  loadTotals();
  flushInbox();
  paintRank();
  setTimeout(openDeepLink, 1200);
})();
