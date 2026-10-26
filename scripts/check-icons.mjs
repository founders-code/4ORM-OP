import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nav = readFileSync(resolve(ROOT, 'public/shell-nav.js'), 'utf8');
const pages = readFileSync(resolve(ROOT, 'public/redesign-pages.js'), 'utf8');
const pagesB = readFileSync(resolve(ROOT, 'public/redesign-pages-b.js'), 'utf8');
const failures = [];
if (/<svg[\s>]/.test(nav)) failures.push('public/shell-nav.js still emits <svg> (one path: text labels only, live and fixture)');
if (/glyph\s*=\s*fixtureOn\(\)/.test(pagesB)) failures.push('public/redesign-pages-b.js still has a fixture-only icon branch');
if (/var (EYE|BELL) = '<svg/.test(pages)) failures.push('public/redesign-pages.js Dashboard still paints eye/bell SVGs (use Show $ / Alarm chips)');
/* Icon glyphs: <svg>, emoji / pictographs, and arrow / shape / dingbat characters, whether literal,
   HTML numeric entities (&#10022; &#x2197;) or JS escapes (↗, \ud83d). */
function iconHits(text) {
  const hits = [];
  if (/<svg[\s>]/i.test(text)) hits.push('<svg>');
  const isIcon = (cp) => (cp >= 0x2190 && cp <= 0x21ff) || (cp >= 0x2300 && cp <= 0x23ff) || (cp >= 0x25a0 && cp <= 0x27bf)
    || (cp >= 0x2900 && cp <= 0x297f) || (cp >= 0x2b00 && cp <= 0x2bff) || (cp >= 0x1f000 && cp <= 0x1faff) || (cp >= 0xd83c && cp <= 0xd83e);
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (isIcon(cp) || /\p{Extended_Pictographic}/u.test(ch) && cp > 0xff && cp !== 0x2122) { hits.push('U+' + cp.toString(16)); break; }
  }
  const ent = text.match(/&#(x[0-9a-f]+|\d+);/gi) || [];
  for (const e of ent) {
    const raw = e.slice(2, -1);
    const cp = raw[0] === 'x' || raw[0] === 'X' ? parseInt(raw.slice(1), 16) : parseInt(raw, 10);
    if (isIcon(cp)) { hits.push(e); break; }
  }
  const esc = text.match(/\\u[0-9a-fA-F]{4}/g) || [];
  for (const e of esc) {
    if (isIcon(parseInt(e.slice(2), 16))) { hits.push(e); break; }
  }
  return hits;
}
/* News lives in control-room-ops.js between the NEWS:BEGIN / NEWS:END markers (the rest of that file is legacy). */
const ops = readFileSync(resolve(ROOT, 'public/control-room-ops.js'), 'utf8');
const nb = ops.indexOf('NEWS:BEGIN');
const ne = ops.indexOf('NEWS:END');
if (nb < 0 || ne < nb) failures.push('public/control-room-ops.js lost its NEWS:BEGIN / NEWS:END markers');
else {
  const hits = iconHits(ops.slice(nb, ne));
  if (hits.length) failures.push('public/control-room-ops.js News region has icons: ' + hits.join(', '));
}
for (const name of ['redesign-pages-d.js', 'redesign-pages-people.js', 'redesign-news-saved.js', 'redesign-pages-r3.js', 'redesign-pages-r4.js', 'redesign-recordings.js']) {
  const file = resolve(ROOT, 'public', name);
  if (!existsSync(file)) continue;
  const hits = iconHits(readFileSync(file, 'utf8'));
  if (hits.length) failures.push('public/' + name + ' has icons: ' + hits.join(', '));
}
if (!/hourCycle: 'h23'/.test(nav)) failures.push('public/shell-nav.js clock is not 24-hour');
if (failures.length) {
  console.error('icon / time check FAILED');
  failures.forEach((line) => console.error('  ' + line));
  process.exit(1);
}
console.log('icon / time check PASS');
console.log('  one path: left menu is text-only live and fixture; clock is 24-hour America/Vancouver');
console.log('  no <svg>, emoji or icon glyphs in News (control-room-ops.js) or redesign-pages-d / -people / news-saved / -r3');
