"""Генерация всего каста одним процессом: загрузка модели стоит 11 минут,
   а каждая картинка — 70 секунд, поэтому грузим один раз и печатаем всё подряд.
   Стиль задаётся аргументом: python gen/batch.py sticker [seeds]"""
import sys, time, torch, os
from diffusers import StableDiffusionPipeline
sys.path.insert(0, "gen")
from styles import STYLES, CHARS, NEG

style_key = sys.argv[1] if len(sys.argv) > 1 else "sticker"
seeds = [int(x) for x in (sys.argv[2].split(",") if len(sys.argv) > 2 else ["11", "23"])]
style = STYLES[style_key]
out = f"gen/{style_key}"
os.makedirs(out, exist_ok=True)

pipe = StableDiffusionPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5", torch_dtype=torch.float16,
    safety_checker=None, requires_safety_checker=False).to("mps")
pipe.enable_attention_slicing()
print("loaded", flush=True)

for cid, who in CHARS.items():
    for s in seeds:
        p = f"{out}/{cid}_{s}.png"
        if os.path.exists(p):
            continue
        t = time.time()
        img = pipe(f"{style}, {who}", negative_prompt=NEG, num_inference_steps=24,
                   guidance_scale=8.0, height=512, width=512,
                   generator=torch.Generator("mps").manual_seed(s)).images[0]
        img.save(p)
        print(f"{cid}_{s} {time.time()-t:.0f}s", flush=True)
print("ALLDONE", flush=True)
