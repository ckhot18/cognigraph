import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Copy lint (V2 §9.3 + §10.8): student-facing text follows Bridge language rules.
// Scans client/src/student/** for banned whole-words (code identifier `error_mix`
// is allowlisted — it is never rendered; KIND_LABEL maps render friendly text).
// Also forbids harsh-red Tailwind classes on the student side.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', '..', 'client', 'src', 'student');
const BANNED = ['wrong', 'incorrect', 'fail', 'mistake', 'poor', 'weak', 'error'];
const BANNED_EXACT = ['bad']; // standalone only: "Badge" (component) must not match
const ALLOW_IN = ['error_mix', 'wrong_to_right', 'right_to_wrong'];

function files(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) out.push(...files(fp));
    else if (f.endsWith('.jsx') || f.endsWith('.js')) out.push(fp);
  }
  return out;
}

function stripCode(src) {
  return src
    .split('\n')
    .filter((l) => !l.trim().startsWith('import ') && !l.trim().startsWith('export '))
    .join('\n')
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

test('copy: student components avoid banned words', () => {
  const hits = [];
  for (const fp of files(DIR)) {
    const src = stripCode(fs.readFileSync(fp, 'utf8'));
    const rel = path.relative(DIR, fp);
    for (const w of [...BANNED, ...BANNED_EXACT]) {
      const suffix = BANNED_EXACT.includes(w) ? '' : '\\w*';
      const re = new RegExp(`\\b${w}${suffix}\\b`, 'gi');
      let m;
      while ((m = re.exec(src)) !== null) {
        const line = src.slice(0, m.index).split('\n').pop() + m[0];
        if (ALLOW_IN.some((a) => line.includes(a))) continue;
        hits.push(`${rel}: ${m[0]}`);
      }
    }
  }
  assert.deepEqual(hits, [], `banned words in student UI: ${hits.slice(0, 10).join(', ')}`);
});

test('copy: no harsh red on the student side', () => {
  const hits = [];
  for (const fp of files(DIR)) {
    const src = fs.readFileSync(fp, 'utf8');
    if (/\bred-\w*/.test(src)) hits.push(path.relative(DIR, fp));
  }
  assert.deepEqual(hits, [], `red classes in student UI: ${hits.join(', ')}`);
});
