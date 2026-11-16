import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { draftGoal, allocatePlan, savePlan, planYearLabel, planAccounts } from "../src/calc/nextyearplan.js";
import { state, defaultState, setState } from "../src/state.js";

// #399: next year's plan. An invented household with an everyday account, a saver and a card.
const TODAY = "2026-08-15";
function household(){
  const s = defaultState();
  s.assets = [{ id: "c1", what: "Everyday", category: "Cash", amount: 2000 }, { id: "c2", what: "Saver", category: "Cash", amount: 4000 }];
  s.debts = [{ id: "d1", what: "Card A", balance: 1200 }];
  s.accounts = [
    { id: "a1", name: "Everyday", type: "everyday", link: "asset:c1" },
    { id: "a2", name: "Saver", type: "savings", link: "asset:c2" },
    { id: "a3", name: "Card A", type: "credit", link: "debt:d1" }
  ];
  return s;
}
const run = fn => { const was = state; setState(household()); try { return fn(); } finally { setState(was); } };

test("which accounts a goal can sit on, and the year the plan is for", () => run(() => {
  assert.deepEqual(planAccounts("save"), ["Everyday", "Saver"]);
  assert.deepEqual(planAccounts("debt"), ["Card A"]);
  assert.equal(planYearLabel(TODAY), "FY26/27");
  state.yearBasis = "calendar";
  assert.equal(planYearLabel(TODAY), "2026");
}));

test("a draft is complete or says what's missing", () => run(() => {
  assert.match(draftGoal({ id: "1", kind: "save", name: "Trip", by: "2027-08-01", accounts: ["Saver"] }, TODAY).problem, /amount/);
  assert.match(draftGoal({ id: "1", kind: "save", name: "Trip", amount: 3000, by: "2027-08-01" }, TODAY).problem, /account/);
  assert.match(draftGoal({ id: "1", kind: "save", name: "Trip", amount: 3000, accounts: ["Saver"] }, TODAY).problem, /date/);
  assert.match(draftGoal({ id: "1", kind: "save", name: "Trip", amount: 3000, accounts: ["Saver"], by: "2026-01-01" }, TODAY).problem, /after today/);
  assert.match(draftGoal({ id: "1", kind: "debt", by: "2027-08-01" }, TODAY).problem, /card or loan/);
  assert.match(draftGoal({ id: "1", kind: "emergency", months: 6, by: "2027-08-01" }, TODAY).problem, /Needs/, "no essentials, no fund size");
  const ok = draftGoal({ id: "1", kind: "debt", account: "Card A", by: "2027-08-01" }, TODAY);
  assert.equal(ok.problem, "");
  assert.deepEqual([ok.goal.name, ok.goal.target, ok.goal.accounts], ["Pay off Card A", 0, ["Card A"]]);
}));

test("the surplus is shared in order: the first in full, then the next; what doesn't fit says when it would get there", () => run(() => {
  const drafts = [
    { id: "card", kind: "debt", account: "Card A", by: "2027-02-15" },
    { id: "trip", kind: "save", name: "Trip", amount: 10000, accounts: ["Saver"], by: "2027-08-15" },
    { id: "car", kind: "save", name: "Car", amount: 20000, accounts: ["Everyday"], by: "2027-08-15" },
    { id: "bad", kind: "save", name: "Nope", accounts: ["Saver"], by: "2027-08-15" }
  ];
  const p = allocatePlan(drafts, 800, TODAY);
  const by = Object.fromEntries(p.rows.map(r => [r.id, r]));
  assert.equal(by.card.left, 1200); assert.equal(by.card.needed, 200); assert.equal(by.card.given, 200); assert.equal(by.card.status, "funded");
  assert.equal(by.trip.left, 6000); assert.equal(by.trip.needed, 500); assert.equal(by.trip.given, 500); assert.equal(by.trip.status, "funded");
  assert.equal(by.car.needed, 1500); assert.equal(by.car.given, 100); assert.equal(by.car.status, "partial");
  assert.equal(by.car.reach, "2041-08", "$18,000 at $100 a month");
  assert.equal(by.bad.status, "problem"); assert.equal(by.bad.given, 0);
  assert.equal(p.used, 800); assert.equal(p.left, 0);
  // The same goals in another order: whoever is first is funded.
  const q = allocatePlan([drafts[2], drafts[0]], 800, TODAY);
  assert.equal(q.rows[0].given, 800); assert.equal(q.rows[1].given, 0); assert.equal(q.rows[1].status, "unfunded"); assert.equal(q.rows[1].reach, null);
  const none = allocatePlan(drafts.slice(0, 1), -50, TODAY);
  assert.equal(none.surplus, 0); assert.equal(none.rows[0].given, 0);
}));

test("saving adds ordinary savings goals with their monthly amount and year; problems and done goals aren't saved", () => run(() => {
  state.assets[1].amount = 20000;
  const plan = allocatePlan([{ id: "trip", kind: "save", name: "Trip", amount: 10000, accounts: ["Saver"], by: "2027-08-15" }, { id: "card", kind: "debt", account: "Card A", by: "2027-02-15" }, { id: "bad", kind: "debt", by: "2027-02-15" }], 300, TODAY);
  assert.equal(plan.rows[0].status, "done", "the saver already holds it");
  const added = savePlan(plan, TODAY);
  assert.equal(added.length, 1);
  assert.deepEqual(state.savingsGoals.map(g => [g.name, g.target, g.by, g.accounts.join(), g.plannedMonthly, g.planYear]), [["Pay off Card A", 0, "2027-02-15", "Card A", 200, "FY26/27"]]);
}));
