"""Собирает assets/trophies.js из art/trophies. Ключ — порог в подтверждённых
   ценах (он же номинал банкноты), поэтому app.js берёт картинку по числу."""
import os, glob, base64, json
out = {}
for f in sorted(glob.glob("art/trophies/t*.webp"), key=lambda p: int(os.path.basename(p)[1:-5])):
    key = os.path.basename(f)[1:-5]
    out[key] = "data:image/webp;base64," + base64.b64encode(open(f, "rb").read()).decode()
open("assets/trophies.js", "w", encoding="utf-8").write(
    "// Медали НищеMap: сгенерированная эмблема в собранной металлической оправе.\n"
    "// Пересобрать: python3 tools/gen/medals.py && python3 tools/gen/mktrophies.py\n"
    "window.NISHEMAP_TROPHY_IMG = " + json.dumps(out) + ";\n")
print("собрано медалей в assets/trophies.js:", len(out), sorted(out, key=int))
