// Teacher cohort aggregation (spec 5.7). Computed from data, never hard-coded.

export function primaryTag(student) {
  const entries = Object.entries(student.error_history ?? {}).sort((a, b) => b[1] - a[1]);
  return entries.length > 0 ? entries[0][0] : null;
}

const CLUSTER_DEFS = [
  {
    cluster_id: 'cl_sign',
    cluster_name: 'Sign Convention Inversion under Gravity',
    severity_color: 'red',
    match: (s) => primaryTag(s) === 'sign_convention_gravity',
    root_concept_tag: 'sign_convention_gravity',
    root_problem: 'Assigning +g instead of −g in upward motion.',
    one_click_actions: [
      { action_type: 'DEPLOY_REMEDIATION_DECK', label: 'Deploy 10-Min Sign Rules Remediation Deck' },
      { action_type: 'CREATE_GROUP_ASSIGNMENT', label: 'Create Group Assignment' },
    ],
  },
  {
    cluster_id: 'cl_rest',
    cluster_name: 'Implicit Boundary Condition Omission',
    severity_color: 'yellow',
    match: (s) => primaryTag(s) === 'implicit_rest_state',
    root_concept_tag: 'implicit_rest_state',
    root_problem: "Missing u = 0 / v = 0 hidden in 'dropped', 'at peak', 'comes to rest' wording.",
    one_click_actions: [
      { action_type: 'SEND_PRACTICE_DRILL', label: 'Send Rest State Practice Drill' },
    ],
  },
  {
    cluster_id: 'cl_vector',
    cluster_name: 'Vector vs Scalar Confusion',
    severity_color: 'yellow',
    match: (s) => primaryTag(s) === 'vector_vs_scalar',
    root_concept_tag: 'vector_vs_scalar',
    root_problem: 'Using the full launch speed where a component (v·sinθ / v·cosθ) is needed.',
    one_click_actions: [
      { action_type: 'ASSIGN_VECTOR_MODULE', label: 'Route to Vector Foundations Module' },
    ],
  },
  {
    cluster_id: 'cl_accel',
    cluster_name: 'High-Performer Acceleration Candidates',
    severity_color: 'gold',
    match: (s) => s.status === 'ACCELERATED',
    root_concept_tag: null,
    root_problem: 'Core kinematics mastered — ready for calculus-based extension.',
    one_click_actions: [
      { action_type: 'ASSIGN_EXTENSION', label: 'Assign Calculus Physics Extension' },
    ],
  },
];

function cellColor(v, cfg) {
  const green = cfg?.matrix_green ?? 0.8;
  const yellow = cfg?.matrix_yellow ?? 0.55;
  if (v >= green) return 'green';
  if (v >= yellow) return 'yellow';
  return 'red';
}

/**
 * @param {{dag, cohort}} data
 * @param {object} cfg thresholds (matrix colors)
 * @param {Record<string, object>} interventionsDeployed cluster_id -> record (merged as `interventions_deployed`)
 */
export function computeCohort(data, cfg = {}, interventionsDeployed = {}) {
  const students = data.cohort.students ?? [];
  const nodes = data.dag.nodes.map((n) => n.id);
  const total = students.length;
  const classAverage = total > 0 ? Math.round(students.reduce((s, x) => s + x.overall_mastery, 0) / total) : 0;

  const distribution = { REMEDIATION_NEEDED: 0, ON_TRACK: 0, ACCELERATED: 0 };
  for (const s of students) {
    if (s.status in distribution) distribution[s.status] += 1;
  }

  const clusters = CLUSTER_DEFS.map((def) => {
    const members = students.filter(def.match);
    return {
      cluster_id: def.cluster_id,
      cluster_name: def.cluster_name,
      severity_color: def.severity_color,
      affected_student_count: members.length,
      affected_student_names: members.map((s) => s.name),
      root_concept_tag: def.root_concept_tag,
      root_problem: def.root_problem,
      one_click_actions: def.one_click_actions,
      ...(interventionsDeployed[def.cluster_id]
        ? { interventions_deployed: interventionsDeployed[def.cluster_id] }
        : {}),
    };
  });

  const signCluster = clusters.find((c) => c.cluster_id === 'cl_sign');
  const matrix = {
    nodes,
    rows: students.map((s) => ({
      student_id: s.student_id,
      name: s.name,
      overall_mastery: s.overall_mastery,
      status: s.status,
      cells: Object.fromEntries(nodes.map((n) => [n, cellColor(s.node_mastery?.[n] ?? 0, cfg)])),
    })),
  };

  return {
    cohort_id: 'phys_101_sec_a',
    class_name: 'Physics 101',
    total_students: total,
    class_average_mastery: classAverage,
    active_critical_gaps: {
      count: signCluster.affected_student_count,
      label: `${signCluster.affected_student_count} Students Blocked on Sign Conventions`,
    },
    mastery_distribution: distribution,
    misconception_clusters: clusters,
    matrix,
  };
}
