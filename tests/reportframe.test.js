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

// v3.119.0: income statement and where the money goes.
import { incomeStatementReport, moneyFlowReport } from "../src/calc/reports.js";
test("the income statement: money in by kind, spending by Needs/Wants, kept and the savings rate, with the plan", () => {
  const keep = { transactions: state.transactions, incomeLog: state.incomeLog };
  try {
    state.incomeLog = [{ date: "2026-08-15", amount: 5000, target: "net:Alex" }, { date: "2026-08-08", amount: 2000, target: "rent:p1" }];
    state.transactions = [{ date: "2026-08-03", amount: 3000, cls: "Needs" }, { date: "2026-08-20", amount: 1000, cls: "Wants" }];
    const win = { start: "2026-08-01", end: "2026-08-31", label: "Aug" };
    const r = incomeStatementReport({ win, today: "2026-09-01", classOf: t => t.cls, budgetLines: [{ amount: 1500, freq: "Monthly", classification: "Needs" }] });
    const v = k => r.rows.find(x => x.cells.line === k).cells.total;
    assert.deepEqual([v("Pay received"), v("Rent"), v("Total in"), v("Needs"), v("Wants"), v("Kept"), v("Savings rate")], [5000, 2000, 7000, 3000, 1000, 3000, 42.9]);
    assert.equal(r.rows.find(x => x.cells.line === "Needs").cells.plan, 1500);
    const f = moneyFlowReport({ win, today: "2026-09-01", classOf: t => t.cls });
    const node = id => f.chart.nodes.find(n => n.id === id);
    assert.equal(node("take").value, 5000, "take-home is the pay actually received");
    assert.equal(node("kept").value, 3000);
    const into = id => f.chart.links.filter(l => l.to === id).reduce((s, l) => s + l.value, 0);
    assert.ok(Math.abs(into("Needs") - 3000) < 0.01 && Math.abs(into("kept") - 3000) < 0.01, "what comes in is what goes out");
    assert.match(reportChartHtml(f.chart), /class="sk-band/);
  } finally { Object.assign(state, keep); }
});
