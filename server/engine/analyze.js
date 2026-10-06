// analyzeSubmission() — the pure orchestrator (spec 5.5).
// Deterministic: same input → same output. No store access; the caller
// persists `next_failures` only when the request asked for commit:true.
import { buildGraph, lowestUnmasteredAncestor } from './dag.js';
import { matchSubmission } from './matcher.js';
import { effectiveSeverity, roadmapAction, badgeFor } from './thresholds.js';
import { computeNodeStates } from './nodeStates.js';

export const ASSESSMENT_ID = 'asmt_kin_001';

export const ACCELERATION_MODULES = [
  {
    module_id: 'mod_calculus',
    title: 'Calculus Integration',
    description: 'Differential Kinematics & Deriving Motion Equations via Integrals (∫a dt)',
  },
  {
    module_id: 'mod_drag',
    title: 'Applied Engineering',
    description: 'Aerodynamic Drag & Terminal Velocity Modeling',
  },
  {
    module_id: 'mod_f1',
    title: 'Sports Telemetry Challenge',
    description: 'F1 Braking Point Kinematics & Cornering Centripetal Forces',
  },
];

const HINTS = {
  implicit_rest_state:
    "The word 'dropped' tells you the stone starts from rest: set u = 0 m/s, then use s = ut + ½at².",
  sign_convention_gravity:
    'Fix the sign convention first: with up as positive, gravity enters every equation as −9.8 m/s².',
  model_boundary_constant_vs_variable:
    'Check the model boundary: v = u + at needs a constant a. If acceleration changes with time, differentiate or integrate instead.',
  constant_accel_eqs:
    'Write the full equation s = ut + ½at² before substituting — every term must appear.',
  vector_vs_scalar:
    'Split the launch velocity first: vx = v·cosθ, vy = v·sinθ. Then pick the component the question asks for.',
  arithmetic_execution:
    'Slow down one line at a time: recompute each arithmetic step separately and check the units.',
};

function findQuestion(quiz, id) {
  return (quiz.questions ?? []).find((q) => q.question_id === id) ?? null;
}

function findDrill(drills, tag) {
  return (drills.drills ?? []).find((d) => d.tag === tag) ?? null;
}

/** Public drill shape — never leaks correct_option_id / feedback. */
export function publicDrill(drill) {
  if (!drill) return null;
  return {
    drill_id: drill.drill_id,
    prompt: drill.prompt,
    options: (drill.options ?? []).map((o) => ({ id: o.id, text: o.text })),
    hint: drill.hint,
  };
}

function nodeTitle(dag, id) {
  return dag.nodes.find((n) => n.id === id)?.title ?? id;
}

function firstChild(graph, dag, root) {
  const kids = dag.nodes.filter((n) => (n.prerequisites ?? []).includes(root)).map((n) => n.id);
  return kids[0] ?? null;
}

function roadmapFor({ action, dag, graph, root, concept, drill, targetNode }) {
  if (action === 'PREREQUISITE_REDIRECT') {
    const resume = firstChild(graph, dag, root) ?? targetNode ?? root;
    return [
      { step: 1, node: root, action: 'REVISE', title: `Revise ${nodeTitle(dag, root)}` },
      { step: 2, node: root, action: 'RETEST', title: 'Pass the bridge drill' },
      { step: 3, node: resume, action: 'RESUME', title: `Resume ${nodeTitle(dag, resume)}` },
    ];
  }
  if (action === 'TARGETED_DRILL') {
    return [
      { step: 1, node: concept, action: 'PRACTICE', title: `Practice ${nodeTitle(dag, concept)}` },
      { step: 2, node: concept, action: 'RETEST', title: drill ? 'Pass the bridge drill' : 'Retry the question' },
    ];
  }
  if (action === 'HINT_ONLY') {
    return [{ step: 1, node: concept, action: 'REVIEW', title: `Review ${nodeTitle(dag, concept)}` }];
  }
  if (action === 'UNLOCK_ACCELERATION') {
    return ACCELERATION_MODULES.map((m, i) => ({
      step: i + 1,
      node: 'variable_accel_calculus',
      action: 'EXPLORE',
      title: m.title,
    }));
  }
  return [{ step: 1, node: targetNode ?? concept, action: 'CONTINUE', title: 'Continue to the next topic' }];
}

/**
 * @param {{profile:{student_id,name,overall_mastery,node_mastery,prior_failures}, submission:object, assessment_id?:string, commit?:boolean}} input
 * @param {{dag,quiz,drills}} data
 * @param {object} cfg thresholds
 */
export function analyzeSubmission(input, data, cfg = {}) {
  const { dag, quiz, drills } = data;
  const graph = buildGraph(dag);
  const profile = input.profile;
  const submission = input.submission ?? {};
  const mastery = { ...(profile.node_mastery ?? {}) };
  const prior = { ...(profile.prior_failures ?? {}) };
  const commit = input.commit === true;

  if (submission.mode === 'session') {
    return analyzeSession({ profile, mastery, prior, submission, commit, assessment: input.assessment_id ?? ASSESSMENT_ID }, { dag, quiz, drills, graph }, cfg);
  }

  const question = findQuestion(quiz, submission.question_id);
  if (!question) {
    throw codedError('NOT_FOUND', `Unknown question_id "${submission.question_id}".`);
  }
  const match = matchSubmission(question, submission, cfg);
  const isCorrect = match.status === 'CLASSIFIED' && match.option.id === question.correct_option_id;

  if (match.status === 'UNCLASSIFIED') {
    const drill = (drills.drills ?? []).find((d) => d.node === question.target_node) ?? drills.drills[0];
    const node_states = computeNodeStates(graph, dag, mastery, {
      warningNodes: new Set([question.target_node]),
    });
    return {
      student_id: profile.student_id,
      assessment_id: input.assessment_id ?? ASSESSMENT_ID,
      question_id: question.question_id,
      overall_mastery: profile.overall_mastery,
      session_score: 0,
      badge: 'PARTIAL_FRICTION',
      match_status: 'UNCLASSIFIED',
      detected_gaps: [],
      root_prerequisite_blocked: null,
      roadmap_action: 'TARGETED_DRILL',
      roadmap: roadmapFor({ action: 'TARGETED_DRILL', dag, graph, concept: question.target_node, drill, targetNode: question.target_node }),
      node_states,
      traversal_trace: [],
      recommended_drill: publicDrill(drill),
      hint: 'The working did not match a known pattern — a targeted drill on this topic is assigned.',
      acceleration: null,
      committed: commit,
      next_failures: { ...prior },
      confidence: match.confidence,
    };
  }

  if (isCorrect) {
    const node_states = computeNodeStates(graph, dag, mastery, { warningNodes: new Set() });
    return {
      student_id: profile.student_id,
      assessment_id: input.assessment_id ?? ASSESSMENT_ID,
      question_id: question.question_id,
      overall_mastery: profile.overall_mastery,
      session_score: 100,
      badge: 'MASTERED',
      match_status: 'CLASSIFIED',
      detected_gaps: [],
      root_prerequisite_blocked: null,
      roadmap_action: 'CONTINUE',
      roadmap: roadmapFor({ action: 'CONTINUE', dag, graph, concept: question.target_node, targetNode: question.target_node }),
      node_states,
      traversal_trace: [],
      recommended_drill: null,
      hint: null,
      acceleration: null,
      committed: commit,
      next_failures: { ...prior },
      confidence: match.confidence,
    };
  }

  const payload = match.option.payload;
  const tagId = payload.remediation_tag;
  const tag = dag.tags[tagId];
  if (!tag) throw codedError('BAD_REQUEST', `Unknown remediation_tag "${tagId}".`);
  const count = (prior[tagId] ?? 0) + 1;
  const { severity, suspected_systemic } = effectiveSeverity({
    count,
    payloadSeverity: payload.severity,
    escalates: tag.escalates,
  });
  const concept = tag.node ?? question.target_node;
  const action = roadmapAction({
    count,
    escalates: tag.escalates,
    allCorrect: false,
    sessionScore: 0,
    gapCount: 1,
    avgTimeSec: null,
    cfg,
  });
  const { root, trace } = lowestUnmasteredAncestor(graph, dag, concept, mastery);
  const blockedRoot = action === 'PREREQUISITE_REDIRECT' ? root : null;
  const node_states = computeNodeStates(graph, dag, mastery, {
    blockedRoot,
    warningNodes: new Set([concept]),
  });
  const drill = findDrill(drills, tagId);
  const gap = {
    concept_id: concept,
    remediation_tag: tagId,
    label: tag.label,
    severity,
    suspected_systemic,
    failure_count: count,
    threshold: cfg?.escalation_threshold ?? 3,
    evidence_quote: match.evidence_quote,
    evidence_interpretation: match.evidence_interpretation,
    selected_option_text: submission.selected_option_id ? match.option.text : null,
    confidence: match.confidence,
  };
  return {
    student_id: profile.student_id,
    assessment_id: input.assessment_id ?? ASSESSMENT_ID,
    question_id: question.question_id,
    overall_mastery: profile.overall_mastery,
    session_score: 0,
    badge: badgeFor({ action, gapCount: 1 }),
    match_status: 'CLASSIFIED',
    detected_gaps: [gap],
    root_prerequisite_blocked: blockedRoot,
    roadmap_action: action,
    roadmap: roadmapFor({ action, dag, graph, root: blockedRoot ?? concept, concept, drill, targetNode: question.target_node }),
    node_states,
    traversal_trace: trace,
    recommended_drill: publicDrill(drill),
    hint: action === 'HINT_ONLY' ? (HINTS[tagId] ?? 'Re-check the worked lines before moving on.') : null,
    acceleration: null,
    committed: commit,
    next_failures: { ...prior, [tagId]: count },
    confidence: match.confidence,
  };
}

function analyzeSession({ profile, mastery, prior, submission, commit, assessment }, { dag, quiz, drills, graph }, cfg) {
  const attempts = submission.attempts ?? [];
  let correct = 0;
  let totalTime = 0;
  const gaps = [];
  const nextFailures = { ...prior };
  for (const a of attempts) {
    const q = findQuestion(quiz, a.question_id);
    if (!q) throw codedError('NOT_FOUND', `Unknown question_id "${a.question_id}".`);
    totalTime += a.time_sec ?? 0;
    const m = matchSubmission(q, { selected_option_id: a.selected_option_id }, cfg);
    if (m.option && m.option.id === q.correct_option_id) {
      correct += 1;
    } else if (m.status === 'CLASSIFIED') {
      const tagId = m.option.payload.remediation_tag;
      nextFailures[tagId] = (nextFailures[tagId] ?? 0) + 1;
      gaps.push({ question_id: q.question_id, remediation_tag: tagId });
    }
  }
  const score = attempts.length > 0 ? (correct / attempts.length) * 100 : 0;
  const avg = attempts.length > 0 ? totalTime / attempts.length : 0;
  const allCorrect = attempts.length > 0 && correct === attempts.length;
  const action = roadmapAction({
    count: 0,
    escalates: true,
    allCorrect,
    sessionScore: score,
    gapCount: gaps.length,
    avgTimeSec: avg,
    cfg,
  });
  const acceleration =
    action === 'UNLOCK_ACCELERATION'
      ? { modules: ACCELERATION_MODULES, avg_time_sec: Math.round(avg * 10) / 10 }
      : null;
  const node_states = computeNodeStates(graph, dag, mastery, {
    acceleration: action === 'UNLOCK_ACCELERATION',
    warningNodes: new Set(),
  });
  return {
    student_id: profile.student_id,
    assessment_id: assessment,
    question_id: attempts[0]?.question_id ?? null,
    overall_mastery: profile.overall_mastery,
    session_score: Math.round(score * 10) / 10,
    badge: badgeFor({ action, gapCount: gaps.length }),
    match_status: 'CLASSIFIED',
    detected_gaps: [],
    root_prerequisite_blocked: null,
    roadmap_action: action,
    roadmap: roadmapFor({ action, dag, graph, concept: 'variable_accel_calculus', targetNode: 'variable_accel_calculus' }),
    node_states,
    traversal_trace: [],
    recommended_drill: null,
    hint: null,
    acceleration,
    committed: commit,
    next_failures: nextFailures,
    confidence: allCorrect ? 1.0 : 0.78,
  };
}

function codedError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}
