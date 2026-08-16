/* Десять рендереров над одними и теми же данными персонажа.
   Различается ТОЛЬКО подача: обводка, палитра, тени, форма подложки. */
import { A, headPath, shouldersPath, neckPath, HATS, HATCOL, PROPS, face, beardPath, hairPath } from './geom.mjs';
import { SKIN, TIER } from './chars.mjs';

const TIERBG = ['#efece4', '#e9e0d2', '#dfe4e8', '#f5e6b8'];
const TIERRING = ['#c4bcab', '#b08050', '#8fa3b5', '#c9a23f'];
const INK = '#211e1a';

/** Общая сборка: фон → шапка сзади → плечи → шея → голова → волосы → борода → лицо → шапка спереди → предмет */
function build(c, o) {
  const s = SKIN[c.skin], hc = HATCOL[c.hat] || HATCOL.cap;
  const hat = c.hat ? HATS[c.hat](hc) : { back: '', front: '', over: '' };
  const st = o.stroke ? ` stroke="${o.ink || INK}" stroke-width="${o.stroke}" stroke-linejoin="round"` : '';
  const P = (d, f) => `<path d="${d}" fill="${f}"${st}/>`;
  return {
    back:  hat.back,
    body:  P(shouldersPath(), c.cloth) ,
    neck:  P(neckPath(), o.flatSkin || s),
    head:  P(headPath(), o.flatSkin || s),
    hair:  c.hat === 'helmet2' ? '' : P(hairPath(), o.flatHair || c.hairCol),
    beard: c.beard ? `<path d="${beardPath(c.beard).match(/d="([^"]*)"/)[1]}" fill="${o.flatHair || c.hairCol}"${st}/>` : '',
    face:  face(c.eyes, o.ink || INK),
    hat:   hat.front, over: hat.over || '',
    prop:  o.noProp ? '' : (PROPS[c.prop] ? PROPS[c.prop](c.accent) : ''),
    tier:  TIER(c.price),
  };
}
const wrap = (inner, defs = '') =>
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${defs}${inner}</svg>`;
const disc = (fill, ring, w = 3) =>
  `<circle cx="50" cy="50" r="50" fill="${fill}"/>`
  + (ring ? `<circle cx="50" cy="50" r="${50 - w / 2}" fill="none" stroke="${ring}" stroke-width="${w}"/>` : '');
const clip = (id, inner) =>
  `<defs><clipPath id="${id}"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#${id})">${inner}</g>`;

/* 1. СТИКЕР — толстая ровная обводка, плоская заливка, белый кант вокруг фигуры */
export const sticker = (c) => { const b = build(c, { stroke: 3 });
  return wrap(disc(TIERBG[b.tier], null) + clip('s' + c.id,
    `<g stroke="#fff" stroke-width="7" stroke-linejoin="round" fill="none">
      <path d="${shouldersPath()}"/><path d="${headPath()}"/></g>`
    + b.back + b.body + b.neck + b.head + b.hair + b.beard + b.face + b.hat + b.over + b.prop)
    + `<circle cx="50" cy="50" r="48.5" fill="none" stroke="${TIERRING[b.tier]}" stroke-width="3"/>`); };

/* 2. НУАР — только силуэт и один акцент, обводки нет вообще */
export const noir = (c) => { const b = build(c, { flatSkin: '#f4f1ea', flatHair: '#15130f', ink: '#15130f' });
  return wrap(disc('#15130f', null) + clip('n' + c.id,
    `<g>${b.back}<path d="${shouldersPath()}" fill="${c.accent}"/>` + b.neck + b.head + b.hair + b.beard + b.face + b.hat + b.prop + `</g>`)
    + `<circle cx="50" cy="50" r="47" fill="none" stroke="${c.accent}" stroke-width="2"/>`); };

/* 3. ДУОТОН — две краски и растр, как трафаретная печать */
export const duotone = (c) => { const b = build(c, { flatSkin: '#f6efe2', flatHair: '#1c2c3a', ink: '#1c2c3a', stroke: 0 });
  const dots = `<defs><pattern id="d${c.id}" width="3" height="3" patternUnits="userSpaceOnUse">
      <circle cx="1.5" cy="1.5" r="0.75" fill="#1c2c3a" opacity=".5"/></pattern></defs>`;
  return wrap(dots + disc('#e8e2d0', null) + clip('dt' + c.id,
    `<rect y="50" width="100" height="50" fill="url(#d${c.id})"/>`
    + b.back + `<path d="${shouldersPath()}" fill="#1c2c3a"/>` + b.neck + b.head + b.hair + b.beard + b.face
    + b.hat.replace(/fill="[^"]*"/g, 'fill="#1c2c3a"') + b.prop.replace(/fill="[^"]*"/g, 'fill="#c8492f"'))); };

/* 4. ГЕОМЕТРИЯ — только круги и треугольники, без обводки */
export const geo = (c) => { const b = build(c, {});
  const s = SKIN[c.skin], hc = HATCOL[c.hat] || HATCOL.cap;
  return wrap(disc(TIERBG[TIER(c.price)], TIERRING[TIER(c.price)], 3) + clip('g' + c.id,
    `<path d="M50 100 L14 100 A36 36 0 0 1 86 100 Z" fill="${c.cloth}"/>`
    + `<circle cx="50" cy="44" r="24" fill="${s}"/>`
    + (c.hat ? `<path d="M26 40 A24 24 0 0 1 74 40 Z" fill="${hc.main}"/>`
             + `<rect x="20" y="38" width="60" height="6" rx="3" fill="${hc.dark}"/>` : '')
    + (c.beard ? `<path d="M32 50 A18 18 0 0 0 68 50 Z" fill="${c.hairCol}"/>` : '')
    + `<circle cx="41" cy="42" r="2.6" fill="${INK}"/><circle cx="59" cy="42" r="2.6" fill="${INK}"/>`
    + `<path d="M44 54 h12" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`
    + `<circle cx="20" cy="84" r="11" fill="${c.accent}"/>`)); };

/* 5. КОНТУР — одна толщина линии, заливки почти нет, один акцент */
export const outline = (c) => { const b = build(c, { flatSkin: 'none', flatHair: 'none', stroke: 2.4 });
  return wrap(disc('#faf8f3', null) + clip('o' + c.id,
    `<g fill="none" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round">`
    + `<path d="${shouldersPath()}"/><path d="${headPath()}"/><path d="${hairPath()}" fill="${c.accent}"/>`
    + (c.hat ? HATS[c.hat](HATCOL[c.hat]).front.replace(/fill="[^"]*"/g, 'fill="none"') : '')
    + (c.beard ? `<path d="${beardPath(c.beard).match(/d="([^"]*)"/)[1]}"/>` : '')
    + `</g>` + b.face + b.prop.replace(/fill="[^"]*"/g, `fill="${c.accent}"`))
    + `<circle cx="50" cy="50" r="48" fill="none" stroke="${INK}" stroke-width="2.4"/>`); };

/* 6. КРУПНЫЙ ПИКСЕЛЬ — 20×20, тот же персонаж, но клетками */
export const blocky = (c) => {
  const px = 5, g = [];
  const set = (x, y, w, h, f) => g.push(`<rect x="${x * px}" y="${y * px}" width="${w * px}" height="${h * px}" fill="${f}"/>`);
  const s = SKIN[c.skin], hc = HATCOL[c.hat] || HATCOL.cap, t = TIER(c.price);
  set(0, 0, 20, 20, TIERBG[t]);
  set(4, 14, 12, 6, c.cloth);                       // плечи
  set(6, 5, 8, 9, s);                               // голова
  if (c.hat) { set(5, 3, 10, 3, hc.main); set(4, 5, 12, 1, hc.dark);
               if (c.hat.startsWith('ushanka')) { set(4, 6, 1, 4, hc.main); set(15, 6, 1, 4, hc.main); } }
  else set(6, 4, 8, 2, c.hairCol);
  if (c.beard === 'full') set(6, 10, 8, 4, c.hairCol);
  if (c.beard === 'mous') set(7, 10, 6, 1, c.hairCol);
  set(8, 8, 1, 1, INK); set(11, 8, 1, 1, INK);      // глаза
  set(9, 11, 2, 1, INK);                            // рот
  set(1, 15, 3, 4, c.accent);                       // предмет
  return wrap(g.join('') + `<circle cx="50" cy="50" r="48.5" fill="none" stroke="${TIERRING[t]}" stroke-width="3"/>`);
};

/* 7. ГЕРБ — фигура внутри щита с лентой */
export const crest = (c) => { const b = build(c, { stroke: 2.6 }); const t = TIER(c.price);
  return wrap(`<path d="M50 2 L92 14 V52 Q92 84 50 98 Q8 84 8 52 V14 Z" fill="${TIERBG[t]}" stroke="${TIERRING[t]}" stroke-width="3.5"/>`
    + `<defs><clipPath id="cr${c.id}"><path d="M50 5 L89 16 V52 Q89 82 50 95 Q11 82 11 52 V16 Z"/></clipPath></defs>`
    + `<g clip-path="url(#cr${c.id})">` + b.back + b.body + b.neck + b.head + b.hair + b.beard + b.face + b.hat + b.over + b.prop + `</g>`
    + `<path d="M14 72 h72 l-6 9 l6 9 H14 l6 -9 Z" fill="${c.accent}" stroke="${INK}" stroke-width="2"/>`); };

/* 8. РИЗО — плоские пятна со сдвигом, как непопадание краски */
export const riso = (c) => { const b = build(c, { stroke: 0, ink: '#20304a' });
  const shift = `<g transform="translate(2.5,2.5)" opacity=".55" style="mix-blend-mode:multiply">`
    + `<path d="${shouldersPath()}" fill="#e8543f"/><path d="${headPath()}" fill="#e8543f"/>`
    + (c.hat ? HATS[c.hat](HATCOL[c.hat]).front.replace(/fill="[^"]*"/g, 'fill="#e8543f"') : '') + `</g>`;
  return wrap(disc('#f3efe2', null) + clip('r' + c.id, shift
    + `<g opacity=".9"><path d="${shouldersPath()}" fill="#2f5fa8"/><path d="${headPath()}" fill="#f6dfc4"/>`
    + `<path d="${hairPath()}" fill="#20304a"/>`
    + (c.hat ? HATS[c.hat](HATCOL[c.hat]).front.replace(/fill="[^"]*"/g, 'fill="#20304a"') : '')
    + (c.beard ? `<path d="${beardPath(c.beard).match(/d="([^"]*)"/)[1]}" fill="#20304a"/>` : '')
    + b.face + `</g>` + b.prop)); };

/* 9. ЖЁСТКАЯ ТЕНЬ — плоско, но со смещённой тенью; бруталистский вид */
export const hardshadow = (c) => { const b = build(c, { stroke: 2.6 }); const t = TIER(c.price);
  const sh = `<g transform="translate(3,3)"><path d="${shouldersPath()}" fill="${INK}"/><path d="${headPath()}" fill="${INK}"/>`
    + (c.hat ? HATS[c.hat](HATCOL[c.hat]).front.replace(/fill="[^"]*"/g, `fill="${INK}"`) : '') + `</g>`;
  return wrap(`<rect width="100" height="100" rx="10" fill="${TIERBG[t]}"/>`
    + `<defs><clipPath id="hs${c.id}"><rect width="100" height="100" rx="10"/></clipPath></defs>`
    + `<g clip-path="url(#hs${c.id})">` + sh + b.back + b.body + b.neck + b.head + b.hair + b.beard + b.face + b.hat + b.over + b.prop + `</g>`
    + `<rect x="1.5" y="1.5" width="97" height="97" rx="9" fill="none" stroke="${INK}" stroke-width="3"/>`); };

/* 10. НЕОН — тёмный фон, светящийся контур, ночная Москва */
export const neon = (c) => { const t = TIER(c.price);
  const glow = `<defs><filter id="gl${c.id}"><feGaussianBlur stdDeviation="1.6" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  const stroke = c.accent;
  return wrap(glow + disc('#14161c', null) + clip('ne' + c.id,
    `<g fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round" filter="url(#gl${c.id})">`
    + `<path d="${shouldersPath()}"/><path d="${headPath()}"/>`
    + (c.hat ? HATS[c.hat](HATCOL[c.hat]).front.replace(/fill="[^"]*"/g, 'fill="none"') : '')
    + (c.beard ? `<path d="${beardPath(c.beard).match(/d="([^"]*)"/)[1]}"/>` : '')
    + `</g>`
    + face(c.eyes, '#f2f1ee'))
    + `<circle cx="50" cy="50" r="48" fill="none" stroke="${TIERRING[t]}" stroke-width="2" opacity=".7"/>`); };

export const STYLES = [
  ['sticker','Стикер','толстая ровная обводка, белый кант, плоские заливки', sticker],
  ['blocky','Крупный пиксель','20×20, тот же персонаж клетками', blocky],
  ['hardshadow','Жёсткая тень','плоско + смещённая тень, бруталистская рамка', hardshadow],
  ['crest','Герб','фигура внутри щита с лентой', crest],
  ['noir','Нуар','силуэт и один акцентный цвет, обводки нет', noir],
  ['duotone','Дуотон','две краски и растр, трафаретная печать', duotone],
  ['outline','Контур','одна толщина линии, почти без заливки', outline],
  ['geo','Геометрия','только круги и дуги, никакой мелочи', geo],
  ['riso','Ризо','сдвиг красок, как непопадание при печати', riso],
  ['neon','Неон','тёмный фон, светящийся контур', neon],
];
