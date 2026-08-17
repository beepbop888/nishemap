import * as S from './saved.mjs';
import * as N from './newstyles.mjs';
import { FREE, PAID, CAST } from './cast.mjs';
import { writeFileSync } from 'node:fs';
const uri = (s) => 'data:image/svg+xml,' + encodeURIComponent(s);
const ROWS = [
  ['chibi','Фигурка целиком', S.chibi, 'сохранено',
   'Силуэт различает персонажей без единой иконки — хоккеиста и космонавта видно чёрным пятном.'],
  ['pixel32','Пиксель 32×32', S.pixel32, 'сохранено — тот, первый',
   'Именно первый вариант, а не 28×28: клетка крупнее, есть тень на щеке, шапки читаются.'],
  ['minimal','Минимализм', S.minimal, 'сохранено',
   'Фигура мельче, воздуха больше. В щите это работает лучше, чем в круге — рамка держит композицию.'],
  ['disney','Disney', N.disney, 'новое',
   'Большие блестящие глаза с бликом, румянец, мягкий свет сверху. Самый «дорогой» и самый детский.'],
  ['smesh','Смешарики', N.smesh, 'новое',
   'Персонаж — это шар: ни шеи, ни плеч, тонкие лапки. Ближе всего к тому, на чём выросла аудитория.'],
  ['soyuz','Союзмультфильм', N.soyuz, 'новое',
   'Мягкая неровная линия, приглушённая палитра, маленькие глаза. Чебурашка и Простоквашино.'],
];
const PICK = ['student_m','student_f','zapas_f','doshik_m','barista_f','samokat_f','pvz_f',
              'shaurmaster','itshnik_f','tsar_f','kosmonavt','oligarkh_f','legenda','zoloto'];
const cs = PICK.map(id => CAST.find(c => c.id === id));
const rows = ROWS.map(([k, name, fn, tag, note]) => `
<section class="st">
  <header><h3>${name}</h3><span class="tag ${tag === 'новое' ? 'new' : ''}">${tag}</span></header>
  <p class="sub">${note}</p>
  <div class="row">${cs.map(c => `<figure><img src="${uri(fn(c))}" alt="${c.n}"></figure>`).join('')}</div>
</section>`).join('');

writeFileSync('/Users/reln/Desktop/Claude Projects/Jaison/avatar-styles.html', `<title>НищеMap — шесть подач в щите</title>
<style>
:root{--bg:#f7f5f0;--card:#fff;--ink:#221f1b;--soft:#6b655c;--line:#ddd7cb;--gold:#a97c16;--accent:#ad2f26}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#181714;--card:#221f1b;--ink:#f2efe8;--soft:#a49d92;--line:#38342e;--gold:#e8b93c;--accent:#d9564a}}
:root[data-theme="dark"]{--bg:#181714;--card:#221f1b;--ink:#f2efe8;--soft:#a49d92;--line:#38342e;--gold:#e8b93c;--accent:#d9564a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);padding:30px 18px 80px;font:400 15px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace}
.wrap{max-width:1180px;margin:0 auto}
h1{font:700 clamp(25px,4.4vw,38px)/1.08 Oswald,Impact,sans-serif;text-transform:uppercase;margin:0 0 8px}
h2{font:700 19px/1.2 Oswald,Impact,sans-serif;text-transform:uppercase;letter-spacing:.05em;margin:38px 0 12px;padding-bottom:7px;border-bottom:2px solid currentColor}
h3{font:700 17px/1.2 Oswald,Impact,sans-serif;text-transform:uppercase;margin:0}
p{margin:0 0 9px;max-width:82ch}.lede{color:var(--soft)}
.st{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:16px;margin-bottom:14px}
.st header{display:flex;align-items:center;gap:10px}
.tag{font-size:10px;color:var(--soft);border:1px solid var(--line);border-radius:99px;padding:2px 9px}
.tag.new{color:#fff;background:var(--accent);border-color:var(--accent)}
.sub{color:var(--soft);font-size:13px;margin:6px 0 12px}
.row{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:8px}
figure{margin:0}figure img{width:100%;display:block}
.box{background:var(--card);border:2px solid var(--gold);border-radius:8px;padding:16px 18px;margin:16px 0}
.box h3{color:var(--gold);margin-bottom:8px}
</style>
<div class="wrap">
<h1>Шесть подач · щит и лента</h1>
<p class="lede">Щит с лентой теперь <b>стандартная рамка для всего</b>: цвет щита и ленты — это уровень (серый → бронза → серебро → золото), а имя на ленте страхует, если картинка не сработала.</p>
<p class="lede">Сохранены три: фигурка целиком, пиксель <b>того самого первого варианта 32×32</b> (не 28×28) и минимализм. Добавлены три новые.</p>

${rows}

<h2>Про новые три</h2>
<p class="lede"><b>Disney</b> — большие глаза с бликом, румянец, мягкий свет. Выглядит дороже всех, но и «детскее» всех: под нищебродский юмор попадает хуже.</p>
<p class="lede"><b>Смешарики</b> — самый смелый ход. Персонаж это шар, лапки-палочки, никакой шеи. Аудитория 18–30 на этом выросла, и ни у одного конкурента такого нет. Слабое место видно сразу: шапки на шаре сидят хуже, чем на голове, и им нужна отдельная посадка.</p>
<p class="lede"><b>Союзмультфильм</b> — глуше и теплее, глаза меньше, линия нарочно неровная. Это Чебурашка и Простоквашино, а не Disney. Самый «свой» для русской аудитории.</p>

<div class="box"><h3>Что скажу честно</h3>
<p><b>Смешарики</b> — единственный из шести, который выглядит как собственный стиль, а не как чей-то. Если хочется, чтобы приложение узнавали по аватарам, это он.</p>
<p style="margin-bottom:0">И то, что нужно чинить, если берём его: шапки. Сейчас ушанка и корона сидят на шаре приблизительно. Это одна функция посадки, а не переделка стиля.</p></div>
</div>`);
console.log('ok');
