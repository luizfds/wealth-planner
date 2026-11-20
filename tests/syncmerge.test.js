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
  // A list or a group of settings is said in words, never as raw data.
  assert.equal(valueText([{ id: "a" }, { id: "b" }]), "2 rows");
  assert.equal(valueText({ enabled: true, price: 500000 }), "Set");
  assert.equal(valueText([]), "None");
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

// A computed row is matched by what it's for, not its content: the same property's rent at two amounts (one on each
// device) is one row after a merge, not two — the owner's income counted an old rent twice. Invented figures.
test("a computed row is one per thing it's for after a merge, whatever its amount on each side", function(){
  const rent = amount => ({ syntheticRentForProperty: "p1", computed: true, what: "1 Example St — Rent", amount: amount, freq: "Monthly" });
  const bonus = amount => ({ syntheticOneOffFor: "b1", computed: true, what: "Bonus — after tax", amount: amount, freq: "Yearly", irregular: true });
  const base = { income: [{ id: "i1", what: "Pay", amount: 5000, freq: "Monthly" }, rent(2000), bonus(9000)] };
  const ours = { income: [{ id: "i1", what: "Pay", amount: 5000, freq: "Monthly" }, rent(2400), bonus(9500)] };
  const theirs = { income: [{ id: "i1", what: "Pay", amount: 5000, freq: "Monthly" }, rent(2100), bonus(9100)] };
  const m = mergeStates(base, ours, theirs);
  assert.equal(m.merged.income.filter(r => r.syntheticRentForProperty === "p1").length, 1);
  assert.equal(m.merged.income.filter(r => r.syntheticOneOffFor === "b1").length, 1);
  assert.equal(m.conflicts.length, 0, "computed rows are rebuilt after a load — never asked about");
});

// A row with no id edited on two devices is still one row (the owner's rent was two after a merge). Invented figures.
test("a row with no id, edited on each device, is one row: one side's change taken, the same field both ways asked", function(){
  const rent = (amount, extra) => Object.assign({ what: "1 Example St - Rent", amount: amount, freq: "Weekly", account: "Bank One" }, extra || {});
  const base = { properties: [{ id: "p1", income: [rent(580)] }] };
  // Only one side changed the amount, the other a different field: both kept, in one row.
  const r1 = mergeStates(base, { properties: [{ id: "p1", income: [rent(600)] }] }, { properties: [{ id: "p1", income: [rent(580, { account: "Bank Two" })] }] });
  assert.equal(r1.merged.properties[0].income.length, 1);
  assert.deepEqual([r1.merged.properties[0].income[0].amount, r1.merged.properties[0].income[0].account], [600, "Bank Two"]);
  // The amount changed both ways: one row, and asked which.
  const r2 = mergeStates(base, { properties: [{ id: "p1", income: [rent(600)] }] }, { properties: [{ id: "p1", income: [rent(610)] }] });
  assert.equal(r2.merged.properties[0].income.length, 1);
  assert.equal(r2.conflicts.length, 1);
  const r3 = mergeStates(base, { properties: [{ id: "p1", income: [rent(600)] }] }, { properties: [{ id: "p1", income: [rent(610)] }] }, { [r2.conflicts[0].id]: "theirs" });
  assert.equal(r3.merged.properties[0].income[0].amount, 610);
  // Two different lines that happen to share a name stay two.
  const two = { shared: [{ what: "Groceries", amount: 100, freq: "Weekly" }, { what: "Groceries", amount: 50, freq: "Weekly" }] };
  assert.equal(mergeStates(two, two, two).merged.shared.length, 2);
});
