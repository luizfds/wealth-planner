import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { rangeWindow, compareWindow, monthsIn, spendingByGroup, change } from "../src/calc/reportframe.js";
import { categoryReport, cashflowReport } from "../src/calc/reports.js";
import { reportChartHtml } from "../src/lib/reportcharts.js";

// v3.118.0: the report frame. Invented figures.
test("windows: last 12 months crosses the financial year; quarter, month, custom, the header's year", () => {
  assert.deepEqual(rangeWindow("l12", "2026-10-27"), { start: "2025-11-01", end: "2026-10-27", label: "Last 12 months" });
  assert.equal(rangeWindow("quarter", "2026-10-27").start, "2026-10-01");
  assert.equal(rangeWindow("month", "2026-02-10").end, "2026-02-28");
  assert.equal(rangeWindow("custom", "2026-10-27", { from: "2026-01-01", to: "2026-03-31" }).end, "2026-03-31");
  assert.equal(rangeWindow("period", "2026-10-27", { yearWin: { start: "2026-07-01", end: "2027-06-30", label: "FY26/27" } }).label, "FY26/27");
});

test("comparisons: the period before, and the same dates a year earlier", () => {
  const w = { start: "2026-07-01", end: "2026-09-30" };
  assert.deepEqual([compareWindow(w, "prev").start, compareWindow(w, "prev").end], ["2026-03-31", "2026-06-30"]);
  assert.deepEqual([compareWindow(w, "lastyear").start, compareWindow(w, "lastyear").end], ["2025-07-01", "2025-09-30"]);
  assert.equal(compareWindow(w, "none"), null);
  assert.deepEqual(monthsIn({ start: "2025-11-01", end: "2026-10-27" }, "2026-10-27").length, 12);
  assert.deepEqual(change(120, 100), { diff: 20, pct: 0.2 });
});

test("spending grouped any way, compared, charted, drillable", () => {
  const keep = state.transactions;
  try {
    state.transactions = [
      { date: "2026-08-03", amount: 50, category: "Food" }, { date: "2026-09-04", amount: 30, category: "Fun" },
      { date: "2025-08-05", amount: 40, category: "Food" }
    ];
    const win = { start: "2026-07-01", end: "2026-09-30", label: "Q3" };
    assert.deepEqual(spendingByGroup(state.transactions, win, t => t.category), { Food: 50, Fun: 30 });
    const r = categoryReport({ win, today: "2026-10-01", cmpWin: compareWindow(win, "lastyear"), compareLabel: "a year earlier" });
    const food = r.rows.find(x => x.cells.cat === "Food");
    assert.deepEqual([food.cells.total, food.cells.cmp, food.cells.chg], [50, 40, 10]);
    assert.equal(food.drill, "Food");
    assert.match(reportChartHtml(r.chart), /<svg[^>]*>.*Food/s);
    const byFirstLetter = categoryReport({ win, today: "2026-10-01", groupOf: t => t.category[0], groupLabel: "Letter" });
    assert.deepEqual(byFirstLetter.rows.map(x => x.cells.cat), ["F", "Total"]);
    const cf = cashflowReport({ win, today: "2026-10-01" });
    assert.match(reportChartHtml(cf.chart), /Money in/);
  } finally { state.transactions = keep; }
});
