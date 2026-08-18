# -*- coding: utf-8 -*-
"""Собираем гербы: щит с лентой, тематический фон под персонажа, вырезанный портрет.
   Фон рисуется вектором — у каждого архетипа свой (шаурма на вертеле, космос, панельки…)."""
import os, io, base64, collections, json
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, "art")

CHARS = [
 ("student_m","Студент",0,"study"),      ("student_f","Студентка",0,"study"),
 ("office_m","Офисный",0,"office"),      ("office_f","Офисная",0,"office"),
 ("zapas_m","Запасливый",0,"dacha"),     ("zapas_f","Запасливая",0,"dacha"),
 ("doshik_m","Дошиковод",50,"noodle"),   ("doshik_f","Дошиководка",50,"noodle"),
 ("barista_f","Бариста",75,"coffee"),    ("barista_m","Бариста",75,"coffee"),
 ("samokat_m","Самокатчик",100,"speed"), ("samokat_f","Самокатчица",100,"speed"),
 ("pvz_f","Пункт выдачи",125,"boxes"),   ("pvz_m","Пункт выдачи",125,"boxes"),
 ("shaurmaster","Шаурмастер",150,"doner"),("shaurmaster_f","Шаурмастерица",150,"doner"),
 ("itshnik_m","Айтишник",225,"code"),    ("itshnik_f","Айтишница",225,"code"),
 ("tsar","Царь столовой",275,"palace"),  ("tsar_f","Царица столовой",275,"palace"),
 ("kosmonavt","Космонавт",425,"space"),  ("kosmonavt_f","Космонавтка",425,"space"),
 ("oligarkh","Олигарх",650,"money"),     ("oligarkh_f","Олигархиня",650,"money"),
 ("legenda","Легенда района",900,"yard"),("legenda_f","Легенда района",900,"yard"),
 ("zoloto","Золотой нищеброд",1650,"gold"),("zoloto_f","Золотая нищебродка",1650,"gold"),
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

# ---------- тематические фоны (координаты внутри щита 0..100 × 0..108) ----------
def BG(kind):
    S=[]
    if kind=="study":
        S.append('<rect width="100" height="108" fill="#dfe6ee"/>')
        S += [f'<line x1="8" y1="{y}" x2="92" y2="{y}" stroke="#b9c6d6" stroke-width="1.1"/>' for y in range(16,96,9)]
        S.append('<line x1="24" y1="4" x2="24" y2="104" stroke="#e4a3a3" stroke-width="1.4"/>')
    elif kind=="office":
        S.append('<rect width="100" height="108" fill="#d8dfe6"/>')
        S += [f'<rect x="{x}" y="10" width="16" height="70" fill="#c3ccd6"/>' for x in (6,30,54,78)]
        S += [f'<line x1="0" y1="{y}" x2="100" y2="{y}" stroke="#aab6c2" stroke-width="1"/>' for y in range(14,84,10)]
    elif kind=="dacha":
        S.append('<rect width="100" height="108" fill="#dfe4cc"/>')
        S += [f'<path d="M{x} 96 q6 -18 12 0 Z" fill="#9fae72"/>' for x in range(2,100,16)]
        S += [f'<circle cx="{x}" cy="{y}" r="4" fill="#c56b52"/>' for x,y in [(16,58),(46,50),(76,60),(60,72),(30,74)]]
    elif kind=="noodle":
        S.append('<rect width="100" height="108" fill="#f0e2c4"/>')
        S += [f'<path d="M{x} 12 q10 16 0 32 q-10 16 0 32 q10 16 0 30" fill="none" stroke="#dcc48c" stroke-width="3" stroke-linecap="round"/>' for x in range(8,100,14)]
    elif kind=="coffee":
        S.append('<rect width="100" height="108" fill="#e3d3c0"/>')
        S += [f'<ellipse cx="{x}" cy="{y}" rx="5" ry="6.5" fill="#8a5c3b" transform="rotate({r} {x} {y})"/><path d="M{x} {y-5} q1.6 5 0 10" stroke="#e3d3c0" stroke-width="1.2" fill="none"/>'
              for x,y,r in [(14,22,18),(44,14,-14),(76,26,26),(24,58,-8),(58,48,20),(86,62,-22),(20,90,12),(52,86,-18),(84,96,8)]]
    elif kind=="speed":
        S.append('<rect width="100" height="108" fill="#f2e2b0"/>')
        S += [f'<rect x="-10" y="{y}" width="120" height="3" fill="#dcc474" transform="skewX(-18)"/>' for y in range(8,104,11)]
    elif kind=="boxes":
        S.append('<rect width="100" height="108" fill="#e6dcea"/>')
        for gy,y in enumerate(range(8,100,22)):
            S.append(f'<rect x="0" y="{y+18}" width="100" height="2.5" fill="#b9a3c6"/>')
            S += [f'<rect x="{x}" y="{y}" width="16" height="18" rx="1.5" fill="#cbb6d6" stroke="#b09ac0" stroke-width="1"/>' for x in range(4+ (gy%2)*8, 96, 22)]
    elif kind=="doner":   # вертикальный вертел с мясом — как просили
        S.append('<rect width="100" height="108" fill="#eddcbe"/>')
        for cx in (14,50,86):
            S.append(f'<rect x="{cx-1.4}" y="6" width="2.8" height="96" fill="#9aa3aa"/>')
            S.append(f'<path d="M{cx} 16 c-13 0 -18 14 -18 30 c0 20 7 38 18 38 c11 0 18 -18 18 -38 c0 -16 -5 -30 -18 -30 Z" fill="#c07a3a"/>')
            S += [f'<path d="M{cx-16} {y} q16 5 32 0" stroke="#a05f26" stroke-width="2" fill="none"/>' for y in (34,48,62,74)]
    elif kind=="code":
        S.append('<rect width="100" height="108" fill="#1e2430"/>')
        S += [f'<rect x="{6+(i*13)%60}" y="{8+i*7}" width="{18+(i*11)%40}" height="3" rx="1.5" fill="#3d5a80" opacity="{0.35+0.05*(i%5)}"/>' for i in range(14)]
        S.append('<text x="50" y="66" font-family="monospace" font-size="30" fill="#2f4763" text-anchor="middle">{ }</text>')
    elif kind=="palace":
        S.append('<rect width="100" height="108" fill="#7b1f2b"/>')
        S += [f'<path d="M{x} {y} l5 -8 l5 8 l-5 8 Z" fill="#9c3040"/>' for y in range(6,106,16) for x in range(2,100,16)]
        S += [f'<circle cx="{x+5}" cy="{y}" r="2" fill="#c9a23f"/>' for y in range(14,106,16) for x in range(2,100,16)]
    elif kind=="space":   # космос — как просили
        S.append('<rect width="100" height="108" fill="#141a2e"/>')
        S += [f'<circle cx="{(i*37)%100}" cy="{(i*23)%108}" r="{0.7+ (i%3)*0.5}" fill="#fff" opacity="{0.4+0.15*(i%4)}"/>' for i in range(46)]
        S.append('<circle cx="76" cy="26" r="15" fill="#2f4c86"/><ellipse cx="76" cy="26" rx="23" ry="6" fill="none" stroke="#7d93c4" stroke-width="1.6" transform="rotate(-18 76 26)"/>')
    elif kind=="money":
        S.append('<rect width="100" height="108" fill="#2f2740"/>')
        S += [f'<text x="{x}" y="{y}" font-family="Oswald,sans-serif" font-size="15" fill="#c9a23f" opacity=".5" text-anchor="middle">₽</text>'
              for y in range(16,110,18) for x in range(10,100,20)]
    elif kind=="yard":    # панельки во дворе
        S.append('<rect width="100" height="108" fill="#b9c3cc"/>')
        for i,(x,w,h) in enumerate([(0,26,46),(28,22,58),(52,26,40),(80,24,52)]):
            S.append(f'<rect x="{x}" y="{100-h}" width="{w}" height="{h}" fill="{"#8d9aa6" if i%2 else "#7e8b98"}"/>')
            S += [f'<rect x="{x+3+c*7}" y="{100-h+5+r*8}" width="4" height="5" fill="#dfe6ec" opacity=".8"/>'
                  for r in range((h-8)//8) for c in range((w-4)//7)]
        S.append('<rect x="0" y="98" width="100" height="10" fill="#6f7a85"/>')
    elif kind=="gold":
        S.append('<rect width="100" height="108" fill="#8a6512"/>')
        S += [f'<path d="M50 54 L{50+70*__import__("math").cos(a)} {54+70*__import__("math").sin(a)} L{50+70*__import__("math").cos(a+0.13)} {54+70*__import__("math").sin(a+0.13)} Z" fill="#c9a23f" opacity=".55"/>'
              for a in [i*0.393 for i in range(16)]]
        S += [f'<circle cx="{x}" cy="{y}" r="5" fill="#e8c65c" stroke="#a8801f" stroke-width="1.2"/>' for x,y in [(14,88),(30,96),(72,92),(88,82)]]
    else:
        S.append('<rect width="100" height="108" fill="#e8e2d4"/>')
    return "".join(S)

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
