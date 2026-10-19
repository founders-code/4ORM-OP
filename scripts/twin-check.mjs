#!/usr/bin/env node
/**
 * twin-check: catch imports that typecheck but are undefined at runtime.
 *
 * When lib/x.ts and lib/x.mjs both exist, TypeScript resolves an extensionless
 * `from '@/lib/x'` to the .ts file, and the Next/webpack bundler resolves it to
 * the .mjs file. Every symbol that lives only in the .ts is then `undefined` in
 * production, and `tsc --noEmit` is clean. This script closes that gap.
 *
 * Exit 1 on any mismatch. Wire into `npm run check`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, extname, dirname, resolve, relative } from 'node:path';

const ROOT = process.argv[2] || process.cwd();
const LIB = 'lib';
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'design-reference', 'visual-diff', 'public']);
const CODE = new Set(['.ts', '.tsx', '.mjs', '.js', '.jsx']);

/** Bundler resolution order: the first extension that exists wins. */
const BUNDLER_ORDER = ['.mjs', '.js', '.jsx', '.tsx', '.ts'];

function listLib() {
  const seen = {};
  for (const name of readdirSync(join(ROOT, LIB))) {
    const ext = extname(name);
    if (!CODE.has(ext)) continue;
    const base = name.slice(0, -ext.length);
    (seen[base] = seen[base] || []).push(ext);
  }
  return seen;
}

function exportsOf(file) {
  let text;
  try { text = readFileSync(join(ROOT, file), 'utf8'); } catch { return null; }
  const out = new Set();
  for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) out.add(m[1]);
  for (const m of text.matchAll(/export\s+(?:type|interface|enum)\s+([A-Za-z0-9_$]+)/g)) out.add(m[1]);
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.split(/\s+as\s+/).pop().trim();
      if (name) out.add(name);
    }
  }
  if (/export\s+\*/.test(text)) out.add('*');
  return out;
}

function walk(dir, acc = []) {
  for (const e of readdirSync(join(ROOT, dir || '.'), { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
    const p = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) walk(p, acc);
    else if (CODE.has(extname(e.name))) acc.push(p);
  }
  return acc;
}

const lib = listLib();
const twins = Object.entries(lib).filter(([, exts]) => exts.length > 1).map(([b]) => b);

if (!twins.length) {
  console.log('twin-check: no duplicate module basenames in lib/. Nothing to check.');
  process.exit(0);
}

console.log(`twin-check: duplicate basenames in ${LIB}/ -> ${twins.map((t) => `${t}{${lib[t].join(',')}}`).join(' ')}`);

const exportCache = new Map();
const getExports = (file) => {
  if (!exportCache.has(file)) exportCache.set(file, exportsOf(file));
  return exportCache.get(file);
};

/** Which file does the bundler actually load for an extensionless specifier? */
function bundlerPick(base) {
  for (const ext of BUNDLER_ORDER) if (lib[base]?.includes(ext)) return `${LIB}/${base}${ext}`;
  return null;
}

const IMPORT_RE = /import\s+(?:type\s+)?\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
const findings = [];

for (const file of walk('')) {
  const text = readFileSync(join(ROOT, file), 'utf8');
  for (const m of text.matchAll(IMPORT_RE)) {
    const [, rawNames, spec] = m;

    let base = null, explicit = null;
    const alias = /^@\/lib\/([A-Za-z0-9_-]+)(\.[a-z]+)?$/.exec(spec);
    if (alias) { base = alias[1]; explicit = alias[2] || null; }
    else if (/^\.{1,2}\//.test(spec)) {
      const abs = resolve(dirname(join(ROOT, file)), spec);
      const rel = relative(join(ROOT, LIB), abs);
      if (!rel.startsWith('..') && !rel.includes('/')) {
        const ext = extname(rel);
        base = ext ? rel.slice(0, -ext.length) : rel;
        explicit = ext || null;
      }
    }
    if (!base || !twins.includes(base)) continue;

    const target = explicit ? `${LIB}/${base}${explicit}` : bundlerPick(base);
    const pool = getExports(target);
    if (!pool || pool.has('*')) continue;

    const names = rawNames.split(',').map((s) => s.split(/\s+as\s+/)[0].trim()).filter(Boolean);
    const missing = names.filter((n) => !pool.has(n));
    if (missing.length) {
      findings.push({ file, spec, target, explicit: !!explicit, missing });
    }
  }
}

if (!findings.length) {
  console.log('twin-check: clean. Every import resolves to a module that exports it.');
  process.exit(0);
}

console.error(`\ntwin-check: ${findings.length} import(s) will be undefined at runtime.\n`);
for (const f of findings) {
  console.error(`  ${f.file}`);
  console.error(`    from '${f.spec}'${f.explicit ? '' : '  (extensionless)'}  ->  bundler loads ${f.target}`);
  console.error(`    undefined at runtime: ${f.missing.join(', ')}\n`);
}
console.error('Fix: give the two modules different basenames, or import the explicit extension');
console.error('that actually exports the symbol. tsc cannot catch this.\n');
process.exit(1);
