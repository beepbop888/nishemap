"""Готовим выбранные картинки к вставке в приложение:
   вырезаем фон, кадрируем в квадрат, кладём на плашку уровня, жмём в WebP."""
import sys, os, io, json, base64
from PIL import Image
TIER_BG = {"free": (239, 236, 228), "paint": (233, 224, 210),
           "rich": (223, 228, 232), "gold": (245, 230, 184)}
RING    = {"free": (185, 168, 143), "paint": (176, 128, 80),
           "rich": (143, 163, 181), "gold": (201, 162, 63)}

def circle_token(img, tier, size=256):
    from PIL import ImageDraw
    bg = Image.new("RGBA", (size, size), TIER_BG[tier] + (255,))
    im = img.convert("RGBA").resize((size, size), Image.LANCZOS)
    bg.alpha_composite(im)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(bg, (0, 0), mask)
    ImageDraw.Draw(out).ellipse((5, 5, size - 6, size - 6), outline=RING[tier] + (255,), width=9)
    return out

if __name__ == "__main__":
    src, tier, dst = sys.argv[1], sys.argv[2], sys.argv[3]
    try:
        from rembg import remove
        img = remove(Image.open(src))
    except Exception as e:
        print("rembg unavailable (%s) — фон оставляем" % e)
        img = Image.open(src)
    circle_token(img, tier).save(dst, "WEBP", quality=88, method=6)
    print(dst, os.path.getsize(dst), "bytes")
