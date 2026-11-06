import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { planningReadiness, reportDisclosure, reportDisclosureRows } from "../src/calc/planningreadiness.js";
import { planningReadinessHtml, reportDisclosureHtml } from "../src/components/reports.js";

test("new, partial and complete synthetic profiles show honest progress", () => {
  const empty = planningReadiness({}, "2026-11-06");
  assert.equal(empty.done, 0);
  assert.equal(empty.total, 5);
  assert.equal(empty.complete, false);
  assert.deepEqual(empty.missing, ["Income", "Expenses", "Assets and property", "Loans and debts", "Goals"]);
  const partial = planningReadiness({ income: [{amount: 100}], shared: [{amount: 30}] }, "2026-11-06");
  assert.equal(partial.done, 2);
  const full = planningReadiness({
    income: [{}], shared: [{}], assets: [{}], debts: [{}], goals: [{}]
  }, "2026-11-06");
  assert.equal(full.done, 5);
  assert.equal(full.complete, true);
});

test("missing debt is optional but never interpreted as a zero debt balance", () => {
  const r = planningReadiness({ income: [{}], transactions: [{}], properties: [{}], savingsGoals: [{}] }, "2026-11-06");
  assert.equal(r.done, 4);
  assert.deepEqual(r.missing, ["Loans and debts"]);
  const html = planningReadinessHtml({ income: [{}] }, "2026-11-06");
  assert.match(html, /role="region" aria-label="Planning setup progress"/);
  assert.match(html, /missing loan entry does not imply you have no debt/);
});

test("report disclosures include as-of date, stale flag and model limitations", () => {
  const s = { savedAt: "2026-01-01T00:00:00.000Z", income: [{}] };
  const info = reportDisclosure(s, "2026-11-06", { note: "Synthetic report uses estimates." });
  assert.equal(info.asOf, "2026-11-06");
  assert.equal(info.progress, "1/5");
  assert.ok(info.warnings.some(x => x.includes("90 days")));
  assert.ok(info.warnings.some(x => x.includes("Unentered sections")));
  assert.ok(info.assumptions.some(x => x.includes("Synthetic report")));
  const rows = reportDisclosureRows(info);
  assert.ok(rows.some(x => x[0] === "As of" && x[1] === "2026-11-06"));
  assert.ok(rows.some(x => x[0] === "Assumption / limitation"));
  assert.match(reportDisclosureHtml(info, true), /<details open>/);
});

test("readiness report escapes any user-supplied report notes", () => {
  const info = reportDisclosure({}, "2026-11-06", { note: "<script>bad()</script>" });
  const html = reportDisclosureHtml(info);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.equal(planningReadiness({savedAt:"2026-11-01"}, "2026-11-06").stale, false);
});
