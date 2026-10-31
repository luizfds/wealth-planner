import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { state, setState, migrateState } from "../src/state.js";
import { ipFigures, legsMonthly, legsInYear, newChange, changeSummary } from "../src/calc/scenariolegs.js";
import { scenarioTotals, computeNetWorthSeries, recalcComputedItems, scenarioLegContext } from "../src/calc/engine.js";
import { periodsOf } from "../src/calc/ledger.js";

// A hand-worked investment property (all figures invented): $600,000, 20% down, interest only at 6%,
// $600 a week rent with two weeks vacant, 7% management, $4,000 of costs, $5,000 depreciation,
// owner on a 30% marginal rate.
var IP = { kind: "ip", what: "Example unit", price: 600000, depositPct: 20, rate: 6, termYears: 30, repaymentType: "IO", state: "NSW",
  rentWeekly: 600, vacancyWeeks: 2, mgmtPct: 7, costsYearly: 4000, depreciationYearly: 5000, growthPct: 5, owner: "", fromYear: 0 };

test("an investment property, worked by hand to the cent", function(){
  var f = ipFigures(IP, { marginalRate: 0.30 });
  assert.equal(f.loan, 480000);
  assert.equal(f.repaymentMonthly, 2400);            // 480,000 × 6% ÷ 12, interest only
  assert.equal(f.interestYearly, 28800);
  assert.equal(f.rentYearly, 30000);                 // 600 × 50 weeks
  assert.equal(f.mgmtYearly, 2100);                  // 7%
  assert.equal(f.taxableYearly, -9900);              // 30,000 − 2,100 − 4,000 − 28,800 − 5,000
  assert.equal(f.taxEffectYearly, 3168);             // 9,900 × (30% + 2% Medicare), back as a refund
  assert.equal(f.cashBeforeTaxMonthly, -408.33);     // (30,000 − 2,100 − 4,000) ÷ 12 − 2,400
  assert.equal(f.cashAfterTaxMonthly, -144.33);      // −408.33 + 3,168 ÷ 12
  assert.equal(f.upfront, 120000 + f.stampDuty + 2500);
});

test("a principal-and-interest loan pays some off, so less of the repayment is interest", function(){
  var pi = Object.assign({}, IP, { repaymentType: "PI" });
  var f = ipFigures(pi, { marginalRate: 0.30 });
  assert.ok(f.repaymentMonthly > 2400);
  assert.ok(f.interestYearly < 28800 && f.interestYearly > 28000);
});

test("in the projection: bought in its year, value and loan from then, cash each year", function(){
  var ctx = { inflationRate: 0, propRate: 0.05, marginalRateFor: function(){ return 0.30; } };
  var later = Object.assign({}, IP, { fromYear: 2 });
  assert.deepEqual(legsInYear([later], 2, ctx), { savingsMonthly: 0, lump: 0, equity: 0, debt: 0, inflatableMonthly: 0 });
  var y3 = legsInYear([later], 3, ctx);
  var grown = Math.pow(1.05, 2);
  assert.equal(Math.round(y3.lump), -Math.round(ipFigures(later, { marginalRate: 0.3 }).upfront * grown));
  assert.equal(Math.round(y3.debt), Math.round(480000 * grown));
  assert.equal(Math.round(y3.equity), Math.round(600000 * Math.pow(1.05, 3) - 480000 * grown));
  var y1 = legsInYear([IP], 1, ctx);
  assert.equal(Math.round(y1.savingsMonthly * 100) / 100, -144.33);
});

test("rent somewhere new, and a new cost, in a month", function(){
  var m = legsMonthly([{ kind: "rent", amount: 850, freq: "Weekly" }, { kind: "cost", amount: 300, freq: "Monthly" }], {});
  assert.equal(m.homeMonthly, Math.round(periodsOf(850, "Weekly").monthly * 100) / 100);
  assert.equal(m.expensesMonthly, Math.round((periodsOf(850, "Weekly").monthly + 300) * 100) / 100);
  assert.match(changeSummary({ kind: "rent", amount: 850, freq: "Weekly", fromYear: 1 }), /Rent \$850 weekly · from year 2/);
  assert.equal(newChange("ip", "x").kind, "ip");
});

test("rent a bigger place and buy an investment property: the scenario's month, from the household's", function(){
  var keep = state;
  try {
    setState(migrateState({
      scenarios: ["Today", "Rentvest"], baselineScenario: "Today", activeScenario: "Today",
      home: { "Today": [{ id: "homeLoanRow", what: "Rent", amount: 550, freq: "Weekly" }], "Rentvest": [] },
      income: [{ id: "pay", what: "Salary", person: "Alex", incomeType: "Gross", amount: 100000, freq: "Yearly" }],
      shared: [{ id: "g", what: "Groceries", amount: 800, freq: "Monthly" }],
      scenarioChanges: { Rentvest: [{ id: "r", kind: "rent", what: "Rent", amount: 750, freq: "Weekly", fromYear: 0 }, Object.assign({ id: "ip" }, IP)] }
    }));
    recalcComputedItems();
    var today = scenarioTotals("Today"), rv = scenarioTotals("Rentvest");
    var rate = scenarioLegContext("Rentvest").marginalRateFor("");
    var f = ipFigures(IP, { marginalRate: rate });
    var expected = today.netMonthly + periodsOf(550, "Weekly").monthly - periodsOf(750, "Weekly").monthly + f.cashAfterTaxMonthly;
    assert.equal(Math.round(rv.netMonthly), Math.round(expected));
    assert.equal(rv.changesUpfront, f.upfront);
    assert.ok(rv.changesTaxMonthly > 0, "a loss comes back at tax time");
    // And it shows in the projection: less cash in year one (the deposit), a property from then.
    var a = computeNetWorthSeries("Today", 3), b = computeNetWorthSeries("Rentvest", 3);
    assert.ok(b[1].propertyEquity > a[1].propertyEquity);
    assert.ok(b[1].investments < a[1].investments);
  } finally { setState(keep); }
});
