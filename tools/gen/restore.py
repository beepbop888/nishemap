"""Возвращает персонажа к утверждённой версии из репозитория.

   art/disney/<id>.webp — кадр утверждённой партии, он лежит в гите. Из него
   заново собираются исходник и вырезка канонической партии, после чего
   align.py ставит персонажа в щит как раньше."""
import os, subprocess, sys
from PIL import Image
from rembg import remove, new_session
MATTE = dict(alpha_matting=True, alpha_matting_foreground_threshold=250,
             alpha_matting_background_threshold=15, alpha_matting_erode_size=4)
sess = new_session("u2net")
for cid in sys.argv[1:]:
    subprocess.run(["git", "checkout", "--", f"art/disney/{cid}.webp"], check=True)
    im = Image.open(f"art/disney/{cid}.webp").convert("RGB").resize((448, 448), Image.LANCZOS)
    im.save(f".gen/appr_full/{cid}.png")
    remove(im.convert("RGBA"), session=sess, **MATTE).save(f".gen/appr_cut/{cid}.png")
    print("возвращён к утверждённому:", cid)
