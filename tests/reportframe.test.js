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

import { budgetActualReport, trendsReport } from "../src/calc/reports.js";
test("budget vs actual: a month-by-month variance per line, shaded, lumpy lines judged on their total", (t) => {
  const keep = state.transactions; t.after(() => { state.transactions = keep; });
  state.transactions = [
    { id: "a", date: "2026-08-03", amount: 650, linkedExpenseId: "food" },
    { id: "b", date: "2026-09-04", amount: 480, linkedExpenseId: "food" },
    { id: "c", date: "2026-09-20", amount: 900, linkedExpenseId: "car" }
  ];
  var lines = [
    { id: "food", what: "Groceries", amount: 500, freq: "Monthly" },
    { id: "car", what: "Car rego", amount: 800, freq: "Yearly" },
    { id: "gone", what: "Nothing logged", amount: 0, freq: "Monthly" }
  ];
  var r = budgetActualReport({ today: "2026-09-30", win: { start: "2026-08-01", end: "2026-09-30", label: "Aug–Sep" }, budgetLines: lines });
  assert.equal(r.rows.length, 3);
  var food = r.rows.find(function(x){ return x.cells.line === "Groceries"; });
  assert.equal(food.cells["2026-08"], 150); assert.equal(food.heat["2026-08"], 2);
  assert.equal(food.cells["2026-09"], -20); assert.equal(food.heat["2026-09"], 0);
  assert.equal(food.cells.diff, 130);
  var car = r.rows.find(function(x){ return x.cells.line === "Car rego"; });
  assert.ok(car.lumpy); assert.equal(car.cells["2026-09"], 900); assert.equal(car.heat["2026-09"], undefined);
  assert.equal(car.cells.plan, 133.33); assert.equal(car.heat.diff, 3);
  assert.equal(r.rows[0].cells.line, "Car rego"); // biggest difference first
  assert.equal(r.rows[2].cls, "total"); assert.equal(r.rows[2].cells.actual, 2030);
});
test("year on year: the last 12 months against the 12 before, by group", (t) => {
  const keep = state.transactions; t.after(() => { state.transactions = keep; });
  state.transactions = [
    { date: "2026-03-01", amount: 300, category: "Eating out" },
    { date: "2025-03-01", amount: 200, category: "Eating out" },
    { date: "2026-05-01", amount: 90, category: "Pets" }
  ];
  var thin = trendsReport({ today: "2026-09-15" });
  assert.equal(thin.rows[0].cells.pct, null); assert.match(thin.note, /Only 1 of the 12/);
  for(let m = 10; m <= 21; m++){ const d = new Date(2024, m - 1, 10); state.transactions.push({ date: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-10", amount: 0, category: "Pets" }); }
  var r = trendsReport({ today: "2026-09-15" });
  var eat = r.rows.find(function(x){ return x.cells.cat === "Eating out"; });
  assert.equal(eat.cells.cur, 300); assert.equal(eat.cells.prev, 200); assert.equal(eat.cells.chg, 100); assert.equal(eat.cells.pct, 50);
  var pets = r.rows.find(function(x){ return x.cells.cat === "Pets"; });
  assert.equal(pets.cells.pct, null);
  assert.equal(r.rows[r.rows.length - 1].cells.cur, 390);
  assert.equal(r.chart.items.length, 2);
});

import { lenderPackReport, yearInReviewReport } from "../src/calc/reports.js";
test("the lender pack: 12 whole months of income and spending, commitments, and what's owned and owed", (t) => {
  const keep = { tx: state.transactions, log: state.incomeLog, as: state.assets, pr: state.properties, de: state.debts };
  t.after(() => { state.transactions = keep.tx; state.incomeLog = keep.log; state.assets = keep.as; state.properties = keep.pr; state.debts = keep.de; });
  state.transactions = [{ date: "2026-05-02", amount: 1200 }, { date: "2026-10-02", amount: 999 }];
  state.incomeLog = [{ date: "2026-06-15", amount: 6000, target: "other" }];
  state.assets = [{ what: "Savings", category: "Cash", amount: 20000 }];
  state.properties = []; state.debts = [{ what: "Card", balance: 500 }];
  const r = lenderPackReport({ today: "2026-10-20" });
  const cell = (item) => r.rows.find(x => x.cells.item === item);
  assert.equal(cell("Received in the 12 months").cells.year, 6000);
  assert.equal(cell("Living expenses").cells.year, 1200); // October isn't a whole month yet
  assert.equal(cell("Living expenses").cells.month, 100);
  assert.equal(cell("Total assets").cells.year, 20000); assert.equal(cell("Total liabilities").cells.year, 500);
  assert.equal(cell("Net position").cells.year, 19500);
  assert.match(r.subtitle, /30 Sep 2026/);
});
test("the year in review tells the last finished year in sentences", (t) => {
  const keep = { tx: state.transactions, log: state.incomeLog, as: state.assets, pr: state.properties, de: state.debts };
  t.after(() => { state.transactions = keep.tx; state.incomeLog = keep.log; state.assets = keep.as; state.properties = keep.pr; state.debts = keep.de; });
  state.transactions = [{ date: "2026-02-02", amount: 4000, category: "Travel" }, { date: "2026-03-02", amount: 1000, category: "Groceries" }];
  state.incomeLog = [{ date: "2026-01-15", amount: 10000, target: "other" }];
  state.assets = [{ what: "Savings", category: "Cash", amount: 30000, history: [{ date: "2025-06-01", value: 20000 }, { date: "2026-06-30", value: 25000 }] }];
  state.properties = []; state.debts = [];
  const r = yearInReviewReport({ today: "2026-10-20" });
  assert.match(r.subtitle, /FY25\/26/);
  assert.match(r.narrative[0], /from \$20,000 to \$25,000 — up \$5,000/);
  assert.match(r.narrative[1], /50% of what came in was kept/);
  assert.match(r.narrative[2], /travel \(\$4,000\) and groceries/);
});
