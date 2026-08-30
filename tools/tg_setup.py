"""Витрина бота @nishemap_bot: что человек видит, открыв чат первый раз.

   Пустой чат Telegram показывает description над кнопкой «Запустить», а в
   профиле — short_description. Оба до этого были пустые: человек видел голый
   экран и не понимал, куда он попал.

   Меню-кнопка переведена с «commands» на web_app: она висит слева от поля
   ввода ВСЕГДА, в том числе до нажатия «Запустить», и открывает карту в один
   тап. Это важно: ответ на /start шлёт digest.mjs из GitHub Actions раз в 6
   часов, мгновенного ответа у бота нет — значит кнопка должна работать без бота.

   Запуск:  python3 tools/tg_setup.py        (токен — из .telegram_token)
"""
import json, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://beepbop888.github.io/nishemap/"

# 512 символов максимум. Первая строка — ответ на вопрос «что это»,
# дальше по одной мысли на строку: искать, добавлять, копить.
DESCRIPTION = (
    "\U0001F35C НищеMap — карта дешёвой еды в Москве.\n\n"
    "\U0001F32F Шаурма, пельменные, столовые, бизнес-ланчи — с ценами, которые проверили живые люди.\n"
    "\U0001F4CD Смотри, где поесть рядом и за сколько — ещё до того, как выйдешь из дома.\n"
    "➕ Нашёл дешевле — добавь точку и забери монеты.\n"
    "\U0001F3C5 На монеты открываются аватары, медали и другие сюрпризы впереди.\n\n"
    "\U0001F447 Жми «Запустить» — карта откроется прямо здесь."
)

# 120 символов максимум: превью в профиле и в пересылке ссылки на бота.
SHORT = (
    "\U0001F35C Карта дешёвой еды в Москве: шаурма, столовые, бизнес-ланчи. "
    "Цены от живых людей \U0001F4CD"
)

# Только те команды, на которые бот реально отвечает. Список из несуществующих
# команд хуже пустого: человек жмёт и получает тишину.
COMMANDS = [{"command": "start",
             "description": "\U0001F5FA Открыть карту НищеMap"}]

MENU_TEXT = "\U0001F5FA Карта"


def token():
    t = os.environ.get("BOT_TOKEN")
    if t: return t.strip()
    p = os.path.join(ROOT, ".telegram_token")
    if os.path.exists(p): return open(p, encoding="utf-8").read().strip()
    sys.exit("нет токена: положи его в .telegram_token или export BOT_TOKEN=...")


def call(tok, method, payload):
    req = urllib.request.Request(f"https://api.telegram.org/bot{tok}/{method}",
                                 data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        res = json.load(r)
    print(("ok   " if res.get("ok") else "СБОЙ ") + method + ("" if res.get("ok") else f" -> {res}"))
    return res.get("ok")


if __name__ == "__main__":
    tok = token()
    assert len(DESCRIPTION) <= 512, len(DESCRIPTION)
    assert len(SHORT) <= 120, len(SHORT)
    call(tok, "setMyDescription", {"description": DESCRIPTION})
    call(tok, "setMyShortDescription", {"short_description": SHORT})
    call(tok, "setMyCommands", {"commands": COMMANDS})
    call(tok, "setChatMenuButton", {"menu_button": {
        "type": "web_app", "text": MENU_TEXT, "web_app": {"url": SITE}}})
    print(f"описание: {len(DESCRIPTION)} симв., короткое: {len(SHORT)} симв.")
