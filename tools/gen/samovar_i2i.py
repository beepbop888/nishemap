"""Самовар: рисунок как каркас, генератор как маляр (img2img).

   Пять текстовых заходов подряд давали кофейник с длинным изогнутым носиком —
   SD 1.5 просто не знает слова samovar. Зато форму мы уже умеем считать сами
   (samovar.py, тело вращения). Отсюда приём: рисованный самовар идёт НЕ в
   медаль, а в img2img как начальная картинка. Силуэт держит композицию, модель
   добавляет то, чего нет у рисунка, — материал, отражения, мелкую грязь. Уйти в
   кофейник она уже не может: форма задана не словами, а пикселями.

   strength — сколько своеволия у модели: 0.35 почти не трогает рисунок,
   0.75 перерисовывает заново (и снова отращивает носик). Рабочая полоса 0.45-0.6.
"""
import os, sys, time
import torch
from PIL import Image
from diffusers import StableDiffusionImg2ImgPipeline, DPMSolverMultistepScheduler, AutoencoderKL

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import samovar

MODEL = os.environ.get("MODEL", "Lykon/dreamshaper-8")
OUT   = os.environ.get("OUT", ".gen/samovar_i2i")
PX    = int(os.environ.get("PX", "512"))
STEPS = int(os.environ.get("STEPS", "30"))
GUID  = float(os.environ.get("GUID", "8.0"))
SEEDS = [int(s) for s in os.environ.get("SEEDS", "101,202,303").split(",")]
STRS  = [float(s) for s in os.environ.get("STRS", "0.45,0.55,0.65").split(",")]

PROMPT = ("a polished brass russian samovar tea urn, ornate antique metalwork, warm brass "
          "reflections, product shot on a dark background, studio lighting, highly detailed")
# Носик — главный враг: именно в него модель превращает кран, если дать волю.
NEG = ("coffee pot, teapot, kettle, long curved spout, jug, vase, cup, person, hands, text, "
       "watermark, blurry, flat, cartoon, drawing, illustration, plastic, toy")


def init_image():
    """Рисованный самовар по центру тёмного поля — фон тот же, что у остальных эмблем."""
    em = samovar.build()
    box = int(PX * 0.86)
    k = min(box / em.width, box / em.height)
    em = em.resize((max(1, round(em.width * k)), max(1, round(em.height * k))), Image.LANCZOS)
    canvas = Image.new("RGB", (PX, PX), (18, 17, 16))
    canvas.paste(em, ((PX - em.width) // 2, (PX - em.height) // 2), em)
    return canvas


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    init = init_image()
    init.save(f"{OUT}/_init.png")
    print("каркас готов:", init.size, flush=True)

    pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
        MODEL, torch_dtype=torch.float16, variant="fp16",
        safety_checker=None, requires_safety_checker=False)
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(
        pipe.scheduler.config, algorithm_type="dpmsolver++", use_karras_sigmas=True)
    pipe = pipe.to("mps"); pipe.enable_attention_slicing()
    # отдельный fp32-VAE на CPU: дёргать pipe.vae между dtype нельзя, со второго
    # кадра идёт чёрный экран — оплачено в two_phase.py
    vae = AutoencoderKL.from_pretrained(MODEL, subfolder="vae", torch_dtype=torch.float32).to("cpu")

    for st in STRS:
        for sd in SEEDS:
            t = time.time()
            lat = pipe(PROMPT, image=init, strength=st, negative_prompt=NEG,
                       num_inference_steps=STEPS, guidance_scale=GUID,
                       generator=torch.Generator("mps").manual_seed(sd),
                       output_type="latent").images
            lat = lat[0].unsqueeze(0) if isinstance(lat, list) else lat
            with torch.no_grad():
                d = vae.decode(lat.detach().to("cpu", torch.float32) / vae.config.scaling_factor).sample
            a = (d / 2 + .5).clamp(0, 1)[0].permute(1, 2, 0).numpy()
            Image.fromarray((a * 255).round().astype("uint8")).save(f"{OUT}/s{st}_{sd}.png")
            print(f"strength {st} сид {sd} ({time.time()-t:.0f}s)", flush=True)
    print("I2IDONE", flush=True)
