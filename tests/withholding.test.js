import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { projectWithholding } from "../src/calc/withholding.js";

// Invented figures throughout.
var r = { gross: 120000, totalTax: 30000, helpRepayment: 1200 };

test("the rest of the year is withheld at the year's average so far", function(){
  var p = projectWithholding({ asOf: "2026-12-31", gross: 60000, withheld: 15000 }, r, 2026);
  assert.equal(p.projectedWithheld, 30000);
  assert.equal(p.tax, 31200);
  assert.equal(p.outcome, -1200, "the HELP repayment isn't covered by ordinary withholding");
  assert.ok(Math.abs(p.elapsed - 184 / 365) < 1e-9);
});

test("over-withholding shows as a refund; a payslip past the plan's gross says so", function(){
  var p = projectWithholding({ asOf: "2027-03-31", gross: 95000, withheld: 26600 }, r, 2026);
  assert.equal(p.projectedWithheld, 33600);
  assert.equal(p.outcome, 2400);
  assert.equal(p.aheadOfPlan, false);
  assert.equal(projectWithholding({ asOf: "2027-05-31", gross: 125000, withheld: 30000 }, r, 2026).aheadOfPlan, true);
});

test("a payslip from another year, or nothing typed, gives no projection", function(){
  assert.deepEqual(projectWithholding({ asOf: "2026-06-30", gross: 1, withheld: 1 }, r, 2026), { stale: true, asOf: "2026-06-30", fy: 2026 });
  assert.equal(projectWithholding({ asOf: "", gross: 1 }, r, 2026), null);
  assert.equal(projectWithholding({ asOf: "2026-08-01", gross: 0 }, r, 2026), null);
});
