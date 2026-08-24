# сборка финальной дисней-страницы; вызывается после интеграции новой партии
import sys, os, base64
sys.path.insert(0,"tools/shield")
from build import CHARS, TIER, RIM, RIB
b64=lambda f: base64.b64encode(open(f,"rb").read()).decode()
def build(fixed_notes, title, outfile):
    THEMES=sorted({c[3] for c in CHARS})
    bgcss="".join(f'.bg-{t}{{background-image:url(data:image/webp;base64,{b64(f"art/bg/{t}.webp")})}}\n'
                  for t in THEMES if os.path.exists(f"art/bg/{t}.webp"))
    SHIELD=("polygon(6% 0%, 94% 0%, 100% 7%, 100% 66%, 88% 86%, 66% 98%, 50% 100%, 34% 98%, 12% 86%, 0% 66%, 0% 7%)")
    rim="".join(f'.t{i} .frame{{background:{RIM[i]}}} .t{i} .rib{{background:{RIB[i]}}}\n' for i in range(4))
    cards=""
    for cid,name,price,theme,sex in CHARS:
        f=f"art/cut/disney/{cid}.webp"
        if not os.path.exists(f): continue
        fx=fixed_notes.get(cid)
        cards+=(f'<figure class="sh t{TIER(price)}{" is-new" if fx else ""}">'
            f'<div class="card"><div class="frame"><div class="inner bg-{theme}">'
            f'<img src="data:image/webp;base64,{b64(f)}" alt="{name}"></div></div>'
            f'<div class="rib{" long" if len(name)>13 else ""}">{name.upper()}</div></div>'
            f'<figcaption>{price or "free"} · {sex}{("<br><b>· "+fx+"</b>") if fx else ""}</figcaption></figure>')
    html=f'''<title>{title}</title>
<style>
:root{{--bg:#f7f5f0;--card:#fff;--ink:#221f1b;--soft:#6b655c;--line:#ddd7cb;--gold:#a97c16;--new:#2f6b4f}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#181714;--card:#221f1b;--ink:#f2efe8;--soft:#a49d92;--line:#38342e;--gold:#e8b93c;--new:#6fbf95}}}}
:root[data-theme="dark"]{{--bg:#181714;--card:#221f1b;--ink:#f2efe8;--soft:#a49d92;--line:#38342e;--gold:#e8b93c;--new:#6fbf95}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);padding:30px 18px 80px;font:400 15px/1.6 ui-monospace,Menlo,monospace}}
.wrap{{max-width:1180px;margin:0 auto}}
h1{{font:700 clamp(25px,4.4vw,38px)/1.08 Oswald,Impact,sans-serif;text-transform:uppercase;margin:0 0 8px}}
p{{margin:0 0 9px;max-width:84ch}}.lede{{color:var(--soft)}}
.row{{display:grid;grid-template-columns:repeat(auto-fill,minmax(138px,1fr));gap:14px;margin-top:14px}}
.sh{{margin:0;position:relative}}
.card{{position:relative;display:block}}
.sh.is-new::before{{content:"ПЕРЕДЕЛАН";position:absolute;top:-7px;left:50%;transform:translateX(-50%);
 z-index:3;background:var(--new);color:#fff;font:700 7.5px/1 Oswald,sans-serif;letter-spacing:.06em;
 padding:3px 7px;border-radius:99px}}
.frame{{clip-path:{SHIELD};padding:3px;aspect-ratio:100/112}}
.inner{{width:100%;height:100%;clip-path:{SHIELD};background-size:cover;background-position:center;
 position:relative;overflow:hidden}}
.inner::after{{content:"";position:absolute;inset:auto 0 0 0;height:46%;
 background:linear-gradient(to bottom,transparent,rgba(0,0,0,.5))}}
/* ЕДИНЫЙ БОКС: фигура всегда в одной рамке, прижата к низу — лента у всех на груди */
.inner img{{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:1;
 filter:drop-shadow(0 2px 5px rgba(0,0,0,.45))}}
/* имя: крупнее и жирнее, лента выше */
.rib{{position:absolute;left:-4px;right:-4px;bottom:15%;padding:5px 8px;text-align:center;
 font:700 12px/1.15 Oswald,Impact,sans-serif;letter-spacing:.02em;color:#fff;
 white-space:nowrap;overflow:hidden;text-overflow:clip;
 text-shadow:0 1px 2px rgba(0,0,0,.5);
 border:2px solid #1e1b17;clip-path:polygon(0 0,100% 0,95% 50%,100% 100%,0 100%,5% 50%);z-index:2}}
.rib.long{{font-size:9.5px;letter-spacing:0}}
figcaption{{font-size:9.5px;color:var(--gold);text-align:center;margin-top:4px;line-height:1.45}}
figcaption b{{color:var(--new);font-weight:600}}
{rim}{bgcss}
</style>
<div class="wrap"><h1>{title}</h1>
<p class="lede">Взгляд в сторону у всех · пояс в кадре · лента в одном месте · имена крупно.</p>
<div class="row">{cards}</div></div>'''
    open(outfile,"w",encoding="utf-8").write(html)
    return len(html)
