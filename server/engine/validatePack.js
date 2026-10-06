// V2 content-pack validation (dag, tags, questions, lessons, tests, credentials).
// Pure: validatePack(pack) -> string[]. Numeric `check` objects are recomputed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.join(__dirname, '..', 'data');

const SEV = new Set(['SLIP', 'PARTIAL', 'SYSTEMIC']);
const ESCALATING = ['sign_convention', 'implicit_condition', 'formula_misapplication', 'vector_vs_scalar', 'energy_conservation_misuse'];

/** Only digits and arithmetic operators survive — safe to evaluate. */
export function evalCheck(expr) {
  if (!/^[0-9+\-*/().\s]*$/.test(expr)) throw new Error(`unsafe check expr: ${expr}`);
  if (/\*\*\*/.test(expr)) throw new Error(`unsafe check expr: ${expr}`);
  // eslint-disable-next-line no-new-func
  return Function(`'use strict'; return (${expr});`)();
}

export function loadPack(dir = DEFAULT_DIR) {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  return {
    dag: read('dag.json'),
    tags: read('tags.json').tags,
    questions: read('questions.json').questions,
    lessons: read('lessons.json').lessons,
    tests: read('tests.json').tests,
    config: read('config.json'),
    credentials: read('demo-credentials.json'),
  };
}

export function validatePack(pack) {
  const errors = [];
  const { dag, tags, questions, lessons, tests, config, credentials } = pack;
  const concepts = new Map((dag.concepts ?? []).map((c) => [c.id, c]));
  const tagIds = new Set(Object.keys(tags ?? {}));
  const qById = new Map();

  // DAG: unique ids, known prereqs/topics, acyclic.
  for (const c of dag.concepts ?? []) {
    for (const p of c.prerequisites ?? []) {
      if (!concepts.has(p)) errors.push(`dag: ${c.id} has unknown prerequisite ${p}`);
    }
    if (!c.topic_id) errors.push(`dag: ${c.id} missing topic_id`);
  }
  const state = new Map();
  const visit = (id, stack) => {
    state.set(id, 1);
    for (const p of concepts.get(id)?.prerequisites ?? []) {
      if (state.get(p) === 1) errors.push(`dag: cycle ${[...stack, p].join(' -> ')}`);
      else if (!state.get(p)) visit(p, [...stack, p]);
    }
    state.set(id, 2);
  };
  for (const id of concepts.keys()) if (!state.get(id)) visit(id, [id]);

  // Questions.
  if ((questions ?? []).length < 96) errors.push(`questions: need >= 96, found ${(questions ?? []).length}`);
  const perTopic = {};
  const practiceByTagLevel = {};
  const testTagTopics = {};
  for (const q of questions ?? []) {
    if (qById.has(q.id)) errors.push(`questions: duplicate id ${q.id}`);
    qById.set(q.id, q);
    if (!concepts.has(q.concept_id)) errors.push(`questions: ${q.id} unknown concept ${q.concept_id}`);
    const optIds = (q.options ?? []).map((o) => o.id);
    if (new Set(optIds).size !== optIds.length) errors.push(`questions: ${q.id} duplicate option ids`);
    const correct = optIds.filter((id) => id === q.correct_option_id);
    if (correct.length !== 1) errors.push(`questions: ${q.id} must have exactly one correct option`);
    perTopic[q.topic_id] = perTopic[q.topic_id] || { t: 0, p: 0 };
    perTopic[q.topic_id][q.is_practice ? 'p' : 't'] += 1;
    for (const [oid, pl] of Object.entries(q.payloads ?? {})) {
      if (!optIds.includes(oid)) errors.push(`questions: ${q.id} payload for unknown option ${oid}`);
      if (oid === q.correct_option_id) errors.push(`questions: ${q.id} correct option must have no payload`);
      if (!tagIds.has(pl.tag)) errors.push(`questions: ${q.id}/${oid} unknown tag ${pl.tag}`);
      if (!SEV.has(pl.severity)) errors.push(`questions: ${q.id}/${oid} bad severity ${pl.severity}`);
      if (!concepts.has(pl.concept_id)) errors.push(`questions: ${q.id}/${oid} unknown payload concept ${pl.concept_id}`);
      if (!(pl.explanation ?? '').trim()) errors.push(`questions: ${q.id}/${oid} empty explanation`);
      if (!(pl.student_note ?? '').trim()) errors.push(`questions: ${q.id}/${oid} empty student_note`);
      if (!q.is_practice) {
        testTagTopics[pl.tag] = testTagTopics[pl.tag] || new Set();
        testTagTopics[pl.tag].add(q.topic_id);
      } else {
        const k = `${pl.tag}|${q.practice_level}`;
        practiceByTagLevel[k] = (practiceByTagLevel[k] || 0) + 1;
      }
    }
    if (q.is_practice && !['L1', 'L2', 'L3'].includes(q.practice_level)) {
      errors.push(`questions: ${q.id} bad practice_level ${q.practice_level}`);
    }
    if (q.check) {
      try {
        const v = evalCheck(q.check.expr);
        if (Math.abs(v - q.check.expected) > (q.check.tol ?? 0.05)) {
          errors.push(`questions: ${q.id} check recompute ${v} != expected ${q.check.expected}`);
        }
      } catch (e) {
        errors.push(`questions: ${q.id} check failed: ${e.message}`);
      }
    }
  }
  for (const [t, c] of Object.entries(perTopic)) {
    if (c.t !== 10 || c.p < 6) errors.push(`questions: topic ${t} has ${c.t} test + ${c.p} practice (need 10 + >= 6)`);
  }
  const needTopics = { sign_convention: 4, implicit_condition: 3, arithmetic_slip: 6 };
  for (const [t, n] of Object.entries(needTopics)) {
    const got = testTagTopics[t]?.size ?? 0;
    if (got < n) errors.push(`questions: tag ${t} in ${got} topics, need >= ${n}`);
  }
  for (const t of ESCALATING) {
    const l1 = practiceByTagLevel[`${t}|L1`] ?? 0;
    const l2 = practiceByTagLevel[`${t}|L2`] ?? 0;
    if (l1 < 2 || l2 < 2) errors.push(`questions: escalating tag ${t} practice L1=${l1} L2=${l2} (need >= 2 each)`);
  }

  // Lessons for the 12 listed concepts.
  const needLessons = ['kin_sign_conventions', 'kin_const_accel', 'kin_implicit_conditions', 'opt_sign_convention', 'opt_mirror_lens', 'cur_series_parallel', 'cur_kirchhoff', 'thm_first_law', 'thm_heat_temperature', 'lom_friction', 'wep_conservation', 'units_and_dimensions'];
  const haveLessons = new Set((lessons ?? []).map((l) => l.concept_id));
  for (const id of needLessons) {
    if (!haveLessons.has(id)) errors.push(`lessons: missing full lesson for ${id}`);
    else {
      const l = lessons.find((x) => x.concept_id === id);
      if ((l.micro_lesson ?? []).length < 3) errors.push(`lessons: ${id} needs >= 3 micro blocks`);
      if (!l.worked_example || (l.reflect_options ?? []).length < 1) errors.push(`lessons: ${id} incomplete`);
    }
  }

  // Tests catalog: 6 deep + 8 summary; deep question refs exist.
  const deep = (tests ?? []).filter((t) => t.type === 'DEEP');
  const summ = (tests ?? []).filter((t) => t.type === 'SUMMARY');
  if (deep.length !== 6) errors.push(`tests: need 6 deep, found ${deep.length}`);
  if (summ.length !== 8) errors.push(`tests: need 8 summary, found ${summ.length}`);
  for (const t of deep) {
    if ((t.question_ids ?? []).length !== 10) errors.push(`tests: ${t.test_id} needs 10 questions`);
    for (const qid of t.question_ids ?? []) {
      const q = qById.get(qid);
      if (!q) errors.push(`tests: ${t.test_id} references unknown ${qid}`);
      else if (q.is_practice) errors.push(`tests: ${t.test_id} uses practice-only ${qid}`);
      else if (q.topic_id !== t.topic_id) errors.push(`tests: ${t.test_id} question ${qid} topic mismatch`);
    }
  }

  // Credentials: teacher + students 1..30 shortcut shape.
  if (credentials?.teacher?.id !== '1' || credentials?.teacher?.password !== '123') {
    errors.push('credentials: teacher 1/123 missing');
  }

  // Config keys the engine needs.
  for (const k of ['escalation_threshold', 'seg_accelerate_overall', 'seg_sign_count', 'planner_block_min', 'practice_len', 'time_fast', 'time_slow']) {
    if (config?.[k] == null) errors.push(`config: missing ${k}`);
  }
  return errors;
}
