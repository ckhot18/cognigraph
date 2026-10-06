// Express app: routes, input guards, JSON errors (spec section 6).
// No side effects on import (safe for tests); server/index.js listens.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData, assertValidData, validateAll } from './engine/validate.js';
import { loadConfig } from './engine/config.js';
import { analyzeSubmission, publicDrill } from './engine/analyze.js';
import { evaluateBridge } from './engine/bridge.js';
import { computeCohort } from './engine/cohort.js';
import { buildGraph } from './engine/dag.js';
import { computeNodeStates } from './engine/nodeStates.js';
import * as store from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function err(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function codedStatus(code) {
  if (code === 'NOT_FOUND') return 404;
  if (code === 'BAD_REQUEST') return 400;
  if (code === 'PAYLOAD_TOO_LARGE') return 413;
  return 500;
}

export function createApp(dataDir) {
  // Fail fast on bad data (spec 5.8).
  assertValidData(dataDir);
  const data = loadData(dataDir);
  const cfg = loadConfig(dataDir);
  const graph = buildGraph(data.dag);
  store.seedStore(data);

  const app = express();
  app.use(express.json({ limit: '50kb', strict: true }));

  // Tiny request logger: method path status ms. No payload logging (spec 13.14).
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      // eslint-disable-next-line no-console
      console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'cognigraph-ai', time: new Date().toISOString() });
  });

  app.get('/api/presets', (req, res) => {
    res.json({
      presets: data.presets.presets.map((p) => ({ preset_id: p.preset_id, label: p.label })),
    });
  });

  app.get('/api/presets/:id', (req, res) => {
    const p = data.presets.presets.find((x) => x.preset_id === req.params.id);
    if (!p) return err(res, 404, 'NOT_FOUND', `Unknown preset "${req.params.id}".`);
    const qids =
      p.submission.mode === 'session'
        ? p.submission.attempts.map((a) => a.question_id)
        : [p.submission.question_id];
    const questions = qids.map((qid) => {
      const q = data.quiz.questions.find((x) => x.question_id === qid);
      return {
        question_id: q.question_id,
        target_node: q.target_node,
        prompt: q.prompt,
        // Payloads stay server-side: options carry id + text only.
        options: q.options.map((o) => ({ id: o.id, text: o.text })),
        correct_option_id: undefined,
        expected_time_sec: q.expected_time_sec,
      };
    });
    res.json({
      preset_id: p.preset_id,
      label: p.label,
      student: p.student,
      overall_mastery: p.overall_mastery,
      node_mastery: p.node_mastery,
      submission: p.submission,
      questions,
    });
  });

  app.get('/api/dag', (req, res) => {
    const edges = [];
    for (const n of data.dag.nodes) {
      for (const p of n.prerequisites ?? []) edges.push({ from: p, to: n.id });
    }
    res.json({ nodes: data.dag.nodes, edges, tags: data.dag.tags });
  });

  app.post('/api/analyze-submission', (req, res) => {
    try {
      const { student_id, submission, commit = false, assessment_id } = req.body ?? {};
      if (!student_id || typeof student_id !== 'string') {
        return err(res, 400, 'BAD_REQUEST', 'student_id (string) is required.');
      }
      if (!submission || typeof submission !== 'object' || !submission.mode) {
        return err(res, 400, 'BAD_REQUEST', 'submission with a valid mode is required.');
      }
      const st = store.getStudent(student_id);
      if (!st) return err(res, 404, 'NOT_FOUND', `Unknown student_id "${student_id}".`);
      const wt = submission.working_text;
      if (typeof wt === 'string' && wt.length > (cfg.max_working_text_chars ?? 2000)) {
        return err(res, 400, 'BAD_REQUEST', `working_text exceeds ${cfg.max_working_text_chars ?? 2000} chars.`);
      }
      const report = analyzeSubmission(
        {
          profile: {
            student_id,
            name: st.profile.name,
            overall_mastery: st.profile.overall_mastery,
            node_mastery: st.node_mastery,
            prior_failures: st.failures,
          },
          submission,
          assessment_id,
          commit: commit === true,
        },
        { dag: data.dag, quiz: data.quiz, drills: data.drills },
        cfg,
      );
      if (commit === true) {
        store.setStudentState(student_id, {
          profile: st.profile,
          node_mastery: st.node_mastery,
          failures: report.next_failures,
          blocked_root: report.root_prerequisite_blocked ?? st.blocked_root,
          bridge_attempts: st.bridge_attempts,
        });
      }
      const { next_failures, ...publicReport } = report;
      res.json(publicReport);
    } catch (e) {
      if (e && e.code) return err(res, codedStatus(e.code), e.code, e.message);
      return err(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
    }
  });

  app.get('/api/student-roadmap', (req, res) => {
    const id = req.query.student_id;
    if (!id || typeof id !== 'string') {
      return err(res, 400, 'BAD_REQUEST', 'student_id query param is required.');
    }
    const st = store.getStudent(id);
    if (!st) return err(res, 404, 'NOT_FOUND', `Unknown student_id "${id}".`);
    const node_states = computeNodeStates(graph, data.dag, st.node_mastery, {
      blockedRoot: st.blocked_root,
      warningNodes: new Set(),
    });
    const roadmap = st.blocked_root
      ? [
          { step: 1, node: st.blocked_root, action: 'REVISE', title: 'Revise blocked prerequisite' },
          { step: 2, node: st.blocked_root, action: 'RETEST', title: 'Pass the bridge drill' },
          { step: 3, node: st.blocked_root, action: 'RESUME', title: 'Resume downstream topics' },
        ]
      : [{ step: 1, node: 'scalar_variables', action: 'CONTINUE', title: 'Continue to the next topic' }];
    res.json({
      student_id: id,
      overall_mastery: st.profile.overall_mastery,
      node_states,
      blocked_root: st.blocked_root,
      roadmap,
    });
  });

  app.post('/api/bridge-gap', (req, res) => {
    try {
      const { student_id, drill_id, answer_option_id } = req.body ?? {};
      if (!student_id || !drill_id || !answer_option_id) {
        return err(res, 400, 'BAD_REQUEST', 'student_id, drill_id and answer_option_id are required.');
      }
      const st = store.getStudent(student_id);
      if (!st) return err(res, 404, 'NOT_FOUND', `Unknown student_id "${student_id}".`);
      const { state, result } = evaluateBridge(
        {
          failures: st.failures,
          node_mastery: st.node_mastery,
          blocked_root: st.blocked_root,
          bridge_attempts: st.bridge_attempts,
        },
        drill_id,
        answer_option_id,
        { dag: data.dag, drills: data.drills },
      );
      store.setStudentState(student_id, {
        profile: st.profile,
        node_mastery: state.node_mastery,
        failures: state.failures,
        blocked_root: state.blocked_root,
        bridge_attempts: state.bridge_attempts,
      });
      res.json({ student_id, drill_id, ...result });
    } catch (e) {
      if (e && e.code) return err(res, codedStatus(e.code), e.code, e.message);
      return err(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
    }
  });

  app.get('/api/teacher-cohort', (req, res) => {
    res.json(computeCohort({ dag: data.dag, cohort: data.cohort }, cfg, store.getInterventions()));
  });

  app.post('/api/teacher-intervention', (req, res) => {
    const { cluster_id, action_type } = req.body ?? {};
    if (!cluster_id || !action_type) {
      return err(res, 400, 'BAD_REQUEST', 'cluster_id and action_type are required.');
    }
    const cohort = computeCohort({ dag: data.dag, cohort: data.cohort }, cfg);
    const cluster = cohort.misconception_clusters.find((c) => c.cluster_id === cluster_id);
    if (!cluster) return err(res, 404, 'NOT_FOUND', `Unknown cluster_id "${cluster_id}".`);
    const valid = cluster.one_click_actions.some((a) => a.action_type === action_type);
    if (!valid) return err(res, 400, 'BAD_REQUEST', `action_type "${action_type}" is not valid for cluster "${cluster_id}".`);
    const def = data.interventions[action_type];
    if (!def) return err(res, 400, 'BAD_REQUEST', `Unknown action_type "${action_type}".`);
    store.recordIntervention(cluster_id, {
      status: 'DEPLOYED',
      action_type,
      affected_student_count: cluster.affected_student_count,
      deployed_at: new Date().toISOString(),
    });
    res.json({
      status: 'DEPLOYED',
      cluster_id,
      action_type,
      affected_student_count: cluster.affected_student_count,
      message: `${def.title} deployed to ${cluster.affected_student_count} students.`,
      payload: def.content,
    });
  });

  // Undo a teacher intervention (supports the Undo toast; P1 extra in spec 10).
  app.delete('/api/teacher-intervention', (req, res) => {
    const { cluster_id } = req.body ?? {};
    if (!cluster_id) return err(res, 400, 'BAD_REQUEST', 'cluster_id is required.');
    store.clearIntervention(cluster_id);
    res.json({ status: 'UNDONE', cluster_id });
  });

  app.post('/api/reset', (req, res) => {
    const n = store.seedStore(data);
    res.json({ ok: true, students: n });
  });

  // Unknown /api routes -> JSON 404 (never HTML, never a stack trace).
  app.use('/api', (req, res) => {
    err(res, 404, 'NOT_FOUND', `Unknown API route: ${req.method} ${req.path}`);
  });

  // Single-process demo fallback: serve built client from :8787.
  const distDir = path.join(__dirname, '..', 'client', 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // Malformed JSON / oversize body -> standard error shape.
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

export { validateAll, publicDrill };
