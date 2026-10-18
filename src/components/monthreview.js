import { monthReview, reviewMonth, shiftMonth } from "../calc/monthreview.js";
import { transactionAccount, transactionCategory } from "./expenses.js";
import { fmtCurrency0, fmtCurrency2, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Dashboard → Review (v3.54.0) ----------------
// calc/monthreview.js gathers the month; this lays it out as four numbered parts, each saying
// what's done and what's missing, with a button to the place that fixes it.
var shownMonth = null;
export function reviewMonthShown(){ return shownMonth || reviewMonth(); }
export function setReviewMonth(ym){ shownMonth = ym; }
export function stepReviewMonth(n){ shownMonth = shiftMonth(reviewMonthShown(), n); }

function money(n){ return fmtCurrency0.format(Number(n) || 0); }
function part(n, title, status, body){
  return '<section class="mr-part"><div class="mr-part-head"><span class="mr-num">' + n + '</span><h3>' + title + '</h3>' +
    '<span class="mr-status ' + status.cls + '">' + escapeAttr(status.text) + '</span></div>' + body + '</section>';
}

export function monthReviewHtml(ym, today){
  today = today || localDateStr();
  ym = ym || reviewMonthShown();
  var r = monthReview(ym, { accountOf: transactionAccount, categoryOf: transactionCategory, today: today });
  var head = '<div class="mr-head"><button type="button" class="icon-btn" data-mr-step="-1" aria-label="Previous month">‹</button>' +
    '<h2>' + escapeAttr(r.label) + '</h2>' +
    '<button type="button" class="icon-btn" data-mr-step="1" aria-label="Next month"' + (ym >= today.slice(0, 7) ? " disabled" : "") + '>›</button>' +
    (r.done ? '<span class="mr-done">Reviewed ' + escapeAttr(r.done) + '</span>' : '') + '</div>';

  var incomeBody = r.income.length ? '<div class="mr-rows">' + r.income.map(function(x){
    var missing = !x.rows.length;
    return '<div class="mr-row' + (missing ? " is-missing" : "") + '"><span>' + escapeAttr(x.label) + '</span><b>' + money(x.received) + '</b><small>of ' + money(x.planned) + '</small>' +
      (missing ? '<button type="button" class="btn btn-sm btn-ghost" data-mr-log="' + escapeAttr(x.key) + '">Log</button>' : '<span class="mr-tick" aria-label="Logged">✓</span>') + '</div>';
  }).join("") + '</div>' : '<p class="ledger-note" style="margin:0">No regular income lines yet.</p>';
  var incStatus = !r.income.length ? { cls: "", text: "—" } : r.missingIncome ? { cls: "warn", text: r.missingIncome + " not logged" } : { cls: "ok", text: "all logged" };

  var stBody = r.statements.length ? '<div class="mr-rows">' + r.statements.map(function(st){
    var gap = st.gap == null ? '<small>type what the statement says</small>'
      : Math.abs(st.gap) < 1 ? '<span class="mr-tick" aria-label="Matches">✓</span>'
      : '<small class="' + (st.gap > 0 ? "warn" : "") + '">' + fmtCurrency2.format(Math.abs(st.gap)) + (st.gap > 0 ? ' not logged yet' : ' more logged than billed') + '</small>';
    return '<div class="mr-row mr-statement"><span>' + escapeAttr(st.account) + '<small>' + escapeAttr(st.start) + ' – ' + escapeAttr(st.end) + ' · ' + fmtCurrency2.format(st.logged) + ' logged</small></span>' +
      '<label class="mr-stmt-in">Statement $<input type="number" step="0.01" min="0" data-mr-statement="' + escapeAttr(st.account) + '" value="' + (st.statement != null ? st.statement : "") + '" aria-label="' + escapeAttr(st.account) + ' statement total"></label>' + gap + '</div>';
  }).join("") + '</div>' + (r.statements.some(function(s){ return s.gap > 1; }) ? '<button type="button" class="btn btn-sm btn-ghost" data-mr-go="import">Import the statement</button>' : '')
    : '<p class="ledger-note" style="margin:0">No credit card accounts — add one under Accounts to reconcile its statement here.</p>';
  var stOpen = r.statements.filter(function(s){ return s.gap == null || Math.abs(s.gap) >= 1; }).length;
  var stStatus = !r.statements.length ? { cls: "", text: "—" } : stOpen ? { cls: "warn", text: stOpen + " to reconcile" } : { cls: "ok", text: "reconciled" };

  var chBody = r.checks.length ? '<ul class="mr-checks">' + r.checks.slice(0, 5).map(function(c){ return '<li>' + escapeAttr(c.title) + '</li>'; }).join("") + '</ul>' +
    '<button type="button" class="btn btn-sm btn-ghost" data-mr-go="checks">Open Checks</button>' : '<p class="ledger-note" style="margin:0">Nothing to fix.</p>';
  var chStatus = r.checks.length ? { cls: "warn", text: r.checks.length + " to fix" } : { cls: "ok", text: "all clear" };

  var saved = r.incomeReceived - r.spent, planSaved = r.incomePlanned - r.plannedSpend;
  var top = r.categories.slice(0, 6).map(function(c){
    var d = c.actual - c.planned;
    return '<div class="mr-row mr-cat"><span>' + escapeAttr(c.category) + '</span><b>' + money(c.actual) + '</b><small>of ' + money(c.planned) + '</small>' +
      '<small class="' + (d > 1 ? "warn" : "ok") + '">' + (Math.abs(d) < 1 ? "on plan" : (d > 0 ? "+" : "−") + money(Math.abs(d))) + '</small></div>';
  }).join("");
  var sumBody = '<div class="mr-summary"><div><span>Received</span><b>' + money(r.incomeReceived) + '</b><small>planned ' + money(r.incomePlanned) + '</small></div>' +
      '<div><span>Spent (logged)</span><b>' + money(r.spent) + '</b><small>planned ' + money(r.plannedSpend) + '</small></div>' +
      '<div><span>Saved</span><b class="' + (saved >= planSaved ? "ok" : "warn") + '">' + money(saved) + '</b><small>planned ' + money(planSaved) + '</small></div></div>' +
    (top ? '<div class="mr-sub">Furthest from plan</div><div class="mr-rows">' + top + '</div>' : '') +
    '<p class="ledger-note" style="margin:6px 0 0">From ' + r.transactions + ' transaction' + (r.transactions === 1 ? '' : 's') + ' logged in the month.' +
      (r.reserveSpent ? ' Another ' + money(r.reserveSpent) + ' went on reserve lines (travel, gifts and the like), which are judged over their year rather than one month.' : '') + '</p>';

  return head + '<div class="mr-parts">' +
    part(1, "Money in", incStatus, incomeBody) +
    part(2, "Card statements", stStatus, stBody) +
    part(3, "Checks", chStatus, chBody) +
    part(4, "The month against the plan", { cls: "", text: "" }, sumBody) +
    '</div><div class="mr-foot"><button type="button" class="btn ' + (r.done ? "btn-ghost" : "btn-primary") + '" data-mr-done="' + escapeAttr(ym) + '">' + (r.done ? "Reviewed ✓ — undo" : "Mark " + escapeAttr(r.label) + " reviewed") + '</button></div>';
}
export function renderMonthReview(){
  var el = typeof document !== "undefined" && document.getElementById("monthReviewBody");
  if(el) el.innerHTML = monthReviewHtml();
}
