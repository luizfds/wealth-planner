import test from "node:test";
import assert from "node:assert/strict";
import { SHOW_AS, showAsOption, fromMonthly, DEFAULT_HOURS_PER_WEEK } from "../src/calc/showas.js";

test("a monthly figure per year, month, fortnight, week, day and hour", () => {
  // Invented: $5,200 a month.
  assert.equal(fromMonthly(5200, "year"), 62400);
  assert.equal(fromMonthly(5200, "month"), 5200);
  assert.equal(fromMonthly(5200, "fortnight"), 2400);
  assert.equal(fromMonthly(5200, "week"), 1200);
  assert.equal(Math.round(fromMonthly(5200, "day") * 100) / 100, 170.96);
  assert.equal(fromMonthly(5200, "hour", 40), 30);
  assert.equal(Math.round(fromMonthly(5200, "hour", DEFAULT_HOURS_PER_WEEK) * 100) / 100, 31.58);
  // Per hour needs someone's hours.
  assert.equal(fromMonthly(5200, "hour", 0), null);
  assert.equal(fromMonthly(5200, "hour", null), null);
});

test("show-as options: an unknown key reads as monthly", () => {
  assert.deepEqual(SHOW_AS.map(o => o.key), ["year", "month", "fortnight", "week", "day", "hour"]);
  assert.equal(showAsOption("nonsense").key, "month");
  assert.equal(showAsOption("week").suffix, "/wk");
});
