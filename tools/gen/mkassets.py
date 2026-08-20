"""Собирает assets/avatars.js из art/cut/<стиль> и art/bg. Стиль — переменная AVSTYLE."""
import sys, os, base64, json
sys.path.insert(0, "tools/shield")
from build import CHARS
STYLE = os.environ.get("AVSTYLE", "disney")
out = {c[0]: "data:image/webp;base64," + base64.b64encode(open(f"art/cut/{STYLE}/{c[0]}.webp","rb").read()).decode()
       for c in CHARS if os.path.exists(f"art/cut/{STYLE}/{c[0]}.webp")}
bg = {t: "data:image/webp;base64," + base64.b64encode(open(f"art/bg/{t}.webp","rb").read()).decode()
      for t in sorted({c[3] for c in CHARS}) if os.path.exists(f"art/bg/{t}.webp")}
meta = [{"id":c[0],"t":c[1],"p":c[2],"bg":c[3],"s":c[4]} for c in CHARS]
open("assets/avatars.js","w",encoding="utf-8").write(
  f"// Аватары НищеMap. Стиль: {STYLE}. Пересобрать: AVSTYLE=<стиль> python3 tools/gen/mkassets.py\n"
  "window.NISHEMAP_AVATARS = " + json.dumps(out) + ";\n"
  "window.NISHEMAP_AVBG = " + json.dumps(bg) + ";\n"
  "window.NISHEMAP_AVMETA = " + json.dumps(meta, ensure_ascii=False) + ";\n")
print("built", STYLE, len(out), "avatars")
