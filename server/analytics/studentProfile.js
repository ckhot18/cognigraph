// Per-student profile / EDA (V2 §6.3).
import { conceptMastery, studentNodeStates } from './mastery.js';
import { tagTable, redirectRoots } from './tagStats.js';

/** OLS slope (percentage points per test) over chronological scores. */
export function olsSlope(points) {
  const n = points.length;
  if (n < 2) return 0;
  const xs = points.map((_, i) => i);
  const meanX = (n - 1) / 2;
  const meanY = points.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (points[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function trendOf(scores, cfg) {
  if (scores.length < (cfg?.trend_min_tests ?? 4)) return 'STEADY';
  const s = olsSlope(scores);
  const t = cfg?.trend_slope_pp ?? 4;
  if (s >= t) return 'IMPROVING';
  if (s <= -t) return 'DECLINING';
  return 'STEADY';
}

export function timeClass(r, questions, cfg) {
  const q = questions.get(r.question_id);
  const ratio = q ? r.time_sec / q.expected_time_sec : 1;
  const fast = cfg?.time_fast ?? 0.4;
  const slow = cfg?.time_slow ?? 1.4;
  if (ratio < fast && !r.is_correct) return 'FAST_WRONG';
  if (ratio > slow && r.is_correct) return 'SLOW_RIGHT';
  if (ratio > slow && !r.is_correct) return 'SLOW_WRONG';
  return 'FAST_RIGHT';
}

export function studentProfile(db, studentId, overlay = {}) {
  const cfg = db.config;
  const responses = db.byStudent.get(studentId) ?? [];
  const results = [...(db.resultsByStudent.get(studentId) ?? [])].sort((a, b) => {
    const da = db.tests.get(a.test_id)?.date ?? '';
    const dbd = db.tests.get(b.test_id)?.date ?? '';
    return da.localeCompare(dbd);
  });
  const overall = results.length > 0
    ? (results.reduce((s, r) => s + r.score / r.max_score, 0) / results.length) * 100
    : 0;
  const allOveralls = db.students.map((s) => {
    const rs = db.resultsByStudent.get(s.student_id) ?? [];
    return rs.length > 0 ? rs.reduce((a, r) => a + r.score / r.max_score, 0) / rs.length : 0;
  }).sort((a, b) => a - b);
  const frac = overall / 100;
  const belowOrEq = allOveralls.filter((v) => v <= frac).length;
  const percentile = Math.round((belowOrEq / Math.max(1, allOveralls.length)) * 100);
  const rank = allOveralls.filter((v) => v > frac).length + 1;

  const chrono = results.map((r) => (r.score / r.max_score) * 100);
  const trend = trendOf(chrono, cfg);

  const topic_scores = {};
  for (const t of db.pack.tests.filter((x) => x.type === 'DEEP')) {
    const r = results.find((x) => x.test_id === (t.id ?? t.test_id));
    if (r) topic_scores[t.topic_id] = Math.round((r.score / r.max_score) * 1000) / 10;
  }

  const masteryMap = conceptMastery(responses, db.questions, overlay.practice ?? {}, cfg);
  const tags = tagTable(db, studentId);
  const systemicRoots = [];
  const blockedRoots = [];
  const seenRoots = new Set();
  for (const t of tags) {
    if (t.severity === 'SYSTEMIC_MISCONCEPTION' && (db.pack.tags[t.tag]?.escalates ?? false)) {
      systemicRoots.push(t.tag);
      for (const { root } of redirectRoots(db, studentId, t.tag)) {
        if (!seenRoots.has(root)) {
          seenRoots.add(root);
          blockedRoots.push(root);
        }
      }
    }
  }
  // acceleration unlocks the stretch tier instead of blocking
  const acceleration = overall >= (cfg.acceleration_score ?? 85) && systemicRoots.length === 0;
  const node_states = studentNodeStates(db, masteryMap, {
    blockedRoots,
    acceleration,
    warningConcepts: new Set(tags.slice(0, 3).map((t) => {
      const hit = (db.byStudent.get(studentId) ?? []).find((r) => !r.is_correct && db.questions.get(r.question_id)?.payloads[r.chosen_option_id]?.tag === t.tag);
      return hit ? db.questions.get(hit.question_id).payloads[hit.chosen_option_id].concept_id : null;
    }).filter(Boolean)),
  });

  const error_mix = { concept: 0, edge_case: 0, calculation: 0, careless: 0, none: 0 };
  for (const r of responses) {
    if (r.is_correct) { error_mix.none += 1; continue; }
    const kind = db.pack.tags[db.questions.get(r.question_id)?.payloads[r.chosen_option_id]?.tag]?.kind;
    if (kind && kind in error_mix) error_mix[kind] += 1;
    else error_mix.concept += 1;
  }
  const time_profile = { FAST_WRONG: 0, SLOW_RIGHT: 0, SLOW_WRONG: 0, FAST_RIGHT: 0 };
  const ratios = [];
  for (const r of responses) {
    const cls = timeClass(r, db.questions, cfg);
    time_profile[cls] += 1;
    const q = db.questions.get(r.question_id);
    if (q) ratios.push(r.time_sec / q.expected_time_sec);
  }
  ratios.sort((a, b) => a - b);
  const median_ratio = ratios.length > 0 ? ratios[Math.floor(ratios.length / 2)] : 1;

  let rw = 0;
  let wr = 0;
  let ch = 0;
  for (const r of responses) {
    if (!r.changed_answer) continue;
    ch += 1;
    if (r.is_correct) wr += 1;
    else rw += 1;
  }

  const strengths = Object.entries(masteryMap)
    .filter(([, m]) => m.hasData && m.attempts >= 3)
    .sort((a, b) => b[1].mastery - a[1].mastery)
    .slice(0, 3)
    .map(([cid, m]) => ({ concept_id: cid, mastery: m.mastery }));

  return {
    student_id: studentId,
    overall: Math.round(overall * 10) / 10,
    percentile,
    rank,
    trend,
    trend_slope: Math.round(olsSlope(chrono) * 10) / 10,
    topic_scores,
    concept_mastery: masteryMap,
    node_states,
    error_mix,
    tag_table: tags,
    systemic_tags: systemicRoots,
    blocked_roots: blockedRoots,
    acceleration,
    time_profile,
    median_ratio: Math.round(median_ratio * 100) / 100,
    answer_changes: { total: ch, wrong_to_right: wr, right_to_wrong: rw },
    strengths,
    test_count: results.length,
  };
}
