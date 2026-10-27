import { monthReview, reviewMonth, shiftMonth, monthBounds } from "../calc/monthreview.js";
import { accountBalance } from "../calc/accounts.js";
import { state } from "../state.js";
import { periodSelection, isPeriodToday, selectedMonth } from "../calc/ledger.js";
import { transactionAccount, transactionCategory } from "./expenses.js";
import { fmtCurrency0, fmtCurrency2, localDateStr, fmtDate } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Home → Review (v3.54.0) ----------------
// calc/monthreview.js gathers the month; this lays it out as four numbered parts, each saying
// what's done and what's missing, with a button to the place that fixes it.
var shownMonth = null;
// A month picked in the header's period wins over the default (last month until it's reviewed).
export function reviewMonthShown(){ return shownMonth || periodSelection().month || (isPeriodToday() ? reviewMonth() : selectedMonth()); }
export function setReviewMonth(ym){ shownMonth = ym; }
export function stepReviewMonth(n){ shownMonth = shiftMonth(reviewMonthShown(), n); }

function money(n){ return fmtCurrency0.format(Number(n) || 0); }

// ---------------- The guided review (v3.58.0) ----------------
// The four-part page read as a wall of numbers — everything at once, in boxes, with no sense of
// where to start or when you were done. Now it's one plain question at a time with a progress bar:
// money in, card statements, balances, anything to fix, and the month against the plan last (the
// summary only means something once the first four are answered). A short explanation shows the
// first time, before any review has been marked done.
var STEPS = [
  { key: "income", title: "Did the money you expected arrive?" },
  { key: "cards", title: "Do your card statements match?" },
  { key: "balances", title: "Are your account balances current?" },
  { key: "checks", title: "Anything to fix?" },
  { key: "summary", title: "How did the month go?" }
];
var stepShown = 0;
var stepMonth = null;
var introDismissed = false;
export function reviewStep(){ return stepShown; }
export function setReviewStep(n){ stepShown = Math.max(0, Math.min(STEPS.length - 1, Number(n) || 0)); }
export function dismissReviewIntro(){ introDismissed = true; }
function anyReviewDone(){ return Object.keys(state.monthReviews || {}).some(function(k){ return state.monthReviews[k] && state.monthReviews[k].done; }); }

function stepStatus(key, r, balances){
  if(key === "income") return !r.income.length ? "skip" : r.missingIncome ? "todo" : "ok";
  if(key === "cards") return !r.statements.length ? "skip" : r.statements.some(function(s){ return s.gap == null || Math.abs(s.gap) >= 1; }) ? "todo" : "ok";
  if(key === "balances") return !balances.length ? "skip" : balances.some(function(b){ return b.stale; }) ? "todo" : "ok";
  if(key === "checks") return r.checks.length ? "todo" : "ok";
  return r.done ? "ok" : "todo";
}
// Accounts with a balance, and whether it was updated on or after the month's last day.
function balanceRows(ym){
  var end = monthBounds(ym).end;
  return (state.accounts || []).map(function(a){
    var b = accountBalance(a);
    if(b.balance == null) return null;
    return { name: a.name || "Account", balance: b.balance, owed: b.owed, date: b.date, stale: !b.date || b.date < end };
  }).filter(Boolean);
}

export function monthReviewHtml(ym, today){
  today = today || localDateStr();
  ym = ym || reviewMonthShown();
  if(stepMonth !== ym){ stepMonth = ym; stepShown = 0; }
  var r = monthReview(ym, { accountOf: transactionAccount, categoryOf: transactionCategory, today: today });
  var balances = balanceRows(ym);
  var head = '<div class="mr-head"><button type="button" class="icon-btn" data-mr-step="-1" aria-label="Previous month">‹</button>' +
    '<h2>' + escapeAttr(r.label) + '</h2>' +
    '<button type="button" class="icon-btn" data-mr-step="1" aria-label="Next month"' + (ym >= today.slice(0, 7) ? " disabled" : "") + '>›</button>' +
    (r.done ? '<span class="mr-done">Reviewed ' + escapeAttr(r.done) + '</span>' : '') + '</div>';

  if(!introDismissed && !anyReviewDone()){
    return head + '<div class="mr-intro"><h3>A monthly check-in, about ten minutes</h3>' +
      '<p>Once a month, go through last month in five short steps: the pay and rent that arrived, your card statements, account balances, anything the app thinks is off, and then how the month went against the plan.</p>' +
      '<p>Each step says what\'s missing and takes you to where it\'s fixed. Nothing is required — skip a step whenever it doesn\'t apply. The figures on Home, the budget and your tax estimate are only as good as what\'s logged, and this is the habit that keeps them right.</p>' +
      '<button type="button" class="btn btn-primary" data-mr-intro-ok>Start the review</button></div>';
  }

  var statuses = STEPS.map(function(st){ return stepStatus(st.key, r, balances); });
  var progress = '<ol class="mr-steps" aria-label="Review steps">' + STEPS.map(function(st, i){
    var cls = (i === stepShown ? " is-current" : "") + " is-" + statuses[i];
    return '<li><button type="button" class="mr-step-dot' + cls + '" data-mr-to="' + i + '" aria-current="' + (i === stepShown ? "step" : "false") + '" aria-label="Step ' + (i + 1) + ': ' + escapeAttr(st.title) + (statuses[i] === "ok" ? " (done)" : statuses[i] === "skip" ? " (nothing to do)" : "") + '">' +
      '<span>' + (statuses[i] === "ok" ? "✓" : (i + 1)) + '</span></button></li>';
  }).join("") + '</ol>' +
    '<div class="mr-bar"><div style="width:' + Math.round((stepShown + 1) / STEPS.length * 100) + '%"></div></div>';

  var key = STEPS[stepShown].key, body = "";
  if(key === "income"){
    body = r.income.length ? '<p class="mr-lede">' + (r.missingIncome ? r.missingIncome + " of " + r.income.length + " regular income lines have nothing logged for " + escapeAttr(r.label) + ". Log what arrived — the amount on the payslip or statement." : "Everything regular arrived and is logged.") + '</p><div class="mr-rows">' + r.income.map(function(x){
      var missing = !x.rows.length;
      return '<div class="mr-row' + (missing ? " is-missing" : "") + '"><span>' + escapeAttr(x.label) + '</span><b>' + money(x.received) + '</b><small>of ' + money(x.planned) + '</small>' +
        (missing ? '<button type="button" class="btn btn-sm btn-ghost" data-mr-log="' + escapeAttr(x.key) + '">Log it</button>' : '<span class="mr-tick" aria-label="Logged">✓</span>') + '</div>';
    }).join("") + '</div>' : '<p class="mr-lede">No regular income lines yet — nothing to check here.</p>';
  } else if(key === "cards"){
    body = r.statements.length ? '<p class="mr-lede">Type each statement\'s total. A gap means charges that haven\'t been logged or imported yet.</p><div class="mr-rows">' + r.statements.map(function(st){
      var gap = st.gap == null ? '<small>waiting for the total</small>'
        : Math.abs(st.gap) < 1 ? '<span class="mr-tick" aria-label="Matches">✓</span>'
        : '<small class="' + (st.gap > 0 ? "warn" : "") + '">' + fmtCurrency2.format(Math.abs(st.gap)) + (st.gap > 0 ? ' not logged yet' : ' more logged than billed') + '</small>';
      return '<div class="mr-row mr-statement"><span>' + escapeAttr(st.account) + '<small>' + escapeAttr(fmtDate(st.start)) + ' – ' + escapeAttr(fmtDate(st.end)) + ' · ' + fmtCurrency2.format(st.logged) + ' logged</small></span>' +
        '<label class="mr-stmt-in">Statement $<input type="number" step="0.01" min="0" data-mr-statement="' + escapeAttr(st.account) + '" value="' + (st.statement != null ? st.statement : "") + '" aria-label="' + escapeAttr(st.account) + ' statement total"></label>' + gap + '</div>';
    }).join("") + '</div>' + (r.statements.some(function(s){ return s.gap > 1; }) ? '<button type="button" class="btn btn-sm btn-ghost" data-mr-go="import">Import the statement</button>' : '')
      : '<p class="mr-lede">No credit cards set up — add one on Accounts to reconcile its statement here.</p>';
  } else if(key === "balances"){
    var stale = balances.filter(function(b){ return b.stale; });
    body = balances.length ? '<p class="mr-lede">' + (stale.length ? stale.length + " balance" + (stale.length === 1 ? " was" : "s were") + " last updated before the month ended. Update them from your bank app so net worth is right." : "Every balance has been updated since the month ended.") + '</p><div class="mr-rows">' + balances.map(function(b){
      return '<div class="mr-row' + (b.stale ? " is-missing" : "") + '"><span>' + escapeAttr(b.name) + '<small>' + (b.date ? "updated " + escapeAttr(b.date) : "never updated") + '</small></span><b>' + (b.owed && b.balance > 0 ? "−" : "") + money(Math.abs(b.balance)) + '</b><small></small>' +
        (b.stale ? '<span></span>' : '<span class="mr-tick" aria-label="Current">✓</span>') + '</div>';
    }).join("") + '</div>' + (stale.length ? '<button type="button" class="btn btn-sm btn-ghost" data-mr-go="accounts">Update on Accounts</button>' : '')
      : '<p class="mr-lede">No account has a balance yet — give each one its balance on Accounts and it\'s checked here every month.</p><button type="button" class="btn btn-sm btn-ghost" data-mr-go="accounts">Open Accounts</button>';
  } else if(key === "checks"){
    body = r.checks.length ? '<p class="mr-lede">' + r.checks.length + " thing" + (r.checks.length === 1 ? " looks" : "s look") + ' off in your data:</p><ul class="mr-checks">' + r.checks.slice(0, 6).map(function(c){ return '<li>' + escapeAttr(c.title) + '</li>'; }).join("") + '</ul>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-mr-go="checks">Open Checks</button>' : '<p class="mr-lede">Nothing to fix.</p>';
  } else {
    var saved = r.incomeReceived - r.spent, planSaved = r.incomePlanned - r.plannedSpend;
    var top = r.categories.slice(0, 6).map(function(c){
      var d = c.actual - c.planned;
      return '<div class="mr-row mr-cat"><span>' + escapeAttr(c.category) + '</span><b>' + money(c.actual) + '</b><small>of ' + money(c.planned) + '</small>' +
        '<small class="' + (d > 1 ? "warn" : "ok") + '">' + (Math.abs(d) < 1 ? "on plan" : (d > 0 ? "+" : "−") + money(Math.abs(d))) + '</small></div>';
    }).join("");
    body = '<p class="mr-lede">' + (saved >= planSaved ? "You kept " + money(saved) + ", " + (saved - planSaved >= 1 ? money(saved - planSaved) + " more than planned." : "right on plan.") : "You kept " + money(saved) + " — " + money(planSaved - saved) + " less than the " + money(planSaved) + " planned.") + '</p>' +
      '<div class="mr-summary"><div><span>Money in</span><b>' + money(r.incomeReceived) + '</b><small>planned ' + money(r.incomePlanned) + '</small></div>' +
      '<div><span>Money out</span><b>' + money(r.spent) + '</b><small>planned ' + money(r.plannedSpend) + '</small></div>' +
      '<div><span>Kept</span><b class="' + (saved >= planSaved ? "ok" : "warn") + '">' + money(saved) + '</b><small>planned ' + money(planSaved) + '</small></div></div>' +
      (top ? '<div class="mr-sub">Furthest from plan</div><div class="mr-rows">' + top + '</div>' : '') +
      '<p class="ledger-note" style="margin:6px 0 0">From ' + r.transactions + ' transaction' + (r.transactions === 1 ? '' : 's') + ' logged in the month.' +
        (r.reserveSpent ? ' Another ' + money(r.reserveSpent) + ' went on reserve lines (travel, gifts and the like), judged over their year rather than one month.' : '') + '</p>';
  }
  var last = stepShown === STEPS.length - 1;
  var foot = '<div class="mr-foot">' +
    (stepShown > 0 ? '<button type="button" class="btn btn-ghost" data-mr-to="' + (stepShown - 1) + '">Back</button>' : '<span></span>') +
    (last
      ? '<button type="button" class="btn ' + (r.done ? "btn-ghost" : "btn-primary") + '" data-mr-done="' + escapeAttr(ym) + '">' + (r.done ? "Reviewed ✓ — undo" : "Mark " + escapeAttr(r.label) + " reviewed") + '</button>'
      : '<button type="button" class="btn btn-primary" data-mr-to="' + (stepShown + 1) + '">' + (statuses[stepShown] === "todo" ? "Skip for now" : "Next") + '</button>') + '</div>';
  return head + progress + '<section class="mr-stepcard"><div class="mr-step-k">Step ' + (stepShown + 1) + ' of ' + STEPS.length + '</div><h3>' + STEPS[stepShown].title + '</h3>' + body + '</section>' + foot;
}
export function renderMonthReview(){
  var el = typeof document !== "undefined" && document.getElementById("monthReviewBody");
  if(el) el.innerHTML = monthReviewHtml();
}
