import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { loanInvestShare, loanDeductibleInterestMonthly, loanInterestMonthly, propertyTaxResultBreakdown, propertyTaxDeductibleResultAnnual, propertyCashResultAnnual } from "../src/calc/property.js";
import { rentalSchedule } from "../src/calc/taxyear.js";

// Loan purpose (v3.85.0), invented loans.
function loan(extra){ return Object.assign({ id: "L", what: "Split B", balance: 200000, offsetBalance: 50000, rate: 6, termYears: 30, repaymentType: "PI", settlementDate: "2024-05-01" }, extra || {}); }

test("the share used to invest: blank is all of it, clamped to 0–100", function(){
  assert.equal(loanInvestShare(loan()), 1);
  assert.equal(loanInvestShare(loan({ investPct: "" })), 1);
  assert.equal(loanInvestShare(loan({ investPct: 0 })), 0);
  assert.equal(loanInvestShare(loan({ investPct: 40 })), 0.4);
  assert.equal(loanInvestShare(loan({ investPct: 140 })), 1);
});

test("only the invested share is deducted; the cash result still pays all the interest", function(){
  var all = loan(), home = loan({ id: "L2", investPct: 0 }), half = loan({ id: "L3", investPct: 50 });
  assert.equal(loanDeductibleInterestMonthly(home), 0);
  assert.ok(Math.abs(loanDeductibleInterestMonthly(half) - loanInterestMonthly(half) / 2) < 1e-9);
  var p = { id: "pp", kind: "IP", income: [], expenses: [], loans: [all, home, half] };
  var full = loanInterestMonthly(all) * 12;
  var keep = state.properties; state.properties = [p];
  try {
    var b = propertyTaxResultBreakdown(p);
    var row = b.rows.find(function(r){ return r.key === "interest"; });
    assert.ok(Math.abs(row.amount + full * 1.5) < 0.01, "all of one, none of one, half of one");
    assert.match(row.label, /share used to invest/);
    assert.ok(Math.abs(propertyCashResultAnnual(p) + full * 3) < 0.01);
    assert.ok(propertyTaxDeductibleResultAnnual(p) > propertyCashResultAnnual(p));
  } finally { state.properties = keep; }
});

test("a past year's schedule claims the invested share too", function(){
  var p = { id: "pq", kind: "IP", income: [], expenses: [], loans: [loan({ investPct: 25 })] };
  var keep = state.taxYears; state.taxYears = {};
  try {
    var exp = 150000 * 0.06 * 365 / 365 * 0.25;
    var got = rentalSchedule(p, 2025).lines.find(function(x){ return x.key === "interest"; }).model;
    assert.ok(Math.abs(got - exp) < 0.01, got + " vs " + exp);
  } finally { state.taxYears = keep; }
});
