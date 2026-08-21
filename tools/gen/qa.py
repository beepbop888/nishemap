# -*- coding: utf-8 -*-
"""Механическая проверка партии ПЕРЕД показом. Всё, что можно поймать кодом — ловим кодом.
   Запуск: python3 tools/gen/qa.py    Выход != 0 — партию не показывать."""
import sys, os, re, glob, json
sys.path.insert(0, "tools/shield")
from build import CHARS, TIER
from PIL import Image
import numpy as np

STYLES = ["disney","pixel","clay","book","toon","sticker","ghibli"]
fail, warn = [], []
def F(msg): fail.append(msg)
def W(msg): warn.append(msg)

# 1. Состав: каждый архетип парой, пол проставлен верно, цены в паре совпадают
pairs = {}
for cid,name,price,theme,sex in CHARS:
    want = "ж" if (cid.endswith("_f") or cid in ("barista_f","pvz_f","shaurmaster_f","tsar_f")) else "м"
    if sex != want: F(f"пол: {cid} помечен «{sex}», должно «{want}»")
    base = re.sub(r'_(m|f)$','',cid)
    pairs.setdefault(base, []).append((cid, price))
for b,v in pairs.items():
    if len(v) != 2: F(f"нет пары: {b} → {[x[0] for x in v]}")
    elif v[0][1] != v[1][1]: F(f"разная цена в паре {b}: {v}")

# 2. Полнота: у каждого стиля все персонажи и вырезки
for st in STYLES:
    for cid,_,_,_,_ in CHARS:
        for d in (f"art/{st}", f"art/cut/{st}"):
            if not os.path.exists(f"{d}/{cid}.webp"): F(f"нет файла {d}/{cid}.webp")

# 3. Вырезка не съела тело: высота не меньше 60 % от самой высокой в стиле
for st in STYLES:
    fs = glob.glob(f"art/cut/{st}/*.webp")
    if not fs: continue
    hs = {f: Image.open(f).size[1] for f in fs}
    top = max(hs.values())
    for f,h in hs.items():
        if h < top*0.6: F(f"обрезка съела тело: {f} — {h}px при максимуме {top}px")

# 4. Ореол. Белую одежду от ореола отличает МЕСТО: ореол лежит кольцом по краю
#    силуэта, а белый скафандр или шуба — внутри. Меряем только кромку.
#    Стикеры пропускаем: белая обводка там и есть стиль.
from PIL import ImageFilter
for st in STYLES:
    if st == "sticker": continue
    for f in glob.glob(f"art/cut/{st}/*.webp"):
        if os.path.basename(f).startswith("kosmonavt"): continue   # белый скафандр — не ореол
        im = Image.open(f).convert("RGBA")
        a = np.asarray(im)
        alpha = Image.fromarray(a[..., 3])
        k = max(3, int(min(im.size) * 0.16) | 1)
        core = np.asarray(alpha.filter(ImageFilter.MinFilter(k)))   # силуэт, ужатый внутрь
        rim = (a[..., 3] > 200) & (core <= 200)                      # только кромка
        if rim.sum() < 80: continue
        white_rim = ((a[..., 0] > 235) & (a[..., 1] > 235) & (a[..., 2] > 235) & rim).sum() / rim.sum()
        if white_rim > 0.30: F(f"ореол по кромке: {f} — {white_rim*100:.0f}%")
        elif white_rim > 0.22: W(f"возможен ореол: {f} — {white_rim*100:.0f}%")

# 4b. Берет: цвет свободный (белый разрешён), поэтому проверяем только НАЛИЧИЕ
#     головного убора — чтобы олигархиня не оказалась простоволосой.
for st in STYLES:
    f = f"art/cut/{st}/oligarkh_f.webp"
    if not os.path.exists(f): continue
    im = Image.open(f).convert("RGBA"); a_ = np.asarray(im)
    top = a_[: int(a_.shape[0] * 0.18)]
    if (top[..., 3] > 200).sum() < 40:
        F(f"нет головного убора: {f}")

# 4c. Пиксель-арт должен оставаться пиксель-артом. Длинные промпты размывали
#     стилевой токен, и половина картинок превращалась в гладкую живопись.
#     Меряем объективно: у настоящего пикселя мало уникальных цветов.
if "pixel" in STYLES:
    for f in glob.glob("art/pixel/*.webp"):
        im = Image.open(f).convert("RGB").resize((128, 128), Image.NEAREST)
        a = np.asarray(im).reshape(-1, 3)
        uniq = len(np.unique(a // 8, axis=0))
        if uniq > 1500: F(f"пиксель потерял стиль: {f} — {uniq} цветов (норма < 1500)")
        elif uniq > 1300: W(f"пиксель на грани: {f} — {uniq} цветов")

# 5. Фоны на месте
for t in sorted({c[3] for c in CHARS}):
    if not os.path.exists(f"art/bg/{t}.webp"): F(f"нет фона art/bg/{t}.webp")

# 6. Подписи не дублируются без различителя
seen = {}
for cid,name,price,theme,sex in CHARS:
    k = (name, sex)
    if k in seen: F(f"дубль подписи: «{name}» ({sex}) у {seen[k]} и {cid}")
    seen[k] = cid

# 7. Приложение: ростер собран из сгенерированного, старых персонажей нет
app = open("js/app.js", encoding="utf-8").read()
for ghost in ["babushka","rabotyaga","kurier","gopnik","dvornik","hokkeist","figuristka","balerina"]:
    if f'"{ghost}"' in app: F(f"в приложении остался несогласованный персонаж: {ghost}")
if "NISHEMAP_AVMETA" not in app: F("приложение не подключено к сгенерированным аватарам")
if not os.path.exists("assets/avatars.js"): F("нет assets/avatars.js")
idx = open("index.html", encoding="utf-8").read()
if "assets/avatars.js" not in idx: F("avatars.js не подключён в index.html")
if "t.me/nishemap_bot/map" not in idx: F("нет кнопки открытия мини-аппа")

# 8. Обещанного вектора в странице быть не должно — рисовать нельзя
if os.path.exists("shields.html"):
    page = open("shields.html", encoding="utf-8").read()
    if "<svg" in page: F(f"в странице {page.count('<svg')} рисованных SVG — нарушение «не рисовать»")

print(f"ПРОВАЛОВ: {len(fail)}   предупреждений: {len(warn)}")
for m in fail: print("  ✗", m)
for m in warn[:10]: print("  ~", m)
sys.exit(1 if fail else 0)
