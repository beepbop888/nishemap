#!/usr/bin/env python3
"""Кто жалуется и не ломает ли кто-то карту.

   ./tools/watch.py           — только подозрительные
   ./tools/watch.py all       — все, кто что-то делал
   ./tools/watch.py reports   — досье жалобщиков

   Признаки считает база (view abuse_watch), здесь только печать. Ни один
   признак сам по себе не приговор: «жалуется много, ни одной по делу» бывает
   и у честного зануды. Решает человек, инструмент только показывает.

   Токен — в .supabase_token (в .gitignore). Владельцу, не приложению.
"""
import io, json, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = "svfnjfpawljkdcehzkgv"

SUS = """select who, devices, reports, upheld, reports_today, submissions, hidden_submissions,
       confirms, suspicion
  from public.abuse_watch
 {where}
 order by (suspicion <> '') desc, reports desc
 limit 40"""

PROFILE = """select who, reports, upheld, rejected, items, last_report
  from public.reporter_profile
 order by reports desc
 limit 40"""


def ask(sql):
    tok = io.open(os.path.join(ROOT, ".supabase_token"), encoding="utf-8").read().strip()
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
        data=json.dumps({"query": sql}).encode(),
        # api.supabase.com отбивает питоновский user-agent защитой от ботов
        headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json",
                 "User-Agent": "curl/8.7.1"})
    return json.load(urllib.request.urlopen(req, timeout=30))


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "sus"

    if mode == "reports":
        rows = ask(PROFILE)
        if not rows:
            print("жалоб пока не было"); return
        print("%-24s%8s%10s%9s%9s  %s" %
              ("кто", "жалоб", "поддерж", "отклон", "позиций", "последняя"))
        for r in rows:
            print("%-24s%8d%10d%9d%9d  %s" % (
                (r["who"] or "")[:23], r["reports"], r["upheld"],
                r["rejected"], r["items"], (r["last_report"] or "")[:16]))
        return

    rows = ask(SUS.format(where="" if mode == "all" else "where suspicion <> ''"))
    if not rows:
        print("чисто — ничего подозрительного" if mode == "sus" else "пусто"); return
    print("%-22s%6s%7s%8s%7s%7s%8s%7s  %s" %
          ("кто", "устр", "жалоб", "поддер", "сутки", "точек", "скрыто", "подтв", "что не так"))
    for r in rows:
        print("%-22s%6d%7d%8d%7d%7d%8d%7d  %s" % (
            (r["who"] or "")[:21], r["devices"], r["reports"], r["upheld"],
            r["reports_today"], r["submissions"], r["hidden_submissions"],
            r["confirms"], r["suspicion"] or "—"))


if __name__ == "__main__":
    main()
