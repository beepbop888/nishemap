# Выравнивание по ЛИЦУ (YuNet), а не по рамке картинки.
# Кадры генератора различаются: у одного лицо занимает 118 px, у другого 224 —
# поэтому при подгонке по bounding box персонажи вставали в щите по-разному.
# Здесь лицо у всех одного размера и на одной высоте, взгляд у всех в одну сторону,
# результат запекается в холст 400x448 (пропорция внутренней области щита).
import os, glob, json
import cv2, numpy as np
from PIL import Image

CW, CH = 400, 448
# исходники и вырезки задаются извне: партии живут в разных папках, и по
# умолчанию тут лежал последний прогон генератора, а не утверждённый набор
# КАНОНИЧЕСКАЯ партия. Раньше по умолчанию стоял последний прогон генератора,
# и обычный запуск align.py молча подменял утверждённый набор черновым.
SRC = os.environ.get("SRC", ".gen/appr_full")
CUT = os.environ.get("CUT", ".gen/appr_cut")
DST = os.environ.get("DST", "art/cut/disney")
REFS = ["zapas_f", "barista_f"]        # эталоны, выбранные заказчиком
MARGIN = 0.025                          # запас над макушкой
_det = cv2.FaceDetectorYN.create('.gen/yunet.onnx', '', (320,320), 0.5, 0.3, 5000)

def face_of(bgr):
    """лицо на уже загруженном кадре — этим же пользуется отбор сидов (search.py),
       чтобы приёмка мерила ровно ту геометрию, которую потом даст align"""
    h, w = bgr.shape[:2]; _det.setInputSize((w,h))
    _, f = _det.detect(bgr)
    if f is None or not len(f): return None
    b = max(f, key=lambda r: r[2]*r[3])
    return dict(x=float(b[0]), y=float(b[1]), w=float(b[2]), h=float(b[3]),
                eye_r=float(b[4]), eye_l=float(b[6]), nose=float(b[8]))

def face(cid):
    return face_of(cv2.imread(f"{SRC}/{cid}.png"))

def yaw_of(f):
    """смещение носа от середины глаз; <0 — голова повёрнута к левому краю кадра"""
    return (f["nose"] - (f["eye_r"] + f["eye_l"])/2) / max(f["w"], 1) * 100

def norm(im, f):
    """Единое направление взгляда: кому досталось зеркальное — отражаем.
       Словами это не лечится: «left» модель понимает то как левый край кадра,
       то как левую руку персонажа, и партия делится пополам."""
    bb = im.getbbox()
    if not f or not bb: return None, None, None
    if yaw_of(f) > 0:
        W = im.width
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
        f = dict(f, x=W - (f["x"] + f["w"]))
        bb = (W - bb[2], bb[1], W - bb[0], bb[3])
    return im, bb, f

def load_norm(cid):
    return norm(Image.open(f"{CUT}/{cid}.png"), face(cid))

def targets():
    """где лицо оказывалось у эталонных персонажей — это и есть «правильное место»"""
    fr, ft, fx = [], [], []
    for r in REFS:
        im, bb, f = load_norm(r)
        if not f: continue
        ch, cw = bb[3]-bb[1], bb[2]-bb[0]
        s = (CH*0.90)/ch
        px, py = (CW - cw*s)/2, CH - ch*s
        fr.append(f["h"]*s/CH)
        ft.append((py + (f["y"]-bb[1])*s)/CH)
        fx.append((px + (f["x"]-bb[0]+f["w"]/2)*s)/CW)
    return float(np.mean(fr)), float(np.mean(ft)), float(np.mean(fx))

def fit(im, bb, f, t_h, t_top, t_cx):
    """посадка вырезки в холст щита; вынесено из place, чтобы тем же кодом
       можно было оценить кандидата ДО записи на диск"""
    s = (t_h*CH)/f["h"]
    T = t_top*CH
    # высокие уборы (цилиндр, короны, шлемы) торчат выше лица и упирались в край.
    # Ужимаем только их и ровно настолько, чтобы влезли: лицо остаётся на месте.
    D = (f["y"] - bb[1]) * s
    m = MARGIN*CH
    k = 1.0 if D <= T - m else max(0.80, (T - m)/max(D, 1))
    s *= k
    im2 = im.resize((max(1,int(im.width*s)), max(1,int(im.height*s))), Image.LANCZOS)
    x = int(t_cx*CW - (f["x"]+f["w"]/2)*s)
    y = int(T - f["y"]*s)
    c = Image.new("RGBA", (CW,CH), (0,0,0,0))
    c.alpha_composite(im2, (x, y))
    return c, k

def fill_fit(im, bb, f, t_cx, top=0.045, face_max=0.55):
    """Посадка «в упор»: фигура тянется от верхнего запаса до самого низа щита.

       Прежняя посадка держала ЛИЦО на фиксированной высоте (29.8 % холста). У кого
       кадр был снят покрупнее, у того корпус кончался выше ленты — отсюда «у одних
       есть тело под лентой, у других нет». Здесь наоборот: низ фигуры всегда упирается
       в низ щита, сверху остаётся запас под убор. Лицо ограничено сверху face_max,
       иначе крупный бюст раздувается на весь щит."""
    ch, cw = bb[3]-bb[1], bb[2]-bb[0]
    s = (CH*(1-top))/max(ch, 1)
    # Потолок на размер лица почти снят. При 0.36 он резал 14 из 28: у поясных
    # кадров лицо занимает половину высоты фигуры, масштаб зажимался, и над головой
    # оставалась пустота — персонаж читался «низким». Заполнить щит важнее, чем
    # выровнять головы: у бюста голова и должна быть крупной.
    if f["h"]*s/CH > face_max: s = face_max*CH/f["h"]
    im2 = im.resize((max(1,int(im.width*s)), max(1,int(im.height*s))), Image.LANCZOS)
    x = int(t_cx*CW - (f["x"]+f["w"]/2)*s)
    y = int(CH - bb[3]*s)                                  # низ фигуры = низ щита
    y = max(y, int(top*CH - bb[1]*s))                      # но макушке оставить запас
    c = Image.new("RGBA", (CW,CH), (0,0,0,0))
    c.alpha_composite(im2, (x, y))
    return c, s

def place(cid, t_h, t_top, t_cx):
    im, bb, f = load_norm(cid)
    if not f: return None
    if os.environ.get("FACEPIN"): return fit(im, bb, f, t_h, t_top, t_cx)
    return fill_fit(im, bb, f, t_cx)

SHIELD = [(6,0),(94,0),(100,7),(100,66),(88,86),(66,98),(50,100),(34,98),(12,86),(0,66),(0,7)]

def _shield_mask():
    from PIL import ImageDraw
    m = Image.new("L", (CW, CH), 0)
    ImageDraw.Draw(m).polygon([(x/100*CW, y/100*CH) for x, y in SHIELD], fill=255)
    return np.array(m) > 127
_SHM = None

def hat_clip(canvas, top=0.30, thr=40):
    """Доля фигуры в ВЕРХНЕЙ части кадра, которая вылезает за щит и будет срезана.
       Щит режет верхние углы под 6 %, поэтому широкий убор (ушанка, цилиндр,
       шапка Мономаха) обрубается, даже когда по прямоугольнику всё влезло."""
    global _SHM
    if _SHM is None: _SHM = _shield_mask()
    a = np.array(canvas.split()[3]) > thr
    n = int(CH*top)
    up, sh = a[:n], _SHM[:n]
    if up.sum() == 0: return 0.0, False
    return float((up & ~sh).sum())/up.sum(), bool(a[0].any())

def bottom_fill(canvas, frac=0.20, thr=40):
    """доля непрозрачных пикселей в нижней части щита — пустой низ виден глазом"""
    a = np.array(canvas.split()[3])
    b = a[int(a.shape[0]*(1-frac)):]
    return float((b > thr).sum())/b.size

# закреплённая посадка (одобренный прогон); AUTOFIT=1 — пересчитать по эталонам
PINNED = (0.298, 0.217, 0.435)

if __name__ == "__main__":
    th, tt, tx = targets() if os.environ.get("AUTOFIT") else PINNED
    print(f"эталон: лицо {th*100:.1f}% высоты, верх лица {tt*100:.1f}%, центр X {tx*100:.1f}%")
    os.makedirs(DST, exist_ok=True)
    n=0; miss=[]; shrunk=[]; flipped=[]
    for fp in sorted(glob.glob(f"{CUT}/*.png")):
        cid = os.path.basename(fp)[:-4]
        fc = face(cid)
        if fc and yaw_of(fc) > 0: flipped.append(cid)
        r = place(cid, th, tt, tx)
        if r is None: miss.append(cid); continue
        c, k = r
        if k < 0.999: shrunk.append((cid, round(k,2)))
        c.resize((200,224), Image.LANCZOS).save(f"{DST}/{cid}.webp","WEBP",quality=76,method=6)
        n += 1
    print("выровнено", n, "пропущено", miss)
    print("отзеркалено для единого направления:", len(flipped))
    print("ужато под высокий убор:", shrunk)
    json.dump({"face_h":th,"face_top":tt,"face_cx":tx}, open(".gen/align.json","w"))
