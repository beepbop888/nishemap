/* Три сохранённые подачи, переведённые в щит с лентой. */
import { CAST, SKIN, TIER, TBG } from './cast.mjs';
import { INK, P, L, C, BUILD, hat, hairF, hairM, beard, mous, top, extras } from './parts.mjs';
import { frame } from './frame.mjs';

const headPath = (W) => { const x = 50 - W / 2, t = 22, b = 64, r = 12;
  return `M${x} ${t + r} Q${x} ${t} ${x + r} ${t} L${x + W - r} ${t} Q${x + W} ${t} ${x + W} ${t + r} `
       + `L${x + W} ${b - 16} Q${x + W} ${b} 61 ${b} L39 ${b} Q${x} ${b} ${x} ${b - 16} Z`; };
const FACE = {
  tired: L('M40 46 h5 M55 46 h5', 2.6, INK) + L('M38 39 q4 -2 8 0 M54 39 q4 -2 8 0', 2, INK) + L('M45 56 h10', 2.4, INK),
  happy: L('M38 47 q4 -6 8 0 M54 47 q4 -6 8 0', 2.6, INK) + L('M44 55 q6 6 12 0', 2.6, INK),
  sly:   L('M38 45 h8 M54 45 h8', 2.6, INK) + L('M37 39 q5 3 9 1 M54 40 q4 2 9 -1', 2, INK) + L('M44 57 q7 3 12 -2', 2.4, INK),
  driven:C(41, 46, 2.4, INK) + C(59, 46, 2.4, INK) + L('M36 39 q5 3 10 2 M54 41 q5 -1 10 -2', 2.2, INK) + L('M45 56 h10', 2.4, INK),
  proud: C(41, 46, 2.2, INK) + C(59, 46, 2.2, INK) + L('M35 39 q6 -3 11 -1 M54 38 q5 -2 11 1', 2.2, INK) + L('M44 56 q6 2 12 0', 2.2, INK),
  calm:  C(41, 46, 2.2, INK) + C(59, 46, 2.2, INK) + L('M45 56 q5 2 10 0', 2.2, INK),
  awe:   C(41, 46, 3.4, '#fff', 2) + C(59, 46, 3.4, '#fff', 2) + C(41, 46, 1.5, INK) + C(59, 46, 1.5, INK)
       + `<ellipse cx="50" cy="57" rx="3" ry="3.6" fill="${INK}"/>`,
};
function fig(c) {
  const W = BUILD[c.build], skin = SKIN[c.s], h = hat(c.hat, c, W);
  const hf = c.hairF ? hairF(c.hairF, c.hair, W) : { b: '' };
  return hf.b + h.b + top(c.top, c) + P('M43 60 h14 v10 h-14 Z', skin, 2.6) + P(headPath(W), skin, 2.6)
    + (c.hat === 'space' ? '' : (c.hairF ? '' : hairM(c.hair, W)))
    + (c.beard ? beard(c.beard, c.hair, W) : '') + (FACE[c.face] || FACE.calm)
    + (c.mous ? mous(c.hair) : '') + h.f + (h.o || '') + extras(c);
}

/* 1 — ФИГУРКА ЦЕЛИКОМ */
export function chibi(c) {
  const skin = SKIN[c.s];
  const legs = c.top === 'tutu'
    ? P('M34 118 q16 -12 32 0 q-6 7 -16 7 q-10 0 -16 -7 Z', '#f4e3ea', 2.4)
    : L('M43 100 v18 M57 100 v18', 6, c.c2) + L('M40 120 h8 M52 120 h8', 4.6, INK);
  const arms = L('M18 84 q-4 12 0 20 M82 84 q4 12 0 20', 6, c.c1);
  return frame(c, `<g transform="translate(0,-6) scale(.82) translate(11,6)">${arms}${fig(c)}${legs}</g>`,
    { k: 'c', scale: 1 });
}

/* 2 — ПИКСЕЛЬ 32×32 (тот, первый вариант: крупнее и с тенями) */
export function pixel32(c) {
  const n = 32, px = 100 / n, g = [];
  const R = (x, y, w, h, f) => g.push(`<rect x="${(x * px).toFixed(2)}" y="${(y * px).toFixed(2)}" width="${(w * px).toFixed(2)}" height="${(h * px).toFixed(2)}" fill="${f}"/>`);
  const skin = SKIN[c.s], sh = c.s === 'm' ? '#d6a67c' : '#e0bda9';
  const W = c.build === 'wide' ? 16 : c.build === 'slim' ? 13 : 14, hx = Math.round((n - W) / 2);
  const hc = c.hc || [c.c1, c.c2, '#f6f4ef'];
  R(hx - 5, 22, W + 10, 10, c.c1);                                   // плечи
  R(hx - 5, 22, 3, 10, c.c2); R(hx + W + 2, 22, 3, 10, c.c2);
  if (c.top === 'vest')   { R(hx - 4, 24, 2, 8, '#f2f1ee'); R(hx + W + 2, 24, 2, 8, '#f2f1ee'); }
  if (c.top === 'track')  { R(hx - 3, 23, 1, 9, '#f2f1ee'); R(hx + W + 2, 23, 1, 9, '#f2f1ee'); }
  if (c.top === 'apronW') R(hx, 24, W, 8, '#f6f4ef');
  if (c.top === 'apron')  R(hx, 24, W, 8, '#8a6a4a');
  if (c.top === 'medals') { R(hx + 1, 25, 3, 2, '#c8322a'); R(hx + 5, 25, 3, 2, '#e8b93c'); R(hx + 9, 25, 3, 2, '#8b98a5'); }
  if (c.top === 'barmy' || c.top === 'gold') R(hx - 1, 23, W + 2, 3, '#e8b93c');
  if (c.top === 'fur')    { R(hx - 5, 23, 4, 9, '#e8e2d4'); R(hx + W + 1, 23, 4, 9, '#e8e2d4'); }
  if (c.top === 'jersey') { R(hx - 6, 23, 4, 5, '#f2f1ee'); R(hx + W + 2, 23, 4, 5, '#f2f1ee'); }
  R(hx, 9, W, 13, skin); R(hx + W - 3, 9, 3, 13, sh);                // голова + тень
  if (c.hat === 'none') { R(hx, 8, W, 3, c.hair);
    if (c.hairF === 'long') { R(hx - 2, 9, 2, 13, c.hair); R(hx + W, 9, 2, 13, c.hair); }
    if (c.hairF === 'bob')  { R(hx - 2, 9, 2, 8, c.hair); R(hx + W, 9, 2, 8, c.hair); }
    if (c.hairF === 'bun')  R(hx + W - 3, 5, 4, 4, c.hair);
    if (c.hairF === 'tail') R(hx + W, 10, 3, 9, c.hair);
  } else if (c.hat === 'space') { R(hx - 3, 5, W + 6, 19, '#f6f4ef'); R(hx - 2, 6, W + 4, 5, '#d9a326'); R(hx, 11, W, 11, skin); }
  else {
    const cap = { ushanka: hc[0], kepka: '#26262a', cap: c.c1, cook: '#c8492f', hockey: '#c8322a',
                  helmetS: '#e8b93c', monomah: '#e8b93c', tophat: '#26262a', bandana: '#c8492f',
                  beanie: '#4f6f8f', platok: '#b8465c', kokoshnik: '#e8b93c' }[c.hat] || c.c1;
    R(hx, 5, W, 4, cap); R(hx - 1, 9, W + 2, 2, hc[2] || '#f6f4ef');
    if (c.hat === 'ushanka' || c.hat === 'platok') { R(hx - 2, 11, 2, 5, cap); R(hx + W, 11, 2, 5, cap); }
    if (c.hat === 'tophat')  R(hx + 2, 1, W - 4, 4, '#26262a');
    if (c.hat === 'monomah' || c.hat === 'kokoshnik') R(hx + (W >> 1), 2, 1, 3, '#e8b93c');
    if (c.hat === 'kepka' || c.hat === 'cap') R(hx - 4, 9, 4, 2, '#141417');
    if (c.star) R(hx + (W >> 1) - 1, 6, 3, 2, '#c8322a');
  }
  if (c.beard === 'full')  R(hx, 16, W, 6, c.hair);
  if (c.beard === 'short') R(hx + 1, 18, W - 2, 4, c.hair);
  if (c.mous) R(hx + 3, 16, W - 6, 1, c.hair);
  if (c.hat === 'hockey') for (let i = 0; i < 4; i++) R(hx, 13 + i * 2, W, 1, '#8e99a3');
  R(hx + 3, 14, 2, 2, INK); R(hx + W - 5, 14, 2, 2, INK);
  R(hx + (W >> 1) - 1, 19, 3, 1, INK);
  if (c.shades) R(hx + 1, 13, W - 2, 4, INK);
  if (c.cans)  { R(hx - 2, 12, 2, 5, '#2a2f3a'); R(hx + W, 12, 2, 5, '#2a2f3a'); R(hx, 4, W, 1, '#2a2f3a'); }
  return frame(c, `<g transform="translate(0,-4) scale(.86) translate(8,4)">${g.join('')}</g>`, { k: 'p' });
}

/* 3 — МИНИМАЛИЗМ */
export function minimal(c) {
  const BG = ['#f4f2ee', '#f2ece2', '#eceff2', '#f7f0dc'][TIER(c.p)];
  return frame(c, `<g transform="translate(0,4) scale(.74) translate(17,0)" opacity=".97">${fig(c)}</g>`,
    { k: 'm', bg: BG });
}
export { CAST };
