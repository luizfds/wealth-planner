import test from "node:test";
import assert from "node:assert/strict";
import { mergeStates, valueText, sectionLabel } from "../src/calc/syncmerge.js";

const base = () => ({
  transactions: [{ id: "t1", date: "2026-10-01", what: "Fern Café", amount: 12 }, { id: "t2", date: "2026-10-02", what: "Bank One fee", amount: 5 }],
  accounts: [{ id: "a1", name: "Everyday", balance: 100 }],
  netWorthLog: [{ date: "2026-10-01", value: 1000, auto: true }],
  projection: { inflationRate: 3, horizonYears: 30 },
  activeScenario: "A",
  lastFolderBackup: "2026-10-01"
});

test("nothing changed either side: the same copy back, nothing asked", () => {
  const r = mergeStates(base(), base(), base());
  assert.deepEqual(r.merged, base());
  assert.equal(r.conflicts.length, 0);
});

test("rows added on each device are both kept, in order", () => {
  const o = base(); o.transactions.push({ id: "t3", date: "2026-10-03", what: "Hardware Place", amount: 40 });
  const t = base(); t.transactions.splice(1, 0, { id: "t9", date: "2026-10-01", what: "Fern Café", amount: 6 });
  const r = mergeStates(base(), o, t);
  assert.equal(r.conflicts.length, 0);
  assert.deepEqual(r.merged.transactions.map((x) => x.id), ["t1", "t9", "t2", "t3"]);
  assert.equal(r.fromTheirs, 1);
  assert.equal(r.fromOurs, 1);
});

test("a row deleted on one side and untouched on the other stays deleted", () => {
  const o = base(); o.transactions = o.transactions.filter((x) => x.id !== "t2");
  const r = mergeStates(base(), o, base());
  assert.deepEqual(r.merged.transactions.map((x) => x.id), ["t1"]);
  const r2 = mergeStates(base(), base(), o);
  assert.deepEqual(r2.merged.transactions.map((x) => x.id), ["t1"]);
});

test("different fields of the same row changed on each side are both kept", () => {
  const o = base(); o.transactions[0].amount = 13;
  const t = base(); t.transactions[0].what = "Fern Cafe";
  const r = mergeStates(base(), o, t);
  assert.equal(r.conflicts.length, 0);
  assert.deepEqual(r.merged.transactions[0], { id: "t1", date: "2026-10-01", what: "Fern Cafe", amount: 13 });
});

test("the same field changed both ways is asked, and the answer is used", () => {
  const o = base(); o.accounts[0].balance = 150;
  const t = base(); t.accounts[0].balance = 175;
  const r = mergeStates(base(), o, t);
  assert.equal(r.conflicts.length, 1);
  const c = r.conflicts[0];
  assert.equal(c.top, "accounts"); assert.equal(c.field, "balance"); assert.equal(c.row.name, "Everyday");
  assert.equal(r.merged.accounts[0].balance, 150);
  const r2 = mergeStates(base(), o, t, { [c.id]: "theirs" });
  assert.equal(r2.merged.accounts[0].balance, 175);
});

test("edited here, deleted there: asked", () => {
  const o = base(); o.transactions[1].amount = 7;
  const t = base(); t.transactions = t.transactions.slice(0, 1);
  const r = mergeStates(base(), o, t);
  assert.equal(r.conflicts.length, 1);
  assert.equal(r.conflicts[0].theirs, undefined);
  assert.equal(valueText(r.conflicts[0].theirs, true), "Deleted");
  assert.equal(r.merged.transactions.length, 2);
  assert.equal(mergeStates(base(), o, t, { [r.conflicts[0].id]: "theirs" }).merged.transactions.length, 1);
});

test("the app's own bookkeeping and this device's view are never asked about", () => {
  const o = base(); o.netWorthLog[0].value = 1010; o.activeScenario = "B"; o.lastFolderBackup = "2026-10-05"; o.netWorthLog.push({ date: "2026-10-08", value: 1100, auto: true });
  const t = base(); t.netWorthLog[0].value = 1020; t.activeScenario = "C"; t.lastFolderBackup = "2026-10-07"; t.netWorthLog.push({ date: "2026-10-06", value: 1050, auto: true });
  const r = mergeStates(base(), o, t);
  assert.equal(r.conflicts.length, 0);
  assert.equal(r.merged.activeScenario, "B");
  assert.equal(r.merged.lastFolderBackup, "2026-10-07");
  assert.deepEqual(r.merged.netWorthLog.map((p) => p.date), ["2026-10-01", "2026-10-06", "2026-10-08"]);
});

test("settings merge field by field", () => {
  const o = base(); o.projection.inflationRate = 2.5;
  const t = base(); t.projection.horizonYears = 40;
  const r = mergeStates(base(), o, t);
  assert.deepEqual(r.merged.projection, { inflationRate: 2.5, horizonYears: 40 });
  assert.equal(sectionLabel("transactions"), "Spending");
});

test("rows with no id match by content", () => {
  const b = { income: [{ what: "Pay A", amount: 1 }, { what: "Pay B", amount: 2 }] };
  const o = { income: [{ what: "Pay A", amount: 1 }, { what: "Pay B", amount: 2 }, { what: "Pay C", amount: 3 }] };
  const t = { income: [{ what: "Pay B", amount: 2 }] };
  const r = mergeStates(b, o, t);
  assert.deepEqual(r.merged.income.map((x) => x.what), ["Pay B", "Pay C"]);
});
