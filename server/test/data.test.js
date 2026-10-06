import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAll, loadData } from '../engine/validate.js';
import { loadConfig } from '../engine/config.js';

const data = loadData();

test('data-integrity: shipped data validates clean', () => {
  const errors = validateAll(data);
  assert.deepEqual(errors, [], `expected no validation errors, got:\n- ${errors.join('\n- ')}`);
});

test('data-integrity: cyclic edge is rejected', () => {
  const bad = structuredClone(data);
  bad.dag.nodes.find((n) => n.id === 'scalar_variables').prerequisites.push('implicit_boundary_conds');
  const errors = validateAll(bad);
  assert.ok(errors.some((e) => e.includes('cycle')), `expected a cycle error, got: ${errors.join(' | ')}`);
});

test('data-integrity: unknown remediation tag is rejected', () => {
  const bad = structuredClone(data);
  bad.quiz.questions[0].options[1].payload.remediation_tag = 'no_such_tag';
  const errors = validateAll(bad);
  assert.ok(errors.some((e) => e.includes('unknown remediation_tag')), `expected a tag error, got: ${errors.join(' | ')}`);
});

test('data-integrity: two correct options are rejected', () => {
  const bad = structuredClone(data);
  bad.quiz.questions[0].correct_option_id = 'opt_a';
  // duplicate the correct id onto a second option by pointing another question's
  // correct id at nothing is a different check — here force two options sharing the id:
  bad.quiz.questions[0].options[1].id = 'opt_a';
  const errors = validateAll(bad);
  assert.ok(
    errors.some((e) => e.includes('duplicate option id') || e.includes('exactly one correct option')),
    `expected an option error, got: ${errors.join(' | ')}`,
  );
});

test('config: thresholds live in config.json', () => {
  const cfg = loadConfig();
  assert.equal(cfg.escalation_threshold, 3);
  assert.equal(cfg.acceleration_score, 85);
  assert.equal(cfg.acceleration_avg_seconds, 45);
  assert.equal(cfg.numeric_tolerance, 0.05);
});
