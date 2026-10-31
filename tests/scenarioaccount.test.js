import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { state, setState, migrateState } from "../src/state.js";
import { recalcComputedItems } from "../src/calc/engine.js";
import { scenarioOnAccount, datesOn } from "../src/calc/scenarioaccount.js";
import { calcStampDuty } from "../src/calc/property.js";

function household(){
  return migrateState({
    scenarios: ["Today", "Move"], baselineScenario: "Today", activeScenario: "Today", scenarioModel: 2,
    assets: [{ id: "c1", what: "Bank One Everyday", category: "Cash", amount: 40000, history: [{ date: "2026-10-31", value: 40000 }] }],
    accounts: [{ id: "a1", name: "Bank One Everyday", type: "everyday", link: "asset:c1", buffer: 2000 }], income: [],
    shared: [{ id: "rent", what: "Rent", amount: 2400, freq: "Monthly", account: "Bank One Everyday", homeCost: true }],
    transactions: [
      { date: "2026-08-03", what: "Rent", amount: 2400, account: "Bank One Everyday", linkedExpenseId: "rent" },
      { date: "2026-09-03", what: "Rent", amount: 2400, account: "Bank One Everyday", linkedExpenseId: "rent" },
      { date: "2026-10-03", what: "Rent", amount: 2400, account: "Bank One Everyday", linkedExpenseId: "rent" }
    ],
    home: { Today: [], Move: [] }, purchase: { Today: { enabled: false }, Move: { enabled: false } }, invest: { Today: { enabled: false }, Move: { enabled: false } },
    scenarioChanges: { Move: [
      { id: "r", kind: "rent", what: "New rent", amount: 700, freq: "Weekly", fromYear: 0 },
      { id: "i", kind: "ip", what: "Example unit", price: 400000, depositPct: 20, rate: 6, termYears: 30, repaymentType: "IO", state: "VIC", rentWeekly: 450, vacancyWeeks: 0, mgmtPct: 0, costsYearly: 2400, depreciationYearly: 0, growthPct: "", owner: "", fromYear: 0 }
    ] }
  });
}

test("rhythms: a weekly rent from a day, a monthly bill keeping its day", function(){
  assert.deepEqual(datesOn("2026-11-14", "Weekly", "2026-12-01"), ["2026-11-14", "2026-11-21", "2026-11-28"]);
  assert.deepEqual(datesOn("2026-11-30", "Monthly", "2027-01-31"), ["2026-11-30", "2026-12-30", "2027-01-30"]);
});

test("laid over the account: settlement on its day, the old rent stops, the new rent, the property's rent and loan land on theirs", function(){
  var keep = state;
  try {
    setState(household()); recalcComputedItems();
    var r = scenarioOnAccount(state, "Move", state.accounts[0], "2026-10-31", "2026-11-14", { settlementHere: true });
    var on = function(f, d){ var p = f.points.find(function(x){ return x.date === d; }); return p ? p.events.map(function(e){ return e.what + " " + Math.round(e.amount); }) : null; };
    // Today: the rent on the 3rd of each month.
    assert.deepEqual(on(r.today, "2026-11-03"), ["Rent -2400"]);
    assert.deepEqual(on(r.today, "2026-12-03"), ["Rent -2400"]);
    // With the scenario: the old rent still on 3 November (before the move), gone from 3 December.
    assert.deepEqual(on(r.scenario, "2026-11-03"), ["Rent -2400"]);
    assert.deepEqual(on(r.scenario, "2026-12-03"), []);
    // Settlement on the 14th: the new rent that day, and the unit's deposit and costs.
    var settle = on(r.scenario, "2026-11-14");
    assert.ok(settle.indexOf("New rent -700") !== -1);
    // The deposit ($80,000, 20% of $400,000), VIC stamp duty on $400,000 and $2,500 of other buying costs.
    assert.ok(settle.indexOf("Example unit — settlement " + -Math.round(80000 + calcStampDuty("VIC", 400000, false) + 2500)) !== -1, settle.join(", "));
    // Its rent a week later ($450, no vacancy or manager), its loan a month later (interest only: 320,000 × 6% / 12).
    assert.deepEqual(on(r.scenario, "2026-11-21"), ["New rent -700", "Example unit — rent 450"]);
    assert.ok(on(r.scenario, "2026-12-14").indexOf("Example unit — loan -1600") !== -1);
    assert.ok(on(r.scenario, "2026-12-14").indexOf("Example unit — costs -200") !== -1);
    assert.ok(r.scenario.lowest.balance < r.today.lowest.balance);
    assert.equal(r.scenario.below.date, "2026-11-14", "under the $2,000 buffer from settlement");
    // By default the deposit comes from savings: said, not taken from this account.
    var d = scenarioOnAccount(state, "Move", state.accounts[0], "2026-10-31", "2026-11-14");
    assert.equal(d.settlement, Math.round(80000 + calcStampDuty("VIC", 400000, false) + 2500));
    assert.ok(!on(d.scenario, "2026-11-14").some(function(x){ return /settlement/.test(x); }));
    assert.deepEqual(on(d.scenario, "2026-11-21"), ["New rent -700", "Example unit — rent 450"]);
  } finally { setState(keep); }
});
