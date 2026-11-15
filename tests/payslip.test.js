import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { parsePayslip, payFrequency, datesIn, amountsIn, payslipYtdReview } from "../src/calc/payslip.js";

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

// v3.148.0: a layout that puts the summary column beside other figures, and names deductions
// "before tax" / "after tax". Invented, like the one above.
const SLIP2 = [
  "Ms Sam Example ( 0001 )                          Company     EMPLOYER B PTY LTD",
  "Pay Period   01.09.2026  -  30.09.2026",
  "Payment Date  24.09.2026",
  "Before Tax Earnings",
  "      Salary                    150.00                    6,000.00",
  "                                Total Gross                                     $6,400.00",
  "Before Tax Deductions",
  "                                Total Before Tax Deductions                     $0.00",
  "Total Taxable Gross Earnings                                                    $6,400.00",
  "      Phone Reimbursement                                         25.00",
  "Total After Tax Payments and Deductions                                         $25.00",
  "      Full Income tax                                            -1,310.00",
  "Total Net Pay                                                                   $5,115.00",
  "Super Fund SG                                                    768.00",
  "Annual (Hours)     80.00    0.00    80.00     Total Gross       $6,400.00     $19,200.00",
  "Personal (Hours)   20.00    0.00    20.00     Before Tax Deductions  $0.00     $0.00",
  "                                              Tax              -$1,310.00     -$3,930.00",
  "                                              After-Tax Payments  $25.00      $75.00",
  "                                              Employer Superannuation  $768.00  $2,304.00"
];
test("'before tax' and 'after tax' aren't the tax; a summary column beside other figures still gives the year to date", () => {
  const p = parsePayslip(SLIP2);
  assert.deepEqual([p.gross, p.tax, p.net, p.super], [6400, 1310, 5115, 768]);
  assert.deepEqual(p.ytd, { gross: 19200, tax: 3930, super: 2304 });
  assert.equal(payFrequency(p), "Monthly");
});


test("YTD review is read-only and distinguishes ready, duplicate, older and incomplete figures", () => {
  const slip={periodEnd:'2026-10-01',ytd:{gross:20000,tax:4000}}, saved={asOf:'2026-09-01',gross:10000,withheld:2000};
  const before=JSON.stringify({slip,saved});
  assert.equal(payslipYtdReview(slip,saved).status,'ready');
  assert.equal(payslipYtdReview(slip,{asOf:'2026-10-01',gross:20000,withheld:4000}).status,'same');
  assert.equal(payslipYtdReview(slip,{asOf:'2026-11-01',gross:30000,withheld:6000}).status,'older');
  assert.equal(payslipYtdReview({periodEnd:'2026-10-01',ytd:{gross:20000}},saved).status,'missing');
  assert.equal(JSON.stringify({slip,saved}),before);
});

test("invalid YTD dates and figures cannot be applied", () => {
  for(const slip of [{periodEnd:'2026-02-31',ytd:{gross:10000,tax:2000}}, {periodEnd:'2026-10-01',ytd:{gross:-100,tax:0}},
    {periodEnd:'2026-10-01',ytd:{gross:Infinity,tax:0}}, {periodEnd:'2026-10-01',ytd:{gross:10000,tax:NaN}}]){
    assert.deepEqual(payslipYtdReview(slip,null),{status:'invalid',value:null});
  }
});
