// Severity + roadmap-action decision table (spec 5.2). All thresholds from config.

/** countSeverity(c): 1→SLIP, 2→PARTIAL_MENTAL_MODEL, ≥3→SYSTEMIC_MISCONCEPTION */
export function countSeverity(count) {
  if (count >= 3) return 'SYSTEMIC_MISCONCEPTION';
  if (count === 2) return 'PARTIAL_MENTAL_MODEL';
  return 'SLIP';
}

/**
 * effectiveSeverity: count drives; a PARTIAL payload may raise SLIP→PARTIAL;
 * SYSTEMIC comes only from count ≥ 3 (else suspected_systemic); non-escalating
 * tags (arithmetic slips) cap at SLIP.
 */
export function effectiveSeverity({ count, payloadSeverity, escalates }) {
  let severity = countSeverity(count);
  if (payloadSeverity === 'PARTIAL_MENTAL_MODEL' && severity === 'SLIP') {
    severity = 'PARTIAL_MENTAL_MODEL';
  }
  if (escalates === false && severity !== 'SLIP') {
    severity = 'SLIP';
  }
  const suspected_systemic = payloadSeverity === 'SYSTEMIC_MISCONCEPTION' && severity !== 'SYSTEMIC_MISCONCEPTION';
  return { severity, suspected_systemic };
}

/**
 * roadmap_action. Escalation threshold T comes from config (default 3):
 *   c >= T   → PREREQUISITE_REDIRECT
 *   c == T-1 → TARGETED_DRILL
 *   c < T-1  → HINT_ONLY
 * Non-escalating tags always → HINT_ONLY. All-correct sessions → acceleration/continue.
 */
export function roadmapAction({ count, escalates, allCorrect, sessionScore, gapCount, avgTimeSec, cfg }) {
  const accelScore = cfg?.acceleration_score ?? 85;
  const accelTime = cfg?.acceleration_avg_seconds ?? 45;
  if (allCorrect && gapCount === 0 && sessionScore > accelScore && (avgTimeSec ?? 0) <= accelTime) {
    return 'UNLOCK_ACCELERATION';
  }
  if (allCorrect && gapCount === 0) return 'CONTINUE';
  if (escalates === false) return 'HINT_ONLY';
  const T = cfg?.escalation_threshold ?? 3;
  if (count >= T) return 'PREREQUISITE_REDIRECT';
  if (count === T - 1) return 'TARGETED_DRILL';
  return 'HINT_ONLY';
}

/** Report badge from outcome. */
export function badgeFor({ action, gapCount }) {
  if (action === 'UNLOCK_ACCELERATION') return 'ACCELERATED';
  if (gapCount === 0) return 'MASTERED';
  if (action === 'PREREQUISITE_REDIRECT') return 'CRITICAL_GAP';
  return 'PARTIAL_FRICTION';
}
