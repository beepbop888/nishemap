"""Перегенерация с ОТБОРОМ по числам, а не «сгенерировали — посмотрели — не то».

Приёмка меряет не кадр генератора, а ГОТОВЫЙ щит: кандидат сразу режется от
фона и прогоняется через align.fit — ту же посадку, что уйдёт в продукт.
Смотрим два числа:
  • заполнение низа щита — align.py нормирует РАЗМЕР лица, поэтому крупное лицо
    в исходнике не плюс, а минус: корпус кончается выше нижнего края;
  • поворот головы (смещение носа от середины глаз) — иначе выходит анфас.
Перебираем сиды до первого прохождения обоих порогов; если ни один не прошёл,
оставляем лучший по сумме нормированных метрик и пишем это в отчёт.
"""
import sys, os, json, time, torch
import numpy as np, cv2
from PIL import Image
from rembg import remove, new_session
from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler, AutoencoderKL
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import align

MODEL, STYLE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
PX, STEPS = 448, 18
GUID  = float(os.environ.get("GUID", "8.0"))
PRE   = os.environ.get("PRE", "")
FR    = os.environ.get("FRAME", "waist up, full torso in frame, plain background")
SEED0 = int(os.environ.get("SEED", "4400"))
TRIES = int(os.environ.get("TRIES", "6"))
FILL_MIN = float(os.environ.get("FILL_MIN", "0.45"))   # заполнение низа щита
YAW_MIN  = float(os.environ.get("YAW_MIN", "10.0"))    # ниже — читается как анфас
# Верхняя граница поворота. Заказчик уже отвергал партию за «жёсткие профильные
# рендеры»: при 18° и больше лицо уходит в чистый профиль и перестаёт быть
# диснеевским. Порога сверху не было — отбор радостно брал первый же профиль.
YAW_MAX  = float(os.environ.get("YAW_MAX", "999.0"))
CLIP_MAX = float(os.environ.get("CLIP_MAX", "0.06"))   # сколько убора можно срезать щитом
NEG = ("watermark, text, blurry, low quality, deformed face, extra limbs, two people, nsfw, "
       + os.environ.get("EXTRANEG", ""))
CH = json.load(open(os.environ["ROSTER"]))
os.makedirs(OUT, exist_ok=True)

_sess = new_session("u2net")
MATTE = dict(alpha_matting=True, alpha_matting_foreground_threshold=250,
             alpha_matting_background_threshold=15, alpha_matting_erode_size=4)

def judge(img):
    """(заполнение низа, |поворот|, срез убора) готового щита; None — лицо не найдено"""
    bgr = cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2BGR)
    f = align.face_of(bgr)
    if not f: return None
    im, bb, fn = align.norm(remove(img.convert("RGBA"), session=_sess, **MATTE), f)
    if not fn: return None
    canvas, _ = align.fit(im, bb, fn, *align.PINNED)
    clip, touches = align.hat_clip(canvas)
    return align.bottom_fill(canvas), abs(align.yaw_of(f)), clip + (1.0 if touches else 0.0)

def passes(m):
    """Годен ли кадр. Раньше это условие стояло в двух местах и разъезжалось."""
    return (m is not None and m[0] >= FILL_MIN
            and YAW_MIN <= m[1] <= YAW_MAX and m[2] <= CLIP_MAX)

def score(m):
    if m is None: return -1.0
    fill, yaw, clip = m
    over = max(0.0, yaw - YAW_MAX) / 10.0        # перекрут штрафуем, а не поощряем
    return (min(fill, 0.70)/0.70 + min(yaw, min(22.0, YAW_MAX))/22.0
            + max(0.0, 1.0 - clip/max(CLIP_MAX, 1e-3)) - over)

pipe = StableDiffusionPipeline.from_pretrained(MODEL, torch_dtype=torch.float16,
        variant="fp16", safety_checker=None, requires_safety_checker=False)
pipe.scheduler = DPMSolverMultistepScheduler.from_config(
    pipe.scheduler.config, algorithm_type="dpmsolver++", use_karras_sigmas=True)
pipe = pipe.to("mps"); pipe.enable_attention_slicing()
# отдельный fp32-VAE на CPU: дёргать pipe.vae между dtype нельзя — со второго
# кадра идёт чёрный экран (оплачено в two_phase.py), а отдельный экземпляр безопасен
vae = AutoencoderKL.from_pretrained(MODEL, subfolder="vae", torch_dtype=torch.float32).to("cpu")

def decode(lat):
    with torch.no_grad():
        d = vae.decode(lat.to("cpu", torch.float32) / vae.config.scaling_factor).sample
    a = (d/2 + .5).clamp(0, 1)[0].permute(1, 2, 0).numpy()
    return Image.fromarray((a*255).round().astype("uint8"))

report = {}
for cid, who in CH.items():
    prompt = f"{PRE}{STYLE}, {who}, {FR}"
    ntok = len(pipe.tokenizer(prompt).input_ids)
    if ntok > 77: print(f"  ! {cid}: {ntok} токенов — хвост промпта отброшен", flush=True)
    best, best_s, best_m, best_seed = None, -2.0, None, None
    for i in range(TRIES):
        seed = SEED0 + i*7919 + (sum(ord(c) for c in cid) % 9973)
        t = time.time()
        lat = pipe(prompt, negative_prompt=NEG, num_inference_steps=STEPS,
                   guidance_scale=GUID, height=PX, width=PX,
                   generator=torch.Generator("mps").manual_seed(seed),
                   output_type="latent").images
        lat = lat[0].unsqueeze(0) if isinstance(lat, list) else lat
        img = decode(lat.detach())
        m = judge(img); s = score(m)
        ok = passes(m)
        shown = ("лицо не найдено" if m is None else
                 f"низ {m[0]*100:.0f}% поворот {m[1]:.1f} срез убора {m[2]*100:.0f}%")
        print(f"{cid} сид {seed}: {shown} {'OK' if ok else ''} ({time.time()-t:.0f}s)", flush=True)
        # прошедший порог кандидат забирает место безусловно: иначе более «красивый»
        # по сумме баллов, но ЗАВАЛИВШИЙ порог кадр вытеснял бы годный
        if ok or s > best_s: best, best_s, best_m, best_seed = img, s, m, seed
        if ok: break
    best.save(f"{OUT}/{cid}.png")
    # латент от прошлой партии убираем: two_phase.py переиспользовал бы его и
    # тихо вернул старый кадр, если png когда-нибудь удалят
    stale = f"{OUT}/_lat/{cid}.pt"
    if os.path.exists(stale): os.remove(stale)
    report[cid] = dict(seed=best_seed,
                       fill=round(best_m[0]*100) if best_m else None,
                       yaw=round(best_m[1], 1) if best_m else None,
                       hat_clip=round(best_m[2]*100) if best_m else None,
                       passed=passes(best_m))
    json.dump(report, open(f"{OUT}/_search.json", "w"), ensure_ascii=False, indent=1)
    print(f"== {cid}: {'принят' if report[cid]['passed'] else 'ЛУЧШИЙ ИЗ ПЛОХИХ'} "
          f"(сид {best_seed})", flush=True)
bad = [c for c, r in report.items() if not r["passed"]]
print("не добрали порог:", bad or "нет")
print("SEARCHDONE")
