import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';

let base;
let server;

test.before(async () => {
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function post(path, body, raw = false) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ? body : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function get(path) {
  const res = await fetch(`${base}${path}`);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

test('api: health + presets + dag', async () => {
  const h = await get('/api/health');
  assert.equal(h.status, 200);
  assert.equal(h.json.ok, true);

  const p = await get('/api/presets');
  assert.equal(p.status, 200);
  assert.equal(p.json.presets.length, 4);

  const one = await get('/api/presets/case1');
  assert.equal(one.status, 200);
  assert.ok(one.json.questions[0].prompt.includes('thrown'));
  assert.ok(!('payload' in one.json.questions[0].options[0]), 'preset options must not leak payloads');

  const d = await get('/api/dag');
  assert.equal(d.status, 200);
  assert.equal(d.json.nodes.length, 6);
  assert.ok(d.json.edges.length >= 5);
});

test('api: case 1 end-to-end (commit:false stays repeatable)', async () => {
  await post('/api/reset', {});
  const { status, json } = await post('/api/analyze-submission', {
    student_id: 's_case1',
    commit: false,
    submission: {
      mode: 'mcq',
      question_id: 'kin_q_101',
      selected_option_id: 'opt_b',
      working_text: 's = (20)(3) + 0.5 * 9.8 * (3^2) = 104.1 m',
    },
  });
  assert.equal(status, 200);
  assert.equal(json.roadmap_action, 'PREREQUISITE_REDIRECT');
  assert.equal(json.root_prerequisite_blocked, 'coord_sign_conventions');
  assert.equal(json.detected_gaps[0].severity, 'SYSTEMIC_MISCONCEPTION');
  assert.equal(json.recommended_drill.drill_id, 'drill_sign_01');
  assert.ok(!('correct_option_id' in (json.recommended_drill ?? {})));

  // commit:false → store untouched: roadmap still shows no block.
  const road = await get('/api/student-roadmap?student_id=s_case1');
  assert.equal(road.json.blocked_root, null);
});

test('api: commit:true persists, bridge-gap restores', async () => {
  await post('/api/reset', {});
  const a = await post('/api/analyze-submission', {
    student_id: 's_case1',
    commit: true,
    submission: { mode: 'mcq', question_id: 'kin_q_101', selected_option_id: 'opt_b', working_text: 's = (20)(3) + 0.5 * 9.8 * (3^2) = 104.1 m' },
  });
  assert.equal(a.json.committed, true);
  const road = await get('/api/student-roadmap?student_id=s_case1');
  assert.equal(road.json.blocked_root, 'coord_sign_conventions');

  const b = await post('/api/bridge-gap', { student_id: 's_case1', drill_id: 'drill_sign_01', answer_option_id: 'b' });
  assert.equal(b.status, 200);
  assert.equal(b.json.correct, true);
  assert.equal(b.json.node_states['coord_sign_conventions'].state, 'MASTERED');
});

test('api: teacher cohort + intervention + undo', async () => {
  await post('/api/reset', {});
  const c = await get('/api/teacher-cohort');
  assert.equal(c.status, 200);
  assert.equal(c.json.total_students, 30);
  assert.equal(c.json.class_average_mastery, 68);

  const iv = await post('/api/teacher-intervention', { cluster_id: 'cl_sign', action_type: 'DEPLOY_REMEDIATION_DECK' });
  assert.equal(iv.status, 200);
  assert.equal(iv.json.status, 'DEPLOYED');
  assert.equal(iv.json.affected_student_count, 12);
  assert.ok(iv.json.payload.slides.length === 5);

  const c2 = await get('/api/teacher-cohort');
  const card = c2.json.misconception_clusters.find((k) => k.cluster_id === 'cl_sign');
  assert.ok(card.interventions_deployed, 'card should show deployed ribbon state');

  const del = await fetch(`${base}/api/teacher-intervention`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cluster_id: 'cl_sign' }),
  });
  assert.equal(del.status, 200);
});

test('api: input guards never crash the server', async () => {
  const unknownQ = await post('/api/analyze-submission', {
    student_id: 's_case1',
    submission: { mode: 'mcq', question_id: 'nope', selected_option_id: 'opt_a' },
  });
  assert.equal(unknownQ.status, 404);
  assert.equal(unknownQ.json.error.code, 'NOT_FOUND');

  const big = await post('/api/analyze-submission', {
    student_id: 's_case1',
    submission: { mode: 'free_text', question_id: 'kin_q_101', working_text: 'x'.repeat(2001) },
  });
  assert.equal(big.status, 400);
  assert.equal(big.json.error.code, 'BAD_REQUEST');

  const malformed = await post('/api/analyze-submission', '{oops', true);
  assert.equal(malformed.status, 400);
  assert.equal(malformed.json.error.code, 'BAD_REQUEST');

  const unknownStudent = await get('/api/student-roadmap?student_id=ghost');
  assert.equal(unknownStudent.status, 404);

  // Server still up after all the abuse.
  const h = await get('/api/health');
  assert.equal(h.status, 200);
  assert.equal(h.json.ok, true);
});
