# Architecture (placeholder — full diagram lands in Phase 6)

Data flow (spec section 4):

```
Preset → (client) POST /api/analyze-submission → analyze.js (pure) → JSON report → React render
```

State mutates only via `commit: true` or `/api/bridge-gap`. All thresholds
live in `server/data/config.json`. The engine is deterministic and runs fully
offline from local JSON.
