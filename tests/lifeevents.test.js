import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { eventEffects, eventMarkers, newEvent } from "../src/calc/lifeevents.js";

const events = [
  { kind: "child", what: "Baby", year: 2028, years: 18, amount: 15000 },
  { kind: "break", what: "Year off", year: 2027, years: 1, amount: 40000 },
  { kind: "lump", what: "Inheritance", year: 2030, amount: 100000 },
  { kind: "spend", what: "Old event", year: 2020, years: 10, amount: 5000 }
];

test("each event lands in its years: yearly costs and lost income, and a one-off at the start of its year", () => {
  // Projection year 1 is this calendar year's (2026) first twelve months.
  assert.deepEqual(eventEffects(events, 1, 2026), { yearly: 5000, lump: 0 });   // only the event already running
  assert.deepEqual(eventEffects(events, 2, 2026), { yearly: 45000, lump: 0 });  // 2027: the year off
  assert.deepEqual(eventEffects(events, 3, 2026), { yearly: 20000, lump: 0 });  // 2028: the child arrives
  assert.deepEqual(eventEffects(events, 5, 2026), { yearly: 20000, lump: 100000 });
  assert.deepEqual(eventEffects(events, 20, 2026), { yearly: 15000, lump: 0 });
  assert.deepEqual(eventEffects(events, 21, 2026), { yearly: 0, lump: 0 });     // 18 years later
});

test("markers sit where each event starts, inside the horizon", () => {
  assert.deepEqual(eventMarkers(events, 2026, 10), [{ x: 0, label: "Old event" }, { x: 1, label: "Year off" }, { x: 2, label: "Baby" }, { x: 4, label: "Inheritance" }]);
  assert.deepEqual(eventMarkers(events, 2026, 3).map(m => m.label), ["Old event", "Year off", "Baby"]);
  const e = newEvent("child", 2026, "ev1");
  assert.deepEqual(e, { id: "ev1", kind: "child", what: "A child", year: 2027, years: 18, amount: 15000 });
});
