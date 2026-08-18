"""Пост-обработка партии: копируем в репозиторий и режем фон.
   Для пиксель-арта alpha matting ОТКЛЮЧЁН — на жёстких краях он съедал торс,
   шапку и волосы (проверено: zoloto_f оставался 21% площади от нормы)."""
import os, sys, glob
from PIL import Image
from rembg import remove, new_session
SP = sys.argv[1]; sess = new_session("u2net")
STYLES = ["disney","pixel","clay","book","toon"]
def cut(im, hard):
    kw = dict(session=sess)
    if not hard:
        kw.update(alpha_matting=True, alpha_matting_foreground_threshold=250,
                  alpha_matting_background_threshold=15, alpha_matting_erode_size=4)
    return remove(im.convert("RGBA"), **kw)
for st in STYLES:
    os.makedirs(f"art/{st}", exist_ok=True); os.makedirs(f"art/cut/{st}", exist_ok=True)
    src = f"{SP}/gen/v3_{st}"
    if not os.path.isdir(src): continue
    for f in sorted(glob.glob(f"{src}/*.png")):
        cid = os.path.basename(f)[:-4]
        im = Image.open(f).convert("RGB")
        im.resize((224,224), Image.LANCZOS).save(f"art/{st}/{cid}.webp","WEBP",quality=80,method=6)
        c = cut(im, hard=(st == "pixel"))
        bb = c.getbbox()
        if bb: c = c.crop(bb)
        # страховка: если вырезка съела больше 35% высоты — берём без матирования
        if c.size[1] < im.size[1] * 0.65 and not (st == "pixel"):
            c = cut(im, hard=True); bb = c.getbbox()
            if bb: c = c.crop(bb)
        c.thumbnail((208,208), Image.LANCZOS)
        c.save(f"art/cut/{st}/{cid}.webp","WEBP",quality=82,method=6)
    print("done", st, flush=True)
print("POSTDONE")
