#!/usr/bin/env node
// BACKLOG-468 item 2: typecheck gate that fails only on NEW tsc errors.
//
// `next.config.ts` sets ignoreBuildErrors, and the repo carries a handful of
// known pre-existing errors (src/db scripts), so a plain `tsc --noEmit` cannot
// be a CI gate yet. This runs tsc, normalizes every `error TS` line to
// `<file>: error <code>: <message>` (line/column dropped so unrelated edits
// that shift lines do not trip the gate), and compares it as a multiset
// against scripts/tsc-baseline.txt. Exit 1 lists only errors not in the
// baseline. Lines under `.next/` are ignored (generated types).
//
// Usage:
//   node scripts/tsc-baseline-check.mjs            run tsc and compare
//   node scripts/tsc-baseline-check.mjs --update   rewrite the baseline
//   node scripts/tsc-baseline-check.mjs --from <f> compare an existing tsc
//                                                  output file instead of
//                                                  running tsc
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(root, 'scripts', 'tsc-baseline.txt');
const args = process.argv.slice(2);
const update = args.includes('--update');
const fromIdx = args.indexOf('--from');
const fromFile = fromIdx !== -1 ? args[fromIdx + 1] : null;

const HEADER = [
    '# tsc baseline for scripts/tsc-baseline-check.mjs (BACKLOG-468 item 2).',
    '# One normalized error per line: <file>: error <code>: <message> (no line/col).',
    '# Regenerate with: node scripts/tsc-baseline-check.mjs --update',
    '# Only ever shrink this file; never add entries to hide a new error.',
];

function runTsc() {
    // `typescript` is a devDependency; invoke it through node directly so this
    // works the same on Windows and Linux (no npx/.cmd shim).
    const tscBin = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
    if (!existsSync(tscBin)) {
        console.error('tsc-baseline-check: typescript not installed (run npm ci first).');
        process.exit(2);
    }
    const res = spawnSync(process.execPath, [tscBin, '--noEmit'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
    });
    if (res.error) {
        console.error('tsc-baseline-check: failed to run tsc:', res.error.message);
        process.exit(2);
    }
    return { output: `${res.stdout ?? ''}\n${res.stderr ?? ''}`, status: res.status };
}

const ERROR_LINE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;

function normalize(output) {
    const out = [];
    for (const raw of output.split('\n')) {
        const line = raw.replace(/\r$/, '');
        const m = ERROR_LINE.exec(line);
        if (!m) continue;
        const file = m[1].replace(/\\/g, '/');
        if (file.startsWith('.next/') || file.includes('/.next/')) continue;
        out.push(`${file}: error ${m[4]}: ${m[5].trim()}`);
    }
    return out;
}

function count(lines) {
    const map = new Map();
    for (const l of lines) map.set(l, (map.get(l) ?? 0) + 1);
    return map;
}

let output;
let status = 0;
if (fromFile) {
    output = readFileSync(fromFile, 'utf8').replace(/^﻿/, '');
} else {
    ({ output, status } = runTsc());
}

const current = normalize(output);

// tsc exited non-zero but produced nothing we can parse: a crash or config
// error, not "no errors". Never let that pass silently.
if (!fromFile && status !== 0 && current.length === 0) {
    console.error('tsc-baseline-check: tsc exited non-zero with no parseable errors:');
    console.error(output.trim().slice(0, 4000));
    process.exit(2);
}

if (update) {
    const body = [...current].sort();
    writeFileSync(baselinePath, [...HEADER, ...body].join('\n') + '\n', 'utf8');
    console.log(`tsc-baseline-check: wrote ${body.length} baseline error(s) to scripts/tsc-baseline.txt`);
    process.exit(0);
}

if (!existsSync(baselinePath)) {
    console.error('tsc-baseline-check: scripts/tsc-baseline.txt is missing.');
    process.exit(2);
}

const baseline = readFileSync(baselinePath, 'utf8')
    .replace(/^﻿/, '')
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim() !== '' && !l.startsWith('#'));

const cur = count(current);
const base = count(baseline);

const added = [];
for (const [line, n] of cur) {
    const extra = n - (base.get(line) ?? 0);
    for (let i = 0; i < extra; i++) added.push(line);
}
const fixed = [];
for (const [line, n] of base) {
    const gone = n - (cur.get(line) ?? 0);
    for (let i = 0; i < gone; i++) fixed.push(line);
}

console.log(`tsc-baseline-check: ${current.length} current error(s), ${baseline.length} in baseline.`);

if (fixed.length > 0) {
    console.log(`\n${fixed.length} baseline error(s) no longer occur. Shrink the baseline with:`);
    console.log('  node scripts/tsc-baseline-check.mjs --update');
    for (const l of fixed) console.log(`  fixed: ${l}`);
}

if (added.length > 0) {
    console.error(`\nFAIL: ${added.length} new TypeScript error(s) not in the baseline:`);
    for (const l of added) console.error(`  ${l}`);
    console.error('\nFor line/column detail run: node node_modules/typescript/bin/tsc --noEmit');
    process.exit(1);
}

console.log('OK: no new TypeScript errors.');
