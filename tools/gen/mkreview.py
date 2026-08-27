"""Страница-каталог: 28 утверждённых аватаров в щитах и 12 медалей за вехи.
   Всё встроено в один файл, картинки — base64."""
import os, sys, base64
sys.path.insert(0, "tools/shield")
from build import CHARS, TIER, RIM, RIB

OUT = sys.argv[1] if len(sys.argv) > 1 else "review.html"
b64 = lambda f: base64.b64encode(open(f, "rb").read()).decode()
SHIELD = "polygon(6% 0%, 94% 0%, 100% 7%, 100% 66%, 88% 86%, 66% 98%, 50% 100%, 34% 98%, 12% 86%, 0% 66%, 0% 7%)"

TIERNAME = ["Бесплатные", "Первые покупки", "Средний ярус", "Верхний ярус"]
# порог · имя · что на медали. Премия одна на все — 10 монет.
MEDALS = [
    (10,   "Первый десяток",  "Мятая жестяная кружка"),
    (25,   "Разведчик",       "Латунный самовар"),
    (50,   "Полсотни",        "Матрёшка"),
    (100,  "Сотня",           "Столбик рублёвых монет"),
    (175,  "Знаток района",   "Шуховская башня"),
    (200,  "Севастополь",     "Памятник затопленным кораблям — с 200 ₽"),
    (275,  "Хранитель карты", "Спасская башня Кремля"),
    (400,  "Ветеран копеек",  "Рубиновая кремлёвская звезда"),
    (500,  "Архангельск",     "Парусник — с 500 ₽"),
    (1000, "Ярославль",       "Ярослав Мудрый — с 1000 ₽"),
    (2000, "Владивосток",     "Русский мост — с 2000 ₽"),
    (2500, "Легенда НищеMap", "Орденская звезда · внесённые и исправленные цены"),
]
NEW = {200, 10, 1000, 2000}

themes = sorted({c[3] for c in CHARS})
bgcss = "".join(f'.bg-{t}{{background-image:url(data:image/webp;base64,{b64(f"art/bg/{t}.webp")})}}\n'
                for t in themes if os.path.exists(f"art/bg/{t}.webp"))
rim = "".join(f'.t{i} .frame{{background:{RIM[i]}}} .t{i} .rib{{background:{RIB[i]}}}\n' for i in range(4))

groups = {i: [] for i in range(4)}
for cid, name, price, theme, sex in CHARS:
    if os.path.exists(f"art/cut/disney/{cid}.webp"): groups[TIER(price)].append((cid, name, price, theme, sex))
total = sum(len(g) for g in groups.values())

def card(cid, name, price, theme, sex):
    return (f'<figure class="sh t{TIER(price)}">'
            f'<div class="card"><div class="frame"><div class="inner bg-{theme}">'
            f'<img src="data:image/webp;base64,{b64(f"art/cut/disney/{cid}.webp")}" alt="{name}"></div></div>'
            f'<div class="rib{" long" if len(name) > 13 else ""}">{name.upper()}</div></div>'
            f'<figcaption>{price or "бесплатно"} · {sex}</figcaption></figure>')

sections = ""
for i in range(4):
    if not groups[i]: continue
    sections += (f'<h2>{TIERNAME[i]}</h2><div class="row">'
                 + "".join(card(*c) for c in groups[i]) + "</div>")

medals = "".join(
    f'<figure class="md{" is-new" if p in NEW else ""}">'
    f'<img src="data:image/webp;base64,{b64(f"art/trophies/t{p}.webp")}" alt="{n}">'
    f'<figcaption><b>{n}</b><span class="thr">{p} подтверждённых цен</span>'
    f'<span class="bon">+10 монет</span><span class="src">{src}</span></figcaption></figure>'
    for p, n, src in MEDALS if os.path.exists(f"art/trophies/t{p}.webp"))

html = f'''<title>Аватары и медали НищеMap</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&display=swap">
<style>
:root{{--bg:#f4f1e9;--card:#fffdf7;--ink:#221f1b;--soft:#6b655c;--line:#ddd7cb;
 --gold:#a97c16;--new:#2f6b4f}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#171613;--card:#211f1a;
 --ink:#f2efe8;--soft:#a49d92;--line:#37332c;--gold:#e0b23c;--new:#6fbf95}}}}
:root[data-theme="dark"]{{--bg:#171613;--card:#211f1a;--ink:#f2efe8;--soft:#a49d92;--line:#37332c;
 --gold:#e0b23c;--new:#6fbf95}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);padding:34px 20px 90px;
 font:400 14px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace}}
.wrap{{max-width:1180px;margin:0 auto}}
h1{{font:700 clamp(26px,4.6vw,42px)/1.05 Oswald,Impact,sans-serif;text-transform:uppercase;
 margin:0 0 10px;letter-spacing:.01em;text-wrap:balance}}
h2{{font:500 15px/1.2 Oswald,Impact,sans-serif;text-transform:uppercase;letter-spacing:.12em;
 color:var(--gold);margin:40px 0 2px;padding-bottom:7px;border-bottom:1px solid var(--line)}}
p{{margin:0 0 8px;max-width:70ch;color:var(--soft)}}
.tally{{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 4px}}
.chip{{border:1px solid var(--line);background:var(--card);border-radius:2px;padding:7px 11px;font-size:12px}}
.chip b{{font:700 15px/1 Oswald,sans-serif;color:var(--gold);margin-right:5px;font-variant-numeric:tabular-nums}}
.row{{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:15px;margin-top:16px}}
.sh{{margin:0}}
.card{{position:relative;display:block}}
.frame{{position:relative;clip-path:{SHIELD};height:0;padding:0 0 112%}}
.inner{{position:absolute;inset:3px;clip-path:{SHIELD};background-size:cover;background-position:center;
 overflow:hidden}}
.inner::after{{content:"";position:absolute;inset:auto 0 0 0;height:46%;
 background:linear-gradient(to bottom,transparent,rgba(0,0,0,.5))}}
.inner img{{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:1}}
.rib{{position:absolute;left:-4px;right:-4px;bottom:15%;padding:5px 8px;text-align:center;
 font:700 12px/1.15 Oswald,Impact,sans-serif;letter-spacing:.02em;color:#fff;white-space:nowrap;
 overflow:hidden;text-shadow:0 1px 2px rgba(0,0,0,.5);border:2px solid #1e1b17;
 clip-path:polygon(0 0,100% 0,95% 50%,100% 100%,0 100%,5% 50%);z-index:2}}
.rib.long{{font-size:9.5px;letter-spacing:0}}
figcaption{{font-size:10px;color:var(--gold);text-align:center;margin-top:5px;line-height:1.5}}
.medals{{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:20px;margin-top:20px}}
.md{{margin:0;background:var(--card);border:1px solid var(--line);border-radius:3px;
 padding:18px 14px 15px;display:flex;flex-direction:column;align-items:center;gap:11px;position:relative}}
.md img{{width:158px;height:158px;object-fit:contain}}
.md figcaption{{display:flex;flex-direction:column;gap:3px;text-align:center;font-size:10px}}
.md b{{font:700 15px/1.2 Oswald,Impact,sans-serif;color:var(--ink);letter-spacing:.02em}}
.thr{{color:var(--ink);font-variant-numeric:tabular-nums}}
.bon{{color:var(--gold);font-variant-numeric:tabular-nums}}
.src{{color:var(--soft);line-height:1.45;margin-top:3px}}
.md.is-new::before{{content:"\\00041D\\00041E\\000412\\000410\\00042F";position:absolute;top:-7px;left:50%;transform:translateX(-50%);
 background:var(--new);color:#fff;font:700 8px/1 Oswald,sans-serif;letter-spacing:.08em;
 padding:4px 8px;border-radius:99px}}
/* rim + ribbon colour per tier, scene background per character (tools/shield/build.py) */
{rim}{bgcss}
</style>
<div class="wrap">
<h1>Аватары и медали НищеMap</h1>
<p>Утверждённая партия аватаров и переделанные медали. Восемь наград остались как были,
четыре новые названы по городам с российских купюр того же номинала.</p>
<div class="tally">
<span class="chip"><b>{total}</b>аватаров</span>
<span class="chip"><b>{len(MEDALS)}</b>медалей</span>
<span class="chip"><b>{len(NEW)}</b>новых по номиналам</span>
</div>
<h2>Медали за вехи</h2>
<p>Порог совпадает с вехой. Премия за любую медаль одинаковая — 10 монет.</p>
<div class="medals">{medals}</div>
{sections}
</div>'''
# Пишем чистым ASCII: кириллица уходит в числовые ссылки (&#1053;).
# Хостинг артефакта отдавал страницу как latin-1 и ломал буквы в кракозябры;
# ASCII-файл читается одинаково при любой кодировке.
open(OUT, "w", encoding="ascii", errors="xmlcharrefreplace").write(html)
nmed = html.count('<figure class="md')
print(f"{OUT}: {total} аватаров, {nmed} медалей, {len(html)//1024} КБ")
