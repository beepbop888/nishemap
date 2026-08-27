"""Самовар — рисунком, а не генератором, но теперь ОБЪЁМНЫМ.

   Почему рисуем сами: три прогона подряд дали кофейник с длинным изогнутым
   носиком — dreamshaper уверенно путает samovar с coffee urn, и запрет «spout»
   не помогает.

   Почему переписано: прошлая версия закрашивала силуэт горизонтальным
   градиентом. `relief()` в medals.py берёт высоту рельефа из ЯРКОСТИ картинки,
   а у одномерного градиента яркость не меняется по вертикали — медаль выходила
   плоской наклейкой рядом с остальными эмблемами, которые нарисованы моделью в
   объёме. Теперь самовар считается как настоящее тело вращения: для каждой
   строки известен полурадиус, глубина z = sqrt(w² - dx²), нормаль берётся из
   градиента карты высот, свет — тот же, что у оправы (сверху-слева). Ручки —
   торы, кран — горизонтальный цилиндр, крышка и шишечка — тела вращения.
   Яркость такой картинки и есть настоящая высота, поэтому чеканка в medals.py
   ложится по форме, а не по контуру.
"""
import numpy as np
from PIL import Image, ImageFilter

S = 900
BRASS_D, BRASS_L = (62, 34, 3), (252, 202, 78)
L = np.array([-0.55, -0.62, 0.56]); L /= np.linalg.norm(L)   # как в medals.py

# профиль половины тулова: (доля высоты сверху вниз, полуширина в долях S)
PROFILE = [(0.00, 0.105), (0.05, 0.135), (0.14, 0.205), (0.28, 0.245),
           (0.46, 0.258), (0.64, 0.240), (0.80, 0.190), (0.92, 0.135), (1.00, 0.120)]

YY, XX = np.mgrid[0:S, 0:S].astype(np.float32)
CX = S / 2.0


def smooth(a, rad):
    """Мягкое размытие карты высот. PIL не умеет фильтровать float-режим 'F',
       а переводить высоту в uint8 — терять миллиметры рельефа: три прохода
       коробочного среднего дают почти гаусс и считаются прямо в float."""
    k = 2 * rad + 1
    for _ in range(3):
        c = np.cumsum(np.pad(a, ((rad + 1, rad), (0, 0)), mode="edge"), axis=0)
        a = (c[k:] - c[:-k]) / k
        c = np.cumsum(np.pad(a, ((0, 0), (rad + 1, rad)), mode="edge"), axis=1)
        a = (c[:, k:] - c[:, :-k]) / k
    return a


def revol(z, y0, y1, half_width, squash=1.0):
    """Тело вращения вокруг вертикальной оси: полурадиус задан по строкам."""
    rows = np.arange(S, dtype=np.float32)
    t = np.clip((rows - y0) / max(y1 - y0, 1e-6), 0.0, 1.0)
    w = half_width(t)
    w = np.where((rows >= y0) & (rows <= y1), w, 0.0)[:, None]
    dx = XX - CX
    inside = np.abs(dx) < w
    d = np.sqrt(np.maximum(w * w - dx * dx, 0.0)) * squash
    np.maximum(z, np.where(inside, d, 0.0), out=z)


def cyl_h(z, x0, x1, cy, r):
    """Горизонтальный цилиндр — кран и его отвод."""
    dy = YY - cy
    inside = (XX >= x0) & (XX <= x1) & (np.abs(dy) < r)
    d = np.sqrt(np.maximum(r * r - dy * dy, 0.0))
    np.maximum(z, np.where(inside, d, 0.0), out=z)


def torus(z, cx, cy, a, b, tube):
    """Ручка: кольцо круглого сечения."""
    q = np.sqrt(((XX - cx) / a) ** 2 + ((YY - cy) / b) ** 2)
    d = (q - 1.0) * ((a + b) * 0.5)          # расстояние до осевой линии кольца
    inside = np.abs(d) < tube
    np.maximum(z, np.where(inside, np.sqrt(np.maximum(tube * tube - d * d, 0.0)), 0.0), out=z)


def build():
    z = np.zeros((S, S), np.float32)
    top, bot = S * 0.30, S * 0.82
    h = bot - top

    ts = np.array([p[0] for p in PROFILE], np.float32)
    ws = np.array([p[1] for p in PROFILE], np.float32) * S
    # Кусочно-линейный профиль даёт излом наклона на каждой узловой точке, а на
    # округлом теле излом читается кольцевой полосой. Сглаживаем ряд полуширин.
    def belly(t):
        w = np.interp(t, ts, ws)
        for _ in range(4):
            w = np.convolve(np.pad(w, 12, mode="edge"), np.ones(25) / 25, "same")[12:-12]
        return w
    revol(z, top, bot, belly)                                             # тулово

    # крышка: приплюснутый купол, труба, шишечка
    revol(z, top - S * 0.055, top + S * 0.045,
          lambda t: S * 0.150 * np.sqrt(np.maximum(1 - (2 * t - 1) ** 2, 0)), 0.70)
    revol(z, top - S * 0.135, top - S * 0.020, lambda t: np.full_like(t, S * 0.048))
    revol(z, top - S * 0.160, top - S * 0.110,
          lambda t: S * 0.070 * np.sqrt(np.maximum(1 - (2 * t - 1) ** 2, 0)), 0.85)
    revol(z, top - S * 0.205, top - S * 0.150,
          lambda t: S * 0.028 * np.sqrt(np.maximum(1 - (2 * t - 1) ** 2, 0)))

    # ручки на плече
    for sgn in (-1, 1):
        torus(z, CX + sgn * S * 0.248, top + h * 0.28, S * 0.068, S * 0.105, S * 0.026)

    # кран: короткий отвод вбок, вентиль и стойка вниз — НЕ длинный носик
    ty = top + h * 0.62
    cyl_h(z, CX, CX + S * 0.310, ty + S * 0.020, S * 0.024)
    revol_x = CX + S * 0.288
    dx, dy = XX - revol_x, YY - (ty + S * 0.058)
    stem = (np.abs(dx) < S * 0.020) & (dy > 0) & (dy < S * 0.075)
    np.maximum(z, np.where(stem, np.sqrt(np.maximum((S * 0.020) ** 2 - dx * dx, 0)), 0), out=z)
    knob = np.sqrt(np.maximum((S * 0.056) ** 2 - (XX - revol_x) ** 2
                              - (YY - (ty - S * 0.016)) ** 2, 0))
    np.maximum(z, knob, out=z)

    # поддон и ножки
    revol(z, bot - S * 0.012, bot + S * 0.030, lambda t: np.full_like(t, S * 0.150), 0.30)
    for sgn in (-1, 1):
        fx = CX + sgn * S * 0.105
        foot = (np.abs(XX - fx) < S * 0.042) & (YY > bot + S * 0.026) & (YY < bot + S * 0.090)
        np.maximum(z, np.where(foot, np.sqrt(np.maximum(
            (S * 0.042) ** 2 - (XX - fx) ** 2, 0)) * 0.8, 0), out=z)

    mask = (z > 0.5).astype(np.float32)
    # лёгкое сглаживание стыков — швы между частями не должны читаться порезами
    z = smooth(z, max(1, int(S / 260)))
    z *= mask

    gy, gx = np.gradient(z)
    nz = S * 0.011                        # чем меньше, тем круче рельеф
    ln = np.sqrt(gx * gx + gy * gy + nz * nz)
    n = (-gx / ln, -gy / ln, nz / ln)
    lam = np.clip(n[0] * L[0] + n[1] * L[1] + n[2] * L[2], 0.0, 1.0)

    d, l = (np.array(c, np.float32) for c in (BRASS_D, BRASS_L))
    # Контраст держим высоким: relief() в medals.py читает ЯРКОСТЬ как высоту,
    # и на вялом градиенте рельеф выходит ватным. Тёмное — по-настоящему тёмное.
    rgb = d + (l - d) * (0.05 + 0.95 * lam)[..., None]
    rgb += 255.0 * (lam ** 30)[..., None] * 0.45          # узкий зеркальный блик
    # Отдельной «каверны» здесь не считаем: на теле вращения она давала кольцевые
    # полосы — усиливала мелкие изломы профиля. Объём и без неё берётся из нормали.

    a = np.asarray(Image.fromarray((mask * 255).astype("uint8")).filter(
        ImageFilter.GaussianBlur(1.1)), np.uint8)
    img = Image.merge("RGBA", Image.fromarray(
        np.clip(rgb, 0, 255).astype("uint8")).split() + (Image.fromarray(a),))
    return img.crop(img.getbbox())


if __name__ == "__main__":
    out = build()
    out.save(".gen/emblems_cut/t25.png")
    print("самовар нарисован:", out.size)
