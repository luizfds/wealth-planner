import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { state, setState, migrateState, defaultPurchaseConfig } from "../src/state.js";
import { TEMPLATES, questionsFor, buildScenario, homeRunningCosts } from "../src/calc/scenariotemplates.js";
import { scenarioTotals, computeNetWorthSeries, recalcComputedItems } from "../src/calc/engine.js";

var CTX = { renting: false, state: "VIC", properties: [{ id: "home", what: "1 Example St", kind: "PPOR", value: 900000, loans: [{ id: "l", balance: 400000, rate: 6, termYears: 25 }] }] };

test("every choice asks a few questions and builds a scenario from their defaults", function(){
  TEMPLATES.forEach(function(t){
    var qs = questionsFor(t.key, CTX);
    assert.ok(qs.length >= 2 && qs.length <= 7, t.key + " asks a handful");
    var answers = {};
    qs.forEach(function(q){ answers[q.key] = q.value; });
    var s = buildScenario(t.key, answers, CTX);
    assert.ok(s.name, t.key);
    assert.ok(s.changes.length || s.purchase || s.invest, t.key + " changes something");
  });
});

test("an investment property's rent is guessed from its price when left blank", function(){
  var s = buildScenario("rentvest", { name: "IP", price: 650000, state: "QLD", rentWeekly: "", depositPct: 20, repaymentType: "IO", newRentWeekly: "800" }, CTX);
  var ip = s.changes.find(function(c){ return c.kind === "ip"; });
  assert.equal(ip.rentWeekly, 500); // 4% of 650,000 a year ÷ 52, to the nearest $5
  assert.equal(ip.state, "QLD");
  assert.equal(s.changes[0].kind, "rent");
  assert.equal(s.changes[0].amount, 800);
});

test("a bigger home sells today's and buys; a renter rents bigger", function(){
  var owner = buildScenario("upgrade", { sellId: "home", price: 1300000, depositPct: 20, state: "VIC", fromYear: "1" }, CTX);
  assert.equal(owner.changes[0].kind, "sell");
  assert.equal(owner.purchase.price, 1300000);
  assert.equal(owner.home[0].id, "homeLoanRow");
  var renter = buildScenario("upgrade", { rentWeekly: 950 }, Object.assign({}, CTX, { renting: true }));
  assert.deepEqual(renter.changes.map(function(c){ return [c.kind, c.amount]; }), [["rent", 950]]);
  assert.deepEqual(homeRunningCosts(800000).map(function(r){ return r.what; }), ["Home loan", "Council rates", "Home insurance", "Maintenance"]);
});

test("a built scenario runs through the engine like any other", function(){
  var keep = state;
  try {
    setState(migrateState({ scenarios: ["Today"], baselineScenario: "Today", activeScenario: "Today", home: { Today: [{ id: "homeLoanRow", what: "Rent", amount: 600, freq: "Weekly" }] },
      income: [{ id: "p", what: "Salary", person: "Alex", incomeType: "Gross", amount: 120000, freq: "Yearly" }], shared: [] }));
    var built = buildScenario("buyHome", { name: "Buy", price: 800000, depositPct: 20, state: "NSW", rate: 6, firstHomeBuyer: "no" }, { state: "NSW" });
    state.scenarios.push("Buy");
    state.home.Buy = built.home;
    state.purchase.Buy = Object.assign(defaultPurchaseConfig(800000, 20, 6, 30, "NSW", true), built.purchase);
    state.invest.Buy = { enabled: false };
    state.scenarioChanges.Buy = built.changes;
    recalcComputedItems();
    var t = scenarioTotals("Buy");
    assert.ok(t.homeMonthly > 3500, "the loan repayment and owning costs replace the rent");
    var series = computeNetWorthSeries("Buy", 2);
    assert.ok(series[1].propertyEquity > 0);
  } finally { setState(keep); }
});
