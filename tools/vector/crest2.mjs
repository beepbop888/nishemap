/* Гербы НищеMap. Узнаваемость держится на ТРЁХ вещах сразу, а не на одной шапке:
   1) силуэт головного убора,  2) воротник/одежда,  3) предмет рядом.
   Раньше все были одной головой в разных шапках — отсюда и «не отличить». */
const INK = '#1e1b17';
const P = (d, f, w = 0, s = INK) =>
  `<path d="${d}" fill="${f || 'none'}"${w ? ` stroke="${s}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"` : ''}/>`;
const L = (d, w, c) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const C = (x, y, r, f, w = 0, s = INK) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${f || 'none'}"${w ? ` stroke="${s}" stroke-width="${w}"` : ''}/>`;

/* Голова: ширина и челюсть меняются от персонажа — узкий студент, тяжёлый шаурмастер. */
const head = (skin, w = 44, jaw = 1) => {
  const x = 50 - w / 2, t = 22, b = 64, rad = 12 * jaw;
  return P(`M${x} ${t + rad} Q${x} ${t} ${x + rad} ${t} L${x + w - rad} ${t} Q${x + w} ${t} ${x + w} ${t + rad} `
    + `L${x + w} ${b - 16 * jaw} Q${x + w} ${b} ${50 + 11 * jaw} ${b} L${50 - 11 * jaw} ${b} `
    + `Q${x} ${b} ${x} ${b - 16 * jaw} Z`, skin, 2.6);
};
const neck = (skin) => P('M43 60 h14 v11 h-14 Z', skin, 2.6);

/* ---- ВОРОТНИКИ: половина узнаваемости живёт здесь ---- */
const COLLAR = {
  hoodie: (c) => P('M12 100 C14 80 28 70 50 70 C72 70 86 80 88 100 Z', c, 2.6)
    + P('M38 70 q12 12 24 0 q-4 10 -12 10 q-8 0 -12 -10 Z', '#e8e2d4', 2.2)
    + L('M44 80 L44 92 M56 80 L56 92', 2.4, '#e8e2d4'),
  apron: (c) => P('M12 100 C14 80 28 70 50 70 C72 70 86 80 88 100 Z', c, 2.6)
    + P('M34 76 q16 -6 32 0 q4 12 4 24 H30 q0 -12 4 -24 Z', '#f6f4ef', 2.4)
    + L('M40 74 L44 70 M60 74 L56 70', 2.4, '#f6f4ef'),
  jersey: (c) => P('M6 100 C8 78 24 68 50 68 C76 68 92 78 94 100 Z', c, 2.6)   // широкие плечи
    + P('M14 82 q8 -8 20 -10 l0 28 h-22 Z', '#f2f1ee', 2.2)
    + P('M86 82 q-8 -8 -20 -10 l0 28 h22 Z', '#f2f1ee', 2.2)
    + `<text x="50" y="94" font-family="Oswald,Impact,sans-serif" font-size="15" font-weight="700" text-anchor="middle" fill="#f2f1ee">10</text>`,
  track: (c) => P('M12 100 C14 80 28 70 50 70 C72 70 86 80 88 100 Z', c, 2.6)
    + L('M22 100 L26 78 M28 100 L32 76 M34 100 L38 74', 2.2, '#f2f1ee')
    + L('M78 100 L74 78 M72 100 L68 76 M66 100 L62 74', 2.2, '#f2f1ee'),
  barmy: (c) => P('M12 100 C14 80 28 70 50 70 C72 70 86 80 88 100 Z', c, 2.6)   // царские бармы
    + P('M22 76 C30 88 70 88 78 76 C80 90 68 98 50 98 C32 98 20 90 22 76 Z', '#e8b93c', 2.4)
    + [[32, 86], [50, 90], [68, 86]].map(([x, y]) => C(x, y, 3.2, '#c8322a', 1.8)).join(''),
  suit: (c) => P('M12 100 C14 80 28 70 50 70 C72 70 86 80 88 100 Z', c, 2.6)   // скафандр: кольцо шлема
    + P('M26 74 h48 v8 h-48 Z', '#c9c5bb', 2.4)
    + L('M30 88 h14 M56 88 h14', 2.4, '#9aa3aa'),
  fur: (c) => P('M12 100 C14 80 28 70 50 70 C72 70 86 80 88 100 Z', c, 2.6)     // шуба олигарха
    + P('M30 72 C22 82 18 92 18 100 H10 C10 86 16 76 30 72 Z', '#e8e2d4', 2.2)
    + P('M70 72 C78 82 82 92 82 100 H90 C90 86 84 76 70 72 Z', '#e8e2d4', 2.2)
    + P('M44 72 l6 6 l6 -6 l-2 10 h-8 Z', '#8a1f2e', 1.8),
  shawl: (c) => P('M12 100 C14 80 28 70 50 70 C72 70 86 80 88 100 Z', c, 2.6)   // бабушкин платок на плечах
    + P('M34 70 q16 10 32 0 q0 16 -16 22 q-16 -6 -16 -22 Z', '#b8465c', 2.4),
  vest: (c) => P('M12 100 C14 80 28 70 50 70 C72 70 86 80 88 100 Z', c, 2.6)    // жилет дворника
    + L('M18 92 C28 82 38 78 50 78 C62 78 72 82 82 92', 5, '#f2f1ee')
    + L('M18 92 C28 82 38 78 50 78 C62 78 72 82 82 92', 2, '#9aa3aa'),
  gold: (c) => P('M12 100 C14 80 28 70 50 70 C72 70 86 80 88 100 Z', c, 2.6)
    + P('M30 74 C38 86 62 86 70 74 C72 88 62 96 50 96 C38 96 28 88 30 74 Z', '#f0d98a', 2.4),
};

/* ---- ГОЛОВНЫЕ УБОРЫ: у каждого своя КОНСТРУКЦИЯ, не общий купол ---- */
/* Все шапки живут выше строки 34: глаза на 47, между ними должен остаться воздух. */
const up = (svg, dy = 4) => `<g transform="translate(0,${-dy})">${svg}</g>`;
const HAT = {
  ushanka: (m, d, l, star) => ({
    back: P('M22 34 q-9 5 -9 16 q0 11 9 12 q7 1 8 -6 l-1 -22 Z', d, 2.6)
        + P('M78 34 q9 5 9 16 q0 11 -9 12 q-7 1 -8 -6 l1 -22 Z', d, 2.6),
    front: P('M24 34 q0 -20 26 -20 q26 0 26 20 Z', m, 2.6)
         + P('M20 32 h60 q4 0 4 5 q0 6 -6 6 H22 q-6 0 -6 -6 q0 -5 4 -5 Z', l, 2.6)
         + (star ? star5(50, 24, 6, '#c8322a') : ''),
  }),
  platok: (m, d) => ({
    back: P('M24 38 q-8 14 -4 26 q4 10 10 4 l2 -30 Z', m, 2.6),
    front: P('M24 40 q0 -26 26 -26 q26 0 26 26 q-10 -10 -26 -10 q-16 0 -26 10 Z', m, 2.6)
         + L('M32 24 l4 5 M44 19 l4 5 M58 20 l4 5 M68 27 l4 5', 2, '#f6e6ec')
         + P('M42 62 q8 8 16 0 q-2 12 -8 14 q-6 -2 -8 -14 Z', m, 2.4),   // узел под подбородком
  }),
  /* кепка: ПЛОСКИЙ верх и короткий жёсткий козырёк — не купол */
  kepka: (m, d) => ({ back: '',
    front: P('M25 34 q0 -12 25 -12 q25 0 25 12 Z', m, 2.6)
         + P('M14 33 h72 q3 0 3 3 q0 4 -6 5 L18 41 q-6 -1 -6 -5 q0 -3 2 -3 Z', d, 2.6) }),
  /* поварская: невысокая красная с белым кантом */
  cook: (m) => ({ back: '',
    front: P('M26 33 q0 -16 24 -16 q24 0 24 16 Z', m, 2.6)
         + P('M22 31 h56 q3 0 3 4 q0 5 -5 5 H24 q-5 0 -5 -5 q0 -4 3 -4 Z', '#f6f4ef', 2.6) }),
  /* хоккей: купол + РЕШЁТКА на лице, это и есть подпись персонажа */
  hockey: (m, d) => ({ back: '',
    front: P('M24 34 q0 -22 26 -22 q26 0 26 22 Z', m, 2.6)
         + P('M20 32 h60 q4 0 4 4 q0 5 -5 5 H21 q-5 0 -5 -5 q0 -4 4 -4 Z', d, 2.6),
    over: L('M27 44 q23 -6 46 0 M26 52 q24 -6 48 0 M26 60 q24 6 48 0', 2, '#8e99a3')
        + L('M34 40 L32 64 M50 38 L50 66 M66 40 L68 64', 2, '#8e99a3')
        + L('M26 40 q0 26 24 30 q24 -4 24 -30', 2.4, '#6f7a84') }),
  /* космос: сфера вокруг головы + кольцо-обод и поднятый светофильтр */
  space: () => ({
    back: C(50, 42, 33, '#f6f4ef', 2.6),
    front: P('M17 40 a33 33 0 0 1 66 0 q-14 -10 -33 -10 q-19 0 -33 10 Z', '#d9a326', 2.6)
         + L('M26 30 q10 -9 22 -11', 2.6, '#f6e3a8')
         + C(50, 42, 33, 'none', 2.6),
    over: '' }),
  /* шапка Мономаха: мех + купол + крест */
  monomah: () => ({ back: '',
    front: P('M28 34 q0 -20 22 -20 q22 0 22 20 Z', '#e8b93c', 2.6)
         + [[38, 26], [50, 22], [62, 26]].map(([x, y]) => C(x, y, 2.6, '#c8322a', 1.6)).join('')
         + P('M22 32 h56 q4 0 4 5 q0 6 -6 6 H24 q-6 0 -6 -6 q0 -5 4 -5 Z', '#f6f4ef', 2.6)
         + L('M50 14 L50 6 M46 9 L54 9', 2.4, INK) }),
  tophat: () => ({ back: '',
    front: P('M34 32 v-22 h32 v22 Z', '#26262a', 2.6)
         + P('M34 18 h32 v5 h-32 Z', '#8a1f2e', 0)
         + P('M18 28 h64 q4 0 4 4 q0 5 -6 5 H20 q-6 0 -6 -5 q0 -4 4 -4 Z', '#26262a', 2.6) }),
  none: () => ({ back: '', front: '' }),
};
function star5(cx, cy, r, f) {
  let d = '';
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .42 : r;
    d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1); }
  return P(d + 'Z', f, 1.4);
}
const hair = (col) => P('M27 34 q0 -20 23 -20 q23 0 23 20 q-9 -8 -23 -8 q-14 0 -23 8 Z', col, 2.6);
const beardFull = (col) => P('M27 46 q0 22 23 22 q23 0 23 -22 q-7 9 -23 9 q-16 0 -23 -9 Z', col, 2.6);
const mous = (col) => P('M40 54 q10 -5 20 0 q-10 6 -20 0 Z', col, 1.8);

/* ---- ЛИЦА ---- */
const EYES = {
  tired: L('M40 47 h5 M55 47 h5', 2.6, INK) + L('M38 41 q4 -2 8 0 M54 41 q4 -2 8 0', 2, INK),
  old:   C(41, 47, 2, INK) + C(59, 47, 2, INK) + L('M34 42 q5 -3 10 -1 M56 41 q5 -2 10 1', 2, INK),
  happy: L('M38 48 q4 -6 8 0 M54 48 q4 -6 8 0', 2.6, INK),
  sly:   L('M38 46 h8 M54 46 h8', 2.6, INK) + L('M37 40 q5 3 9 1 M54 41 q4 2 9 -1', 2, INK),
  driven:C(41, 47, 2.4, INK) + C(59, 47, 2.4, INK) + L('M36 40 q5 3 10 2 M54 42 q5 -1 10 -2', 2.2, INK),
  proud: C(41, 47, 2.2, INK) + C(59, 47, 2.2, INK) + L('M35 40 q6 -3 11 -1 M54 39 q5 -2 11 1', 2.2, INK),
  awe:   C(41, 47, 3.4, '#fff', 2) + C(59, 47, 3.4, '#fff', 2) + C(41, 47, 1.5, INK) + C(59, 47, 1.5, INK),
};
const MOUTH = {
  flat:  L('M45 57 h10', 2.4, INK),
  smile: L('M44 56 q6 6 12 0', 2.6, INK),
  grin:  P('M42 55 q8 8 16 0 Z', INK, 0) + P('M44 56 q6 2 12 0 l0 -1 h-12 Z', '#fff', 0),
  smirk: L('M44 57 q7 3 12 -2', 2.4, INK),
  o:     `<ellipse cx="50" cy="57" rx="3" ry="3.6" fill="${INK}"/>`,
};

const SKIN = { light: '#f2cba4', pale: '#f8e0d2', tan: '#d29b6e' };
const TIER = [
  { bg: '#efece4', rim: '#b9b1a1', rib: '#8f8778', name: 'ДАРОМ' },
  { bg: '#f0e4d2', rim: '#b87d3e', rib: '#a8692c', name: '' },
  { bg: '#e2e7ec', rim: '#8b98a5', rib: '#6f7d8b', name: '' },
  { bg: '#f7e7b4', rim: '#c9a23f', rib: '#a8801f', name: '' },
];
const tierOf = (p) => p === 0 ? 0 : p < 300 ? 1 : p < 900 ? 2 : 3;

export const CAST = [
  { id:'student', name:'СТУДЕНТ', price:0, skin:'light', hair:'#3a3129', hw:42, jaw:.95,
    hat:['ushanka','#6b8299','#4f6478','#8ba0b3'], collar:['hoodie','#4f6f8f'], prop:'stakan', eyes:'tired', mouth:'flat' },
  { id:'babushka', name:'БАБУШКА', price:0, skin:'pale', hair:'#cfc9bd', hw:44, jaw:1.05,
    hat:['platok','#b8465c','#8e3346'], collar:['shawl','#7d6a8f'], prop:'avoska', eyes:'old', mouth:'smile' },
  { id:'kurier', name:'КУРЬЕР', price:0, skin:'tan', hair:'#2e2723', hw:42, jaw:.95,
    hat:['kepka','#2f6b4f','#1f4a36'], collar:['hoodie','#c8492f'], prop:'box', eyes:'driven', mouth:'flat' },
  { id:'doshikovod', name:'ДОШИКОВОД', price:50, skin:'light', hair:'#2e2723', hw:43, jaw:1,
    hat:['none'], collar:['hoodie','#5a6b7d'], prop:'doshik', eyes:'happy', mouth:'grin' },
  { id:'shaurmaster', name:'ШАУРМАСТЕР', price:100, skin:'tan', hair:'#2e2723', hw:47, jaw:1.1,
    hat:['cook','#c8492f'], collar:['apron','#c8492f'], beard:'full', prop:'shaurma', eyes:'happy', mouth:'smile' },
  { id:'gopnik', name:'ГОПНИК', price:175, skin:'light', hair:'#2e2723', hw:42, jaw:1,
    hat:['kepka','#26262a','#141417'], collar:['track','#1f1f22'], prop:'semki', eyes:'sly', mouth:'smirk' },
  { id:'dvornik', name:'ДВОРНИК', price:250, skin:'tan', hair:'#4a3f37', hw:45, jaw:1.05,
    hat:['ushanka','#5b452e','#3f2f1f','#7a5f42'], collar:['vest','#ee7a1e'], mous:1, prop:'metla', eyes:'proud', mouth:'flat' },
  { id:'hokkeist', name:'ХОККЕИСТ', price:400, skin:'light', hair:'#2e2723', hw:43, jaw:1,
    hat:['hockey','#c8322a','#8e1f19'], collar:['jersey','#1f4b8f'], prop:'klyushka', eyes:'driven', mouth:'flat' },
  { id:'kosmonavt', name:'КОСМОНАВТ', price:850, skin:'light', hair:'#2e2723', hw:41, jaw:.95,
    hat:['space'], collar:['suit','#dcd8cf'], prop:'zvezda', eyes:'awe', mouth:'o' },
  { id:'tsar', name:'ЦАРЬ', price:1100, skin:'light', hair:'#3a332c', hw:46, jaw:1.08,
    hat:['monomah'], collar:['barmy','#8a1f2e'], beard:'full', prop:'skipetr', eyes:'proud', mouth:'flat' },
  { id:'oligarh', name:'ОЛИГАРХ', price:1350, skin:'light', hair:'#3a332c', hw:44, jaw:1,
    hat:['tophat'], collar:['fur','#4a3a55'], mous:1, prop:'ruble', eyes:'sly', mouth:'smirk' },
  { id:'zolotoy', name:'ЗОЛОТОЙ', price:1650, skin:'light', hair:'#3a332c', hw:45, jaw:1.05,
    hat:['ushanka','#d9a326','#a97c16','#f0d98a',1], collar:['gold','#d9a326'], beard:'full', prop:'ruble', eyes:'happy', mouth:'grin' },
];

/* Предмет персонажа — треть узнаваемости. Рисуем слева, ниже лица, вне шапки. */
const PROPS_RAW = {
  stakan:  () => P('M13 68 h12 l-2 17 q-4 2 -8 0 Z', '#e8e2d4', 2.2) + P('M12 64 h14 v5 h-14 Z', '#8a4c1d', 2),
  avoska:  () => P('M10 70 q0 -3 4 -3 h13 q4 0 4 3 q-2 17 -10 17 q-9 0 -11 -17 Z', '#ded8c8', 2.2)
               + C(16, 75, 3.2, '#c8492f', 1.6) + C(24, 77, 3.2, '#5f8f3a', 1.6) + C(20, 82, 3.2, '#e0a52c', 1.6),
  box:     () => P('M9 64 h20 v22 h-20 Z', '#1f4a5c', 2.4) + P('M15 69 h8 v6 h-8 Z', '#f0c948', 1.6),
  doshik:  () => P('M11 70 h20 l-3 16 q-7 2 -14 0 Z', '#eceadf', 2.2) + P('M9 65 h24 v6 h-24 Z', '#d4402e', 2.2)
               + L('M33 63 l6 -8 M36 67 l6 -8', 2, '#c9a06a'),
  shaurma: () => P('M15 64 q6 -3 12 0 l-3 22 q-3 2 -6 0 Z', '#ecdfc2', 2.2)
               + P('M15 64 q6 -4 12 0 q-6 3 -12 0 Z', '#8fae6a', 1.8) + L('M18 72 h6 M18 79 h6', 1.8, '#c07a3a'),
  semki:   () => [[14,68],[22,74],[13,80],[23,85]].map(([x,y]) =>
                 `<ellipse cx="${x}" cy="${y}" rx="3" ry="4.6" fill="#4a3b2c" stroke="${INK}" stroke-width="1.4" transform="rotate(${x%2?20:-20} ${x} ${y})"/>`).join(''),
  metla:   () => L('M31 60 L19 82', 3, '#b98a4e') + P('M21 80 q-8 4 -8 10 h16 q1 -7 -8 -10 Z', '#c9a24a', 2.2),
  klyushka:() => L('M33 60 L21 82', 3, '#c39a5e') + P('M21 82 l-9 5 l3 6 l9 -5 Z', '#2b2b2b', 2.2),
  zvezda:  () => star5(20, 76, 11, '#c8322a'),
  skipetr: () => L('M20 88 L20 66', 3.4, '#e8b93c') + C(20, 62, 5, '#e8b93c', 2.2),
  ruble:   () => P('M13 66 h9 a7 7 0 0 1 0 14 h-4 v3 h7 v3.4 h-7 v4 h-5 v-4 h-4 v-3.4 h4 v-3 h-4 v-4 h4 Z M18 76 h4 a3.4 3.4 0 0 0 0 -7 h-4 Z', '#e8b93c', 2),
};

/* Щит сужается книзу: предмет ставим внутрь контура, не у самого края. */
const PROPS = Object.fromEntries(Object.entries(PROPS_RAW).map(([k, f]) =>
  [k, () => `<g transform="translate(10,-8) scale(.86)">${f()}</g>`]));

export function crest(c) {
  const t = TIER[tierOf(c.price)];
  const [hk, ...ha] = c.hat;
  const h = HAT[hk](...ha);
  const skin = SKIN[c.skin];
  const shield = 'M50 3 L93 16 V54 Q93 88 50 103 Q7 88 7 54 V16 Z';
  const inner  = 'M50 8 L88 20 V54 Q88 84 50 97 Q12 84 12 54 V20 Z';
  return `<svg viewBox="0 0 100 118" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${c.name}">
    <defs><clipPath id="sh_${c.id}"><path d="${inner}"/></clipPath></defs>
    ${P(shield, t.rim, 0)}${P(inner, t.bg, 0)}
    <g clip-path="url(#sh_${c.id})">
      ${up(h.back)}
      ${COLLAR[c.collar[0]](c.collar[1])}
      ${neck(skin)}
      ${head(skin, c.hw, c.jaw)}
      ${hk === 'space' ? '' : hair(c.hair)}
      ${c.beard ? beardFull(c.hair) : ''}
      ${EYES[c.eyes]}${MOUTH[c.mouth]}
      ${c.mous ? mous(c.hair) : ''}
      ${up(h.front)}${h.over || ''}
      ${c.prop && PROPS[c.prop] ? PROPS[c.prop]() : ''}
    </g>
    ${P(inner, 'none', 2.6, t.rim)}
    ${P('M6 84 h88 l-7 10 l7 10 H6 l7 -10 Z', t.rib, 2.4)}
    <text x="50" y="98" font-family="Oswald,Impact,sans-serif" font-size="9.5" font-weight="700"
      letter-spacing="0.6" text-anchor="middle" fill="#f6f4ef">${c.name}</text>
  </svg>`;
}
