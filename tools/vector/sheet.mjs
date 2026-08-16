import { STYLES } from './styles.mjs';
import { CHARS } from './chars.mjs';
import { writeFileSync } from 'node:fs';
const PICK = ['babushka','gopnik','shaurmaster','kosmonavt','tsar','zolotoy'];
const cs = PICK.map(id => CHARS.find(c => c.id === id));
const S = 108, LBL = 150, GAP = 8;
let g = '', y = 30;
for (const [key, name, note, fn] of STYLES) {
  g += `<text x="8" y="${y + 20}" font-size="13" fill="#f2cf5c" font-family="monospace">${name}</text>`;
  g += `<text x="8" y="${y + 36}" font-size="9" fill="#a49d92" font-family="monospace">${note.slice(0, 26)}</text>`;
  cs.forEach((c, i) => {
    const x = LBL + i * (S + GAP);
    g += `<image x="${x}" y="${y}" width="${S}" height="${S}" href="data:image/svg+xml,${encodeURIComponent(fn(c))}"/>`;
    g += `<image x="${x + S - 28}" y="${y + S + 2}" width="28" height="28" href="data:image/svg+xml,${encodeURIComponent(fn(c))}"/>`;
  });
  y += S + 36;
}
cs.forEach((c, i) => { g += `<text x="${LBL + i * (S + GAP)}" y="20" font-size="11" fill="#e8e2d4" font-family="monospace">${c.name}</text>`; });
const W = LBL + cs.length * (S + GAP);
writeFileSync('sheet.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y + 10}" viewBox="0 0 ${W} ${y + 10}"><rect width="100%" height="100%" fill="#22201c"/>${g}</svg>`);
console.log('ok', y);
