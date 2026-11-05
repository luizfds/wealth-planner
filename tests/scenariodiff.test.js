import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state, defaultPurchaseConfig, defaultInvestConfig } from "../src/state.js";
import { scenarioTotals, recalcComputedItems } from "../src/calc/engine.js";
import { scenarioMonthlyChange, costKind } from "../src/calc/scenariodiff.js";
import { scenarioMonthlyChangeHtml } from "../src/components/scenarios.js";

// Item 257: what a scenario changes each month, against the household. Invented household: renting, a scenario that
// buys a home with its own costs, one that rents somewhere cheaper.
function withHousehold(fn){
  var keys = ["properties", "assets", "purchase", "scenarios", "home", "invest", "income", "shared", "baselineScenario", "activeScenario", "scenarioChanges", "debts"];
  var keep = {}; keys.forEach(function(k){ keep[k] = state[k]; });
  try {
    state.scenarios = ["Renting", "Buy", "Cheaper"];
    state.baselineScenario = "Renting"; state.activeScenario = "Renting";
    state.debts = []; state.properties = [];
    state.assets = [{ category: "Cash", what: "Savings", amount: 300000 }];
    state.income = [{ id: "i1", what: "Alex — pay", incomeType: "Net", amount: 15000, freq: "Monthly" }];
    state.shared = [
      { id: "rent", what: "Rent", amount: 1500, freq: "Fortnightly", homeCost: true },
      { id: "food", what: "Groceries", amount: 1200, freq: "Monthly" }];
    state.invest = { Renting: defaultInvestConfig(), Buy: defaultInvestConfig(), Cheaper: defaultInvestConfig() };
    state.purchase = { Renting: defaultPurchaseConfig(0, 20, 6, 30, "NSW", false), Buy: Object.assign(defaultPurchaseConfig(900000, 20, 6, 30, "NSW", true), { otherCosts: [] }),
      Cheaper: defaultPurchaseConfig(0, 20, 6, 30, "NSW", false) };
    state.home = { Renting: [], Cheaper: [], Buy: [
      { id: "homeLoanRow", what: "Rent / Home Loan", amount: 0, freq: "Monthly", computed: true },
      { id: "h2", what: "Council Rates", amount: 600, freq: "Quarterly" },
      { id: "h3", what: "Home Insurance", amount: 1800, freq: "Yearly" },
      { id: "h4", what: "Water & Wastewater", amount: 110, freq: "Monthly" },
      { id: "h5", what: "Property Maintenance", amount: 1500, freq: "Yearly" }] };
    state.scenarioChanges = { Buy: [{ id: "c1", kind: "home" }], Cheaper: [{ id: "c2", kind: "rent", what: "Rent there", amount: 550, freq: "Weekly", fromYear: 0 }] };
    recalcComputedItems();
    fn();
  } finally { keys.forEach(function(k){ state[k] = keep[k]; }); }
}
const sum = list => list.reduce((s, x) => s + x.monthly, 0);

test("added and gone add up to the difference in the month's spending", () => {
  withHousehold(() => {
    for (const sc of ["Buy", "Cheaper"]){
      const d = scenarioMonthlyChange(sc);
      assert.ok(Math.abs(sum(d.added) + sum(d.gone) - (scenarioTotals(sc).expensesMonthly - scenarioTotals("Renting").expensesMonthly)) < 0.05, sc);
      assert.equal(d.added.concat(d.gone).some(x => x.label === "Other changes"), false, sc + ": every line named");
    }
    assert.equal(scenarioMonthlyChange("Renting"), null);
  });
});

test("a home it buys: the repayment, its costs marked fixed, partly fixed or budgeted; today's rent is gone", () => {
  withHousehold(() => {
    const d = scenarioMonthlyChange("Buy");
    const by = Object.fromEntries(d.added.map(x => [x.label, x]));
    assert.equal(by["Loan repayment"].kind, "fixed");
    assert.equal(by["Council Rates"].kind, "fixed");
    assert.deepEqual([by["Council Rates"].freq, by["Council Rates"].each, by["Council Rates"].monthly], ["Quarterly", 600, 200]);
    assert.equal(by["Water & Wastewater"].kind, "partly");
    assert.equal(by["Property Maintenance"].kind, "budgeted");
    assert.deepEqual(d.gone.map(x => [x.label, x.kind]), [["Rent", "fixed"]]);
    assert.ok(d.principalMonthly > 0 && Math.abs(d.costAboveMonthly - (d.extraMonthly - d.principalMonthly)) < 0.01);
    assert.ok(d.maintenanceLight && d.maintenanceLight.floorYearly === 4500, "$1,500 a year is light for a $900k home");
  });
});

test("rent somewhere cheaper spends less; how a cost behaves, from its name", () => {
  withHousehold(() => {
    const d = scenarioMonthlyChange("Cheaper");
    assert.ok(d.extraMonthly < 0);
    assert.equal(d.principalMonthly, 0);
  });
  assert.equal(costKind("Strata levies"), "fixed");
  assert.equal(costKind("Electricity"), "partly");
  assert.equal(costKind("Garden and repairs"), "budgeted");
});

test("on the page: the lines, the total, the notes; names escaped", () => {
  withHousehold(() => {
    const html = scenarioMonthlyChangeHtml(scenarioMonthlyChange("Buy"));
    assert.match(html, /What changes each month/);
    assert.match(html, /Council Rates<small>quarterly \(\$600\)<\/small>/);
    assert.match(html, /Extra spent each month/);
    assert.match(html, /pays the loan down/);
    assert.match(html, /light for a home this price/);
    assert.equal(scenarioMonthlyChangeHtml(null), "");
    const odd = scenarioMonthlyChangeHtml({ against: "<x>", added: [{ label: "A <b>", monthly: 10, kind: "fixed", freq: "Monthly", each: 10 }], gone: [], extraMonthly: 10, principalMonthly: 0, costAboveMonthly: 10, slowerPaydownMonthly: 0, taxBackMonthly: 0, maintenanceLight: null });
    assert.match(odd, /A &lt;b>/);
    assert.match(odd, /against &lt;x>/);
  });
});
