// V2 Express API (spec §8). Token auth, role + ownership guards, cached analytics.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePack } from './engine/validatePack.js';
import { loadPack } from './engine/validatePack.js';
import { createStore, issueToken, resetStore, recomputeStudent, SHOWCASE } from './store.js';
import { bridgePlan } from './analytics/recommend.js';
import { planLecture } from './analytics/lecturePlanner.js';
import { startPractice, answerItem, publicItem } from './engine/practice.js';
import { startPath, advancePath, viewState } from './engine/guidedPath.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function err(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

export function createApp(dataDir) {
  const pack = loadPack(dataDir);
  const errors = validatePack(pack);
  if (errors.length > 0) throw new Error(`Pack validation failed:\n- ${errors.join('\n- ')}`);
  const store = createStore(dataDir);
  const db = store.db;
  const cfg = db.config;

  const app = express();
  app.use(express.json({ limit: '50kb', strict: true }));
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      // eslint-disable-next-line no-console
      console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });

  const creds = db.pack.credentials;
  const studentName = (id) => db.students.find((s) => s.student_id === String(id))?.name ?? `Student ${id}`;

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'cognigraph-ai', time: new Date().toISOString() });
  });

  // ---- auth ----
  app.post('/api/auth/login', (req, res) => {
    const { role, id, password } = req.body ?? {};
    if (role === 'teacher') {
      if (String(id) === String(creds.teacher.id) && password === creds.teacher.password) {
        const token = issueToken(store, 'teacher', id, creds.teacher.name);
        return res.json({ token, user: { role: 'teacher', id: String(id), name: creds.teacher.name } });
      }
      return err(res, 401, 'UNAUTHORIZED', 'Invalid teacher credentials.');
    }
    if (role === 'student') {
      const sid = String(id);
      if (!db.students.some((s) => s.student_id === sid)) return err(res, 401, 'UNAUTHORIZED', 'Unknown student id.');
      if (password !== (creds.default_password ?? '123')) return err(res, 401, 'UNAUTHORIZED', 'Invalid password.');
      const token = issueToken(store, 'student', sid, studentName(sid));
      return res.json({ token, user: { role: 'student', id: sid, name: studentName(sid) } });
    }
    return err(res, 400, 'BAD_REQUEST', 'role must be student or teacher.');
  });

  app.post('/api/auth/logout', requireAuth(store), (req, res) => {
    store.tokens.delete(req.token);
    res.json({ ok: true });
  });

  const auth = (role) => [requireAuth(store), requireRole(role)];

  // ---- content ----
  app.get('/api/content/dag', ...authAny(store), (req, res) => {
    const depth = {};
    const visit = (id) => {
      if (depth[id] != null) return depth[id];
      const c = db.dag.nodes.find((n) => n.id === id);
      const ps = c?.prerequisites ?? [];
      depth[id] = ps.length === 0 ? 0 : 1 + Math.max(...ps.map(visit));
      return depth[id];
    };
    const topics = db.pack.dag.topics ?? [];
    const tIdx = Object.fromEntries(topics.map((t, i) => [t.topic_id, i]));
    const concepts = db.dag.nodes.map((n, i) => {
      const d = visit(n.id);
      return { ...n, pos: { x: d * 170, y: (tIdx[n.topic_id] ?? 0) * 110 + (i % 5) * 14 } };
    });
    res.json({ topics, concepts, tags: db.pack.tags });
  });

  app.get('/api/content/tests', ...authAny(store), (req, res) => {
    let list = db.pack.tests;
    const { subject, type, search } = req.query;
    if (subject) list = list.filter((t) => t.subject === subject);
    if (type) list = list.filter((t) => t.type === type);
    if (search) list = list.filter((t) => t.title.toLowerCase().includes(String(search).toLowerCase()));
    res.json({ tests: list });
  });

  // ---- student ----
  app.get('/api/student/me', ...auth('student'), (req, res) => {
    const p = store.cache.profiles.get(req.user.id);
    const seg = store.cache.segments.get(req.user.id);
    res.json({ profile: stripHeavy(p), segment: seg.primary, secondary: seg.secondary });
  });

  app.get('/api/student/me/tests', ...auth('student'), (req, res) => {
    const sid = req.user.id;
    const rows = [...(db.resultsByStudent.get(sid) ?? [])].map((r) => {
      const t = db.tests.get(r.test_id);
      const peers = (r.score / r.max_score);
      void peers;
      const all = [];
      for (const s of db.students) {
        const rr = (db.resultsByStudent.get(s.student_id) ?? []).find((x) => x.test_id === r.test_id);
        if (rr) all.push(rr.score / rr.max_score);
      }
      all.sort((a, b) => a - b);
      const rank = all.filter((v) => v > r.score / r.max_score).length + 1;
      return {
        test_id: r.test_id, title: t?.title, subject: t?.subject, date: t?.date,
        type: t?.type, score: r.score, max_score: r.max_score,
        pct: Math.round((r.score / r.max_score) * 1000) / 10,
        rank, of: all.length, has_item_data: t?.type === 'DEEP',
      };
    }).sort((a, b) => b.date.localeCompare(a.date));
    res.json({ tests: rows });
  });

  app.get('/api/student/me/tests/:testId', ...auth('student'), (req, res) => {
    const t = db.tests.get(req.params.testId);
    if (!t) return err(res, 404, 'NOT_FOUND', `Unknown test "${req.params.testId}".`);
    if (t.type !== 'DEEP') {
      const r = (db.resultsByStudent.get(req.user.id) ?? []).find((x) => x.test_id === t.test_id);
      return res.json({ test_id: t.test_id, summary_only: true, score: r?.score ?? null, max_score: t.max_score });
    }
    const cards = (t.question_ids ?? []).map((qid) => {
      const q = db.questions.get(qid);
      const r = (db.byStudent.get(req.user.id) ?? []).find((x) => x.question_id === qid);
      const pl = r && !r.is_correct ? q.payloads[r.chosen_option_id] : null;
      return {
        question_id: qid, text: q.text, concept_id: q.concept_id,
        options: q.options.map((o) => ({ id: o.id, text: o.text })),
        chosen_option_id: r?.chosen_option_id ?? null,
        correct_option_id: q.correct_option_id,
        on_target: r ? r.is_correct : null,
        student_note: pl?.student_note ?? null,
        solution_steps: q.solution_steps ?? [],
        time_sec: r?.time_sec ?? null,
        expected_time_sec: q.expected_time_sec,
        tag: pl?.tag ?? null,
      };
    });
    res.json({ test_id: t.test_id, summary_only: false, cards });
  });

  app.get('/api/student/me/insights', ...auth('student'), (req, res) => {
    const p = store.cache.profiles.get(req.user.id);
    res.json({ insights: stripHeavy(p) });
  });

  app.get('/api/student/me/bridge-plan', ...auth('student'), (req, res) => {
    const ov = store.overlays.get(req.user.id) ?? {};
    const pristine = Object.keys(ov.practice ?? {}).length === 0;
    const plan = pristine && store.cache.plans.get(req.user.id)
      ? store.cache.plans.get(req.user.id)
      : bridgePlan(db, req.user.id, ov);
    const mine = store.assignments.filter((a) => a.student_ids.includes(req.user.id));
    res.json({ recommendations: plan.slice(0, 5), more: plan.slice(5), assignments: mine });
  });

  app.post('/api/student/practice/start', ...auth('student'), (req, res) => {
    try {
      const focus = req.body?.focus ?? {};
      const answered = new Set((db.byStudent.get(req.user.id) ?? []).map((r) => r.question_id));
      const prof = store.cache.profiles.get(req.user.id);
      const failedConcepts = new Set();
      for (const r of db.byStudent.get(req.user.id) ?? []) {
        if (!r.is_correct) failedConcepts.add(db.questions.get(r.question_id)?.concept_id);
      }
      const topics = Object.entries(prof?.topic_scores ?? {}).sort((a, b) => a[1] - b[1]);
      const context = {
        failedConcepts: [...failedConcepts].filter(Boolean),
        topTags: (prof?.tag_table ?? []).slice(0, 3).map((t) => t.tag),
        weakTopics: topics.slice(0, 2).map(([t]) => t),
        masteryMap: prof?.concept_mastery ?? {},
      };
      const { session, item } = startPractice(db, req.user.id, { tag: focus.tag ?? null, conceptId: focus.concept_id ?? null }, answered, context);
      const sid = `sess_${store.seq++}`;
      store.sessions.set(sid, { ...session, answeredGlobal: [...answered] });
      res.json({ session_id: sid, item, done: session.done });
    } catch (e) {
      return err(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
    }
  });

  app.post('/api/student/practice/answer', ...auth('student'), (req, res) => {
    try {
      const { session_id, question_id, answer_option_id } = req.body ?? {};
      const sess = store.sessions.get(session_id);
      if (!sess || sess.student_id !== req.user.id) return err(res, 404, 'NOT_FOUND', 'Unknown session.');
      const ov = store.overlays.get(req.user.id) ?? {};
      const out = answerItem(db, sess, question_id, answer_option_id, ov.practice ?? {}, new Set(sess.answeredGlobal));
      ov.practice = out.overlay;
      store.overlays.set(req.user.id, ov);
      // assignment progress follows the practice focus (never auto-finishes otherwise)
      for (const a of store.assignments) {
        if (!a.student_ids.includes(req.user.id) || a.kind !== 'PRACTICE') continue;
        const f = a.focus ?? {};
        const match = (!f.tag && !f.concept_id) || f.tag === sess.focusTag || (f.concept_id && f.concept_id === sess.focusConcept);
        if (!match) continue;
        if (out.done && a.status[req.user.id] !== 'DONE') a.status[req.user.id] = 'DONE';
        else if (a.status[req.user.id] === 'ASSIGNED') a.status[req.user.id] = 'IN_PROGRESS';
      }
      recomputeStudent(store, req.user.id);
      res.json(out);
    } catch (e) {
      if (e?.code) return err(res, e.code === 'NOT_FOUND' ? 404 : 400, e.code, e.message);
      return err(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
    }
  });

  app.get('/api/student/learn/:conceptId', ...auth('student'), (req, res) => {
    const key = `${req.user.id}:${req.params.conceptId}`;
    const answered = new Set((db.byStudent.get(req.user.id) ?? []).map((r) => r.question_id));
    if (!store.paths.has(key)) {
      const { state, view } = startPath(db, req.user.id, req.params.conceptId, answered);
      store.paths.set(key, state);
      return res.json({ state: state, view });
    }
    const st = store.paths.get(key);
    return res.json({ state: st, view: viewState(db, st) });
  });

  app.post('/api/student/learn/:conceptId/advance', ...auth('student'), (req, res) => {
    const key = `${req.user.id}:${req.params.conceptId}`;
    const st = store.paths.get(key);
    if (!st) return err(res, 404, 'NOT_FOUND', 'Start the path first.');
    const out = advancePath(db, st, req.body ?? {});
    if (out.overlayGain) {
      const ov = store.overlays.get(req.user.id) ?? {};
      ov.practice = ov.practice ?? {};
      ov.practice[st.concept_id] = Math.min(0.95, (ov.practice[st.concept_id] ?? 0) + out.overlayGain);
      store.overlays.set(req.user.id, ov);
      recomputeStudent(store, req.user.id);
    }
    res.json({ state: st, view: out.view, overlayGain: out.overlayGain ?? 0 });
  });

  // ---- teacher ----
  app.get('/api/teacher/overview', ...auth('teacher'), (req, res) => {
    const ci = store.cache.cohort.get('ALL');
    const avgs = ci.students.map((s) => s.acc);
    const avg = avgs.reduce((a, b) => a + b, 0) / Math.max(1, avgs.length);
    res.json({
      total_students: db.students.length,
      class_average: Math.round(avg * 1000) / 10,
      segments: ci.segments,
      trend: classTrend(db),
      needs_attention: needsAttention(store),
      top_gaps: Object.entries(ci.tag_prevalence).sort((a, b) => b[1].students - a[1].students).slice(0, 5).map(([tag, v]) => ({ tag, students: v.students })),
    });
  });

  app.get('/api/teacher/tests/:testId/analysis', ...auth('teacher'), (req, res) => {
    if (req.params.testId !== 'ALL' && !db.tests.get(req.params.testId)) {
      return err(res, 404, 'NOT_FOUND', `Unknown test "${req.params.testId}".`);
    }
    res.json(store.cache.cohort.get(req.params.testId) ?? store.cache.cohort.get('ALL'));
  });

  app.get('/api/teacher/students', ...auth('teacher'), (req, res) => {
    res.json({
      students: db.students.map((s) => {
        const p = store.cache.profiles.get(s.student_id);
        const seg = store.cache.segments.get(s.student_id);
        return { student_id: s.student_id, name: s.name, overall: p.overall, trend: p.trend, segment: seg.primary, secondary: seg.secondary };
      }),
    });
  });

  app.get('/api/teacher/students/:id', ...auth('teacher'), (req, res) => {
    const p = store.cache.profiles.get(req.params.id);
    if (!p) return err(res, 404, 'NOT_FOUND', `Unknown student "${req.params.id}".`);
    const seg = store.cache.segments.get(req.params.id);
    const who = db.students.find((s) => s.student_id === req.params.id);
    res.json({ name: who?.name ?? req.params.id, profile: p, segment: seg.primary, secondary: seg.secondary, teacher_extras: teacherExtras(store, req.params.id) });
  });

  app.get('/api/teacher/lecture-plan', ...auth('teacher'), (req, res) => {
    const minutes = Number(req.query.minutes ?? 60);
    if (![30, 45, 60, 90].includes(minutes)) return err(res, 400, 'BAD_REQUEST', 'minutes must be 30, 45, 60 or 90.');
    const test_id = req.query.test_id ?? 'ALL';
    if (test_id !== 'ALL' && !db.tests.get(test_id)) return err(res, 404, 'NOT_FOUND', `Unknown test "${test_id}".`);
    res.json(planLecture(db, { test_id, minutes, include_challenge: req.query.challenge === '1' || req.query.challenge === 'true', overlayByStudent: overlaysOfStore(store) }));
  });

  app.post('/api/teacher/assignments', ...auth('teacher'), (req, res) => {
    const { kind, focus, note, student_ids, segment } = req.body ?? {};
    if (!['PRACTICE', 'LESSON'].includes(kind)) return err(res, 400, 'BAD_REQUEST', 'kind must be PRACTICE or LESSON.');
    let ids = Array.isArray(student_ids) ? student_ids.map(String) : [];
    if (segment) {
      ids = db.students.filter((s) => store.cache.segments.get(s.student_id)?.primary === segment).map((s) => s.student_id);
    }
    ids = ids.filter((id) => db.students.some((s) => s.student_id === id));
    if (ids.length === 0) return err(res, 400, 'BAD_REQUEST', 'No valid students targeted.');
    const a = {
      assignment_id: `asg_${store.seq++}`, teacher_id: req.user.id, kind,
      focus: focus ?? {}, note: note ?? '', student_ids: ids,
      created_at: new Date().toISOString(), status: Object.fromEntries(ids.map((id) => [id, 'ASSIGNED'])),
    };
    store.assignments.push(a);
    res.json(a);
  });

  app.get('/api/teacher/assignments', ...auth('teacher'), (req, res) => {
    res.json({ assignments: store.assignments });
  });

  app.post('/api/admin/reset', ...auth('teacher'), (req, res) => {
    resetStore(store);
    res.json({ ok: true, students: db.students.length });
  });

  app.use('/api', (req, res) => {
    err(res, 404, 'NOT_FOUND', `Unknown API route: ${req.method} ${req.path}`);
  });

  const distDir = path.join(__dirname, '..', 'client', 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    if (error && (error.type === 'entity.parse.failed' || error instanceof SyntaxError)) {
      return err(res, 400, 'BAD_REQUEST', 'Malformed JSON body.');
    }
    if (error && error.type === 'entity.too.large') {
      return err(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds 50 kb.');
    }
    return err(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  });

  return app;
}

function requireAuth(store) {
  return (req, res, next) => {
    const h = req.headers.authorization ?? '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    const user = token ? store.tokens.get(token) : null;
    if (!user) return err(res, 401, 'UNAUTHORIZED', 'Missing or invalid token.');
    req.user = user;
    req.token = token;
    next();
  };
}

function authAny(store) {
  return [requireAuth(store)];
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) return err(res, 403, 'FORBIDDEN', `${role} role required.`);
    // ownership: students act only on their own data
    if (role === 'student') {
      const target = req.params.id ?? req.body?.student_id;
      if (target && String(target) !== req.user.id) {
        return err(res, 403, 'FORBIDDEN', 'Students may only access their own data.');
      }
    }
    next();
  };
}

function stripHeavy(p) {
  return p;
}

export { stripHeavy };

function classTrend(db) {
  const tests = [...db.pack.tests].sort((a, b) => a.date.localeCompare(b.date));
  return tests.map((t) => {
    const rs = [];
    for (const s of db.students) {
      const r = (db.resultsByStudent.get(s.student_id) ?? []).find((x) => x.test_id === (t.id ?? t.test_id));
      if (r) rs.push(r.score / r.max_score);
    }
    return { test_id: t.id ?? t.test_id, title: t.title, avg: rs.length ? Math.round((rs.reduce((a, b) => a + b, 0) / rs.length) * 1000) / 10 : null };
  });
}

function needsAttention(store) {
  const out = [];
  for (const s of store.db.students) {
    const seg = store.cache.segments.get(s.student_id);
    if (['NEEDS_STRONG_SUPPORT', 'GUESSING_PATTERN'].includes(seg.primary) || seg.secondary.includes('DECLINING')) {
      const p = store.cache.profiles.get(s.student_id);
      out.push({ student_id: s.student_id, name: s.name, segment: seg.primary, overall: p.overall, trend: p.trend });
    }
  }
  return out;
}

function teacherExtras(store, studentId) {
  const p = store.cache.profiles.get(studentId);
  const roots = [];
  for (const t of p.tag_table.filter((x) => x.severity === 'SYSTEMIC_MISCONCEPTION')) {
    roots.push({ tag: t.tag, count: t.count });
  }
  const bridge = store.assignments.filter((a) => a.student_ids.includes(studentId));
  return { systemic_roots: roots, bridge_assignments: bridge.length, recent_bridge: bridge.slice(-2) };
}

function overlaysOfStore(store) {
  const out = {};
  for (const [sid, ov] of store.overlays) out[sid] = ov;
  return out;
}
