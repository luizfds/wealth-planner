// #457: Today's "Where you stand" — at most four figures, each labelled, linked, and "not known" rather than $0.
import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { standingFigures } from "../src/calc/standing.js";

const liquidity = { startCash: 20000, lowest: { balance: -1500, year: 2027, month: 2, now: false }, shortfall: 1500, monthsUnderReserve: 4, events: [{ what: "3 Example Ave" }] };
const label = m => ["Jan", "Feb"][m.month - 1] + " " + String(m.year).slice(2);

test("four figures at most, each with where it goes: left this month, a shortfall, the runway, rates up 2%", function(){
  const f = standingFigures({ month: { left: 1200, spent: 3400, planned: 4000, label: "this month" }, liquidity, emergency: { monthly: 3000, coveredMonths: 4.2, months: 6 },
    stress: { extraMonthly: 400, regularNetMonthly: 800 }, hasLoans: true, monthLabel: label });
  assert.equal(f.length, 4);
  assert.deepEqual(f.map(x => x.key), ["left", "cashlow", "runway", "stress"], "the planned surplus and the count of things waiting are said once elsewhere on Today");
  assert.deepEqual([f[0].label, f[0].value, f[0].tone, f[0].sub, f[0].go], ["Left this month", 1200, "good", "$3,400 of $4,000 spent", "spending"]);
  assert.deepEqual([f[1].value, f[1].tone, f[1].sub, f[1].go], [-1500, "bad", "end of Feb 27 · settlement included", "forecast"]);
  assert.deepEqual([f[2].value, f[2].tone, f[2].sub], [4.2, "warn", "of essentials · aim 6"]);
  assert.deepEqual([f[3].value, f[3].sub], [400, "a month more · still $800 left"]);
  const over = standingFigures({ month: { left: -250, spent: 900, planned: 0, label: "in Sep 2026" } })[0];
  assert.deepEqual([over.label, over.value, over.tone, over.sub], ["Left in Sep 2026", -250, "bad", "$900 spent"]);
});

test("not known is said, never $0: nothing received, no cash balance, no plan, no essentials; no loans, no rates figure", function(){
  const f = standingFigures({ month: null, liquidity: { startCash: null }, emergency: { monthly: 0, coveredMonths: null }, hasLoans: false });
  assert.deepEqual(f.map(x => x.key), ["left", "cashlow", "runway"], "no loans: nothing to stress");
  assert.equal(f[0].value, null);
  assert.match(f[0].sub, /Add income and spending/);
  assert.equal(f[1].value, null);
  assert.match(f[1].sub, /Record a cash or offset balance/);
  assert.equal(f[2].value, null);
  const nothingIn = standingFigures({ month: { left: null, spent: 300, planned: 900, label: "this month" } })[0];
  assert.deepEqual([nothingIn.value, nothingIn.sub, nothingIn.go], [null, "Log money received to know it", "income"]);
  const stressUnknown = standingFigures({ liquidity, hasLoans: true, stress: null }).find(x => x.key === "stress");
  assert.equal(stressUnknown.value, null);
});
