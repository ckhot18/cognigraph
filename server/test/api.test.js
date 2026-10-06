import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';

let base;
let server;
const tokens = {};

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

async function req(method, path, { token, body } = {}) {
  const t0 = Date.now();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, ms: Date.now() - t0 };
}
const get = (p, o) => req('GET', p, o);
const post = (p, o) => req('POST', p, o);

test('api: login both roles + demo shortcuts data', async () => {
  const s = await post('/api/auth/login', { body: { role: 'student', id: '5', password: '123' } });
  assert.equal(s.status, 200);
  assert.ok(s.json.token);
  tokens.student5 = s.json.token;
  const t = await post('/api/auth/login', { body: { role: 'teacher', id: '1', password: '123' } });
  assert.equal(t.status, 200);
  tokens.teacher = t.json.token;
  const bad = await post('/api/auth/login', { body: { role: 'student', id: '5', password: 'nope' } });
  assert.equal(bad.status, 401);
  assert.equal(bad.json.error.code, 'UNAUTHORIZED');
});

test('api: student portal reads (own data)', async () => {
  const me = await get('/api/student/me', { token: tokens.student5 });
  assert.equal(me.status, 200);
  assert.ok(me.json.profile.overall > 0);
  assert.ok(me.json.segment);
  const tests = await get('/api/student/me/tests', { token: tokens.student5 });
  assert.equal(tests.status, 200);
  assert.equal(tests.json.tests.length, 14);
  assert.ok(tests.json.tests.some((x) => x.has_item_data));
  assert.ok(tests.json.tests.some((x) => !x.has_item_data));
  const review = await get('/api/student/me/tests/kin_test', { token: tokens.student5 });
  assert.equal(review.status, 200);
  assert.equal(review.json.cards.length, 10);
  assert.ok(review.json.cards[0].student_note || review.json.cards[0].on_target);
  const ins = await get('/api/student/me/insights', { token: tokens.student5 });
  assert.equal(ins.status, 200);
  assert.ok(ins.json.insights.tag_table);
  const plan = await get('/api/student/me/bridge-plan', { token: tokens.student5 });
  assert.equal(plan.status, 200);
  assert.ok(plan.json.recommendations.length >= 1);
  assert.ok(plan.json.recommendations.length <= 5);
});

test('api: practice start/answer with prefetch, no leaks', async () => {
  const st = await post('/api/student/practice/start', { token: tokens.student5, body: { focus: { tag: 'sign_convention' } } });
  assert.equal(st.status, 200);
  assert.ok(st.json.item && !('correct_option_id' in st.json.item));
  const qid = st.json.item.question_id;
  const a = await post('/api/student/practice/answer', { token: tokens.student5, body: { session_id: st.json.session_id, question_id: qid, answer_option_id: 'a' } });
  assert.equal(a.status, 200);
  assert.ok('correct' in a.json);
  assert.ok(a.json.next_item === null || !('correct_option_id' in (a.json.next_item ?? {})));
});

test('api: guided path advance', async () => {
  const g = await get('/api/student/learn/kin_sign_conventions', { token: tokens.student5 });
  assert.equal(g.status, 200);
  assert.equal(g.json.view.step, 'INTRO');
  const a = await post('/api/student/learn/kin_sign_conventions/advance', { token: tokens.student5, body: {} });
  assert.equal(a.status, 200);
  assert.ok(a.json.view);
});

test('api: teacher overview/analysis/roster/lecture/assignments', async () => {
  const o = await get('/api/teacher/overview', { token: tokens.teacher });
  assert.equal(o.status, 200);
  assert.equal(o.json.total_students, 30);
  const an = await get('/api/teacher/tests/kin_test/analysis', { token: tokens.teacher });
  assert.equal(an.status, 200);
  assert.ok(an.json.questions.length === 10);
  const roster = await get('/api/teacher/students', { token: tokens.teacher });
  assert.equal(roster.status, 200);
  assert.equal(roster.json.students.length, 30);
  const dd = await get('/api/teacher/students/5', { token: tokens.teacher });
  assert.equal(dd.status, 200);
  assert.ok(dd.json.profile);
  const lp = await get('/api/teacher/lecture-plan?test_id=kin_test&minutes=60', { token: tokens.teacher });
  assert.equal(lp.status, 200);
  assert.equal(lp.json.total, 60);
  const asg = await post('/api/teacher/assignments', { token: tokens.teacher, body: { kind: 'PRACTICE', focus: { tag: 'sign_convention' }, note: 'Bridge set', student_ids: ['5', '6'] } });
  assert.equal(asg.status, 200);
  assert.equal(asg.json.student_ids.length, 2);
  const mine = await get('/api/student/me/bridge-plan', { token: tokens.student5 });
  assert.ok(mine.json.assignments.some((x) => x.assignment_id === asg.json.assignment_id), 'assignment visible to student');
});

test('api: role + ownership guards', async () => {
  const sOnT = await get('/api/teacher/overview', { token: tokens.student5 });
  assert.equal(sOnT.status, 403);
  const tOnS = await get('/api/student/me', { token: tokens.teacher });
  assert.equal(tOnS.status, 403);
  const other = await get('/api/teacher/students/6', { token: tokens.student5 });
  assert.ok([401, 403, 404].includes(other.status));
  const noTok = await get('/api/student/me');
  assert.equal(noTok.status, 401);
});

test('api: guards never crash + local p95 sanity', async () => {
  const bad = await post('/api/student/practice/answer', { token: tokens.student5, body: { session_id: 'nope', question_id: 'x', answer_option_id: 'a' } });
  assert.equal(bad.status, 404);
  const malformed = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
  assert.equal(malformed.status, 400);
  const times = [];
  for (let i = 0; i < 10; i++) {
    const r = await get('/api/teacher/overview', { token: tokens.teacher });
    times.push(r.ms);
  }
  times.sort((a, b) => a - b);
  assert.ok(times[9] < 1000, `p100 ${times[9]}ms`);
});
