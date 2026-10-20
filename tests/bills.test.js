import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { occurrencesBetween, billsForMonth } from "../src/calc/bills.js";
import { billsCalendarHtml } from "../src/components/cashflow.js";
import { rulesPageHtml, setRuleField, ruleTest } from "../src/components/rules.js";

test("occurrences keep the anchor's day, clamped to short months", function(){
  assert.deepEqual(occurrencesBetween("2026-01-31", "Monthly", "2026-02-01", "2026-02-28"), ["2026-02-28"]);
  assert.deepEqual(occurrencesBetween("2026-01-31", "Monthly", "2026-03-01", "2026-03-31"), ["2026-03-31"]);
  assert.deepEqual(occurrencesBetween("2026-07-20", "Quarterly", "2026-10-01", "2026-10-31"), ["2026-10-20"]);
  assert.deepEqual(occurrencesBetween("2026-07-20", "Quarterly", "2026-09-01", "2026-09-30"), []);
  assert.deepEqual(occurrencesBetween("2026-09-28", "Fortnightly", "2026-10-01", "2026-10-31"), ["2026-10-12", "2026-10-26"]);
  assert.deepEqual(occurrencesBetween("2026-10-20", "Monthly", "2026-08-01", "2026-08-31"), ["2026-08-20"], "steps backwards too");
});

test("a month's bills: paid when logged near the date, overdue when past and not, undated when never logged", function(){
  var items = [
    { id: "a", what: "Phone", amount: 50, freq: "Monthly" },
    { id: "b", what: "Gym", amount: 20, freq: "Weekly" },
    { id: "c", what: "Rates", amount: 400, freq: "Quarterly" },
    { id: "d", what: "Travel", amount: 3000, freq: "Yearly", irregular: true }
  ];
  var tx = [{ linkedExpenseId: "a", date: "2026-09-03" }, { linkedExpenseId: "a", date: "2026-10-04" }, { linkedExpenseId: "b", date: "2026-10-02" }];
  var r = billsForMonth(items, tx, "2026-10", "2026-10-18");
  assert.equal(r.days["2026-10-04"][0].what, "Phone");
  assert.equal(r.days["2026-10-04"][0].paid, true);
  assert.equal(r.days["2026-10-09"][0].overdue, true);
  assert.equal(r.days["2026-10-23"][0].overdue, false);
  assert.deepEqual(r.undated.map(function(u){ return u.what; }), ["Rates"]);
  assert.equal(r.total, 50 + 20 * 5);
  var html = billsCalendarHtml(r, "2026-10", "2026-10-18");
  assert.match(html, /October 2026/);
  assert.match(html, /bc-bill paid" title="Phone \$50 — paid"/);
  assert.match(html, /1 regular line with no payment logged yet/);
  // 1 October 2026 is a Thursday: three blank cells before it
  assert.equal((html.match(/bc-cell is-blank/g) || []).length, 3);
});

test("import rules: list, test a description, edit a field", function(){
  var keep = { importRules: state.importRules, accounts: state.accounts, categories: state.categories };
  try {
    state.importRules = [{ id: "r1", match: "fern cafe", linkedExpenseId: "e1", category: "", account: "", hits: 3 }, { id: "r2", match: "bank one interest", incomeTarget: "income:x", account: "", hits: 1 }];
    state.accounts = [{ name: "Card" }];
    state.categories = ["Food"];
    ruleTest.text = "FERN CAFE 0042 NEWTOWN";
    var html = rulesPageHtml([{ id: "e1", what: "Coffee" }]);
    assert.match(html, /Matched by <b>“fern cafe”<\/b> → Coffee/);
    assert.match(html, /class="rl-row is-hit"/);
    assert.match(html, /3×/);
    assert.match(html, /data-rl-key="incomeTarget"/);
    assert.ok(setRuleField(0, "match", "  Fern Café North! "));
    assert.equal(state.importRules[0].match, "fern caf north");
    assert.equal(setRuleField(0, "match", "!!"), false);
    setRuleField(0, "category", "Food");
    setRuleField(0, "linkedExpenseId", "e2");
    assert.equal(state.importRules[0].category, "", "a line replaces a category");
  } finally { Object.assign(state, keep); ruleTest.text = ""; }
});

// ---------------- v3.83.0: bills vs spending budgets; card bills on the card payment ----------------
import { lineKind, inferredLineKind, cycleFor, repaymentFor, cardRepaymentDay, cardPaymentsForMonth } from "../src/calc/bills.js";

function weeklyShop(){
  // Three to five supermarket trips a week, all different amounts.
  var out = [], amts = [12.4, 87.9, 33.15, 140.2, 6.8];
  for(var d = 1; d <= 120; d++){
    if(d % 2 === 0 || d % 7 === 3){
      var dt = new Date(2026, 4, d);
      out.push({ date: dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0"), amount: amts[d % 5] });
    }
  }
  return out;
}
function monthly(day, amounts, account){
  return amounts.map(function(a, i){ return { date: "2026-" + String(3 + i).padStart(2, "0") + "-" + String(day).padStart(2, "0"), amount: a, account: account }; });
}

test("many varying purchases make a spending budget; a steady one a period stays a bill", function(){
  assert.equal(inferredLineKind({ freq: "Weekly" }, weeklyShop()), "spending");
  assert.equal(inferredLineKind({ freq: "Monthly" }, monthly(14, [19, 19, 19, 19, 19])), "bill");
  // Power varies a lot with the season but lands on the same day each month: still a bill.
  assert.equal(inferredLineKind({ freq: "Monthly" }, monthly(3, [90, 210, 160, 70, 240, 120])), "bill");
  // A pet budget: weekly line, scattered trips of very different size.
  var pet = [["2026-05-02", 18], ["2026-05-13", 64], ["2026-05-16", 9.5], ["2026-06-04", 120], ["2026-06-25", 22], ["2026-07-01", 7]].map(function(x){ return { date: x[0], amount: x[1] }; });
  assert.equal(inferredLineKind({ freq: "Weekly" }, pet), "spending");
  // Two memberships billed the same day each week: many payments, but identical amounts.
  var gym = [];
  for(var w = 0; w < 10; w++){ var d = new Date(2026, 6, 1 + w * 7); var s = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); gym.push({ date: s, amount: 16 }, { date: s, amount: 16 }); }
  assert.equal(inferredLineKind({ freq: "Weekly" }, gym), "bill");
  assert.equal(inferredLineKind({ freq: "Weekly" }, weeklyShop().slice(0, 2)), "bill", "too little logged to judge");
  assert.equal(lineKind({ freq: "Weekly", billKind: "bill" }, weeklyShop()), "bill", "the person's choice wins");
  assert.equal(lineKind({ freq: "Monthly", billKind: "spending" }, monthly(14, [19, 19, 19])), "spending");
});

test("a charge's statement cycle and the repayment that pays it", function(){
  assert.deepEqual(cycleFor("2026-10-05", 12), { start: "2026-09-12", end: "2026-10-11" });
  assert.deepEqual(cycleFor("2026-10-12", 12), { start: "2026-10-12", end: "2026-11-11" });
  assert.deepEqual(cycleFor("2026-03-01", 1), { start: "2026-03-01", end: "2026-03-31" });
  assert.equal(repaymentFor("2026-10-05", 12, 27), "2026-10-27");
  assert.equal(repaymentFor("2026-10-14", 12, 27), "2026-11-27");
  assert.equal(repaymentFor("2026-10-14", 12, 3), "2026-12-03", "closes 11 Nov, next 3rd after that");
  var tr = [{ to: "Card", date: "2026-07-26", amount: 900 }, { to: "Card", date: "2026-08-28", amount: 800 }, { to: "Card", date: "2026-09-27", amount: 700 }, { to: "Savings", date: "2026-09-02", amount: 50 }];
  assert.equal(cardRepaymentDay({ name: "Card" }, tr), 27);
  assert.equal(cardRepaymentDay({ name: "Other" }, tr), null);
});

test("the month's card payment: what the closed cycle charged, or the repayment once logged", function(){
  var accounts = [{ name: "Everyday", type: "everyday" }, { name: "Card", type: "credit", statementStartDay: 12 }];
  var transfers = [{ to: "Card", date: "2026-08-27", amount: 610 }, { to: "Card", date: "2026-09-27", amount: 540 }];
  var tx = [
    { date: "2026-09-15", amount: 100, account: "Card" }, { date: "2026-10-06", amount: 45.5, account: "Card" },
    { date: "2026-10-13", amount: 999, account: "Card" }, { date: "2026-09-12", amount: 70, account: "Everyday" }
  ];
  var oct = cardPaymentsForMonth(accounts, tx, transfers, "2026-10", "2026-10-15");
  assert.equal(oct.length, 1);
  assert.equal(oct[0].date, "2026-10-27");
  assert.deepEqual(oct[0].cycle, { start: "2026-09-12", end: "2026-10-11" });
  assert.equal(oct[0].amount, 145.5);
  assert.equal(oct[0].paid, false);
  var sep = cardPaymentsForMonth(accounts, tx, transfers, "2026-09", "2026-10-15");
  assert.equal(sep[0].paid, true);
  assert.equal(sep[0].amount, 540);
});

test("the calendar: spending budgets off the days, card bills grouped under the card payment", function(){
  var items = [
    { id: "ph", what: "Phone", amount: 40, freq: "Monthly" },
    { id: "pw", what: "Power", amount: 150, freq: "Monthly" },
    { id: "gr", what: "Groceries", amount: 200, freq: "Weekly" }
  ];
  var tx = monthly(14, [40, 40, 40, 40, 40, 40, 40], "Card").map(function(t){ t.linkedExpenseId = "ph"; return t; })
    .concat(monthly(3, [120, 180, 90, 150, 140, 160, 130], "Everyday").map(function(t){ t.linkedExpenseId = "pw"; return t; }))
    .concat(weeklyShop().map(function(t){ t.linkedExpenseId = "gr"; t.account = "Card"; return t; }));
  var accounts = [{ name: "Everyday", type: "everyday" }, { name: "Card", type: "credit", statementStartDay: 12 }];
  var transfers = [{ to: "Card", date: "2026-08-27", amount: 610 }, { to: "Card", date: "2026-09-27", amount: 540 }];
  var r = billsForMonth(items, tx, "2026-09", "2026-09-30", { accounts: accounts, transfers: transfers });
  assert.deepEqual(r.spending.map(function(s){ return s.what; }), ["Groceries"]);
  assert.equal(r.spending[0].budget, Math.round(200 * 52 / 12 * 100) / 100);
  assert.ok(!Object.keys(r.days).some(function(k){ return r.days[k].some(function(b){ return b.what === "Groceries"; }); }));
  assert.equal(r.days["2026-09-14"][0].card, "Card");
  assert.equal(r.days["2026-09-14"][0].payOn, "2026-10-27", "charged in the cycle that closes 11 Oct");
  assert.equal(r.days["2026-09-03"][0].card, "");
  assert.equal(r.directTotal, 150);
  assert.equal(r.cardTotal, 40);
  assert.equal(r.cardPayments[0].amount, 540);
  var html = billsCalendarHtml(r, "2026-09", "2026-09-30");
  assert.match(html, /bc-bill card-pay paid/);
  assert.match(html, /bc-bill on-card paid" title="Phone \$40 on the Card, paid with the 27 Oct repayment/);
  assert.match(html, /From your accounts/);
  assert.match(html, /Bills on the Card/);
  assert.match(html, /Spending budgets in September/);
  assert.match(html, /\$690 leaves your accounts: \$150 in bills, \$540 card payment/);
  assert.match(html, /data-bc-kind="gr"[^>]*>.*?<option value="" selected>Auto \(spending\)/);
});

test("a quarterly bill paid whenever the invoice arrives is still a bill", function(){
  var water = [["2025-11-27", 96], ["2026-03-11", 231], ["2026-04-29", 205], ["2026-06-03", 131], ["2026-08-25", 104]].map(function(x){ return { date: x[0], amount: x[1] }; });
  assert.equal(inferredLineKind({ freq: "Quarterly" }, water), "bill");
});

// ---------------- v3.84.0: ended and stopped bills; everything on the card in one payment ----------------
test("an ended line leaves the calendar; one that stopped being paid is asked about once", function(){
  var gymPays = [];
  for(var w = 0; w < 8; w++){ var d = new Date(2026, 1, 3 + w * 7); gymPays.push({ linkedExpenseId: "g", date: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"), amount: 21 }); }
  // last payment 24 Mar 2026
  var items = [{ id: "g", what: "Gym", amount: 21, freq: "Weekly" }];
  var r = billsForMonth(items, gymPays, "2026-10", "2026-10-18");
  assert.deepEqual(Object.keys(r.days), [], "no weekly overdue gym in October");
  assert.deepEqual(r.stopped, [{ id: "g", what: "Gym", last: "2026-03-24" }]);
  assert.match(billsCalendarHtml(r, "2026-10", "2026-10-18"), /data-bc-end="g" data-bc-end-date="2026-03-24"/);
  // March, when it was still being paid, is unchanged.
  assert.ok(billsForMonth(items, gymPays, "2026-03", "2026-10-18").days["2026-03-24"][0].paid);
  // Given an end date, it's simply gone — not asked about.
  items[0].endDate = "2026-03-24";
  var ended = billsForMonth(items, gymPays, "2026-10", "2026-10-18");
  assert.deepEqual(ended.stopped, []);
  assert.deepEqual(ended.kinds, []);
  // An end date mid-month keeps the dates up to it.
  items[0].endDate = "2026-03-12";
  assert.deepEqual(Object.keys(billsForMonth(items, gymPays, "2026-03", "2026-10-18").days), ["2026-03-03", "2026-03-10"]);
});

test("the card payment says what it pays for: bills, spending budgets and the rest", function(){
  var accounts = [{ name: "Card", type: "credit", statementStartDay: 12 }];
  var transfers = [{ to: "Card", date: "2026-08-27", amount: 610 }];
  var tx = [
    { date: "2026-09-15", amount: 30, account: "Card", linkedExpenseId: "b" },
    { date: "2026-09-20", amount: 75, account: "Card", linkedExpenseId: "s" },
    { date: "2026-09-22", amount: 12.5, account: "Card" }
  ];
  var p = cardPaymentsForMonth(accounts, tx, transfers, "2026-10", "2026-10-15", function(id){ return id === "b" ? "bill" : id === "s" ? "spending" : null; })[0];
  assert.equal(p.amount, 117.5);
  assert.deepEqual(p.split, { bills: 30, spending: 75, other: 12.5 });
});

// ---------------- v3.89.0: card payment reminders ----------------
import { cardPaymentReminders } from "../src/lib/notifications.js";
test("a card payment is announced a few days ahead, and nudged if it goes unlogged", function(){
  var accounts = [{ name: "Card", type: "credit", statementStartDay: 12 }];
  var transfers = [{ to: "Card", date: "2026-08-27", amount: 610 }];
  var tx = [{ date: "2026-09-20", amount: 300, account: "Card" }, { date: "2026-10-02", amount: 45, account: "Card" }];
  var soon = cardPaymentReminders(accounts, tx, transfers, "2026-10-24");
  assert.equal(soon.length, 1);
  assert.match(soon[0].title, /Card payment due in 3 days — about \$345/);
  assert.equal(soon[0].sub, "bills");
  assert.equal(cardPaymentReminders(accounts, tx, transfers, "2026-10-15").length, 0, "too early");
  var late = cardPaymentReminders(accounts, tx, transfers, "2026-10-30");
  assert.match(late[0].title, /not logged/);
  transfers.push({ to: "Card", date: "2026-10-27", amount: 345 });
  assert.equal(cardPaymentReminders(accounts, tx, transfers, "2026-10-30").length, 0, "paid");
});

// ---------------- v3.94.1: Home and the bell read the calendar ----------------
import { upcomingBills, billLineStatus } from "../src/calc/bills.js";
test("upcoming bills leave out ended lines, spending budgets, bills on a card and bills that stopped", function(){
  var items = [
    { id: "net", what: "Internet", amount: 70, freq: "Monthly" },
    { id: "gym", what: "Gym", amount: 21, freq: "Weekly", endDate: "2026-03-24" },
    { id: "old", what: "Old club", amount: 30, freq: "Monthly" },
    { id: "ph", what: "Phone", amount: 40, freq: "Monthly" },
    { id: "gr", what: "Groceries", amount: 200, freq: "Weekly" }
  ];
  var tx = monthly(29, [70, 70, 70, 70, 70, 70, 70], "Everyday").map(function(t){ t.linkedExpenseId = "net"; return t; })
    .concat(monthly(14, [40, 40, 40, 40, 40, 40, 40], "Card").map(function(t){ t.linkedExpenseId = "ph"; return t; }))
    .concat(weeklyShop().map(function(t){ t.linkedExpenseId = "gr"; t.account = "Card"; return t; }))
    .concat([{ linkedExpenseId: "gym", date: "2026-03-17", amount: 21 }, { linkedExpenseId: "gym", date: "2026-03-24", amount: 21 }])
    .concat([{ linkedExpenseId: "old", date: "2026-04-05", amount: 30 }, { linkedExpenseId: "old", date: "2026-05-05", amount: 30 }]);
  var accounts = [{ name: "Everyday", type: "everyday" }, { name: "Card", type: "credit", statementStartDay: 12 }];
  var transfers = [{ to: "Card", date: "2026-08-27", amount: 610 }, { to: "Card", date: "2026-09-27", amount: 540 }];
  var up = upcomingBills(items, tx, "2026-10-20", 14, { accounts: accounts, transfers: transfers });
  assert.deepEqual(up.map(function(b){ return b.what + "@" + b.due; }), ["Card payment@2026-10-27", "Internet@2026-10-29"]);
  assert.equal(billLineStatus(items[1], tx, "2026-10-20"), "ended");
  assert.equal(billLineStatus(items[2], tx, "2026-10-20"), "stopped");
  assert.equal(billLineStatus(items[4], tx, "2026-10-20"), "spending");
  assert.equal(billLineStatus(items[0], tx, "2026-10-20"), "bill");
});
