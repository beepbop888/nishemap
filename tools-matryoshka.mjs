/* Аватары-матрёшки. Форма одна и та же, характер живёт в росписи:
   платок/шапка сверху, «фартук» с предметом на животе. Лицо у матрёшки
   и должно быть простым — это не упрощение, это канон. */
import { writeFileSync } from 'node:fs';

const ink = (d, fill, w = 9) =>
  `<path d="${d}" fill="${fill}" stroke="#241f1b" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
const line = (d, w, col) =>
  `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

/* Силуэт: голова-шар переходит в колокол. Читается одним пятном даже в 28 px. */
const BODY = 'M200 44 C258 44 300 92 300 152 C300 182 292 206 278 224 '
           + 'C336 256 368 330 368 420 C368 476 300 508 200 508 '
           + 'C100 508 32 476 32 420 C32 330 64 256 122 224 '
           + 'C108 206 100 182 100 152 C100 92 142 44 200 44 Z';
/* Лицо-овал */
const FACE = 'M200 74 C246 74 274 108 274 152 C274 196 246 226 200 226 '
           + 'C154 226 126 196 126 152 C126 108 154 74 200 74 Z';
/* Передник — сюда кладём предмет персонажа */
const APRON = 'M200 250 C264 250 306 300 306 372 C306 434 262 464 200 464 '
            + 'C138 464 94 434 94 372 C94 300 136 250 200 250 Z';

const facePaint = (o = {}) =>
  ink(FACE, o.skin || '#f6dcc0', 8)
  + `<circle cx="172" cy="150" r="9" fill="#241f1b"/><circle cx="228" cy="150" r="9" fill="#241f1b"/>`
  + `<circle cx="150" cy="176" r="15" fill="#e79aa0" opacity=".75"/>`
  + `<circle cx="250" cy="176" r="15" fill="#e79aa0" opacity=".75"/>`
  + line('M186 190 Q200 202 214 190', 7, '#c1443f')
  + (o.brow ? line('M158 126 Q172 118 186 126 M214 126 Q228 118 242 126', 7, '#241f1b') : '')
  + (o.beard ? ink('M132 176 C132 250 164 288 200 288 C236 288 268 250 268 176 '
      + 'C250 214 226 230 200 230 C174 230 150 214 132 176 Z', o.beard, 8) : '')
  + (o.mous ? line('M164 202 Q200 216 236 202', 13, o.mous) : '')
  + (o.glasses ? line('M226 150 m-26 0 a26 26 0 1 0 52 0 a26 26 0 1 0 -52 0', 7, '#d8a53a')
      + line('M252 168 Q268 200 262 232', 5, '#d8a53a') : '');

/* Головной убор: рисуется поверх макушки, лицо не трогает */
const HEAD = {
  platok: (a, b) => ink('M200 44 C258 44 300 92 300 152 C300 166 297 178 292 190 '
      + 'C268 158 238 142 200 142 C162 142 132 158 108 190 C103 178 100 166 100 152 '
      + 'C100 92 142 44 200 44 Z', a, 8)
    + line('M138 86 L152 100 M182 66 L196 80 M232 70 L246 84 M264 100 L276 114', 7, '#fbeaf0')
    + ink('M100 152 C82 176 78 214 86 240 C96 268 128 268 134 240 L128 158 Z', b || a, 8),
  ushanka: (a, b) => ink('M200 34 C264 34 306 82 306 148 L94 148 C94 82 136 34 200 34 Z', a, 9)
    + ink('M84 140 L316 140 C324 140 328 148 328 158 C328 172 320 180 306 180 L94 180 '
      + 'C80 180 72 172 72 158 C72 148 76 140 84 140 Z', b || a, 9)
    + ink('M86 178 C64 200 60 250 74 274 C88 296 122 292 126 266 L120 180 Z', a, 8)
    + ink('M314 178 C336 200 340 250 326 274 C312 296 278 292 274 266 L280 180 Z', a, 8),
  kepka: (a) => ink('M200 52 C258 52 300 96 300 150 L100 150 C100 96 142 52 200 52 Z', a, 9)
    + ink('M76 146 L324 146 C334 146 338 154 338 164 C338 178 328 184 314 184 L86 184 '
      + 'C72 184 62 178 62 164 C62 154 66 146 76 146 Z', a, 9),
  korona: () => ink('M104 148 L104 96 L136 122 L168 70 L200 110 L232 70 L264 122 L296 96 L296 148 Z', '#e8b93c', 9)
    + [[136, 120], [200, 108], [264, 120]].map(([x, y]) =>
        `<circle cx="${x}" cy="${y}" r="12" fill="#c8322a" stroke="#241f1b" stroke-width="6"/>`).join('')
    + ink('M84 142 L316 142 C326 142 330 150 330 160 C330 176 320 184 306 184 L94 184 '
      + 'C80 184 70 176 70 160 C70 150 74 142 84 142 Z', '#f6f4ef', 9)
    + line('M200 70 L200 34 M180 50 L220 50', 11, '#241f1b')
    + line('M200 66 L200 38 M184 50 L216 50', 5, '#e8b93c'),
  cilindr: () => ink('M128 148 L128 26 C128 16 160 10 200 10 C240 10 272 16 272 26 L272 148 Z', '#26262a', 9)
    + line('M132 108 L268 108', 18, '#8f2019')
    + ink('M64 146 L336 146 C346 146 350 154 350 164 C350 180 338 188 322 188 L78 188 '
      + 'C62 188 50 180 50 164 C50 154 54 146 64 146 Z', '#26262a', 9),
  shlem: (a) => ink('M200 30 C268 30 312 82 312 150 L88 150 C88 82 132 30 200 30 Z', a, 9)
    + line('M124 196 L276 196 M132 232 L268 232', 6, '#8e99a3')
    + line('M156 162 L156 250 M200 160 L200 252 M244 162 L244 250', 6, '#8e99a3'),
  skafandr: () => ink('M200 18 C284 18 336 88 336 172 C336 200 330 222 320 238 '
      + 'C300 200 258 178 200 178 C142 178 100 200 80 238 C70 222 64 200 64 172 '
      + 'C64 88 116 18 200 18 Z', '#f4f2ee', 9)
    + ink('M200 34 C266 34 310 78 310 128 C310 136 308 142 304 148 C280 118 244 104 200 104 '
      + 'C156 104 120 118 96 148 C92 142 90 136 90 128 C90 78 134 34 200 34 Z', '#d9a326', 8)
    + line('M126 88 Q160 58 206 52', 12, '#f6e3a8'),
};

/* Предмет на переднике — это и есть характер */
const ITEM = {
  avoska: () => ink('M148 300 L252 300 L240 404 C238 420 220 428 200 428 '
      + 'C180 428 162 420 160 404 Z', '#e6e1d2', 8)
    + [[176, 336, '#c8492f'], [222, 336, '#5f8f3a'], [200, 380, '#e0a52c']]
      .map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="20" fill="${c}" stroke="#241f1b" stroke-width="6"/>`).join('')
    + line('M160 312 L182 424 M200 302 L200 428 M240 312 L218 424 M152 356 L248 356 M158 400 L242 400', 5, '#241f1b'),
  doshik: () => ink('M150 330 L250 330 L236 420 C234 432 220 438 200 438 '
      + 'C180 438 166 432 164 420 Z', '#eceadf', 8)
    + ink('M142 318 C142 304 168 296 200 296 C232 296 258 304 258 318 '
      + 'C258 332 232 340 200 340 C168 340 142 332 142 318 Z', '#d4402e', 8)
    + line('M172 366 L228 366 M176 394 L224 394', 8, '#f0c948')
    + line('M264 300 L302 262 M278 320 L316 282', 8, '#241f1b'),
  shaurma: () => ink('M162 288 L238 288 L222 428 C220 440 208 446 200 446 '
      + 'C192 446 180 440 178 428 Z', '#ecdfc2', 8)
    + ink('M162 288 C162 274 178 266 200 266 C222 266 238 274 238 288 '
      + 'C238 300 222 306 200 306 C178 306 162 300 162 288 Z', '#c9d9a8', 8)
    + line('M176 340 L224 340 M180 384 L220 384', 9, '#c07a3a')
    + line('M186 316 L214 316', 8, '#c8492f'),
  semki: () => [[168, 316, -20], [232, 336, 22], [176, 386, 8], [236, 404, -28]]
    .map(([x, y, r]) => `<g transform="rotate(${r} ${x} ${y})">`
      + ink(`M${x} ${y - 26} C${x + 20} ${y - 12} ${x + 20} ${y + 12} ${x} ${y + 26} `
          + `C${x - 20} ${y + 12} ${x - 20} ${y - 12} ${x} ${y - 26} Z`, '#4a3b2c', 7)
      + line(`M${x} ${y - 16} L${x} ${y + 16}`, 5, '#e2d6bd') + `</g>`).join(''),
  klyushka: () => line('M150 280 L226 400', 14, '#241f1b') + line('M150 280 L226 400', 8, '#c39a5e')
    + ink('M222 392 L268 420 L250 448 L204 420 Z', '#2b2b2b', 8)
    + `<circle cx="160" cy="404" r="20" fill="#26262a" stroke="#241f1b" stroke-width="7"/>`,
  zvezda: () => {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 34 : 82;
      d += (i ? 'L' : 'M') + (200 + Math.cos(a) * r).toFixed(1) + ' ' + (356 + Math.sin(a) * r).toFixed(1);
    }
    return ink(d + 'Z', '#c8322a', 9);
  },
  ruble: () => ink('M170 290 h52 a44 44 0 0 1 0 88 h-24 v20 h40 v20 h-40 v28 h-28 v-28 h-24 v-20 h24 v-20 h-24 v-24 h24 Z '
    + 'M198 358 h24 a25 25 0 0 0 0-50 h-24 Z', '#e8b93c', 9),
  kniga: () => ink('M136 296 L200 312 L264 296 L264 412 L200 428 L136 412 Z', '#e6e1d2', 8)
    + line('M200 312 L200 428', 8, '#241f1b')
    + line('M156 336 L188 344 M156 364 L188 372 M212 344 L244 336 M212 372 L244 364', 6, '#a9a294'),
  metla: () => line('M154 276 L232 372', 13, '#241f1b') + line('M154 276 L232 372', 7, '#b98a4e')
    + ink('M228 364 C198 392 190 428 200 452 L272 452 C280 416 262 384 228 364 Z', '#c9a24a', 8),
};

const TIER = {
  free:  { body: '#e8ded0', trim: '#c8b9a3', ring: '#b9a88f', bg: '#efece4' },
  paint: { body: '#f2e6d2', trim: '#c8492f', ring: '#b08050', bg: '#e9e0d2' },
  rich:  { body: '#f4efe4', trim: '#3f6f8f', ring: '#8fa3b5', bg: '#dfe4e8' },
  gold:  { body: '#f6e2a8', trim: '#c8322a', ring: '#c9a23f', bg: '#f5e6b8' },
};

export function matryoshka(c) {
  const t = TIER[c.tier];
  return `<svg viewBox="0 0 400 540" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${c.name}">`
    + `<rect x="-40" y="-40" width="480" height="620" fill="${t.bg}"/>`
    + ink(BODY, t.body, 10)
    + ink(APRON, c.apron || '#f7f2e6', 8)
    + (ITEM[c.item] ? ITEM[c.item]() : '')
    + line('M94 372 C94 300 136 250 200 250 C264 250 306 300 306 372', 6, t.ring)
    + facePaint(c.face || {})
    + (HEAD[c.head] ? HEAD[c.head](c.h1, c.h2) : '')
    + (c.tier === 'gold'
        ? line('M32 420 C32 330 64 256 122 224 M368 420 C368 330 336 256 278 224', 7, '#d8b24a') : '')
    + `</svg>`;
}

export const DOLLS = [
  { id: 'student',   name: 'Студент',   price: 0,    tier: 'free',  head: 'ushanka', h1: '#6b8299', h2: '#4f6478', item: 'kniga',    face: { brow: 1 } },
  { id: 'babushka',  name: 'Бабушка',   price: 0,    tier: 'free',  head: 'platok',  h1: '#b8465c', h2: '#8e3346', item: 'avoska' },
  { id: 'doshikovod',name: 'Дошиковод', price: 50,   tier: 'paint', head: 'kepka',   h1: '#3c7d5c',                item: 'doshik' },
  { id: 'shaurmaster',name:'Шаурмастер',price: 100,  tier: 'paint', head: 'kepka',   h1: '#c8492f',                item: 'shaurma', face: { skin: '#e6bc94', beard: '#2e2723' } },
  { id: 'gopnik',    name: 'Гопник',    price: 175,  tier: 'paint', head: 'kepka',   h1: '#26262a',                item: 'semki',   face: { brow: 1 } },
  { id: 'dvornik',   name: 'Дворник',   price: 250,  tier: 'paint', head: 'ushanka', h1: '#5b452e', h2: '#3f2f1f', item: 'metla',   face: { mous: '#4a3f37' } },
  { id: 'hokkeist',  name: 'Хоккеист',  price: 400,  tier: 'rich',  head: 'shlem',   h1: '#c8322a',                item: 'klyushka' },
  { id: 'kosmonavt', name: 'Космонавт', price: 850,  tier: 'rich',  head: 'skafandr',                              item: 'zvezda' },
  { id: 'tsar',      name: 'Царь',      price: 1100, tier: 'gold',  head: 'korona',                                item: 'zvezda',  face: { beard: '#3a332c' }, apron: '#f6e2a8' },
  { id: 'oligarh',   name: 'Олигарх',   price: 1350, tier: 'gold',  head: 'cilindr',                               item: 'ruble',   face: { mous: '#3a332c', glasses: 1 } },
  { id: 'zolotoy',   name: 'Золотой нищеброд', price: 1650, tier: 'gold', head: 'ushanka', h1: '#e8b93c', h2: '#c9a23f', item: 'ruble', face: { beard: '#3a332c' }, apron: '#f0d98a' },
];

let out = ''; const W = 132, H = 178;
DOLLS.forEach((c, i) => {
  const x = (i % 6) * (W + 10) + 12, y = Math.floor(i / 6) * (H + 54) + 34;
  const u = 'data:image/svg+xml,' + encodeURIComponent(matryoshka(c));
  out += `<image x="${x}" y="${y}" width="${W}" height="${H}" href="${u}"/>`;
  out += `<image x="${x + W - 26}" y="${y + H + 4}" width="26" height="35" href="${u}"/>`;
  out += `<text x="${x}" y="${y + H + 20}" font-size="11" fill="#e8e2d4" font-family="monospace">${c.name}</text>`;
  out += `<text x="${x}" y="${y + H + 34}" font-size="11" fill="#f2cf5c" font-family="monospace">${c.price || 'free'}</text>`;
});
const TW = 6 * (W + 10) + 24;
writeFileSync('matr.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${2 * (H + 54) + 44}" viewBox="0 0 ${TW} ${2 * (H + 54) + 44}"><rect width="100%" height="100%" fill="#26241f"/><text x="12" y="22" font-size="14" fill="#fff" font-family="monospace">Матрёшки — характер в росписи, не в лице (справа то же в 26 px)</text>${out}</svg>`);
console.log('ok', DOLLS.length);
