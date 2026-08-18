# -*- coding: utf-8 -*-
"""Собираем гербы: щит с лентой, тематический фон под персонажа, вырезанный портрет.
   Фон рисуется вектором — у каждого архетипа свой (шаурма на вертеле, космос, панельки…)."""
import os, io, base64, collections, json
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, "art")

CHARS = [
 ("student_m","Студент",0,"study","м"),      ("student_f","Студентка",0,"study","м"),
 ("office_m","Офисный",0,"office","м"),      ("office_f","Офисная",0,"office","м"),
 ("zapas_m","Запасливый",0,"dacha","м"),     ("zapas_f","Запасливая",0,"dacha","м"),
 ("doshik_m","Дошиковод",50,"noodle","м"),   ("doshik_f","Дошиководка",50,"noodle","м"),
 ("barista_f","Бариста",75,"coffee","ж"),("barista_m","Бариста",75,"coffee","м"),
 ("samokat_m","Самокатчик",100,"speed","м"), ("samokat_f","Самокатчица",100,"speed","м"),
 ("pvz_f","Пункт выдачи",125,"boxes","ж"),   ("pvz_m","Пункт выдачи",125,"boxes","ж"),
 ("shaurmaster","Шаурмастер",150,"doner","м"),("shaurmaster_f","Шаурмастерица",150,"doner","м"),
 ("itshnik_m","Айтишник",225,"code","м"),    ("itshnik_f","Айтишница",225,"code","м"),
 ("tsar","Царь столовой",275,"palace","м"),  ("tsar_f","Царица столовой",275,"palace","м"),
 ("kosmonavt","Космонавт",425,"space","м"),  ("kosmonavt_f","Космонавтка",425,"space","м"),
 ("oligarkh","Олигарх",650,"money","м"),     ("oligarkh_f","Олигархиня",650,"money","м"),
 ("legenda","Легенда района",900,"yard","м"),("legenda_f","Легенда района",900,"yard","ж"),
 ("zoloto","Золотой нищеброд",1650,"gold","м"),("zoloto_f","Золотая нищебродка",1650,"gold","м"),
]
TIER  = lambda p: 0 if p==0 else 1 if p<200 else 2 if p<700 else 3
RIM   = ['#b9b1a1','#b87d3e','#8b98a5','#c9a23f']
RIB   = ['#8f8778','#a8692c','#6f7d8b','#a8801f']

def knockout(im, tol=38):
    im = im.convert("RGBA"); w,h = im.size; px = im.load()
    corners=[px[0,0],px[w-1,0],px[0,h-1],px[w-1,h-1]]
    base = collections.Counter([c[:3] for c in corners]).most_common(1)[0][0]
    seen=set(); stack=[(x,y) for x in range(w) for y in (0,h-1)]+[(x,y) for y in range(h) for x in (0,w-1)]
    while stack:
        p=stack.pop()
        if p in seen: continue
        x,y=p
        if not (0<=x<w and 0<=y<h): continue
        seen.add(p); r,g,b,a=px[x,y]
        if abs(r-base[0])+abs(g-base[1])+abs(b-base[2]) > tol*3: continue
        px[x,y]=(r,g,b,0)
        stack += [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]
    return im

def b64(im):
    bio=io.BytesIO(); im.save(bio,"WEBP",quality=82,method=6)
    return base64.b64encode(bio.getvalue()).decode()

# ---------- фоны: теперь сгенерированные сцены, а не векторные узоры ----------
BGDIR = os.path.join(ROOT, "art", "bg")
_bgcache = {}
def BG(kind):
    """Возвращает <image> со сценой + лёгкое затемнение, чтобы фигура читалась поверх."""
    if kind not in _bgcache:
        f = os.path.join(BGDIR, kind + ".webp")
        if not os.path.exists(f):
            _bgcache[kind] = '<rect width="100" height="108" fill="#e8e2d4"/>'
        else:
            data = base64.b64encode(open(f, "rb").read()).decode()
            _bgcache[kind] = (f'<image x="0" y="0" width="100" height="108" '
                              f'href="data:image/webp;base64,{data}" preserveAspectRatio="xMidYMid slice"/>'
                              f'<rect width="100" height="108" fill="#000" opacity=".12"/>')
    extra = ""
    if kind == "doner":
        # генератор упорно рисует бургер вместо вертела — шампуры дорисовываем вектором
        for cx in (13, 87):
            extra += (f'<rect x="{cx-1.3}" y="4" width="2.6" height="100" fill="#b8c0c6"/>'
                      f'<path d="M{cx} 14 c-11 0 -15 12 -15 27 c0 19 6 34 15 34 c9 0 15 -15 15 -34 '
                      f'c0 -15 -4 -27 -15 -27 Z" fill="#b06a2c" stroke="#7d4718" stroke-width="1.2"/>')
            for y in (30, 42, 54, 66):
                extra += f'<path d="M{cx-13} {y} q13 4 26 0" stroke="#8a4c1d" stroke-width="1.5" fill="none" opacity=".8"/>'
    return _bgcache[kind] + extra

SHIELD_OUT = "M50 2 L95 15 V56 Q95 92 50 108 Q5 92 5 56 V15 Z"
SHIELD_IN  = "M50 7 L90 19 V56 Q90 88 50 102 Q10 88 10 56 V19 Z"

def shield(cid, name, price, theme, style):
    t = TIER(price)
    src = os.path.join(ART, style, cid + ".webp")
    im = knockout(Image.open(src))
    im = im.crop(im.getbbox() or (0,0,im.size[0],im.size[1]))
    data = b64(im)
    w,h = im.size; ar = w/h
    ih = 64; iw = ih*ar
    ix = 50 - iw/2; iy = 26
    uid = f"{style}_{cid}"
    fs = 7.2 if len(name) > 15 else 8.4
    return f'''<svg viewBox="0 0 100 128" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="{name}">
<defs><clipPath id="c_{uid}"><path d="{SHIELD_IN}"/></clipPath><linearGradient id="f_{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>
<path d="{SHIELD_OUT}" fill="{RIM[t]}"/>
<g clip-path="url(#c_{uid})">{BG(theme)}
<image x="{ix:.1f}" y="{iy}" width="{iw:.1f}" height="{ih}" href="data:image/webp;base64,{data}" preserveAspectRatio="xMidYMin slice"/><rect x="0" y="58" width="100" height="34" fill="url(#f_{uid})"/></g>
<path d="{SHIELD_IN}" fill="none" stroke="{RIM[t]}" stroke-width="2.6"/>
<path d="M3 88 h94 l-7 11 l7 11 H3 l7 -11 Z" fill="{RIB[t]}" stroke="#1e1b17" stroke-width="2.1" stroke-linejoin="round"/>
<text x="50" y="103" font-family="Oswald,Impact,sans-serif" font-size="{fs}" font-weight="700"
 letter-spacing="0.3" text-anchor="middle" fill="#f6f4ef">{name.upper()}</text></svg>'''

if __name__ == "__main__":
    import sys
    styles = sys.argv[1:] or ["disney","pixel","clay","book","toon"]
    out = {}
    for st in styles:
        for cid, name, price, theme in CHARS:
            if not os.path.exists(os.path.join(ART, st, cid + ".webp")): continue
            out[f"{st}/{cid}"] = shield(cid, name, price, theme, st)
        print("built", st, flush=True)
    json.dump(out, open(os.path.join(ROOT, "tools/shield/out.json"), "w"))
    print("total", len(out))
