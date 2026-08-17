import { pixel, bigface, chibi, toon, minimal } from './five.mjs';
import { FREE, PAID, CAST } from './cast.mjs';
import { writeFileSync } from 'node:fs';
const uri = (s) => 'data:image/svg+xml,' + encodeURIComponent(s);
const P = (id) => CAST.find(c => c.id === id);
const CANDS = [
  ['chibi','Фигурка целиком', chibi, 1.6,
   'Единственная подача, где хоккеиста и космонавта видно чёрным силуэтом — без иконок.',
   'Не круглая: в шапке и в списке придётся кадрировать до головы.'],
  ['toon','Карикатура', toon, 1,
   'Самая тёплая и человечная. Нос, уши и подбородок делают людей, а не иконки.',
   'Мелко нос теряется, и остаётся то же круглое лицо.'],
  ['pixel','Пиксель 28×28', pixel, 1,
   'Лучше всех держится в 28 px и физически не может «наехать» деталями.',
   'Два пикселя на глаз: мимики нет, характер целиком на шапке и одежде.'],
  ['bigface','Крупный портрет', bigface, 1,
   'Самые понятные уборы и лица: голова занимает весь кадр.',
   'Одежду почти не видно, а она у нас половина узнаваемости.'],
  ['minimal','Минимализм', minimal, 1,
   'Выглядит дороже остальных, хорошо ляжет на светлый веб.',
   'Хуже всех читается мелко — фигура мельче, линия тоньше.'],
];
/* Аватар в интерфейсе: шапка, лавка, таблица лидеров, карточка места */
const ctx = (fn, ar) => {
  const crop = ar > 1 ? 'object-fit:cover;object-position:top' : '';
  const av = (id, px) => `<img style="width:${px}px;height:${px}px;${crop}" src="${uri(fn(P(id)))}">`;
  return `<div class="ui">
    <div class="chip">${av('student_m', 28)}<b>стажёр</b><span>12 ₽</span></div>
    <div class="shopgrid">${['doshik_f','samokat_m','tsar_f','zoloto'].map(id =>
      `<div class="scell">${av(id, 62)}<em>${P(id).n}</em><s>${P(id).p}</s></div>`).join('')}</div>
    <div class="board">${['zoloto','oligarkh_f','legenda'].map((id, i) =>
      `<div class="brow"><i>${i + 1}</i>${av(id, 24)}<b>${P(id).n}</b><span>${420 - i * 60}</span></div>`).join('')}</div>
  </div>`;
};
const cards = CANDS.map(([k, name, fn, ar, good, bad]) => `
<section class="cand">
  <header><h3>${name}</h3></header>
  <div class="split">
    <div class="showcase">${[...FREE.slice(0, 2), P('samokat_f'), P('tsar'), P('zoloto_f')]
      .map(c => `<figure><img src="${uri(fn(c))}" alt=""><figcaption>${c.n}</figcaption></figure>`).join('')}</div>
    ${ctx(fn, ar)}
  </div>
  <p class="good"><b>За:</b> ${good}</p>
  <p class="bad"><b>Против:</b> ${bad}</p>
</section>`).join('');

writeFileSync('/Users/reln/Desktop/Claude Projects/Jaison/avatar-styles.html', `<title>НищеMap — выбор стиля</title>
<style>
:root{--bg:#f7f5f0;--card:#fff;--ink:#221f1b;--soft:#6b655c;--line:#ddd7cb;--gold:#a97c16;--accent:#ad2f26;--good:#2f6b4f}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#181714;--card:#221f1b;--ink:#f2efe8;--soft:#a49d92;--line:#38342e;--gold:#e8b93c;--accent:#d9564a;--good:#6fbf95}}
:root[data-theme="dark"]{--bg:#181714;--card:#221f1b;--ink:#f2efe8;--soft:#a49d92;--line:#38342e;--gold:#e8b93c;--accent:#d9564a;--good:#6fbf95}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);padding:30px 18px 80px;font:400 15px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace}
.wrap{max-width:1140px;margin:0 auto}
h1{font:700 clamp(25px,4.4vw,38px)/1.08 Oswald,Impact,sans-serif;text-transform:uppercase;margin:0 0 8px}
h2{font:700 19px/1.2 Oswald,Impact,sans-serif;text-transform:uppercase;letter-spacing:.05em;margin:40px 0 12px;padding-bottom:7px;border-bottom:2px solid currentColor}
h3{font:700 17px/1.2 Oswald,Impact,sans-serif;text-transform:uppercase;margin:0}
p{margin:0 0 9px;max-width:82ch}.lede{color:var(--soft)}
.cand{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:16px;margin-bottom:16px}
.split{display:grid;grid-template-columns:minmax(240px,1.1fr) minmax(260px,1fr);gap:18px;margin:12px 0}
.showcase{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;align-content:start}
.showcase img{width:100%;display:block}
figcaption{font-size:8.5px;color:var(--soft);margin-top:3px;text-align:center}
.ui{background:var(--bg);border:1px solid var(--line);border-radius:7px;padding:10px}
.chip{display:flex;align-items:center;gap:7px;font-size:11px;padding:5px 8px;background:var(--card);
  border:1px solid var(--line);border-radius:99px;width:fit-content;margin-bottom:9px}
.chip img{border-radius:50%}.chip span{color:var(--gold)}
.shopgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:9px}
.scell{background:var(--card);border:1px solid var(--line);border-radius:5px;padding:5px;text-align:center}
.scell img{display:block;margin:0 auto}
.scell em{display:block;font-size:7.5px;font-style:normal;color:var(--soft);margin-top:3px}
.scell s{display:block;font-size:8.5px;text-decoration:none;color:var(--gold)}
.board{background:var(--card);border:1px solid var(--line);border-radius:5px;overflow:hidden}
.brow{display:flex;align-items:center;gap:7px;padding:5px 8px;font-size:10.5px;border-bottom:1px solid var(--line)}
.brow:last-child{border:0}.brow i{font-style:normal;color:var(--soft);width:12px}
.brow img{border-radius:50%}.brow b{flex:1;font-weight:400}.brow span{color:var(--gold)}
.good b{color:var(--good)}.bad b{color:var(--accent)}
.good,.bad{font-size:13.5px;margin:0 0 5px}
.box{background:var(--card);border:2px solid var(--gold);border-radius:8px;padding:16px 18px;margin:16px 0}
.box h3{color:var(--gold);margin-bottom:8px}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th,td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--line)}
th{font:700 10.5px/1.2 Oswald,sans-serif;text-transform:uppercase;letter-spacing:.07em;color:var(--soft)}
</style>
<div class="wrap">
<h1>Выбираем стиль</h1>
<p class="lede">Состав закрыт: бесплатная шестёрка — та самая, что договаривались. Платных теперь <b>22</b>, почти все парами, включая московские типажи. Ниже каждый стиль показан не сеткой, а <b>внутри интерфейса</b> — в шапке, в лавке и в таблице лидеров, в тех размерах, в которых их реально увидят.</p>

<h2>Состав</h2>
<table>
<tr><th>Бесплатно</th><td>студент / студентка · офисный / офисная · запасливый / запасливая</td></tr>
<tr><th>50–150</th><td>дошиковод ×2 · бариста ×2 · самокатчик ×2 · пункт выдачи ×2 · шаурмастер ×2</td></tr>
<tr><th>225–650</th><td>айтишник ×2 · царь столовой ×2 · космонавт ×2 · олигарх ×2</td></tr>
<tr><th>900–1650</th><td>легенда района ×2 (с колодками наград) · золотой нищеброд ×2</td></tr>
</table>
<p class="lede" style="margin-top:8px">Пара стоит столько же, сколько одиночка — пол не должен быть налогом. Легенде добавлены наградные колодки на груди: за 900 монет он теперь отличается от обычного мужика в ушанке.</p>

<h2>Пять кандидатов в интерфейсе</h2>
${cards}

<div class="box"><h3>Если решать сейчас</h3>
<p><b>Карикатура</b> — мой выбор. В лавке и в шапке она читается, а тёплые лица попадают в тон приложения лучше, чем всё остальное. Круглый формат подходит везде без кадрирования.</p>
<p><b>Фигурка целиком</b> — если важнее «коллекция». Силуэты различаются сильнее всех, но её придётся кадрировать до головы в шапке и в списке, то есть держать два варианта каждого аватара.</p>
<p style="margin-bottom:0"><b>Пиксель</b> — если приоритет мелкий размер и игровое ощущение. Тогда сразу принимаем, что мимики не будет.</p></div>
</div>`);
console.log('ok');
