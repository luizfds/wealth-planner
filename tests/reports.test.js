import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { cashflowReport, categoryReport, netWorthReport, reportCsvRows } from "../src/calc/reports.js";
import { reportTableHtml } from "../src/components/reports.js";

function withState(fn){
  var keep = { transactions: state.transactions, incomeLog: state.incomeLog, assets: state.assets, debts: state.debts, properties: state.properties };
  try {
    state.transactions = [{ date: "2026-07-03", amount: 100, category: "Food" }, { date: "2026-08-09", amount: 50, category: "Food" }, { date: "2026-08-10", amount: 30, category: "Fun" }];
    state.incomeLog = [{ date: "2026-07-15", amount: 1000, target: "x" }];
    state.assets = [{ category: "Cash", amount: 2000 }, { category: "Shares", market: "ASX", amount: 3000 }];
    state.debts = [{ what: "Car loan", balance: 500 }];
    state.properties = [];
    fn();
  } finally { Object.assign(state, keep); }
}
var win = { start: "2026-07-01", end: "2027-06-30", label: "FY26/27" };

test("monthly cash flow runs month by month to today, with a total", function(){
  withState(function(){
    var r = cashflowReport({ win: win, today: "2026-08-20" });
    assert.deepEqual(r.rows.map(function(x){ return x.cells.month + ":" + x.cells.net + ":" + x.cells.running; }), ["Jul 26:900:900", "Aug 26:-80:820", "Total:820:820"]);
    assert.equal(r.subtitle, "FY26/27 so far");
    var csv = reportCsvRows(r);
    assert.deepEqual(csv.headers, ["Month", "Money in", "Money out", "Net", "Running"]);
    assert.deepEqual(csv.rows[0], ["Jul 26", 1000, 100, 900, 900]);
    assert.match(reportTableHtml(r), /<td class="num neg">−\$80<\/td>/);
  });
});

test("spending by category: a column per month, total and per-month average", function(){
  withState(function(){
    var r = categoryReport({ win: win, today: "2026-08-20" });
    assert.deepEqual(r.rows[0].cells, { cat: "Food", "2026-07": 100, "2026-08": 50, total: 150, avg: 75 });
    assert.equal(r.rows[r.rows.length - 1].cells.total, 180);
  });
});

test("net worth statement adds up to the app's net worth", function(){
  withState(function(){
    state.assets[0].history = [{ date: "2026-07-01", value: 1500 }, { date: "2026-08-20", value: 2000 }];
    var r = netWorthReport({ today: "2026-08-20" });
    var nw = r.rows.find(function(x){ return x.cells.item === "Net worth"; }).cells;
    assert.equal(nw.now, 4500);
    assert.equal(nw.month, null, "a month ago only the cash had been recorded — not comparable");
    assert.equal(nw.year, null);
    assert.ok(r.rows.some(function(x){ return x.cells.item === "Other debts" && x.cells.now === -500; }));
    assert.ok(!r.rows.some(function(x){ return /Adjustments/.test(x.cells.item); }));
    assert.equal(r.rows[r.rows.length - 1].cells.month, null);
    assert.match(r.note, /left blank rather than compared/);
    state.assets[1].history = [{ date: "2025-01-01", value: 2500 }];
    state.debts[0].history = [{ date: "2025-01-01", value: 800 }];
    state.assets[0].history.unshift({ date: "2025-01-01", value: 300 });
    var r2 = netWorthReport({ today: "2026-08-20" });
    assert.equal(r2.rows.find(function(x){ return x.cells.item === "Net worth"; }).cells.year, 2000);
    assert.equal(r2.rows[r2.rows.length - 1].cells.year, 2500);
  });
});
