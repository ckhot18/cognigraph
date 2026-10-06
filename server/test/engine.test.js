import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../engine/validate.js';
import { loadConfig } from '../engine/config.js';
import { analyzeSubmission } from '../engine/analyze.js';
import { evaluateBridge } from '../engine/bridge.js';
import { computeCohort } from '../engine/cohort.js';
import { buildGraph, descendants, lowestUnmasteredAncestor } from '../engine/dag.js';

const data = loadData();
const cfg = loadConfig();

function preset(id) {
  return data.presets.presets.find((p) => p.preset_id === id);
}

function profileOf(p) {
  return {
    student_id: p.student.student_id,
    name: p.student.name,
    overall_mastery: p.overall_mastery,
    node_mastery: { ...p.node_mastery },
    prior_failures: { ...(p.prior_failures ?? {}) },
  };
}

function run(p, commit = false) {
  return analyzeSubmission(
    { profile: profileOf(p), submission: p.submission, commit },
    { dag: data.dag, quiz: data.quiz, drills: data.drills },
    cfg,
  );
}

// 1. Case 1: systemic, 3/3, redirect, blocked root, locked descendants, exact strings.
test('engine: case 1 systemic redirect with evidence', () => {
  const r = run(preset('case1'));
  const gap = r.detected_gaps[0];
  assert.equal(gap.severity, 'SYSTEMIC_MISCONCEPTION');
  assert.equal(gap.failure_count, 3);
  assert.equal(r.roadmap_action, 'PREREQUISITE_REDIRECT');
  assert.equal(r.root_prerequisite_blocked, 'coord_sign_conventions');
  assert.equal(r.node_states['coord_sign_conventions'].state, 'BLOCKED_NEED_ROOT');
  for (const d of ['constant_accel_eqs', 'implicit_boundary_conds', 'vector_decomposition_2d', 'variable_accel_calculus']) {
    assert.equal(r.node_states[d].state, 'LOCKED', `expected ${d} LOCKED`);
  }
  assert.equal(
    gap.evidence_interpretation,
    'Assigned positive acceleration (+9.8) to gravity while defining upward displacement as positive (+20).',
  );
  assert.equal(r.recommended_drill.drill_id, 'drill_sign_01');
  assert.equal(r.badge, 'CRITICAL_GAP');
  assert.equal(r.overall_mastery, 62);
  assert.equal(r.session_score, 0);
});

// 2. Case 2: partial, 2/3, targeted drill, const IN_PROGRESS + warning.
test('engine: case 2 partial mental model with drill', () => {
  const r = run(preset('case2'));
  const gap = r.detected_gaps[0];
  assert.equal(gap.severity, 'PARTIAL_MENTAL_MODEL');
  assert.equal(gap.failure_count, 2);
  assert.equal(r.roadmap_action, 'TARGETED_DRILL');
  assert.equal(r.node_states['constant_accel_eqs'].state, 'IN_PROGRESS');
  assert.equal(r.node_states['constant_accel_eqs'].warning, true);
  assert.equal(
    gap.evidence_interpretation,
    'Applied 1D Constant Acceleration equation (v = u + at) to a Variable Acceleration polynomial system x(t) = 3t³.',
  );
});

// 3. Case 3: partial, 1/3, hint only, hint mentions "dropped".
test('engine: case 3 hint only, no false alarm', () => {
  const r = run(preset('case3'));
  const gap = r.detected_gaps[0];
  assert.equal(gap.severity, 'PARTIAL_MENTAL_MODEL');
  assert.equal(gap.failure_count, 1);
  assert.equal(r.roadmap_action, 'HINT_ONLY');
  assert.ok(r.hint && r.hint.includes('dropped'), `expected hint to mention dropped, got: ${r.hint}`);
  assert.equal(r.node_states['implicit_boundary_conds'].state, 'IN_PROGRESS');
  assert.equal(r.node_states['implicit_boundary_conds'].warning, true);
  assert.equal(
    gap.evidence_interpretation,
    "Failed to infer that the phrase 'dropped from rest' explicitly defines initial velocity u = 0 m/s.",
  );
});

// 4. Case 4: acceleration unlocked, 3 modules, gold nodes.
test('engine: case 4 high-performer acceleration', () => {
  const r = run(preset('case4'));
  assert.equal(r.roadmap_action, 'UNLOCK_ACCELERATION');
  assert.equal(r.badge, 'ACCELERATED');
  assert.equal(r.session_score, 100);
  assert.equal(r.acceleration.modules.length, 3);
  const gold = Object.values(r.node_states).filter((n) => n.state === 'ACCELERATED');
  assert.ok(gold.length >= 1, 'expected at least one gold node');
  assert.equal(r.node_states['variable_accel_calculus'].state, 'IN_PROGRESS');
});

// 5. Edge: arithmetic slips never escalate.
test('engine: arithmetic_execution caps at SLIP/HINT_ONLY', () => {
  const p = preset('case4');
  const profile = profileOf(p);
  profile.prior_failures = { arithmetic_execution: 4 };
  const r = analyzeSubmission(
    { profile, submission: { mode: 'mcq', question_id: 'kin_q_104', selected_option_id: 'opt_d' }, commit: false },
    { dag: data.dag, quiz: data.quiz, drills: data.drills },
    cfg,
  );
  assert.equal(r.detected_gaps[0].severity, 'SLIP');
  assert.equal(r.detected_gaps[0].failure_count, 5);
  assert.equal(r.roadmap_action, 'HINT_ONLY');
});

// 6. Edge: SYSTEMIC payload at count 1 → suspected, not confirmed.
test('engine: systemic payload at count 1 sets suspected_systemic', () => {
  const p = preset('case3');
  const profile = profileOf(p);
  const r = analyzeSubmission(
    { profile, submission: { mode: 'mcq', question_id: 'kin_q_101', selected_option_id: 'opt_b' }, commit: false },
    { dag: data.dag, quiz: data.quiz, drills: data.drills },
    cfg,
  );
  assert.equal(r.detected_gaps[0].suspected_systemic, true);
  assert.notEqual(r.detected_gaps[0].severity, 'SYSTEMIC_MISCONCEPTION');
  assert.equal(r.roadmap_action, 'HINT_ONLY');
});

// 7. Edge: unmatched free text → UNCLASSIFIED, no throw, fallback drill.
test('engine: unmatched free text degrades gracefully', () => {
  const p = preset('case2');
  const profile = profileOf(p);
  const r = analyzeSubmission(
    { profile, submission: { mode: 'free_text', question_id: 'kin_q_102', working_text: 'the sky is blue and pancakes are tasty' }, commit: false },
    { dag: data.dag, quiz: data.quiz, drills: data.drills },
    cfg,
  );
  assert.equal(r.match_status, 'UNCLASSIFIED');
  assert.equal(r.roadmap_action, 'TARGETED_DRILL');
  assert.ok(r.recommended_drill && r.recommended_drill.drill_id, 'expected a fallback drill');
  assert.ok(!('correct_option_id' in (r.recommended_drill ?? {})), 'drill must not leak answers');
});

// 8. Determinism: every case twice → deep-equal.
test('engine: deterministic outputs (commit:false)', () => {
  for (const id of ['case1', 'case2', 'case3', 'case4']) {
    const a = run(preset(id));
    const b = run(preset(id));
    assert.deepEqual(a, b, `expected deterministic output for ${id}`);
  }
});

// 9. Bridge: correct restores, wrong leaves unchanged.
test('engine: bridge correct restores blocked node', () => {
  const r = run(preset('case1'));
  const snapshot = {
    failures: r.next_failures,
    node_mastery: profileOf(preset('case1')).node_mastery,
    blocked_root: r.root_prerequisite_blocked,
    bridge_attempts: {},
  };
  const { state, result } = evaluateBridge(snapshot, 'drill_sign_01', 'b', { dag: data.dag, drills: data.drills });
  assert.equal(result.correct, true);
  assert.equal(result.roadmap_action, 'CONTINUE');
  assert.equal(result.celebration, true);
  assert.equal(result.node_states['coord_sign_conventions'].state, 'MASTERED');
  assert.equal(state.failures['sign_convention_gravity'], 0);
  assert.equal(state.blocked_root, null);
});

test('engine: bridge wrong keeps nodes unchanged', () => {
  const r = run(preset('case1'));
  const snapshot = {
    failures: r.next_failures,
    node_mastery: profileOf(preset('case1')).node_mastery,
    blocked_root: r.root_prerequisite_blocked,
    bridge_attempts: {},
  };
  const before = JSON.stringify(snapshot.node_mastery);
  const { state, result } = evaluateBridge(snapshot, 'drill_sign_01', 'a', { dag: data.dag, drills: data.drills });
  assert.equal(result.correct, false);
  assert.ok(result.feedback, 'expected per-option feedback');
  assert.equal(JSON.stringify(state.node_mastery), before);
  assert.equal(state.blocked_root, 'coord_sign_conventions');
});

// 10. DAG: lowest unmastered ancestor.
test('engine: lowestUnmasteredAncestor walks past mastered roots', () => {
  const graph = buildGraph(data.dag);
  const mastery = {
    scalar_variables: 0.95,
    coord_sign_conventions: 0.45,
    constant_accel_eqs: 0.3,
    implicit_boundary_conds: 0.2,
    vector_decomposition_2d: 0.25,
    variable_accel_calculus: 0.05,
  };
  const { root, trace } = lowestUnmasteredAncestor(graph, data.dag, 'variable_accel_calculus', mastery);
  assert.equal(root, 'coord_sign_conventions');
  assert.ok(trace.some((t) => t.result && t.result.includes('ROOT CAUSE')));
  assert.deepEqual(
    new Set(descendants(graph, 'coord_sign_conventions')),
    new Set(['constant_accel_eqs', 'implicit_boundary_conds', 'vector_decomposition_2d', 'variable_accel_calculus']),
  );
});

// 11. Cohort: 30 students, clusters 12/6/4/5, mean 68, matrix 30x6.
test('engine: cohort aggregation', () => {
  const c = computeCohort({ dag: data.dag, cohort: data.cohort }, cfg);
  assert.equal(c.total_students, 30);
  assert.equal(c.class_average_mastery, 68);
  const byId = Object.fromEntries(c.misconception_clusters.map((k) => [k.cluster_id, k.affected_student_count]));
  assert.deepEqual(byId, { cl_sign: 12, cl_rest: 6, cl_vector: 4, cl_accel: 5 });
  assert.deepEqual(c.mastery_distribution, { REMEDIATION_NEEDED: 22, ON_TRACK: 3, ACCELERATED: 5 });
  assert.equal(c.matrix.rows.length, 30);
  assert.equal(c.matrix.nodes.length, 6);
  for (const row of c.matrix.rows) {
    assert.equal(Object.keys(row.cells).length, 6);
  }
});

// 14. Config: escalation_threshold=2 flips case 2 to redirect (no hard-coded thresholds).
test('engine: thresholds come from config, not code', () => {
  const custom = { ...cfg, escalation_threshold: 2 };
  const r = analyzeSubmission(
    { profile: profileOf(preset('case2')), submission: preset('case2').submission, commit: false },
    { dag: data.dag, quiz: data.quiz, drills: data.drills },
    custom,
  );
  assert.equal(r.detected_gaps[0].failure_count, 2);
  assert.equal(r.roadmap_action, 'PREREQUISITE_REDIRECT');
});
