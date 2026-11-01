import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { autoPayDates, autoPaysBetween, dueAutoPays, upcomingAutoPays, answerAutoPay, autoPayEvents, autoPayLineIds, makeAutoPay, matchedTransfers } from "../src/calc/autopay.js";
import { autoPayReminders } from "../src/lib/notifications.js";
import { forecastInputs } from "../src/calc/dailyforecast.js";

// An invented household: a loan repaid on the 15th from an everyday account, set up on 1 Oct.
function household(){
  return {
    accounts: [{ name: "Bank One Everyday", type: "everyday", balance: 5000, balanceDate: "2026-10-01" }, { name: "Home Loan", type: "loan" }, { name: "Saver", type: "savings" }],
    transfers: [], transactions: [], incomeLog: [], shared: [{ id: "lineLoan", what: "Loan repayment", amount: 2100, freq: "Monthly", account: "Bank One Everyday", category: "Housing" }],
    autoPayments: [{ id: "ap1", what: "Loan repayment", from: "Bank One Everyday", to: "Home Loan", amount: 2100, freq: "Monthly", start: "2026-01-15", asksFrom: "2026-10-01", answers: {} }]
  };
}
var seq = 0;
function newId(p){ return p + "-t" + (++seq); }

test("the days it falls on: monthly on the 15th, fortnightly from its start, a short month clamped", function(){
  var ap = household().autoPayments[0];
  assert.deepEqual(autoPayDates(ap, "2026-10-01", "2026-12-31"), ["2026-10-15", "2026-11-15", "2026-12-15"]);
  assert.deepEqual(autoPayDates(Object.assign({}, ap, { freq: "Fortnightly", start: "2026-10-02" }), "2026-10-01", "2026-10-31"), ["2026-10-02", "2026-10-16", "2026-10-30"]);
  assert.deepEqual(autoPayDates(Object.assign({}, ap, { start: "2026-01-31" }), "2026-02-01", "2026-03-31"), ["2026-02-28", "2026-03-31"]);
  // Nothing before its own start, nothing after `until`, nothing when it's half set up.
  assert.deepEqual(autoPayDates(Object.assign({}, ap, { start: "2026-11-15" }), "2026-10-01", "2026-11-30"), ["2026-11-15"]);
  assert.deepEqual(autoPayDates(Object.assign({}, ap, { until: "2026-10-31" }), "2026-10-01", "2026-12-31"), ["2026-10-15"]);
  assert.deepEqual(autoPayDates(Object.assign({}, ap, { to: "" }), "2026-10-01", "2026-12-31"), []);
  assert.deepEqual(autoPayDates(Object.assign({}, ap, { to: ap.from }), "2026-10-01", "2026-12-31"), []);
});

test("due on the day, not before; still asked about for a month; never before it was set up", function(){
  var st = household();
  assert.deepEqual(dueAutoPays(st, "2026-10-14"), []);
  var d = dueAutoPays(st, "2026-10-15");
  assert.equal(d.length, 1);
  assert.equal(d[0].date, "2026-10-15"); assert.equal(d[0].days, 0); assert.equal(d[0].amount, 2100);
  // Unanswered, the October one is still there in November alongside November's own.
  assert.deepEqual(dueAutoPays(st, "2026-11-15").map(function(p){ return p.date; }), ["2026-10-15", "2026-11-15"]);
  // September's fell before it was set up (asksFrom), so it's never asked about.
  assert.equal(autoPaysBetween(st, "2026-09-01", "2026-09-30", "2026-10-15")[0].status, "before");
  // And after ASK_DAYS, a forgotten one drops out.
  assert.deepEqual(dueAutoPays(st, "2026-12-14").map(function(p){ return p.date; }), ["2026-11-15"]);
  // The bell carries the same.
  var n = autoPayReminders(st, "2026-10-15");
  assert.equal(n.length, 1);
  assert.equal(n[0].id, "autopay:ap1:2026-10-15");
  assert.match(n[0].title, /today: did it go through\?/);
});

test("Yes records the transfer, tagged, and the payment stops being asked about", function(){
  var st = household();
  var r = answerAutoPay(st, "ap1", "2026-10-15", { paid: true }, newId);
  assert.deepEqual(Object.assign({}, r.transfer, { id: "" }), { id: "", date: "2026-10-15", amount: 2100, from: "Bank One Everyday", to: "Home Loan", what: "Loan repayment", autoPay: "ap1", autoPayDate: "2026-10-15" });
  assert.equal(st.transfers.length, 1);
  assert.deepEqual(dueAutoPays(st, "2026-10-15"), []);
  assert.equal(autoPaysBetween(st, "2026-10-15", "2026-10-15", "2026-10-15")[0].status, "paid");
  assert.equal(st.autoPayments[0].amount, 2100);
});

test("a different amount records that; kept, it's the amount from now on — once only, it isn't", function(){
  var st = household();
  answerAutoPay(st, "ap1", "2026-10-15", { paid: true, amount: 2155.4 }, newId);
  assert.equal(st.transfers[0].amount, 2155.4);
  assert.equal(st.autoPayments[0].amount, 2100);
  assert.equal(upcomingAutoPays(st, "2026-10-15", 40)[0].amount, 2100);
  var st2 = household();
  answerAutoPay(st2, "ap1", "2026-10-15", { paid: true, amount: 2155.4, keep: true }, newId);
  assert.equal(st2.autoPayments[0].amount, 2155.4);
  assert.equal(upcomingAutoPays(st2, "2026-10-15", 40)[0].amount, 2155.4);
  // What was paid stays what was paid.
  assert.equal(autoPaysBetween(st2, "2026-10-15", "2026-10-15", "2026-10-15")[0].amount, 2155.4);
});

test("Skipped records nothing; undo puts it back to ask; answering again replaces the transfer", function(){
  var st = household();
  answerAutoPay(st, "ap1", "2026-10-15", { skipped: true }, newId);
  assert.equal(st.transfers.length, 0);
  assert.deepEqual(dueAutoPays(st, "2026-10-15"), []);
  assert.equal(autoPaysBetween(st, "2026-10-15", "2026-10-15", "2026-10-15")[0].status, "skipped");
  answerAutoPay(st, "ap1", "2026-10-15", { undo: true });
  assert.equal(dueAutoPays(st, "2026-10-15").length, 1);
  answerAutoPay(st, "ap1", "2026-10-15", { paid: true }, newId);
  answerAutoPay(st, "ap1", "2026-10-15", { paid: true, amount: 2000 }, newId);
  assert.equal(st.transfers.length, 1);
  assert.equal(st.transfers[0].amount, 2000);
  var r = answerAutoPay(st, "ap1", "2026-10-15", { undo: true });
  assert.equal(r.removed.amount, 2000);
  assert.equal(st.transfers.length, 0);
  // A zero amount isn't an answer.
  assert.equal(answerAutoPay(st, "ap1", "2026-10-15", { paid: true, amount: 0 }, newId), null);
  assert.equal(answerAutoPay(st, "nope", "2026-10-15", { paid: true }, newId), null);
});

test("a transfer logged another way within three days answers it — and isn't counted for two dates", function(){
  var st = household();
  st.transfers.push({ id: "imp1", date: "2026-10-16", amount: 2100, from: "Bank One Everyday", to: "Home Loan", what: "Imported" });
  assert.deepEqual(dueAutoPays(st, "2026-10-17"), []);
  var p = autoPaysBetween(st, "2026-10-15", "2026-10-15", "2026-10-17")[0];
  assert.equal(p.status, "paid"); assert.equal(p.matched, true);
  // Too far off, or the wrong accounts, doesn't.
  var st2 = household();
  st2.transfers.push({ id: "imp2", date: "2026-10-20", amount: 2100, from: "Bank One Everyday", to: "Home Loan" }, { id: "imp3", date: "2026-10-15", amount: 2100, from: "Saver", to: "Home Loan" });
  assert.equal(dueAutoPays(st2, "2026-10-20").length, 1);
  // One transfer, two candidate dates (weekly, 7 days apart, transfer between): only one is answered.
  var ap = Object.assign({}, household().autoPayments[0], { freq: "Weekly", start: "2026-10-05" });
  var m = matchedTransfers(ap, ["2026-10-05", "2026-10-12"], [{ id: "t", date: "2026-10-08", amount: 2100, from: ap.from, to: ap.to }]);
  assert.equal(Object.keys(m).length, 1);
});

test("on the calendar and the 90 days: out of one account, into the other; its Budget line not counted twice", function(){
  var st = household();
  var ev = autoPayEvents(st, "Bank One Everyday", "2026-10-01", "2026-12-31");
  assert.deepEqual(ev.map(function(e){ return [e.date, e.amount, e.kind]; }), [["2026-10-15", -2100, "autopay"], ["2026-11-15", -2100, "autopay"], ["2026-12-15", -2100, "autopay"]]);
  assert.deepEqual(autoPayEvents(st, "Home Loan", "2026-10-01", "2026-10-31").map(function(e){ return e.amount; }), [2100]);
  assert.deepEqual(autoPayEvents(st, "Saver", "2026-10-01", "2026-12-31"), []);
  // Today's own is the bell's question, not the forecast's.
  assert.deepEqual(autoPayEvents(st, "Bank One Everyday", "2026-10-15", "2026-10-31"), []);
  // Standing for the Budget line, the line itself drops out of the forecast.
  var without = forecastInputs(st, st.accounts[0], "2026-10-01", 90);
  st.autoPayments[0].line = "lineLoan";
  assert.deepEqual(autoPayLineIds(st), { lineLoan: true });
  var withLine = forecastInputs(st, st.accounts[0], "2026-10-01", 90);
  var loanOut = function(inp){ return inp.events.filter(function(e){ return /Loan repayment/.test(e.what); }).length; };
  assert.equal(loanOut(withLine), 3);
  assert.ok(loanOut(without) >= 3);
});

test("a new one from a form: today is when it starts asking", function(){
  var ap = makeAutoPay({ from: "A", to: "B", amount: "120.456", freq: "Fortnightly", start: "2026-09-04", what: " Saving " }, "2026-10-20", "apX");
  assert.deepEqual(ap, { id: "apX", what: "Saving", from: "A", to: "B", amount: 120.46, freq: "Fortnightly", start: "2026-09-04", asksFrom: "2026-10-20", answers: {} });
  assert.equal(makeAutoPay({ freq: "Daily" }, "2026-10-20", "y").freq, "Monthly");
});
