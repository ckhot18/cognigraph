// Shared pack loader + indexes for analytics (V2). Pure data assembly, no inference.
import { loadPack } from '../engine/validatePack.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');

const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));

/** Normalize v2 payload severity to the engine's canonical names. */
export function normSev(s) {
  if (s === 'PARTIAL') return 'PARTIAL_MENTAL_MODEL';
  if (s === 'SYSTEMIC') return 'SYSTEMIC_MISCONCEPTION';
  return s; // SLIP
}

export function loadDb(dir = DATA) {
  const r = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const pack = loadPack(dir);
  const students = r('students.json').students;
  const results = r('results.json').results;
  const responses = r('responses.json').responses;
  const questions = new Map(pack.questions.map((q) => [q.id, q]));
  const tests = new Map(pack.tests.map((t) => [t.id ?? t.test_id, t]));
  const byStudent = new Map();
  for (const resp of responses) {
    if (!byStudent.has(resp.student_id)) byStudent.set(resp.student_id, []);
    byStudent.get(resp.student_id).push(resp);
  }
  const resultsByStudent = new Map();
  for (const res of results) {
    if (!resultsByStudent.has(res.student_id)) resultsByStudent.set(res.student_id, []);
    resultsByStudent.get(res.student_id).push(res);
  }
  // dag.json concepts -> v1 engine node shape (reuse traversal + node states).
  const dagNodes = pack.dag.concepts.map((c) => ({
    id: c.id, title: c.title, description: c.description,
    prerequisites: c.prerequisites ?? [], mastery_threshold: c.mastery_threshold ?? 0.75,
    tier: c.tier === 'acceleration' ? 'acceleration' : 'core',
    topic_id: c.topic_id,
  }));
  const dag = { nodes: dagNodes, tags: {} };
  return { pack, config: pack.config, students, results, responses, questions, tests, byStudent, resultsByStudent, dag, read };
}

export { read };
