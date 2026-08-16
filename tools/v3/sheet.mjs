import { RENDERERS, CAST } from './five.mjs';
import { writeFileSync } from 'node:fs';
const S = 74, GAP = 5, LBL = 128;
let g = '', y = 26;
for (const [key, name, note, fn, ar] of RENDERERS) {
  const H = Math.round(S * ar);
  g += `<text x="6" y="${y + 16}" font-size="12" fill="#f2cf5c" font-family="monospace">${name}</text>`;
  g += `<text x="6" y="${y + 30}" font-size="8.5" fill="#a49d92" font-family="monospace">${note.slice(0, 24)}</text>`;
  CAST.forEach((c, i) => {
    const x = LBL + i * (S + GAP);
    g += `<image x="${x}" y="${y}" width="${S}" height="${H}" href="data:image/svg+xml,${encodeURIComponent(fn(c))}"/>`;
  });
  y += H + 20;
}
CAST.forEach((c, i) => { g += `<text x="${LBL + i * (S + GAP) + S / 2}" y="18" font-size="7.5" fill="#e8e2d4" font-family="monospace" text-anchor="middle" transform="rotate(-18 ${LBL + i * (S + GAP) + S / 2} 18)">${c.n}</text>`; });
const W = LBL + CAST.length * (S + GAP) + 10;
writeFileSync('sheet.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y + 10}" viewBox="0 0 ${W} ${y + 10}"><rect width="100%" height="100%" fill="#22201c"/>${g}</svg>`);
console.log('ok', W, y);
