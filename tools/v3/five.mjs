/* Пять подач над одними данными. Иконок-предметов внутри аватара нет. */
import { CAST, SKIN, TIER, TBG, TRIM } from './cast.mjs';
import { INK, P, L, C, star5, BUILD, hat, hairF, hairM, FACE, beard, mous, top, extras } from './parts.mjs';

const headPath = (W, jaw = 1) => {
  const x = 50 - W / 2, t = 22, b = 64, r = 12;
  return `M${x} ${t + r} Q${x} ${t} ${x + r} ${t} L${x + W - r} ${t} Q${x + W} ${t} ${x + W} ${t + r} `
       + `L${x + W} ${b - 16} Q${x + W} ${b} ${50 + 11} ${b} L${50 - 11} ${b} Q${x} ${b} ${x} ${b - 16} Z`;
};
/* Общая фигура — её потом по-разному подают */
function figure(c, o = {}) {
  const W = BUILD[c.build], skin = o.skin || SKIN[c.s];
  const h = hat(c.hat, c, W);
  const hf = c.hairF ? hairF(c.hairF, o.hair || c.hair, W) : { b: '', f: '' };
  return {
    back: hf.b + h.b,
    body: top(c.top, c),
    neck: P('M43 60 h14 v10 h-14 Z', skin, 2.6),
    head: P(headPath(W), skin, 2.6),
    hair: c.hat === 'space' ? '' : (c.hairF ? '' : hairM(o.hair || c.hair, W)),
    beard: c.beard ? beard(c.beard, o.hair || c.hair, W) : '',
    face: FACE[c.face] || FACE.calm,
    mous: c.mous ? mous(o.hair || c.hair) : '',
    hat: h.f, over: h.o || '',
    extra: extras(c),
  };
}
const stack = (f) => f.back + f.body + f.neck + f.head + f.hair + f.beard + f.face + f.mous + f.hat + f.over + f.extra;
const svg = (inner, vb = '0 0 100 100') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
const clip = (id, inner, shape = '<circle cx="50" cy="50" r="50"/>') =>
  `<defs><clipPath id="${id}">${shape}</clipPath></defs><g clip-path="url(#${id})">${inner}</g>`;

/* 1 — ПИКСЕЛЬ 28×28 */
export function pixel(c) {
  const px = 100 / 28, g = [], t = TIER(c.p);
  const R = (x, y, w, h, f) => g.push(`<rect x="${(x * px).toFixed(2)}" y="${(y * px).toFixed(2)}" width="${(w * px).toFixed(2)}" height="${(h * px).toFixed(2)}" fill="${f}"/>`);
  const skin = SKIN[c.s], W = c.build === 'wide' ? 12 : c.build === 'slim' ? 10 : 11;
  const hx = Math.round((28 - W) / 2);
  R(0, 0, 28, 28, TBG[t]);
  R(hx - 3, 20, W + 6, 8, c.c1);                              // плечи
  if (c.top === 'vest')   { R(hx - 3, 22, 2, 6, '#f2f1ee'); R(hx + W + 1, 22, 2, 6, '#f2f1ee'); }
  if (c.top === 'track')  { R(hx - 2, 21, 1, 7, '#f2f1ee'); R(hx + W + 1, 21, 1, 7, '#f2f1ee'); }
  if (c.top === 'jersey') { R(hx - 4, 21, 3, 4, '#f2f1ee'); R(hx + W + 1, 21, 3, 4, '#f2f1ee'); }
  if (c.top === 'apronW' || c.top === 'apron') R(hx, 22, W, 6, c.top === 'apronW' ? '#f6f4ef' : '#8a6a4a');
  if (c.top === 'barmy' || c.top === 'gold')   R(hx - 1, 21, W + 2, 3, '#e8b93c');
  if (c.top === 'fur')    { R(hx - 3, 21, 3, 7, '#e8e2d4'); R(hx + W, 21, 3, 7, '#e8e2d4'); }
  R(hx, 9, W, 11, skin);                                       // голова
  const hc = c.hc || ['#4f6f8f', '#35516b', '#7b98b2'];
  if (c.hat === 'none') { R(hx, 8, W, 2, c.hair);
    if (c.hairF === 'long') { R(hx - 2, 9, 2, 10, c.hair); R(hx + W, 9, 2, 10, c.hair); }
    if (c.hairF === 'bob')  { R(hx - 1, 9, 1, 6, c.hair); R(hx + W, 9, 1, 6, c.hair); }
    if (c.hairF === 'bun')  R(hx + W - 2, 6, 3, 3, c.hair);
    if (c.hairF === 'tail') R(hx + W, 10, 2, 7, c.hair);
  } else if (c.hat === 'space') { R(hx - 2, 6, W + 4, 16, '#f6f4ef'); R(hx - 1, 7, W + 2, 4, '#d9a326'); R(hx, 11, W, 9, skin); }
  else {
    R(hx, 6, W, 3, hc[0] !== '#4f6f8f' || c.hat === 'ushanka' ? hc[0] : (c.hat === 'kepka' ? '#26262a' : c.hat === 'cook' ? '#c8492f' : c.hat === 'hockey' ? '#c8322a' : c.hat === 'helmetS' ? '#e8b93c' : c.hat === 'monomah' ? '#e8b93c' : c.hat === 'tophat' ? '#26262a' : c.hat === 'bandana' ? '#c8492f' : c.c1));
    R(hx - 1, 9, W + 2, 1, hc[2] || '#f6f4ef');
    if (c.hat === 'ushanka') { R(hx - 2, 10, 2, 4, hc[0]); R(hx + W, 10, 2, 4, hc[0]); }
    if (c.hat === 'tophat')  R(hx + 1, 2, W - 2, 4, '#26262a');
    if (c.hat === 'monomah') { R(hx + Math.floor(W / 2), 3, 1, 3, '#e8b93c'); }
    if (c.hat === 'kepka' || c.hat === 'cap') R(hx - 3, 9, 3, 1, '#141417');
    if (c.star) R(hx + Math.floor(W / 2) - 1, 6, 2, 2, '#c8322a');
  }
  if (c.beard === 'full') R(hx, 15, W, 5, c.hair);
  if (c.mous) R(hx + 2, 15, W - 4, 1, c.hair);
  if (c.hat === 'hockey') { for (let i = 0; i < 4; i++) R(hx, 12 + i * 2, W, 1, '#8e99a3'); }
  R(hx + 2, 13, 2, 1, INK); R(hx + W - 4, 13, 2, 1, INK);      // глаза
  R(hx + Math.floor(W / 2) - 1, 17, 3, 1, INK);                // рот
  if (c.shades) R(hx + 1, 12, W - 2, 3, INK);
  return svg(g.join('') + `<circle cx="50" cy="50" r="48.5" fill="none" stroke="${TRIM[t]}" stroke-width="3"/>`);
}

/* 2 — КРУПНЫЙ ПОРТРЕТ: голова во весь кадр, тело срезано */
export function bigface(c) {
  const f = figure(c), t = TIER(c.p);
  return svg(`<circle cx="50" cy="50" r="50" fill="${TBG[t]}"/>`
    + clip('bf' + c.id, `<g transform="translate(50,58) scale(1.5) translate(-50,-42)">${stack(f)}</g>`)
    + `<circle cx="50" cy="50" r="48.5" fill="none" stroke="${TRIM[t]}" stroke-width="3"/>`);
}

/* 3 — ФИГУРКА ЦЕЛИКОМ: силуэт делает всю работу */
export function chibi(c) {
  const t = TIER(c.p), W = BUILD[c.build], skin = SKIN[c.s];
  const f = figure(c);
  const legs = c.top === 'tutu'
    ? P('M34 128 q16 -14 32 0 q-6 8 -16 8 q-10 0 -16 -8 Z', '#f4e3ea', 2.6) + L('M44 136 v16 M56 136 v16', 3.4, skin)
    : L('M43 120 v26 M57 120 v26', 6.5, c.c2) + L('M40 148 h8 M52 148 h8', 5, INK);
  const arms = L('M18 92 q-4 16 0 26 M82 92 q4 16 0 26', 6.5, c.c1);
  return svg(`<rect width="100" height="160" rx="14" fill="${TBG[t]}"/>`
    + clip('ch' + c.id, `<g transform="translate(0,-4)">${arms}${stack(f)}</g>${legs}`,
        '<rect width="100" height="160" rx="14"/>')
    + `<rect x="1.5" y="1.5" width="97" height="157" rx="12.5" fill="none" stroke="${TRIM[t]}" stroke-width="3"/>`,
    '0 0 100 160');
}

/* 4 — КАРИКАТУРА: крупный нос и подбородок, характер в лице */
export function toon(c) {
  const t = TIER(c.p), W = BUILD[c.build] + 4, skin = SKIN[c.s];
  const f = figure(c, {});
  const nose = P(`M50 46 q7 6 2 11 q-5 3 -8 -1`, skin, 2.6);
  const ears = C(50 - W / 2 - 1, 46, 4.5, skin, 2.4) + C(50 + W / 2 + 1, 46, 4.5, skin, 2.4);
  return svg(`<circle cx="50" cy="50" r="50" fill="${TBG[t]}"/>`
    + clip('tn' + c.id, f.back + f.body + f.neck + ears
        + P(`M${50 - W / 2} 32 Q${50 - W / 2} 20 50 20 Q${50 + W / 2} 20 ${50 + W / 2} 32 L${50 + W / 2 - 2} 56 Q${50 + W / 2 - 4} 70 50 70 Q${50 - W / 2 + 4} 70 ${50 - W / 2 + 2} 56 Z`, skin, 2.6)
        + f.hair + f.beard + f.face + nose + f.mous + f.hat + f.over + f.extra)
    + `<circle cx="50" cy="50" r="48.5" fill="none" stroke="${TRIM[t]}" stroke-width="3"/>`);
}

/* 5 — МИНИМАЛИЗМ: приглушённая палитра, тонкая линия, много воздуха */
export function minimal(c) {
  const t = TIER(c.p);
  const mute = (h) => h;
  const f = figure(c, {});
  const BG = ['#f4f2ee', '#f2ece2', '#eceff2', '#f7f0dc'][t];
  return svg(`<circle cx="50" cy="50" r="50" fill="${BG}"/>`
    + clip('mn' + c.id, `<g transform="translate(50,54) scale(.82) translate(-50,-50)" opacity=".96">${stack(f)}</g>`)
    + `<circle cx="50" cy="50" r="47" fill="none" stroke="${TRIM[t]}" stroke-width="1.6"/>`);
}

export const RENDERERS = [
  ['pixel','Пиксель 28×28','клетка: ничто не может наехать', pixel, 1],
  ['bigface','Крупный портрет','голова во весь кадр, тело срезано', bigface, 1],
  ['chibi','Фигурка целиком','силуэт делает всю работу', chibi, 1.6],
  ['toon','Карикатура','крупный нос, уши, тяжёлый подбородок', toon, 1],
  ['minimal','Минимализм','приглушённо, тонкая линия, воздух', minimal, 1],
];
export { CAST };
