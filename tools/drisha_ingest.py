#!/usr/bin/env python3
"""Загрузка находок в ДрищMap из любого источника.

   Труба одна, источников много: сегодня руками, завтра из выгрузки 2ГИС,
   послезавтра из реестра проверок. Формат один и тот же, поэтому источник
   можно менять, не трогая ни приложение, ни базу.

       ./tools/drisha_ingest.py находки.json
       ./tools/drisha_ingest.py --dry находки.json    # только проверить

   Файл — список объектов:
       {
         "venue":     "Столовая №1",          обязательно
         "address":   "Бауманская ул., 13",   обязательно
         "lat": 55.77, "lon": 37.67,          желательно, иначе не будет пина
         "source":    "ext",                  ext | link | crowd
         "kind":      "poisoning",            poisoning | diarrhea | vomit | bad
         "date":      "2026-08-14",           когда это написали/случилось
         "quote":     "Отравился шаурмой…",   только для ext
         "url":       "https://yandex.ru/…",  ссылка на первоисточник
         "author":    "Иван П.",              как подписан отзыв там
         "site":      "yandex"                yandex | 2gis | google | tripadvisor
       }

   Что проверяется до записи, потому что цена ошибки тут — иск, а не битый пин:
     * старше трёх месяцев — не берём, слой всё равно такое не покажет;
     * ext без ссылки — не берём: цитата без первоисточника это уже наше
       утверждение, а не чужое;
     * ссылка не на известный сайт отзывов — не берём;
     * пустая или подозрительно короткая цитата — не берём.

   Токен — в .supabase_token (в .gitignore).
"""
import io, json, os, re, sys, urllib.request
from datetime import date, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = "svfnjfpawljkdcehzkgv"
KINDS = {"poisoning", "diarrhea", "vomit", "bad"}
SOURCES = {"ext", "link", "crowd"}
SITE_RE = re.compile(
    r"^https://([a-z0-9-]+\.)*(yandex\.[a-z]+|2gis\.[a-z]+|google\.[a-z]+|tripadvisor\.[a-z]+)/", re.I)


def q(s):
    """Экранирование для SQL-литерала: строки приходят из чужих отзывов."""
    return "'" + str(s).replace("'", "''") + "'" if s is not None else "null"


def ask(sql):
    tok = io.open(os.path.join(ROOT, ".supabase_token"), encoding="utf-8").read().strip()
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json",
                 "User-Agent": "curl/8.7.1"})
    return json.load(urllib.request.urlopen(req, timeout=60))


def check(r, i):
    """Возвращает список претензий к записи. Пустой — можно грузить."""
    bad = []
    for f in ("venue", "address", "source", "kind", "date"):
        if not r.get(f):
            bad.append(f"нет поля {f}")
    if r.get("source") not in SOURCES:
        bad.append(f"source={r.get('source')!r} — не из списка")
    if r.get("kind") not in KINDS:
        bad.append(f"kind={r.get('kind')!r} — не из списка")
    try:
        d = date.fromisoformat(str(r.get("date")))
        if d > date.today():
            bad.append("дата в будущем")
        if d < date.today() - timedelta(days=92):
            bad.append("старше трёх месяцев — слой это не покажет")
    except Exception:
        bad.append("дата не в формате ГГГГ-ММ-ДД")
    if r.get("source") == "ext":
        if not r.get("url"):
            bad.append("цитата без ссылки — это уже наше утверждение, а не чужое")
        if not (r.get("quote") or "").strip() or len(r.get("quote", "")) < 15:
            bad.append("пустая или слишком короткая цитата")
    if r.get("url") and not SITE_RE.match(r["url"]):
        bad.append("ссылка не на известный сайт отзывов")
    return bad


def main():
    args = [a for a in sys.argv[1:] if a != "--dry"]
    dry = "--dry" in sys.argv
    if not args:
        print(__doc__); sys.exit(1)
    rows = json.load(io.open(args[0], encoding="utf-8"))
    if isinstance(rows, dict):
        rows = [rows]

    good, values = [], []
    for i, r in enumerate(rows, 1):
        bad = check(r, i)
        if bad:
            print(f"  {i:3}. ПРОПУСК {r.get('venue', '?')}: " + "; ".join(bad))
            continue
        key = (str(r["venue"]).strip().lower() + "|" + str(r["address"]).strip().lower())
        values.append("(" + ", ".join([
            q(key), q(str(r["venue"])[:120]), q(str(r["address"])[:160]),
            str(float(r["lat"])) if r.get("lat") else "null",
            str(float(r["lon"])) if r.get("lon") else "null",
            q(r["source"]), q(r["kind"]), q(r["date"]),
            q(str(r["quote"])[:400]) if r.get("quote") else "null",
            q(r.get("url")), q(r.get("author")), q(r.get("site")),
        ]) + ")")
        good.append(r)

    print(f"\nгодных: {len(good)} из {len(rows)}")
    if not good or dry:
        if dry: print("(--dry: ничего не записано)")
        return

    sql = ("insert into public.sick_reports "
           "(venue_key, venue_name, address, lat, lon, source, kind, happened_on, "
           " quote, url, author, site) values\n" + ",\n".join(values) +
           "\non conflict do nothing")
    ask(sql)
    n = ask("select count(*) n from public.sick_reports where status = 'live'")
    print(f"записано. всего живых находок: {n[0]['n']}")
    pts = ask("select count(*) n from public.drisha_points")
    print(f"мест на слое (за три месяца): {pts[0]['n']}")


if __name__ == "__main__":
    main()
