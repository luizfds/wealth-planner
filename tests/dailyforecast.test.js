import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { state, setState, migrateState } from "../src/state.js";
import { dailyBalance, payEvents, accountForecast, forecastWarnings } from "../src/calc/dailyforecast.js";

test("each pay and bill lands on its own day, and spending comes off every day", function(){
  var f = dailyBalance({ start: 1000, today: "2026-11-01", days: 10, spendDaily: 10, buffer: 500,
    events: [{ date: "2026-11-03", amount: -800, what: "Rent" }, { date: "2026-11-05", amount: 2000, what: "Pay" }, { date: "2026-11-01", amount: -99, what: "Already in today's balance" }] });
  assert.equal(f.points.length, 11);
  assert.deepEqual(f.points.slice(0, 7).map(function(p){ return [p.date, p.balance]; }),
    [["2026-11-01", 1000], ["2026-11-02", 990], ["2026-11-03", 180], ["2026-11-04", 170], ["2026-11-05", 2160], ["2026-11-06", 2150], ["2026-11-07", 2140]]);
  assert.deepEqual(f.lowest, { date: "2026-11-04", balance: 170 });
  assert.deepEqual(f.below, { date: "2026-11-03", balance: 180 });
  assert.equal(f.end, 2100); // 1,000 − 800 + 2,000 − 10 days × $10
  assert.equal(dailyBalance({ start: 1000, today: "2026-11-01", days: 3, events: [], spendDaily: 0, buffer: "" }).below, null, "no buffer, no warning");
});

test("pay is read from what has landed in the account, on its rhythm, at its last amount", function(){
  var log = [
    { date: "2026-09-10", amount: 2400, account: "Bank One Everyday", target: "net:Alex" },
    { date: "2026-09-24", amount: 2400, account: "Bank One Everyday", target: "net:Alex" },
    { date: "2026-10-08", amount: 2400, account: "Bank One Everyday", target: "net:Alex" },
    { date: "2026-10-22", amount: 2450, account: "Bank One Everyday", target: "net:Alex" },
    { date: "2026-10-15", amount: 900, account: "Bank One Saver", target: "net:Sam" }
  ];
  assert.deepEqual(payEvents(log, "Bank One Everyday", "2026-11-01", "2026-12-01").map(function(e){ return [e.date, e.amount]; }),
    [["2026-11-05", 2450], ["2026-11-19", 2450]]);
});

test("an invented month from a household: the balance rolls, the bills land on their days, and the warning shows", function(){
  var keep = state;
  try {
    setState(migrateState({
      scenarios: ["Today"], baselineScenario: "Today", scenarioModel: 2,
      assets: [{ id: "c1", what: "Bank One Everyday", category: "Cash", amount: 1500, history: [{ date: "2026-10-31", value: 1500 }] }],
      accounts: [{ id: "a1", name: "Bank One Everyday", type: "everyday", link: "asset:c1", buffer: 400 }],
      shared: [
        { id: "rent", what: "Rent", amount: 2600, freq: "Monthly", account: "Bank One Everyday", homeCost: true },
        { id: "power", what: "Power", amount: 180, freq: "Monthly", account: "Bank One Everyday" }
      ],
      transactions: [
        { date: "2026-08-02", what: "Rent", amount: 2600, account: "Bank One Everyday", linkedExpenseId: "rent" },
        { date: "2026-09-02", what: "Rent", amount: 2600, account: "Bank One Everyday", linkedExpenseId: "rent" },
        { date: "2026-10-02", what: "Rent", amount: 2600, account: "Bank One Everyday", linkedExpenseId: "rent" },
        { date: "2026-08-18", what: "Power", amount: 180, account: "Bank One Everyday", linkedExpenseId: "power" },
        { date: "2026-09-18", what: "Power", amount: 180, account: "Bank One Everyday", linkedExpenseId: "power" },
        { date: "2026-10-18", what: "Power", amount: 180, account: "Bank One Everyday", linkedExpenseId: "power" },
        { date: "2026-10-20", what: "Fern Café", amount: 450, account: "Bank One Everyday" }
      ],
      incomeLog: [
        { date: "2026-09-12", amount: 1800, account: "Bank One Everyday", target: "net:Alex" },
        { date: "2026-09-26", amount: 1800, account: "Bank One Everyday", target: "net:Alex" },
        { date: "2026-10-10", amount: 1800, account: "Bank One Everyday", target: "net:Alex" },
        { date: "2026-10-24", amount: 1800, account: "Bank One Everyday", target: "net:Alex" }
      ]
    }));
    var f = accountForecast(state, state.accounts[0], "2026-10-31", 35);
    assert.equal(f.points[0].balance, 1500);
    var on = function(d){ return f.points.find(function(p){ return p.date === d; }); };
    assert.deepEqual(on("2026-11-02").events.map(function(e){ return [e.what, e.amount]; }), [["Rent", -2600]]);
    assert.deepEqual(on("2026-11-07").events.map(function(e){ return [e.kind, e.amount]; }), [["pay", 1800]]);
    assert.deepEqual(on("2026-11-18").events.map(function(e){ return [e.what, e.amount]; }), [["Power", -180]]);
    assert.deepEqual(on("2026-12-02").events.map(function(e){ return e.what; }), ["Rent"]);
    assert.equal(f.spendDaily, 5, "$450 of day-to-day spending over 90 days");
    // 1,500 − 2 days × $5 − 2,600 = −1,110 on 2 November, under the $400 buffer from that day; the
    // lowest is the day before pay, 6 November: −1,110 − 4 × $5 = −1,130.
    assert.deepEqual(f.below, { date: "2026-11-02", balance: -1110 });
    assert.deepEqual(f.lowest, { date: "2026-11-06", balance: -1130 });
    assert.equal(forecastWarnings(state, "2026-10-31").length, 1);
    state.accounts[0].buffer = "";
    assert.equal(forecastWarnings(state, "2026-10-31").length, 0);
  } finally { setState(keep); }
});
