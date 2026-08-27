"""Отбор эмблем для медалей по числам. Три первых прогона дали тёмные силуэты:
   на тёмном диске медали такая эмблема просто не читается (яркость 29 и 36
   против 130 у нормальных). Плюс кадр иногда упирался в край и срезал объект.
   Поэтому приёмка: яркость вырезанной эмблемы, её доля кадра и отступ от краёв.
"""
import sys, os, json, time, torch
import numpy as np
import cv2
from PIL import Image
from rembg import remove, new_session
from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler, AutoencoderKL

MODEL, OUT, CUT = sys.argv[1], ".gen/emblems", ".gen/emblems_cut"
PX, STEPS = 448, 18
GUID  = float(os.environ.get("GUID", "8.0"))
SEED0 = int(os.environ.get("SEED", "7700"))
TRIES = int(os.environ.get("TRIES", "6"))
LUM_MIN  = float(os.environ.get("LUM_MIN", "95"))     # ниже — тонет в тёмном диске
AREA     = (0.10, 0.72)                                # доля кадра
# Отступ от края не годится в приёмку: генератор всегда упирает объект в рамку
# (шесть сидов подряд дали отступ 0 при отличной яркости). Обрезку ловим иначе —
# по доле стороны кадра, занятой объектом: касание угла даёт единицы процентов,
# срезанный бок — десятки.
EDGE_RUN = float(os.environ.get("EDGE_RUN", "0.18"))
# Доля площади, которую должен занимать САМЫЙ БОЛЬШОЙ связный кусок. «Один самовар»
# генератор упорно понимал как чайный сервиз: самовар и две сахарницы по бокам.
# Словами это не лечится, а вот посчитать куски — можно.
SOLO_MIN = float(os.environ.get("SOLO_MIN", "0.82"))
NEG = ("person, people, crowd, hands, text, letters, numbers, watermark, blurry, dark, dim, "
       "multiple objects, pedestal, table, cropped, cut off"
       + (", " + os.environ["EXTRANEG"] if os.environ.get("EXTRANEG") else ""))
CH = json.load(open(os.environ["ROSTER"]))
PREV = ".gen/emblems_search.json"
os.makedirs(OUT, exist_ok=True); os.makedirs(CUT, exist_ok=True)
_sess = new_session("u2net")

def judge(img):
    """(яркость, доля кадра, минимальный отступ от края) для вырезанной эмблемы"""
    c = remove(img.convert("RGBA"), session=_sess)
    bb = c.getbbox()
    if not bb: return None
    a = np.array(c); fg = a[..., 3] > 128
    if fg.sum() < 100: return None
    lum = a[..., :3].max(axis=2)[fg].mean()
    runs = [fg[0].mean(), fg[-1].mean(), fg[:, 0].mean(), fg[:, -1].mean()]
    nlab, _, stats, _ = cv2.connectedComponentsWithStats(fg.astype(np.uint8), 8)
    areas = sorted(stats[1:, cv2.CC_STAT_AREA], reverse=True) if nlab > 1 else [0]
    solo = float(areas[0])/max(fg.sum(), 1)
    return float(lum), float(fg.sum())/(PX*PX), float(max(runs)), solo, c.crop(bb)

def score(m):
    if m is None: return -1.0
    lum, area, run, solo, _ = m
    return (min(lum, 150)/150 + max(0.0, 1 - run/EDGE_RUN) * 0.5
            + (1.0 if AREA[0] <= area <= AREA[1] else 0.0) + min(solo, 1.0))

pipe = StableDiffusionPipeline.from_pretrained(MODEL, torch_dtype=torch.float16,
        variant="fp16", safety_checker=None, requires_safety_checker=False)
pipe.scheduler = DPMSolverMultistepScheduler.from_config(
    pipe.scheduler.config, algorithm_type="dpmsolver++", use_karras_sigmas=True)
pipe = pipe.to("mps"); pipe.enable_attention_slicing()
vae = AutoencoderKL.from_pretrained(MODEL, subfolder="vae", torch_dtype=torch.float32).to("cpu")

def decode(lat):
    with torch.no_grad():
        d = vae.decode(lat.to("cpu", torch.float32) / vae.config.scaling_factor).sample
    a = (d/2 + .5).clamp(0, 1)[0].permute(1, 2, 0).numpy()
    return Image.fromarray((a*255).round().astype("uint8"))

report = {}
for tid, prompt in CH.items():
    ntok = len(pipe.tokenizer(prompt).input_ids)
    if ntok > 77: print(f"  ! {tid}: {ntok} токенов — хвост промпта отброшен", flush=True)
    best, best_s, best_m, best_seed = None, -2.0, None, None
    for i in range(TRIES):
        seed = SEED0 + i*7919 + (sum(ord(c) for c in tid) % 9973)
        t = time.time()
        lat = pipe(prompt, negative_prompt=NEG, num_inference_steps=STEPS, guidance_scale=GUID,
                   height=PX, width=PX, generator=torch.Generator("mps").manual_seed(seed),
                   output_type="latent").images
        lat = lat[0].unsqueeze(0) if isinstance(lat, list) else lat
        img = decode(lat.detach())
        m = judge(img); s = score(m)
        ok = (m is not None and m[0] >= LUM_MIN and AREA[0] <= m[1] <= AREA[1]
              and m[2] <= EDGE_RUN and m[3] >= SOLO_MIN)
        shown = ("не вырезалось" if m is None else
                 f"яркость {m[0]:.0f} площадь {m[1]*100:.0f}% срез {m[2]*100:.0f}% "
                 f"один кусок {m[3]*100:.0f}%")
        print(f"{tid} сид {seed}: {shown} {'OK' if ok else ''} ({time.time()-t:.0f}s)", flush=True)
        # прошедший порог кандидат забирает место безусловно: иначе более «красивый»
        # по сумме баллов, но ЗАВАЛИВШИЙ порог кадр вытеснял бы годный
        if ok or s > best_s: best, best_s, best_m, best_seed = img, s, m, seed
        if ok: break
    # Защита от ухудшения: если ни один кадр не прошёл порог, а прошлый прогон
    # для этого тира был лучше — не трогаем файлы. Иначе неудачный дубль затирает
    # годную эмблему (так был потерян мост: срез 13 % сменился на 67 %).
    ok_now = best_m[0] >= LUM_MIN and AREA[0] <= best_m[1] <= AREA[1] and best_m[2] <= EDGE_RUN
    prev = json.load(open(PREV)).get(tid) if os.path.exists(PREV) else None
    if not ok_now and prev and prev.get("edge_run", 999) < best_m[2]*100 \
            and prev.get("solo", 0) >= best_m[3]*100:
        print(f"== {tid}: ОСТАВЛЕН ПРЕЖНИЙ (был срез {prev['edge_run']}%, новый {best_m[2]*100:.0f}%)",
              flush=True)
        report[tid] = dict(prev, kept=True)
        json.dump(report, open(PREV, "w"), ensure_ascii=False, indent=1)
        continue
    best.save(f"{OUT}/{tid}.png")
    best_m[4].save(f"{CUT}/{tid}.png")
    lat_old = f"{OUT}/_lat/{tid}.pt"
    if os.path.exists(lat_old): os.remove(lat_old)
    report[tid] = dict(seed=best_seed, lum=round(best_m[0]), area=round(best_m[1]*100),
                       edge_run=round(best_m[2]*100), solo=round(best_m[3]*100),
                       passed=bool(best_m[0] >= LUM_MIN and AREA[0] <= best_m[1] <= AREA[1]
                                   and best_m[2] <= EDGE_RUN and best_m[3] >= SOLO_MIN))
    print(f"== {tid}: {'принят' if report[tid]['passed'] else 'ЛУЧШИЙ ИЗ ПЛОХИХ'} (сид {best_seed})", flush=True)
json.dump(report, open(PREV, "w"), ensure_ascii=False, indent=1)
print("не добрали порог:", [t for t, r in report.items() if not r["passed"]] or "нет")
print("EMBDONE")
