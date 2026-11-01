# 0003 — The household's data lives in the browser; migrations are numbered steps

**Decided:** from the start; migrations as steps in v3.203 (item 235a), edits that say what they touched v3.204.

**Context.** A household's finances are private and the app has no server. Everything has to work offline, survive an
old save being opened by a new version, and be recoverable by the person alone.

**Decision.** `state` (in `src/state.js`) is the single source of truth, persisted to `localStorage` (debounced
`persist()`), backed up by the person as a file (optionally encrypted with Web Crypto), or synced through a file they
control (0012). `migrateState()` runs `MIGRATION_STEPS` — numbered, named, idempotent steps, in order, on every load.

**Consequences.**
- A new field or change of shape is a new step at the end, with a test from the shape before it in
  `tests/migrations.test.js` (the file fails if a step has no test).
- `state` is a live ES-module binding: replace it with `setState(newState)`, never `state = …`.
- An edit saves with `commit([...top-level keys it touched])`, which also redraws what reads them (0007). The ratchet
  in `npm run check` (`eslint-rules/ratchet.json`) counts bare `persist()` calls and direct writes into `state` per
  file; a file may not gain one, and when it loses one the baseline comes down (`node eslint-rules/ratchet.mjs --update`).
- How full localStorage is shows in Settings → Preferences and as a notification from 70% (`lib/storageuse.js`).
