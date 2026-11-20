/**
 * Unit test runner for tests/unit/*.test.ts
 * ==========================================
 * Discovers every *.test.ts in tests/unit, runs each with tsx, and
 * aggregates the exit codes. Fails fast on the first broken file only if
 * you pass --bail; otherwise runs everything and reports at the end.
 *
 * Usage: npx tsx scripts/run-unit-tests.mjs [--bail]
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const unitDir = path.join(root, 'tests', 'unit');
const files = readdirSync(unitDir)
  .filter((f) => f.endsWith('.test.ts'))
  .sort();

if (files.length === 0) {
  console.error('[unit] no test files found in tests/unit');
  process.exit(1);
}

const bail = process.argv.includes('--bail');
const failures = [];
console.log(`[unit] running ${files.length} file(s):\n`);

for (const file of files) {
  const full = path.join(unitDir, file);
  process.stdout.write(`[unit] ${file} ... `);
  try {
    execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', full], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('PASS');
  } catch (err) {
    console.log('FAIL');
    const out = [err?.stdout, err?.stderr].filter(Boolean).map(String).join('\n');
    if (out) console.error(out.trim());
    failures.push(file);
    if (bail) break;
  }
}

console.log();
if (failures.length) {
  console.error(`[unit] ${failures.length} of ${files.length} file(s) failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log(`[unit] all ${files.length} file(s) passed`);
