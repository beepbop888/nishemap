"""Восстанавливает исходники утверждённой партии из art/disney/*.webp.

   Полноразмерные кадры генератора той партии затёрты последующими прогонами,
   но в репозитории лежат их копии 224x224 — этого хватает: щит всё равно
   рендерится в 200x224. Апскейлим до 448, режем фон теми же параметрами.
"""
import os, glob
from PIL import Image
from rembg import remove, new_session
SRC, OUTF, OUTC = "art/disney", ".gen/appr_full", ".gen/appr_cut"
MATTE = dict(alpha_matting=True, alpha_matting_foreground_threshold=250,
             alpha_matting_background_threshold=15, alpha_matting_erode_size=4)
os.makedirs(OUTF, exist_ok=True); os.makedirs(OUTC, exist_ok=True)
sess = new_session("u2net")
n = 0
for f in sorted(glob.glob(f"{SRC}/*.webp")):
    cid = os.path.basename(f)[:-5]
    im = Image.open(f).convert("RGB").resize((448, 448), Image.LANCZOS)
    im.save(f"{OUTF}/{cid}.png")
    remove(im.convert("RGBA"), session=sess, **MATTE).save(f"{OUTC}/{cid}.png")
    n += 1
print("восстановлено исходников утверждённой партии:", n)
