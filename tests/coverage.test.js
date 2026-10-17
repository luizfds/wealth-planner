import { test } from "node:test";
import assert from "node:assert/strict";
import { coverageStart } from "../src/calc/history.js";

test("coverageStart: the latest first-logged date, and who started late", () => {
  const r = coverageStart([
    { label: "Shares", history: [{ date: "2026-09-02", value: 1 }, { date: "2026-10-01", value: 2 }] },
    { label: "Super", history: [{ date: "2026-09-20", value: 1 }] }
  ], "2026-10-17");
  assert.equal(r.from, "2026-09-20");
  assert.deepEqual(r.late, ["Super"]);
  assert.deepEqual(r.missing, []);
});
test("coverageStart: a record never logged pushes the start to today and is listed as missing", () => {
  const r = coverageStart([
    { label: "Shares", history: [{ date: "2026-09-02", value: 1 }] },
    { label: "Cash", history: [] }
  ], "2026-10-17");
  assert.equal(r.from, "2026-10-17");
  assert.deepEqual(r.missing, ["Cash"]);
  assert.deepEqual(r.late, ["Cash"]);
});
test("coverageStart: everything from the same day is not late", () => {
  const r = coverageStart([
    { label: "A", history: [{ date: "2026-01-01", value: 1 }] },
    { label: "B", history: [{ date: "2026-01-01", value: 1 }] }
  ], "2026-10-17");
  assert.equal(r.from, "2026-01-01");
  assert.deepEqual(r.late, []);
});
test("coverageStart: no records", () => {
  assert.deepEqual(coverageStart([], "2026-10-17"), { from: "2026-10-17", late: [], missing: [] });
});
