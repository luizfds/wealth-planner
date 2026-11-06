import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { validateRecurringRule, approvedOccurrences, recurringRuleManagerHtml } from "../src/components/recurringrules.js";

const rule = { id: "example-rule", what: "Sample service", kind: "Expense", amount: 25,
  frequency: "Monthly", startDate: "2024-01-31", endDate: "", category: "Utilities", enabled: true };

test("approved recurring rules are validated before saving", () => {
  assert.equal(validateRecurringRule(rule).what, "Sample service");
  assert.equal(validateRecurringRule({ ...rule, amount: -10 }), null);
  assert.equal(validateRecurringRule({ ...rule, frequency: "Custom", intervalDays: 0 }), null);
  assert.equal(validateRecurringRule({ ...rule, startDate: "2024-02-30" }), null);
  assert.equal(validateRecurringRule({ ...rule, endDate: "2023-01-01" }), null);
  assert.equal(validateRecurringRule({ ...rule, endDate: "2024-02-30" }), null);
  assert.equal(validateRecurringRule({ ...rule, endDate: "2025-02-29" }), null);
  assert.equal(validateRecurringRule({ ...rule, endDate: "2024-02-29" }).endDate, "2024-02-29");
  assert.equal(validateRecurringRule({ ...rule, frequency: "Custom", intervalDays: 9 }).intervalDays, 9);
});

test("approved occurrences are idempotent across previews, edits and cancellations", () => {
  const existing = [];
  const first = approvedOccurrences(rule, existing, [], "2024-01-01", "2024-03-31");
  assert.deepEqual(first.map(x => x.date), ["2024-01-31", "2024-02-29", "2024-03-31"]);
  assert.equal(first[0].linkedExpenseId, null);
  assert.equal(first[0].recurringRuleId, rule.id);
  const second = approvedOccurrences({ ...rule, amount: 29, category: "Bills" }, first, [], "2024-01-01", "2024-03-31");
  assert.deepEqual(second, []);
  assert.deepEqual(approvedOccurrences({ ...rule, enabled: false }, existing, [], "2024-01-01", "2024-03-31"), []);
});

test("income and expense rules have separate local occurrence logs", () => {
  const income = { ...rule, kind: "Income", what: "Sample income" };
  const recorded = approvedOccurrences(income, [], [], "2024-01-01", "2024-01-31");
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].target, "");
  assert.equal(approvedOccurrences(income, [], recorded, "2024-01-01", "2024-01-31").length, 0);
});

test("rule management escapes labels and exposes explicit controls", () => {
  const html = recurringRuleManagerHtml([{ ...rule, what: "<script>alert(1)</script>" }], [], [], "2026-11-06", null);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /data-rr-edit="example-rule"/);
  assert.match(html, /data-rr-preview="example-rule"/);
  assert.match(html, /data-rr-toggle="example-rule"/);
  assert.match(html, /data-rr-delete="example-rule"/);
  assert.match(html, /id="recurringRuleForm"/);
  assert.match(html, /only recorded after you preview and confirm/);
});


test("changing rule type preserves occurrence identity across both logs", () => {
  const first = approvedOccurrences(rule, [], [], "2024-01-01", "2024-01-31");
  assert.deepEqual(approvedOccurrences({ ...rule, kind: "Income" }, first, [],
    "2024-01-01", "2024-01-31"), []);
  const income = approvedOccurrences({ ...rule, kind: "Income" }, [], [], "2024-01-01", "2024-01-31");
  assert.deepEqual(approvedOccurrences(rule, [], income, "2024-01-01", "2024-01-31"), []);
});
