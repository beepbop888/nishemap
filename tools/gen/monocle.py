"""Монокль олигарху — рисунком, а не промптом.

   Генератор трижды подряд выдавал либо очки в две линзы, либо ничего: слово
   monocle в промпте не срабатывает, а negative на «glasses» заодно убивает и
   монокль. Зато YuNet отдаёт координаты глаз, поэтому кольцо с цепочкой можно
   поставить точно на глаз детерминированно.

   ПОРЯДОК ВАЖЕН: appr_src.py пересобирает .gen/appr_full из art/disney и стирает
   нарисованный монокль. Поэтому шаг идёт ПОСЛЕ appr_src.py и ДО align.py:
       cut.py → appr_src.py → monocle.py oligarkh → align.py → mkassets.py
   В art/disney монокль намеренно НЕ впечатан: иначе следующий прогон нарисовал
   бы поверх второй.
"""
import sys, math, os
import cv2, numpy as np
from PIL import Image, ImageDraw

SRC = os.environ.get("SRC", ".gen/appr_full")   # чтобы можно было править ОДНОГО, не трогая партию
GOLD, GOLD_D, GLASS = (226, 184, 66), (140, 100, 18), (232, 240, 248)

def add(cid, side="right"):
    im = Image.open(f"{SRC}/{cid}.png").convert("RGBA")
    bgr = cv2.cvtColor(np.array(im.convert("RGB")), cv2.COLOR_RGB2BGR)
    det = cv2.FaceDetectorYN.create('.gen/yunet.onnx', '', (im.width, im.height), 0.5, 0.3, 5000)
    det.setInputSize((im.width, im.height))
    _, f = det.detect(bgr)
    if f is None or not len(f): return print("лицо не найдено:", cid)
    b = max(f, key=lambda r: r[2]*r[3])
    # YuNet: 4,5 — правый глаз в кадре; 6,7 — левый
    ex, ey = (float(b[4]), float(b[5])) if side == "right" else (float(b[6]), float(b[7]))
    fw = float(b[2])
    # 0.235 давало колечко меньше глазницы, 0.30 заказчик назвал крупным.
    # 0.25 — линза по глазу, бровь не задета, на щите 200 px читается.
    R = fw*float(os.environ.get("MONO_R", "0.25"))
    # Линза садится РОВНО на зрачок. Прежний сдвиг вверх на 2 % ширины лица
    # уводил кольцо к брови — заказчик просил центрировать по глазу.
    # Цепочка вешается с ВНЕШНЕЙ стороны лица: раньше она шла внутрь и
    # перечёркивала нос с усами.
    out = -1.0 if ex < b[0] + b[2]/2 else 1.0
    # YuNet отдаёт центр глаза по зрачку, а на трёхчетвертном ракурсе линза
    # смотрится смещённой внутрь. MONO_DX — доводка по горизонтали в долях
    # ширины лица, плюс вправо НА ГОТОВОМ ЩИТЕ.
    # ОСТОРОЖНО: align.py зеркалит кадры с yaw > 0, чтобы вся партия смотрела в
    # одну сторону. Олигарх как раз такой — три правки подряд двигали монокль
    # вправо в исходнике и, значит, ВЛЕВО на щите. Знак разворачиваем здесь.
    # та же формула, что align.yaw_of: нос правее середины глаз -> кадр зеркалят
    flip = (float(b[8]) - (float(b[4]) + float(b[6]))/2) / max(fw, 1) * 100 > 0
    ex += fw*float(os.environ.get("MONO_DX", "0.12")) * (-1.0 if flip else 1.0)
    lay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    d.ellipse([ex-R, ey-R, ex+R, ey+R], fill=GLASS + (46,))          # стекло
    d.ellipse([ex-R, ey-R, ex+R, ey+R], outline=GOLD_D + (255,), width=max(3, int(R*0.22)))
    r2 = R*0.90
    d.ellipse([ex-r2, ey-r2, ex+r2, ey+r2], outline=GOLD + (255,), width=max(2, int(R*0.11)))
    d.arc([ex-R*0.72, ey-R*0.72, ex+R*0.72, ey+R*0.72], 200, 300, fill=(255, 255, 255, 150),
          width=max(2, int(R*0.10)))                                  # блик на стекле
    # цепочка вниз от нижнего края линзы, наружу от лица
    x, y = ex + out*R*0.35, ey + R*0.94
    for i in range(22):          # до лацкана, иначе цепочка обрывается на скуле
        rr = R*0.085
        d.ellipse([x-rr, y-rr, x+rr, y+rr], outline=GOLD + (235,), width=max(2, int(R*0.055)))
        y += rr*1.5; x += out*abs(math.sin(i*0.9))*R*0.10
    im = Image.alpha_composite(im, lay)
    im.convert("RGB").save(f"{SRC}/{cid}.png")
    print(f"монокль поставлен: {cid} (глаз {ex:.0f},{ey:.0f}, радиус {R:.0f})")

if __name__ == "__main__":
    for cid in sys.argv[1:] or ["oligarkh"]: add(cid)
