import { localDateStr } from "../lib/format.js";
import { MONTH_NAMES } from "../constants.js";
// state.js imports only constants.js and lib/toast.js, so this is a leaf-ward import, not a cycle.
// Needed for householdYearBasis() below — the one thing in this module that reads a preference
// rather than taking everything it needs as an argument.
import { state } from "../state.js";

export function toWeekly(amount, freq){
  amount = Number(amount) || 0;
  switch(freq){
    case "Weekly": return amount;
    case "Fortnightly": return amount / 2;
    case "Monthly": return amount / (52/12);
    case "Quarterly": return amount / 13;
    case "Half-yearly": return amount / 26;
    case "Yearly": return amount / 52;
    default: return 0;
  }
}
export function periodsOf(amount, freq){
  var w = toWeekly(amount, freq);
  return { weekly:w, fortnightly:w*2, monthly:w*52/12, quarterly:w*13, yearly:w*52 };
}
// Both summers skip rows that have ENDED (item.endDate in the past — see isActiveOn below).
//
// Applied at the primitive rather than at each of the ~25 call sites, because every one of them
// means the same thing: "what does this cost, or earn, per period *right now*". A row that
// finished two years ago costs nothing, and before this it went on inflating monthly expenses, the
// savings rate, the runway, the 50/30/20 bar and the Expenses header total forever.
//
// It also removed a straight contradiction: computeNetWorthSeries has honoured end dates since
// v2.77.0, so the Dashboard's "you spend $X/mo" and the projection's own year-1 figure disagreed
// by the amount of every ended row. Measured on the reference backup: $5,382/mo against $5,283.
//
// A row with no endDate — which is every row created before v2.77.0, and most since — is always
// active, so nothing else changes.
export function sumField(items, field){
  var today = localDateStr();
  return items.reduce(function(s,i){
    if(!isActiveOn(i, today)) return s;
    return s + periodsOf(i.amount, i.freq)[field];
  }, 0);
}
export function sumByClassification(items, cls, field){
  return items.filter(function(i){ return i.classification === cls; })
              .reduce(function(s,i){ return s + periodsOf(i.amount, i.freq)[field]; }, 0);
}
export function safeDiv(a, b){ return b ? a / b : 0; }
// A ledger item can optionally carry a sparse per-scenario amount override (see
// state.shared[]'s scenarioOverrides) so the same expense (e.g. water rates) can differ between
// scenarios/the baseline without needing a separate row per scenario. Absent map or absent key
// for this scenario just falls back to the item's plain amount, so every existing item (which
// has no scenarioOverrides field at all) behaves exactly as before.
export function resolveSharedAmount(item, scenarioName){
  var overrides = item.scenarioOverrides;
  return (overrides && overrides[scenarioName] != null) ? overrides[scenarioName] : item.amount;
}
export function sumFieldForScenario(items, scenarioName, field){
  var today = localDateStr();
  return items.reduce(function(s, i){
    if(!isActiveOn(i, today)) return s;
    return s + periodsOf(resolveSharedAmount(i, scenarioName), i.freq)[field];
  }, 0);
}
// Advances a date by one occurrence of the given ledger frequency. Month/year steps use
// setMonth/setFullYear rather than a fixed day count, so e.g. a Monthly bill last paid on the
// 31st correctly rolls to the last day of shorter months instead of drifting.
// How many months one cycle of a frequency spans — the single place that knows this, so adding a
// frequency (Half-yearly was the third) is one line here rather than a hunt through every
// "is it lumpy", "when's the next one" and "which months does it land in" test in the app.
// Sub-monthly frequencies collapse to 1: they're handled in days where the distinction matters
// (addFreqStep below), and everywhere else "at least monthly" is the only property that counts.
export function freqStepMonths(freq){
  switch(freq){
    case "Quarterly": return 3;
    case "Half-yearly": return 6;
    case "Yearly": return 12;
    default: return 1;
  }
}
function addFreqStep(d, freq){
  var next = new Date(d.getTime());
  if(freq === "Weekly"){ next.setDate(next.getDate() + 7); return next; }
  if(freq === "Fortnightly"){ next.setDate(next.getDate() + 14); return next; }
  next.setMonth(next.getMonth() + freqStepMonths(freq));
  return next;
}
// Given when an expense was last incurred and how often it recurs, projects the next
// occurrence on/after fromDateStr (defaults to today) — always at least one step past
// lastIncurredDate, even if that date is today or in the future (i.e. "next due" never means
// "due today, the day you just paid it"). Returns null if lastIncurredDate is absent/invalid,
// so callers can distinguish "never tracked" from a real computed date.
export function nextDueDate(lastIncurredDate, freq, fromDateStr){
  if(!lastIncurredDate) return null;
  var d = new Date(lastIncurredDate + "T00:00:00");
  if(isNaN(d.getTime())) return null;
  var from = fromDateStr ? new Date(fromDateStr + "T00:00:00") : new Date();
  from.setHours(0, 0, 0, 0);
  d = addFreqStep(d, freq);
  var guard = 0; // belt-and-suspenders against an unexpected infinite loop, not expected to bite
  while(d.getTime() < from.getTime() && guard < 1000){
    d = addFreqStep(d, freq);
    guard++;
  }
  return localDateStr(d);
}
// Whether a full period has already elapsed since lastIncurredDate without a new log — i.e. the
// *single* next occurrence after lastIncurredDate (not nextDueDate()'s loop, which always rolls
// forward to on/after fromDateStr and so can never itself land in the past) is on or before
// fromDateStr (defaults to today). Used to flag an expense as "needs review" regardless of how
// many periods have been silently skipped, e.g. a Monthly expense last logged 4 months ago is
// just as overdue as one last logged 5 weeks ago — both need a fresh entry now.
export function isOverdue(lastIncurredDate, freq, fromDateStr){
  if(!lastIncurredDate) return false;
  var d = new Date(lastIncurredDate + "T00:00:00");
  if(isNaN(d.getTime())) return false;
  var from = fromDateStr ? new Date(fromDateStr + "T00:00:00") : new Date();
  from.setHours(0, 0, 0, 0);
  var due = addFreqStep(d, freq);
  return due.getTime() <= from.getTime();
}
// Whole days between fromDateStr (defaults to today) and dateStr — negative means dateStr is in
// the past (overdue).
export function daysUntil(dateStr, fromDateStr){
  var from = fromDateStr ? new Date(fromDateStr + "T00:00:00") : new Date();
  from.setHours(0, 0, 0, 0);
  var d = new Date(dateStr + "T00:00:00");
  return Math.round((d.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}
// Records a value into a history array (mutated in place — caller must already have ensured
// `history` is an array, matching the pre-existing per-item convention in
// assets.js/properties.js). dateStr defaults to today but can be backdated (e.g. logging a
// payslip that landed last week, or catching up a missed month) — an existing entry for that
// same date is updated in place rather than duplicated, same as the today-only behavior this
// replaced. Shared by every "Log" action in the app (assets, properties, debts, income, shared
// expenses, the expense review flow, and the Dashboard's net-worth snapshot) so the
// find-or-update-then-sort logic exists in exactly one place.
export function appendHistorySnapshot(history, value, dateStr){
  dateStr = dateStr || localDateStr();
  var existing = history.find(function(h){ return h.date === dateStr; });
  if(existing) existing.value = value;
  else history.push({ date: dateStr, value: value });
  history.sort(function(a, b){ return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
  return dateStr;
}
export function sumByAccount(items, field){
  var map = {};
  items.forEach(function(i){
    var acct = (i.account || "").trim() || "Unassigned";
    var v = periodsOf(i.amount, i.freq)[field];
    map[acct] = (map[acct] || 0) + v;
  });
  return map;
}
// Latest transaction date recorded against a given shared-expense id, or null if none — now that
// logging a shared expense creates a transaction rather than writing a manual "last paid" field
// directly onto the budget line, this is what tells us "when was this actually last paid".
export function lastTransactionDateFor(transactions, expenseId){
  var latest = null;
  transactions.forEach(function(t){
    if(t.linkedExpenseId === expenseId && (!latest || t.date > latest)) latest = t.date;
  });
  return latest;
}
// The one place that decides what a transaction is *called* anywhere it's listed (its own row,
// a budget line's drill-down, search results). A transaction's own description wins when it has
// one, but descriptions are optional — most spend logged against a budget line needs no extra
// label — so a linked transaction falls back to that line's current name rather than showing a
// bare "Transaction". Reading the name through the link, rather than snapshotting it at log
// time, also means renaming a budget line renames its whole logged history with it.
export function transactionDisplayName(t, sharedList){
  var own = (t.what || "").trim();
  if(own) return own;
  var linked = t.linkedExpenseId && (sharedList || []).find(function(i){ return i.id === t.linkedExpenseId; });
  if(linked && linked.what) return linked.what;
  return "Transaction";
}
// Real, dated spend events (state.transactions[]) filtered to one calendar month — defaults to
// the current month so the "actual vs planned" panel means "this month" without the caller
// having to know today's date itself.
export function transactionsInMonth(transactions, monthStr){
  monthStr = monthStr || localDateStr().slice(0, 7);
  return transactions.filter(function(t){ return (t.date || "").slice(0, 7) === monthStr; });
}
// Sums a set of transactions by the state.shared[] id they're linked to — an unlinked
// transaction (a one-off with no matching budget line) is bucketed under "__unlinked" rather
// than dropped, so its total isn't silently lost from the reconciliation.
export function sumTransactionsByExpense(transactions){
  var map = {};
  transactions.forEach(function(t){
    var key = t.linkedExpenseId || "__unlinked";
    map[key] = (map[key] || 0) + (Number(t.amount) || 0);
  });
  return map;
}
// A credit card's "bill" doesn't line up with the calendar month — it's whatever was charged
// between one statement date and the next. Given the account's statementStartDay (1-28, the day
// of the month its cycle begins) and today (defaults to now), returns the currently-open cycle's
// [start, end] as ISO date strings — e.g. startDay 15 on 2026-08-29 returns
// {start:"2026-08-15", end:"2026-09-14"}, and startDay 15 on 2026-08-10 returns the *previous*
// cycle, {start:"2026-07-15", end:"2026-08-14"}, since the 15th hasn't happened yet this month.
export function currentStatementCycle(startDay, todayStr){
  var today = todayStr ? new Date(todayStr + "T00:00:00") : new Date();
  var y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
  var cycleStart = d >= startDay ? new Date(y, m, startDay) : new Date(y, m - 1, startDay);
  var cycleEnd = new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, cycleStart.getDate() - 1);
  return { start: localDateStr(cycleStart), end: localDateStr(cycleEnd) };
}
// Inclusive date-range filter for state.transactions[] — startDate/endDate are ISO strings
// (e.g. from currentStatementCycle()).
export function transactionsInRange(transactions, startDate, endDate){
  return transactions.filter(function(t){ return t.date >= startDate && t.date <= endDate; });
}
// The window a reserve (irregular) budget line is measured over. "This year" was the only option
// for a long time and quietly meant the *calendar* year, which is wrong for a lot of what these
// lines actually hold: in Australia a household thinks about plenty of annual money in financial
// years (Jul–Jun), and a rolling budget like travel is better answered by "what have I spent in
// the last twelve months" than by one that resets to zero every 1 January — right when people
// book their summer trip.
//
// Returns { start, end, label } with inclusive ISO date bounds. The label goes straight into the
// row's "$X actual / $Y planned <label>" line, so it has to read as a period in that sentence.
export var RESERVE_YEAR_BASES = ["calendar", "financial", "rolling12"];
export function reserveYearWindow(basis, todayStr){
  var today = todayStr ? new Date(todayStr + "T00:00:00") : new Date();
  today.setHours(0, 0, 0, 0);
  var y = today.getFullYear();
  if(basis === "financial"){
    // The Australian financial year: 1 July to 30 June. Before July we're still in the FY that
    // opened last July, hence the shift.
    var startYear = today.getMonth() >= 6 ? y : y - 1;
    return {
      start: localDateStr(new Date(startYear, 6, 1)),
      end: localDateStr(new Date(startYear + 1, 5, 30)),
      // "FY24/25", the way it's written on every Australian statement — and short enough for the
      // row's sub-line, which ellipsizes well before the amount column on a phone.
      label: "FY" + String(startYear % 100).padStart(2, "0") + "/" + String((startYear + 1) % 100).padStart(2, "0")
    };
  }
  if(basis === "rolling12"){
    // The twelve months ending today, inclusive at both ends: the day after the same date a year
    // back, so the window is 12 months long rather than 12 months and a day.
    //
    // The day-of-month is clamped to that month's length before stepping forward, because the one
    // date this has to get right is the one JS gets wrong: today = 29 Feb has no counterpart a
    // year earlier, and `new Date(y - 1, 1, 30)` silently overflows to 2 March — a window a day
    // short, with no error to notice. Clamped to 28 Feb, +1 day lands on 1 March, which is what
    // "the twelve months ending 29 Feb" means.
    var backYear = y - 1, m = today.getMonth();
    var daysInMonthThen = new Date(backYear, m + 1, 0).getDate();
    var back = new Date(backYear, m, Math.min(today.getDate(), daysInMonthThen));
    var from = new Date(back.getFullYear(), back.getMonth(), back.getDate() + 1);
    return { start: localDateStr(from), end: localDateStr(today), label: "last 12 months" };
  }
  return { start: localDateStr(new Date(y, 0, 1)), end: localDateStr(new Date(y, 11, 31)), label: "this year" };
}
// The reserve window for one budget line. Anything unset (or set to something unrecognised — a
// hand-edited backup, an older save) falls back to the calendar year, which is what every reserve
// line was measured over before this was a choice.
export function reserveYearWindowFor(item, todayStr){
  // "" (or anything unrecognised) means "follow the household default" — see householdYearBasis().
  // Before v2.80.0 the fallback was a hard "calendar", which is the wrong default for an
  // Australian app and, worse, was invisible: nothing on the row said which twelve months it was
  // being measured over unless you opened it.
  var basis = item && RESERVE_YEAR_BASES.indexOf(item.reserveYear) !== -1 ? item.reserveYear : householdYearBasis();
  return reserveYearWindow(basis, todayStr);
}

// ---------------- The household's year ----------------
//
// A tax return is a financial-year document, and in Australia so is most of what a household
// thinks of as "a year of" something — insurance, rates, the private-health rebate. The app knew
// about Jul-Jun since v2.72.0 but only one reserve line at a time, which meant the *household*
// had no year: the Spending views said "this month", the Assets timeframe picker's YTD was
// hardcoded to 1 January, and nothing could answer "what did we spend this financial year".
//
// state.yearBasis is that missing preference. Only the two real calendars are offered here —
// "rolling12" stays a per-line choice, because a rolling window is a way of budgeting one lumpy
// line (travel, maintenance), not a year a household or the ATO recognises.
export var HOUSEHOLD_YEAR_BASES = ["financial", "calendar"];
export function householdYearBasis(){
  var basis = state.yearBasis;
  return HOUSEHOLD_YEAR_BASES.indexOf(basis) !== -1 ? basis : "financial";
}
// The household year containing todayStr — {start, end, label}, same shape reserveYearWindow
// returns, so anything already rendering one of those can take this instead.
export function householdYearWindow(todayStr){
  var win = reserveYearWindow(householdYearBasis(), todayStr);
  // reserveYearWindow labels the calendar basis "this year", which reads correctly in the sentence
  // it was written for — a row's "$X actual / $Y planned this year". As a *household* year it's a
  // noun, and lands in sentences like "$4,953 logged in ___" and "Export ___'s transactions",
  // where "this year" is at best clumsy and in a filename is useless. The financial label ("FY26/27")
  // is already a noun, so only the calendar one needs rewriting.
  if(householdYearBasis() === "calendar") return { start: win.start, end: win.end, label: win.start.slice(0, 4) };
  return win;
}
// The same window, cut off at today: "FY26/27 so far" is the honest label for a year still
// running, and comparing a part-finished year against a full year's budget without saying so is
// the same mistake the spending trends panel exists to avoid.
export function householdYearToDate(todayStr){
  var win = householdYearWindow(todayStr);
  var today = todayStr || localDateStr();
  var complete = today >= win.end;
  return {
    start: win.start,
    end: complete ? win.end : today,
    label: win.label,
    complete: complete,
    // Whole-year label vs "so far": a finished year is just "FY25/26", a running one has to say
    // it isn't over, or every year-on-year comparison silently compares 12 months against 3.
    displayLabel: complete ? win.label : win.label + " so far"
  };
}
// How far through the household year todayStr is, 0-1. Used the same way monthProgressFor() is in
// calc/trends.js — to say how much of the year a figure covers, never to scale one up.
export function householdYearProgress(todayStr){
  var win = householdYearWindow(todayStr);
  var today = todayStr || localDateStr();
  if(today >= win.end) return 1;
  var startMs = new Date(win.start + "T00:00:00").getTime();
  var endMs = new Date(win.end + "T00:00:00").getTime();
  var nowMs = new Date(today + "T00:00:00").getTime();
  // Strictly before the window, not "on its first day": 1 July is day one of 365, not zero days
  // in. An off-by-one here reads as "0% through the year" for the whole of the first day.
  if(nowMs < startMs) return 0;
  return (nowMs - startMs + 86400000) / (endMs - startMs + 86400000);
}
// A ledger item's last-known "when did this actually happen" date, regardless of which of the
// app's two logging mechanisms it uses — a plain value-history snapshot (income, home costs,
// property income/expenses — see appendHistorySnapshot()) or a linked state.transactions[] entry
// (shared expenses only — see logExpenseTransaction()). Centralizing this here lets
// resolvedDueMonth() below work the same way regardless of which ledger page an item lives on.
export function lastKnownDateFor(item, transactions){
  if(item.history && item.history.length) return item.history[item.history.length - 1].date;
  if(item.id){
    var txDate = lastTransactionDateFor(transactions, item.id);
    if(txDate) return txDate;
  }
  return null;
}
// Which calendar month (1-12) a less-than-monthly item actually lands in — an explicit
// item.dueMonth always wins (set directly on the row, independent of any logging history);
// otherwise it's inferred from the month of its last known occurrence (see lastKnownDateFor()),
// since a bill paid in July this year is paid in July every year (Yearly) or every third month
// from July (Quarterly). Returns null when neither is available — an item that's never been
// logged and has no explicit month can't be placed on the 12-month cash flow forecast (see
// calc/cashflow.js), so it falls back to being smoothed like a regular monthly cost instead.
// ---------------- Billing cycles: comparing spend against the window it's actually billed in ----
// The app converts every budget line to a smoothed $/mo (periodsOf) because that's the right
// number for cash flow, net worth and projections — a $230 quarterly gas bill genuinely costs
// $76.67/mo on average. But it's the wrong denominator for "am I on track right now": in the
// month the bill actually lands you spend the whole $230, so comparing it against one month's
// smoothed slice reports a line that's exactly on plan as 3x over budget.
//
// This returns the window a line is really billed over, so spend and budget can be compared like
// with like. Same idea as currentStatementCycle() above — the window that contains today, anchored
// on the real billing rhythm rather than the calendar.
//
//   { start, end, label, target, dueThisMonth }
//
// target is what one cycle's worth costs (so a quarterly line's target is the full $230, not a
// third of it); dueThisMonth says whether this cycle's payment falls in the current calendar
// month, which is what the month rollup needs to decide whose bill to expect.
//
// Weekly/Fortnightly keep a calendar-month window — there's no stored anchor day to build a
// "current week" from, and a monthly view is how these are actually thought about — but their
// target counts the whole periods that fall in this month rather than using the 52/12 average,
// so a 5-week month expects five weekly shops instead of 4.33.
function monthWindow(today){
  var y = today.getFullYear(), m = today.getMonth();
  return { start: localDateStr(new Date(y, m, 1)), end: localDateStr(new Date(y, m + 1, 0)) };
}
// How many whole `stepDays` periods fall inside the month containing `today`. Used for the
// sub-monthly targets above: a 31-day month holds four whole weeks plus three days, so it expects
// four weekly payments, not 4.43.
function wholePeriodsInMonth(today, stepDays){
  var daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return Math.max(1, Math.floor(daysInMonth / stepDays));
}
export function budgetCycleFor(item, transactions, todayStr){
  var today = todayStr ? new Date(todayStr + "T00:00:00") : new Date();
  today.setHours(0, 0, 0, 0);
  var amount = Number(item.amount) || 0;
  var freq = item.freq;
  if(freq === "Weekly" || freq === "Fortnightly"){
    var win = monthWindow(today);
    var count = wholePeriodsInMonth(today, freq === "Weekly" ? 7 : 14);
    // The count goes in the label because the target it produces ($250 x 4 = $1,000) deliberately
    // differs from the smoothed "/mo" figure shown right beside it on the row ($1,083.33, i.e.
    // x 52/12). Both are correct — one is this month's actual payments, the other the long-run
    // average — but two adjacent numbers that disagree read as a bug unless the row says why.
    return { start: win.start, end: win.end, label: "this month ×" + count, target: amount * count, dueThisMonth: true };
  }
  var stepMonths = freqStepMonths(freq);
  if(stepMonths <= 1){
    var mwin = monthWindow(today);
    return { start: mwin.start, end: mwin.end, label: "this month", target: amount, dueThisMonth: true };
  }
  // Anchor month: where the user said the bill lands (item.dueMonth), else inferred from the last
  // time it was logged. With neither, fall back to the calendar period containing today — no
  // worse than the old behaviour, and it self-corrects the first time anything is logged.
  var anchorMonth = resolvedDueMonth(item, transactions);
  var anchorIdx = anchorMonth ? anchorMonth - 1 : 0;
  // Walk back from an anchor in today's year (or the year after, if the anchor is still ahead of
  // us) in whole cycles until we find the one containing today. The guard is belt-and-braces
  // against a malformed freq, matching nextDueDate()'s own loop.
  var cycleStart = new Date(today.getFullYear() + 1, anchorIdx, 1);
  var guard = 0;
  while(cycleStart.getTime() > today.getTime() && guard < 1000){
    cycleStart = new Date(cycleStart.getFullYear(), cycleStart.getMonth() - stepMonths, 1);
    guard++;
  }
  var cycleEnd = new Date(cycleStart.getFullYear(), cycleStart.getMonth() + stepMonths, 0);
  // "Sep–Nov" rather than "this quarter": it's shorter (the row's sub-line is ellipsized well
  // before the amount column on a phone, and the window is the whole point of the line), and it
  // says exactly which months are being counted — which also makes the next cycle's start
  // self-evident without spending more width spelling it out.
  return {
    start: localDateStr(cycleStart),
    end: localDateStr(cycleEnd),
    label: MONTH_NAMES[cycleStart.getMonth()] + "–" + MONTH_NAMES[cycleEnd.getMonth()],
    target: amount,
    // The bill is expected in the cycle's anchor month — the month the cycle opens on.
    dueThisMonth: cycleStart.getFullYear() === today.getFullYear() && cycleStart.getMonth() === today.getMonth()
  };
}
// ---------------- Rows that stop ----------------
// Childcare that finishes in two years, a car loan with eighteen payments left, a fixed-term
// allowance: until now every ledger row was projected forever, which over a 20-year horizon is a
// large and completely silent distortion. An empty endDate means "no end", which is both the
// default and the overwhelmingly common case.
//
// Deliberately a plain inclusive date comparison on ISO strings rather than Date arithmetic: the
// dates involved are whole days, and string comparison can't drift on a DST boundary the way
// parsing to a Date and comparing timestamps can.
export function isActiveOn(item, dateStr){
  if(!item || !item.endDate) return true;
  return dateStr <= item.endDate;
}
// The same question asked in the projection's own terms — "is this row still running N years from
// today?". Anchored on a passed-in today so the series is reproducible in tests.
export function isActiveInYear(item, yearsFromNow, todayStr){
  if(!item || !item.endDate) return true;
  var base = todayStr ? new Date(todayStr + "T00:00:00") : new Date();
  base.setHours(0, 0, 0, 0);
  var at = new Date(base.getFullYear() + (Number(yearsFromNow) || 0), base.getMonth(), base.getDate());
  return localDateStr(at) <= item.endDate;
}
// Sum only what is still running in a given projection year. Mirrors sumField's shape so callers
// read the same way, and takes the per-item amount resolver as an argument because the shared
// ledger needs scenario-resolved amounts while income does not.
export function sumFieldActiveInYear(items, field, yearsFromNow, todayStr, amountFor){
  return (items || []).reduce(function(sum, item){
    if(!isActiveInYear(item, yearsFromNow, todayStr)) return sum;
    var amount = amountFor ? amountFor(item) : item.amount;
    return sum + periodsOf(amount, item.freq)[field];
  }, 0);
}

// ---------------- Pay schedule ----------------
// "When am I next paid?" — answerable per income row, and deliberately answered by a different
// field per frequency, because the three families genuinely need different information:
//
//   Weekly       a weekday is enough                      -> payWeekday (0=Sun … 6=Sat)
//   Fortnightly  a weekday is NOT enough — you also need  -> payAnchor (any recent real pay date;
//                to know which of the two weeks             the weekday falls out of it)
//   Monthly+     a day of the month                       -> payDay (1–31, or "last")
//
// Each field is stored independently rather than one polymorphic "payDay", so switching an income
// row from Monthly to Weekly and back doesn't silently discard what was already set.
export var WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function payScheduleKindFor(freq){
  if(freq === "Weekly") return "weekday";
  if(freq === "Fortnightly") return "anchor";
  return "monthday";
}
function atMidnight(dateStr){
  var d = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  d.setHours(0, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}
// Strict: no argument means "not set", never "today". atMidnight above deliberately defaults to
// now because that's right for a todayStr parameter — but reusing it for a *stored* date silently
// turned "this row has no anchor" into "the anchor is today", which is how an unconfigured
// fortnightly row reported a confident next-pay date of today.
function storedDate(dateStr){
  return (typeof dateStr === "string" && dateStr) ? atMidnight(dateStr) : null;
}
// payDay may be the string "last" — a salary paid on the final working day of the month can't be
// expressed as a fixed number, and clamping 31 into February would land on the 28th anyway but
// reads as a mistake rather than an intent.
function monthDayIn(year, month, payDay){
  var lastDay = new Date(year, month + 1, 0).getDate();
  var day = payDay === "last" ? lastDay : Math.min(Number(payDay) || 1, lastDay);
  return new Date(year, month, day);
}
// Returns an ISO date string, or null when the row hasn't been told enough to know.
export function nextPayDate(item, transactions, todayStr){
  if(!item) return null;
  var today = atMidnight(todayStr);
  if(!today) return null;
  var kind = payScheduleKindFor(item.freq);
  if(kind === "weekday"){
    if(item.payWeekday == null || item.payWeekday === "") return null;
    // Today counts as the next payday if it *is* the day — you were paid this morning.
    var delta = ((Number(item.payWeekday) - today.getDay()) + 7) % 7;
    return localDateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() + delta));
  }
  if(kind === "anchor"){
    var anchor = storedDate(item.payAnchor);
    if(!anchor) return null;
    // Step the real 14-day cycle rather than guessing at a weekday: the anchor is what makes a
    // fortnightly schedule knowable at all. Steps backwards too, so an anchor in the future (a
    // pay date already diarised) still resolves to the right upcoming one rather than looping.
    var cursor = new Date(anchor.getTime());
    var guard = 0;
    while(cursor.getTime() < today.getTime() && guard < 5000){
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 14);
      guard++;
    }
    while(cursor.getTime() - 14 * 86400000 >= today.getTime() && guard < 5000){
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 14);
      guard++;
    }
    return localDateStr(cursor);
  }
  if(item.payDay == null || item.payDay === "") return null;
  var stepMonths = freqStepMonths(item.freq);
  if(stepMonths <= 1){
    var thisMonth = monthDayIn(today.getFullYear(), today.getMonth(), item.payDay);
    if(thisMonth.getTime() >= today.getTime()) return localDateStr(thisMonth);
    return localDateStr(monthDayIn(today.getFullYear(), today.getMonth() + 1, item.payDay));
  }
  // Less often than monthly: which month it lands in is already a solved problem (dueMonth, set
  // explicitly or inferred), so this only has to place the day inside it and roll forward by whole
  // cycles until it's not in the past.
  var dueMonth = resolvedDueMonth(item, transactions);
  if(!dueMonth) return null;
  var candidate = monthDayIn(today.getFullYear(), dueMonth - 1, item.payDay);
  var guardM = 0;
  while(candidate.getTime() < today.getTime() && guardM < 100){
    candidate = monthDayIn(candidate.getFullYear(), candidate.getMonth() + stepMonths, item.payDay);
    guardM++;
  }
  while(guardM < 100){
    var earlier = monthDayIn(candidate.getFullYear(), candidate.getMonth() - stepMonths, item.payDay);
    if(earlier.getTime() < today.getTime()) break;
    candidate = earlier;
    guardM++;
  }
  return localDateStr(candidate);
}
export function resolvedDueMonth(item, transactions){
  if(item.dueMonth) return item.dueMonth;
  var last = lastKnownDateFor(item, transactions);
  if(!last) return null;
  var d = new Date(last + "T00:00:00");
  if(isNaN(d.getTime())) return null;
  return d.getMonth() + 1;
}
