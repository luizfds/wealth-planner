import { state } from "../state.js";
import { nextDueDate, lastTransactionDateFor, daysUntil, selectedMonth, monthPhrase, isPeriodToday } from "../calc/ledger.js";
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

// ---------------- Home (v3.58.0) ----------------
// The first screen answers four things before anything else: what we're worth, how the month is
// going, what's about to be paid, and what needs doing. Scenario comparison (what the Dashboard
// used to open on) is one tab down, under Overview.
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function shortDate(iso){ return Number(iso.slice(8, 10)) + " " + MONTHS[Number(iso.slice(5, 7)) - 1]; }
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

export function homeSummaryHtml(today, opts){
  today = today || localDateStr();
  opts = opts || {};
  var nw = opts.netWorth != null ? opts.netWorth : totalNetWorthValue();
  // v3.103.0: the line ends at today's figure and the change is measured from where the line starts,
  // so the text and the line can't disagree.
  var trend = trendToToday(state.netWorthLog, nw, today, 12);
  var nwCard = '<div class="home-card home-nw"><span class="home-k">Net worth</span><b class="home-big">' + money(nw) + '</b>' +
    (trend ? '<small class="' + (trend.change >= 0 ? "up" : "down") + '">' + signed(trend.change) + ' since ' + shortDate(trend.from.date) + '</small>' : '<small>Record it now and then to see the trend</small>') +
    '<span class="home-spark">' + (trend ? sparklineHtml(trend.points, { width: 120, height: 28 }) : "") + '</span>' +
    '<button type="button" class="link-btn home-link" data-home-go="assets">Net worth over time →</button></div>';

  var ym = selectedMonth(today);
  // Planned against the household as it is (Current situation), not whichever scenario is selected.
  var r = monthReview(ym, { accountOf: transactionAccount, categoryOf: transactionCategory, today: today, items: opts.items || budgetLineItems(currentScenario()) });
  var saved = r.incomeReceived - r.spent;
  var mp = monthPhrase(ym);
  var monthCard = '<div class="home-card home-month"><span class="home-k">' + (mp === "this month" ? "This month" : escapeAttr(r.label)) + '</span>' +
    '<div class="home-io"><div><small>Money in</small><b>' + money(r.incomeReceived) + '</b><em>of ' + money(r.incomePlanned) + ' planned</em></div>' +
    '<div><small>Money out</small><b>' + money(r.spent) + '</b><em>of ' + money(r.plannedSpend) + ' planned</em></div>' +
    // With nothing logged as received, "kept" is just spending with a minus sign — say what's missing instead.
    (r.incomeReceived === 0 && r.income.length
      ? '<div><small>Kept</small><b>—</b><em>log money in to see it</em></div></div>'
      : '<div><small>Kept</small><b class="' + (saved >= 0 ? "up" : "down") + '">' + (saved < 0 ? "−" : "") + money(Math.abs(saved)) + '</b><em>' + r.transactions + ' transaction' + (r.transactions === 1 ? "" : "s") + '</em></div></div>') +
    (r.missingIncome ? '<p class="home-note">' + r.missingIncome + ' income line' + (r.missingIncome === 1 ? " hasn't" : "s haven't") + ' been logged ' + escapeAttr(mp) + '.</p>' : '') +
    '<button type="button" class="link-btn home-link" data-home-go="expenses" data-home-sub="spending">See spending →</button></div>';

  var bills = upcomingBills(opts.items || loggableBudgetLineItems(currentScenario()), state.transactions, today, 14);
  var billsCard = '<div class="home-card home-bills"><span class="home-k">Bills — next 2 weeks</span>' +
    (bills.length ? '<ul class="home-list">' + bills.slice(0, 5).map(function(b){
      var when = b.days < 0 ? "overdue " + Math.abs(b.days) + "d" : b.days === 0 ? "today" : b.days === 1 ? "tomorrow" : shortDate(b.due);
      return '<li><span title="' + escapeAttr(b.what) + '">' + escapeAttr(b.what) + '</span><em class="' + (b.days < 0 ? "bad" : b.days <= 3 ? "warn" : "") + '">' + when + '</em><b>' + money(b.amount) + '</b></li>';
    }).join("") + '</ul>' + (bills.length > 5 ? '<small>and ' + (bills.length - 5) + ' more</small>' : '')
    : '<p class="home-note">Nothing expected. Bills appear here once a payment has been logged against their budget line.</p>') + '</div>';

  var todos = opts.todos || homeTodos(today, opts);
  var todoCard = '<div class="home-card home-todo"><span class="home-k">To do</span>' +
    (todos.length ? '<ul class="home-list">' + todos.map(function(t){
      return '<li><button type="button" class="home-todo-btn ' + t.tone + '" data-home-go="' + t.go + '"' + (t.sub ? ' data-home-sub="' + t.sub + '"' : '') + (t.fy != null ? ' data-home-fy="' + t.fy + '"' : '') + '>' + escapeAttr(t.text) + ' <span aria-hidden="true">›</span></button></li>';
    }).join("") + '</ul>' : '<p class="home-note">All done — nothing needs you right now.</p>') + '</div>';

  return (isPeriodToday() ? '' : '<p class="home-period-note">Showing ' + escapeAttr(r.label) + ' — net worth, bills and to-dos are always as of today.</p>') +
    '<div class="home-grid">' + nwCard + monthCard + billsCard + todoCard + '</div>' + goalsStripHtml(today);
}

// Savings goals (v3.65.0): a strip under the cards, each its progress bar, linking to Accounts.
function goalsStripHtml(today){
  if(!(state.savingsGoals || []).length) return "";
  var ov = goalsOverview(today, scenarioTotals(currentScenario()).netMonthly);
  return '<div class="home-goals"><span class="home-k">Goals</span><div class="home-goals-list">' + ov.goals.slice(0, 4).map(function(g, i){ return goalCardHtml(g, i, { compact: true }); }).join("") + '</div>' +
    '<button type="button" class="link-btn home-link" data-home-go="accounts">All goals →</button></div>';
}
export function renderHomeSummary(){
  var el = typeof document !== "undefined" && document.getElementById("homeSummary");
  if(el) el.innerHTML = homeSummaryHtml();
}
