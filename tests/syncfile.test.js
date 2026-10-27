import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { syncDecision, makeEnvelope, readEnvelope } from "../src/calc/syncfile.js";

test("one copy is the truth: write, load, nothing, or ask", () => {
  assert.equal(syncDecision({ base: 0 }, null), "push");
  assert.equal(syncDecision({ base: 0 }, { rev: 3 }), "conflict"); // never synced here: ask
  assert.equal(syncDecision({ base: 3, dirty: false }, { rev: 3 }), "same");
  assert.equal(syncDecision({ base: 3, dirty: true }, { rev: 3 }), "push");
  assert.equal(syncDecision({ base: 3, dirty: false }, { rev: 5 }), "pull");
  assert.equal(syncDecision({ base: 3, dirty: true }, { rev: 5 }), "conflict");
  assert.equal(syncDecision({ base: 6, dirty: true }, { rev: 5 }), "push");
});

test("the envelope shows only when, by whom and which revision", () => {
  const e = makeEnvelope({ rev: 2, savedAt: "2026-10-27T01:00:00Z", savedBy: "devA" }, { salt: "s", iv: "i", ciphertext: "c" });
  assert.deepEqual(Object.keys(e).sort(), ["ciphertext", "iv", "rev", "salt", "savedAt", "savedBy", "wealthPlannerSync"]);
  assert.deepEqual(readEnvelope(JSON.stringify(e)), e);
  assert.equal(readEnvelope("{}"), null); assert.equal(readEnvelope("not json"), null);
});

import { contentHash } from "../src/calc/syncfile.js";
test("a save that only stamps when it was saved, or a price check's bookkeeping, isn't a change", () => {
  const a = { income: [{ what: "Pay", amount: 100 }], savedAt: "x", savedBy: "d1", autoPrices: { lastRead: "2026-10-27" }, priceSheet: { url: "u", lastRead: "a", lastResult: {} } };
  const b = Object.assign({}, a, { savedAt: "y", savedBy: "d2", autoPrices: { lastRead: "2026-10-28" }, priceSheet: { url: "u", lastRead: "b", lastResult: null } });
  assert.equal(contentHash(a), contentHash(b));
  assert.notEqual(contentHash(a), contentHash(Object.assign({}, a, { income: [{ what: "Pay", amount: 101 }] })));
});
