import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { fixedRateView, rentSummary, recordRentReview } from "../src/calc/propertylife.js";
import { billsForMonth } from "../src/calc/bills.js";

test("a fixed loan's expiry: months left and repayments at the rate after", function(){
  var loan = { what: "Loan A", balance: 400000, rate: 5.5, termYears: 25, repaymentType: "IO", fixedUntil: "2027-04-18", revertRate: 6.5, offsetBalance: 40000 };
  var v = fixedRateView(loan, "2026-10-18");
  assert.equal(Math.round(v.months), 6);
  assert.equal(v.rateAfter, 6.5);
  assert.equal(v.monthlyAfter, 1950, "interest only on 360,000 at 6.5%");
  assert.equal(fixedRateView(loan, "2026-10-18", 7).rateAfter, 7, "what-if wins");
  assert.equal(fixedRateView(Object.assign({}, loan, { fixedUntil: "" }), "2026-10-18"), null);
  assert.equal(fixedRateView(loan, "2027-05-01"), null, "already ended");
});

test("rent against the plan, with a vacancy, and a review that updates the row", function(){
  var p = { id: "p1", income: [{ amount: 500, freq: "Weekly" }], vacancies: [{ from: "2026-08-01", to: "2026-08-14" }] };
  var win = { start: "2026-07-01", end: "2026-09-29" };
  var log = [{ target: "rent:p1", date: "2026-07-10", amount: 2000 }, { target: "rent:p1", date: "2026-09-10", amount: 2100 }, { target: "rent:p2", date: "2026-09-10", amount: 999 }];
  var r = rentSummary(p, win, log);
  assert.equal(r.vacancyWeeks, 2);
  assert.equal(r.received, 4100);
  assert.ok(r.expected < r.planned);
  var rev = recordRentReview(p, "2026-10-01", 540);
  assert.equal(p.income[0].amount, 540);
  assert.equal(rev.from, 500);
  assert.equal(Math.round(rev.change * 100), 8);
});

test("a renewal with a due month and day lands on the calendar before it's ever paid", function(){
  var r = billsForMonth([{ id: "ins", what: "Landlord insurance", amount: 1400, freq: "Yearly", dueMonth: 11, dueDay: 20 }], [], "2026-11", "2026-10-18");
  assert.equal(r.days["2026-11-20"][0].what, "Landlord insurance");
  assert.equal(r.days["2026-11-20"][0].estimated, true);
  assert.equal(r.undated.length, 0);
});
