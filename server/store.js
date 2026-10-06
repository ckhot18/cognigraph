// V2 in-memory store: tokens, overlays, sessions, paths, assignments + analytics cache.
import crypto from 'node:crypto';
import { loadDb } from './analytics/db.js';
import { studentProfile } from './analytics/studentProfile.js';
import { segmentStudent } from './analytics/segmenter.js';
import { cohortInsights } from './analytics/cohortInsights.js';

export function createStore(dataDir) {
  const db = loadDb(dataDir);
  const state = {
    db,
    tokens: new Map(), // token -> {role, id, name}
    overlays: new Map(), // student_id -> {practice: {concept: gain}}
    sessions: new Map(), // session_id -> practice session
    paths: new Map(), // student:concept -> path state
    assignments: [], // {assignment_id, ...}
    seq: 1,
    cache: { profiles: new Map(), segments: new Map(), cohort: new Map() },
  };
  recomputeAll(state);
  return state;
}

export function recomputeAll(state) {
  state.cache.profiles.clear();
  state.cache.segments.clear();
  state.cache.cohort.clear();
  for (const s of state.db.students) recomputeStudent(state, s.student_id);
  const scopes = ['ALL', ...state.db.pack.tests.filter((t) => t.type === 'DEEP').map((t) => t.id ?? t.test_id)];
  for (const scope of scopes) {
    state.cache.cohort.set(scope, cohortInsights(state.db, scope, overlaysOf(state)));
  }
}

export function overlaysOf(state) {
  const out = {};
  for (const [sid, ov] of state.overlays) out[sid] = ov;
  return out;
}

export function recomputeStudent(state, studentId) {
  const ov = state.overlays.get(studentId) ?? {};
  const profile = studentProfile(state.db, studentId, ov);
  const seg = segmentStudent(state.db, studentId, ov);
  state.cache.profiles.set(studentId, profile);
  state.cache.segments.set(studentId, { primary: seg.primary, secondary: seg.secondary });
  // refresh cohort scopes containing this student (cheap enough to redo all deep scopes)
  const scopes = ['ALL', ...state.db.pack.tests.filter((t) => t.type === 'DEEP').map((t) => t.id ?? t.test_id)];
  for (const scope of scopes) {
    state.cache.cohort.set(scope, cohortInsights(state.db, scope, overlaysOf(state)));
  }
  return { profile, seg };
}

export function issueToken(state, role, id, name) {
  const token = crypto.randomBytes(24).toString('hex');
  state.tokens.set(token, { role, id: String(id), name });
  return token;
}

export function resetStore(state) {
  state.tokens.clear();
  state.overlays.clear();
  state.sessions.clear();
  state.paths.clear();
  state.assignments = [];
  state.seq = 1;
  recomputeAll(state);
}
