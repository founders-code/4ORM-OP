import { readFileSync } from 'node:fs';
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
if (!/hourCycle: 'h23'/.test(nav)) failures.push('public/shell-nav.js clock is not 24-hour');
if (failures.length) {
  console.error('icon / time check FAILED');
  failures.forEach((line) => console.error('  ' + line));
  process.exit(1);
}
console.log('icon / time check PASS');
console.log('  one path: left menu is text-only live and fixture; clock is 24-hour America/Vancouver');
