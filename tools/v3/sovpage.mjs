import { SOVIET, CAST } from './soviet.mjs';
import { writeFileSync } from 'node:fs';
const uri = (s) => 'data:image/svg+xml,' + encodeURIComponent(s);
const PICK = ['student_m','student_f','zapas_m','zapas_f','doshik_f','barista_f','samokat_f','pvz_f',
              'shaurmaster','itshnik_m','tsar','tsar_f','kosmonavt','oligarkh','oligarkh_f','legenda','zoloto'];
const cs = PICK.map(id => CAST.find(c => c.id === id));
const TECH = {
  nupogodi:   ['Рисованная целлулоидная','Жирный чёрный контур, плоская заливка, огромные белки глаз, утрированная мимика. Самый графичный и самый читаемый мелко.'],
  cheburashka:['Кукольная анимация','Ворса и мягкий объём: контура нет вообще, форма держится светом. Фильтр даёт войлочное зерно и блик сверху — как на настоящей кукле.'],
  ezhik:      ['Перекладка','Вырезанные слои бумаги с зерном, туман поверх кадра, приглушённая охра. Единственный стиль с атмосферой, а не только с персонажем.'],
  vinnipuh:   ['Гуашь и восковой мелок','Линия намеренно дрожит — это смещение по шуму, а не небрежность. Фактура мелка поверх заливки, охристая палитра.'],
  plastilin:  ['Пластилин','Всё объёмное и слегка кривое, блики от бокового света. Рельеф считается по силуэту фигуры, поэтому объём честный, а не нарисованный.'],
};
const rows = SOVIET.map(([k, name, note, fn]) => `
<section class="st">
  <header><h3>${name}</h3><span class="yr">${note.split(' — ')[0]}</span></header>
  <p class="tech"><b>${TECH[k][0]}.</b> ${TECH[k][1]}</p>
  <div class="row">${cs.map(c => `<figure><img src="${uri(fn(c))}" alt="${c.n}"></figure>`).join('')}</div>
</section>`).join('');

writeFileSync('/Users/reln/Desktop/Claude Projects/Jaison/avatar-styles.html', `<title>НищеMap — пять советских мультфильмов</title>
<style>
:root{--bg:#f7f5f0;--card:#fff;--ink:#221f1b;--soft:#6b655c;--line:#ddd7cb;--gold:#a97c16}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#181714;--card:#221f1b;--ink:#f2efe8;--soft:#a49d92;--line:#38342e;--gold:#e8b93c}}
:root[data-theme="dark"]{--bg:#181714;--card:#221f1b;--ink:#f2efe8;--soft:#a49d92;--line:#38342e;--gold:#e8b93c}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);padding:30px 18px 80px;font:400 15px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace}
.wrap{max-width:1200px;margin:0 auto}
h1{font:700 clamp(25px,4.4vw,38px)/1.08 Oswald,Impact,sans-serif;text-transform:uppercase;margin:0 0 8px}
h3{font:700 17px/1.2 Oswald,Impact,sans-serif;text-transform:uppercase;margin:0}
p{margin:0 0 9px;max-width:84ch}.lede{color:var(--soft)}
.st{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:16px;margin-bottom:14px}
.st header{display:flex;align-items:baseline;gap:10px}
.yr{font-size:11px;color:var(--soft)}
.tech{font-size:13px;color:var(--soft);margin:6px 0 12px}
.tech b{color:var(--ink)}
.row{display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:8px}
figure{margin:0}figure img{width:100%;display:block}
.box{background:var(--card);border:2px solid var(--gold);border-radius:8px;padding:16px 18px;margin:16px 0}
.box h3{color:var(--gold);margin-bottom:8px}
</style>
<div class="wrap">
<h1>Пять советских мультфильмов</h1>
<p class="lede">Не «советский мультик» одним словом, а пять конкретных фильмов — и, что важнее, <b>пять разных техник производства</b>. Стиль узнаётся по технике, а не по подписи под картинкой.</p>
<p class="lede">Технику тянут SVG-фильтры: смещение по шуму даёт дрожащую линию мелка, рельеф по силуэту — объём пластилина и ворс куклы, зерно с туманом — перекладку. Всё это вектор, ни одной растровой картинки.</p>
${rows}
<div class="box"><h3>Что я вижу</h3>
<p><b>Ну, погоди!</b> — самый практичный. Жирный контур и большие белки читаются в 28 px, а мимику можно гнать до предела.</p>
<p><b>Пластилин</b> — самый нарядный и самый «дорогой» на вид. Объём тут настоящий: свет считается по силуэту фигуры, поэтому каждая новая шапка получает блик сама, без ручной дорисовки.</p>
<p style="margin-bottom:0"><b>Ёжик в тумане</b> — единственный с атмосферой, но он же и самый тихий: в списке рядом с яркими иконками потеряется.</p></div>
</div>`);
console.log('ok');
