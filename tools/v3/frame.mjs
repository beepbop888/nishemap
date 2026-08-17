/* Щит с лентой — общая рамка для ВСЕХ стилей. Содержимое рисуется в квадрате 0..100,
   рамка сама кадрирует его по контуру щита и подписывает лентой. */
import { TIER, TBG, TRIM } from './cast.mjs';
const RIB = ['#8f8778', '#a8692c', '#6f7d8b', '#a8801f'];
export const SHIELD_OUT = 'M50 2 L94 15 V55 Q94 90 50 106 Q6 90 6 55 V15 Z';
export const SHIELD_IN  = 'M50 7 L89 19 V55 Q89 86 50 100 Q11 86 11 55 V19 Z';

/** inner — SVG-строка в системе 0..100 по ширине; fit подгоняет её под поле щита. */
export function frame(c, inner, o = {}) {
  const t = TIER(c.p), id = 'f_' + c.id + (o.k || '');
  const sc = o.scale || 1, dx = o.dx || 0, dy = o.dy || 0;
  return `<svg viewBox="0 0 100 124" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${c.n}">
  <defs><clipPath id="${id}"><path d="${SHIELD_IN}"/></clipPath></defs>
  <path d="${SHIELD_OUT}" fill="${TRIM[t]}"/>
  <path d="${SHIELD_IN}" fill="${o.bg || TBG[t]}"/>
  <g clip-path="url(#${id})"><g transform="translate(${dx},${dy}) scale(${sc}) translate(${(1 - 1 / sc) * 0},0)">${inner}</g></g>
  <path d="${SHIELD_IN}" fill="none" stroke="${TRIM[t]}" stroke-width="2.4"/>
  <path d="M4 88 h92 l-7 11 l7 11 H4 l7 -11 Z" fill="${RIB[t]}" stroke="#1e1b17" stroke-width="2.2" stroke-linejoin="round"/>
  <text x="50" y="103" font-family="Oswald,Impact,sans-serif" font-size="${c.n.length > 14 ? 7.4 : 9}"
    font-weight="700" letter-spacing="0.4" text-anchor="middle" fill="#f6f4ef">${c.n.toUpperCase()}</text>
</svg>`;
}
