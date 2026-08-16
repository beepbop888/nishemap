/* Общая геометрия. Холст 100×100, голова — крупная и по центру.
   Все якоря заданы числами, поэтому реквизит физически не может «съехать». */
export const A = {
  cx: 50,            // центр по горизонтали
  headTop: 20, headBot: 66, headW: 46,   // голова
  browY: 40,         // линия бровей — ниже неё шапка не опускается
  eyeY: 44, eyeDx: 9,
  mouthY: 56,
  shoulderY: 74,
};
const r = (n) => Math.round(n * 100) / 100;

/** Голова: скруглённый прямоугольник — читается лучше круга и не «шарик». */
export function headPath() {
  const { cx, headTop: t, headBot: b, headW: w } = A;
  const x = cx - w / 2, rad = 13;
  return `M${x} ${t + rad} Q${x} ${t} ${x + rad} ${t} L${x + w - rad} ${t} Q${x + w} ${t} ${x + w} ${t + rad} `
       + `L${x + w} ${b - 18} Q${x + w} ${b} ${cx + 12} ${b} L${cx - 12} ${b} Q${x} ${b} ${x} ${b - 18} Z`;
}
export function shouldersPath() {
  const { cx, shoulderY: y } = A;
  return `M8 100 C10 ${y + 10} 26 ${y} ${cx} ${y} C${cx + 24} ${y} 90 ${y + 10} 92 100 Z`;
}
export function neckPath() {
  return `M${A.cx - 9} ${A.headBot - 3} L${A.cx + 9} ${A.headBot - 3} L${A.cx + 9} ${A.shoulderY + 2} L${A.cx - 9} ${A.shoulderY + 2} Z`;
}

/* ---- головные уборы. Все заканчиваются НЕ ниже browY-3, глаза всегда открыты ---- */
const HW = A.headW, HX = A.cx - HW / 2, TOP = A.headTop, BAND = A.browY - 5;
export const HATS = {
  ushanka: (c) => ({
    back: `<path d="M${HX - 5} ${BAND - 3} q-7 4 -7 13 q0 9 7 11 q6 2 7 -5 l0 -19 Z" fill="${c.dark}"/>`
        + `<path d="M${HX + HW + 5} ${BAND - 3} q7 4 7 13 q0 9 -7 11 q-6 2 -7 -5 l0 -19 Z" fill="${c.dark}"/>`,
    front: `<path d="M${HX - 3} ${BAND} q0 -22 ${HW / 2 + 3} -22 q${HW / 2 + 3} 0 ${HW / 2 + 3} 22 Z" fill="${c.main}"/>`
         + `<rect x="${HX - 6}" y="${BAND - 6}" width="${HW + 12}" height="9" rx="4.5" fill="${c.light}"/>`,
  }),
  ushanka_gold: (c) => HATS.ushanka(c),
  platok: (c) => ({
    back: `<path d="M${HX - 4} ${BAND + 2} q-6 12 -3 24 q3 10 10 6 l2 -28 Z" fill="${c.main}"/>`,
    front: `<path d="M${HX - 3} ${BAND + 4} q0 -26 ${HW / 2 + 3} -26 q${HW / 2 + 3} 0 ${HW / 2 + 3} 26 `
         + `q-${HW / 2} -10 -${HW / 2 + 3} -10 q-4 0 -${HW / 2 + 3} 10 Z" fill="${c.main}"/>`
         + `<path d="M${A.cx - 7} ${A.headBot - 2} q7 9 14 0 q-3 12 -7 14 q-4 -2 -7 -14 Z" fill="${c.main}"/>`,
  }),
  cap: (c) => ({ back: '',
    front: `<path d="M${HX - 2} ${BAND} q0 -20 ${HW / 2 + 2} -20 q${HW / 2 + 2} 0 ${HW / 2 + 2} 20 Z" fill="${c.main}"/>`
         + `<rect x="${HX - 8}" y="${BAND - 4}" width="${HW + 16}" height="6" rx="3" fill="${c.dark}"/>` }),
  kepka: (c) => ({ back: '',
    front: `<path d="M${HX - 2} ${BAND - 1} q0 -15 ${HW / 2 + 2} -15 q${HW / 2 + 2} 0 ${HW / 2 + 2} 15 Z" fill="${c.main}"/>`
         + `<path d="M${HX - 12} ${BAND - 2} L${HX + HW + 12} ${BAND - 2} q3 0 3 3 q0 4 -6 4 L${HX - 9} ${BAND + 5} q-6 0 -6 -4 q0 -3 3 -3 Z" fill="${c.dark}"/>` }),
  helmet: (c) => ({ back: '',
    front: `<path d="M${HX - 3} ${BAND} q0 -23 ${HW / 2 + 3} -23 q${HW / 2 + 3} 0 ${HW / 2 + 3} 23 Z" fill="${c.main}"/>`
         + `<rect x="${HX - 5}" y="${BAND - 5}" width="${HW + 10}" height="7" rx="3" fill="${c.dark}"/>`,
    over: `<path d="M${HX + 1} ${A.eyeY + 6} h${HW - 2} M${HX + 3} ${A.mouthY + 3} h${HW - 6}" stroke="${c.dark}" stroke-width="1.6" fill="none"/>` }),
  helmet2: (c) => ({
    back: `<circle cx="${A.cx}" cy="${(TOP + A.headBot) / 2}" r="31" fill="${c.light}"/>`,
    front: `<path d="M${A.cx - 30} ${BAND + 1} a30 30 0 0 1 60 0 q-14 -9 -30 -9 q-16 0 -30 9 Z" fill="${c.main}"/>` }),
  crown: (c) => ({ back: '',
    front: `<path d="M${HX - 2} ${BAND} L${HX - 2} ${BAND - 17} l9 8 l10 -14 l10 12 l10 -12 l10 14 l9 -8 L${HX + HW + 2} ${BAND} Z" fill="${c.main}"/>`
         + `<rect x="${HX - 6}" y="${BAND - 2}" width="${HW + 12}" height="8" rx="4" fill="${c.light}"/>`
         + `<circle cx="${A.cx}" cy="${BAND - 13}" r="3.2" fill="${c.dark}"/>` }),
  tophat: (c) => ({ back: '',
    front: `<rect x="${A.cx - 15}" y="${BAND - 30}" width="30" height="30" fill="${c.main}"/>`
         + `<rect x="${A.cx - 15}" y="${BAND - 13}" width="30" height="5" fill="${c.dark}"/>`
         + `<rect x="${HX - 10}" y="${BAND - 3}" width="${HW + 20}" height="6" rx="3" fill="${c.main}"/>` }),
};
export const HATCOL = {
  ushanka:      { main:'#6b4a30', dark:'#4a3423', light:'#8d6644' },
  ushanka_gold: { main:'#d9a326', dark:'#a97c16', light:'#f0d98a' },
  platok:       { main:'#b8465c', dark:'#8e3346', light:'#e8a4b4' },
  cap:          { main:'#2f6b4f', dark:'#1f4a36', light:'#4f8f6f' },
  kepka:        { main:'#26262a', dark:'#141417', light:'#3a3a40' },
  helmet:       { main:'#c8322a', dark:'#8e1f19', light:'#e05a4a' },
  helmet2:      { main:'#d9a326', dark:'#a97c16', light:'#f2f1ee' },
  crown:        { main:'#e8b93c', dark:'#c8322a', light:'#f6f4ef' },
  tophat:       { main:'#26262a', dark:'#8a1f2e', light:'#3a3a40' },
};

/* ---- предметы: рисуются слева внизу, вне лица ---- */
export const PROPS = {
  stakan:  (a) => `<path d="M12 78 h13 l-2 18 q-4 2 -9 0 Z" fill="#e8e2d4"/><rect x="11" y="74" width="15" height="5" rx="2" fill="${a}"/>`,
  avoska:  (a) => `<path d="M9 80 q0 -3 4 -3 h13 q4 0 4 3 q-2 17 -10 17 q-9 0 -11 -17 Z" fill="#ded8c8"/>`
                + `<circle cx="15" cy="85" r="3.4" fill="#c8492f"/><circle cx="23" cy="87" r="3.4" fill="#5f8f3a"/><circle cx="19" cy="92" r="3.4" fill="${a}"/>`,
  box:     (a) => `<rect x="8" y="74" width="20" height="22" rx="2" fill="#1f4a5c"/><rect x="14" y="79" width="8" height="6" fill="${a}"/>`,
  doshik:  (a) => `<path d="M10 80 h20 l-3 16 q-7 2 -14 0 Z" fill="#eceadf"/><rect x="8" y="75" width="24" height="6" rx="3" fill="${a}"/>`
                + `<path d="M31 74 l6 -8 M34 78 l6 -8" stroke="#c9a06a" stroke-width="2" stroke-linecap="round"/>`,
  shaurma: (a) => `<path d="M14 74 q6 -3 12 0 l-3 22 q-3 2 -6 0 Z" fill="#ecdfc2"/><path d="M14 74 q6 -4 12 0 q-6 3 -12 0 Z" fill="#8fae6a"/>`
                + `<path d="M16 82 h8 M16 89 h8" stroke="${a}" stroke-width="1.6"/>`,
  semki:   (a) => [[14,78],[22,84],[13,90],[23,94]].map(([x,y]) =>
                  `<ellipse cx="${x}" cy="${y}" rx="3" ry="4.6" fill="#4a3b2c" transform="rotate(${x % 2 ? 20 : -20} ${x} ${y})"/>`).join(''),
  metla:   (a) => `<path d="M30 70 L18 92" stroke="#b98a4e" stroke-width="3" stroke-linecap="round"/>`
                + `<path d="M20 90 q-8 4 -8 10 h16 q1 -7 -8 -10 Z" fill="#c9a24a"/>`,
  klyushka:(a) => `<path d="M32 70 L20 92" stroke="#c39a5e" stroke-width="3" stroke-linecap="round"/>`
                + `<path d="M20 92 l-9 5 l3 5 l9 -5 Z" fill="#2b2b2b"/>`,
  zvezda:  (a) => { let d=''; for(let i=0;i<10;i++){const an=-Math.PI/2+i*Math.PI/5,rr=i%2?4:10;
                    d+=(i?'L':'M')+(20+Math.cos(an)*rr).toFixed(1)+' '+(86+Math.sin(an)*rr).toFixed(1);}
                    return `<path d="${d}Z" fill="${a}"/>`; },
  skipetr: (a) => `<path d="M20 96 L20 74" stroke="${a}" stroke-width="3.4" stroke-linecap="round"/><circle cx="20" cy="71" r="5" fill="${a}"/>`,
  ruble:   (a) => `<path d="M13 76 h9 a7 7 0 0 1 0 14 h-4 v3 h7 v3.4 h-7 v4 h-5 v-4 h-4 v-3.4 h4 v-3 h-4 v-4 h4 Z M18 86 h4 a3.4 3.4 0 0 0 0 -7 h-4 Z" fill="${a}"/>`,
};

/* ---- глаза и рот: пары точек и одна дуга, ничего лишнего ---- */
export function face(kind, ink) {
  const { cx, eyeY: y, eyeDx: dx, mouthY: my } = A;
  const dot = (x, ry = 2.4) => `<ellipse cx="${x}" cy="${y}" rx="2.1" ry="${ry}" fill="${ink}"/>`;
  const two = (ry) => dot(cx - dx, ry) + dot(cx + dx, ry);
  const brow = (d) => `<path d="M${cx - dx - 4} ${y - 7 + d} q4 -2.5 8 0 M${cx + dx - 4} ${y - 7 - d} q4 -2.5 8 0" stroke="${ink}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`;
  const M = {
    tired:  two(1.4) + brow(1.5) + `<path d="M${cx - 5} ${my} h10" stroke="${ink}" stroke-width="1.9" stroke-linecap="round"/>`,
    old:    two(1.6) + `<path d="M${cx - 5} ${my} q5 3 10 0" stroke="${ink}" stroke-width="1.9" fill="none" stroke-linecap="round"/>`
            + `<path d="M${cx - 17} ${y + 5} q3 2 5 0 M${cx + 12} ${y + 5} q3 2 5 0" stroke="${ink}" stroke-width="1.3" fill="none"/>`,
    happy:  `<path d="M${cx - dx - 4} ${y + 1} q4 -5 8 0 M${cx + dx - 4} ${y + 1} q4 -5 8 0" stroke="${ink}" stroke-width="2.1" fill="none" stroke-linecap="round"/>`
            + `<path d="M${cx - 6} ${my - 1} q6 6 12 0" stroke="${ink}" stroke-width="2.1" fill="none" stroke-linecap="round"/>`,
    sly:    two(1.3) + brow(-2) + `<path d="M${cx - 6} ${my} q6 3 11 -2" stroke="${ink}" stroke-width="1.9" fill="none" stroke-linecap="round"/>`,
    driven: two(2.6) + brow(-2.5) + `<path d="M${cx - 5} ${my} h10" stroke="${ink}" stroke-width="2.1" stroke-linecap="round"/>`,
    proud:  two(2.2) + brow(-1) + `<path d="M${cx - 6} ${my} q6 2 12 0" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    calm:   two(2.2) + `<path d="M${cx - 5} ${my} q5 2 10 0" stroke="${ink}" stroke-width="1.9" fill="none" stroke-linecap="round"/>`,
    awe:    `<circle cx="${cx - dx}" cy="${y}" r="3.4" fill="none" stroke="${ink}" stroke-width="1.7"/>`
            + `<circle cx="${cx + dx}" cy="${y}" r="3.4" fill="none" stroke="${ink}" stroke-width="1.7"/>`
            + `<circle cx="${cx - dx}" cy="${y}" r="1.5" fill="${ink}"/><circle cx="${cx + dx}" cy="${y}" r="1.5" fill="${ink}"/>`
            + `<ellipse cx="${cx}" cy="${my + 1}" rx="3.4" ry="4" fill="${ink}"/>`,
  };
  return M[kind] || M.calm;
}
export function beardPath(kind) {
  const { cx, headBot: b, headW: w, mouthY: my } = A;
  if (kind === 'mous') return `<path d="M${cx - 9} ${my - 4} q9 -4 18 0 q-9 5 -18 0 Z"/>`;
  if (kind === 'full') return `<path d="M${cx - w / 2} ${my - 8} q0 ${b - my + 12} ${w / 2} ${b - my + 12} `
    + `q${w / 2} 0 ${w / 2} -${b - my + 12} q-6 12 -${w / 2} 12 q-${w / 2 - 6} 0 -${w / 2} -12 Z"/>`;
  return '';
}
export function hairPath() {
  const { headTop: t, headW: w, cx, browY } = A;
  const x = cx - w / 2;
  return `M${x} ${browY - 6} q0 -${browY - t + 4} ${w / 2} -${browY - t + 4} q${w / 2} 0 ${w / 2} ${browY - t + 4} `
       + `q-8 -9 -${w / 2} -9 q-${w / 2 - 8} 0 -${w / 2} 9 Z`;
}
