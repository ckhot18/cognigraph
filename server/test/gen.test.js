import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateAll, mulberry32 } from '../scripts/generate-data.js';
import { loadPack } from '../engine/validatePack.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const pack = loadPack();
const qById = new Map(pack.questions.map((q) => [q.id, q]));

test('gen: exactly 30 students, 420 results, 1800 valid responses', () => {
  const { students, results, responses } = generateAll(pack);
  assert.equal(students.length, 30);
  assert.equal(responses.length, 6 * 30 * 10);
  assert.equal(results.length, 30 * 14);
  for (const r of responses) {
    const q = qById.get(r.question_id);
    assert.ok(q, `unknown question ${r.question_id}`);
    assert.ok(q.options.some((o) => o.id === r.chosen_option_id));
    assert.equal(r.is_correct, r.chosen_option_id === r.correct_option_id);
    assert.ok(r.time_sec > 0);
  }
});

test('gen: deterministic — two runs byte-identical', () => {
  const a = JSON.stringify(generateAll(pack));
  const b = JSON.stringify(generateAll(pack));
  assert.equal(a, b);
  assert.ok(mulberry32(20261006)() !== mulberry32(20261007)(), 'sanity: seeds differ');
});

test('gen: signal checks (topper/struggling/guesser/lag/sign)', () => {
  const { results, responses } = generateAll(pack);
  const mean = (id) => {
    const r = results.filter((x) => x.student_id === id);
    return (r.reduce((s, x) => s + x.score / x.max_score, 0) / r.length) * 100;
  };
  assert.ok(mean('1') >= 88, `topper1 ${mean('1')}`);
  assert.ok(mean('2') >= 88, `topper2 ${mean('2')}`);
  assert.ok(mean('3') <= 40, `strug3 ${mean('3')}`);
  assert.ok(mean('4') <= 40, `strug4 ${mean('4')}`);
  const tagCount = (id, t) => responses.filter((x) => x.student_id === id && !x.is_correct && qById.get(x.question_id).payloads[x.chosen_option_id].tag === t).length;
  for (const id of ['5', '6', '7', '8']) assert.ok(tagCount(id, 'sign_convention') >= 4, `sign ${id}`);
  for (const id of ['29', '30']) {
    const pr = responses.filter((x) => x.student_id === id);
    const acc = pr.filter((x) => x.is_correct).length / pr.length;
    const ratios = pr.map((x) => x.time_sec / qById.get(x.question_id).expected_time_sec).sort((x, y) => x - y);
    assert.ok(acc < 0.45, `guesser ${id} acc ${acc}`);
    assert.ok(ratios[Math.floor(ratios.length / 2)] < 0.4, `guesser ${id} slow`);
  }
  for (const [ids, testId] of [[['16', '17', '18'], 'elec_test'], [['19', '20', '21'], 'thm_test'], [['22', '23', '24'], 'opt_test']]) {
    for (const id of ids) {
      const t = results.find((x) => x.student_id === id && x.test_id === testId);
      const o = results.filter((x) => x.student_id === id && x.test_id.endsWith('_test') && x.test_id !== testId);
      const others = (o.reduce((s, x) => s + x.score, 0) / o.length) * 10;
      assert.ok(t.score * 10 <= 55, `${id} lag topic ${t.score * 10}`);
      assert.ok(others >= 70, `${id} others ${others}`);
    }
  }
});

test('gen: committed files match a fresh run', () => {
  const fresh = generateAll(pack);
  assert.deepEqual(read('students.json').students, fresh.students);
  assert.deepEqual(read('results.json').results, fresh.results);
  assert.deepEqual(read('responses.json').responses, fresh.responses);
});
