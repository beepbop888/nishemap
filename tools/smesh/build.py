# -*- coding: utf-8 -*-
"""Смешарики: персонаж — это ШАР. Ни шеи, ни плеч, лапки-палочки, огромные глаза.
   Генератором такое не берётся (модели нет), поэтому чистая геометрия — она тут и нужна."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "shield"))
from build import CHARS, TIER, RIM, RIB

INK = "#1e1b17"
# цвет шара и деталь на макушке — этим и различаются персонажи
LOOK = {
 "student_m":("#6d8fb5","beanie","#3f5a78"),   "student_f":("#e08aa8","bow","#c2506b"),
 "office_m":("#8d93a8","tie","#3f4d63"),        "office_f":("#a8a2c4","tie","#5c6f8a"),
 "zapas_m":("#9db268","cap","#5e6f42"),         "zapas_f":("#b7c47e","kerchief","#c8492f"),
 "doshik_m":("#e8b06a","noodle","#d4402e"),     "doshik_f":("#f0c48a","noodle","#d4402e"),
 "barista_f":("#c9946a","kerchief","#c8492f"),  "barista_m":("#b8845a","kerchief","#c8492f"),
 "samokat_m":("#f0c948","helmet","#b8901f"),    "samokat_f":("#f6d76a","helmet","#b8901f"),
 "pvz_f":("#a869c4","cap","#6a2380"),           "pvz_m":("#9558b0","cap","#6a2380"),
 "shaurmaster":("#e07a52","cook","#c8492f"),    "shaurmaster_f":("#e89070","cook","#c8492f"),
 "itshnik_m":("#5d6b80","cans","#2a2f3a"),      "itshnik_f":("#8f7bb0","cans","#2a2f3a"),
 "tsar":("#c85a5a","crown","#e8b93c"),          "tsar_f":("#d97b7b","kokoshnik","#e8b93c"),
 "kosmonavt":("#dfe4ea","helm2","#d9a326"),     "kosmonavt_f":("#e8ecf0","helm2","#d9a326"),
 "oligarkh":("#6a5a80","tophat","#26262a"),     "oligarkh_f":("#f2efe8","beret","#26262a"),
 "legenda":("#9a8f7e","ushanka","#5b452e"),     "legenda_f":("#a89c88","kerchief","#b8465c"),
 "zoloto":("#e8b93c","ushanka","#a97c16"),      "zoloto_f":("#f0c95c","ushanka","#a97c16"),
}
def dark(h, f=.72):
    h=h.lstrip("#"); r,g,b=(int(h[i:i+2],16) for i in (0,2,4))
    return "#%02x%02x%02x" % (int(r*f), int(g*f), int(b*f))

def topper(kind, c2, cx=50, cy=50, R=30):
    T = cy - R
    if kind=="beanie":  return (f'<path d="M{cx-24} {T+11} a24 24 0 0 1 48 0 q-24 -9 -48 0 Z" fill="{c2}" stroke="{INK}" stroke-width="2"/>'
                                f'<circle cx="{cx}" cy="{T-3}" r="4.5" fill="{c2}" stroke="{INK}" stroke-width="2"/>')
    if kind=="bow":     return (f'<path d="M{cx-14} {T+2} l-9 -8 l0 15 Z M{cx+14} {T+2} l9 -8 l0 15 Z" fill="{c2}" stroke="{INK}" stroke-width="2"/>'
                                f'<circle cx="{cx}" cy="{T+3}" r="5" fill="{c2}" stroke="{INK}" stroke-width="2"/>')
    if kind=="tie":     return (f'<path d="M{cx-6} {cy+24} l6 -6 l6 6 l-3 14 h-6 Z" fill="{c2}" stroke="{INK}" stroke-width="2"/>')
    if kind=="cap":     return (f'<path d="M{cx-23} {T+12} a23 23 0 0 1 46 0 Z" fill="{c2}" stroke="{INK}" stroke-width="2"/>'
                                f'<path d="M{cx+18} {T+11} q14 1 14 6 q0 4 -12 4 Z" fill="{c2}" stroke="{INK}" stroke-width="2"/>')
    if kind=="kerchief":return (f'<path d="M{cx-24} {T+12} a24 24 0 0 1 48 0 q-24 -10 -48 0 Z" fill="{c2}" stroke="{INK}" stroke-width="2"/>'
                                f'<path d="M{cx+20} {T+12} q10 3 8 12 q-7 2 -10 -6 Z" fill="{c2}" stroke="{INK}" stroke-width="2"/>')
    if kind=="cook":    return (f'<path d="M{cx-19} {T+11} a19 19 0 0 1 38 0 Z" fill="{c2}" stroke="{INK}" stroke-width="2"/>'
                                f'<rect x="{cx-22}" y="{T+8}" width="44" height="7" rx="3.5" fill="#f6f4ef" stroke="{INK}" stroke-width="2"/>')
    if kind=="helmet":  return (f'<path d="M{cx-25} {T+13} a25 25 0 0 1 50 0 Z" fill="{c2}" stroke="{INK}" stroke-width="2"/>'
                                f'<path d="M{cx-27} {T+12} h54 q3 0 3 4 q0 4 -5 4 h-50 q-5 0 -5 -4 q0 -4 3 -4 Z" fill="{dark(c2)}" stroke="{INK}" stroke-width="2"/>')
    if kind=="cans":    return (f'<path d="M{cx-26} {cy-4} a26 26 0 0 1 52 0" fill="none" stroke="{c2}" stroke-width="4"/>'
                                f'<rect x="{cx-32}" y="{cy-8}" width="10" height="16" rx="4" fill="{c2}" stroke="{INK}" stroke-width="2"/>'
                                f'<rect x="{cx+22}" y="{cy-8}" width="10" height="16" rx="4" fill="{c2}" stroke="{INK}" stroke-width="2"/>')
    if kind=="crown":   return (f'<path d="M{cx-20} {T+10} l0 -13 l7 6 l7 -11 l6 9 l6 -9 l7 11 l7 -6 l0 13 Z" fill="{c2}" stroke="{INK}" stroke-width="2"/>')
    if kind=="kokoshnik":return(f'<path d="M{cx-20} {T+12} q0 -20 20 -20 q20 0 20 20 q-20 -8 -40 0 Z" fill="{c2}" stroke="{INK}" stroke-width="2"/>'
                                f'<circle cx="{cx}" cy="{T-2}" r="3" fill="#c8322a" stroke="{INK}" stroke-width="1.6"/>')
    if kind=="helm2":   return (f'<circle cx="{cx}" cy="{cy}" r="{R+5}" fill="none" stroke="#f6f4ef" stroke-width="4" opacity=".95"/>'
                                f'<path d="M{cx-26} {cy-12} a28 28 0 0 1 52 0 q-26 -9 -52 0 Z" fill="{c2}" stroke="{INK}" stroke-width="2"/>')
    if kind=="tophat":  return (f'<rect x="{cx-13}" y="{T-18}" width="26" height="21" fill="{c2}" stroke="{INK}" stroke-width="2"/>'
                                f'<rect x="{cx-21}" y="{T+1}" width="42" height="6" rx="3" fill="{c2}" stroke="{INK}" stroke-width="2"/>')
    if kind=="beret":   return (f'<path d="M{cx-21} {T+10} q0 -14 21 -14 q21 0 21 14 q-21 -6 -42 0 Z" fill="{c2}" stroke="{INK}" stroke-width="2"/>'
                                f'<circle cx="{cx+6}" cy="{T-5}" r="3.4" fill="{c2}" stroke="{INK}" stroke-width="1.8"/>')
    if kind=="ushanka": return (f'<path d="M{cx-24} {T+12} a24 24 0 0 1 48 0 Z" fill="{c2}" stroke="{INK}" stroke-width="2"/>'
                                f'<rect x="{cx-27}" y="{T+9}" width="54" height="8" rx="4" fill="{dark(c2,1.3)}" stroke="{INK}" stroke-width="2"/>'
                                f'<path d="M{cx-27} {T+16} q-7 3 -7 12 q0 8 7 8 q6 0 6 -7 Z" fill="{c2}" stroke="{INK}" stroke-width="2"/>'
                                f'<path d="M{cx+27} {T+16} q7 3 7 12 q0 8 -7 8 q-6 0 -6 -7 Z" fill="{c2}" stroke="{INK}" stroke-width="2"/>')
    if kind=="noodle":  return (f'<ellipse cx="{cx}" cy="{T+4}" rx="15" ry="6" fill="{c2}" stroke="{INK}" stroke-width="2"/>'
                                f'<path d="M{cx-8} {T} q3 -9 -1 -14 M{cx+2} {T-2} q3 -10 -1 -15" fill="none" stroke="#c9c2ae" stroke-width="2.2" stroke-linecap="round"/>')
    return ""

def smesh(cid, name, price, theme):
    body, top, c2 = LOOK[cid]
    t = TIER(price); cx, cy, R = 50, 50, 30
    d = dark(body)
    limbs = "".join(
        f'<path d="{p}" fill="none" stroke="{INK}" stroke-width="3.4" stroke-linecap="round"/>'
        for p in [f"M{cx-26} {cy+14} l-11 12", f"M{cx+26} {cy+14} l11 12",
                  f"M{cx-11} {cy+29} l-4 13", f"M{cx+11} {cy+29} l4 13"])
    feet = "".join(f'<ellipse cx="{x}" cy="{cy+44}" rx="6" ry="3.4" fill="{INK}"/>' for x in (cx-16, cx+16))
    eyes = (f'<circle cx="{cx-10}" cy="{cy-6}" r="11" fill="#fff" stroke="{INK}" stroke-width="2.4"/>'
            f'<circle cx="{cx+10}" cy="{cy-6}" r="11" fill="#fff" stroke="{INK}" stroke-width="2.4"/>'
            f'<circle cx="{cx-8}" cy="{cy-4}" r="4.6" fill="{INK}"/><circle cx="{cx+12}" cy="{cy-4}" r="4.6" fill="{INK}"/>'
            f'<circle cx="{cx-10}" cy="{cy-7}" r="1.7" fill="#fff"/><circle cx="{cx+10}" cy="{cy-7}" r="1.7" fill="#fff"/>')
    mouth = f'<path d="M{cx-8} {cy+12} q8 8 16 0" fill="none" stroke="{INK}" stroke-width="2.6" stroke-linecap="round"/>'
    cheeks = (f'<circle cx="{cx-21}" cy="{cy+8}" r="5" fill="#e79aa0" opacity=".55"/>'
              f'<circle cx="{cx+21}" cy="{cy+8}" r="5" fill="#e79aa0" opacity=".55"/>')
    fs = 7.0 if len(name) > 15 else 8.4
    return f'''<svg viewBox="0 0 100 128" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="{name}">
<defs><clipPath id="sm_{cid}"><path d="M50 7 L90 19 V56 Q90 88 50 102 Q10 88 10 56 V19 Z"/></clipPath>
<radialGradient id="sg_{cid}" cx="36%" cy="30%" r="72%">
<stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<path d="M50 2 L95 15 V56 Q95 92 50 108 Q5 92 5 56 V15 Z" fill="{RIM[t]}"/>
<path d="M50 7 L90 19 V56 Q90 88 50 102 Q10 88 10 56 V19 Z" fill="#dfe8f0"/>
<g clip-path="url(#sm_{cid})">
  <circle cx="50" cy="26" r="34" fill="#eef4fa"/>
  {limbs}{feet}
  <circle cx="{cx}" cy="{cy}" r="{R}" fill="{body}" stroke="{INK}" stroke-width="3"/>
  <circle cx="{cx}" cy="{cy}" r="{R}" fill="url(#sg_{cid})"/>
  {cheeks}{eyes}{mouth}
  {topper(top, c2)}
</g>
<path d="M50 7 L90 19 V56 Q90 88 50 102 Q10 88 10 56 V19 Z" fill="none" stroke="{RIM[t]}" stroke-width="2.6"/>
<path d="M3 88 h94 l-7 11 l7 11 H3 l7 -11 Z" fill="{RIB[t]}" stroke="{INK}" stroke-width="2.1" stroke-linejoin="round"/>
<text x="50" y="103" font-family="Oswald,Impact,sans-serif" font-size="{fs}" font-weight="700"
 letter-spacing="0.3" text-anchor="middle" fill="#f6f4ef">{name.upper()}</text></svg>'''

if __name__ == "__main__":
    import json
    out = {f"smesh/{c}": smesh(c, n, p, t) for c, n, p, t in CHARS}
    json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "out.json"), "w"))
    print("smeshariki", len(out))
