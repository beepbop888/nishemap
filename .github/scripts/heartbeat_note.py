#!/usr/bin/env python3
"""Ежемесячное напоминание владельцу, что карту надо иногда трогать.

   Живёт отдельным файлом, а не строчками в yaml, по скучной причине: текст с
   переводами строк, эмодзи и кавычками внутри `run:` ломает разбор YAML —
   первая версия этого воркфлоу именно так и не запустилась ни разу.

   Ничего не знает о внешнем вводе: берёт токен и chat_id из окружения, шлёт
   заранее написанный текст. Подставлять сюда что-либо из github.event нельзя —
   это прямая дорога к инъекции в рабочий процесс.
"""
import json, os, sys, urllib.request

TEXT = """🫀 Ежемесячная проверка НищеMap

Репозиторий шевельнулся сам — расписания в порядке ещё на месяц.

Что стоит глянуть:
• карта открывается: beepbop888.github.io/nishemap
• база не уснула: supabase.com/dashboard
• ./tools/watch.py — не накручивает ли кто

Если проект не трогать вообще, GitHub через 60 дней выключит расписания,
и пульс базы замолчит — а следом уснёт и сама база."""


def main():
    token = os.environ.get("BOT_TOKEN", "").strip()
    chat = os.environ.get("OWNER_CHAT_ID", "").strip()
    if not token or not chat:
        print("нет BOT_TOKEN или OWNER_CHAT_ID — напоминание пропущено")
        return
    body = json.dumps({"chat_id": chat, "text": TEXT,
                       "disable_web_page_preview": True}).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=body, headers={"Content-Type": "application/json"})
    try:
        res = json.load(urllib.request.urlopen(req, timeout=30))
    except Exception as e:
        print("не отправилось:", e)
        sys.exit(1)
    print("напоминание отправлено" if res.get("ok") else f"телеграм отказал: {res}")


if __name__ == "__main__":
    main()
