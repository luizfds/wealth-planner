// #457: Today's "Where you stand" — at most five figures, each labelled, linked, and "not known" rather than $0.
import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { standingFigures } from "../src/calc/standing.js";

const liquidity = { startCash: 20000, lowest: { balance: -1500, year: 2027, month: 2, now: false }, shortfall: 1500, monthsUnderReserve: 4, events: [{ what: "3 Example Ave" }] };
const label = m => ["Jan", "Feb"][m.month - 1] + " " + String(m.year).slice(2);

test("five figures at most, each with where it goes; a shortfall, a normal month, the runway, rates up 2%, what's next", function(){
  const f = standingFigures({ liquidity, surplus: 1200, scenario: "Renting", emergency: { monthly: 3000, coveredMonths: 4.2, months: 6 },
    stress: { extraMonthly: 400, regularNetMonthly: 800 }, hasLoans: true, todos: [{ title: "Check the cash rate" }, { title: "Review a payment" }], monthLabel: label });
  assert.equal(f.length, 5);
  assert.deepEqual(f.map(x => x.key), ["cashlow", "month", "runway", "stress", "next"]);
  assert.deepEqual([f[0].value, f[0].tone, f[0].sub, f[0].go], [-1500, "bad", "end of Feb 27 · settlement included", "insights"]);
  assert.deepEqual([f[1].value, f[1].sub], [1200, "left over · Renting"]);
  assert.deepEqual([f[2].value, f[2].tone, f[2].sub], [4.2, "warn", "of essentials · aim 6"]);
  assert.deepEqual([f[3].value, f[3].sub], [400, "a month more · still $800 left"]);
  assert.deepEqual([f[4].value, f[4].sub, f[4].go], [2, "Check the cash rate — and 1 more", "needs"]);
});

test("not known is said, never $0: no cash balance, no plan, no essentials; no loans, no rates figure", function(){
  const f = standingFigures({ liquidity: { startCash: null }, surplus: null, emergency: { monthly: 0, coveredMonths: null }, hasLoans: false, todos: [] });
  assert.deepEqual(f.map(x => x.key), ["cashlow", "month", "runway", "next"], "no loans: nothing to stress");
  assert.equal(f[0].value, null);
  assert.match(f[0].sub, /Record a cash or offset balance/);
  assert.equal(f[1].value, null);
  assert.equal(f[2].value, null);
  assert.deepEqual([f[3].value, f[3].tone, f[3].sub], [0, "good", "Nothing waiting"]);
  const stressUnknown = standingFigures({ liquidity, surplus: 0, hasLoans: true, stress: null, todos: [] }).find(x => x.key === "stress");
  assert.equal(stressUnknown.value, null);
});
