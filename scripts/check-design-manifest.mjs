import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REDESIGN = join(ROOT, 'design-reference', 'redesign');
const ASSETS = join(ROOT, 'design-reference', 'assets');
const MANIFEST = join(REDESIGN, 'MANIFEST.json');
const LOGOS = ['logo-finance-dark.png', 'logo-finance.png', 'mark-4orm-iq.png'];

function sha16(buf) {
  return createHash('sha256').update(buf).digest('hex').slice(0, 16);
}

const entries = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const byFile = new Map(entries.map((item) => [item.file.replace(/^redesign\//, ''), item]));
const htmlOnDisk = readdirSync(REDESIGN).filter((name) => name.endsWith('.html')).sort();
const failures = [];

for (const name of htmlOnDisk) {
  const item = byFile.get(name);
  if (!item) {
    failures.push(`${name} is on disk but missing from MANIFEST.json`);
    continue;
  }
  const buf = readFileSync(join(REDESIGN, name));
  const bytes = buf.length;
  const hash = sha16(buf);
  if (bytes !== item.bytes || hash !== item.sha256) {
    failures.push(`${name} changed without a MANIFEST update (got ${bytes} ${hash}, manifest ${item.bytes} ${item.sha256})`);
  }
}

for (const item of entries) {
  const name = item.file.replace(/^redesign\//, '');
  const bufPath = join(REDESIGN, name);
  let buf;
  try {
    buf = readFileSync(bufPath);
  } catch {
    failures.push(`${item.file} is in MANIFEST.json but missing on disk`);
    continue;
  }
  if (name.endsWith('.html')) continue;
  const bytes = buf.length;
  const hash = sha16(buf);
  if (bytes !== item.bytes || hash !== item.sha256) {
    failures.push(`${name} changed without a MANIFEST update (got ${bytes} ${hash}, manifest ${item.bytes} ${item.sha256})`);
  }
}

for (const name of LOGOS) {
  try {
    readFileSync(join(ASSETS, name));
  } catch {
    failures.push('assets/' + name + ' is missing');
  }
}

if (failures.length) {
  console.error('design-reference MANIFEST check FAILED');
  failures.forEach((line) => console.error('  ' + line));
  process.exit(1);
}

console.log('design-reference MANIFEST check PASS');
console.log('  ' + htmlOnDisk.length + ' html files match bytes + sha256');
console.log('  ' + LOGOS.length + ' logos present');
