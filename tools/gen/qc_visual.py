# -*- coding: utf-8 -*-
"""Визуальный QC: собирает сетки под КАЖДЫЙ пункт чек-листа, чтобы проверять глазами,
   а не на слово. Механические проверки живут отдельно в qa.py."""
import sys, os
sys.path.insert(0, "tools/shield")
from build import CHARS, TIER
from PIL import Image, ImageDraw

STYLES = [s for s in ["disney","pixel","clay","book","toon","sticker","ghibli"]
          if os.path.isdir(f"art/{s}")]
W = 150
def grid(name, ids, note):
    sh = Image.new("RGB", (len(ids)*W, len(STYLES)*W + 22), (30,28,25))
    d = ImageDraw.Draw(sh)
    for c, cid in enumerate(ids):
        d.text((c*W+4, 5), cid, fill=(242,207,92))
    for r, st in enumerate(STYLES):
        for c, cid in enumerate(ids):
            f = f"art/{st}/{cid}.webp"
            if os.path.exists(f):
                sh.paste(Image.open(f).resize((W,W)), (c*W, 22 + r*W))
        d.text((4, 26 + r*W), st, fill=(255,255,255))
    sh.save(f"/tmp/qc_{name}.png")
    print(f"/tmp/qc_{name}.png — {note}")

# 7–10: мимика по уровням, по одному представителю с каждого
tier_rep = {}
for c in CHARS:
    t = TIER(c[2])
    tier_rep.setdefault(t, c[0])
grid("moods", [tier_rep[i] for i in range(4)],
     "уровни: 0 грусть · 1 усталость · 2 довольство (рот закрыт!) · 3 улыбка")
# 11–14: конкретные требования по персонажам
grid("specific", ["oligarkh","oligarkh_f","tsar_f","kosmonavt_f","barista_m","itshnik_m"],
     "монокль · белая шуба+чёрный берет · царица ЖЕНЩИНА · славянская внешность у четверых")
# 15: не «висящие головы» — видно плечи и грудь
grid("bodies", ["zoloto_f","student_f","pvz_m","samokat_f","legenda_f","doshik_f"],
     "у всех должны быть плечи и грудь, не только голова")
print("\nСТИЛЕЙ В ПРОВЕРКЕ:", len(STYLES), STYLES)
