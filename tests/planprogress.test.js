import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { goalProgress, planProgress, planYearBounds } from "../src/calc/planprogress.js";
import { state, defaultState, setState } from "../src/state.js";

// #400: progress against next year's plan. An invented household: a saver and a card, a plan saved on 1 August 2026.
function household(saver, card, history){
  const s = defaultState();
  s.assets = [{ id: "c2", what: "Saver", category: "Cash", amount: saver, history: history || [{ date: "2026-10-30", value: saver }] }];
  s.debts = [{ id: "d1", what: "Card A", balance: card, history: [{ date: "2026-10-30", value: card }] }];
  s.accounts = [{ id: "a2", name: "Saver", type: "savings", link: "asset:c2" }, { id: "a3", name: "Card A", type: "credit", link: "debt:d1" }];
  return s;
}
const TRIP = { id: "g1", name: "Trip", target: 12000, by: "2027-08-01", accounts: ["Saver"], plannedMonthly: 1000, planYear: "FY26/27", planFrom: "2026-08-01", planStart: 0 };
const TODAY = "2026-11-01";  // three months in: the plan's line is $3,000
const run = (s, fn) => { const was = state; setState(s); try { return fn(); } finally { setState(was); } };

test("the plan year from its label", () => {
  assert.deepEqual(planYearBounds("FY26/27"), { start: "2026-07-01", end: "2027-06-30" });
  assert.deepEqual(planYearBounds("2027"), { start: "2027-01-01", end: "2027-12-31" });
  assert.equal(planYearBounds("soon"), null);
});

test("on track: within 10% of the progress planned so far", () => run(household(2800, 0), () => {
  const p = goalProgress(TRIP, TODAY);
  assert.equal(p.status, "on-track");
  assert.deepEqual([p.expected, p.gap, p.tolerance, p.pace], [3000, -200, 300, 933.33]);
  assert.equal(p.forecast, 10235.53, "$2,800 plus the 7.97 months to 30 June at the pace so far");
  assert.equal(p.planAtYearEnd, 10966.67, "10.97 months from 1 August to 30 June");
  assert.equal(p.adjust, null);
}));

test("behind: more than 10% short — the monthly amount that still lands on the date, and when it gets there at the pace so far", () => run(household(1500, 0), () => {
  const p = goalProgress(TRIP, TODAY);
  assert.equal(p.status, "behind");
  assert.equal(p.gap, -1500);
  assert.deepEqual(p.adjust, { monthly: 1166.67, extra: 166.67, reach: "2028-08" }, "$10,500 over the 9 months to the date; at $500 a month, 21 months");
}));

test("behind needs at least $100, whatever 10% is", () => run(household(220, 0), () => {
  const small = Object.assign({}, TRIP, { plannedMonthly: 100 });  // $300 planned so far: 10% is $30, the floor is $100
  assert.equal(goalProgress(small, TODAY).status, "on-track", "$80 short is under $100");
  state.assets[0].amount = 150;
  assert.equal(goalProgress(small, TODAY).status, "behind", "$150 short is over it");
}));

test("ahead: more than 10% over the line", () => run(household(4000, 0), () => {
  const p = goalProgress(TRIP, TODAY);
  assert.equal(p.status, "ahead");
  assert.equal(p.gap, 1000);
}));

test("done, early, and no data yet", () => run(household(12500, 0), () => {
  assert.equal(goalProgress(TRIP, TODAY).status, "done");
  state.assets[0].amount = 500;
  assert.equal(goalProgress(Object.assign({}, TRIP, { planFrom: "2026-10-20" }), TODAY).status, "early", "under a month in: too soon to tell");
  const gone = goalProgress(Object.assign({}, TRIP, { accounts: ["Old account"] }), TODAY);
  assert.equal(gone.status, "no-data"); assert.match(gone.problem, /Old account/);
}));

test("a goal saved without where it started measures from the plan year's start, from history — or says there's none", () => {
  const legacy = { id: "g2", name: "Trip", target: 12000, by: "2027-08-01", accounts: ["Saver"], plannedMonthly: 1000, planYear: "FY26/27" };
  run(household(4200, 0, [{ date: "2026-06-28", value: 0 }, { date: "2026-10-30", value: 4200 }]), () => {
    const p = goalProgress(legacy, TODAY);
    assert.ok(p.fromYearStart); assert.equal(p.from, "2026-07-01"); assert.equal(p.start, 0);
    assert.equal(p.expected, 4000); assert.equal(p.status, "on-track");
  });
  run(household(4200, 0, [{ date: "2026-10-30", value: 4200 }]), () => {
    const p = goalProgress(legacy, TODAY);
    assert.equal(p.status, "no-data"); assert.match(p.problem, /when the plan started/);
  });
});

test("paying off a card: an owed balance counts against the goal, and the line runs up to $0", () => run(household(0, 900), () => {
  const card = { id: "g3", name: "Pay off Card A", target: 0, by: "2027-02-01", accounts: ["Card A"], plannedMonthly: 300, planYear: "FY26/27", planFrom: "2026-08-01", planStart: -1800 };
  const p = goalProgress(card, TODAY);
  assert.deepEqual([p.actual, p.expected, p.status], [-900, -900, "on-track"]);
  assert.equal(p.planAtYearEnd, 0, "never past $0");
}));

test("a stale balance is said, not filled in; only planned goals count", () => {
  const s = household(2800, 0, [{ date: "2026-08-20", value: 2800 }]);
  s.savingsGoals = [TRIP, { id: "plain", name: "Rainy day", target: 5000, by: "", accounts: ["Saver"] }];
  run(s, () => {
    const all = planProgress(TODAY);
    assert.equal(all.goals.length, 1);
    assert.deepEqual(all.goals[0].stale, ["Saver"]);
    assert.equal(all.stale, 1); assert.ok(all.attention);
  });
  const fresh = household(2800, 0);
  fresh.savingsGoals = [TRIP];
  run(fresh, () => assert.ok(!planProgress(TODAY).attention, "on track and current: nothing needs a look"));
});
