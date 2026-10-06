// In-memory student state (spec: no database). Keyed by student_id.
// Re-seeded from data on startup and via POST /api/reset — a restart
// resets everything, which keeps the demo repeatable.

const students = new Map(); // student_id -> state
let interventionsDeployed = {}; // cluster_id -> record

export function seedStore(data) {
  students.clear();
  interventionsDeployed = {};
  for (const p of data.presets.presets ?? []) {
    students.set(p.student.student_id, {
      profile: {
        student_id: p.student.student_id,
        name: p.student.name,
        overall_mastery: p.overall_mastery,
      },
      node_mastery: { ...p.node_mastery },
      failures: { ...(p.prior_failures ?? {}) },
      blocked_root: null,
      bridge_attempts: {},
    });
  }
  for (const s of data.cohort.students ?? []) {
    if (students.has(s.student_id)) continue;
    students.set(s.student_id, {
      profile: { student_id: s.student_id, name: s.name, overall_mastery: s.overall_mastery },
      node_mastery: { ...s.node_mastery },
      failures: { ...(s.error_history ?? {}) },
      blocked_root: null,
      bridge_attempts: {},
    });
  }
  return students.size;
}

export function getStudent(id) {
  return students.get(id) ?? null;
}

export function setStudentState(id, state) {
  students.set(id, state);
}

export function studentCount() {
  return students.size;
}

export function getInterventions() {
  return interventionsDeployed;
}

export function recordIntervention(clusterId, record) {
  interventionsDeployed[clusterId] = record;
}

export function clearIntervention(clusterId) {
  delete interventionsDeployed[clusterId];
}
