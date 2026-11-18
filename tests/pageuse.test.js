import test from "node:test";
import assert from "node:assert/strict";
import { readUse, recordView, clearUse, rarelyOpened, USE_KEY } from "../src/lib/pageuse.js";
import { defaultState } from "../src/state.js";

function memory(){ var m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, m }; }

// #426: a count of which screens get opened, on this device only.
test("counts each screen, remembers when counting began, and clears", () => {
  const s = memory();
  recordView("expenses/spending", "2026-01-01", s);
  recordView("expenses/spending", "2026-01-02", s);
  recordView("tax/returns", "2026-01-03", s);
  assert.deepEqual(readUse(s), { since: "2026-01-01", views: { "expenses/spending": 2, "tax/returns": 1 } });
  clearUse(s);
  assert.deepEqual(readUse(s), { since: null, views: {} });
});

test("a damaged entry reads as nothing counted", () => {
  const s = memory();
  s.setItem(USE_KEY, "{not json");
  assert.deepEqual(readUse(s), { since: null, views: {} });
  s.setItem(USE_KEY, JSON.stringify({ views: 3 }));
  assert.deepEqual(readUse(s), { since: null, views: {} });
});

test("rarely opened says nothing until enough is counted, then names the screens opened least", () => {
  const known = [{ key: "expenses/spending", label: "Spending" }, { key: "tax/returns", label: "Tax returns" }, { key: "plan/retirement", label: "Retirement" }];
  assert.equal(rarelyOpened(known, { views: { "expenses/spending": 10 } }), null);
  const rare = rarelyOpened(known, { views: { "expenses/spending": 60, "tax/returns": 1 } }, { atMost: 1 });
  assert.deepEqual(rare.map(k => k.label), ["Tax returns", "Retirement"]);
});

test("it is never part of the household: not in state, so never synced or in a backup", () => {
  assert.equal(USE_KEY.startsWith("wealthPlanner."), true);
  assert.equal(Object.keys(defaultState()).some(k => /use|pageuse/i.test(k)), false);
});
