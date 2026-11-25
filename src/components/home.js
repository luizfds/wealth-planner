import { homeTodoItems, attentionIconHtml, knowItems } from "../lib/attention.js";
import { getNotifications, staleAssetNamesList } from "../lib/notifications.js";
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
import { fmtCurrency0, fmtCompact, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { upcomingBills as calendarUpcoming } from "../calc/bills.js";
import { applyHomeLayout } from "../lib/homelayout.js";
import { weekRecap, showWeekRecap, KEEP_WEEKS } from "../calc/weekrecap.js";
import { spendingTransactions } from "../calc/propertymoney.js";
import { transactionDisplayName } from "../calc/ledger.js";
import { adviceFor } from "../calc/advice.js";
import { partAllows } from "../calc/parts.js";
import { autoPayCardHtml } from "./autopay.js";
import { emptyStateHtml } from "../lib/empty.js";
import { standingFigures } from "../calc/standing.js";
import { liquidityForecast } from "../calc/liquidity.js";
import { monthlyCashFlowForecast } from "../calc/cashflow.js";
import { emergencyFund } from "../calc/emergency.js";
import { rateStress } from "../calc/scenariostress.js";
import { liquidityInputs } from "./dashboard.js";

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
// The hero's line: net worth over the same months as its change, drawn faintly behind the figure. Decorative — the
// change is written beside it, and Net worth's card below has the chart.
export function sparkHtml(points){
  if(!points || points.length < 2) return "";
  var w = 240, h = 80, vals = points.map(function(p){ return Number(p.value) || 0; });
  var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
  // The follow-up review (November 2026): the line spans at least a fifth of net worth. Stretched to the card's height,
  // a real household's one-day blip of a few percent (a balance briefly counted twice) drew as a towering spike; the
  // chip beside the line says the exact change.
  var floor = Math.max(Math.abs(min), Math.abs(max)) * 0.2 || 2;
  if(max - min < floor){ var mid = (max + min) / 2; min = mid - floor / 2; max = mid + floor / 2; }
  var xy = vals.map(function(v, i){ return [(i / (vals.length - 1)) * w, 8 + (1 - (v - min) / (max - min)) * (h - 16)]; });
  var line = xy.map(function(p, i){ return (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ");
  return '<svg class="home-glance-spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
    '<path class="fill" d="' + line + ' L' + w + ',' + h + ' L0,' + h + ' Z"/><path class="line" d="' + line + '" vector-effect="non-scaling-stroke"/></svg>';
}

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
// What in Needs you can't wait: a bill that's late, a to-do marked urgent. The follow-up review (November 2026): the Today
// tab carried a count of its own (Checks to fix) beside Needs you's and the bell's; now Needs you's is the one count, and
// the tab only marks that something there is urgent.
export function needsYouUrgent(today){
  today = today || localDateStr();
  var late = upcomingBills(loggableBudgetLineItems(currentScenario()), state.transactions, today, 7).filter(function(b){ return b.days < 0; });
  return late.length + homeTodos().filter(function(t){ return t.severity === "bad"; }).length;
}
function todoAttrs(n){
  return ' data-notif-id="' + escapeAttr(n.id) + '" data-notif-page="' + escapeAttr(n.page) + '"' + (n.sub ? ' data-notif-sub="' + escapeAttr(n.sub) + '"' : '') +
    (n.action ? ' data-notif-action="' + escapeAttr(n.action) + '"' : '') + (n.fy != null ? ' data-notif-fy="' + escapeAttr(String(n.fy)) + '"' : '') +
    (n.line ? ' data-notif-line="' + escapeAttr(n.line) + '" data-notif-due="' + escapeAttr(n.due || "") + '"' : '');
}

export function homeSummaryHtml(today, opts){
  today = today || localDateStr();
  opts = opts || {};
  var nw = opts.netWorth != null ? opts.netWorth : totalNetWorthValue();
  // v3.103.0: the line ends at today's figure and the change is measured from where the line starts,
  // so the text and the line can't disagree.
  var trend = trendToToday(state.netWorthLog, nw, today, 12);
  var staleList = staleAssets(), stale = staleList.length;
  // The glance's hero says net worth, its change and its line; the card that said it again under it went (the owner,
  // November 2026). It stays only as the empty state — what to enter first — until something is owned or owed.
  var nwCard = '';
  // #309 (pages.md §4): nothing owned or owed yet is said, with where to start — not "$0" and a flat line.
  var nwEmpty = nw === 0 && !(state.assets || []).length && !(state.properties || []).length && !(state.debts || []).length;
  if(nwEmpty)
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
  // What's left is Where you stand's first figure (the app assessment: each figure once); the card under it says how
  // the month is going against the plan — spent and received, each against what was planned.
  var monthCard = '<div class="home-card home-month" data-home-card="month"><span class="home-k">' + (mp === "this month" ? "This month" : escapeAttr(r.label)) + ' <small class="home-k-sub">' + r.transactions + ' transaction' + (r.transactions === 1 ? "" : "s") + ' logged</small></span>' +
    meterHtml("Spent", r.spent, r.plannedSpend, spendTone, gone) +
    // The follow-up review: Transactions' total counts what pots paid for; this doesn't (a pot is judged over its year) —
    // so it says what it left out, and the two figures add up.
    (r.reserveSpent > 0.5 ? '<p class="home-note home-pots">Plus ' + fmtCurrency0.format(Math.round(r.reserveSpent)) + ' paid from set-aside pots — they\'re judged over their year, not this month.</p>' : '') +
    meterHtml("Received", r.incomeReceived, r.incomePlanned, "in", null) +
    (r.missingIncome ? '<p class="home-note">' + r.missingIncome + ' income line' + (r.missingIncome === 1 ? " hasn't" : "s haven't") + ' been logged ' + escapeAttr(mp) + '.</p>' : '');
  var monthLink = '<button type="button" class="link-btn home-link" data-home-go="expenses" data-home-sub="spending">See spending →</button>';

  // #309 (pages.md §4): a month with no pay, no budget and nothing logged says so, with the first step — not six $0s.
  var monthEmpty = !r.income.length && !r.incomePlanned && !r.plannedSpend && !r.transactions && !r.spent && !r.incomeReceived;
  if(monthEmpty) monthCard = '<div class="home-card home-month is-empty" data-home-card="month"><span class="home-k">' + (mp === "this month" ? "This month" : escapeAttr(r.label)) + '</span>' +
    emptyStateHtml("Nothing planned or logged yet — the month fills in from your pay and your budget.", { go: "expenses/income", label: "Go to Income →", className: "home-note" }) + '</div>';
  // The planned surplus is Plans' tile and the reserve Where you stand's — each said once, not here as well.
  else monthCard += monthLink + '</div>';

  var bills = upcomingBills(opts.items || loggableBudgetLineItems(currentScenario()), state.transactions, today, 14);
  var todos = opts.todos || homeTodos();
  // Needs you (the owner: Today as the place to know where you stand — what needs you first): the bills due this week,
  // each with Paid, and the to-dos, in one list. Bills further out are a link to the Bills calendar.
  var soon = bills.filter(function(b){ return b.days <= 7; }), later = bills.length - soon.length;
  var billRows = soon.slice(0, 5).map(function(b){
    var when = b.days < 0 ? "overdue " + Math.abs(b.days) + "d" : b.days === 0 ? "today" : b.days === 1 ? "tomorrow" : shortDate(b.due, today);
    // A date chip, tinted by how soon: overdue, within three days, later.
    var tone = b.days < 0 ? "bad" : b.days <= 3 ? "warn" : "";
    var chip = b.days < 0 ? '<b>' + Math.abs(b.days) + 'd</b><small>late</small>' : b.days === 0 ? '<b>Today</b>' : b.days === 1 ? '<b>Tmrw</b>' : '<b>' + Number(b.due.slice(8, 10)) + '</b><small>' + MONTHS[Number(b.due.slice(5, 7)) - 1] + '</small>';
    // Paid: log it from here, pre-filled (a card's repayment and what the property manager pays come with their statements).
    var paid = b.card || b.agent ? '' : '<button type="button" class="home-bill-paid" data-bill-paid="' + escapeAttr(b.id) + '" data-bill-due="' + escapeAttr(b.due) + '" data-bill-amount="' + escapeAttr(String(b.amount)) + '" aria-label="Log ' + escapeAttr(b.what) + ' as paid">Paid</button>';
    return '<li><span class="home-date ' + tone + '" aria-hidden="true">' + chip + '</span><span class="home-bill-name" title="' + escapeAttr(b.what) + '">' + escapeAttr(b.what) + '</span><em class="' + tone + '">' + when + '</em><b>' + money(b.amount) + '</b>' + paid + '</li>';
  });
  var more = todos.length - HOME_TODO_MAX;
  var todoRows = todos.slice(0, HOME_TODO_MAX).map(function(t){
    return '<li><button type="button" class="home-todo-btn ' + (t.severity === "bad" ? "bad" : t.severity === "warn" ? "warn" : "") + '"' + todoAttrs(t) + '>' + attentionIconHtml(t) + '<span class="home-todo-title">' + escapeAttr(t.title) + '</span><span aria-hidden="true">›</span></button></li>';
  });
  var needsCount = soon.length + todos.length;
  var know = [];
  if(opts.know !== false){ try { know = knowItems(today); } catch(e){ know = []; } }
  // The follow-up review (November 2026): the card is tinted only for a bill that's overdue — money late is the one thing
  // that can't wait. An urgent to-do wears its own red mark (.home-todo-btn.bad); one item no longer turns the whole
  // card red, and a count alone is the badge's to say.
  var needsTone = soon.some(function(b){ return b.days < 0; }) ? " attn-bad" : "";
  var needsCard = '<div class="home-card home-needs' + needsTone + '" data-home-card="needs"><span class="home-k">Needs you' + (needsCount ? ' <span class="home-count">' + needsCount + '</span>' : '') + '</span>' +
    (billRows.length ? '<div class="home-sub">Bills this week</div><ul class="home-list home-bill-list">' + billRows.join("") + '</ul>' : '') +
    (todoRows.length ? (billRows.length ? '<div class="home-sub">To do</div>' : '') + '<ul class="home-list">' + todoRows.join("") + '</ul>' : '') +
    (!billRows.length && !todoRows.length ? emptyStateHtml("Nothing due this week and nothing to do — you're up to date.", { done: true, className: "home-note" }) : '') +
    // The app assessment (November 2026): Insights' tips (what the app notices — an opportunity, something worth knowing)
    // are said here too, as one line opening them in the bell, so a household without Insights on screen sees them.
    (know.length ? '<button type="button" class="link-btn home-know" data-open-bell>' + know.length + ' worth knowing — ' + escapeAttr(know[0].title) + ' →</button>' : '') +
    '<div class="home-needs-links">' + (more > 0 ? '<button type="button" class="link-btn home-todo-all" data-open-bell>All ' + todos.length + ' to-dos →</button>' : '') +
      '<button type="button" class="link-btn home-link" data-home-go="expenses" data-home-sub="bills">' + (later > 0 ? later + ' more bill' + (later === 1 ? '' : 's') + ' in the next fortnight →' : 'Bills calendar →') + '</button></div></div>';

  // The glance: net worth as the page's one hero, in Today's colour (the app assessment, November 2026: the three tiles
  // under it each said again what a card below says — the month, the next bill, Needs you's count — so they went).
  var glanceTile = function(go, look, label, value, sub, extra){
    return '<button type="button" class="home-glance-tile ' + look + '" data-glance-go="' + go + '">' + (extra || '') + '<span class="home-glance-k">' + label + '</span><b>' + value + '</b><small>' + sub + '</small></button>';
  };
  var glance = '<nav class="home-glance" data-home-card="glance" aria-label="At a glance">' +
    // Net worth opens Accounts, where it's broken down — there's no card under it to go to.
    (nwEmpty ? glanceTile("nw", "is-hero", "Net worth", "—", "")
      : glanceTile("nw", "is-hero", "Net worth", fmtCurrency0.format(nw), (trend ? '<span class="home-glance-chip">' + (trend.change >= 0 ? "▲ " : "▼ ") + fmtCompact(Math.abs(trend.change)) + ' since ' + shortDate(trend.from.date, today) + '</span>' : 'as of today') +
        // Where the figure comes from (the card said "Recorded balances"), or how many of them are out of date.
        // The follow-up review: said here only — the banner under the card that named them went, so the names are its title.
        (stale ? '<span class="home-glance-stale" title="Due a fresh value: ' + escapeAttr(staleAssetNamesList(staleList, 3)) + '">' + stale + ' value' + (stale === 1 ? '' : 's') + ' to update</span>' : '<span class="home-glance-asof">Recorded balances</span>'), trend ? sparkHtml(trend.points) : '')
      ).replace('data-glance-go="nw"', 'data-home-go="networth"') +
  '</nav>';

  // Glance, then what needs you, then the month and net worth; goals, the year in review and the week's recap after.
  return (isPeriodToday() ? '' : '<p class="home-period-note">Showing ' + escapeAttr(r.label) + ' — net worth, bills and to-dos are always as of today.</p>') +
    // A household with nothing in it has nothing to glance at: its cards below say what to enter, each with where.
    // The hero and Where you stand side by side on a wide screen (dashboard.css .home-top), stacked on a phone.
    '<div class="home-top">' + (opts.glance === false || (nwEmpty && monthEmpty) ? '' : glance) +
    (opts.standing === false || (nwEmpty && monthEmpty) ? '' : standingCardHtml(todos, monthEmpty ? null
      : { left: r.incomeReceived === 0 && r.income.length ? null : saved, spent: r.spent, planned: r.plannedSpend, label: mp === "this month" ? "this month" : "in " + r.label })) + '</div>' +
    (opts.autoPay === false ? '' : autoPayCardHtml(today)) +
    (opts.lowBalance === false ? '' : lowBalanceCardHtml(today)) +
    '<div class="home-grid">' + needsCard + monthCard + nwCard + '</div>' +
    goalsStripHtml(today) + (opts.yearReview === false ? '' : yearReviewCardHtml(opts.notifications)) + (opts.week === false ? '' : weekCardHtml(today));
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
  // Spending, not a purchase's deposit or settlement (property money: calc/propertymoney.js).
  return weekRecap(spendingTransactions(state), today, {
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

// #457: where you stand — at most five decision figures (calc/standing.js), each from a calculation the app already
// does, labelled with its period or scenario, a way to where it's worked out, and "not known" rather than $0.
var STANDING_GO = { insights: ' data-home-go="dashboard" data-home-sub="insights"', budget: ' data-home-go="expenses" data-home-sub="budget"',
  emergency: ' data-home-go="plan" data-home-sub="goals"', loans: ' data-home-go="properties"', accounts: ' data-home-go="accounts"', needs: ' data-glance-go="needs"',
  forecast: ' data-home-go="plan" data-home-sub="scenarios" data-home-scroll="#cashFlowForecastPanel"',
  spending: ' data-home-go="expenses" data-home-sub="spending"', income: ' data-home-go="expenses" data-home-sub="income"' };
// month: { left (null when nothing's been received), spent, planned, label } or null — homeSummaryHtml's month.
export function standingCardHtml(todos, month){
  var figures;
  try {
    var scenario = currentScenario(), t = scenarioTotals(scenario);
    var hasPlan = (state.income || []).length || (state.shared || []).length;
    var liq = hasPlan ? liquidityForecast(liquidityInputs(monthlyCashFlowForecast(12).months, 0)) : null;
    var em = null, stress = null;
    try { em = emergencyFund(); } catch(e){ em = null; }
    var hasLoans = (state.properties || []).some(function(p){ return (p.loans || []).some(function(l){ return !l.endedOn && Number(l.balance) > 0; }); });
    try { stress = hasLoans ? rateStress(scenario, 2, t) : null; } catch(e){ stress = null; }
    figures = standingFigures({ month: month || null, liquidity: liq,
      emergency: em, stress: stress, hasLoans: hasLoans,
      monthLabel: function(m){ return MONTHS[m.month - 1] + " " + String(m.year).slice(2); } });
  } catch(err){ return ""; }
  var val = function(f){
    if(f.value == null) return '—';
    if(f.unit) return f.value + ' <small>' + f.unit + '</small>';
    return (f.value < 0 ? "−" : "") + fmtCompact(Math.abs(f.value)) + (f.perMonth ? '<small>/mo</small>' : '');
  };
  return '<section class="home-card home-standing" data-home-card="standing" aria-labelledby="homeStandingHead"><span class="home-k" id="homeStandingHead">Where you stand</span>' +
    '<ul class="hs-list">' + figures.map(function(f){
      return '<li><button type="button" class="hs-fig' + (f.value == null ? ' is-unknown' : f.tone ? ' is-' + f.tone : '') + '"' + (STANDING_GO[f.go] || '') + '>' +
        '<span class="hs-k">' + escapeAttr(f.label) + '</span><b class="hs-v">' + val(f) + '</b><small class="hs-sub">' + escapeAttr(f.sub) + '</small></button></li>';
    }).join("") + '</ul></section>';
}
