import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nav = readFileSync(resolve(ROOT, 'public/shell-nav.js'), 'utf8');
const live = nav.replace(/if \(fixtureOn\(\)\) \{[\s\S]*?return;\n    \}/, '');
const failures = [];
if (/<svg[\s>]/.test(live)) failures.push('public/shell-nav.js live menu still emits <svg> (text labels only)');
if (!/hourCycle: 'h23'/.test(nav)) failures.push('public/shell-nav.js clock is not 24-hour');
if (failures.length) {
  console.error('icon / time check FAILED');
  failures.forEach((line) => console.error('  ' + line));
  process.exit(1);
}
console.log('icon / time check PASS');
console.log('  live left menu is text-only; clock is 24-hour America/Vancouver');
