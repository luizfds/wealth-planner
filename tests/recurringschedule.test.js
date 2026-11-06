import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { recurrenceDates, recurringCandidates } from "../src/calc/recurringschedule.js";

test("monthly rules retain month-end across leap years", () => {
  const rule = { id: "synthetic-rent", startDate: "2024-01-31", frequency: "Monthly" };
  assert.deepEqual(recurrenceDates(rule, "2024-01-01", "2024-04-30"),
    ["2024-01-31", "2024-02-29", "2024-03-31", "2024-04-30"]);
  assert.deepEqual(recurrenceDates({ ...rule, startDate: "2025-01-30" }, "2025-01-01", "2025-04-30"),
    ["2025-01-30", "2025-02-28", "2025-03-30", "2025-04-30"]);
});

test("weekly, fortnightly and custom intervals support skipped preview windows", () => {
  const rule = { id: "synthetic-income", startDate: "2026-01-01", frequency: "Weekly" };
  assert.deepEqual(recurrenceDates(rule, "2026-01-09", "2026-01-23"), ["2026-01-15", "2026-01-22"]);
  assert.deepEqual(recurrenceDates({ ...rule, frequency: "Fortnightly" }, "2026-01-01", "2026-01-31"),
    ["2026-01-01", "2026-01-15", "2026-01-29"]);
  assert.deepEqual(recurrenceDates({ ...rule, frequency: "Custom", intervalDays: 10, endDate: "2026-01-24" },
    "2026-01-01", "2026-02-01"), ["2026-01-01", "2026-01-11", "2026-01-21"]);
});

test("already-recorded occurrences are not suggested again and edits preserve past keys", () => {
  const rule = { id: "synthetic-bill", startDate: "2026-01-31", frequency: "Monthly", amount: 30 };
  const existing = [{ recurringRuleId: "synthetic-bill", recurringOccurrenceDate: "2026-01-31", amount: 30 },
    { recurringRuleId: "different-rule", recurringOccurrenceDate: "2026-02-28", amount: 10 }];
  const before = JSON.stringify(existing);
  const candidates = recurringCandidates(rule, existing, "2026-01-01", "2026-03-31");
  assert.deepEqual(candidates.map(x => x.date), ["2026-02-28", "2026-03-31"]);
  assert.deepEqual(recurringCandidates({ ...rule, amount: 35 }, existing.concat(candidates),
    "2026-01-01", "2026-03-31"), []);
  assert.equal(JSON.stringify(existing), before);
  assert.deepEqual(recurringCandidates({ ...rule, enabled: false }, existing, "2026-01-01", "2026-03-31"), []);
});

test("invalid dates, invalid custom intervals and unbounded windows fail closed", () => {
  const rule = { id: "synthetic", startDate: "2026-02-30", frequency: "Monthly" };
  assert.deepEqual(recurrenceDates(rule, "2026-01-01", "2026-04-01"), []);
  assert.deepEqual(recurrenceDates({ ...rule, startDate: "2026-01-01", frequency: "Custom", intervalDays: 0 },
    "2026-01-01", "2026-02-01"), []);
  assert.deepEqual(recurrenceDates({ ...rule, startDate: "2026-01-01" }, "2026-01-01", "2028-01-01"), []);
  assert.deepEqual(recurringCandidates({ ...rule, id: "" }, [], "2026-01-01", "2026-04-01"), []);
});
