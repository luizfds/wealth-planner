# 0012 — Sync, receipts and the activity log without a server

**Decided:** sync v3.134/v3.136 (three-way merge v3.143); receipts v3.170; activity v3.171.

**Decision.**
- **Sync** is one encrypted file (`calc/syncfile.js` decides load / write / ask), written through a folder the person
  chose or the app's own Dropbox folder (OAuth PKCE). A conflict is merged three ways (`calc/syncmerge.js`) against the
  last agreed copy (IndexedDB); only the same thing changed on both devices is asked about. Per-device sync memory and
  tokens stay in localStorage, never in `state`.
- **Receipts** are files in IndexedDB (`lib/receipts.js`); rows carry `receipts: [{ id, name, type, size }]`. Backup,
  share, the backup folder and the sync file pack them as `receiptFiles`; every load path unpacks them before
  `setState`. A new array of rows that can hold receipts goes in `receiptRefs`, or its files are pruned at startup.
- **Who changed what:** `lib/activity.js` diffs the data after a save (only if the page was touched) and logs
  `state.activity` (90 days, size-capped, synced). Every `setState` resets the baseline (`onStateReplaced`), so loads
  aren't logged. A new view setting or bookkeeping key goes in `calc/activity.js`'s SKIP, or it shows as somebody's edit.
- **Prices** come from the app's own site: `prices/latest.json` and `weekly.json`, rewritten each weekday by
  `.github/workflows/prices.yml` over a fixed public ticker list (0004).
