/* Три новые подачи: Disney, Смешарики, Союзмультфильм. Все — в щите с лентой. */
import { CAST, SKIN } from './cast.mjs';
import { INK, P, L, C, star5, BUILD, hat, hairF, hairM, beard, mous, top } from './parts.mjs';
import { frame } from './frame.mjs';

/* ---------- 1. DISNEY: большие глаза с бликом, мягкие формы, тёплый свет ---------- */
const dEye = (x, y, r, look = 0) =>
  `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.22}" fill="#fff" stroke="${INK}" stroke-width="1.7"/>`
  + `<circle cx="${x + look}" cy="${y + r * .16}" r="${r * .62}" fill="#4a3a2a"/>`
  + `<circle cx="${x + look}" cy="${y + r * .16}" r="${r * .3}" fill="${INK}"/>`
  + `<circle cx="${x + look - r * .26}" cy="${y - r * .3}" r="${r * .28}" fill="#fff"/>`;
export function disney(c) {
  const W = BUILD[c.build] + 3, skin = SKIN[c.s], x = 50 - W / 2;
  const h = hat(c.hat, c, W), hf = c.hairF ? hairF(c.hairF, c.hair, W) : { b: '' };
  const face = `M${x} 36 Q${x} 20 50 20 Q${50 + W / 2} 20 ${50 + W / 2} 36 `
    + `Q${50 + W / 2} 56 50 66 Q${x} 56 ${x} 36 Z`;
  return frame(c, `
    <defs>
      <radialGradient id="dg_${c.id}" cx="38%" cy="30%" r="75%">
        <stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    ${hf.b}${h.b}
    ${top(c.top, c)}
    ${P('M44 60 h12 v10 h-12 Z', skin, 2)}
    ${P(face, skin, 2.2)}
    ${P(face, `url(#dg_${c.id})`, 0)}
    ${c.hat === 'space' ? '' : (c.hairF ? '' : hairM(c.hair, W))}
    ${c.beard ? beard(c.beard, c.hair, W) : ''}
    ${dEye(43, 44, 5.4, .6)}${dEye(58, 44, 5.4, .6)}
    ${L('M37 34 q6 -4 12 -1 M53 33 q6 -3 12 1', 2, INK)}
    ${P('M50 52 q2.5 3 0 4.5', 'none', 1.6)}
    ${c.face === 'happy' ? L('M44 60 q6 5 12 0', 2.2, INK) : L('M45 60 h10', 2.2, INK)}
    ${c.mous ? mous(c.hair) : ''}
    ${h.f}${h.o || ''}
    ${C(35, 55, 4, '#e79aa0', 0)}${C(65, 55, 4, '#e79aa0', 0)}
  `, { k: 'd', scale: .94, dy: 2 });
}

/* ---------- 2. СМЕШАРИКИ: персонаж — это шар. Ни шеи, ни плеч. ---------- */
export function smesh(c) {
  const skin = SKIN[c.s], R = 30;
  const h = hat(c.hat, c, 40);
  const limb = (x1, y1, x2, y2) => L(`M${x1} ${y1} L${x2} ${y2}`, 3.2, INK);
  const bodyCol = c.c1;
  return frame(c, `
    ${limb(28, 66, 20, 78)}${limb(72, 66, 80, 78)}
    ${limb(40, 74, 37, 84)}${limb(60, 74, 63, 84)}
    ${C(50, 46, R, bodyCol, 2.8)}
    ${P(`M50 16 a30 30 0 0 1 26 15 q-12 -6 -26 -6 q-14 0 -26 6 a30 30 0 0 1 26 -15 Z`, '#fff', 0) }
    ${C(50, 40, 17, skin, 2.4)}
    ${C(44, 38, 6.5, '#fff', 2)}${C(56, 38, 6.5, '#fff', 2)}
    ${C(45, 39, 3, INK, 0)}${C(55, 39, 3, INK, 0)}
    ${C(44, 37, 1.2, '#fff', 0)}${C(54, 37, 1.2, '#fff', 0)}
    ${c.face === 'happy' ? L('M45 49 q5 5 10 0', 2.2, INK) : L('M46 49 h8', 2.2, INK)}
    ${c.beard ? P('M36 46 q0 14 14 14 q14 0 14 -14 q-5 5 -14 5 q-9 0 -14 -5 Z', c.hair, 2.2) : ''}
    ${c.mous ? P('M42 46 q8 -4 16 0 q-8 5 -16 0 Z', c.hair, 1.6) : ''}
    <g transform="translate(0,6) scale(.86) translate(8,0)">${h.f}</g>
    ${c.hairF === 'long' ? P('M26 34 q0 -20 24 -20 q24 0 24 20 l3 26 h-9 l-3 -24 q-6 -6 -15 -6 q-9 0 -15 6 l-3 24 h-9 Z', c.hair, 2.4) : ''}
  `, { k: 's', scale: .92, dy: 3 });
}

/* ---------- 3. СОЮЗМУЛЬТФИЛЬМ: мягкая неровная линия, приглушённая палитра ---------- */
const SOFT = { m: '#e8c3a4', f: '#efd2ba' };
const muted = (h) => h;
export function soyuz(c) {
  const W = BUILD[c.build] + 2, skin = SOFT[c.s], x = 50 - W / 2;
  const h = hat(c.hat, c, W), hf = c.hairF ? hairF(c.hairF, c.hair, W) : { b: '' };
  /* голова слегка «кривая» — как рисовали от руки */
  const head = `M${x + 1} 34 Q${x - 1} 21 50 20 Q${50 + W / 2 + 1} 21 ${50 + W / 2} 35 `
    + `Q${50 + W / 2 - 1} 55 50 64 Q${x + 2} 54 ${x + 1} 34 Z`;
  return frame(c, `
    ${hf.b}${h.b}
    ${top(c.top, c)}
    ${P('M44 58 h12 v11 h-12 Z', skin, 2)}
    ${P(head, skin, 2.4)}
    ${c.hat === 'space' ? '' : (c.hairF ? '' : hairM(c.hair, W))}
    ${c.beard ? beard(c.beard, c.hair, W) : ''}
    ${C(43, 45, 2.3, '#fff', 1.5)}${C(58, 45, 2.3, '#fff', 1.5)}
    ${C(43.4, 45.4, 1.3, '#4a3a2a', 0)}${C(58.4, 45.4, 1.3, '#4a3a2a', 0)}
    ${L('M37 37 q6 -3 11 -1 M54 36 q5 -2 11 1', 1.8, '#6b5a48')}
    ${L('M49 48 q3 3 0 5', 1.6, '#c49a78')}
    ${c.face === 'happy' ? L('M44 57 q6 4 12 0', 2, INK) : L('M45 57 h10', 2, INK)}
    ${c.mous ? mous(c.hair) : ''}
    ${h.f}${h.o || ''}
    ${C(36, 53, 3.4, '#e2a48c', 0)}${C(64, 53, 3.4, '#e2a48c', 0)}
  `, { k: 'z', scale: .95, dy: 2, bg: '#efe9dc' });
}
export { CAST };
