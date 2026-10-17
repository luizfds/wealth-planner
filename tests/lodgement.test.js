import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
const { lodgementStatus } = await import("../src/calc/taxyear.js");

test("lodgementStatus: mid-October is in season for the year just ended", () => {
  const s = lodgementStatus("2026-10-17");
  assert.equal(s.fy, 2025);
  assert.equal(s.due, "2026-10-31");
  assert.equal(s.daysLeft, 14);
  assert.equal(s.inSeason, true);
  assert.equal(s.afterDue, false);
});
test("lodgementStatus: 1 July opens the season; 31 October is the last day", () => {
  assert.equal(lodgementStatus("2026-07-01").inSeason, true);
  assert.equal(lodgementStatus("2026-07-01").daysLeft, 122);
  const last = lodgementStatus("2026-10-31");
  assert.equal(last.daysLeft, 0);
  assert.equal(last.inSeason, true);
});
test("lodgementStatus: after 31 October it's past due, still for the same year", () => {
  const s = lodgementStatus("2026-11-02");
  assert.equal(s.fy, 2025);
  assert.equal(s.afterDue, true);
  assert.equal(s.inSeason, false);
});
test("lodgementStatus: January to June look back at the previous October", () => {
  const s = lodgementStatus("2027-03-15");
  assert.equal(s.fy, 2025);
  assert.equal(s.due, "2026-10-31");
  assert.equal(s.afterDue, true);
});
