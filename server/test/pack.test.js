import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePack, loadPack, evalCheck } from '../engine/validatePack.js';

const pack = loadPack();

test('pack: content pack validates clean', () => {
  const errors = validatePack(pack);
  assert.deepEqual(errors, [], `pack errors:\n- ${errors.join('\n- ')}`);
});

test('pack: numeric checks recompute (spot)', () => {
  assert.equal(evalCheck('20*3+0.5*(-9.8)*9').toFixed(1), '15.9');
  assert.throws(() => evalCheck('process.exit(1)'), /unsafe/);
});

test('pack: kinematics Q1-4 carry the v1 items', () => {
  const ids = new Set(pack.questions.map((q) => q.id));
  for (const id of ['kin_t01', 'kin_t02', 'kin_t03', 'kin_t04']) assert.ok(ids.has(id), `missing ${id}`);
  const t01 = pack.questions.find((q) => q.id === 'kin_t01');
  assert.equal(t01.payloads['b'].tag, 'sign_convention');
  assert.equal(t01.options.find((o) => o.id === 'd').text, '30.6 m');
});
