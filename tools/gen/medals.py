"""Медали: металлическая оправа считается по свету, эмблема — сгенерированная.

Что переделано после замечания «выглядит так, будто не старались»:
  • ушла лента-обрубок: она всё равно упиралась в край кадра, а место съедала.
    Медальон занимает теперь 96 % кадра вместо 86 %, эмблема внутри — 93 % диска
    вместо 58 %. Это и есть «крупнее»;
  • ушёл венчик из 48 точек по краю — читался как салфетка. Вместо него мелкая
    насечка (рифление гурта), как на монете;
  • оправа считается как тор: нормаль поворачивается поперёк кольца, свет падает
    сверху-слева, отдельно кладётся блик. Раньше это был плоский градиент,
    повёрнутый на 28°, — отсюда и ощущение картонности;
  • внутреннее поле не чёрное, а глубокий тон того же металла с виньеткой,
    поэтому эмблема лежит НА медали, а не в дырке;
  • рендер 512 px вместо 256.
"""
import os, math, glob
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W = 1024                 # рабочий размер, на выходе делим пополам
OUT_PX = 512
R_OUT, R_IN = 0.480, 0.375        # внешний радиус медали и граница внутреннего поля
EMB = 0.64                        # сторона коробки под эмблему в долях кадра

# тёмный / средний / светлый тон металла
METAL = {
 "tin":    ((78, 84, 90),   (150, 157, 165), (222, 228, 234)),
 "bronze": ((84, 44, 20),   (166, 100, 48),  (238, 176, 112)),
 "silver": ((84, 92, 104),  (160, 170, 183), (238, 244, 250)),
 "gold":   ((112, 74, 10),  (196, 150, 40),  (253, 230, 150)),
}
# ВСЕ медали золотые — по требованию заказчика. Разнобой олово/бронза/серебро
# давал ещё и нелогичный порядок: десятка выходила серебряной, а 25 и 50 — бронзовыми.
TIER = {t: "gold" for t in
        ("t10","t25","t50","t100","t175","t200","t275","t400","t500","t1000","t2000","t2500")}

L = np.array([-0.55, -0.62, 0.56]); L /= np.linalg.norm(L)   # свет сверху-слева

def _grids():
    y, x = np.mgrid[0:W, 0:W].astype(np.float32)
    x = (x - W/2) / W; y = (y - W/2) / W
    r = np.hypot(x, y) + 1e-6
    return x, y, r, x/r, y/r          # плюс единичный радиальный вектор

def _shade(n, dark, mid, light, spec_pow, spec_k):
    """ламберт по нормали + отдельный блик; цвет идёт dark→mid→light"""
    lam = np.clip(n[0]*L[0] + n[1]*L[1] + n[2]*L[2], 0, 1)
    k = (0.18 + 0.82*lam)[..., None]
    dark, mid, light = (np.array(c, np.float32) for c in (dark, mid, light))
    base = np.where(k < 0.5, dark + (mid-dark)*(k/0.5), mid + (light-mid)*((k-0.5)/0.5))
    return base + 255.0 * (lam**spec_pow)[..., None] * spec_k

def medallion(metal):
    dark, mid, light = METAL[metal]
    x, y, r, ux, uy = _grids()
    th = np.arctan2(y, x)

    # ── ОПРАВА: сечение кольца — полуокружность, нормаль едет поперёк
    t = np.clip((r - R_IN) / (R_OUT - R_IN), 0, 1)
    phi = math.pi * (t - 0.5)
    n_rim = (np.sin(phi)*ux, np.sin(phi)*uy, np.cos(phi))
    rim = _shade(n_rim, dark, mid, light, 42, 0.55)
    # рифление гурта — мелкая насечка у внешнего края, как на монете
    mill = 1 + 0.055*np.cos(150*th) * np.clip((t-0.72)/0.28, 0, 1)
    rim *= mill[..., None]

    # ── ВНУТРЕННЕЕ ПОЛЕ: слегка вогнутое, тон металла, а не чёрная дыра
    u = np.clip(r / R_IN, 0, 1)
    psi = 0.42 * math.pi * u
    n_in = (-np.sin(psi)*ux, -np.sin(psi)*uy, np.cos(psi))
    dark_f = tuple(int(c*0.46) for c in dark)     # поле глубже металла — эмблема выходит вперёд
    mid_f  = tuple(int(c*0.58) for c in mid)
    inner = _shade(n_in, dark_f, dark_f, mid_f, 16, 0.10)
    inner *= (1 - 0.30*u**2.2)[..., None]          # виньетка к краю поля

    img = np.where((r < R_IN)[..., None], inner, rim)

    # тёмная линия по стыку поля и оправы + светлая фаска сразу под ней
    seam = np.exp(-((r - R_IN)/0.0055)**2)[..., None]
    img = img*(1 - 0.55*seam) + np.array(dark, np.float32)*0.35*seam
    bev = np.exp(-((r - (R_IN-0.012))/0.006)**2)[..., None]
    img = img*(1 - 0.45*bev) + np.array(light, np.float32)*0.75*bev
    # тёмный кант по внешнему краю — читается на любом фоне
    edge = np.exp(-((r - R_OUT)/0.007)**2)[..., None]
    img = img*(1 - 0.65*edge) + np.array(dark, np.float32)*0.5*edge

    rgb = Image.fromarray(np.clip(img, 0, 255).astype("uint8"))
    a = np.clip((R_OUT - r) / 0.0025, 0, 1)
    return Image.merge("RGBA", rgb.split() + (Image.fromarray((a*255).astype("uint8")),))

def relief(em, dark, mid, light, strength=5.2):
    """Цветная чеканка — эмблема остаётся В СВОИХ ЦВЕТАХ, но получает объём.

       Сплошное золото читалось плохо: по силуэту не понять, что изображено.
       Плоская же картинка выглядела наклейкой. Здесь середина: форму берём из
       рельефа (высота = светотень исходника, нормаль, тот же свет, что у оправы),
       а цвет — собственный цвет предмета. Получается эмаль в золотой оправе.
       Альфа огрубляется: полупрозрачный край пропускал поле медали насквозь."""
    a = np.asarray(em.split()[3], np.float32)/255.0
    mask = (a > 0.45).astype(np.float32)
    if mask.sum() < 16: mask = (a > 0.15).astype(np.float32)
    S_ = max(em.width, em.height)
    blur = lambda arr, rad: np.asarray(Image.fromarray(
        (np.clip(arr, 0, 1)*255).astype("uint8")).filter(ImageFilter.GaussianBlur(max(1, rad))),
        np.float32)/255.0
    dome = blur(mask, S_//30)                       # только скруглённый КРАЙ штампа
    g = np.asarray(em.convert("L"), np.float32)/255.0 * mask
    lo, hi = np.percentile(g[mask > 0], (4, 96)) if mask.sum() else (0.0, 1.0)
    detail = np.clip((g - lo)/max(hi - lo, 1e-3), 0, 1) * mask
    detail = blur(detail, max(1, S_//320))
    h = 0.26*dome + 0.74*detail

    gy, gx = np.gradient(h)
    nz = 1.0/strength
    ln = np.sqrt(gx*gx + gy*gy + nz*nz)
    n = (-gx/ln, -gy/ln, nz/ln)
    lam = np.clip(n[0]*L[0] + n[1]*L[1] + n[2]*L[2], 0, 1)

    rgb = np.asarray(em.convert("RGB"), np.float32)
    # немного поднимаем насыщенность: под рельефным светом цвет иначе сереет
    grey = rgb.mean(axis=2, keepdims=True)
    rgb = np.clip(grey + (rgb - grey)*1.25, 0, 255)
    body = rgb * (0.34 + 0.78*lam)[..., None] + 255.0*(lam**28)[..., None]*0.30
    rimdark = np.clip(dome*3.0, 0, 1)
    body *= (0.66 + 0.34*rimdark)[..., None]
    out = np.clip(body, 0, 255).astype("uint8")
    am = (np.clip(blur(mask, max(1, S_//260))*1.6, 0, 1)*255).astype("uint8")
    return Image.merge("RGBA", Image.fromarray(out).split() + (Image.fromarray(am),))

def make(tid, emblem_path, out_path, out_px=OUT_PX):
    metal = TIER[tid]
    dark, mid, light = METAL[metal]
    card = medallion(metal)

    em = Image.open(emblem_path).convert("RGBA")
    bb = em.getbbox()
    if bb: em = em.crop(bb)
    # вытянутым эмблемам (рыцарь, башня, мост) даём больше места: у них пустые углы,
    # поэтому квадратная коробка занижала их сильнее, чем компактные предметы
    ar = max(em.width, em.height) / max(1, min(em.width, em.height))
    box = int(W * (EMB + 0.08*min(1.0, (ar-1)/0.8)))
    k = min(box/em.width, box/em.height)
    em = em.resize((max(1, round(em.width*k)), max(1, round(em.height*k))), Image.LANCZOS)
    em = relief(em, dark, mid, light)
    ox, oy = int(W/2 - em.width/2), int(W/2 - em.height/2)

    # тень под рельефом — он должен подниматься над полем
    sh = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    sh.paste(Image.new("RGBA", em.size, (0, 0, 0, 165)), (ox+int(W*0.006), oy+int(W*0.009)), em)
    sh = sh.filter(ImageFilter.GaussianBlur(W*0.010))
    card = Image.alpha_composite(card, Image.composite(
        sh, Image.new("RGBA", (W, W), (0, 0, 0, 0)), disc(R_IN)))

    lay = Image.new("RGBA", (W, W), (0, 0, 0, 0)); lay.paste(em, (ox, oy), em)
    card = Image.alpha_composite(card, Image.composite(
        lay, Image.new("RGBA", (W, W), (0, 0, 0, 0)), disc(R_IN - 0.004)))

    # общий глянец поверх всей медали — узкая дуга сверху
    gl = Image.new("L", (W, W), 0)
    ImageDraw.Draw(gl).ellipse([W*0.10, -W*0.34, W*0.90, W*0.42], fill=64)
    gl = gl.filter(ImageFilter.GaussianBlur(W*0.05))
    white = Image.merge("RGBA", (Image.new("L", (W, W), 255),)*3 + (gl,))
    card = Image.alpha_composite(card, Image.composite(
        white, Image.new("RGBA", (W, W), (0, 0, 0, 0)), disc(R_OUT)))
    card.resize((out_px, out_px), Image.LANCZOS).save(out_path)

def disc(rad):
    m = Image.new("L", (W, W), 0)
    ImageDraw.Draw(m).ellipse([W/2-rad*W, W/2-rad*W, W/2+rad*W, W/2+rad*W], fill=255)
    return m

if __name__ == "__main__":
    os.makedirs("art/trophies", exist_ok=True)
    for f in glob.glob("art/trophies/*.webp"):
        if os.path.basename(f)[:-5] not in TIER:
            os.remove(f); print("удалён устаревший тир", os.path.basename(f))
    n = 0; miss = []
    for tid in TIER:
        src = f".gen/emblems_cut/{tid}.png"
        if not os.path.exists(src): miss.append(tid); continue
        tmp = f".gen/_medal_{tid}.png"
        make(tid, src, tmp)
        Image.open(tmp).convert("RGBA").save(
            f"art/trophies/{tid}.webp", "WEBP", quality=88, method=6)
        os.remove(tmp); n += 1
    print("медалей собрано", n, "без эмблемы:", miss or "нет")
