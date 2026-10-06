// Data-integrity checks (spec 5.8). Runs at server startup (fail fast) and in tests.
// validateAll(data) returns an array of human-readable error strings (empty = pass).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.join(__dirname, '..', 'data');

const SEVERITIES = new Set(['NONE', 'SLIP', 'PARTIAL_MENTAL_MODEL', 'SYSTEMIC_MISCONCEPTION']);

export function loadData(dir = DEFAULT_DIR) {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  return {
    dag: read('kinematics_dag.json'),
    quiz: read('quiz_bank.json'),
    drills: read('drills.json'),
    presets: read('presets.json'),
    cohort: read('cohort_students.json'),
    interventions: read('interventions.json'),
    config: read('config.json'),
  };
}

/**
 * @param {{dag:any,quiz:any,drills:any,presets:any,cohort:any,interventions:any,config:any}} data
 * @returns {string[]} errors (empty when valid)
 */
export function validateAll(data) {
  const errors = [];
  const { dag, quiz, drills, presets, cohort } = data;

  // ---- 1. DAG: unique ids, known prerequisites, acyclic ----
  const nodeIds = new Set();
  for (const n of dag?.nodes ?? []) {
    if (!n.id) errors.push('dag: node missing id');
    else if (nodeIds.has(n.id)) errors.push(`dag: duplicate node id "${n.id}"`);
    else nodeIds.add(n.id);
  }
  for (const n of dag?.nodes ?? []) {
    for (const p of n.prerequisites ?? []) {
      if (!nodeIds.has(p)) errors.push(`dag: node "${n.id}" has unknown prerequisite "${p}"`);
    }
  }
  // cycle detection (DFS)
  const adj = new Map((dag?.nodes ?? []).map((n) => [n.id, n.prerequisites ?? []]));
  const state = new Map(); // id -> 'visiting' | 'done'
  const stack = [];
  function visit(id) {
    state.set(id, 'visiting');
    stack.push(id);
    for (const p of adj.get(id) ?? []) {
      if (state.get(p) === 'visiting') {
        errors.push(`dag: cycle detected: ${[...stack, p].join(' -> ')}`);
      } else if (!state.get(p) && adj.has(p)) {
        visit(p);
      }
    }
    stack.pop();
    state.set(id, 'done');
  }
  for (const id of nodeIds) if (!state.get(id)) visit(id);

  // ---- 2. tag registry ----
  const tags = dag?.tags ?? {};
  for (const [tag, t] of Object.entries(tags)) {
    if (t.node !== null && !nodeIds.has(t.node)) {
      errors.push(`dag: tag "${tag}" maps to unknown node "${t.node}"`);
    }
    if (typeof t.escalates !== 'boolean') errors.push(`dag: tag "${tag}" missing boolean "escalates"`);
    if (!t.label) errors.push(`dag: tag "${tag}" missing label`);
  }

  // ---- 3. questions ----
  const questions = new Map();
  for (const q of quiz?.questions ?? []) {
    if (!q.question_id) { errors.push('quiz: question missing question_id'); continue; }
    if (questions.has(q.question_id)) errors.push(`quiz: duplicate question "${q.question_id}"`);
    questions.set(q.question_id, q);
    if (!nodeIds.has(q.target_node)) {
      errors.push(`quiz: question "${q.question_id}" has unknown target_node "${q.target_node}"`);
    }
    const optIds = new Set();
    for (const o of q.options ?? []) {
      if (optIds.has(o.id)) errors.push(`quiz: question "${q.question_id}" has duplicate option id "${o.id}"`);
      optIds.add(o.id);
    }
    const correct = (q.options ?? []).filter((o) => o.id === q.correct_option_id);
    if (correct.length !== 1) {
      errors.push(`quiz: question "${q.question_id}" must have exactly one correct option (found ${correct.length})`);
    }
    // ---- 4. option payloads ----
    for (const o of q.options ?? []) {
      const p = o.payload ?? {};
      const isCorrect = o.id === q.correct_option_id;
      if (!SEVERITIES.has(p.severity)) {
        errors.push(`quiz: ${q.question_id}/${o.id} has invalid severity "${p.severity}"`);
      }
      if (!(p.remediation_tag in tags)) {
        errors.push(`quiz: ${q.question_id}/${o.id} has unknown remediation_tag "${p.remediation_tag}"`);
      }
      if (!isCorrect && !(p.explanation && p.explanation.trim())) {
        errors.push(`quiz: ${q.question_id}/${o.id} distractor is missing a non-empty explanation`);
      }
    }
    // rubric option refs must exist
    for (const pat of q.rubric?.patterns ?? []) {
      if (!optIds.has(pat.option_id)) {
        errors.push(`quiz: ${q.question_id} rubric references unknown option "${pat.option_id}"`);
      }
    }
  }

  // ---- 5. drills ----
  const drillsByTag = new Map();
  for (const d of drills?.drills ?? []) {
    if (!d.drill_id) errors.push('drills: drill missing drill_id');
    const optIds = (d.options ?? []).map((o) => o.id);
    if (!optIds.includes(d.correct_option_id)) {
      errors.push(`drills: drill "${d.drill_id}" has invalid correct_option_id "${d.correct_option_id}"`);
    }
    if (d.tag) {
      if (!drillsByTag.has(d.tag)) drillsByTag.set(d.tag, []);
      drillsByTag.get(d.tag).push(d.drill_id);
    }
  }
  for (const [tag, t] of Object.entries(tags)) {
    if (t.escalates === true && !(drillsByTag.get(tag)?.length >= 1)) {
      errors.push(`drills: escalating tag "${tag}" has no drill`);
    }
  }

  // ---- 6. presets ----
  for (const p of presets?.presets ?? []) {
    const sub = p.submission ?? {};
    const qids = sub.mode === 'session' ? (sub.attempts ?? []).map((a) => a.question_id) : [sub.question_id];
    for (const qid of qids) {
      if (!questions.has(qid)) errors.push(`presets: preset "${p.preset_id}" references unknown question "${qid}"`);
    }
    if (sub.mode === 'session') {
      for (const a of sub.attempts ?? []) {
        const q = questions.get(a.question_id);
        if (q && !q.options.some((o) => o.id === a.selected_option_id)) {
          errors.push(`presets: preset "${p.preset_id}" attempt references unknown option "${a.selected_option_id}"`);
        }
      }
    } else if (sub.selected_option_id) {
      const q = questions.get(sub.question_id);
      if (q && !q.options.some((o) => o.id === sub.selected_option_id)) {
        errors.push(`presets: preset "${p.preset_id}" references unknown option "${sub.selected_option_id}"`);
      }
    }
    for (const [nid, v] of Object.entries(p.node_mastery ?? {})) {
      if (!nodeIds.has(nid)) errors.push(`presets: preset "${p.preset_id}" has unknown node "${nid}"`);
      if (typeof v !== 'number' || v < 0 || v > 1) {
        errors.push(`presets: preset "${p.preset_id}" node "${nid}" mastery out of range (${v})`);
      }
    }
    for (const t of Object.keys(p.prior_failures ?? {})) {
      if (!(t in tags)) errors.push(`presets: preset "${p.preset_id}" has unknown prior tag "${t}"`);
    }
  }

  // ---- 7. cohort ----
  const students = cohort?.students ?? [];
  if (students.length !== 30) errors.push(`cohort: expected 30 students, found ${students.length}`);
  const seen = new Set();
  const groupCounts = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const s of students) {
    if (seen.has(s.student_id)) errors.push(`cohort: duplicate student_id "${s.student_id}"`);
    seen.add(s.student_id);
    for (const nid of nodeIds) {
      const v = s.node_mastery?.[nid];
      if (typeof v !== 'number' || v < 0 || v > 1) {
        errors.push(`cohort: student "${s.student_id}" has bad mastery for "${nid}"`);
        break;
      }
    }
    // derive group the same way cohort.js clusters: status + primary error tag
    if (s.status === 'ACCELERATED') groupCounts.D += 1;
    else if (s.status === 'ON_TRACK') groupCounts.E += 1;
    else {
      const entries = Object.entries(s.error_history ?? {}).sort((a, b) => b[1] - a[1]);
      const top = entries[0]?.[0];
      if (top === 'sign_convention_gravity') groupCounts.A += 1;
      else if (top === 'implicit_rest_state') groupCounts.B += 1;
      else if (top === 'vector_vs_scalar') groupCounts.C += 1;
    }
  }
  const expected = { A: 12, B: 6, C: 4, D: 5, E: 3 };
  for (const [g, n] of Object.entries(expected)) {
    if (groupCounts[g] !== n) errors.push(`cohort: group ${g} has ${groupCounts[g]} students, expected ${n}`);
  }

  return errors;
}

/** Validate the shipped on-disk data; throw with a readable list on failure. */
export function assertValidData(dir = DEFAULT_DIR) {
  const errors = validateAll(loadData(dir));
  if (errors.length > 0) {
    throw new Error(`Data validation failed (${errors.length}):\n- ${errors.join('\n- ')}`);
  }
  return true;
}
