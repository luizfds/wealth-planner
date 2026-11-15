import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readBackup, householdSummary, summaryIsEmpty, summaryText, restoreQuestion } from "../src/calc/restore.js";
import { defaultState } from "../src/state.js";

// #265: a backup is checked before it's offered as a replacement. Invented households.
const when = iso => iso.slice(0, 10);

test("a backup's lists must be lists, and it must migrate — checked without changing the file", () => {
  for(const bad of [null, [], "x", { home: {} }, { income: "x", home: "y" }, { income: [], home: [] }, { income: [], home: {}, transactions: {} }]){
    assert.equal(readBackup(bad).ok, false, JSON.stringify(bad));
  }
  assert.match(readBackup({ income: [], home: {}, transactions: {}, assets: 1 }).reason, /its transactions, assets aren't lists/);
  const file = { income: [{ what: "Pay", amount: 1, freq: "Monthly" }], home: {}, shared: [] };
  const was = JSON.stringify(file);
  const r = readBackup(file);
  assert.equal(r.ok, true);
  assert.equal(JSON.stringify(file), was, "the file itself isn't migrated");
  assert.ok(Array.isArray(r.household.recurringRules), "the copy is migrated as the app would load it");
  assert.equal(readBackup(JSON.parse(JSON.stringify(defaultState()))).ok, true);
});

test("what a household holds: computed rows aren't counted; an empty one says so", () => {
  const s = householdSummary({ savedAt: "2026-11-02T09:00:00Z", savedByName: "Sam", shared: [{}, {}], income: [{}, { computed: true }], transactions: [{}], accounts: [], assets: [{}], properties: [], debts: [], home: { Today: [{}] } });
  assert.deepEqual(s, { savedAt: "2026-11-02T09:00:00Z", savedBy: "Sam", budget: 2, income: 1, transactions: 1, accounts: 0, holdings: 1, properties: 0, debts: 0 });
  assert.equal(summaryText(s), "2 budget lines, 1 income row, 1 transaction, 1 asset");
  assert.equal(summaryIsEmpty(householdSummary({ income: [], home: {} })), true);
  assert.equal(summaryText(householdSummary({})), "nothing");
});

test("the question puts the backup beside this device, and names an older or empty backup", () => {
  const here = { savedAt: "2026-11-03T10:00:00Z", shared: [{}, {}, {}], income: [], home: {} };
  const backup = { savedAt: "2026-11-02T09:00:00Z", savedByName: "Alex", shared: [{}], income: [], home: {} };
  const q = restoreQuestion(backup, here, "here", when);
  assert.match(q.message, /OLDER/);
  assert.deepEqual(q.details.slice(0, 2), ["This backup, last changed 2026-11-02 by Alex: 1 budget line.", "This device, last changed 2026-11-03: 3 budget lines."]);
  assert.equal(q.empty, false);
  assert.match(restoreQuestion(backup, here, "incoming", when).message, /^Replace this device's household/);
  const e = restoreQuestion({ income: [], home: {} }, here, null, when);
  assert.equal(e.empty, true);
  assert.match(e.message, /This backup is empty/);
  assert.equal(e.details[0], "This backup: nothing.");
});
