# Числовая проверка ДО показа: направление взгляда и наличие корпуса ниже ленты.
import cv2, glob, os, sys
import numpy as np
from PIL import Image
d=cv2.FaceDetectorYN.create('.gen/yunet.onnx','',(320,320),0.5,0.3,5000)
YAW_MIN=9.0     # меньше — читается как анфас
BODY_MIN=0.30   # доля заполнения ниже ленты
bad_yaw=[]; bad_body=[]; wrong_way=[]; nofa=[]; nosrc=[]
for f in sorted(glob.glob('art/cut/disney/*.webp')):
    cid=os.path.basename(f)[:-5]
    a=np.array(Image.open(f).convert("RGBA").split()[3])>40
    below=a[int(a.shape[0]*0.80):]
    cov=below.sum()/below.size
    if cov<BODY_MIN: bad_body.append((cid, round(cov*100)))
    im=cv2.imread(f'.gen/v3_disney/{cid}.png')
    if im is None: nosrc.append(cid); continue   # исходник партии стёрт — проверить взгляд нечем
    H,W=im.shape[:2]; d.setInputSize((W,H))
    _,fc=d.detect(im)
    if fc is None or not len(fc): nofa.append(cid); continue
    b=max(fc,key=lambda r:r[2]*r[3])
    yaw=float(b[8]-(b[4]+b[6])/2)/b[2]*100
    if abs(yaw)<YAW_MIN: bad_yaw.append((cid, round(yaw,1)))
    elif yaw>0: wrong_way.append((cid, round(yaw,1)))
print("АНФАС (нужен поворот):", bad_yaw or "нет")
print("СМОТРИТ В ДРУГУЮ СТОРОНУ:", wrong_way or "нет")
print("НЕТ КОРПУСА НИЖЕ ЛЕНТЫ:", sorted(bad_body, key=lambda t:t[1]) or "нет")
print("ЛИЦО НЕ НАЙДЕНО:", nofa or "нет")
print("НЕТ ИСХОДНИКА:", nosrc or "нет")
sys.exit(1 if (bad_yaw or wrong_way or bad_body) else 0)
