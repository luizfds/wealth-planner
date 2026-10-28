import test from "node:test";
import assert from "node:assert/strict";
import { recordNetWorth, backfillNetWorth, netWorthMovers, isAutoPoint } from "../src/calc/nwauto.js";
import { thinPriceHistory } from "../src/calc/pricesheet.js";

test("the day's net worth: one point a day, today's updated in place", () => {
  const log = [{ date: "2026-10-01", value: 1000 }];
  assert.equal(recordNetWorth(log, 1100, "2026-10-28"), true);
  assert.deepEqual(log[1], { date: "2026-10-28", value: 1100, auto: true });
  assert.equal(recordNetWorth(log, 1150.257, "2026-10-28"), true);
  assert.equal(log.length, 2); assert.equal(log[1].value, 1150.26);
  assert.equal(recordNetWorth(log, 1150.26, "2026-10-28"), false);
  assert.equal(recordNetWorth(log, NaN, "2026-10-29"), false);
});

test("earlier weeks rebuilt where every record has a value, never over a point that's there", () => {
  // Invented: a rebuild that knows everything back to 30 Aug, then is missing a record.
  const rebuild = d => d >= "2026-08-30" ? { total: 500 + Number(d.slice(8, 10)), partial: [] } : { total: 1, partial: ["a fund"] };
  const log = [{ date: "2026-10-14", value: 999 }];   // a hand-recorded point in the week ending 18 Oct
  const added = backfillNetWorth(log, rebuild, "2026-10-28", 104);
  const dates = log.map(p => p.date);
  assert.ok(!dates.includes("2026-10-18"), "that week already has a point");
  assert.ok(dates.includes("2026-10-25") && dates.includes("2026-08-30"));
  assert.ok(!dates.some(d => d < "2026-08-30"), "stops at the first week a record is missing");
  assert.equal(added, 8);
  assert.deepEqual(dates, [...dates].sort());
  assert.ok(log.filter(p => p.derived).every(p => p.value === 500 + Number(p.date.slice(8, 10))));
});

test("what moved net worth, biggest first, loans as they move it", () => {
  const from = { assets: { Cash: 10000, Shares: 5000 }, property: 800000, offsets: 20000, loans: 600000, debts: 0 };
  const to = { assets: { Cash: 12000, Shares: 5100 }, property: 770000, offsets: 21000, loans: 595000, debts: 0 };
  const m = netWorthMovers(from, to);
  assert.deepEqual(m.map(r => [r.label, r.change]), [["Property value", -30000], ["Property loans", 5000], ["Cash", 2000], ["Offset balances", 1000], ["Shares", 100]]);
});

test("net worth history thins its own points, never ones recorded by hand", () => {
  const log = [];
  for(let t = Date.parse("2024-01-01T00:00:00Z"); t <= Date.parse("2026-10-28T00:00:00Z"); t += 864e5) log.push({ date: new Date(t).toISOString().slice(0, 10), value: 1, auto: true });
  log.push({ date: "2024-03-13", value: 2 }); log.sort((a, b) => a.date < b.date ? -1 : 1);
  assert.ok(thinPriceHistory(log, "2026-10-28", isAutoPoint) > 500);
  assert.ok(log.some(p => p.date === "2024-03-13" && p.value === 2 && !p.auto));
  assert.ok(log.some(p => p.date === "2026-10-27"));
});
