import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { parsePayslip, payFrequency, datesIn, amountsIn } from "../src/calc/payslip.js";

// v3.116.0: reading a payslip. An invented payslip from an invented employer.
const SLIP = [
  "Employer A Pty Ltd                         PAYSLIP",
  "Employee: Alex Example",
  "Pay period: 14/10/2026 to 27/10/2026        Pay date: 30 Oct 2026",
  "Description                 Hours   Rate      This Pay     YTD",
  "Ordinary hours              76.00   55.00     4,180.00     29,260.00",
  "Gross (before tax)                            4,180.00     29,260.00",
  "PAYG Tax                                      (1,021.00)   (7,147.00)",
  "Salary sacrifice - super                      200.00       1,400.00",
  "Net Pay                                       2,959.00",
  "Superannuation guarantee 12%                  501.60       3,511.20"
];

test("a payslip's this-pay and year-to-date figures, by their labels", () => {
  const p = parsePayslip(SLIP);
  assert.deepEqual([p.gross, p.tax, p.net, p.super, p.sacrifice], [4180, 1021, 2959, 501.6, 200]);
  assert.deepEqual(p.ytd, { gross: 29260, tax: 7147, super: 3511.2 });
  assert.deepEqual([p.periodStart, p.periodEnd, p.payDate], ["2026-10-14", "2026-10-27", "2026-10-30"]);
  assert.equal(payFrequency(p), "Fortnightly");
});

test("what isn't on the payslip stays empty rather than guessed", () => {
  const p = parsePayslip(["Net pay 1,000.00", "Period ending 31/10/2026"]);
  assert.equal(p.gross, null);
  assert.equal(p.ytd.gross, null);
  assert.equal(p.periodEnd, "2026-10-31");
  assert.equal(payFrequency(p), null);
});

test("dates and amounts on a line", () => {
  assert.deepEqual(datesIn("from 1/7/2026 to 2026-07-31, paid 3 Aug 2026"), ["2026-07-01", "2026-07-31", "2026-08-03"]);
  assert.deepEqual(amountsIn("Hours 38 rate 55.00 total $2,090.00 (12.50)"), [55, 2090, -12.5]);
});
