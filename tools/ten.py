"""Десять стилей на пяти персонажах. Один процесс: модель грузится 11 минут, картинка ~80 сек.
   Скрипт возобновляемый — уже готовые файлы пропускает."""
import sys, os, time, torch
from diffusers import StableDiffusionPipeline

# Стоки глушим явно: базовая SD1.5 иначе дорисовывает водяные знаки.
NEG = ("istock, getty images, shutterstock, alamy, dreamstime, stock photo, watermark, watermarked, "
       "logo, signature, text, letters, caption, "
       "corporate memphis, abstract pattern, wallpaper, seamless tiling, "
       "photo, photorealistic, 3d render, blurry, low quality, jpeg artifacts, "
       "two people, group, crowd, multiple characters, extra limbs, deformed face, cropped head")

STYLES = {
 "enamel":    "cloisonne enamel pin badge, glossy enamel fill, polished gold metal outlines, flat saturated colors, symmetrical, plain dark background",
 "gouache":   "soviet childrens book illustration, gouache paint, flat shapes, warm muted palette, thick confident outlines, folk art",
 "palekh":    "palekh russian lacquer miniature, gold leaf on black lacquer, fine gold linework, jewel tones, ornamental",
 "matryoshka":"painted matryoshka nesting doll, glossy lacquered wood, folk floral ornament, red gold and green, simple painted face",
 "agitprop":  "soviet constructivist propaganda poster, bold geometric shapes, red black and cream only, angular, high contrast, rodchenko",
 "lubok":     "russian lubok folk woodcut print, hand coloured engraving, naive drawing, thick ink lines, aged paper",
 "mosaic":    "moscow metro smalt mosaic, small glass tesserae, monumental soviet mosaic, rich jewel colors, gold grout",
 "stamp":     "vintage soviet postage stamp engraving, fine line etching, limited two color print, perforated edge",
 "papercut":  "layered paper cut craft illustration, stacked coloured paper, soft drop shadows between layers, clean shapes",
 "gzhel":     "gzhel russian porcelain painting, cobalt blue on white glaze, flowing brush strokes, folk ornament",
}
CHARS = {
 "babushka":   "an old woman in a red headscarf tied under the chin, kind wrinkled face",
 "gopnik":     "a young man in a black tracksuit with white stripes and a flat cap, squinting suspiciously",
 "shaurmaster":"a man with a short black beard wearing a white apron and a red cap",
 "kosmonavt":  "a cosmonaut in a white space helmet with the gold visor lifted so the face is visible",
 "zolotoy":    "a bearded man wearing a golden fur ushanka hat with a red star, grinning",
}
FRAME = "single character, head and shoulders bust portrait, centered composition, one figure only"

pipe = StableDiffusionPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5", torch_dtype=torch.float16,
    safety_checker=None, requires_safety_checker=False).to("mps")
pipe.enable_attention_slicing()
print("loaded", flush=True)
os.makedirs("gen/ten", exist_ok=True)
todo = [(s, c) for s in STYLES for c in CHARS]
done = 0
for s, c in todo:
    p = f"gen/ten/{s}__{c}.png"
    if os.path.exists(p):
        done += 1; continue
    t = time.time()
    img = pipe(f"{STYLES[s]}, {FRAME}, {CHARS[c]}", negative_prompt=NEG,
               num_inference_steps=26, guidance_scale=8.5, height=512, width=512,
               generator=torch.Generator("mps").manual_seed(77)).images[0]
    img.save(p); done += 1
    print(f"[{done}/{len(todo)}] {s}/{c} {time.time()-t:.0f}s", flush=True)
print("ALLDONE", flush=True)
