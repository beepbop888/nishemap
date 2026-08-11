/* НищеMap v1 — карта еды до 300 ₽ */
(function () {
  "use strict";

  var CFG = window.NISHEMAP_CONFIG || {};
  var SEED = window.NISHEMAP_SEED || { venues: [] };
  var OSM = (window.NISHEMAP_OSM && window.NISHEMAP_OSM.venues) || [];
  var GRAY_MIN_ZOOM = 14; // серые точки — только при приближении, чтобы обзор был монетным
  var STALE_DAYS = 14;

  var LS_CONFIRM = "nishemap.confirms"; // {itemId: "YYYY-MM-DD"}
  var LS_INBOX = "nishemap.inbox";      // [{item,price,category,venue,address,at}]

  var state = {
    bands: { 100: true, 200: true, 300: true, 500: true },
    query: "",
    category: "",
    districts: {}, // {район: true} — мультивыбор; пусто = все
    showGray: true,
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
    var n = myCount();
    if (!n) { el0.hidden = true; return; }
    el0.hidden = false;
    el0.textContent = rankFor(n).t + " · " + n;
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
          '<span class="price price--' + b + '">' + it.price + ' ₽</span></div>' +
          '<div class="card-venue">' + (row.d !== undefined && row.d < 1e9 ? '<span class="dist">' + fmtDist(row.d) + "</span> · " : "") +
          esc(v.name) + " · " + esc(v.type) +
          (v.district ? " · " + esc(v.district) : "") + " · " + esc(v.address) + "</div>" +
          '<div class="fresh"><span class="badge ' + fb.cls + '">' + fb.text + "</span>" +
          '<button class="reconfirm" data-item="' + it.id + '">Ещё по этой цене?</button></div>';
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
        f.dish.focus();
      });
    }
    v.items.forEach(function (it) {
      var b = bandOf(it.price);
      var fb = freshBadge(it);
      var li = el("li", "sheet-item");
      li.innerHTML =
        '<div class="sheet-item-top"><span class="card-item">' + esc(it.item) + "</span>" +
        '<span class="price price--' + b + '">' + it.price + " ₽</span></div>" +
        '<div class="fresh"><span class="badge ' + fb.cls + '">' + fb.text + "</span>" +
        '<button class="reconfirm" data-item="' + it.id + '">Ещё по этой цене?</button>' +
        '<button class="photo-add" data-item="' + it.id + '" title="Меню/вывеска с ценами — или сама еда">📷 фото</button>' +
        '<button class="flag" data-item="' + it.id + '" title="Цена неверна или это не еда">неверно</button></div>' +
        photosHtml(it.id);
      ul.appendChild(li);
    });

    sheet.hidden = false;
    backdrop.hidden = false;
    tgBack(true);
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
      var withGeo = state.formPos
        ? Object.assign({}, record, { lat: state.formPos[0], lon: state.formPos[1] })
        : record;
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
    inbox.push({
      item: f.dish.value.trim(),
      price: price,
      category: f.category.value,
      venue: f.venue.value.trim(),
      address: f.address.value.trim(),
      at: new Date().toISOString(),
    });
    localStorage.setItem(LS_INBOX, JSON.stringify(inbox));
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

  backdrop.addEventListener("click", function () { closeSheet(); closeForm(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeSheet(); closeForm(); }
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

  /* ---------- фото позиций ---------- */
  var PHOTOS = {};
  function loadPhotos() {
    if (!CFG.SUPABASE_URL) return;
    fetch(CFG.SUPABASE_URL + "/rest/v1/item_photos?select=item_id,photo_url,status&limit=1000", { headers: sbHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        if (!Array.isArray(rows)) return;
        rows.forEach(function (p) {
          if (p.status && p.status !== "live") return;
          (PHOTOS[p.item_id] = PHOTOS[p.item_id] || []).push(p.photo_url);
        });
        if (state.activeVenue) openSheet(state.activeVenue); // перерисовать открытую шторку
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
    if (img) { var u = safePhoto(img.dataset.full); if (u) window.open(u, "_blank", "noopener"); }
  });

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
        confirmedAt: (s.submitted_at || "").slice(0, 10), source: "user",
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
    fetch(CFG.SUPABASE_URL + "/rest/v1/submissions?select=*&order=submitted_at.desc&limit=500", { headers: sbHeaders() })
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
    var m = location.search.match(/[?&]v=([^&]+)/); if (!m) return;
    var id = decodeURIComponent(m[1]);
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
  loadTotals();
  paintRank();
  setTimeout(openDeepLink, 1200);
})();
