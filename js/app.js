/* НищеMap v1 — карта еды до 300 ₽ */
(function () {
  "use strict";

  var CFG = window.NISHEMAP_CONFIG || {};
  var SEED = window.NISHEMAP_SEED || { venues: [] };
  var OSM = (window.NISHEMAP_OSM && window.NISHEMAP_OSM.venues) || [];
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
  var TG = (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData !== undefined)
    ? window.Telegram.WebApp : null;
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
  function isVerified(id) {
    if (verifyAgeDays(id) > VERIFY_TTL) return false;   // проверка протухла
    if (hasPhoto(id)) return true;
    return confirmCount(id) >= 2;
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
      return { text: (hasPhoto(it.id) ? "проверено фото · " : "проверено народом · " + n + " · ") + when, cls: "is-fresh" };
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
  var MILESTONES = [
    { places: 10, bonus: 3 },
    { places: 30, bonus: 5 },
    { places: 50, bonus: 10 },
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

  var AVATARS = [
    { id: "student",  t: "студент",        d: "живу на дошике до стипендии" },
    { id: "office",   t: "офисный",        d: "обед за свой счёт, увы" },
    { id: "doshik",   t: "дошик-энджоер",  d: "кипяток — мой шеф-повар" },
    { id: "investor", t: "инвестор",       d: "экономлю, чтобы вложиться" },
    { id: "babushka", t: "запасливый",     d: "у меня всё с собой" },
  ];
  function avatarSvg(id, size) {
    var s = size || 28;
    var skin = "#e8c9a0", ink = "#232323";
    var body = {
      student:  '<path d="M6 26c0-5 4-8 10-8s10 3 10 8z" fill="#4a6fa5"/><path d="M8 11l8-4 8 4-8 3z" fill="#232323"/>',
      office:   '<path d="M6 26c0-5 4-8 10-8s10 3 10 8z" fill="#3a3a3a"/><path d="M16 18l2 3-2 5-2-5z" fill="#ad2f26"/><path d="M13 18l3 2 3-2" stroke="#fff" stroke-width="1.5" fill="none"/>',
      doshik:   '<path d="M6 26c0-5 4-8 10-8s10 3 10 8z" fill="#c8621f"/><path d="M10 9h12l-1 4H11z" fill="#f2cf5c" stroke="#232323" stroke-width="1"/>',
      investor: '<path d="M6 26c0-5 4-8 10-8s10 3 10 8z" fill="#2f4858"/><circle cx="12" cy="12" r="3" fill="none" stroke="#232323" stroke-width="1.4"/><circle cx="20" cy="12" r="3" fill="none" stroke="#232323" stroke-width="1.4"/><path d="M15 12h2" stroke="#232323" stroke-width="1.4"/>',
      babushka: '<path d="M6 26c0-5 4-8 10-8s10 3 10 8z" fill="#7a5c8f"/><path d="M9 10c2-4 12-4 14 0 1 3-1 6-7 6s-8-3-7-6z" fill="#d94f6a"/>',
    }[id] || "";
    return '<svg class="avt" width="' + s + '" height="' + s + '" viewBox="0 0 32 32" aria-hidden="true">' +
      '<circle cx="16" cy="16" r="16" fill="#f6f5f1"/>' +
      '<circle cx="16" cy="13" r="6" fill="' + skin + '"/>' + body + "</svg>";
  }
  function myAvatar() { return localStorage.getItem("nishemap.avatar") || ""; }
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
    var coins = myCoins(), sent = myCount();
    if (!sent) { el0.hidden = true; return; }
    el0.hidden = false;
    el0.innerHTML = (myAvatar() ? avatarSvg(myAvatar(), 18) : "") +
      "<span>" + esc(rankFor(coins).t) + " · " + coins + "</span>";
    el0.title = "Монет: " + coins + " (за проверенные цены). Сдано всего: " + sent + ".";
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
  if (rankBtn) rankBtn.addEventListener("click", function () {
    var old = document.querySelector(".coins-info");
    if (old) { old.remove(); return; }
    var coins = myCoins(), nx = nextRank(coins);
    var box = el("div", "coins-info",
      "<h4>Монеты</h4>" +
      "<p style='margin:0 0 8px'>Монета = твоя цена, которую подтвердил район. У тебя <b>" + coins + "</b>.</p>" +
      "<ul>" +
      "<li>Цену проверяют: фото меню <b>или</b> двое других людей жмут «Ещё по этой цене?»</li>" +
      "<li>Монеты — личный счёт: район видит их в звании, но проверку цены решают только фото и чужие подтверждения</li>" +
      "<li>Вехи: 10 мест → +3 монеты, 30 → +5, 50 → +10" +
        (function () { var nm = nextMilestone(verifiedCount());
          return nm ? " (до вехи ещё <b>" + (nm.places - verifiedCount()) + "</b>)" : " — все взяты"; })() + "</li>" +
      "<li>Звание: <b>" + rankFor(coins).t + "</b>" + (nx ? " → до «" + nx.t + "» ещё " + (nx.n - coins) : " — потолок") + "</li>" +
      "</ul>");
    var pick = el("div", "avatar-pick",
      "<h4 style='margin:12px 0 6px'>Твой аватар</h4>" +
      '<div class="avatar-row">' + AVATARS.map(function (a) {
        return '<button type="button" class="avatar-opt' + (myAvatar() === a.id ? " is-on" : "") +
          '" data-avatar="' + a.id + '" title="' + esc(a.d) + '">' + avatarSvg(a.id, 34) +
          "<span>" + esc(a.t) + "</span></button>";
      }).join("") + "</div>");
    box.appendChild(pick);
    pick.querySelectorAll("[data-avatar]").forEach(function (b) {
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        localStorage.setItem("nishemap.avatar", b.dataset.avatar);
        pick.querySelectorAll("[data-avatar]").forEach(function (x) { x.classList.remove("is-on"); });
        b.classList.add("is-on");
        paintRank();
      });
    });
    document.querySelector(".brand").appendChild(box);
    setTimeout(function () {
      document.addEventListener("click", function h(e) {
        if (!e.target.closest(".coins-info") && !e.target.closest("#rank")) { box.remove(); document.removeEventListener("click", h); }
      });
    }, 10);
  });

  /* ---------- «О карте» ---------- */
  var aboutModal = document.getElementById("about-modal");
  var aboutBtn = document.getElementById("about-btn");
  if (aboutBtn) aboutBtn.addEventListener("click", function () {
    aboutModal.hidden = false; backdrop.hidden = false;
  });
  document.querySelectorAll("[data-close-about]").forEach(function (b) {
    b.addEventListener("click", function () {
      aboutModal.hidden = true;
      if (sheet.hidden && formModal.hidden) backdrop.hidden = true;
    });
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
    distToggle.textContent = n ? "Районы · " + n : "Районы";
  }

  /* все 125 районов Москвы (по округам) — чтобы пустые районы были видны и звали добавить точку */
  var MOSCOW_DISTRICTS = [
    "Арбат","Басманный","Замоскворечье","Красносельский","Мещанский","Пресненский","Таганский","Тверской","Хамовники","Якиманка",
    "Аэропорт","Беговой","Бескудниковский","Войковский","Восточное Дегунино","Головинский","Дмитровский","Западное Дегунино","Коптево","Левобережный","Молжаниновский","Савёловский","Сокол","Тимирязевский","Ховрино","Хорошёвский",
    "Алексеевский","Алтуфьевский","Бабушкинский","Бибирево","Бутырский","Лианозово","Лосиноостровский","Марфино","Марьина Роща","Останкинский","Отрадное","Ростокино","Свиблово","Северный","Северное Медведково","Южное Медведково","Ярославский",
    "Богородское","Вешняки","Восточный","Восточное Измайлово","Гольяново","Ивановское","Измайлово","Косино-Ухтомский","Метрогородок","Новогиреево","Новокосино","Перово","Преображенское","Северное Измайлово","Соколиная Гора","Сокольники",
    "Выхино-Жулебино","Капотня","Кузьминки","Лефортово","Люблино","Марьино","Некрасовка","Нижегородский","Печатники","Рязанский","Текстильщики","Южнопортовый",
    "Бирюлёво Восточное","Бирюлёво Западное","Братеево","Даниловский","Донской","Зябликово","Москворечье-Сабурово","Нагатино-Садовники","Нагатинский Затон","Нагорный","Орехово-Борисово Северное","Орехово-Борисово Южное","Царицыно","Чертаново Северное","Чертаново Центральное","Чертаново Южное",
    "Академический","Гагаринский","Зюзино","Коньково","Котловка","Ломоносовский","Обручевский","Северное Бутово","Тёплый Стан","Черёмушки","Южное Бутово","Ясенево",
    "Внуково","Дорогомилово","Крылатское","Кунцево","Можайский","Ново-Переделкино","Очаково-Матвеевское","Проспект Вернадского","Раменки","Солнцево","Тропарёво-Никулино","Филёвский Парк","Фили-Давыдково",
    "Куркино","Митино","Покровское-Стрешнево","Северное Тушино","Строгино","Хорошёво-Мнёвники","Щукино","Южное Тушино",
    "Матушкино","Савёлки","Силино","Старое Крюково","Крюково"
  ];

  (function populateDistricts() {
    var counts = {};
    SEED.venues.forEach(function (v) {
      if (v.district) counts[v.district] = (counts[v.district] || 0) + v.items.length;
    });
    var names = MOSCOW_DISTRICTS.slice();
    // добавляем в конец то, чего нет в официальном списке (города области и т.п.)
    Object.keys(counts).forEach(function (d) {
      if (names.indexOf(d) === -1) names.push(d);
    });
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
      var cnt = el("span", "district-count", n ? String(n) : "0");
      lab.appendChild(cnt);
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
        if (badge && isVerified(id)) { badge.textContent = "проверено народом · " + confirmCount(id); badge.className = "badge is-fresh"; }
      }).catch(function () {});
    }
    var badge = btn.parentElement.querySelector(".badge");
    if (badge) { badge.textContent = "цена жива · проверено сегодня"; badge.className = "badge is-fresh"; }
  });

  /* фото позиции: скрытый инпут, метаданные копим до подключения базы */
  var photoInput = document.createElement("input");
  photoInput.type = "file";
  photoInput.accept = "image/*";
  photoInput.hidden = true;
  document.body.appendChild(photoInput);
  var photoTarget = null;
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".photo-add");
    if (!btn || btn.disabled) return;
    photoTarget = btn;
    photoInput.click();
  });
  photoInput.addEventListener("change", function () {
    if (!photoInput.files.length || !photoTarget) return;
    var file = photoInput.files[0], btn = photoTarget, itemId = btn.dataset.item;
    photoInput.value = "";
    if (file.size > 8 * 1024 * 1024) { toast("Фото тяжелее 8 МБ — сожми"); return; }
    if (!CFG.SUPABASE_URL) { toast("Загрузка фото ещё не включена"); return; }
    btn.disabled = true; btn.textContent = "гружу…";
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
  });

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
    if (v.noPrice && !v.district && v.lat) {
      fetch("https://nominatim.openstreetmap.org/reverse?format=json&zoom=14&lat=" + v.lat + "&lon=" + v.lon)
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var a = d && d.address || {};
          var dist = a.city_district || a.suburb || a.borough || "";
          if (dist && state.activeVenue === v) {
            v.district = dist.replace(/^район /i, "");
            document.getElementById("sheet-type").textContent = v.type + " · " + v.district;
          }
        }).catch(function () {});
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

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = form.elements;
    var price = parseInt(f.price.value, 10);
    var ok = f.dish.value.trim() && f.venue.value.trim() && f.address.value.trim() &&
      price >= 1 && price <= 500;
    if (!ok) { formError.hidden = false; formError.textContent = "Цена до 500 ₽ и все поля — иначе никак."; return; }
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
        // колонок lat/lon может ещё не быть в базе — тогда шлём без них
        return (!r.ok && withGeo !== record) ? post(record) : r;
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

  backdrop.addEventListener("click", function () { closeSheet(); closeForm(); aboutModal.hidden = true; });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeSheet(); closeForm(); aboutModal.hidden = true; }
  });

  /* ---------- map <-> list toggle ---------- */
  var viewToggle = document.getElementById("view-toggle");
  var mapEl = document.getElementById("map");

  viewToggle.addEventListener("click", function () {
    var toList = mapEl.hidden === false;
    mapEl.hidden = toList;
    fallbackEl.hidden = !toList;
    viewToggle.textContent = toList ? "Карта" : "Список";
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
          state.map.events.add("boundschange", function (e) {
            if (e.get("newZoom") !== e.get("oldZoom")) renderGray();
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
    var zoom = state.map.getZoom();
    if (!state.showGray || !OSM.length) { if (hint) hint.hidden = true; return; }
    if (zoom < GRAY_MIN_ZOOM) {
      if (hint) hint.hidden = false;
      return;
    }
    if (hint) hint.hidden = true;
    var Layout = ymaps.templateLayoutFactory.createClass('<div class="graypin"></div>');
    visibleGray().forEach(function (v) {
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

  /* ---------- монета за проверенную точку ---------- */
  function coinCelebration(n) {
    var wrap = el("div", "coin-cheer",
      '<div class="coin-cheer-coin"></div>' +
      '<p class="coin-cheer-title">' + (n > 1 ? "+" + n + " монеты" : "+1 монета") + "</p>" +
      '<p class="coin-cheer-sub">Твою цену подтвердил район</p>');
    document.body.appendChild(wrap);
    haptic("success");
    setTimeout(function () { wrap.classList.add("is-out"); }, 2200);
    setTimeout(function () { wrap.remove(); }, 2900);
  }
  function verifiedCount() { return myItems().filter(isVerified).length; }
  function myCoins() { var v = verifiedCount(); return v + bonusFor(v); }
  function checkMilestone() {
    var v = verifiedCount();
    var reached = MILESTONES.filter(function (m) { return v >= m.places; });
    if (!reached.length) return;
    var top = reached[reached.length - 1];
    var seen = parseInt(localStorage.getItem("nishemap.milestone") || "0", 10);
    if (top.places <= seen) return;
    localStorage.setItem("nishemap.milestone", String(top.places));
    setTimeout(function () {
      var wrap = el("div", "coin-cheer is-milestone",
        '<div class="coin-cheer-coin"></div>' +
        '<p class="coin-cheer-title">Веха: ' + top.places + " мест</p>" +
        '<p class="coin-cheer-sub">+' + top.bonus + " монет сверху. Район запомнит.</p>");
      document.body.appendChild(wrap);
      haptic("success");
      setTimeout(function () { wrap.classList.add("is-out"); }, 3000);
      setTimeout(function () { wrap.remove(); }, 3700);
    }, 900);
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
