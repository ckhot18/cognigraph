// Node-state computation for the DAG map (spec 5.4).
import { descendants } from './dag.js';

/**
 * @param {object} graph built via buildGraph
 * @param {object} dag raw dag json (for thresholds/tiers/order)
 * @param {Record<string,number>} mastery per-node mastery 0–1
 * @param {{blockedRoot:string|null, acceleration:boolean, warningNodes:Set<string>}} opts
 * @returns {Record<string,{state:string,warning:boolean}>}
 */
export function computeNodeStates(graph, dag, mastery, opts = {}) {
  const { blockedRoot = null, acceleration = false, warningNodes = new Set() } = opts;
  const blockedDesc = blockedRoot ? new Set(descendants(graph, blockedRoot)) : new Set();
  const stateOf = {};

  const isGood = (id) => ['MASTERED', 'ACCELERATED'].includes(stateOf[id]);

  // Order matters: process roots-first so prerequisite states are known.
  // Simple fixed-point loop (6 nodes — trivial cost, no ordering bugs).
  const pending = new Map(dag.nodes.map((n) => [n.id, n]));
  let guard = 0;
  while (pending.size > 0 && guard < 20) {
    guard += 1;
    for (const [id, n] of [...pending]) {
      if (id === blockedRoot) {
        stateOf[id] = 'BLOCKED_NEED_ROOT';
        pending.delete(id);
        continue;
      }
      if (blockedRoot && blockedDesc.has(id)) {
        stateOf[id] = 'LOCKED';
        pending.delete(id);
        continue;
      }
      const m = mastery[id] ?? 0;
      if (acceleration && n.tier === 'core' && m >= n.mastery_threshold + 0.07) {
        stateOf[id] = 'ACCELERATED';
        pending.delete(id);
        continue;
      }
      if (m >= n.mastery_threshold) {
        stateOf[id] = 'MASTERED';
        pending.delete(id);
        continue;
      }
      const prereqs = n.prerequisites ?? [];
      if (prereqs.every((p) => stateOf[p] && isGood(p))) {
        stateOf[id] = 'IN_PROGRESS';
        pending.delete(id);
      } else if (prereqs.every((p) => stateOf[p])) {
        // all prereq states known but not all mastered
        stateOf[id] = 'LOCKED';
        pending.delete(id);
      }
      // else: wait for prereqs to resolve
    }
  }
  // Any leftovers (should not happen on a DAG) default to LOCKED.
  for (const id of pending.keys()) stateOf[id] = 'LOCKED';

  if (acceleration) stateOf['variable_accel_calculus'] = 'IN_PROGRESS';

  const out = {};
  for (const n of dag.nodes) {
    out[n.id] = { state: stateOf[n.id], warning: warningNodes.has(n.id) };
  }
  return out;
}
