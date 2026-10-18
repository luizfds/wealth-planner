import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { loanRateOn, recordRateChange, loanInterestForWindow, sortedRateHistory } from "../src/calc/property.js";
import { rentalSchedule } from "../src/calc/taxyear.js";
import { rateChangeNote } from "../src/components/properties.js";

// Loan rate history (v3.53.0), invented loan.
function loan(){ return { id: "L1", what: "Loan A", balance: 400000, offsetBalance: 100000, rate: 6, termYears: 30, repaymentType: "PI", settlementDate: "2024-03-01" }; }

test("recording a change keeps the old rate from settlement and makes the new one current", function(){
  var l = loan();
  var before = recordRateChange(l, "2025-11-15", 5.5, "2026-10-18");
  assert.equal(before, 6);
  assert.deepEqual(l.rateHistory, [{ date: "2024-03-01", rate: 6 }, { date: "2025-11-15", rate: 5.5 }]);
  assert.equal(l.rate, 5.5);
  assert.equal(loanRateOn(l, "2025-11-14"), 6);
  assert.equal(loanRateOn(l, "2025-11-15"), 5.5);
  assert.equal(loanRateOn(l, "2020-01-01"), 6, "before the first entry, the earliest rate");
  recordRateChange(l, "2027-02-01", 5.25, "2026-10-18");
  assert.equal(l.rate, 5.5, "a change dated in the future isn't the rate yet");
  recordRateChange(l, "2025-11-15", 5.6, "2026-10-18");
  assert.equal(sortedRateHistory(l).length, 3, "same date updates rather than duplicates");
});

test("a year's interest follows the rates that applied, on the interest balance", function(){
  var l = loan();
  recordRateChange(l, "2026-01-01", 5, "2026-10-18");
  // 300,000 at 6% for 184 days, then at 5% for 181 days.
  var exp = 300000 * (0.06 * 184 + 0.05 * 181) / 365;
  assert.ok(Math.abs(loanInterestForWindow(l, "2025-07-01", "2026-06-30") - exp) < 0.01);
  var p = { id: "p", kind: "IP", income: [], expenses: [], loans: [l] };
  var keep = state.taxYears; state.taxYears = {};
  try { assert.ok(Math.abs(rentalSchedule(p, 2025).lines.find(function(x){ return x.key === "interest"; }).model - exp) < 0.01); }
  finally { state.taxYears = keep; }
  var plain = loan();
  assert.ok(Math.abs(loanInterestForWindow(plain, "2025-07-01", "2026-06-30") - 300000 * 0.06) < 0.01, "no history: today's rate");
});

test("the note says what the latest change did", function(){
  var l = loan();
  recordRateChange(l, "2026-08-01", 6.25, "2026-10-18");
  assert.match(rateChangeNote(l), /Last change 2026-08-01: 6% → 6\.25% — repayment \$2,398 → \$2,463 a month \(\+\$65\), about \$750 more interest a year\./);
  assert.equal(rateChangeNote(loan()), "");
});
