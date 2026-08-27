# Вырезка фона для дисней-партии. Раньше шаг жил разовой командой в терминале —
# из-за этого его нельзя было воспроизвести. Параметры матирования сверены
# побайтово со старой партией (.gen/cut_full/office_m.png совпал точно).
# Кадр НЕ обрезаем: align.py сам считает bbox и ставит лицо по эталону.
import os, sys, glob
from PIL import Image
from rembg import remove, new_session

SRC, DST = ".gen/v3_disney", ".gen/cut_full"
MATTE = dict(alpha_matting=True, alpha_matting_foreground_threshold=250,
             alpha_matting_background_threshold=15, alpha_matting_erode_size=4)

only = set(sys.argv[1:])
sess = new_session("u2net")
os.makedirs(DST, exist_ok=True)
os.makedirs("art/disney", exist_ok=True)
n = 0
for f in sorted(glob.glob(f"{SRC}/*.png")):
    cid = os.path.basename(f)[:-4]
    if only and cid not in only: continue
    im = Image.open(f).convert("RGBA")
    remove(im, session=sess, **MATTE).save(f"{DST}/{cid}.png")
    # полный кадр без вырезки — им пользуется страница-превью
    im.convert("RGB").resize((224, 224), Image.LANCZOS).save(
        f"art/disney/{cid}.webp", "WEBP", quality=80, method=6)
    n += 1
    print("cut", cid, flush=True)
print("CUTDONE", n)
