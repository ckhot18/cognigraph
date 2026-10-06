// Cohort insights for a test scope (V2 §6.6). Computed from cached responses.
import { studentProfile } from './studentProfile.js';
import { segmentStudent } from './segmenter.js';

export function cohortInsights(db, testId = 'ALL', overlayByStudent = {}) {
  const cfg = db.config;
  const tests = testId === 'ALL'
    ? db.pack.tests.filter((t) => t.type === 'DEEP')
    : db.pack.tests.filter((t) => (t.id ?? t.test_id) === testId);
  const qids = new Set();
  for (const t of tests) for (const qid of t.question_ids ?? []) qids.add(qid);

  const inScope = (r) => qids.size === 0 || qids.has(r.question_id);
  const perStudent = db.students.map((s) => {
    const rs = (db.byStudent.get(s.student_id) ?? []).filter(inScope);
    const correct = rs.filter((r) => r.is_correct).length;
    const times = rs.map((r) => {
      const q = db.questions.get(r.question_id);
      return q ? r.time_sec / q.expected_time_sec : 1;
    });
    return { student_id: s.student_id, name: s.name, n: rs.length, correct, acc: rs.length ? correct / rs.length : 0, avgRatio: times.length ? times.reduce((a, b) => a + b, 0) / times.length : 1 };
  });

  const scores = perStudent.map((s) => s.acc * 100);
  const distribution = {};
  for (const s of scores) {
    const band = Math.floor(s / 10) * 10;
    distribution[band] = (distribution[band] || 0) + 1;
  }

  // Per-question difficulty, discrimination (top/bottom 27%), distractor table.
  const ranked = [...perStudent].sort((a, b) => b.acc - a.acc);
  const k = Math.max(1, Math.floor(ranked.length * ((cfg.discrimination_pct ?? 27) / 100)));
  const top = new Set(ranked.slice(0, k).map((s) => s.student_id));
  const bottom = new Set(ranked.slice(-k).map((s) => s.student_id));
  const questions = [...qids].map((qid) => {
    const q = db.questions.get(qid);
    const rs = [];
    for (const [sid, list] of db.byStudent) {
      const r = list.find((x) => x.question_id === qid && inScope(x));
      if (r) rs.push({ sid, r });
    }
    const p = rs.length ? rs.filter((x) => x.r.is_correct).length / rs.length : 0;
    const pTop = rs.length ? rs.filter((x) => top.has(x.sid) && x.r.is_correct).length / Math.max(1, rs.filter((x) => top.has(x.sid)).length) : 0;
    const pBot = rs.length ? rs.filter((x) => bottom.has(x.sid) && x.r.is_correct).length / Math.max(1, rs.filter((x) => bottom.has(x.sid)).length) : 0;
    const distractors = {};
    for (const x of rs.filter((y) => !y.r.is_correct)) {
      const oid = x.r.chosen_option_id;
      if (!distractors[oid]) distractors[oid] = { count: 0, students: [], tag: q.payloads[oid]?.tag };
      distractors[oid].count += 1;
      distractors[oid].students.push(x.sid);
    }
    return { question_id: qid, difficulty: Math.round(p * 1000) / 10, discrimination: Math.round((pTop - pBot) * 100) / 100, distractors, tag: q.concept_id };
  });

  // Tag prevalence + segments + heatmap.
  const tagPrev = {};
  for (const s of db.students) {
    const prof = studentProfile(db, s.student_id, overlayByStudent[s.student_id] ?? {});
    for (const t of prof.tag_table) {
      if (!tagPrev[t.tag]) tagPrev[t.tag] = { students: 0, bySeverity: {}, cross_topic_students: 0 };
      tagPrev[t.tag].students += 1;
      tagPrev[t.tag].bySeverity[t.severity] = (tagPrev[t.tag].bySeverity[t.severity] || 0) + 1;
      if (t.cross_topic) tagPrev[t.tag].cross_topic_students += 1;
    }
  }
  const segments = {};
  for (const s of db.students) {
    const seg = segmentStudent(db, s.student_id, overlayByStudent[s.student_id] ?? {}).primary;
    segments[seg] = (segments[seg] || 0) + 1;
  }
  const heatmap = {
    concepts: db.dag.nodes.map((n) => n.id),
    rows: db.students.map((s) => {
      const prof = studentProfile(db, s.student_id, overlayByStudent[s.student_id] ?? {});
      return { student_id: s.student_id, name: s.name, cells: Object.fromEntries(db.dag.nodes.map((n) => [n.id, prof.concept_mastery[n.id]?.mastery ?? null])) };
    }),
  };
  return { scope: testId, students: perStudent, distribution, questions, tag_prevalence: tagPrev, segments, heatmap };
}
