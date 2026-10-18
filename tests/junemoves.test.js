import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { juneMoves, inJuneWindow } from "../src/calc/junemoves.js";
import { currentTaxFy, setDeductibleItemsProvider } from "../src/calc/tax.js";

// Before 30 June (v3.51.0), on an invented one-person household.
function withState(fn){
  var keys = ["income", "assets", "properties", "taxYears", "tax", "fx"];
  var keep = {}; keys.forEach(function(k){ keep[k] = state[k]; });
  var fy = currentTaxFy();
  try {
    state.income = [{ id: "p", what: "Pay", person: "Alex", incomeType: "Gross", amount: 150000, freq: "Yearly", superMode: "On top" }];
    state.taxYears = {}; state.fx = {};
    state.tax = Object.assign({}, state.tax, { sgRate: 12, settings: { Alex: { concessionalCap: 30000, carryForward: 0 } } });
    state.assets = [
      { what: "ETFA", category: "Shares", market: "ASX", person: "Alex", quantity: 100, avgCost: 50, price: 30, lots: [],
        sales: [] },
      { what: "ETFB", category: "Shares", market: "ASX", person: "Alex", quantity: 0, price: 10, lots: [],
        sales: [{ date: fy + "-09-01", units: 100, proceeds: 9000, costBase: 4000, acquired: (fy - 3) + "-01-01" }] }
    ];
    state.properties = [{ id: "r", what: "9 Sample Ave", kind: "IP", ownership: { Alex: 100 }, income: [], expenses: [],
      loans: [{ balance: 400000, rate: 6, termYears: 30, repaymentType: "IO", offsetBalance: 0 }] }];
    setDeductibleItemsProvider(function(){ return [
      { id: "d1", what: "Professional membership", amount: 600, freq: "Yearly", dueMonth: 8, deductible: true, deductiblePerson: "Alex" },
      { id: "d2", what: "Phone", amount: 80, freq: "Monthly", deductible: true, deductiblePerson: "Alex", deductiblePct: 50 }
    ]; });
    fn(fy);
  } finally { setDeductibleItemsProvider(null); keys.forEach(function(k){ state[k] = keep[k]; }); }
}

test("super room, a loss against this year's gain, a yearly line to prepay, and loan interest", function(){
  withState(function(fy){
    var j = juneMoves("Alex", (fy + 1) + "-05-15");
    var kinds = j.moves.map(function(m){ return m.kind; }).sort();
    assert.deepEqual(kinds, ["interest", "losses", "prepay", "super"]);
    var by = {}; j.moves.forEach(function(m){ by[m.kind] = m; });
    assert.equal(by.super.amount, 30000 - 18000, "cap less SG at 12%");
    assert.equal(by.losses.amount, 2000);
    // 5,000 discount gain halved to 2,500; a 2,000 loss comes off before the discount → 1,500.
    assert.ok(Math.abs(by.losses.saves - 1000 * j.marginal) < 1.01);
    assert.equal(by.prepay.amount, 600, "the yearly line, not the monthly phone");
    assert.equal(by.interest.amount, 24000);
    assert.equal(j.daysLeft, 46);
  });
});

test("no gains this year, no loss move", function(){
  withState(function(fy){
    state.assets[1].sales = [];
    assert.ok(!juneMoves("Alex", (fy + 1) + "-05-15").moves.some(function(m){ return m.kind === "losses"; }));
  });
});

test("the panel opens itself in May and June", function(){
  assert.equal(inJuneWindow("2027-05-01"), true);
  assert.equal(inJuneWindow("2027-06-30"), true);
  assert.equal(inJuneWindow("2027-07-01"), false);
});
