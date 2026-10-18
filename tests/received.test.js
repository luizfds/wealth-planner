import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { incomeTargets, incomeActuals, logIncomeReceived, deleteIncomeReceived, receivedFor } from "../src/calc/received.js";

// Income received (v3.46.0), on an invented household: one person's take-home, a Net side income,
// a quarterly bonus marked irregular, a rental paid net of a computed agent fee, and an ETF.
function household(){
  return {
    income: [
      { id: "inc1", what: "Pay", person: "Alex", incomeType: "Gross", amount: 96000, freq: "Yearly" },
      { syntheticNetFor: "Alex", computed: true, what: "Alex — Net income", incomeType: "Net", amount: 6000, freq: "Monthly" },
      { id: "inc2", what: "Tutoring", incomeType: "Net", amount: 100, freq: "Weekly" },
      { id: "inc3", what: "Bonus (net)", incomeType: "Net", amount: 3000, freq: "Yearly", irregular: true },
      { syntheticRentForProperty: "r1", computed: true, what: "9 Sample Ave — Rent", incomeType: "Net", amount: 2000, freq: "Monthly" }
    ],
    properties: [{ id: "r1", what: "9 Sample Ave", kind: "IP", income: [{ what: "Rent", amount: 2000, freq: "Monthly" }],
      expenses: [{ id: "pmFee7", computed: true, what: "Agent fee", amount: 140, freq: "Monthly" }, { what: "Rates", amount: 500, freq: "Quarterly" }] }],
    assets: [{ what: "Cash", category: "Cash" }, { what: "ETFX", category: "Shares", quantity: 200, dividendPerUnit: 1.5, payouts: [] }],
    incomeLog: [],
    yearBasis: "financial"
  };
}
function withState(fn){
  var keys = ["income", "properties", "assets", "incomeLog", "yearBasis"];
  var keep = {};
  keys.forEach(function(k){ keep[k] = state[k]; });
  try { Object.assign(state, household()); fn(); } finally { keys.forEach(function(k){ state[k] = keep[k]; }); }
}

test("targets: take-home per person, Net rows, rent after the agent's fee, holdings", function(){
  withState(function(){
    var t = incomeTargets();
    assert.deepEqual(t.map(function(x){ return x.key; }), ["net:Alex", "income:inc2", "income:inc3", "rent:r1", "payout:1"]);
    var by = {}; t.forEach(function(x){ by[x.key] = x; });
    assert.equal(by["net:Alex"].monthly, 6000);
    assert.ok(Math.abs(by["income:inc2"].monthly - 100 * 52 / 12) < 1e-9);
    assert.equal(by["rent:r1"].monthly, 1860, "rent less the computed fee, not less the rates");
    assert.equal(by["payout:1"].yearly, 300);
    assert.ok(by["income:inc3"].irregular && by["payout:1"].irregular);
  });
});

test("a regular line is judged on the month, an irregular one on the year", function(){
  withState(function(){
    logIncomeReceived({ target: "net:Alex", amount: 5900, date: "2026-10-02" });
    logIncomeReceived({ target: "net:Alex", amount: 6100, date: "2026-09-30" });
    logIncomeReceived({ target: "income:inc3", amount: 1500, date: "2026-08-15" });
    var rows = incomeActuals("2026-10");
    var net = rows.find(function(r){ return r.key === "net:Alex"; });
    assert.equal(net.received, 5900);
    assert.equal(net.planned, 6000);
    assert.equal(net.period, "this month");
    var bonus = rows.find(function(r){ return r.key === "income:inc3"; });
    assert.equal(bonus.planned, 3000);
    assert.match(bonus.period, /^FY/);
  });
});

test("a distribution is written to the holding's payouts, and deleting it takes it back off", function(){
  withState(function(){
    var rec = logIncomeReceived({ target: "payout:1", amount: 72.5, date: "2026-07-16", what: "Q4 distribution" });
    assert.equal(state.assets[1].payouts.length, 1);
    assert.equal(state.assets[1].payouts[0].cash, 72.5);
    assert.equal(state.incomeLog.length, 0, "not recorded twice");
    assert.equal(receivedFor("payout:1", "2026-07-01", "2027-06-30")[0].amount, 72.5);
    var restore = deleteIncomeReceived(rec.id);
    assert.equal(state.assets[1].payouts.length, 0);
    restore();
    assert.equal(state.assets[1].payouts.length, 1);
  });
});

test("nothing is logged without an amount or a target, and amounts are stored positive", function(){
  withState(function(){
    assert.equal(logIncomeReceived({ target: "net:Alex", amount: 0 }), null);
    assert.equal(logIncomeReceived({ target: "", amount: 10 }), null);
    assert.equal(logIncomeReceived({ target: "payout:9", amount: 10 }), null);
    var r = logIncomeReceived({ target: "rent:r1", amount: -1860, date: "2026-10-05" });
    assert.equal(r.amount, 1860);
    assert.equal(deleteIncomeReceived("nope"), null);
  });
});
