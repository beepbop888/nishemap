# Выравнивание по ЛИЦУ (YuNet), а не по рамке картинки.
# Кадры генератора различаются: у одного лицо занимает 118 px, у другого 224 —
# поэтому при подгонке по bounding box персонажи вставали в щите по-разному.
# Здесь лицо у всех одного размера и на одной высоте; результат запекается
# в готовый холст 400x448 (пропорция внутренней области щита).
import os, glob, json
import cv2, numpy as np
from PIL import Image

CW, CH = 400, 448
SRC, CUT = ".gen/v3_disney", ".gen/cut_full"
REFS = ["zapas_f", "barista_f"]        # эталоны, выбранные заказчиком
_det = cv2.FaceDetectorYN.create('.gen/yunet.onnx','',(320,320),0.5,0.3,5000)

def face(cid):
    im = cv2.imread(f"{SRC}/{cid}.png")
    h, w = im.shape[:2]; _det.setInputSize((w,h))
    _, f = _det.detect(im)
    if f is None or not len(f): return None
    b = max(f, key=lambda r: r[2]*r[3])
    return dict(x=float(b[0]), y=float(b[1]), w=float(b[2]), h=float(b[3]))

def alpha_bbox(cid):
    im = Image.open(f"{CUT}/{cid}.png")
    return im, im.getbbox()

def targets():
    """где лицо оказывалось у эталонных персонажей — это и есть «правильное место»"""
    fr, ft, fx = [], [], []
    for r in REFS:
        f = face(r); im, bb = alpha_bbox(r)
        if not f or not bb: continue
        ch = bb[3]-bb[1]; cw = bb[2]-bb[0]
        s = (CH*0.90)/ch                              # прежнее правило кадрирования
        px = (CW - cw*s)/2; py = CH - ch*s
        fr.append(f["h"]*s/CH)
        ft.append((py + (f["y"]-bb[1])*s)/CH)
        fx.append((px + (f["x"]-bb[0]+f["w"]/2)*s)/CW)
    return float(np.mean(fr)), float(np.mean(ft)), float(np.mean(fx))

MARGIN = 0.025      # запас над макушкой в долях холста

def place(cid, t_h, t_top, t_cx):
    f = face(cid)
    im, bb = alpha_bbox(cid)
    if not f or not bb: return None
    s = (t_h*CH)/f["h"]                               # масштаб по размеру лица
    T = t_top*CH                                      # целевая высота верха лица
    # высокие уборы (цилиндр, короны, шлемы) торчат выше лица и упирались в край.
    # Ужимаем ТОЛЬКО их и ровно настолько, чтобы влезли: лицо остаётся на той же высоте.
    D = (f["y"] - bb[1]) * s                          # что над лицом при этом масштабе
    m = MARGIN*CH
    k = 1.0 if D <= T - m else max(0.80, (T - m)/max(D, 1))
    s *= k
    im2 = im.resize((max(1,int(im.width*s)), max(1,int(im.height*s))), Image.LANCZOS)
    x = int(t_cx*CW - (f["x"]+f["w"]/2)*s)
    y = int(T - f["y"]*s)
    c = Image.new("RGBA",(CW,CH),(0,0,0,0))
    c.alpha_composite(im2, (x, y))
    return c, k

if __name__ == "__main__":
    th, tt, tx = targets()
    print(f"эталон: лицо {th*100:.1f}% высоты, верх лица {tt*100:.1f}%, центр X {tx*100:.1f}%")
    os.makedirs("art/cut/disney", exist_ok=True)
    n=0; miss=[]; shrunk=[]
    for f in sorted(glob.glob(f"{CUT}/*.png")):
        cid=os.path.basename(f)[:-4]
        r=place(cid, th, tt, tx)
        if r is None: miss.append(cid); continue
        c,k=r
        if k<0.999: shrunk.append((cid, round(k,2)))
        c.resize((200,224), Image.LANCZOS).save(f"art/cut/disney/{cid}.webp","WEBP",quality=76,method=6)
        n+=1
    print("выровнено", n, "пропущено", miss)
    print("ужато под высокий убор:", shrunk)
    json.dump({"face_h":th,"face_top":tt,"face_cx":tx}, open(".gen/align.json","w"))
