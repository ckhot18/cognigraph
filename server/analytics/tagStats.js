// Tag counting, severity & prerequisite redirect (V2 §6.2, adapts v1 §5.2/5.4).
import { buildGraph, lowestUnmasteredAncestor } from '../engine/dag.js';
import { effectiveSeverity, countSeverity } from '../engine/thresholds.js';
import { normSev } from './db.js';
import { conceptMastery } from './mastery.js';

/** All wrong responses carrying a tag (across deep tests, cross-topic). */
export function tagHits(responses, questions, tag) {
  return responses.filter((r) => {
    if (r.is_correct) return false;
    const q = questions.get(r.question_id);
    return q && q.payloads[r.chosen_option_id]?.tag === tag;
  });
}

export function failureCount(responses, questions, tag) {
  return tagHits(responses, questions, tag).length;
}

/** Per-tag summary: count, topics, severity, cross-topic flag, evidence sample. */
export function tagTable(db, studentId) {
  const responses = db.byStudent.get(studentId) ?? [];
  const out = [];
  for (const [tag, meta] of Object.entries(db.pack.tags)) {
    const hits = tagHits(responses, db.questions, tag);
    if (hits.length === 0) continue;
    const topics = [...new Set(hits.map((r) => db.questions.get(r.question_id).topic_id))];
    const lastPayloadSev = normSev(db.questions.get(hits[hits.length - 1].question_id).payloads[hits[hits.length - 1].chosen_option_id].severity);
    const { severity, suspected_systemic } = effectiveSeverity({
      count: hits.length,
      payloadSeverity: lastPayloadSev,
      escalates: meta.escalates,
    });
    out.push({
      tag,
      kind: meta.kind,
      count: hits.length,
      topics,
      severity,
      suspected_systemic,
      cross_topic: topics.length >= 2,
      evidence: hits.slice(-3).map((r) => {
        const q = db.questions.get(r.question_id);
        return {
          question_id: r.question_id,
          test_id: r.test_id,
          chosen_text: q.options.find((o) => o.id === r.chosen_option_id)?.text,
        };
      }),
    });
  }
  return out.sort((a, b) => b.count - a.count);
}

/**
 * Prerequisite redirect for a SYSTEMIC escalating tag: union of lowest
 * unmastered ancestors over the concepts where it occurred (+ traces).
 */
export function redirectRoots(db, studentId, tag) {
  const cfg = db.config;
  const responses = db.byStudent.get(studentId) ?? [];
  const masteryMap = conceptMastery(responses, db.questions, {}, cfg);
  const full = {};
  for (const n of db.dag.nodes) full[n.id] = masteryMap[n.id]?.mastery ?? 0.5;
  const concepts = [...new Set(tagHits(responses, db.questions, tag).map((r) => {
    const q = db.questions.get(r.question_id);
    return q.payloads[r.chosen_option_id].concept_id;
  }))];
  const graph = buildGraph(db.dag);
  const roots = [];
  const seen = new Set();
  for (const c of concepts) {
    const { root, trace } = lowestUnmasteredAncestor(graph, db.dag, c, full);
    if (root && !seen.has(root)) {
      seen.add(root);
      roots.push({ root, via_concept: c, traversal_trace: trace });
    }
  }
  return roots;
}

export { countSeverity };
