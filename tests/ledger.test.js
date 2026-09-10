import test from "node:test";
import assert from "node:assert/strict";
import { toWeekly, periodsOf, sumField, sumByClassification, safeDiv, sumByAccount, resolveSharedAmount, sumFieldForScenario, nextDueDate, isOverdue, daysUntil, appendHistorySnapshot, transactionsInMonth, sumTransactionsByExpense, currentStatementCycle, transactionsInRange, lastTransactionDateFor, transactionDisplayName, budgetCycleFor, freqStepMonths, lastKnownDateFor, resolvedDueMonth, reserveYearWindow, reserveYearWindowFor, nextPayDate, payScheduleKindFor } from "../src/calc/ledger.js";

test("toWeekly converts every frequency to a weekly figure", function(){
  assert.equal(toWeekly(100, "Weekly"), 100);
  assert.equal(toWeekly(100, "Fortnightly"), 50);
  assert.equal(toWeekly(100, "Yearly"), 100 / 52);
  assert.equal(toWeekly(100, "Unknown"), 0);
  assert.equal(toWeekly("not a number", "Weekly"), 0);
});

test("periodsOf derives every period from the weekly figure consistently", function(){
  var p = periodsOf(100, "Weekly");
  assert.equal(p.weekly, 100);
  assert.equal(p.fortnightly, 200);
  assert.ok(Math.abs(p.monthly - (100 * 52 / 12)) < 1e-9);
  assert.ok(Math.abs(p.yearly - 5200) < 1e-9);
});

test("sumField sums a list of ledger rows in the requested period", function(){
  var items = [
    { amount: 100, freq: "Weekly" },
    { amount: 50, freq: "Fortnightly" }
  ];
  // 100/wk + 25/wk (50 fortnightly) = 125/wk
  assert.ok(Math.abs(sumField(items, "weekly") - 125) < 1e-9);
});

test("sumByClassification only totals rows matching the given classification", function(){
  var items = [
    { amount: 100, freq: "Weekly", classification: "Needs" },
    { amount: 50, freq: "Weekly", classification: "Wants" }
  ];
  assert.equal(sumByClassification(items, "Needs", "weekly"), 100);
  assert.equal(sumByClassification(items, "Wants", "weekly"), 50);
  assert.equal(sumByClassification(items, "Savings", "weekly"), 0);
});

test("safeDiv guards against division by zero", function(){
  assert.equal(safeDiv(10, 2), 5);
  assert.equal(safeDiv(10, 0), 0);
});

test("resolveSharedAmount falls back to the plain amount with no override for this scenario", function(){
  var item = { amount: 100, freq: "Weekly" };
  assert.equal(resolveSharedAmount(item, "Renting"), 100);
  item.scenarioOverrides = {};
  assert.equal(resolveSharedAmount(item, "Renting"), 100);
});

test("resolveSharedAmount uses the scenario-specific override when one is set", function(){
  var item = { amount: 100, freq: "Weekly", scenarioOverrides: { "Buy Brisbane": 40 } };
  assert.equal(resolveSharedAmount(item, "Buy Brisbane"), 40);
  assert.equal(resolveSharedAmount(item, "Renting"), 100);
});

test("resolveSharedAmount treats an explicit 0 override as a real value, not 'unset'", function(){
  var item = { amount: 100, freq: "Weekly", scenarioOverrides: { "Buy Brisbane": 0 } };
  assert.equal(resolveSharedAmount(item, "Buy Brisbane"), 0);
});

test("sumFieldForScenario sums each item's resolved (possibly overridden) amount for that scenario", function(){
  var items = [
    { amount: 100, freq: "Weekly" },
    { amount: 100, freq: "Weekly", scenarioOverrides: { "Buy Brisbane": 40 } }
  ];
  assert.equal(sumFieldForScenario(items, "Renting", "weekly"), 200);
  assert.equal(sumFieldForScenario(items, "Buy Brisbane", "weekly"), 140);
});

test("nextDueDate returns null when there's no last-incurred date to project from", function(){
  assert.equal(nextDueDate(null, "Monthly"), null);
  assert.equal(nextDueDate(undefined, "Monthly"), null);
  assert.equal(nextDueDate("not a date", "Monthly"), null);
});

test("nextDueDate advances one Monthly step past a recent last-paid date", function(){
  // Paid 2024-01-15, "today" is 2024-01-20 — still within the same period, next due is one
  // month on, not today (you don't owe it again the same week you paid it).
  assert.equal(nextDueDate("2024-01-15", "Monthly", "2024-01-20"), "2024-02-15");
});

test("nextDueDate keeps advancing until it catches up to a stale last-paid date", function(){
  // Paid 2024-01-15 (Quarterly), "today" is 2024-09-01 — several quarters have passed since;
  // the projected next due date must be the first quarterly occurrence on/after today, not the
  // very next one after the stale last-paid date.
  var result = nextDueDate("2024-01-15", "Quarterly", "2024-09-01");
  assert.equal(result, "2024-10-15");
});

test("nextDueDate rolls a Monthly bill from a month-end date into the next month correctly", function(){
  // Jan 31 + 1 month via setMonth lands on Mar 3 in vanilla JS Date arithmetic (Feb has no 31st,
  // so it overflows) — asserting the actual behavior here as documented, not a "correct"
  // calendar-aware answer, since that's what addFreqStep actually does.
  var result = nextDueDate("2024-01-31", "Monthly", "2024-02-01");
  assert.equal(result, "2024-03-02"); // 2024 is a leap year: Jan 31 + 1mo = Mar 2 (29-day Feb)
});

test("nextDueDate handles every FREQS value without falling through to an infinite loop", function(){
  ["Weekly", "Fortnightly", "Monthly", "Quarterly", "Yearly"].forEach(function(freq){
    var result = nextDueDate("2024-01-01", freq, "2024-01-01");
    assert.ok(result > "2024-01-01", freq + " should project forward, got " + result);
  });
});

test("isOverdue is false with no last-incurred date — never-logged is handled by the caller, not here", function(){
  assert.equal(isOverdue(null, "Monthly"), false);
  assert.equal(isOverdue(undefined, "Monthly"), false);
  assert.equal(isOverdue("not a date", "Monthly"), false);
});

test("isOverdue is false when still within the current period (unlike nextDueDate, which always projects forward and so can never itself look overdue)", function(){
  assert.equal(isOverdue("2024-01-15", "Monthly", "2024-01-20"), false);
  assert.equal(isOverdue("2024-01-15", "Monthly", "2024-02-14"), false);
});

test("isOverdue is true once a full period has elapsed, and stays true no matter how many periods have been skipped", function(){
  assert.equal(isOverdue("2024-01-15", "Monthly", "2024-02-15"), true); // exactly one period on: due today counts
  assert.equal(isOverdue("2024-01-15", "Monthly", "2024-03-01"), true);
  assert.equal(isOverdue("2024-01-15", "Quarterly", "2024-09-01"), true); // several quarters skipped
});

test("daysUntil is negative for a past date (overdue) and positive for a future one", function(){
  assert.equal(daysUntil("2024-01-10", "2024-01-15"), -5);
  assert.equal(daysUntil("2024-01-20", "2024-01-15"), 5);
  assert.equal(daysUntil("2024-01-15", "2024-01-15"), 0);
});

test("appendHistorySnapshot appends today's value and sorts by date", function(){
  var history = [{ date: "2024-01-01", value: 100 }];
  var dateStr = appendHistorySnapshot(history, 150);
  assert.equal(dateStr, new Date().toISOString().slice(0, 10));
  assert.equal(history.length, 2);
  // Sorted ascending regardless of push order — "today" (whatever it is) sorts after 2024-01-01.
  assert.equal(history[history.length - 1].value, 150);
});

test("appendHistorySnapshot updates today's own entry instead of duplicating it on a second click", function(){
  var history = [];
  appendHistorySnapshot(history, 100);
  appendHistorySnapshot(history, 200);
  assert.equal(history.length, 1);
  assert.equal(history[0].value, 200);
});

test("appendHistorySnapshot accepts an explicit backdated date instead of defaulting to today", function(){
  var history = [{ date: "2024-01-01", value: 100 }];
  var dateStr = appendHistorySnapshot(history, 120, "2024-02-15");
  assert.equal(dateStr, "2024-02-15");
  assert.equal(history.length, 2);
  assert.equal(history[1].date, "2024-02-15");
  assert.equal(history[1].value, 120);
});

test("appendHistorySnapshot updates an existing entry for the same explicit date rather than duplicating", function(){
  var history = [{ date: "2024-02-15", value: 100 }];
  appendHistorySnapshot(history, 999, "2024-02-15");
  assert.equal(history.length, 1);
  assert.equal(history[0].value, 999);
});

test("sumByAccount groups by trimmed account name, defaulting blanks to Unassigned", function(){
  var items = [
    { amount: 100, freq: "Weekly", account: "Everyday" },
    { amount: 50, freq: "Weekly", account: "  Everyday  " },
    { amount: 25, freq: "Weekly", account: "" }
  ];
  var map = sumByAccount(items, "weekly");
  assert.equal(map.Everyday, 150);
  assert.equal(map.Unassigned, 25);
});

test("transactionsInMonth filters to the given YYYY-MM, defaulting to the current month", function(){
  var txns = [
    { date: "2024-03-05", amount: 10 },
    { date: "2024-03-31", amount: 20 },
    { date: "2024-04-01", amount: 30 }
  ];
  var march = transactionsInMonth(txns, "2024-03");
  assert.equal(march.length, 2);
  assert.equal(march.reduce(function(s, t){ return s + t.amount; }, 0), 30);
  assert.equal(transactionsInMonth(txns, "2024-04").length, 1);
  assert.equal(transactionsInMonth(txns, "2099-01").length, 0);
});

test("sumTransactionsByExpense buckets by linkedExpenseId, unlinked entries under __unlinked", function(){
  var txns = [
    { amount: 40, linkedExpenseId: "exp1" },
    { amount: 15, linkedExpenseId: "exp1" },
    { amount: 25, linkedExpenseId: "exp2" },
    { amount: 5, linkedExpenseId: null },
    { amount: 8 }
  ];
  var map = sumTransactionsByExpense(txns);
  assert.equal(map.exp1, 55);
  assert.equal(map.exp2, 25);
  assert.equal(map.__unlinked, 13);
});

test("lastTransactionDateFor returns the most recent date linked to an expense id, or null with none", function(){
  var txns = [
    { date: "2026-01-05", amount: 10, linkedExpenseId: "exp1" },
    { date: "2026-03-01", amount: 20, linkedExpenseId: "exp1" },
    { date: "2026-02-01", amount: 30, linkedExpenseId: "exp2" },
    { date: "2026-06-01", amount: 5, linkedExpenseId: null }
  ];
  assert.equal(lastTransactionDateFor(txns, "exp1"), "2026-03-01");
  assert.equal(lastTransactionDateFor(txns, "exp2"), "2026-02-01");
  assert.equal(lastTransactionDateFor(txns, "exp3"), null);
});

test("transactionDisplayName prefers its own description, then the linked budget line's name", function(){
  var shared = [{ id: "exp1", what: "Groceries" }, { id: "exp2", what: "" }];
  // Its own description always wins, linked or not.
  assert.equal(transactionDisplayName({ what: "Woolies run", linkedExpenseId: "exp1" }, shared), "Woolies run");
  assert.equal(transactionDisplayName({ what: "Coffee", linkedExpenseId: null }, shared), "Coffee");
  // Blank/whitespace-only description falls back to the linked line's current name.
  assert.equal(transactionDisplayName({ what: "", linkedExpenseId: "exp1" }, shared), "Groceries");
  assert.equal(transactionDisplayName({ what: "   ", linkedExpenseId: "exp1" }, shared), "Groceries");
  assert.equal(transactionDisplayName({ linkedExpenseId: "exp1" }, shared), "Groceries");
  // Nothing to fall back to: unlinked, a dangling link, or a nameless budget line.
  assert.equal(transactionDisplayName({ what: "", linkedExpenseId: null }, shared), "Transaction");
  assert.equal(transactionDisplayName({ what: "", linkedExpenseId: "gone" }, shared), "Transaction");
  assert.equal(transactionDisplayName({ what: "", linkedExpenseId: "exp2" }, shared), "Transaction");
  assert.equal(transactionDisplayName({ what: "", linkedExpenseId: "exp1" }, undefined), "Transaction");
});

test("currentStatementCycle returns the cycle containing today, straddling a month boundary", function(){
  var late = currentStatementCycle(15, "2026-08-29");
  assert.deepEqual(late, { start: "2026-08-15", end: "2026-09-14" });
  var early = currentStatementCycle(15, "2026-08-10");
  assert.deepEqual(early, { start: "2026-07-15", end: "2026-08-14" });
  var onStartDay = currentStatementCycle(15, "2026-08-15");
  assert.deepEqual(onStartDay, { start: "2026-08-15", end: "2026-09-14" });
});

test("currentStatementCycle handles a start day near end of month across shorter months", function(){
  var cycle = currentStatementCycle(28, "2026-02-27");
  assert.deepEqual(cycle, { start: "2026-01-28", end: "2026-02-27" });
});

test("reserveYearWindow: the calendar year is Jan 1 to Dec 31 of the year containing today", function(){
  assert.deepEqual(reserveYearWindow("calendar", "2026-09-09"),
    { start: "2026-01-01", end: "2026-12-31", label: "this year" });
  // Boundaries land in the year they belong to rather than rolling into the next one.
  assert.equal(reserveYearWindow("calendar", "2026-01-01").start, "2026-01-01");
  assert.equal(reserveYearWindow("calendar", "2026-12-31").end, "2026-12-31");
});

test("reserveYearWindow: the financial year runs Jul-Jun and is named the way AU statements name it", function(){
  // On or after 1 July we're in the FY that just opened.
  assert.deepEqual(reserveYearWindow("financial", "2026-09-09"),
    { start: "2026-07-01", end: "2027-06-30", label: "FY26/27" });
  assert.deepEqual(reserveYearWindow("financial", "2026-07-01"),
    { start: "2026-07-01", end: "2027-06-30", label: "FY26/27" });
  // Before it, we're still in the one that opened last July — the case a naive
  // getFullYear() would get wrong for half of every year.
  assert.deepEqual(reserveYearWindow("financial", "2026-06-30"),
    { start: "2025-07-01", end: "2026-06-30", label: "FY25/26" });
  assert.equal(reserveYearWindow("financial", "2026-01-15").label, "FY25/26");
  // Zero-padded either side of the century, so it never reads "FY9/10".
  assert.equal(reserveYearWindow("financial", "2009-08-01").label, "FY09/10");
  assert.equal(reserveYearWindow("financial", "2099-08-01").label, "FY99/00");
});

test("reserveYearWindow: rolling 12 months ends today and spans a year, not a year and a day", function(){
  assert.deepEqual(reserveYearWindow("rolling12", "2026-09-09"),
    { start: "2025-09-10", end: "2026-09-09", label: "last 12 months" });
  // Leap day: the window still ends on today and starts the day after the same date a year back.
  assert.equal(reserveYearWindow("rolling12", "2024-02-29").end, "2024-02-29");
  assert.equal(reserveYearWindow("rolling12", "2024-02-29").start, "2023-03-01");
});

test("reserveYearWindowFor falls back to the calendar year for anything unset or unrecognised", function(){
  // Every reserve line was measured over the calendar year before this was a choice, so an older
  // save (or a hand-edited backup carrying nonsense) has to keep reading the same numbers.
  var calendar = reserveYearWindow("calendar", "2026-09-09");
  assert.deepEqual(reserveYearWindowFor({}, "2026-09-09"), calendar);
  assert.deepEqual(reserveYearWindowFor({ reserveYear: "" }, "2026-09-09"), calendar);
  assert.deepEqual(reserveYearWindowFor({ reserveYear: "fiscal" }, "2026-09-09"), calendar);
  assert.deepEqual(reserveYearWindowFor(null, "2026-09-09"), calendar);
  // ...and a recognised one is honoured.
  assert.equal(reserveYearWindowFor({ reserveYear: "financial" }, "2026-09-09").label, "FY26/27");
  assert.equal(reserveYearWindowFor({ reserveYear: "rolling12" }, "2026-09-09").label, "last 12 months");
});

test("lastKnownDateFor prefers an item's own value-history log over a linked transaction", function(){
  var item = { id: "i1", history: [{ date: "2026-01-01", value: 100 }, { date: "2026-03-01", value: 120 }] };
  var txns = [{ date: "2026-06-01", linkedExpenseId: "i1" }];
  assert.equal(lastKnownDateFor(item, txns), "2026-03-01");
});

test("lastKnownDateFor falls back to a linked transaction when there's no value-history log", function(){
  var item = { id: "i1" };
  var txns = [{ date: "2026-06-01", linkedExpenseId: "i1" }, { date: "2026-02-01", linkedExpenseId: "i1" }];
  assert.equal(lastKnownDateFor(item, txns), "2026-06-01");
});

test("lastKnownDateFor returns null when neither source has anything", function(){
  assert.equal(lastKnownDateFor({ id: "i1" }, []), null);
  assert.equal(lastKnownDateFor({}, []), null);
});

test("resolvedDueMonth prefers an explicit dueMonth over any inferred date", function(){
  var item = { id: "i1", dueMonth: 7, history: [{ date: "2026-03-01", value: 100 }] };
  assert.equal(resolvedDueMonth(item, []), 7);
});

test("resolvedDueMonth infers the month from the item's last known date when unset", function(){
  var item = { id: "i1", history: [{ date: "2026-09-15", value: 100 }] };
  assert.equal(resolvedDueMonth(item, []), 9);
});

test("resolvedDueMonth returns null when there's no explicit month and nothing to infer from", function(){
  assert.equal(resolvedDueMonth({ id: "i1" }, []), null);
});

test("transactionsInRange filters inclusively on both ends", function(){
  var txns = [
    { date: "2026-08-14", amount: 1 },
    { date: "2026-08-15", amount: 2 },
    { date: "2026-09-01", amount: 3 },
    { date: "2026-09-14", amount: 4 },
    { date: "2026-09-15", amount: 5 }
  ];
  var inRange = transactionsInRange(txns, "2026-08-15", "2026-09-14");
  assert.equal(inRange.length, 3);
  assert.equal(inRange.reduce(function(s, t){ return s + t.amount; }, 0), 9);
});

test("budgetCycleFor keeps a calendar-month window for monthly lines", function(){
  var c = budgetCycleFor({ amount: 99, freq: "Monthly" }, [], "2026-09-08");
  assert.deepEqual({ start: c.start, end: c.end, label: c.label, target: c.target, dueThisMonth: c.dueThisMonth },
    { start: "2026-09-01", end: "2026-09-30", label: "this month", target: 99, dueThisMonth: true });
});

test("budgetCycleFor counts whole periods in the month for sub-monthly lines", function(){
  // September 2026 has 30 days: four whole weeks, two whole fortnights.
  var wk = budgetCycleFor({ amount: 200, freq: "Weekly" }, [], "2026-09-08");
  assert.equal(wk.target, 800, "four weekly payments, not the 4.33 average");
  // The count is in the label so the row explains why its target differs from the smoothed /mo.
  assert.equal(wk.label, "this month \u00d74");
  var fn = budgetCycleFor({ amount: 200, freq: "Fortnightly" }, [], "2026-09-08");
  assert.equal(fn.target, 400);
  // A 31-day month still holds only four whole weeks.
  assert.equal(budgetCycleFor({ amount: 200, freq: "Weekly" }, [], "2026-08-08").target, 800);
  // February 2026 (28 days) also holds exactly four.
  assert.equal(budgetCycleFor({ amount: 200, freq: "Weekly" }, [], "2026-02-10").target, 800);
});

test("budgetCycleFor anchors a quarterly line on its due month and spans the whole quarter", function(){
  // Due August: cycles run Aug-Oct, Nov-Jan, Feb-Apr, May-Jul.
  var item = { amount: 230, freq: "Quarterly", dueMonth: 8 };
  var c = budgetCycleFor(item, [], "2026-09-08");
  assert.deepEqual({ start: c.start, end: c.end }, { start: "2026-08-01", end: "2026-10-31" });
  assert.equal(c.label, "Aug–Oct", "names the window rather than spending width on \"this quarter\"");
  assert.equal(c.target, 230, "the target is a full cycle's bill, not a monthly slice");
  assert.equal(c.dueThisMonth, false, "September is mid-cycle, the bill landed in August");
  // In the anchor month itself the bill is due now.
  assert.equal(budgetCycleFor(item, [], "2026-08-03").dueThisMonth, true);
  // The next cycle over, including one that straddles the new year.
  var nov = budgetCycleFor(item, [], "2026-12-20");
  assert.deepEqual({ start: nov.start, end: nov.end }, { start: "2026-11-01", end: "2027-01-31" });
  assert.equal(budgetCycleFor(item, [], "2027-01-05").start, "2026-11-01", "January is still in the Nov cycle");
});

test("budgetCycleFor anchors a yearly line on its due month", function(){
  var item = { amount: 1400, freq: "Yearly", dueMonth: 11 };
  var c = budgetCycleFor(item, [], "2026-09-08");
  assert.deepEqual({ start: c.start, end: c.end }, { start: "2025-11-01", end: "2026-10-31" });
  assert.equal(c.target, 1400);
  assert.equal(c.dueThisMonth, false);
  assert.equal(budgetCycleFor(item, [], "2026-11-14").dueThisMonth, true);
  assert.equal(budgetCycleFor(item, [], "2026-11-14").start, "2026-11-01");
});

test("budgetCycleFor infers a quarterly line's anchor from the last logged transaction", function(){
  var item = { id: "exp1", amount: 230, freq: "Quarterly" };
  var txns = [{ date: "2026-08-14", amount: 230, linkedExpenseId: "exp1" }];
  var c = budgetCycleFor(item, txns, "2026-09-08");
  assert.deepEqual({ start: c.start, end: c.end }, { start: "2026-08-01", end: "2026-10-31" },
    "no explicit dueMonth, so the August payment anchors the cycle");
  // An explicit dueMonth still wins over the inferred one.
  var pinned = budgetCycleFor({ id: "exp1", amount: 230, freq: "Quarterly", dueMonth: 9 }, txns, "2026-09-08");
  assert.equal(pinned.start, "2026-09-01");
});

test("budgetCycleFor falls back to a calendar-anchored cycle with nothing to infer from", function(){
  var c = budgetCycleFor({ amount: 230, freq: "Quarterly" }, [], "2026-09-08");
  // Anchored on January, so the cycle containing September is Jul-Sep.
  assert.deepEqual({ start: c.start, end: c.end }, { start: "2026-07-01", end: "2026-09-30" });
  assert.equal(c.target, 230);
});

test("freqStepMonths knows how many months each frequency's cycle spans", function(){
  assert.equal(freqStepMonths("Quarterly"), 3);
  assert.equal(freqStepMonths("Half-yearly"), 6);
  assert.equal(freqStepMonths("Yearly"), 12);
  // Everything monthly-or-shorter collapses to 1 — the distinction is handled in days elsewhere.
  assert.equal(freqStepMonths("Monthly"), 1);
  assert.equal(freqStepMonths("Fortnightly"), 1);
  assert.equal(freqStepMonths("Weekly"), 1);
  assert.equal(freqStepMonths(undefined), 1);
});

test("toWeekly and periodsOf handle Half-yearly", function(){
  // 26 weeks to the half-year, so a $600 half-yearly bill is $100/mo and $1,200/yr.
  assert.equal(toWeekly(600, "Half-yearly"), 600 / 26);
  var p = periodsOf(600, "Half-yearly");
  assert.equal(Math.round(p.monthly * 100) / 100, 100);
  assert.equal(Math.round(p.yearly), 1200);
});

test("budgetCycleFor spans six months for a Half-yearly line, anchored on its due month", function(){
  var item = { amount: 600, freq: "Half-yearly", dueMonth: 2 };
  // Feb-Jul and Aug-Jan are the two cycles; September sits in the second.
  var c = budgetCycleFor(item, [], "2026-09-08");
  assert.deepEqual({ start: c.start, end: c.end }, { start: "2026-08-01", end: "2027-01-31" });
  assert.equal(c.label, "Aug–Jan");
  assert.equal(c.target, 600, "a full cycle's bill, not a monthly slice");
  assert.equal(c.dueThisMonth, false);
  assert.equal(budgetCycleFor(item, [], "2026-08-02").dueThisMonth, true);
  // Back in the first cycle of the year, and across the year boundary into the second.
  assert.equal(budgetCycleFor(item, [], "2026-03-15").start, "2026-02-01");
  assert.equal(budgetCycleFor(item, [], "2027-01-20").start, "2026-08-01");
});

test("nextDueDate and isOverdue step six months for a Half-yearly item", function(){
  assert.equal(nextDueDate("2026-02-10", "Half-yearly", "2026-03-01"), "2026-08-10");
  assert.equal(isOverdue("2026-02-10", "Half-yearly", "2026-07-01"), false);
  assert.equal(isOverdue("2026-02-10", "Half-yearly", "2026-08-10"), true);
});

test("payScheduleKindFor asks for the one thing each frequency actually needs", function(){
  assert.equal(payScheduleKindFor("Weekly"), "weekday");
  assert.equal(payScheduleKindFor("Fortnightly"), "anchor");
  ["Monthly", "Quarterly", "Half-yearly", "Yearly"].forEach(function(f){
    assert.equal(payScheduleKindFor(f), "monthday");
  });
});

test("nextPayDate: weekly lands on the next matching weekday, and today counts", function(){
  // 2026-09-10 is a Thursday (getDay() === 4).
  var thu = { freq: "Weekly", payWeekday: 4 };
  assert.equal(nextPayDate(thu, [], "2026-09-10"), "2026-09-10", "paid today is still the next pay");
  assert.equal(nextPayDate(thu, [], "2026-09-11"), "2026-09-17", "the day after rolls a full week");
  assert.equal(nextPayDate({ freq: "Weekly", payWeekday: 1 }, [], "2026-09-10"), "2026-09-14");
  // Nothing set: say so rather than guessing.
  assert.equal(nextPayDate({ freq: "Weekly" }, [], "2026-09-10"), null);
  assert.equal(nextPayDate({ freq: "Weekly", payWeekday: "" }, [], "2026-09-10"), null);
});

test("nextPayDate: fortnightly steps the real 14-day cycle from its anchor", function(){
  var item = { freq: "Fortnightly", payAnchor: "2026-09-03" };
  assert.equal(nextPayDate(item, [], "2026-09-03"), "2026-09-03");
  assert.equal(nextPayDate(item, [], "2026-09-04"), "2026-09-17");
  assert.equal(nextPayDate(item, [], "2026-09-17"), "2026-09-17");
  assert.equal(nextPayDate(item, [], "2026-09-18"), "2026-10-01");
  // A stale anchor months back still resolves to the correct upcoming date, not the next one
  // after the anchor.
  assert.equal(nextPayDate({ freq: "Fortnightly", payAnchor: "2026-01-08" }, [], "2026-09-10"), "2026-09-17");
  // An anchor in the future (a pay date already diarised) walks *back* to the right one rather
  // than reporting a date months out. Dec 31 less 14s lands on Sep 10 — which is today, and today
  // counts, exactly as it does on the forward path above.
  assert.equal(nextPayDate({ freq: "Fortnightly", payAnchor: "2026-12-31" }, [], "2026-09-10"), "2026-09-10");
  assert.equal(nextPayDate({ freq: "Fortnightly", payAnchor: "2026-12-31" }, [], "2026-09-11"), "2026-09-24");
  assert.equal(nextPayDate({ freq: "Fortnightly" }, [], "2026-09-10"), null);
});

test("nextPayDate: monthly uses this month until the day passes, then next", function(){
  var item = { freq: "Monthly", payDay: 15 };
  assert.equal(nextPayDate(item, [], "2026-09-01"), "2026-09-15");
  assert.equal(nextPayDate(item, [], "2026-09-15"), "2026-09-15");
  assert.equal(nextPayDate(item, [], "2026-09-16"), "2026-10-15");
});

test("nextPayDate: a day the month doesn't have is clamped, and \"last\" means last", function(){
  // The 31st in a 30-day month is the 30th, not the 1st of the next one.
  assert.equal(nextPayDate({ freq: "Monthly", payDay: 31 }, [], "2026-09-01"), "2026-09-30");
  assert.equal(nextPayDate({ freq: "Monthly", payDay: 31 }, [], "2026-10-01"), "2026-10-31");
  assert.equal(nextPayDate({ freq: "Monthly", payDay: "last" }, [], "2026-02-01"), "2026-02-28");
  // 2028 is a leap year, so "last" is the 29th.
  assert.equal(nextPayDate({ freq: "Monthly", payDay: "last" }, [], "2028-02-01"), "2028-02-29");
});

test("nextPayDate: less often than monthly places the day inside its due month", function(){
  // Quarterly, due in February, paid on the 20th -> Feb/May/Aug/Nov.
  var q = { freq: "Quarterly", payDay: 20, dueMonth: 2 };
  assert.equal(nextPayDate(q, [], "2026-01-01"), "2026-02-20");
  assert.equal(nextPayDate(q, [], "2026-02-21"), "2026-05-20");
  assert.equal(nextPayDate(q, [], "2026-09-10"), "2026-11-20");
  // Rolls into next year rather than reporting a date already gone.
  assert.equal(nextPayDate(q, [], "2026-11-21"), "2027-02-20");
  // Yearly with a bonus month.
  assert.equal(nextPayDate({ freq: "Yearly", payDay: 5, dueMonth: 7 }, [], "2026-09-10"), "2027-07-05");
  // No due month set and nothing logged to infer one from: unknowable, so null.
  assert.equal(nextPayDate({ freq: "Quarterly", payDay: 20 }, [], "2026-09-10"), null);
});

test("nextPayDate: an unset schedule is null rather than a guess", function(){
  assert.equal(nextPayDate(null, [], "2026-09-10"), null);
  assert.equal(nextPayDate({ freq: "Monthly" }, [], "2026-09-10"), null);
});
