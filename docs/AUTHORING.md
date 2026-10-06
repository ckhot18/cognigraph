# Authoring guide

How to add a question, a tag, a node, or a whole new domain. The engine is
data-driven: no engine code changes are needed — only JSON.

## Add a question

1. Append to `server/data/quiz_bank.json`: `question_id`, `target_node` (must exist),
   `prompt`, `options[]` (unique ids, exactly one `correct_option_id`), `expected_time_sec`.
2. Every **wrong** option needs a payload: `error_type`, `remediation_tag` (must be in the
   tag registry), `severity` (`NONE|SLIP|PARTIAL_MENTAL_MODEL|SYSTEMIC_MISCONCEPTION`),
   non-empty `explanation`, and `numeric` (the option's value, or `null` for "cannot be
   determined" style options) for the free-text numeric stage.
3. The correct option needs a payload too (`severity: "NONE"`).
4. Add `rubric.patterns[]` for free-text matching: `{option_id, any_of[], all_of[], none_of[],
   evidence_template, evidence_pattern}`. Regexes run against both spaced and compact
   (whitespace-stripped) normalizations. Keep patterns narrow — first match wins.
5. Run `npm test` — `validate.js` rejects bad references with a readable error list.

## Add a remediation tag

1. Register it in `kinematics_dag.json → tags`: `{node, escalates, label}`.
   `node: null` + `escalates: false` marks a never-escalating slip (e.g. arithmetic).
2. If `escalates: true`, add at least one drill in `drills.json` for the tag
   (the validator enforces this).
3. Add a hint line for the tag in `server/engine/analyze.js → HINTS`.

## Add a DAG node

1. Append to `kinematics_dag.json → nodes`: `id`, `title`, `description`,
   `prerequisites[]` (must exist, must stay acyclic), `mastery_threshold`,
   `tier` (`core` | `acceleration`), `pos` (`{x, y}` on the 760×300 canvas).
2. Check the SVG still fits (`client/src/student/DagMap.jsx` uses fixed coordinates).

## Add a whole new domain (e.g. C++ pointers)

1. Copy the six data files with new nodes/tags/questions/drills/presets.
2. Regenerate or hand-write the cohort file (30 students, groups matching your clusters).
3. Point `validate.js`/`cohort.js` at the new files (or swap the `data/` directory).
4. No engine changes: matching, thresholds, traversal, and clustering are domain-agnostic.
   Effort is authoring effort — a reviewed distractor bank per misconception — not code.

## Regenerate the cohort

```bash
npm run seed   # mulberry32(1729); tunes last-of-group ±1–3 until mean rounds to 68
```

`validate.js` check 7 enforces 30 students, unique ids, full 6-node mastery, and group
counts 12/6/4/5/3 as derived by the same primary-tag rule `cohort.js` uses.
