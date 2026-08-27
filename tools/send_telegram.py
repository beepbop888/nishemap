"""Отправка утверждённой партии себе в Telegram через бота @nishemap_bot.

   Зачем: страховка на случай перезапуска сессии или потери машины. Уходит два
   файла — страница приёмки (в ней всё встроено base64) и архив art/.

   Токен НЕ хранится в репозитории. Скрипт берёт его из переменной окружения
   BOT_TOKEN или из файла .telegram_token рядом с проектом (он в .gitignore).
   Тот же токен лежит в секретах GitHub для пятничного дайджеста — см. TELEGRAM.md.

   chat_id determined автоматически: бот читает getUpdates и берёт последний
   приватный чат. Если писем нет — напишите боту /start и запустите снова.

   Запуск:  python3 tools/send_telegram.py [файл ...]
"""
import os, sys, json, zipfile, urllib.request, urllib.parse, mimetypes, uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://api.telegram.org/bot{}/{}"


def token():
    t = os.environ.get("BOT_TOKEN")
    if t: return t.strip()
    p = os.path.join(ROOT, ".telegram_token")
    if os.path.exists(p):
        return open(p, encoding="utf-8").read().strip()
    sys.exit("нет токена: положи его в .telegram_token или export BOT_TOKEN=...")


def call(tok, method, **params):
    url = API.format(tok, method) + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)


def chat_id(tok):
    if os.environ.get("CHAT_ID"): return os.environ["CHAT_ID"]
    upd = call(tok, "getUpdates", limit=100)
    if not upd.get("ok"): sys.exit(f"getUpdates не ответил: {upd}")
    chats = [u["message"]["chat"] for u in upd["result"]
             if "message" in u and u["message"]["chat"]["type"] == "private"]
    if not chats:
        sys.exit("бот не видит ни одного личного чата — напиши ему /start и повтори")
    c = chats[-1]
    print(f"чат: {c.get('username') or c.get('first_name')} ({c['id']})")
    return str(c["id"])


def send_document(tok, cid, path, caption=""):
    """multipart/form-data руками: тянуть requests ради одного запроса не хочется"""
    bound = uuid.uuid4().hex
    name = os.path.basename(path)
    ctype = mimetypes.guess_type(name)[0] or "application/octet-stream"
    body = bytearray()
    for k, v in (("chat_id", cid), ("caption", caption)):
        body += (f"--{bound}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n").encode()
    body += (f"--{bound}\r\nContent-Disposition: form-data; name=\"document\"; "
             f"filename=\"{name}\"\r\nContent-Type: {ctype}\r\n\r\n").encode()
    body += open(path, "rb").read() + b"\r\n"
    body += f"--{bound}--\r\n".encode()
    req = urllib.request.Request(API.format(tok, "sendDocument"), data=bytes(body),
                                 headers={"Content-Type": f"multipart/form-data; boundary={bound}"})
    with urllib.request.urlopen(req, timeout=180) as r:
        ok = json.load(r).get("ok")
    print(("отправлено: " if ok else "НЕ отправлено: ") + name, f"({os.path.getsize(path)//1024} КБ)")
    return ok


def zip_art(dst):
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
        for base, _, files in os.walk(os.path.join(ROOT, "art")):
            for f in files:
                p = os.path.join(base, f)
                z.write(p, os.path.relpath(p, ROOT))
    return dst


if __name__ == "__main__":
    tok = token()
    cid = chat_id(tok)
    files = sys.argv[1:]
    if not files:
        art = zip_art(os.path.join(ROOT, ".gen", "art_backup.zip"))
        files = [os.path.join(ROOT, "review.html"), art]
    caption = "НищеMap: утверждённая партия — 28 аватаров и 12 медалей"
    for i, f in enumerate(files):
        send_document(tok, cid, f, caption if i == 0 else "")
