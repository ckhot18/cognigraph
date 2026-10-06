// Bridge-the-gap drill evaluation + state transition (spec 5.6).
// Pure: takes a student state snapshot, returns { state, result }.
// The store/API layer persists `state` when the call succeeds.

import { buildGraph } from './dag.js';
import { computeNodeStates } from './nodeStates.js';

function findDrill(drills, drillId) {
  return (drills.drills ?? []).find((d) => d.drill_id === drillId) ?? null;
}

function codedError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/**
 * @param {{failures:Record<string,number>, node_mastery:Record<string,number>, blocked_root:string|null, bridge_attempts:Record<string,number>}} snapshot
 */
export function evaluateBridge(snapshot, drillId, answerOptionId, data) {
  const { dag, drills } = data;
  const graph = buildGraph(dag);
  const drill = findDrill(drills, drillId);
  if (!drill) throw codedError('NOT_FOUND', `Unknown drill_id "${drillId}".`);
  const picked = (drill.options ?? []).find((o) => o.id === answerOptionId);
  if (!picked) throw codedError('BAD_REQUEST', `Unknown answer_option_id "${answerOptionId}" for drill "${drillId}".`);

  const failures = { ...(snapshot.failures ?? {}) };
  const nodeMastery = { ...(snapshot.node_mastery ?? {}) };
  const bridgeAttempts = { ...(snapshot.bridge_attempts ?? {}) };
  let blockedRoot = snapshot.blocked_root ?? null;
  const attempts = (bridgeAttempts[drillId] ?? 0) + 1;
  bridgeAttempts[drillId] = attempts;

  const correctOpt = drill.options.find((o) => o.id === drill.correct_option_id);

  if (picked.id === drill.correct_option_id) {
    // Correct: failure count for the tag resets; a blocked node restores to MASTERED.
    failures[drill.tag] = 0;
    bridgeAttempts[drillId] = 0;
    if (blockedRoot && drill.node === blockedRoot) {
      const thr = dag.nodes.find((n) => n.id === drill.node)?.mastery_threshold ?? 0.8;
      nodeMastery[drill.node] = Math.max(nodeMastery[drill.node] ?? 0, thr);
      blockedRoot = null;
    }
    const node_states = computeNodeStates(graph, dag, nodeMastery, { blockedRoot, warningNodes: new Set() });
    return {
      state: { failures, node_mastery: nodeMastery, blocked_root: blockedRoot, bridge_attempts: bridgeAttempts },
      result: {
        correct: true,
        feedback: picked.feedback,
        node_states,
        roadmap_action: 'CONTINUE',
        celebration: true,
        attempts,
      },
    };
  }

  // Wrong: state unchanged (apart from the attempt counter); after 2 wrong
  // attempts include a fuller worked explanation.
  const node_states = computeNodeStates(graph, dag, nodeMastery, {
    blockedRoot,
    warningNodes: new Set([drill.node]),
  });
  const result = {
    correct: false,
    feedback: picked.feedback,
    hint: drill.hint,
    attempts,
    node_states,
    roadmap_action: null,
    celebration: false,
  };
  if (attempts >= 2 && correctOpt) {
    result.worked_explanation =
      `Worked explanation: the correct answer is "${correctOpt.text}". ` +
      `${correctOpt.feedback} Hint: ${drill.hint}`;
  }
  return {
    state: { failures, node_mastery: nodeMastery, blocked_root: blockedRoot, bridge_attempts: bridgeAttempts },
    result,
  };
}
