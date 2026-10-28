import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { computePersonTax } from "../src/calc/tax.js";

// v3.149.0: a pay row counts for the share of the tax year it runs. An invented household.
var SALARY = { id: "s1", what: "Salary", person: "Alex", incomeType: "Gross", amount: 7000, freq: "Monthly", superMode: "On top", sacrificeMode: "none", sacrificeValue: 0 };
function withIncome(rows, fn){
  var keep = { income: state.income, properties: state.properties };
  try { state.income = rows; state.properties = []; fn(); } finally { Object.assign(state, keep); }
}

test("an allowance ending halfway through the tax year is half a year's income in it", function(){
  var half = { id: "a1", what: "Allowance", person: "Alex", incomeType: "Gross", amount: 1000, freq: "Monthly", superMode: "On top", sacrificeMode: "none", sacrificeValue: 0, startDate: "2026-07-01", endDate: "2026-12-31" };
  withIncome([SALARY, half], function(){
    var r = computePersonTax("Alex", { fy: 2026 });
    assert.ok(Math.abs(r.gross - (84000 + 1000 * 12 * 184 / 365)) < 1, "184 of 365 days");
    var whole = computePersonTax("Alex", { fy: 2026, wholeYears: true });
    assert.ok(Math.abs(whole.gross - 96000) < 1, "a projection year still counts it whole");
  });
});

test("a row with no dates is the whole year, as before", function(){
  withIncome([SALARY], function(){ assert.ok(Math.abs(computePersonTax("Alex", { fy: 2026 }).gross - 84000) < 1); });
});
