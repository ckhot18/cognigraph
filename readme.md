# CogniGraph AI

> Knowledge-graph misconception diagnostics for physics kinematics.
> Scores say *what*; CogniGraph finds *why* — deterministically, explainably, auditably.

**Status:** Phase 0 scaffold. Engine, API and dashboards land in Phases 1–6
(see `docs/ARCHITECTURE.md`). The app runs fully offline with zero API keys.

## Quickstart

```bash
npm ci
npm test
npm run dev      # API :8787 + Vite :5173
```

Production single-process fallback:

```bash
npm run build
npm start        # serves API + built client on :8787
```

## Layout

- `server/` — Express API + deterministic diagnostic engine (local JSON only)
- `client/` — React 18 + Vite 5 + Tailwind CSS 3.4
- `docs/` — architecture + authoring guide

## CI

GitHub Actions runs `npm ci && npm test && npm run build` on `main`.
