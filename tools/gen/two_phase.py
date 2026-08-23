"""Генерация в два прохода. Уроки, оплаченные временем:
   • variant="fp16" — 1.5 ГБ вместо 4.3, иначе машина уходит в своп
   • algorithm_type задаём явно — у dreamshaper в конфиге стоит deis, планировщик падает
   • латенты копим на диск, VAE трогаем ТОЛЬКО во втором проходе: переключение
     fp16<->fp32 внутри цикла давало чёрный кадр начиная со второй картинки
   • attention slicing НЕ выключать: без него 2227 с на кадр вместо 145"""
import sys, os, json, time, torch
from PIL import Image
from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler, AutoencoderKL

MODEL, STYLE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
LORA = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != '-' else None
PX, STEPS = 448, 18
NEG = ("watermark, text, letters, logo, signature, blurry, low quality, deformed face, disfigured, "
       "asymmetric eyes, extra limbs, two people, crowd, cropped head, nsfw, mutated hands, "
       + os.environ.get("EXTRANEG", ""))
FR = os.environ.get("FRAME", "portrait, single character, centered, plain neutral background")
CH = json.load(open(os.environ.get("ROSTER", "gen/roster.json")))
os.makedirs(OUT, exist_ok=True); os.makedirs(f"{OUT}/_lat", exist_ok=True)

todo = [(c, w) for c, w in CH.items() if not os.path.exists(f"{OUT}/{c}.png")]
need = [(c, w) for c, w in todo if not os.path.exists(f"{OUT}/_lat/{c}.pt")]
if need:
    pipe = StableDiffusionPipeline.from_pretrained(MODEL, torch_dtype=torch.float16,
            variant="fp16", safety_checker=None, requires_safety_checker=False)
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(
        pipe.scheduler.config, algorithm_type="dpmsolver++", use_karras_sigmas=True)
    pipe = pipe.to("mps"); pipe.enable_attention_slicing()
    if LORA:
        try:
            pipe.load_lora_weights(LORA)
        except Exception as e:
            # часть LoRA падает с 'list index out of range' — грузим только ключи UNet
            from safetensors.torch import load_file
            sd = load_file(LORA); sd = {k: v for k, v in sd.items() if "lora_unet" in k}
            pipe.load_lora_weights(sd); print("lora(unet-only)", type(e).__name__, flush=True)
    print("phase1", len(need), flush=True)
    for cid, who in need:
        t = time.time()
        lat = pipe(f"{STYLE}, {who}, {FR}", negative_prompt=NEG, num_inference_steps=STEPS,
                   guidance_scale=7.5, height=PX, width=PX,
                   generator=torch.Generator("mps").manual_seed(11), output_type="latent").images
        lat = lat[0].unsqueeze(0) if isinstance(lat, list) else lat
        torch.save(lat.detach().to("cpu", torch.float32), f"{OUT}/_lat/{cid}.pt")
        print(f"lat {cid} {time.time()-t:.0f}s", flush=True)
    del pipe
    import gc; gc.collect()

print("phase2", flush=True)
vae = AutoencoderKL.from_pretrained(MODEL, subfolder="vae", torch_dtype=torch.float32).to("cpu")
for cid, _ in todo:
    f = f"{OUT}/_lat/{cid}.pt"
    if not os.path.exists(f): continue
    lat = torch.load(f)
    with torch.no_grad():
        d = vae.decode(lat / vae.config.scaling_factor).sample
    a = (d / 2 + .5).clamp(0, 1)[0].permute(1, 2, 0).numpy()
    Image.fromarray((a * 255).round().astype("uint8")).save(f"{OUT}/{cid}.png")
print("ALLDONE", flush=True)
