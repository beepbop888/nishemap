/* Пять конкретных советских мультфильмов — и, главное, пять РАЗНЫХ ТЕХНИК.
   Технику тянут SVG-фильтры: перекладка, пластилин, войлок, восковой мелок.
   Именно техника делает стиль узнаваемым, а не «просто рисунок». */
import { CAST, SKIN } from './cast.mjs';
import { INK, P, L, C, BUILD, hat, hairF, hairM, beard, mous, top } from './parts.mjs';
import { frame } from './frame.mjs';

const headPath = (W, soft = 0) => { const x = 50 - W / 2, t = 22, b = 64, r = 12 + soft;
  return `M${x} ${t + r} Q${x} ${t} ${x + r} ${t} L${x + W - r} ${t} Q${x + W} ${t} ${x + W} ${t + r} `
       + `L${x + W} ${b - 16} Q${x + W} ${b} 61 ${b} L39 ${b} Q${x} ${b} ${x} ${b - 16} Z`; };

/** Общая фигура; палитру и обводку задаёт стиль. */
function body(c, o = {}) {
  const W = BUILD[c.build], skin = o.skin || SKIN[c.s];
  const h = hat(c.hat, c, W), hf = c.hairF ? hairF(c.hairF, o.hair || c.hair, W) : { b: '' };
  const hair = o.hair || c.hair;
  return hf.b + h.b + top(c.top, c)
    + P('M43 60 h14 v10 h-14 Z', skin, o.sw ?? 2.6, o.ink || INK)
    + P(headPath(W, o.soft || 0), skin, o.sw ?? 2.6, o.ink || INK)
    + (c.hat === 'space' ? '' : (c.hairF ? '' : hairM(hair, W)))
    + (c.beard ? beard(c.beard, hair, W) : '')
    + (o.face || '') + (c.mous ? mous(hair) : '') + h.f + (h.o || '');
}

/* ================= 1. НУ, ПОГОДИ! (Котёночкин, 1969) =================
   Рисованная целлулоидная: очень жирный чёрный контур, плоский насыщенный цвет,
   белки глаз крупные, мимика утрированная. */
const npFace = () =>
  C(42, 45, 6, '#fff', 3) + C(58, 45, 6, '#fff', 3)
  + C(43, 46, 2.8, INK, 0) + C(59, 46, 2.8, INK, 0)
  + L('M34 35 q8 -5 15 -2 M51 33 q7 -3 15 2', 3, INK)
  + P('M42 56 q8 7 16 0 q-3 6 -8 6 q-5 0 -8 -6 Z', '#8e2b22', 3);
export const nupogodi = (c) => frame(c,
  `<g stroke-linejoin="round">${body(c, { sw: 3.4, face: npFace() })}</g>`,
  { k: 'np', scale: .96, dy: 2, bg: '#f2e6c8' });

/* ================= 2. ЧЕБУРАШКА (Качанов, 1969) =================
   Кукольная анимация: мягкий войлок, круглые формы, почти нет контура,
   большие тёмные глаза. Фильтр даёт ворсистый край и объём. */
const cheFilter = (id) => `
  <filter id="felt_${id}" x="-15%" y="-15%" width="130%" height="130%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="bump"/>
    <feSpecularLighting in="bump" surfaceScale="1.8" specularConstant=".22" specularExponent="26"
      lighting-color="#fff8ec" result="sp"><feDistantLight azimuth="235" elevation="60"/></feSpecularLighting>
    <feComposite in="sp" in2="SourceAlpha" operator="in" result="spc"/>
    <feComponentTransfer in="spc" result="spf"><feFuncA type="linear" slope=".55"/></feComponentTransfer>
    <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="9" result="fz"/>
    <feColorMatrix in="fz" type="saturate" values="0" result="fzg"/>
    <feComponentTransfer in="fzg" result="fzc"><feFuncA type="linear" slope=".22"/></feComponentTransfer>
    <feComposite in="fzc" in2="SourceAlpha" operator="in" result="fuzz"/>
    <feMerge><feMergeNode in="d"/><feMergeNode in="fuzz"/><feMergeNode in="spf"/></feMerge>
  </filter>`;
const cheFace = () =>
  C(42, 46, 5.2, '#2b211a', 0) + C(58, 46, 5.2, '#2b211a', 0)
  + C(40.4, 44.2, 1.7, '#fff', 0) + C(56.4, 44.2, 1.7, '#fff', 0)
  + P('M47 52 q3 2.5 6 0 q-3 3.5 -6 0 Z', '#3a2b22', 0)
  + L('M44 59 q6 4 12 0', 2.2, '#5a4034');
export const cheburashka = (c) => frame(c,
  cheFilter(c.id) + `<g filter="url(#felt_${c.id})">${body(c, { sw: 0, soft: 6, face: cheFace() })}</g>`,
  { k: 'ch', scale: .95, dy: 2, bg: '#e6d7bd' });

/* ================= 3. ЁЖИК В ТУМАНЕ (Норштейн, 1975) =================
   Перекладка: вырезанные слои бумаги, зерно, туман поверх, приглушённая охра. */
const fogFilter = (id) => `
  <filter id="paper_${id}" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="4" seed="3" result="g"/>
    <feColorMatrix in="g" type="saturate" values="0" result="gg"/>
    <feComponentTransfer in="gg" result="gc"><feFuncA type="linear" slope=".32"/></feComponentTransfer>
    <feComposite in="gc" in2="SourceGraphic" operator="in" result="grain"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="grain"/></feMerge>
  </filter>
  <linearGradient id="fog_${id}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#e8e2d2" stop-opacity="0"/>
    <stop offset=".62" stop-color="#ded7c6" stop-opacity=".16"/>
    <stop offset="1" stop-color="#cfc7b3" stop-opacity=".42"/></linearGradient>`;
const ezhFace = () =>
  C(43, 46, 2.6, '#2e2620', 0) + C(58, 46, 2.6, '#2e2620', 0)
  + L('M36 38 q6 -3 11 -1 M54 37 q5 -2 11 1', 1.7, '#5c4f42')
  + L('M45 57 q5 3 10 0', 1.9, '#4a3e33');
export const ezhik = (c) => frame(c,
  fogFilter(c.id)
  + `<g filter="url(#paper_${c.id})">${body(c, { sw: 1.8, ink: '#3d332b', skin: c.s === 'm' ? '#cfa87f' : '#dbb995', face: ezhFace() })}</g>`
  + `<rect x="-10" y="-10" width="120" height="120" fill="url(#fog_${c.id})"/>`,
  { k: 'ez', scale: .95, dy: 2, bg: '#d6cdb8' });

/* ================= 4. ВИННИ-ПУХ (Хитрук, 1969) =================
   Гуашь и восковой мелок: линия нарочно дрожит, охристая палитра, видна фактура. */
const crayonFilter = (id) => `
  <filter id="crayon_${id}" x="-12%" y="-12%" width="124%" height="124%">
    <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="4" seed="11" result="w"/>
    <feDisplacementMap in="SourceGraphic" in2="w" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="3" seed="5" result="t"/>
    <feColorMatrix in="t" type="saturate" values="0" result="tg"/>
    <feComponentTransfer in="tg" result="tc"><feFuncA type="linear" slope=".3"/></feComponentTransfer>
    <feComposite in="tc" in2="d" operator="in" result="grain"/>
    <feMerge><feMergeNode in="d"/><feMergeNode in="grain"/></feMerge>
  </filter>`;
const vpFace = () =>
  C(43, 46, 2.9, '#3a2a18', 0) + C(58, 46, 2.9, '#3a2a18', 0)
  + L('M36 38 q6 -4 11 -1 M54 37 q5 -3 11 1', 2.2, '#6b4a26')
  + L('M45 57 q5 4 10 0', 2.2, '#6b4a26');
export const vinnipuh = (c) => frame(c,
  crayonFilter(c.id)
  + `<g filter="url(#crayon_${c.id})">${body(c, { sw: 2.6, ink: '#5a3f22', skin: c.s === 'm' ? '#e8c48d' : '#f0d3a4', face: vpFace() })}</g>`,
  { k: 'vp', scale: .95, dy: 2, bg: '#e9d6a8' });

/* ============ 5. ПЛАСТИЛИНОВАЯ ВОРОНА (Татарский, 1981) ============
   Пластилин: всё объёмное и слегка кривое, блики сверху, цвета сочные. */
const clayFilter = (id) => `
  <filter id="clay_${id}" x="-15%" y="-15%" width="130%" height="130%">
    <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed="19" result="w"/>
    <feDisplacementMap in="SourceGraphic" in2="w" scale="2.2" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="SourceAlpha" stdDeviation="1.4" result="bump"/>
    <feSpecularLighting in="bump" surfaceScale="3" specularConstant=".42" specularExponent="20"
      lighting-color="#ffffff" result="sp"><feDistantLight azimuth="228" elevation="60"/></feSpecularLighting>
    <feComposite in="sp" in2="SourceAlpha" operator="in" result="spc"/>
    <feComponentTransfer in="spc" result="spf"><feFuncA type="linear" slope=".75"/></feComponentTransfer>
    <feMerge><feMergeNode in="d"/><feMergeNode in="spf"/></feMerge>
  </filter>`;
const clayFace = () =>
  C(42, 46, 4.6, '#fdfaf2', 0) + C(58, 46, 4.6, '#fdfaf2', 0)
  + C(42.8, 46.6, 2.2, '#241c14', 0) + C(58.8, 46.6, 2.2, '#241c14', 0)
  + P('M48 50 q2 3 4 0 q-2 4 -4 0 Z', '#b8624a', 0)
  + P('M43 57 q7 5 14 0 q-4 5 -7 5 q-3 0 -7 -5 Z', '#8e3b2c', 0);
export const plastilin = (c) => frame(c,
  clayFilter(c.id) + `<g filter="url(#clay_${c.id})">${body(c, { sw: 0, soft: 5, face: clayFace() })}</g>`,
  { k: 'pl', scale: .95, dy: 2, bg: '#efe2c6' });

export const SOVIET = [
  ['nupogodi',   'Ну, погоди!',            '1969, Котёночкин — рисованная целлулоидная', nupogodi],
  ['cheburashka','Чебурашка',              '1969, Качанов — кукольная, войлок',           cheburashka],
  ['ezhik',      'Ёжик в тумане',          '1975, Норштейн — перекладка, бумага и туман', ezhik],
  ['vinnipuh',   'Винни-Пух',              '1969, Хитрук — гуашь и восковой мелок',       vinnipuh],
  ['plastilin',  'Пластилиновая ворона',   '1981, Татарский — пластилин',                 plastilin],
];
export { CAST };
