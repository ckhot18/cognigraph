# Architecture

## Data flow

```
Preset → (client) POST /api/analyze-submission → analyze.js (pure) → JSON report → React render
```

State mutates only via `commit: true` or `/api/bridge-gap`. All thresholds
live in `server/data/config.json`. The engine is deterministic and runs fully
offline from local JSON.

```
┌────────────┐   POST /api/analyze-submission    ┌─────────────────────────┐
│  PresetBar │ ── {student_id, submission, ────▶ │ analyzeSubmission()     │
│  + Working │    commit}                        │  (pure, no store access)│
└────────────┘                                   └────────┬────────────────┘
                                                          │ report +
                                                          │ next_failures
                          ┌───────────────────────────────┴────────────────┐
                          ▼                                                ▼
                 commit:false → display only              commit:true → store applies
                 (repeatable demo, tests)                  next_failures + blocked_root
                                                                           │
┌────────────┐   POST /api/bridge-gap                     ┌────────────────▼───────────────┐
│ Bridge     │ ── {student_id, drill_id, ───────────────▶ │ evaluateBridge() → store      │
│ Widget     │    answer_option_id}        correct? reset │ (failures→0, node→MASTERED,    │
└────────────┘           failures, unblock, recompute    │  descendants recomputed)       │
                                                         └────────────────────────────────┘
```

## Engine decision table

`c` = failure count including the current failure · `T` = `escalation_threshold` (3).

| Condition | Severity | Roadmap action |
|---|---|---|
| `c >= T`, escalating tag | SYSTEMIC_MISCONCEPTION | PREREQUISITE_REDIRECT (root → BLOCKED_NEED_ROOT, descendants → LOCKED) |
| `c == T-1`, escalating tag | PARTIAL_MENTAL_MODEL | TARGETED_DRILL |
| `c < T-1`, escalating tag | SLIP (payload may raise → PARTIAL) | HINT_ONLY |
| any `c`, `escalates: false` | SLIP (capped) | HINT_ONLY |
| payload SYSTEMIC but `c < T` | kept below SYSTEMIC | `suspected_systemic: true`, monitoring |
| all correct + score > 85 + no gaps + avg ≤ 45 s | — | UNLOCK_ACCELERATION |

## Module map

- `dag.js` — ancestors / descendants / topo order / `lowestUnmasteredAncestor` + audit trace
- `matcher.js` — normalize → numeric (±0.05) → rubric (`any_of`/`all_of`/`none_of`);
  confidence 0.94 agree / 0.78 one signal / 0.30 UNCLASSIFIED; MCQ-only → 1.0
- `thresholds.js` — `countSeverity` / `effectiveSeverity` / `roadmapAction` / `badgeFor`
- `nodeStates.js` — BLOCKED_NEED_ROOT / LOCKED / IN_PROGRESS / MASTERED / ACCELERATED
- `analyze.js` — pure orchestrator; single-question + session modes; strips drill answers
- `bridge.js` — drill grading + failure reset + unblock + recompute
- `cohort.js` — clusters (primary error tag / ACCELERATED status), distribution, matrix colors
- `validate.js` — 7 data-integrity rule groups; runs at startup + in tests
- `config.js` — loads `config.json` (no magic numbers in code)
- `store.js` — in-memory Map, seeded from presets + cohort; `POST /api/reset` re-seeds
