import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { loanPayoff, shiftMonths, propertyReturns, debtSchedule } from "../src/calc/assetreports.js";

test("months to pay a loan off, with an offset, and never when the repayment doesn't cover the interest", () => {
  assert.equal(loanPayoff(12000, 0, 1000, 0), 12);
  const plain = loanPayoff(300000, 6, 2000, 0), offset = loanPayoff(300000, 6, 2000, 50000);
  assert.ok(plain > 250 && plain < 320, String(plain)); assert.ok(offset < plain);
  assert.equal(loanPayoff(300000, 6, 1400, 0), null);
  assert.equal(loanPayoff(0, 6, 100, 0), 0);
  assert.equal(shiftMonths("2026-03-31", -1), "2026-02-28");
});

// An invented rental: 1 Example St.
const rental = () => ({ id: "p1", kind: "IP", what: "1 Example St", value: 660000, purchasePrice: 500000, purchaseDate: "2020-10-01",
  history: [{ date: "2024-06-30", value: 600000 }, { date: "2025-06-30", value: 620000 }, { date: "2025-10-01", value: 630000 }, { date: "2026-10-01", value: 660000 }],
  income: [{ what: "Rent", amount: 600, freq: "Weekly" }], expenses: [{ what: "Rates", amount: 2400, freq: "Yearly" }],
  loans: [{ id: "l1", balance: 400000, rate: 6, termYears: 25, repaymentType: "IO", repaymentMode: "auto", offsetBalance: 0, balanceHistory: [{ date: "2025-09-01", value: 400000 }] }] });

test("property returns: yields, cash before and after tax, the year's growth and total return, value each 30 June", () => {
  const [p] = propertyReturns([rental()], { today: "2026-10-15", rateOf: () => 0.37 });
  assert.equal(p.rent, 31200); assert.equal(p.expenses, 2400);
  assert.equal(Math.round(p.grossYield * 1000), 47);
  assert.equal(p.beforeRepay, 31200 - 2400 - 24000);
  assert.equal(p.afterRepay, p.beforeRepay); // interest only
  assert.equal(p.growth, 30000); assert.equal(p.equityGrowth, 30000);
  assert.equal(p.totalReturn, r2(30000 + p.beforeRepay + p.taxEffect));
  assert.ok(p.growthPa > 0.045 && p.growthPa < 0.05, String(p.growthPa));
  assert.equal(p.taxEffect, -r2(4800 * 0.37)); // a positive result is tax to pay
  assert.deepEqual(p.years.map(y => [y.label, y.value]), [["FY23/24", 600000], ["FY24/25", 620000], ["FY25/26", 630000], ["FY26/27", 660000]]);
});
function r2(n){ return Math.round(n * 100) / 100; }

test("loans and debts: interest by year, the deductible share, payoff; debts by balance", () => {
  const d = debtSchedule([rental()], [{ what: "Card", balance: 1200, history: [{ date: "2025-08-01", value: 900 }] }, { what: "Paid", balance: 0 }], { today: "2026-10-15" });
  assert.equal(d.rows.length, 2);
  const loan = d.rows[0];
  assert.equal(loan.interestLastYear, 24000); assert.equal(loan.deductibleLastYear, 24000);
  assert.ok(loan.interestOnly); assert.equal(loan.payoff, null);
  assert.equal(loan.then, 400000);
  assert.deepEqual([d.rows[1].balance, d.rows[1].then], [1200, 900]);
  assert.equal(d.lastLabel, "FY25/26");
});
