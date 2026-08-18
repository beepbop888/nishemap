"""Сборка страницы сравнения. Фоны — один раз в CSS, персонажи — по одному <img>.
   Смешарики убраны: это был мой рисунок, а рисовать больше нельзя."""
import sys, os, base64
sys.path.insert(0, "tools/shield")
from build import CHARS, TIER, RIM, RIB
b64 = lambda f: base64.b64encode(open(f, "rb").read()).decode()
THEMES = sorted({c[3] for c in CHARS})
bgcss = "".join(f'.bg-{t}{{background-image:url(data:image/webp;base64,{b64(f"art/bg/{t}.webp")})}}\n'
                for t in THEMES if os.path.exists(f"art/bg/{t}.webp"))
STYLES = [("disney","Disney 3D"),("pixel","Пиксель-арт"),("clay","Пластилин"),
          ("book","Советская детская книга"),("toon","Круглый мультяшный")]
TIERNAME = ["грустные","усталые","скалятся","улыбаются"]
SHIELD = "polygon(50% 0%, 97% 12%, 97% 55%, 50% 100%, 3% 55%, 3% 12%)"
def card(sid, c):
    cid, name, price, theme, sex = c
    f = f"art/cut/{sid}/{cid}.webp"
    if not os.path.exists(f): return ""
    return (f'<figure class="sh t{TIER(price)}"><div class="frame"><div class="inner bg-{theme}">'
            f'<img src="data:image/webp;base64,{b64(f)}" alt="{name}"></div></div>'
            f'<div class="rib">{name.upper()}</div>'
            f'<figcaption>{price or "free"} · {sex}</figcaption></figure>')
secs = "".join(f'<section class="st"><h3>{nm}</h3><div class="row">'
               + "".join(card(sid, c) for c in CHARS) + '</div></section>' for sid, nm in STYLES)
rim = "".join(f'.t{i} .frame{{background:{RIM[i]}}} .t{i} .rib{{background:{RIB[i]}}}\n' for i in range(4))
legend = "".join(f'<tr><td><b>{["Бесплатно","50–150","225–650","900–1650"][i]}</b></td>'
                 f'<td>{TIERNAME[i]}</td><td><span class="sw" style="background:{RIM[i]}"></span></td></tr>'
                 for i in range(4))
html = f'''<title>НищеMap — пять стилей, выбор</title>
<style>
:root{{--bg:#f7f5f0;--card:#fff;--ink:#221f1b;--soft:#6b655c;--line:#ddd7cb;--gold:#a97c16}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#181714;--card:#221f1b;--ink:#f2efe8;--soft:#a49d92;--line:#38342e;--gold:#e8b93c}}}}
:root[data-theme="dark"]{{--bg:#181714;--card:#221f1b;--ink:#f2efe8;--soft:#a49d92;--line:#38342e;--gold:#e8b93c}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);padding:30px 18px 80px;font:400 15px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace}}
.wrap{{max-width:1240px;margin:0 auto}}
h1{{font:700 clamp(25px,4.4vw,38px)/1.08 Oswald,Impact,sans-serif;text-transform:uppercase;margin:0 0 8px}}
h3{{font:700 17px/1.2 Oswald,Impact,sans-serif;text-transform:uppercase;margin:0 0 12px}}
p{{margin:0 0 9px;max-width:84ch}}.lede{{color:var(--soft)}}
.st{{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:16px;margin-bottom:16px}}
.row{{display:grid;grid-template-columns:repeat(auto-fill,minmax(116px,1fr));gap:12px}}
.sh{{margin:0;position:relative}}
.frame{{clip-path:{SHIELD};padding:3px;aspect-ratio:100/112}}
.inner{{width:100%;height:100%;clip-path:{SHIELD};background-size:cover;background-position:center;
 position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden}}
.inner::after{{content:"";position:absolute;inset:auto 0 0 0;height:44%;
 background:linear-gradient(to bottom,transparent,rgba(0,0,0,.48))}}
.inner img{{height:82%;width:auto;margin-bottom:14%;position:relative;z-index:1;
 filter:drop-shadow(0 2px 5px rgba(0,0,0,.45))}}
.rib{{position:absolute;left:-2px;right:-2px;bottom:12%;padding:3px 2px;text-align:center;
 font:700 8.5px/1.25 Oswald,Impact,sans-serif;letter-spacing:.03em;color:#f6f4ef;
 border:1.5px solid #1e1b17;clip-path:polygon(0 0,100% 0,94% 50%,100% 100%,0 100%,6% 50%);z-index:2}}
figcaption{{font-size:9.5px;color:var(--gold);text-align:center;margin-top:3px}}
{rim}{bgcss}
table{{border-collapse:collapse;font-size:13.5px;margin:10px 0}}
td{{padding:6px 12px 6px 0}}
.sw{{display:inline-block;width:26px;height:11px;border-radius:2px;vertical-align:middle}}
</style>
<div class="wrap">
<h1>Пять стилей · выбери один</h1>
<p class="lede">Один и тот же состав в пяти подачах. Мимика теперь привязана к уровню — по ней видно, насколько высоко забрался владелец аватара.</p>
<table>{legend}</table>
{secs}
</div>'''
open("shields.html", "w", encoding="utf-8").write(html)
print("page", len(html)//1024, "KB")
