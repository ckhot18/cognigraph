// Recommender — the student "Bridge Plan" (V2 §6.5). Rule-based, evidence-carrying.
import { redirectRoots } from './tagStats.js';
import { segmentStudent } from './segmenter.js';

const TOPIC_OF = (db, cid) => db.dag.nodes.find((n) => n.id === cid)?.topic_id ?? null;

function practiceFor(db, { tag = null, conceptId = null, level = null, exclude = new Set(), limit = 3 }) {
  const items = db.pack.questions.filter((q) => {
    if (!q.is_practice || exclude.has(q.id)) return false;
    if (conceptId && q.concept_id !== conceptId) return false;
    if (tag && !Object.values(q.payloads).some((pl) => pl.tag === tag)) return false;
    if (level && q.practice_level !== level) return false;
    return true;
  });
  return items.slice(0, limit).map((q) => q.id);
}

function lessonFor(db, conceptId) {
  return db.pack.lessons.some((l) => l.concept_id === conceptId) ? conceptId : null;
}

/** Bridge state from the practice overlay: TODO → IN_PROGRESS → DONE. Never auto-finishes. */
function recState(overlay, conceptId) {
  const g = overlay?.practice?.[conceptId] ?? 0;
  if (g >= 0.24) return 'DONE';
  if (g > 0) return 'IN_PROGRESS';
  return 'TODO';
}

/** Full ordered list; UI shows max 5 + "see all". Growth tone throughout. */
export function bridgePlan(db, studentId, overlay = {}) {
  const { primary, profile: p } = segmentStudent(db, studentId, overlay);
  void primary;
  const recs = [];
  const answered = new Set((db.byStudent.get(studentId) ?? []).map((r) => r.question_id));
  let pri = 1;

  // 1. SYSTEMIC escalating tags -> BRIDGE_CONCEPT per root cause.
  // After 3 misses on one habit the plan redirects to the prerequisite root:
  // downstream concepts hold while the foundation is rebuilt.
  for (const t of p.tag_table.filter((x) => x.severity === 'SYSTEMIC_MISCONCEPTION')) {
    const meta = db.pack.tags[t.tag];
    if (!meta?.escalates) continue;
    const roots = redirectRoots(db, studentId, t.tag);
    for (const { root } of roots.slice(0, 2)) {
      const lesson = lessonFor(db, root);
      const l1 = practiceFor(db, { conceptId: root, level: 'L1', exclude: answered });
      const l2 = practiceFor(db, { conceptId: root, level: 'L2', exclude: answered });
      recs.push({
        id: `bridge-${t.tag}-${root}`, priority: pri++, kind: 'BRIDGE_CONCEPT',
        redirect: true, root_concept: root,
        title: `Back to foundations: ${db.dag.nodes.find((n) => n.id === root)?.title ?? root}`,
        why: `${t.count} misses share this habit across ${t.topics.length} topic${t.topics.length > 1 ? 's' : ''} — the plan holds what comes next and rebuilds from ${db.dag.nodes.find((n) => n.id === root)?.title ?? root}.`,
        evidence: [{ tag: t.tag, count: t.count, topics: t.topics, sample: t.evidence }],
        marks_tied: `${t.count} of your recent questions`,
        state: recState(overlay, root),
        actions: [
          ...(lesson ? [{ type: 'LESSON', ref: lesson, est_minutes: 8 }] : []),
          ...(l1.length > 0 ? [{ type: 'PRACTICE', ref: l1[0], est_minutes: 6 }] : []),
          ...(l2.length > 0 ? [{ type: 'PRACTICE', ref: l2[0], est_minutes: 6 }] : []),
        ],
      });
    }
  }
  // 2. Edge-case clinic.
  const edgeCount = p.tag_table.filter((t) => db.pack.tags[t.tag]?.kind === 'edge_case').reduce((s, t) => s + t.count, 0);
  if (edgeCount >= 2) {
    recs.push({
      id: 'edge-clinic', priority: pri++, kind: 'EDGE_CASE_CLINIC',
      title: 'Hidden-clue reading clinic',
      why: `${edgeCount} off-target choices came from words that quietly set values — listing them first bridges this pattern.`,
      evidence: [{ count: edgeCount }],
      marks_tied: `${edgeCount} of your recent questions`,
      actions: [{ type: 'REFLECT', ref: 'clue-list', est_minutes: 5 }],
    });
  }
  // 3. Calculation habits.
  const wrongTotal = (db.byStudent.get(studentId) ?? []).filter((r) => !r.is_correct).length || 1;
  const calcShare = ((p.error_mix.calculation ?? 0) + (p.error_mix.careless ?? 0)) / wrongTotal;
  if (calcShare >= 0.4) {
    recs.push({
      id: 'calc-habit', priority: pri++, kind: 'CALC_HABIT',
      title: 'Careful-computation routine',
      why: `About ${Math.round(calcShare * 100)}% of off-target choices were unit, arithmetic, or missing-term slips on concepts you otherwise hold.`,
      evidence: [{ calc_share: Math.round(calcShare * 100) / 100 }],
      marks_tied: 'across topics',
      actions: [{ type: 'PRACTICE', ref: practiceFor(db, { exclude: answered, limit: 1 })[0] ?? null, est_minutes: 6 }],
    });
  }
  // 4. Pace.
  const n = (db.byStudent.get(studentId) ?? []).length || 1;
  if ((p.time_profile.FAST_WRONG / n) >= 0.15) {
    recs.push({
      id: 'pace', priority: pri++, kind: 'PACE',
      title: 'First-20-seconds routine',
      why: 'Several quick off-target choices suggest rushing — restating what is asked first usually recovers them.',
      evidence: [{ fast_wrong: p.time_profile.FAST_WRONG }],
      marks_tied: 'exam habit',
      actions: [{ type: 'REFLECT', ref: 'restate-ask', est_minutes: 4 }],
    });
  }
  // 5. Topic catch-up.
  const lagEntry = Object.entries(p.topic_scores).sort((a, b) => a[1] - b[1])[0];
  if (lagEntry && lagEntry[1] < 60) {
    const topicQs = db.pack.questions.filter((q) => q.topic_id === lagEntry[0] && q.is_practice && !answered.has(q.id)).slice(0, 2).map((q) => q.id);
    recs.push({
      id: `catchup-${lagEntry[0]}`, priority: pri++, kind: 'TOPIC_CATCHUP',
      title: `Catch-up path: ${lagEntry[0].replace(/_/g, ' ')}`,
      why: `Your ${lagEntry[0].replace(/_/g, ' ')} score (${lagEntry[1]}%) trails your other topics — a short focused set bridges it.`,
      evidence: [{ topic: lagEntry[0], score: lagEntry[1] }],
      marks_tied: lagEntry[0],
      actions: topicQs.map((qid) => ({ type: 'PRACTICE', ref: qid, est_minutes: 6 })),
    });
  }
  // 6. Stretch for accelerators.
  if (p.overall >= 85) {
    const stretch = db.pack.questions.filter((q) => q.is_practice && q.practice_level === 'L2' && !answered.has(q.id)).slice(0, 2).map((q) => q.id);
    recs.push({
      id: 'stretch', priority: pri++, kind: 'STRETCH',
      title: 'Ready to stretch',
      why: `Strong across topics (${p.overall}%) — extension items keep the momentum going.`,
      evidence: [{ overall: p.overall }],
      marks_tied: 'extension',
      actions: stretch.map((qid) => ({ type: 'PRACTICE', ref: qid, est_minutes: 8 })),
    });
  }
  // 7. Always a strengths note.
  if (p.strengths.length > 0) {
    recs.push({
      id: 'keep-going', priority: 99, kind: 'KEEP_GOING',
      title: `Keep it up: ${p.strengths.map((s) => s.concept_id.replace(/_/g, ' ')).join(', ')}`,
      why: 'These concepts are strong — returning to them between bridges keeps them warm.',
      evidence: p.strengths,
      marks_tied: 'strengths',
      actions: [],
    });
  }
  return recs.sort((a, b) => a.priority - b.priority);
}
