# Медали: детерминированная металлическая оправа + сгенерированная эмблема внутри.
# Тот же принцип, что у аватаров: генерация внутри собранной рамки — единый масштаб,
# свет и фон у всех восьми, чего генератор сам по себе не держит.
import os, math
from PIL import Image, ImageDraw, ImageFilter, ImageChops

S = 512  # рабочий размер, потом вниз
# металлы совпадают с тирами щитов: олово / бронза / серебро / золото
METAL = {
 "tin":    [(120,124,128),(196,200,204),(88,92,96)],
 "bronze": [(120,72,32),(226,158,86),(84,48,20)],
 "silver": [(118,126,136),(226,232,238),(84,92,102)],
 "gold":   [(150,104,20),(250,214,110),(110,74,12)],
}
TIER = {"t10":"tin","t25":"bronze","t50":"bronze","t100":"silver",
        "t175":"silver","t275":"gold","t400":"gold","t550":"gold"}
RIBBON = {"tin":(92,96,102),"bronze":(140,62,38),"silver":(58,84,120),"gold":(150,30,38)}

def radial(size, inner, outer):
    """мягкий радиальный градиент — база для металла"""
    img = Image.new("L", (size, size))
    px = img.load()
    c = size/2
    for y in range(size):
        for x in range(size):
            d = math.hypot(x-c, y-c)/c
            px[x,y] = max(0, min(255, int(255*(1-d))))
    return img

def brushed(size, metal):
    """кольцо: радиальный переход + косой блик, без рисования от руки"""
    dark, light, edge = METAL[metal]
    base = Image.new("RGB", (size, size), dark)
    grad = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(grad)
    for i in range(size):
        t = i/size
        # диагональный переход тёмное→светлое→тёмное даёт металлический отблеск
        k = math.sin(math.pi*t)
        col = tuple(int(dark[j] + (light[j]-dark[j])*k) for j in range(3))
        d.line([(0,i),(size,i)], fill=col)
    grad = grad.rotate(28, resample=Image.BICUBIC, fillcolor=dark)
    out = Image.blend(base, grad, 0.85)
    hi = radial(size, light, dark).filter(ImageFilter.GaussianBlur(size//14))
    return Image.composite(Image.new("RGB",(size,size),light), out, hi.point(lambda v: v//3))

def ring_mask(size, r_out, r_in):
    m = Image.new("L",(size,size),0)
    d = ImageDraw.Draw(m); c=size/2
    d.ellipse([c-r_out,c-r_out,c+r_out,c+r_out], fill=255)
    d.ellipse([c-r_in,c-r_in,c+r_in,c+r_in], fill=0)
    return m

def disc_mask(size, r):
    m = Image.new("L",(size,size),0); c=size/2
    ImageDraw.Draw(m).ellipse([c-r,c-r,c+r,c+r], fill=255)
    return m

def make(tid, emblem_path, out_path):
    metal = TIER[tid]
    dark, light, edge = METAL[metal]
    card = Image.new("RGBA",(S,S),(0,0,0,0))
    c = S/2
    R  = S*0.43      # внешний радиус медали
    Ri = S*0.325      # внутренний диск

    # лента сверху — две наклонные полосы, уходят под медаль
    rib = Image.new("RGBA",(S,S),(0,0,0,0)); rd = ImageDraw.Draw(rib)
    rc = RIBBON[metal]
    rd.polygon([(c-S*0.155, S*0.00),(c-S*0.005, S*0.00),(c+S*0.085, S*0.42),(c-S*0.075, S*0.42)],
               fill=rc+(255,))
    rd.polygon([(c+S*0.005, S*0.00),(c+S*0.155, S*0.00),(c+S*0.075, S*0.42),(c-S*0.085, S*0.42)],
               fill=tuple(int(v*0.72) for v in rc)+(255,))
    card = Image.alpha_composite(card, rib)

    # оправа
    metal_img = brushed(S, metal).convert("RGBA")
    card.paste(metal_img, (0,0), ring_mask(S, R, Ri*0.98))
    # тёмная окантовка снаружи и внутри — читаемость на любом фоне
    d = ImageDraw.Draw(card)
    d.ellipse([c-R,c-R,c+R,c+R], outline=edge+(255,), width=max(2,S//120))
    d.ellipse([c-Ri,c-Ri,c+Ri,c+Ri], outline=edge+(255,), width=max(2,S//150))

    # внутренний диск — тёмный, чтобы эмблема читалась
    inner = Image.new("RGBA",(S,S),(0,0,0,0))
    ImageDraw.Draw(inner).ellipse([c-Ri,c-Ri,c+Ri,c+Ri],
        fill=tuple(int(v*0.55) for v in dark)+(255,))
    glow = Image.new("RGBA",(S,S),(0,0,0,0))
    gr = radial(S, light, dark).filter(ImageFilter.GaussianBlur(S//10)).point(lambda v: int(v*0.55))
    glow.paste(Image.new("RGBA",(S,S), light+(255,)), (0,0), gr)
    inner = Image.alpha_composite(inner, Image.composite(glow, Image.new("RGBA",(S,S),(0,0,0,0)),
                                                          disc_mask(S,Ri)))
    card = Image.alpha_composite(card, Image.composite(inner, Image.new("RGBA",(S,S),(0,0,0,0)),
                                                       disc_mask(S,Ri)))

    # эмблема
    em = Image.open(emblem_path).convert("RGBA")
    bb = em.getbbox()
    if bb: em = em.crop(bb)
    box = int(Ri*1.80)
    em.thumbnail((box, box), Image.LANCZOS)
    from PIL import ImageEnhance
    rgb = ImageEnhance.Brightness(em.convert("RGB")).enhance(1.22)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.12)
    em = Image.merge("RGBA", rgb.split() + (em.split()[3],))
    card.paste(em, (int(c-em.width/2), int(c-em.height/2)), em)

    # зубчики по краю — признак медали, чистая геометрия
    notch = Image.new("RGBA",(S,S),(0,0,0,0)); nd = ImageDraw.Draw(notch)
    for i in range(48):
        a = 2*math.pi*i/48
        x,y = c+math.cos(a)*R, c+math.sin(a)*R
        r = S*0.011
        nd.ellipse([x-r,y-r,x+r,y+r], fill=light+(200,))
    card = Image.alpha_composite(notch, card)
    card.save(out_path)

if __name__ == "__main__":
    os.makedirs("art/trophies", exist_ok=True)
    n=0
    for tid in TIER:
        src=f".gen/emblems/{tid}.png"
        if not os.path.exists(src): continue
        make(tid, f".gen/emblems_cut/{tid}.png", f"/tmp/medal_{tid}.png"); n+=1
    print("medals", n)
