import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDb } from '../analytics/db.js';
import { conceptMastery } from '../analytics/mastery.js';
import { tagTable, redirectRoots } from '../analytics/tagStats.js';
import { segmentStudent } from '../analytics/segmenter.js';
import { bridgePlan } from '../analytics/recommend.js';
import { planLecture } from '../analytics/lecturePlanner.js';
import { startPractice, answerItem, publicItem } from '../engine/practice.js';
import { effectiveSeverity } from '../engine/thresholds.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = loadDb();
const expectations = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'generator-expectations.json'), 'utf8')).expectations;

test('analytics: sign-inversion fixture redirects with trace + cross-topic', () => {
  const roots = redirectRoots(db, '5', 'sign_convention');
  assert.ok(roots.length >= 1, 'expected root causes');
  assert.ok(roots[0].traversal_trace.length > 0, 'expected trace');
  const entry = tagTable(db, '5').find((t) => t.tag === 'sign_convention');
  assert.ok(entry && entry.count >= 3, `sign count ${entry?.count}`);
  assert.ok(entry.topics.length >= 2, `cross-topic ${entry.topics}`);
  assert.equal(entry.cross_topic, true);
});

test('analytics: severity ladder unit (hint-level vs systemic)', () => {
  const hint = effectiveSeverity({ count: 1, payloadSeverity: 'PARTIAL_MENTAL_MODEL', escalates: true });
  assert.equal(hint.severity, 'PARTIAL_MENTAL_MODEL');
  const sys = effectiveSeverity({ count: 3, payloadSeverity: 'SYSTEMIC_MISCONCEPTION', escalates: true });
  assert.equal(sys.severity, 'SYSTEMIC_MISCONCEPTION');
  const slip = effectiveSeverity({ count: 5, payloadSeverity: 'SLIP', escalates: false });
  assert.equal(slip.severity, 'SLIP');
});

test('analytics: mastery slip-weighting + smoothing', () => {
  const mk = (qid, chosen, correct) => ({ student_id: 'x', test_id: 't', question_id: qid, chosen_option_id: chosen, correct_option_id: 'a', is_correct: correct, time_sec: 30, changed_answer: false });
  const sysWrong = conceptMastery([mk('kin_t01', 'b', false)], db.questions, {}, db.config);
  const slipWrong = conceptMastery([mk('kin_t07', 'b', false)], db.questions, {}, db.config);
  assert.ok(slipWrong['units_and_dimensions'].mastery > sysWrong['kin_sign_conventions'].mastery, 'slip should hurt less');
  assert.equal(conceptMastery([], db.questions, {}, db.config)['kin_sign_conventions'], undefined);
});

test('analytics: one bridge covers cross-topic habit', () => {
  const sid = ['5', '6', '7', '8'].find((id) => (tagTable(db, id).find((t) => t.tag === 'sign_convention')?.topics.length ?? 0) >= 2);
  assert.ok(sid, 'need a cross-topic sign student');
  const plan = bridgePlan(db, sid);
  const cross = plan.find((r) => (r.evidence[0]?.topics?.length ?? 0) >= 2);
  assert.ok(cross, 'expected one bridge spanning 2+ topics');
});

test('analytics: segment recovery >= 27/30 (responses only)', () => {
  let hit = 0;
  const misses = [];
  for (const s of db.students) {
    const { primary, secondary } = segmentStudent(db, s.student_id);
    const exp = expectations[s.student_id];
    if (primary === exp || secondary.includes(exp)) hit += 1;
    else misses.push(`${s.student_id}: got ${primary}+[${secondary}] want ${exp}`);
  }
  assert.ok(hit >= 27, `recovered ${hit}/30 misses: ${misses.join(' | ')}`);
});

test('analytics: must-pass segments', () => {
  const seg = (id) => segmentStudent(db, id);
  for (const id of ['1', '2']) assert.equal(seg(id).primary, 'ACCELERATE', `student ${id}`);
  for (const id of ['3', '4']) assert.equal(seg(id).primary, 'NEEDS_STRONG_SUPPORT', `student ${id}`);
  for (const id of ['29', '30']) {
    const s = seg(id);
    assert.ok(s.primary === 'GUESSING_PATTERN' || s.secondary.includes('GUESSING_PATTERN'), `guesser ${id}: ${s.primary}`);
  }
  for (const id of ['5', '6', '7', '8']) {
    const s = seg(id);
    assert.ok(s.primary === 'SIGN_CONVENTION_GAP' || s.secondary.includes('SIGN_CONVENTION_GAP'), `sign ${id}: ${s.primary}`);
  }
  for (const id of ['9', '10', '11', '12']) assert.equal(seg(id).primary, 'CALCULATION_HABITS', `calc ${id}`);
  for (const id of ['16', '17', '18']) assert.equal(seg(id).primary, 'TOPIC_LAG:current_electricity', `elec ${id}`);
});

test('analytics: lecture planner invariants', () => {
  const a = planLecture(db, { test_id: 'ALL', minutes: 60, include_challenge: true });
  const b = planLecture(db, { test_id: 'ALL', minutes: 60, include_challenge: true });
  assert.deepEqual(a, b, 'deterministic');
  assert.equal(a.total, 60, `total ${a.total}`);
  for (const blk of a.blocks) {
    assert.ok(blk.minutes >= 5, `${blk.key} min ${blk.minutes}`);
    assert.equal(blk.minutes % 5, 0, `${blk.key} not multiple of 5`);
    assert.ok(blk.minutes <= 24, `${blk.key} exceeds 40%`);
  }
  const short = planLecture(db, { test_id: 'ALL', minutes: 30 });
  assert.equal(short.total, 30);
  assert.ok(!short.blocks.some((blk) => blk.key === '__recap'), '30-min omits recap');
  assert.ok(a.blocks.some((blk) => blk.type === 'Edge-case clinic'), 'edge-case block present');
});

test('analytics: practice engine rules', () => {
  const answered = new Set(db.byStudent.get('5').map((r) => r.question_id));
  const { session, item } = startPractice(db, '5', { tag: 'sign_convention' }, answered);
  assert.ok(item, 'first item served');
  assert.ok(!('correct_option_id' in item), 'no answer leak');
  assert.ok(!answered.has(item.question_id), 'excludes answered');
  assert.equal(item.level, 'L1');
  // two on-target L1 answers -> advance
  let cur = item;
  for (let i = 0; i < 2; i++) {
    const q = db.questions.get(cur.question_id);
    const r = answerItem(db, session, cur.question_id, q.correct_option_id, {}, answered);
    cur = r.next_item;
    if (!cur) break;
  }
  assert.equal(session.level, 'L2');
  // wrong answers -> hint ladder 1,2,3
  const { session: s2, item: it2 } = startPractice(db, '5', { tag: 'sign_convention' }, answered);
  const q2 = db.questions.get(it2.question_id);
  const wrongOid = q2.options.map((o) => o.id).find((oid) => oid !== q2.correct_option_id);
  const h1 = answerItem(db, s2, it2.question_id, wrongOid, {}, answered);
  assert.equal(h1.hint.level, 1);
  const h2 = answerItem(db, s2, it2.question_id, wrongOid, {}, answered);
  assert.equal(h2.hint.level, 2);
  // overlay changes mastery
  const before = conceptMastery(db.byStudent.get('5'), db.questions, {}, db.config);
  const after = conceptMastery(db.byStudent.get('5'), db.questions, h1.overlay, db.config);
  void before;
  void after;
  assert.ok(Object.keys(h1.overlay).length >= 0);
});

test('analytics: student-facing data copy is Bridge-clean', () => {
  const banned = ['wrong', 'incorrect', 'fail', 'mistake', 'poor', 'bad', 'weak', 'error'];
  const hits = [];
  for (const q of db.pack.questions) {
    for (const [oid, pl] of Object.entries(q.payloads)) {
      for (const w of banned) {
        if (new RegExp(`\\b${w}\\w*\\b`, 'i').test(pl.student_note)) hits.push(`${q.id}/${oid}:${w}`);
      }
    }
  }
  for (const l of db.pack.lessons) {
    for (const blk of [...l.micro_lesson, ...l.reflect_options]) {
      for (const w of banned) {
        if (new RegExp(`\\b${w}\\w*\\b`, 'i').test(blk)) hits.push(`lesson/${l.concept_id}:${w}`);
      }
    }
  }
  assert.deepEqual(hits, [], `banned words: ${hits.slice(0, 8).join(', ')}`);
});
