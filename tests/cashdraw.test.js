import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state, defaultPurchaseConfig, defaultInvestConfig } from "../src/state.js";
import { scenarioTotals, savingsBreakdown, recalcComputedItems } from "../src/calc/engine.js";
import { recalcPurchase } from "../src/calc/property.js";
import { drawFor } from "../src/calc/cashdraw.js";
import { canBuy } from "../src/calc/canbuy.js";

// Item 248: a scenario's deposit comes out of cash, then offsets — and an emptied offset costs its loan's interest.
// Invented household.
function withHousehold(fn){
  var keys = ["properties", "assets", "purchase", "scenarios", "home", "invest", "income", "shared", "baselineScenario", "activeScenario", "scenarioChanges", "debts"];
  var keep = {}; keys.forEach(function(k){ keep[k] = state[k]; });
  try {
    state.scenarios = ["Renting", "Buy"];
    state.baselineScenario = "Renting"; state.activeScenario = "Renting";
    state.scenarioChanges = {};
    state.debts = [];
    state.assets = [{ category: "Cash", what: "Everyday", amount: 10000 }];
    state.home = { Renting: [], Buy: [] };
    state.invest = { Renting: defaultInvestConfig(), Buy: defaultInvestConfig() };
    state.purchase = { Renting: defaultPurchaseConfig(0, 20, 6, 30, "NSW", false), Buy: Object.assign(defaultPurchaseConfig(600000, 20, 6, 30, "NSW", true), { otherCosts: [] }) };
    state.income = [{ id: "i1", what: "Alex — pay", incomeType: "Net", amount: 12000, freq: "Monthly" }];
    state.shared = [{ id: "s1", what: "Groceries", amount: 1000, freq: "Monthly" }];
    state.properties = [{ id: "ip", what: "1 Example St", kind: "IP", purchaseDate: "2022-03-01", ownership: {}, pmFee: { percent: 0, flat: 0 },
      income: [], expenses: [],
      loans: [{ id: "a", what: "Loan A", balance: 500000, offsetBalance: 400000, rate: 6, termYears: 25, repaymentType: "PI", settlementDate: "2022-03-01" }] }];
    recalcComputedItems();
    fn();
  } finally { keys.forEach(function(k){ state[k] = keep[k]; }); }
}

test("cash first, then the offset: the interest the offset stops saving is what it costs", function(){
  withHousehold(function(){
    var d = drawFor(110000);
    assert.deepEqual(d.draws.map(function(x){ return [x.kind, x.take]; }), [["cash", 10000], ["offset", 100000]]);
    assert.equal(d.extraInterestYearly, 6000);
    assert.equal(d.deductibleYearly, 6000);
    assert.equal(d.short, 0);
    assert.equal(drawFor(500000).short, 90000, "more than there is: what's missing");
  });
});

test("a buying scenario's month counts that interest; the household's doesn't", function(){
  withHousehold(function(){
    var upfront = recalcPurchase("Buy").upfrontCash;
    var t = scenarioTotals("Buy");
    assert.equal(t.cashOut, upfront);
    assert.ok(Math.abs(t.drawInterestMonthly - (upfront - 10000) * 0.06 / 12) < 0.01);
    var withoutDraw = t.incomeMonthly - t.drawTaxBackYearly / 12 - (t.expensesMonthly - t.drawInterestMonthly);
    assert.ok(Math.abs(t.netMonthly - (withoutDraw - t.drawInterestMonthly + t.drawTaxBackYearly / 12)) < 0.01);
    assert.ok(t.regularNetMonthly < withoutDraw - t.drawInterestMonthly + 0.01, "the tax back isn't in a normal month");
    var base = scenarioTotals("Renting");
    assert.equal(base.cashOut, 0);
    assert.equal(base.drawInterestMonthly, 0);
    assert.equal(canBuy("Buy").extraInterestYearly, Math.round(t.drawInterestMonthly * 12), "Can we buy? and the scenario agree");
  });
});

test("the breakdown names the offset's interest and the tax back, and still adds up to the card", function(){
  withHousehold(function(){
    var t = scenarioTotals("Buy"), b = savingsBreakdown("Buy");
    var line = b.out.find(function(r){ return /Loan A offset — interest on the \$/.test(r.label); });
    assert.ok(line && Math.abs(line.monthly - t.drawInterestMonthly) < 0.01);
    assert.ok(!b.out.some(function(r){ return r.label === "This scenario's changes"; }), "nothing left over");
    var sum = function(rows){ return rows.reduce(function(s, r){ return s + r.monthly; }, 0); };
    assert.ok(Math.abs(sum(b.income.filter(function(r){ return !r.oneOff; })) - sum(b.out) - t.regularNetMonthly) < 0.05);
    assert.ok(Math.abs(sum(b.income) - sum(b.out) - t.netMonthly) < 0.05);
  });
});
