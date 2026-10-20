import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { emergencyFund } from "../src/calc/emergency.js";
import { emergencyHtml } from "../src/components/emergency.js";

// Emergency fund (v3.94.0), invented household.
function withHousehold(fn){
  var keys = ["shared", "home", "properties", "assets", "transactions", "income", "scenarios", "activeScenario", "emergency", "savingsGoals"];
  var keep = {}; keys.forEach(function(k){ keep[k] = state[k]; });
  try {
    state.scenarios = ["Renting"]; state.activeScenario = "Renting";
    state.shared = [
      { id: "g", what: "Groceries", category: "Groceries", classification: "Needs", amount: 150, freq: "Weekly" },
      { id: "p", what: "Power", category: "Utilities", classification: "Needs", amount: 300, freq: "Quarterly" },
      { id: "t", what: "Trips", category: "Travel", classification: "Wants", amount: 4000, freq: "Yearly", irregular: true },
      { id: "c", what: "Coffee", category: "Eating out", classification: "Wants", amount: 20, freq: "Weekly" }
    ];
    state.home = { Renting: [{ id: "r", what: "Rent", amount: 2000, freq: "Monthly" }] };
    state.properties = [{ id: "ip", what: "9 Sample Ave", kind: "IP", income: [{ what: "Rent", amount: 1500, freq: "Monthly" }],
      expenses: [{ what: "Rates", amount: 600, freq: "Quarterly" }], loans: [{ what: "Loan A", balance: 300000, rate: 6, termYears: 25, repaymentType: "IO", offsetBalance: 20000 }] }];
    state.assets = [{ category: "Cash", what: "Everyday", amount: 5000 }, { category: "Shares", what: "Fund", amount: 40000 }];
    state.transactions = [];
    state.income = [];
    delete state.emergency;
    fn();
  } finally { keys.forEach(function(k){ state[k] = keep[k]; }); }
}

test("essentials only: Needs lines, the home, and what the investment property costs beyond its rent", function(){
  withHousehold(function(){
    var f = emergencyFund({ today: "2026-10-20" });
    var names = f.lines.map(function(l){ return l.what; });
    assert.ok(names.indexOf("Trips") === -1 && names.indexOf("Coffee") === -1, "wants are left out");
    var ipCost = 200 + (300000 - 20000) * 0.06 / 12;
    var expected = 150 * 52 / 12 + 100 + 2000 + (ipCost - 1500);
    assert.equal(f.monthly, Math.round(expected));
    assert.equal(f.months, 6, "six months by default");
    assert.equal(f.target, Math.round(expected * 6));
    assert.deepEqual(f.targets.map(function(t){ return t.months; }), [3, 6, 12]);
    assert.equal(f.available, 25000, "cash and offsets, not shares");
    assert.match(emergencyHtml(f), /Keep aside/);
    assert.match(emergencyHtml(f), /cover it — about 8.8 months/);
    state.assets[0].amount = 0; state.properties[0].loans[0].offsetBalance = 0;
    assert.match(emergencyHtml(emergencyFund({ today: "2026-10-20" })), /\$0 — \$[\d,]+ short/);
  });
});

test("a line counts at what's actually spent when that's more than its plan", function(){
  withHousehold(function(){
    for(var m = 1; m <= 9; m++) state.transactions.push({ linkedExpenseId: "g", date: "2026-0" + m + "-10", amount: 900 });
    var f = emergencyFund({ today: "2026-10-20", months: 3 });
    var g = f.lines.find(function(l){ return l.what === "Groceries"; });
    assert.ok(f.usedActual);
    assert.ok(g.actual > g.planned && g.counted === g.actual);
    assert.equal(f.months, 3);
  });
});

test("one income stopping: the other's take-home covers part of it", function(){
  withHousehold(function(){
    state.income = [{ id: "a", person: "Alex", incomeType: "Gross", amount: 6000, freq: "Monthly" }, { id: "b", person: "Sam", incomeType: "Gross", amount: 2000, freq: "Monthly" }];
    var f = emergencyFund({ today: "2026-10-20" });
    assert.equal(f.perPerson.length, 2);
    var alex = f.perPerson.find(function(p){ return p.person === "Alex"; });
    assert.ok(alex.drawMonthly > 0 && alex.drawMonthly < f.monthly);
    assert.match(emergencyHtml(f), /If one income stopped/);
  });
});
