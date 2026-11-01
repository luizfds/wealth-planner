import { lowBalanceCardHtml } from "./dailyforecast.js";
import { toReview } from "../calc/reviewqueue.js";
import { state } from "../state.js";
import { selectedMonth, monthPhrase, isPeriodToday } from "../calc/ledger.js";
import { totalNetWorthValue, scenarioTotals, currentScenario } from "../calc/engine.js";
import { goalsOverview } from "../calc/savegoals.js";
import { goalCardHtml } from "./savegoals.js";
import { monthReview, reviewMonth, monthLabel } from "../calc/monthreview.js";
import { dataHealthChecks } from "../calc/health.js";
import { accountBalance } from "../calc/accounts.js";
import { lodgementStatus, taxYearRecord } from "../calc/taxyear.js";
import { getTaxPeople } from "../calc/tax.js";
import { fyLabel } from "../calc/property.js";
import { budgetLineItems, loggableBudgetLineItems, transactionAccount, transactionCategory } from "./expenses.js";
import { sparklineHtml } from "../lib/charts.js";
import { trendToToday } from "../calc/history.js";
import { fmtCurrency0, localDateStr } from "../lib/format.js";
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
function signed(n){ return (n < 0 ? "−" : "+") + fmtCurrency0.format(Math.abs(n)); }

// Bills expected in the next `days` days (and unpaid ones from the last week) — v3.94.1: the bills
// calendar's own reading (calc/bills.js upcomingBills), so ended lines, spending budgets, bills on
// a card and bills that stopped aren't flagged here while the calendar leaves them out.
export function upcomingBills(items, transactions, today, days){
  return calendarUpcoming(items, transactions, today, days, { accounts: state.accounts, transfers: state.transfers });
}

// The to-do list: each { text, go, sub?, tone } where `go` is a page and `sub` its tab.
export function homeTodos(today, opts){
  opts = opts || {};
  var out = [];
  // v3.163.0 (item 193): imported rows nobody has looked at yet come first.
  var waiting = toReview(state.transactions).length;
  if(waiting) out.push({ text: waiting + " new transaction" + (waiting === 1 ? "" : "s") + " to review", go: "txreview", tone: "warn" });
  var ym = reviewMonth(today);
  var rev = state.monthReviews && state.monthReviews[ym];
  if(!(rev && rev.done)) out.push({ text: "Review " + monthLabel(ym), go: "dashboard", sub: "review", tone: "warn" });
  var checks = (opts.checks || dataHealthChecks({ today: today })).filter(function(c){ return c.severity !== "info"; });
  if(checks.length) out.push({ text: checks.length + " thing" + (checks.length === 1 ? "" : "s") + " to fix in Checks", go: "settings", sub: "checks", tone: checks.some(function(c){ return c.severity === "bad"; }) ? "bad" : "warn" });
  var stale = (state.accounts || []).filter(function(a){
    var b = accountBalance(a);
    return b.balance != null && b.date && Math.round((Date.parse(today) - Date.parse(b.date)) / 86400000) > 35;
  });
  if(stale.length) out.push({ text: "Update " + (stale.length === 1 ? stale[0].name + "'s balance" : stale.length + " account balances"), go: "accounts", tone: "warn" });
  var lodge = lodgementStatus(today);
  if(lodge.inSeason && getTaxPeople().length){
    var rec = taxYearRecord(lodge.fy, false);
    var lodged = rec && rec.lodged ? Object.keys(rec.lodged).length : 0;
    if(lodged < getTaxPeople().length) out.push({ text: "Lodge " + fyLabel(lodge.fy) + " — " + lodge.daysLeft + " days to 31 October", go: "tax", sub: "returns", tone: lodge.daysLeft <= 21 ? "bad" : "warn", fy: lodge.fy });
  }
  // v3.72.0: a rent review coming up, and a fixed rate about to end.
  (state.properties || []).forEach(function(p){
    if(p.nextRentReview){
      var dr = Math.round((Date.parse(p.nextRentReview) - Date.parse(today)) / 86400000);
      if(dr <= 30) out.push({ text: (p.what || "Property") + ": rent review " + (dr < 0 ? "was due " + p.nextRentReview : dr === 0 ? "today" : "in " + dr + " days"), go: "properties", tone: dr < 0 ? "bad" : "warn" });
    }
    (p.loans || []).forEach(function(l){
      if(!l.fixedUntil || l.endedOn) return;
      var df = Math.round((Date.parse(l.fixedUntil) - Date.parse(today)) / 86400000);
      if(df >= 0 && df <= 90) out.push({ text: (l.what || "A loan") + ": fixed rate ends in " + df + " days", go: "properties", tone: "warn" });
    });
  });
  var lastBackup = state.lastBackupDate;
  var backupAge = lastBackup ? Math.round((Date.parse(today) - Date.parse(lastBackup)) / 86400000) : null;
  if(backupAge == null || backupAge > 30) out.push({ text: lastBackup ? "Back up — the last was " + backupAge + " days ago" : "Make your first backup", go: "backup", tone: "warn" });
  return out;
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
  var part = function(label, v, cls){ return '<span class="' + cls + '">' + label + ' <b class="' + (v >= 0 ? "up" : "down") + '">' + signed(v) + '</b></span>'; };
  // The headline's change runs from the figure logged back then; the parts from that day rebuilt from
  // today's records. A balance updated or back-dated since makes the two differ — said, not hidden,
  // so the parts always add up to the headline.
  var revised = change != null ? Math.round(change - sp.money - sp.values) : 0;
  return '<small class="home-nw-mover">' + part("Cash &amp; loans", sp.money, "nw-part") + ' · ' +
    part("Property &amp; investments", sp.values, "nw-part") + (sp.top ? ' <span class="nw-top">(mostly ' + escapeAttr(sp.top.label.toLowerCase()) + ')</span>' : '') +
    (Math.abs(revised) >= Math.max(500, Math.abs(change) * 0.05) ? ' · ' + part("Records updated since", revised, "nw-part nw-revised") : '') + '</small>';
}
export function homeSummaryHtml(today, opts){
  today = today || localDateStr();
  opts = opts || {};
  var nw = opts.netWorth != null ? opts.netWorth : totalNetWorthValue();
  // v3.103.0: the line ends at today's figure and the change is measured from where the line starts,
  // so the text and the line can't disagree.
  var trend = trendToToday(state.netWorthLog, nw, today, 12);
  var nwCard = '<div class="home-card home-nw" data-home-card="nw"><span class="home-k">Net worth</span><b class="home-big">' + money(nw) + '</b>' +
    (trend ? '<small class="' + (trend.change >= 0 ? "up" : "down") + '">' + signed(trend.change) + ' since ' + shortDate(trend.from.date, today) + '</small>' + moverHtml(trend.from.date, today, trend.change) : '<small>The trend appears as the days go by</small>') +
    '<span class="home-spark">' + (trend ? sparklineHtml(trend.points, { width: 120, height: 28 }) : "") + '</span>' +
    '<button type="button" class="link-btn home-link" data-home-go="assets">Net worth over time →</button></div>';

  var ym = selectedMonth(today);
  // Planned against the household as it is (Current situation), not whichever scenario is selected.
  var r = monthReview(ym, { accountOf: transactionAccount, categoryOf: transactionCategory, today: today, items: opts.items || budgetLineItems(currentScenario()) });
  var saved = r.incomeReceived - r.spent;
  var mp = monthPhrase(ym);
  var monthCard = '<div class="home-card home-month" data-home-card="month"><span class="home-k">' + (mp === "this month" ? "This month" : escapeAttr(r.label)) + '</span>' +
    '<div class="home-io"><div><small>Money in</small><b>' + money(r.incomeReceived) + '</b><em>of ' + money(r.incomePlanned) + ' planned</em></div>' +
    '<div><small>Money out</small><b>' + money(r.spent) + '</b><em>of ' + money(r.plannedSpend) + ' planned</em></div>' +
    // With nothing logged as received, "kept" is just spending with a minus sign — say what's missing instead.
    (r.incomeReceived === 0 && r.income.length
      ? '<div><small>Kept</small><b>—</b><em>log money in to see it</em></div></div>'
      : '<div><small>Kept</small><b class="' + (saved >= 0 ? "up" : "down") + '">' + (saved < 0 ? "−" : "") + money(Math.abs(saved)) + '</b><em>' + r.transactions + ' transaction' + (r.transactions === 1 ? "" : "s") + '</em></div></div>') +
    (r.missingIncome ? '<p class="home-note">' + r.missingIncome + ' income line' + (r.missingIncome === 1 ? " hasn't" : "s haven't") + ' been logged ' + escapeAttr(mp) + '.</p>' : '') +
    '<button type="button" class="link-btn home-link" data-home-go="expenses" data-home-sub="spending">See spending →</button></div>';

  var bills = upcomingBills(opts.items || loggableBudgetLineItems(currentScenario()), state.transactions, today, 14);
  var billsCard = '<div class="home-card home-bills" data-home-card="bills"><span class="home-k">Bills — next 2 weeks</span>' +
    (bills.length ? '<ul class="home-list">' + bills.slice(0, 5).map(function(b){
      var when = b.days < 0 ? "overdue " + Math.abs(b.days) + "d" : b.days === 0 ? "today" : b.days === 1 ? "tomorrow" : shortDate(b.due, today);
      return '<li><span title="' + escapeAttr(b.what) + '">' + escapeAttr(b.what) + '</span><em class="' + (b.days < 0 ? "bad" : b.days <= 3 ? "warn" : "") + '">' + when + '</em><b>' + money(b.amount) + '</b></li>';
    }).join("") + '</ul>' + (bills.length > 5 ? '<small>and ' + (bills.length - 5) + ' more</small>' : '')
    : '<p class="home-note">Nothing expected. Bills appear here once a payment has been logged against their budget line.</p>') + '</div>';

  var todos = opts.todos || homeTodos(today, opts);
  var todoCard = '<div class="home-card home-todo" data-home-card="todo"><span class="home-k">To do</span>' +
    (todos.length ? '<ul class="home-list">' + todos.map(function(t){
      return '<li><button type="button" class="home-todo-btn ' + t.tone + '" data-home-go="' + t.go + '"' + (t.sub ? ' data-home-sub="' + t.sub + '"' : '') + (t.fy != null ? ' data-home-fy="' + t.fy + '"' : '') + '>' + escapeAttr(t.text) + ' <span aria-hidden="true">›</span></button></li>';
    }).join("") + '</ul>' : '<p class="home-note">All done — nothing needs you right now.</p>') + '</div>';

  return (isPeriodToday() ? '' : '<p class="home-period-note">Showing ' + escapeAttr(r.label) + ' — net worth, bills and to-dos are always as of today.</p>') +
    (opts.week === false ? '' : weekCardHtml(today)) +
    (opts.autoPay === false ? '' : autoPayCardHtml(today)) +
    (opts.lowBalance === false ? '' : lowBalanceCardHtml(today)) +
    '<div class="home-grid">' + nwCard + monthCard + billsCard + todoCard + '</div>' + goalsStripHtml(today);
}

// Savings goals (v3.65.0): a strip under the cards, each its progress bar, linking to Accounts.
function goalsStripHtml(today){
  if(!(state.savingsGoals || []).length) return "";
  var ov = goalsOverview(today, scenarioTotals(currentScenario()).netMonthly);
  return '<div class="home-goals" data-home-card="goals"><span class="home-k">Goals</span><div class="home-goals-list">' + ov.goals.slice(0, 4).map(function(g, i){ return goalCardHtml(g, i, { compact: true }); }).join("") + '</div>' +
    '<button type="button" class="link-btn home-link" data-home-go="accounts">All goals →</button></div>';
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
    '<div class="wk-body"><div class="wk-part wk-spent"><b class="home-big">' + money(w.spent) + '</b><span>spent · ' + w.count + ' transaction' + (w.count === 1 ? '' : 's') + '</span>' + vs +
      '<button type="button" class="link-btn home-link" data-sv data-sv-direction="out" data-sv-from="' + w.start + '" data-sv-to="' + w.end + '">See this week in Spending →</button></div>' +
      biggest + bills + '</div>' +
    (foot ? '<div class="wk-foot">' + foot + '</div>' : '') + '</section>';
}
