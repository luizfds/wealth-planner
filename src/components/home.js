import { emergencyFund } from "../calc/emergency.js";
import { homeTodoItems } from "../lib/attention.js";
import { getNotifications } from "../lib/notifications.js";
import { lowBalanceCardHtml } from "./dailyforecast.js";
import { toReview } from "../calc/reviewqueue.js";
import { state } from "../state.js";
import { selectedMonth, monthPhrase, isPeriodToday } from "../calc/ledger.js";
import { totalNetWorthValue, scenarioTotals, currentScenario, staleAssets } from "../calc/engine.js";
import { goalsOverview } from "../calc/savegoals.js";
import { goalCardHtml } from "./savegoals.js";
import { monthReview } from "../calc/monthreview.js";
import { budgetLineItems, loggableBudgetLineItems, transactionAccount, transactionCategory } from "./expenses.js";
import { trendToToday } from "../calc/history.js";
import { fmtCurrency0, fmtCompact, localDateStr, fmtDate } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { upcomingBills as calendarUpcoming } from "../calc/bills.js";
import { netWorthOn } from "../calc/nwhistory.js";
import { netWorthMovers, netWorthSplit } from "../calc/nwauto.js";
import { applyHomeLayout } from "../lib/homelayout.js";
import { weekRecap, showWeekRecap, KEEP_WEEKS } from "../calc/weekrecap.js";
import { transactionDisplayName } from "../calc/ledger.js";
import { adviceFor } from "../calc/advice.js";
import { partAllows } from "../calc/parts.js";
import { autoPayCardHtml } from "./autopay.js";
import { emptyStateHtml } from "../lib/empty.js";

// ---------------- Home (v3.58.0) ----------------
// The first screen answers four things before anything else: what we're worth, how the month is
// going, what's about to be paid, and what needs doing. Scenario comparison (what the Dashboard
// used to open on) is one tab down, under Overview.
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// The year too when it isn't this one — "since 30 Nov" eleven months on read as a date still to come.
function shortDate(iso, today){
  var thisYear = String(today || localDateStr()).slice(0, 4);
  return Number(iso.slice(8, 10)) + " " + MONTHS[Number(iso.slice(5, 7)) - 1] + (iso.slice(0, 4) !== thisYear ? " " + iso.slice(0, 4) : "");
}
function money(n){ return fmtCurrency0.format(Number(n) || 0); }
// Today's cards lead with a picture (the owner: "too much text"): a bar for so-far-against-planned, a filled line for
// net worth, a date chip per bill. The words that said the same thing are each a label on the picture.
// A bar of `value` against `of`, its fill tinted by `tone`; `mark` (0–1) is where today falls in the period.
function meterHtml(label, value, of, tone, mark){
  var frac = of > 0 ? Math.max(0, value) / of : 0, w = Math.min(1, frac) * 100;
  var said = label + " " + money(value) + " of " + money(of) + " planned" + (of > 0 ? ", " + Math.round(frac * 100) + "%" : "") +
    (mark != null ? "; " + Math.round(mark * 100) + "% of the month gone" : "");
  return '<div class="home-meter"><div class="home-meter-head"><span>' + label + '</span><b>' + money(value) + '</b><em>of ' + money(of) + '</em></div>' +
    '<div class="home-meter-track" role="img" aria-label="' + escapeAttr(said) + '"><span class="home-meter-fill ' + tone + '" style="width:' + w.toFixed(1) + '%"></span>' +
    (frac > 1 ? '<span class="home-meter-over" title="Over plan"></span>' : '') +
    (mark != null ? '<span class="home-meter-mark" style="left:' + (Math.min(1, Math.max(0, mark)) * 100).toFixed(1) + '%"></span>' : '') + '</div></div>';
}
// The month's share gone, when the month shown is the one we're in.
function monthGone(ym, today){
  if(String(today).slice(0, 7) !== ym) return null;
  var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)), days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Number(String(today).slice(8, 10)) / days;
}
// A filled line for net worth: the line in the brass ink, the area under it a wash of it.
function areaHtml(points){
  if(!points || points.length < 2) return "";
  var w = 300, h = 64, vals = points.map(function(p){ return Number(p.value) || 0; });
  var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
  if(min === max){ min -= 1; max += 1; }
  var pad = (max - min) * 0.08; min -= pad; max += pad;
  var xy = vals.map(function(v, i){ return [(i / (vals.length - 1)) * w, h - ((v - min) / (max - min)) * h]; });
  var line = xy.map(function(p, i){ return (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ");
  var last = xy[xy.length - 1];
  return '<svg class="home-area" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
    '<path class="home-area-fill" d="' + line + ' L' + w + ',' + h + ' L0,' + h + ' Z"/>' +
    '<path class="home-area-line" d="' + line + '" vector-effect="non-scaling-stroke"/>' +
    '<circle class="home-area-dot" cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="3.5" vector-effect="non-scaling-stroke"/></svg>';
}
function signed(n){ return (n < 0 ? "−" : "+") + fmtCurrency0.format(Math.abs(n)); }

// Bills expected in the next `days` days (and unpaid ones from the last week) — v3.94.1: the bills
// calendar's own reading (calc/bills.js upcomingBills), so ended lines, spending budgets, bills on
// a card and bills that stopped aren't flagged here while the calendar leaves them out.
export function upcomingBills(items, transactions, today, days){
  return calendarUpcoming(items, transactions, today, days, { accounts: state.accounts, transfers: state.transfers });
}

// The to-do list: each { text, go, sub?, tone } where `go` is a page and `sub` its tab.
// #305: Home's To do is the first few items of the one list (lib/attention.js) — the bell shows all of it, in
// the same words. It used to be built here, by its own rules, and disagreed with the bell.
export var HOME_TODO_MAX = 4;
export function homeTodos(){
  return homeTodoItems();
}
function todoAttrs(n){
  return ' data-notif-id="' + escapeAttr(n.id) + '" data-notif-page="' + escapeAttr(n.page) + '"' + (n.sub ? ' data-notif-sub="' + escapeAttr(n.sub) + '"' : '') +
    (n.action ? ' data-notif-action="' + escapeAttr(n.action) + '"' : '') + (n.fy != null ? ' data-notif-fy="' + escapeAttr(String(n.fy)) + '"' : '') +
    (n.line ? ' data-notif-line="' + escapeAttr(n.line) + '" data-notif-due="' + escapeAttr(n.due || "") + '"' : '');
}

// v3.139.0 (item 171): what moved it most since the line began — the same rules both ends
// (calc/nwhistory.js), so the parts add up. Nothing when no one thing explains much.
function moverHtml(fromDate, today, change){
  if(!fromDate || fromDate >= today) return "";
  var a = netWorthOn(fromDate, today), b = netWorthOn(today, today);
  if(a.partial.length) return "";
  // v3.146.0: in two parts — the money kept (or spent) and what the things owned are worth — so a
  // revaluation doesn't read as a month of overspending.
  var sp = netWorthSplit(netWorthMovers(a.parts, b.parts));
  if(Math.abs(sp.money) < 100 && Math.abs(sp.values) < 100) return "";
  var part = function(label, v, cls){ return '<span class="' + cls + '">' + label + ' <b class="' + (v >= 0 ? "up" : "down") + '">' + (v < 0 ? "−" : "+") + fmtCompact(Math.abs(v)) + '</b></span>'; };
  // The headline's change runs from the figure logged back then; the parts from that day rebuilt from
  // today's records. A balance updated or back-dated since makes the two differ — said, not hidden,
  // so the parts always add up to the headline.
  var revised = change != null ? Math.round(change - sp.money - sp.values) : 0;
  return '<div class="home-nw-mover">' + part("Cash &amp; loans", sp.money, "nw-part") +
    part("Property &amp; investments", sp.values, "nw-part") +
    (Math.abs(revised) >= Math.max(500, Math.abs(change) * 0.05) ? part("Records updated", revised, "nw-part nw-revised") : '') + '</div>';
}
export function homeSummaryHtml(today, opts){
  today = today || localDateStr();
  opts = opts || {};
  var nw = opts.netWorth != null ? opts.netWorth : totalNetWorthValue();
  // v3.103.0: the line ends at today's figure and the change is measured from where the line starts,
  // so the text and the line can't disagree.
  var trend = trendToToday(state.netWorthLog, nw, today, 12);
  var stale = staleAssets().length;
  var nwCard = '<div class="home-card home-nw" data-home-card="nw"><span class="home-k">Net worth</span>' +
    '<div class="home-nw-head"><b class="home-big">' + money(nw) + '</b>' +
    (trend ? '<span class="home-chip ' + (trend.change >= 0 ? "up" : "down") + '"><span aria-hidden="true">' + (trend.change >= 0 ? "▲" : "▼") + '</span> ' + signed(trend.change) + ' since ' + shortDate(trend.from.date, today) + '</span>' : '') + '</div>' +
    (trend ? areaHtml(trend.points) + moverHtml(trend.from.date, today, trend.change) : '<small>The trend appears as the days go by</small>') +
    '<small class="home-asof">Recorded balances · as of ' + escapeAttr(fmtDate(today)) + (stale ? ' · <span class="warn">' + stale + ' values need updating</span>' : '') + '</small>' +
    '<button type="button" class="link-btn home-link" data-home-go="assets">Net worth over time →</button></div>';
  // #309 (pages.md §4): nothing owned or owed yet is said, with where to start — not "$0" and a flat line.
  if(nw === 0 && !(state.assets || []).length && !(state.properties || []).length && !(state.debts || []).length)
    nwCard = '<div class="home-card home-nw is-empty" data-home-card="nw"><span class="home-k">Net worth</span>' +
      emptyStateHtml("Nothing you own or owe is entered yet — accounts, super, a car, a home and its loan.", { go: "networth", label: "Go to Accounts →", className: "home-note" }) + '</div>';

  var ym = selectedMonth(today);
  // Planned against the household as it is (Current situation), not whichever scenario is selected.
  var r = monthReview(ym, { accountOf: transactionAccount, categoryOf: transactionCategory, today: today, items: opts.items || budgetLineItems(currentScenario()) });
  var saved = r.incomeReceived - r.spent;
  var mp = monthPhrase(ym);
  // Spent against planned, tinted by pace: within the month's share gone is on track, a little over is a warning.
  var gone = monthGone(ym, today), pace = r.plannedSpend > 0 ? r.spent / r.plannedSpend : 0;
  var spendTone = r.spent > r.plannedSpend && r.plannedSpend > 0 ? "bad" : pace <= (gone != null ? gone : 1) + 0.05 ? "good" : pace <= (gone != null ? gone : 1) + 0.2 ? "warn" : "bad";
  var monthCard = '<div class="home-card home-month" data-home-card="month"><span class="home-k">' + (mp === "this month" ? "This month" : escapeAttr(r.label)) + '</span>' +
    // With nothing logged as received, "kept" is just spending with a minus sign — say what's missing instead.
    (r.incomeReceived === 0 && r.income.length
      ? '<div class="home-left"><small>Left from received</small><b>—</b><em>log money in to see it</em></div>'
      : '<div class="home-left"><small>Left from received</small><b class="home-big ' + (saved >= 0 ? "up" : "down") + '">' + (saved < 0 ? "−" : "") + money(Math.abs(saved)) + '</b><em>' + r.transactions + ' transaction' + (r.transactions === 1 ? "" : "s") + ' logged</em></div>') +
    meterHtml("Spent", r.spent, r.plannedSpend, spendTone, gone) +
    meterHtml("Received", r.incomeReceived, r.incomePlanned, "in", null) +
    (r.missingIncome ? '<p class="home-note">' + r.missingIncome + ' income line' + (r.missingIncome === 1 ? " hasn't" : "s haven't") + ' been logged ' + escapeAttr(mp) + '.</p>' : '');
  var monthLink = '<button type="button" class="link-btn home-link" data-home-go="expenses" data-home-sub="spending">See spending →</button>';

  var planned = scenarioTotals(currentScenario());
  var reserve = emergencyFund();
  // #309 (pages.md §4): a month with no pay, no budget and nothing logged says so, with the first step — not six $0s.
  var monthEmpty = !r.income.length && !r.incomePlanned && !r.plannedSpend && !r.transactions && !r.spent && !r.incomeReceived;
  if(monthEmpty) monthCard = '<div class="home-card home-month is-empty" data-home-card="month"><span class="home-k">' + (mp === "this month" ? "This month" : escapeAttr(r.label)) + '</span>' +
    emptyStateHtml("Nothing planned or logged yet — the month fills in from your pay and your budget.", { go: "expenses/income", label: "Go to Income →", className: "home-note" }) + '</div>';
  // The plan, and the reserve, as two chips: planned (not logged) money, said as such.
  else monthCard += '<div class="home-plan-context"><span class="home-chip" title="An estimate from your budget, not what was logged">Planned monthly surplus <b>' + money(planned.regularNetMonthly != null ? planned.regularNetMonthly : planned.netMonthly) + '</b></span>' +
    (reserve.coveredMonths != null ? '<span class="home-chip ' + (reserve.coveredMonths >= 6 ? "up" : reserve.coveredMonths >= 3 ? "" : "down") + '" title="Cash and offsets against your essential costs">Reserve <b>' + reserve.coveredMonths.toFixed(1) + ' months</b></span>'
      : '<span class="home-chip">Add essential costs to see your reserve</span>') + '</div>' + monthLink + '</div>';

  var bills = upcomingBills(opts.items || loggableBudgetLineItems(currentScenario()), state.transactions, today, 14);
  var billsCard = '<div class="home-card home-bills" data-home-card="bills"><span class="home-k">Bills — next 2 weeks</span>' +
    (bills.length ? '<ul class="home-list">' + bills.slice(0, 5).map(function(b){
      var when = b.days < 0 ? "overdue " + Math.abs(b.days) + "d" : b.days === 0 ? "today" : b.days === 1 ? "tomorrow" : shortDate(b.due, today);
      // A date chip, tinted by how soon: overdue, within three days, later.
      var tone = b.days < 0 ? "bad" : b.days <= 3 ? "warn" : "";
      var chip = b.days < 0 ? '<b>' + Math.abs(b.days) + 'd</b><small>late</small>' : b.days === 0 ? '<b>Today</b>' : b.days === 1 ? '<b>Tmrw</b>' : '<b>' + Number(b.due.slice(8, 10)) + '</b><small>' + MONTHS[Number(b.due.slice(5, 7)) - 1] + '</small>';
      // Paid: log it from here, pre-filled (a card's repayment and what the property manager pays come with their statements).
      var paid = b.card || b.agent ? '' : '<button type="button" class="home-bill-paid" data-bill-paid="' + escapeAttr(b.id) + '" data-bill-due="' + escapeAttr(b.due) + '" data-bill-amount="' + escapeAttr(String(b.amount)) + '" aria-label="Log ' + escapeAttr(b.what) + ' as paid">Paid</button>';
      return '<li><span class="home-date ' + tone + '" aria-hidden="true">' + chip + '</span><span class="home-bill-name" title="' + escapeAttr(b.what) + '">' + escapeAttr(b.what) + '</span><em class="' + tone + '">' + when + '</em><b>' + money(b.amount) + '</b>' + paid + '</li>';
    }).join("") + '</ul>' + (bills.length > 5 ? '<small>and ' + (bills.length - 5) + ' more</small>' : '')
    : emptyStateHtml("Nothing expected. Bills appear here once a payment has been logged against their budget line.", { go: "expenses/spending", label: "Go to Transactions →", className: "home-note" })) + '</div>';

  var todos = opts.todos || homeTodos();
  var more = todos.length - HOME_TODO_MAX;
  var todoCard = '<div class="home-card home-todo" data-home-card="todo"><span class="home-k">To do</span>' +
    (todos.length ? '<ul class="home-list">' + todos.slice(0, HOME_TODO_MAX).map(function(t){
      return '<li><button type="button" class="home-todo-btn ' + (t.severity === "bad" ? "bad" : t.severity === "warn" ? "warn" : "") + '"' + todoAttrs(t) + '>' + escapeAttr(t.title) + ' <span aria-hidden="true">›</span></button></li>';
    }).join("") + '</ul>' + (more > 0 ? '<button type="button" class="link-btn home-todo-all" data-open-bell>All ' + todos.length + ' to-dos →</button>' : '')
    : '<p class="home-note">All done — nothing needs you right now.</p>') + '</div>';

  return (isPeriodToday() ? '' : '<p class="home-period-note">Showing ' + escapeAttr(r.label) + ' — net worth, bills and to-dos are always as of today.</p>') +
    (opts.autoPay === false ? '' : autoPayCardHtml(today)) +
    (opts.lowBalance === false ? '' : lowBalanceCardHtml(today)) +
    '<div class="home-grid">' + monthCard + nwCard + billsCard + todoCard + '</div>' +
    (opts.week === false ? '' : weekCardHtml(today)) + (opts.yearReview === false ? '' : yearReviewCardHtml(opts.notifications)) + goalsStripHtml(today);
}

// #396: once a household year has finished with something logged in it, a card that opens Reports → Year in review —
// the bell's "yearreview" item (lib/notifications.js), so reading it in either place puts both away.
export function yearReviewCardHtml(list){
  var n = (list || getNotifications()).find(function(x){ return x.type === "yearreview" && !x.read; });
  if(!n) return "";
  return '<section class="home-card home-yearreview" data-home-card="yearreview" aria-labelledby="homeYearReviewHead">' +
    '<div class="wk-head"><span class="home-k" id="homeYearReviewHead">' + escapeAttr(n.title) + '</span>' +
      '<span class="wk-nav"><button type="button" class="icon-btn" data-yr-dismiss="' + escapeAttr(n.id) + '" aria-label="Dismiss the year in review card">✕</button></span></div>' +
    '<p class="home-note">Where the money went, net worth, money leaks, the emergency fund and goals — each with what to do next.</p>' +
    '<button type="button" class="btn btn-sm" data-yr-open' + todoAttrs(n) + '>Open the review <span aria-hidden="true">›</span></button></section>';
}

// Savings goals (v3.65.0): a strip under the cards, each its progress bar, linking to where goals are kept — Plan → Goals
// since goals moved there (it linked to Accounts, where they used to be).
function goalsStripHtml(today){
  if(!(state.savingsGoals || []).length) return "";
  var ov = goalsOverview(today, scenarioTotals(currentScenario()).netMonthly);
  return '<div class="home-goals" data-home-card="goals"><span class="home-k">Goals</span><div class="home-goals-list">' + ov.goals.slice(0, 4).map(function(g, i){ return goalCardHtml(g, i, { compact: true }); }).join("") + '</div>' +
    '<button type="button" class="link-btn home-link" data-home-go="plan" data-home-sub="goals">All goals →</button></div>';
}
export function renderHomeSummary(){
  var el = typeof document !== "undefined" && document.getElementById("homeSummary");
  if(el) el.innerHTML = homeSummaryHtml();
  applyHomeLayout();
}

// ---------------- Your week (v3.166.0, item 196) — calc/weekrecap.js decides ----------------
// Session-only: which week is on screen.
export var weekView = { back: 0 };
// The one notice: the most pressing thing to act on, as Insights orders them.
function weekNotice(today){
  var items;
  try { items = adviceFor({ today: today }); } catch(e){ items = []; }
  return items.filter(function(a){ return a.kind !== "good" && partAllows(a.id, state); })
    .sort(function(a, b){ return (a.kind === "risk" ? 0 : 1) - (b.kind === "risk" ? 0 : 1) || Math.abs(b.impactYearly || 0) - Math.abs(a.impactYearly || 0); })[0] || null;
}
export function weekRecapFor(today, back){
  return weekRecap(state.transactions, today, {
    back: back,
    bills: back ? [] : upcomingBills(loggableBudgetLineItems(currentScenario()), state.transactions, today, 7),
    toReview: back ? 0 : toReview(state.transactions).length,
    notice: back ? null : weekNotice(today)
  });
}
function dayMonth(iso){ return Number(iso.slice(8, 10)) + " " + MONTHS[Number(iso.slice(5, 7)) - 1]; }
// "19–25 Oct", or "28 Sep – 4 Oct" across a month's end.
function weekRange(a, b){ return a.slice(0, 7) === b.slice(0, 7) ? Number(a.slice(8, 10)) + "–" + dayMonth(b) : dayMonth(a) + " – " + dayMonth(b); }
export function weekCardHtml(today, recap){
  today = today || localDateStr();
  if(!recap && !showWeekRecap(state, today)) return "";
  var w = recap || weekRecapFor(today, weekView.back);
  var range = weekRange(w.start, w.end);
  var vs = w.usual == null ? '<small>Your usual week shows here after three weeks of spending logged</small>'
    : Math.abs(w.vsUsual) < 1 ? '<small>About your usual week</small>'
    : '<small class="' + (w.vsUsual > 0 ? "down" : "up") + '">' + money(Math.abs(w.vsUsual)) + (w.vsUsual > 0 ? " more" : " less") + ' than your usual week (' + money(w.usual) + ')</small>';
  var list = function(rows, fn){ return '<ul class="home-list">' + rows.map(fn).join("") + '</ul>'; };
  var biggest = w.biggest.length ? '<div class="wk-part"><span class="wk-k">Biggest</span>' + list(w.biggest, function(t){
    var name = transactionDisplayName(t, state.shared) || t.what || "A purchase";
    return '<li><span title="' + escapeAttr(name) + '">' + escapeAttr(name) + '</span><em>' + dayMonth(t.date) + '</em><b>' + money(t.amount) + '</b></li>';
  }) + '</div>' : '';
  var bills = w.back ? '' : '<div class="wk-part"><span class="wk-k">Bills, next 7 days' + (w.bills.length ? ' · ' + money(w.billsTotal) : '') + '</span>' +
    (w.bills.length ? list(w.bills.slice(0, 3), function(b){
      return '<li><span title="' + escapeAttr(b.what) + '">' + escapeAttr(b.what) + '</span><em>' + (b.days === 0 ? "today" : b.days === 1 ? "tomorrow" : dayMonth(b.due)) + '</em><b>' + money(b.amount) + '</b></li>';
    }) + (w.bills.length > 3 ? '<small>and ' + (w.bills.length - 3) + ' more</small>' : '') : '<p class="home-note">None due.</p>') + '</div>';
  var foot = (w.toReview ? '<button type="button" class="btn btn-sm btn-primary" data-txr-open>Review ' + w.toReview + ' new transaction' + (w.toReview === 1 ? '' : 's') + '</button>' : '') +
    (w.notice ? '<p class="wk-notice"><span class="wk-k">Worth a look</span> ' + escapeAttr(w.notice.title) +
      (w.notice.go ? ' <button type="button" class="link-btn" data-adv-go="' + escapeAttr(w.notice.go.page) + '"' + (w.notice.go.sub ? ' data-adv-sub="' + escapeAttr(w.notice.go.sub) + '"' : '') + '>See →</button>' : '') + '</p>' : '');
  return '<section class="home-card home-week" data-home-card="week" aria-label="Your week, ' + range + '">' +
    '<div class="wk-head"><span class="home-k">' + (w.back ? "Week of " + dayMonth(w.start) : "Your week") + ' <span class="wk-range">· ' + range + '</span></span>' +
      '<span class="wk-nav"><button type="button" class="icon-btn" data-wk-step="1" aria-label="The week before"' + (w.back >= KEEP_WEEKS - 1 ? ' disabled' : '') + '>‹</button>' +
      '<button type="button" class="icon-btn" data-wk-step="-1" aria-label="The week after"' + (w.back ? '' : ' disabled') + '>›</button>' +
      '<button type="button" class="icon-btn" data-wk-dismiss aria-label="Dismiss this week\'s card">✕</button></span></div>' +
    '<details class="wk-details"><summary>Weekly recap · ' + money(w.spent) + ' spent</summary><div class="wk-body"><div class="wk-part wk-spent"><b class="home-big">' + money(w.spent) + '</b><span>spent · ' + w.count + ' transaction' + (w.count === 1 ? '' : 's') + '</span>' + vs +
      '<button type="button" class="link-btn home-link" data-sv data-sv-direction="out" data-sv-from="' + w.start + '" data-sv-to="' + w.end + '">See this week in Transactions →</button></div>' +
      biggest + bills + '</div>' +
    (foot ? '<div class="wk-foot">' + foot + '</div>' : '') + '</details></section>';
}
