# Authoring guide (placeholder — full guide lands in Phase 6)

To add a question, a tag, a node, or a whole new domain:

1. Add the node(s) to `server/data/kinematics_dag.json` (keep it acyclic).
2. Register any new remediation tag in the `tags` registry (`node` + `escalates`).
3. Add the question + distractor payloads to `server/data/quiz_bank.json`.
4. Add a drill for every `escalates: true` tag in `server/data/drills.json`.
5. Run `npm test` — `validate.js` rejects bad references with a readable error.

Moving to a new domain = a new DAG + distractor bank; the engine is unchanged.
