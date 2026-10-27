import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { niceScale } from "../src/lib/charts.js";
import { fmtDate, localDateStr } from "../src/lib/format.js";
import { netWorthReport } from "../src/calc/reports.js";

// v3.105.0 polish pass. Invented figures.
test("niceScale puts gridlines on round numbers", function(){
  var s = niceScale(582338, 2911689, 5);
  assert.deepEqual([s.min, s.max, s.step], [500000, 3000000, 500000]);
  assert.equal(s.ticks, 5);
  var z = niceScale(0, 47.3, 4);
  assert.deepEqual([z.min, z.max, z.step, z.ticks], [0, 60, 20, 3]);
  var neg = niceScale(-1234, 5678, 5);
  assert.ok(neg.min <= -1234 && neg.max >= 5678 && neg.min % neg.step === 0);
});

test("fmtDate: day and month, the year only when it isn't this one", function(){
  var y = localDateStr().slice(0, 4);
  assert.equal(fmtDate(y + "-10-04"), "4 Oct");
  assert.equal(fmtDate("2019-01-31"), "31 Jan 2019");
  assert.equal(fmtDate(y + "-03-09", { year: true }), "9 Mar " + y);
  assert.equal(fmtDate("now"), "now");
  assert.equal(fmtDate(null), "");
});

test("the net worth statement leaves an earlier total blank when it would leave something out", function(){
  var keep = { assets: state.assets, properties: state.properties, debts: state.debts };
  try {
    state.properties = []; state.debts = [];
    state.assets = [
      { what: "Fund", category: "Shares", amount: 3000, history: [{ date: "2026-08-01", value: 2800 }, { date: "2026-10-01", value: 3000 }] },
      { what: "Savings", category: "Cash", amount: 9000, history: [{ date: "2026-10-01", value: 9000 }] }
    ];
    var r = netWorthReport({ today: "2026-10-20" });
    var owned = r.rows.find(function(x){ return x.cells.item === "Total owned"; }).cells;
    assert.equal(owned.now, 12000);
    assert.equal(owned.month, null, "Savings wasn't recorded a month ago, so there's no total to show");
    assert.equal(r.subtitle, "as at 20 Oct 2026");
  } finally { Object.assign(state, keep); }
});
