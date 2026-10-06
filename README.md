# CogniGraph AI — Classroom Analytics Platform (V2)

[![CI](https://github.com/ckhot18/cognigraph/actions/workflows/ci.yml/badge.svg)](https://github.com/ckhot18/cognigraph/actions)

> Don't just grade. Bridge the gap. Raw test responses become understanding:
> per-student root-cause analysis, bridge plans, practice and guided learning —
> plus class analytics and a revision-lecture planner for the teacher.
> Deterministic, explainable, evidence-based. **Not a chatbot.**

Runs **fully offline with zero API keys**. No LLM on the critical path.
**Demo data throughout** — 30 fictional students, synthetic responses, demo-stub auth.

## Quickstart

```bash
npm ci
npm test          # 26 tests: pack, generator, analytics, API, copy-lint
npm run seed      # regenerate deterministic cohort (mulberry32 20261006)
npm run dev       # API :8787 + Vite :5173
```

Single-process fallback: `npm run build && npm start` (API + built client on `:8787`).

**Demo logins** (password `123` everywhere): students use IDs `1`–`30`;
teacher uses ID `1`. Role tabs keep the two `1`s apart. Shortcuts drawer on login
(Student 1 top performer · 5 sign gaps · 10 calc habits · 17 electricity gaps ·
29 fast guesser · Teacher). Keys `1–4` answer practice items.

## Architecture

```
responses.json (1800 rows) → analytics/ (pure, cached at startup)
  → Express API (token auth, role/ownership guards) → React portals
```

- `server/data/` — content pack (`dag.json` 26 concepts · `tags.json` 9 global tags ·
  `questions.json` 98 items with distractor payloads · `lessons.json` · `tests.json`
  6 deep + 8 summary · `config.json` all thresholds) + generated
  (`students/results/responses.json`, `demo-credentials.json`,
  `generator-expectations.json` test-only) — all committed, all validated.
- `server/analytics/` — mastery (slip-weighted, Laplace) · tag counting/redirect ·
  student EDA profile · segmenter (responses-only, 30/30 recovery) · recommender ·
  cohort insights · lecture planner.
- `server/engine/` — DAG utils, thresholds, practice engine, guided-path state
  machine, validators.
- `client/src/` — landing · auth · student (home, test 4-tab review, practice,
  guided paths, concept map) · teacher (overview, test analytics, roster,
  drill-down, lecture planner) · shared UI primitives (hand-rolled SVG charts).

## API (Bearer token; `{"error":{"code":...}}` shape)

`POST /api/auth/login|logout` · `GET /api/health` · `GET /api/content/dag|tests` ·
student: `me`, `me/tests`, `me/tests/:id`, `me/insights`, `me/bridge-plan`,
`practice/start|answer`, `learn/:conceptId`, `learn/:conceptId/advance` ·
teacher: `overview`, `tests/:id/analysis`, `students`, `students/:id`,
`lecture-plan?test_id=&minutes=&challenge=`, `assignments` (GET+POST) ·
`POST /api/admin/reset` (teacher).

## Demo walkthrough

Landing → Student 5 (sign-convention bridge across Kinematics + Optics) →
practice session (mastery meter warms) → Student 1 (stretch) → Teacher: class
overview → Kinematics test analytics (click a distractor, histogram filters) →
Lecture planner (switch 60→30 min) → assign bridge practice → show it in
Student 5's portal.

## Known limitations (honest framing)

1. Synthetic data everywhere, labelled "Demo data"; generator archetypes exist but
   analytics never reads them (proven by the ≥27/30 recovery test — currently 30/30).
2. Auth is a demo stub (in-memory tokens, plain passwords); production needs real
   identity, hashing, sessions, consent. No real PII.
3. Question content is **unreviewed by a subject expert** (`reviewed:false`);
   numeric answers are machine-checked, pedagogy is not.
4. Segments/thresholds are configurable heuristics, not diagnoses of people.
5. Practice overlay is engagement signal, never re-scores official tests.
6. Time flags are cautious signals ("may indicate rushing"), never accusations.
7. Rank shown as gentle percentile band only; no leaderboard, no named-peer comparison.
8. In-memory single-process state; restart resets everything (repeatable demo).
9. Remaining dev-only audit advisories (vite/esbuild chain); runtime chain clean.
10. Teacher scatter has no brush-select yet; matrix drill-through covers Alex→Case flow
    via roster links instead (roadmap).

## Deviations from the V2 doc (per operator override: same stack)

- **JS (ESM) + node:test kept** — no TypeScript/Vitest/Recharts/TanStack Query/Router/
  framer-motion/@fontsource. Charts are hand SVG, routing is hash-based, data
  fetching is plain fetch + micro-cache, motion is CSS on transform/opacity only.
  (A half-done TS scaffold from another session is stashed, not deleted:
  `git checkout feat/phase0-tooling && git stash pop` to inspect it.)
- `npm test` uses an explicit file list (CI pins Node 20/22; globs need Node 21+).
- Segmenter precedence refined (trend-strong → strong habits → topic lag with a
  25-point gap rule → standard habits → systemic clause) so listed must-pass
  segments win on realistic spreads; all bars live in `config.json`.
- Tags `v2.0.0-p3/p4/p8` + `v2.0.0` (v1 `v0.x` tags belong to the old line).
- Lecture grouping names stronger students by overall mastery; drill-down teacher
  notes persist per-device (localStorage), not server-side.

## Repo

- https://github.com/ckhot18/cognigraph · branch `main` · CI green
  (`npm ci && npm test && npm run build`) · 26 tests · tags through `v2.0.0`.
