// Practice (bridging) engine (V2 §7.1). Adaptive-lite, server-checked, overlay-based.
import { conceptMastery } from '../analytics/mastery.js';

export function publicItem(q) {
  return {
    question_id: q.id, topic_id: q.topic_id, concept_id: q.concept_id,
    level: q.practice_level, text: q.text,
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
    expected_time_sec: q.expected_time_sec,
  };
}

function candidates(db, session, answeredGlobal) {
  const done = new Set([...answeredGlobal, ...session.answered.map((a) => a.qid)]);
  return db.pack.questions.filter((q) => {
    if (!q.is_practice || done.has(q.id)) return false;
    if (session.focusConcept && q.concept_id !== session.focusConcept && !session.focusTag) return false;
    if (session.focusTag && !Object.values(q.payloads).some((pl) => pl.tag === session.focusTag)) {
      // allow fallback to focus-concept items
      if (!session.focusConcept || q.concept_id !== session.focusConcept) return false;
    }
    return true;
  });
}

/**
 * Custom targeting from test results: score items by overlap with the student's
 * actual misses — same concept as failed questions, top tags, weakest topics —
 * with level fit to concept mastery. Higher score first (stable order).
 */
export function scorePractice(db, pool, session, context = {}) {
  const failedConcepts = new Set(context.failedConcepts ?? []);
  const topTags = context.topTags ?? [];
  const weakTopics = new Set(context.weakTopics ?? []);
  const masteryMap = context.masteryMap ?? {};
  const scored = pool.map((q, idx) => {
    let s = 0;
    if (failedConcepts.has(q.concept_id)) s += 3;
    const qtags = Object.values(q.payloads).map((pl) => pl.tag);
    if (qtags.some((t) => topTags.includes(t))) s += 2;
    if (weakTopics.has(q.topic_id)) s += 2;
    if (session.focusConcept && q.concept_id === session.focusConcept) s += 2;
    if (session.focusTag && qtags.includes(session.focusTag)) s += 2;
    const m = masteryMap[q.concept_id]?.mastery ?? 0.5;
    const want = m < 0.55 ? 'L1' : m < 0.75 ? 'L2' : 'L3';
    if (q.practice_level === want) s += 1;
    return { q, s, idx };
  });
  scored.sort((a, b) => b.s - a.s || a.idx - b.idx);
  return scored.map((x) => x.q);
}

/** Start: first L1 item (prefetched, no answer). Context customizes targeting. */
export function startPractice(db, studentId, focus = {}, answeredGlobal = new Set(), context = {}) {
  const session = {
    student_id: studentId,
    focusTag: focus.tag ?? null,
    focusConcept: focus.conceptId ?? null,
    context,
    level: 'L1', streak: 0, answered: [], attempts: {}, done: false,
  };
  const item = nextItem(db, session, answeredGlobal);
  if (!item) session.done = true;
  return { session, item };
}

export function nextItem(db, session, answeredGlobal = new Set()) {
  if (session.done) return null;
  const pool = candidates(db, session, answeredGlobal);
  if (pool.length === 0) {
    session.done = true;
    return null;
  }
  const ranked = scorePractice(db, pool, session, session.context ?? {});
  const atLevel = ranked.filter((q) => q.practice_level === session.level);
  const pick = (atLevel.length > 0 ? atLevel : ranked)[0];
  return publicItem(pick);
}

/**
 * Grade an answer server-side. Returns feedback + mastery delta + prefetched next item.
 * done when overlay >= threshold && >= practice_min_items answered, or pool exhausted.
 */
export function answerItem(db, session, qid, chosenOid, overlay, answeredGlobal = new Set()) {
  const cfg = db.config;
  const q = db.questions.get(qid);
  if (!q || !q.is_practice) {
    const e = new Error(`Unknown practice item "${qid}".`);
    e.code = 'NOT_FOUND';
    throw e;
  }
  const correct = chosenOid === q.correct_option_id;
  const payload = correct ? null : q.payloads[chosenOid];
  session.attempts[qid] = (session.attempts[qid] ?? 0) + 1;
  session.answered.push({ qid, correct });

  let hint = null;
  if (!correct) {
    const tries = session.attempts[qid];
    const trap = db.pack.tags[payload?.tag]?.trap_text;
    if (tries === 1) hint = { level: 1, text: trap ?? 'Re-read the question stem once more.' };
    else if (tries === 2) hint = { level: 2, text: q.solution_steps[0] ?? trap };
    else hint = { level: 3, text: `Worked step: ${(q.solution_steps ?? []).join(' → ')}` };
    session.streak = 0;
    // step down: serve a simpler L1 item on the same tag next
    if (payload?.tag) session.level = 'L1';
  } else {
    session.streak += 1;
    const adv = cfg.practice_advance_streak ?? 2;
    if (session.streak >= adv && session.level === 'L1') { session.level = 'L2'; session.streak = 0; }
    else if (session.streak >= adv && session.level === 'L2') { session.level = 'L3'; session.streak = 0; }
  }

  const gain = correct ? (cfg.practice_overlay_gain ?? 0.12) : 0;
  const overlay2 = { ...overlay };
  if (gain > 0) {
    overlay2[q.concept_id] = Math.min(cfg.practice_overlay_cap ?? 0.95, (overlay2[q.concept_id] ?? 0) + gain);
  }
  const masteryMap = conceptMastery(
    (db.byStudent.get(session.student_id) ?? []).map((r) => r),
    db.questions, overlay2, cfg,
  );
  const focusCid = session.focusConcept ?? q.concept_id;
  const node = db.dag.nodes.find((n) => n.id === focusCid);
  const mastered = (masteryMap[focusCid]?.mastery ?? 0) >= (node?.mastery_threshold ?? 0.75);
  const minItems = cfg.practice_min_items ?? 4;
  const next = nextItem(db, session, answeredGlobal);
  if ((mastered && session.answered.length >= minItems) || !next) session.done = true;

  return {
    correct,
    feedback: correct
      ? 'On target — nicely bridged.'
      : `${q.payloads[chosenOid]?.student_note ?? 'Not quite — review the steps below.'}`,
    solution_steps: correct ? [] : (q.solution_steps ?? []),
    hint,
    overlay: overlay2,
    overlay_gain: gain,
    next_item: next,
    done: session.done,
    progress: { answered: session.answered.length, level: session.level },
  };
}
