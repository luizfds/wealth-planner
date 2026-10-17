import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
const { taxCalendarReminders } = await import("../src/lib/notifications.js");

test("tax calendar: June shows super cap room per person, over $1,000 only", () => {
  const r = taxCalendarReminders("2027-06-10", { people: [{ name: "Luiz", capRoom: 8200 }, { name: "Mariana", capRoom: 400 }] });
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "cap:2026:Luiz");
  assert.match(r[0].title, /\$8,200 of super cap left/);
  assert.match(r[0].detail, /FY26\/27/);
});
test("tax calendar: July nudges the worksheet until it's started", () => {
  assert.equal(taxCalendarReminders("2026-07-15", {})[0].id, "tyopen:2025");
  assert.deepEqual(taxCalendarReminders("2026-07-15", { worksheetStarted: true }), []);
});
test("tax calendar: October counts down, louder in the last week, gone once lodged", () => {
  const early = taxCalendarReminders("2026-10-10", {});
  assert.equal(early[0].severity, "warn");
  assert.match(early[0].title, /21 days left/);
  const late = taxCalendarReminders("2026-10-28", {});
  assert.equal(late[0].severity, "bad");
  assert.equal(late[0].id, "tydue:2025:week");
  assert.deepEqual(taxCalendarReminders("2026-10-28", { lodged: true }), []);
  assert.deepEqual(taxCalendarReminders("2026-11-02", {}), []);
});
test("tax calendar: quiet the rest of the year", () => {
  assert.deepEqual(taxCalendarReminders("2026-12-01", { people: [{ name: "A", capRoom: 9000 }] }), []);
});
