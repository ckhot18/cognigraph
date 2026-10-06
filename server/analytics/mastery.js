// Concept mastery model (V2 §6.1). Slip-weighted, Laplace-smoothed.
import { buildGraph, descendants } from '../engine/dag.js';
import { computeNodeStates } from '../engine/nodeStates.js';
import { normSev } from './db.js';

export function attemptWeight(payload, cfg) {
  if (!payload) return 1;
  const sev = normSev(payload.severity);
  if (sev === 'SLIP') return cfg?.slip_weight ?? 0.5;
  return 1;
}

/**
 * mastery -> {conceptId: {mastery, attempts, hasData}}
 * mastery(c) = (correctWeight + 1) / (attemptWeight + 2); unseen -> 0.5 + hasData:false.
 */
export function conceptMastery(responses, questions, practiceOverlay = {}, cfg = {}) {
  const acc = new Map();
  for (const r of responses) {
    const q = questions.get(r.question_id);
    if (!q) continue;
    const cid = q.concept_id;
    if (!acc.has(cid)) acc.set(cid, { num: 1, den: 2, n: 0 });
    const a = acc.get(cid);
    const payload = r.is_correct ? null : q.payloads[r.chosen_option_id];
    const w = r.is_correct ? 1 : attemptWeight(payload, cfg);
    a.den += w;
    if (r.is_correct) a.num += w;
    a.n += 1;
  }
  const out = {};
  for (const [cid, a] of acc) {
    let m = a.num / a.den;
    if (practiceOverlay[cid]) m = Math.min(0.95, m + practiceOverlay[cid]);
    out[cid] = { mastery: Math.round(m * 1000) / 1000, attempts: a.n, hasData: true };
  }
  return out;
}

/** Node states for a student (reuses v1 §5.4 rules; unseen concepts flagged unknown). */
export function studentNodeStates(db, masteryMap, { blockedRoots = [], acceleration = false, warningConcepts = new Set() } = {}) {
  const graph = buildGraph(db.dag);
  const full = {};
  for (const n of db.dag.nodes) full[n.id] = masteryMap[n.id]?.mastery ?? 0.5;
  const blockedRoot = blockedRoots[0] ?? null;
  const states = computeNodeStates(graph, db.dag, full, { blockedRoot, acceleration, warningNodes: warningConcepts });
  for (const root of blockedRoots.slice(1)) {
    states[root] = { state: 'BLOCKED_NEED_ROOT', warning: warningConcepts.has(root) };
    for (const d of descendants(graph, root)) {
      if (states[d] && states[d].state !== 'BLOCKED_NEED_ROOT') {
        states[d] = { state: 'LOCKED', warning: states[d].warning };
      }
    }
  }
  for (const n of db.dag.nodes) {
    if (!masteryMap[n.id]?.hasData) states[n.id] = { ...states[n.id], unknown: true };
  }
  return states;
}
