// Revision-lecture planner (V2 §6.7). Deterministic; totals exact; instant on cache.
import { cohortInsights } from './cohortInsights.js';

const BLOCK_TYPE = { concept: 'Concept re-teach', edge_case: 'Edge-case clinic', calculation: 'Calculation hygiene', careless: 'Exam habits' };

const MOVES = {
  'Concept re-teach': ['Re-derive the idea live, then cold-call the boundary condition', 'Two clicker questions: one clean, one trap variant'],
  'Edge-case clinic': ['Project 3 clue-word items; students list implications before solving', 'Make a class word→value chart on the board'],
  'Calculation hygiene': ['Estimate-first drill: no calculators for 3 minutes', 'Substitute-back check on every answer'],
  'Exam habits': ['20-second restate routine modelled on one question', 'Attempt-order strategy: secure marks first'],
};

export function planLecture(db, { test_id = 'ALL', minutes = 60, include_challenge = false, overlayByStudent = {} } = {}) {
  const cfg = db.config;
  const ci = cohortInsights(db, test_id, overlayByStudent);
  const sevW = cfg.planner_sev_weight ?? { SLIP: 1, PARTIAL: 2, SYSTEMIC: 3 };
  const depCount = (cid) => db.dag.nodes.filter((n) => (n.prerequisites ?? []).includes(cid)).length;

  // Targets: every tag with >= 1 affected student in scope.
  const scopeTags = new Set();
  if (test_id === 'ALL') {
    for (const t of Object.keys(ci.tag_prevalence)) scopeTags.add(t);
  } else {
    for (const q of ci.questions) {
      for (const d of Object.values(q.distractors)) if (d.tag) scopeTags.add(d.tag);
    }
  }
  const targets = [];
  for (const tag of scopeTags) {
    const prev = ci.tag_prevalence[tag];
    if (!prev) continue;
    const sev = prev.bySeverity ?? {};
    const sevScore = (sev.SLIP ?? 0) * (sevW.SLIP ?? 1) + (sev.PARTIAL ?? 0) * (sevW.PARTIAL ?? 2) + (sev.SYSTEMIC ?? 0) * (sevW.SYSTEMIC ?? 3);
    const concepts = new Set();
    for (const q of db.pack.questions) {
      for (const pl of Object.values(q.payloads ?? {})) {
        if (pl.tag === tag) concepts.add(pl.concept_id);
      }
    }
    let deps = 0;
    for (const c of concepts) {
      deps = Math.max(deps, db.dag.nodes.filter((n) => (n.prerequisites ?? []).includes(c)).length);
    }
    const cross = prev.cross_topic_students > 0;
    const impact = sevScore * (1 + (cfg.planner_dependant_boost ?? 0.15) * deps) * (cross ? (cfg.planner_cross_boost ?? 1.2) : 1);
    const topics = new Set();
    for (const s of db.students) {
      for (const r of db.byStudent.get(s.student_id) ?? []) {
        const q = db.questions.get(r.question_id);
        if (!r.is_correct && (test_id === 'ALL' || (db.tests.get(test_id)?.question_ids ?? []).includes(r.question_id)) && q?.payloads[r.chosen_option_id]?.tag === tag) {
          topics.add(q.topic_id);
        }
      }
    }
    targets.push({ tag, kind: db.pack.tags[tag]?.kind ?? 'concept', studentsAffected: prev.students, topics: [...topics], cross, impact });
  }
  targets.sort((a, b) => b.impact - a.impact);

  const blocks = [];
  const recap = minutes >= 45 ? (cfg.planner_recap_min ?? 5) : 0;
  const exit = cfg.planner_exit_min ?? 5;
  const accelCount = ci.segments.ACCELERATE ?? 0;
  const challenge = include_challenge && accelCount >= (cfg.planner_min_accelerate ?? 3)
    ? Math.min(cfg.planner_challenge_max ?? 10, cfg.planner_challenge_min ?? 5)
    : 0;
  if (recap > 0) blocks.push({ key: '__recap', title: 'Opening recap', type: 'Recap', minutes: recap, fixed: true });
  const R = minutes - recap - exit - challenge;
  const minB = cfg.planner_block_min ?? 5;
  const maxB = Math.floor(minutes * (cfg.planner_block_max_frac ?? 0.4));

  // Proportional allocation, largest remainder, multiples of 5, drop smallest until all >= min.
  let pool = targets.filter((t) => t.studentsAffected > 0);
  let alloc = [];
  while (pool.length > 0) {
    const total = pool.reduce((s, t) => s + t.impact, 0) || 1;
    const raw = pool.map((t) => ({ t, exact: (R * t.impact) / total }));
    const base = raw.map((r) => ({ ...r, m: Math.min(maxB, Math.max(minB, Math.floor(r.exact / 5) * 5)) }));
    const sum = base.reduce((s, r) => s + r.m, 0);
    if (sum > R) {
      pool = pool.slice(0, -1);
      continue;
    }
    let rem = R - sum;
    const order = base.map((r, i) => ({ i, frac: r.exact - Math.floor(r.exact / 5) * 5 })).sort((a, b) => b.frac - a.frac);
    for (const { i } of order) {
      if (rem <= 0) break;
      if (base[i].m + 5 <= maxB) { base[i].m += 5; rem -= 5; }
    }
    if (rem !== 0) {
      pool = pool.slice(0, -1);
      continue;
    }
    alloc = base;
    break;
  }

  for (const { t, m } of alloc) {
    const type = BLOCK_TYPE[t.kind] ?? 'Concept re-teach';
    // Grouping: name 2 affected + 1 strong student.
    // Example questions: highest share choosing this tag's distractor.
    const exQs = ci.questions
      .map((q) => {
        const ds = Object.values(q.distractors).filter((d) => d.tag === t.tag);
        const tot = ds.reduce((s, d) => s + d.count, 0);
        return { qid: q.question_id, count: tot };
      })
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 2)
      .map((x) => x.qid);
    blocks.push({
      key: `tag:${t.tag}`, title: db.pack.tags[t.tag]?.label ?? t.tag, type, minutes: m,
      why: `${t.studentsAffected} student${t.studentsAffected === 1 ? '' : 's'}${t.topics.length > 0 ? ' · ' + t.topics.join(' + ') : ''}${t.cross ? ' (cross-topic)' : ''}`,
      students_affected: [], teaching_moves: MOVES[type] ?? [], example_questions: exQs,
      checkpoint_question: null, grouping: [],
    });
  }
  // Fill students_affected + checkpoint + grouping from tag table evidence.
  for (const b of blocks) {
    if (!b.key.startsWith('tag:')) continue;
    const tag = b.key.slice(4);
    b.students_affected = affectedStudents(db, test_id, tag);
    const pq = db.pack.questions.find((q) => q.is_practice && Object.values(q.payloads).some((pl) => pl.tag === tag));
    b.checkpoint_question = pq ? pq.id : null;
    b.grouping = suggestGrouping(db, tag, b.students_affected);
  }
  blocks.push({ key: '__exit', title: 'Exit ticket', type: 'Exit ticket', minutes: exit, fixed: true });
  if (challenge > 0) blocks.push({ key: '__challenge', title: 'Challenge (accelerated students)', type: 'Extension', minutes: challenge, fixed: true });

  const total = blocks.reduce((s, b) => s + b.minutes, 0);
  const summary = `${minutes}-min plan: ` + blocks.map((b) => `${b.minutes} min ${b.title.toLowerCase()} (${b.type.toLowerCase()})`).join(' · ');
  return { scope: test_id, minutes, blocks, total, summary, why_order: 'Ordered by impact (students affected × severity, boosted for cross-topic habits and dependant concepts).' };
}

function affectedStudents(db, testId, tag) {
  const names = [];
  const qids = testId === 'ALL' ? null : new Set((db.tests.get(testId)?.question_ids ?? []));
  for (const s of db.students) {
    const rs = db.byStudent.get(s.student_id) ?? [];
    if (rs.some((r) => !r.is_correct && (!qids || qids.has(r.question_id)) && db.questions.get(r.question_id)?.payloads[r.chosen_option_id]?.tag === tag)) {
      names.push(s.name);
    }
  }
  return names;
}

function suggestGrouping(db, tag, affectedNames) {
  // Strong = ACCELERATE/ON_TRACK-ish overall >= 80 and not affected.
  const affected = new Set(affectedNames);
  const strong = db.students
    .filter((s) => !affected.has(s.name))
    .map((s) => {
      const rs = db.resultsByStudent.get(s.student_id) ?? [];
      const avg = rs.length ? rs.reduce((a, r) => a + r.score / r.max_score, 0) / rs.length : 0;
      return { name: s.name, avg };
    })
    .filter((x) => x.avg >= 0.8)
    .sort((a, b) => b.avg - a.avg);
  if (affectedNames.length === 0 || strong.length === 0) return [];
  return [`Pair ${affectedNames.slice(0, 2).join(' + ')} with ${strong[0].name} for peer review`];
}
