import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
const { runLoan, loanStrategy } = await import("../src/calc/loanstrategy.js");
const { calcRepaymentMonthly, loanPaidOut, loanBalance, loanRepaymentMonthly, loanInterestMonthly } = await import("../src/calc/property.js");

test("runLoan: the scheduled repayment pays the loan off in its term", () => {
  const rep = calcRepaymentMonthly(500000, 6, 30, "PI");
  const r = runLoan(500000, 6, rep);
  assert.equal(r.months, 360);
  assert.ok(Math.abs(r.interest - (rep * 360 - 500000)) < 50);
});
test("runLoan: extra repayments and offset both shorten it; offset never repays by itself", () => {
  const rep = calcRepaymentMonthly(500000, 6, 30, "PI");
  assert.ok(runLoan(500000, 6, rep, { extra: 500 }).months < 300);
  assert.ok(runLoan(500000, 6, rep, { offset: 50000 }).months < 360);
  assert.equal(runLoan(500000, 6, 100).neverPaid, true);
});
test("loanStrategy: extra, offset, a rate change and a refinance break-even", () => {
  const loan = { balance: 400000, rate: 6.2, termYears: 25, repaymentType: "PI", offsetBalance: 0 };
  const s = loanStrategy(loan, { extra: 300, offsetAdd: 20000, newRate: 6.7, refiRate: 5.8, refiCosts: 1500, cashback: 2000 });
  assert.ok(s.extra.monthsSaved > 24 && s.extra.interestSaved > 40000, JSON.stringify(s.extra));
  assert.equal(s.offset.yearlySaved, 1240);
  assert.ok(s.rate.monthlyChange > 100 && s.rate.monthlyChange < 140, String(s.rate.monthlyChange));
  assert.ok(s.refi.monthlySaving > 80);
  assert.equal(s.refi.netCosts, -500);
  assert.equal(s.refi.breakEvenMonths, 0);
  const io = loanStrategy(Object.assign({}, loan, { repaymentType: "IO" }), { extra: 300, offsetAdd: 10000 });
  assert.equal(io.extra, undefined);
  assert.equal(io.offset.yearlySaved, 620);
});

test("runLoan: a loan still outstanding at the month cap is not paid off", () => {
  const r = runLoan(10000, 0, 100, { maxMonths: 12 });
  assert.equal(r.status, "capped");
  assert.equal(r.neverPaid, true);
  assert.equal(r.months, null);
  assert.equal(r.interest, null);
});

test("runLoan: an actual payoff at or before the cap is reported correctly", () => {
  const r = runLoan(1200, 0, 100, { maxMonths: 12 });
  assert.equal(r.status, "paid-off");
  assert.equal(r.neverPaid, false);
  assert.equal(r.months, 12);
  assert.equal(r.interest, 0);
  assert.equal(runLoan(0, 6, 0).status, "paid-off");
});

test("runLoan: non-amortising repayments and offsets do not imply payoff", () => {
  const noPayment = runLoan(10000, 6, 0);
  assert.equal(noPayment.status, "non-amortising");
  assert.equal(noPayment.months, null);
  const fullyOffset = runLoan(10000, 6, 0, { offset: 10000 });
  assert.equal(fullyOffset.status, "non-amortising");
  assert.equal(fullyOffset.neverPaid, true);
  assert.equal(runLoan(10000, 6, 100, { offset: 20000 }).status, "paid-off");
});

test("runLoan: invalid simulation month limits are rejected", () => {
  for(const maxMonths of [0, -1, 1.5, Infinity, NaN, "invalid"]){
    assert.throws(() => runLoan(10000, 0, 100, { maxMonths }), RangeError);
  }
});

test("loanStrategy: incomplete baseline does not produce false extra or offset savings", () => {
  const loan = { balance: 10000, rate: 0, termYears: 100, repaymentType: "PI", offsetBalance: 0 };
  const s = loanStrategy(loan, { extra: 1, offsetAdd: 100 });
  assert.equal(s.base.status, "capped");
  assert.equal(s.extra.monthsSaved, null);
  assert.equal(s.extra.interestSaved, null);
  assert.equal(s.offset.monthsSaved, null);
  assert.equal(s.offset.interestSaved, null);
});

test("a paid-out loan owes, charges and takes nothing from that date", () => {
  const l = { balance: 300000, rate: 6, termYears: 25, repaymentType: "PI", endedOn: "2026-01-01" };
  assert.equal(loanPaidOut(l, "2026-01-01"), true);
  assert.equal(loanPaidOut(l, "2025-12-31"), false);
  assert.equal(loanBalance(l, "2026-06-01"), 0);
  assert.equal(loanBalance(l, "2025-06-01"), 300000);
  assert.equal(loanRepaymentMonthly(l), 0);
  assert.equal(loanInterestMonthly(l), 0);
});

test("a past year's model interest stops at the payout date", async () => {
  const { rentalSchedule } = await import("../src/calc/taxyear.js");
  const { state } = await import("../src/state.js");
  const keep = state.taxYears; state.taxYears = {};
  try {
    const p = { id: "x", kind: "IP", income: [], expenses: [], loans: [{ balance: 120000, rate: 5, termYears: 25, repaymentType: "PI", endedOn: "2026-01-01" }] };
    const full = 120000 * 0.05;
    const share = (Date.parse("2026-01-01") - Date.parse("2025-07-01")) / (Date.parse("2026-06-30") - Date.parse("2025-07-01") + 86400000);
    const got = rentalSchedule(p, 2025).lines.find(l => l.key === "interest").model;
    assert.ok(Math.abs(got - full * share) < 0.01, got + " vs " + full * share);
    assert.equal(rentalSchedule(p, 2026).lines.find(l => l.key === "interest").model, 0);
  } finally { state.taxYears = keep; }
});
