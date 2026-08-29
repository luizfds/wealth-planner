import { state, persist, genId } from "../state.js";
import { CLASSES } from "../constants.js";
import { sumField, resolveSharedAmount, appendHistorySnapshot, periodsOf, transactionsInMonth, sumTransactionsByExpense } from "../calc/ledger.js";
import { loanRepaymentMonthly, ipProperties } from "../calc/property.js";
import { fmtCurrency0, fmtCurrency2, fmtPercent1 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { syncUiModeToggle } from "../lib/uimode.js";
import { buildTable, modernPlainRowHtml, historyTrendHtml } from "../lib/ledger-table.js";
import { showToast, showUndoToast } from "../lib/toast.js";

function sharedGroupOrder(){
  return CLASSES.filter(function(cls){
    return state.shared.some(function(item){ return (item.classification || "N/A") === cls; });
  });
}

function computeSharedGroups(){
  return sharedGroupOrder().map(function(cls){
    var indices = [];
    var items = [];
    state.shared.forEach(function(item, idx){
      if((item.classification || "N/A") === cls){ indices.push(idx); items.push(item); }
    });
    return { key: cls, indices: indices, items: items, monthly: sumField(items, "monthly") };
  });
}

export function patchSharedGroupTotals(){
  var groups = computeSharedGroups();
  var summaryEl = document.getElementById("sharedSummaryLine");
  if(summaryEl){
    // In modern mode the composition bar below already shows this same per-classification
    // split, so the text line would just repeat it.
    if(state.uiMode !== "modern" && groups.length > 1){
      var total = groups.reduce(function(s, g){ return s + g.monthly; }, 0);
      var parts = groups.map(function(g){ return g.key + " " + fmtCurrency0.format(g.monthly); }).join(" + ");
      summaryEl.innerHTML = "Adds up: " + parts + " = <b>" + fmtCurrency0.format(total) + " / mo</b> total shared expenses";
      summaryEl.style.display = "";
    } else {
      summaryEl.style.display = "none";
    }
  }
  document.querySelectorAll("#sharedGroups .income-group-total").forEach(function(el, gi){
    if(groups[gi]) el.textContent = fmtCurrency0.format(groups[gi].monthly) + " / mo";
  });
  document.querySelectorAll("#sharedGroups .m-card").forEach(function(card, gi){
    var totalEl = card.querySelector(".m-card-total");
    if(totalEl && groups[gi]) totalEl.innerHTML = fmtCurrency0.format(groups[gi].monthly) + "<span>/mo</span>";
  });
  var compWrap = document.querySelector("[data-shared-comp-bar]");
  if(compWrap){
    var freshComp = sharedCompositionBarHtml(groups);
    if(freshComp) compWrap.outerHTML = freshComp;
  }
}

export function renderSharedGroups(){
  syncUiModeToggle();
  if(state.uiMode === "modern") renderSharedGroupsModern();
  else renderSharedGroupsClassic();
}

function renderSharedGroupsClassic(){
  var container = document.getElementById("sharedGroups");
  if(!container) return;
  var groups = computeSharedGroups();
  patchSharedGroupTotals();
  container.innerHTML = groups.map(function(g, gi){
    return '<div class="income-group"><div class="income-group-head">' +
      '<div class="income-group-head-left"><h4>' + escapeAttr(g.key) + '</h4></div>' +
      '<div class="income-group-total">' + fmtCurrency0.format(g.monthly) + ' / mo</div>' +
      '</div><div class="table-scroll"><table class="ledger-table" id="sharedGroupTable' + gi + '"></table></div>' +
      '<button type="button" class="btn btn-sm btn-ghost group-add-btn" data-add="shared:' + escapeAttr(g.key) + '">+ Add to ' + escapeAttr(g.key) + '</button></div>';
  }).join("");
  groups.forEach(function(g, gi){
    buildTable(document.getElementById("sharedGroupTable" + gi), "shared", g.items, {showClass:true, hideAcctToggle:true, hideClassToggle:true, showDueDate:true, showLog:true}, g.indices);
  });
  injectScenarioOverrideButtons();
}

// Needs/Wants/Savings already carry fixed colors everywhere else in the app (the Dashboard's
// 50/30/20 bar) — reusing them here instead of the Income page's rotating series-color palette
// ties an expense card back to the same visual language a user already knows, and sidesteps the
// problem a rotating palette would have with 8-10 items in one Needs group: too many colors to
// track, and the palette would repeat and misleadingly reuse a color between unrelated items.
function classificationSwatchClass(cls){
  if(cls === "Needs") return "needs";
  if(cls === "Wants") return "wants";
  if(cls === "Savings") return "savings";
  return "na";
}

function sharedCompositionBarHtml(groups){
  var total = groups.reduce(function(s, g){ return s + g.monthly; }, 0);
  if(total <= 0 || groups.length < 2) return "";
  var segs = groups.map(function(g){
    var pct = g.monthly / total;
    return '<div class="rule-seg ' + classificationSwatchClass(g.key) + '" style="width:' + (pct * 100) + '%" title="' + escapeAttr(g.key) + ': ' + fmtCurrency0.format(g.monthly) + '/mo (' + fmtPercent1.format(pct) + ')">' + (pct > 0.1 ? fmtPercent1.format(pct) : "") + '</div>';
  }).join("");
  var legend = groups.map(function(g){
    return '<div class="rule-legend-item"><span class="rule-swatch ' + classificationSwatchClass(g.key) + '"></span>' + escapeAttr(g.key) + ' <b>' + fmtCurrency0.format(g.monthly) + '</b></div>';
  }).join("");
  return '<div data-shared-comp-bar><div class="rule-bar">' + segs + '</div><div class="rule-legend" style="margin-bottom:16px">' + legend + '</div></div>';
}

// Session-only (not persisted) — mirrors modernIncomeRowOpen for the Expenses page's rows.
export var modernSharedRowOpen = {};

function renderSharedGroupsModern(){
  var container = document.getElementById("sharedGroups");
  if(!container) return;
  var groups = computeSharedGroups();
  patchSharedGroupTotals();
  container.innerHTML = sharedCompositionBarHtml(groups) + '<div class="m-people">' + groups.map(function(g){
    var initial = g.key === "N/A" ? "–" : g.key.charAt(0);
    return '<div class="m-card">' +
      '<div class="m-card-head"><span class="m-avatar m-avatar-' + classificationSwatchClass(g.key) + '">' + initial + '</span>' +
      '<div class="m-card-name">' + escapeAttr(g.key) + '</div>' +
      '<div class="m-card-total">' + fmtCurrency0.format(g.monthly) + '<span>/mo</span></div></div>' +
      '<div class="m-rows">' + g.items.map(function(item, i){ return modernPlainRowHtml(item, g.indices[i], "shared", modernSharedRowOpen, {showClass:true, showDueDate:true, showLog:true}); }).join("") + '</div>' +
      '<button type="button" class="m-add-row" data-add="shared:' + escapeAttr(g.key) + '">+ Add expense</button>' +
    '</div>';
  }).join("") + '</div>';
  injectScenarioOverrideButtons();
}

// Only state.shared rows get a "vary by scenario" action — income/home/property rows use the
// same generic rowHtml()/modernPlainRowHtml() but have no scenarioOverrides concept, so this is
// a post-render DOM patch scoped to #sharedGroups rather than a change to those shared
// renderers (which would otherwise need to special-case every other section that reuses them).
function injectScenarioOverrideButtons(){
  document.querySelectorAll('#sharedGroups [data-section="shared"]').forEach(function(rowEl){
    var idx = rowEl.getAttribute("data-index");
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-ghost btn-sm";
    btn.setAttribute("data-vary-scenario", idx);
    var item = state.shared[Number(idx)];
    var hasOverrides = !!(item && item.scenarioOverrides && Object.keys(item.scenarioOverrides).length);
    var varyLabel = hasOverrides ? "Varies by scenario — click to edit" : "Set a different amount for one or more scenarios";
    btn.title = varyLabel;
    btn.setAttribute("aria-label", varyLabel);
    // Always carries visible text, not just the icon — "⇄" alone doesn't read as "differs by
    // scenario" the way ✎/✕ read as edit/delete; those stay icon-only elsewhere since they're
    // an established enough convention not to need it (see PROJECT_KNOWLEDGE.md's UX audit note).
    btn.textContent = hasOverrides ? "⇄ Varies" : "⇄ Vary";
    var actionsHost = rowEl.querySelector(".m-edit-actions") || rowEl.querySelector("td:last-child");
    if(actionsHost) actionsHost.insertBefore(btn, actionsHost.firstChild);
  });
}

// Session-only (not persisted) — which state.shared index (if any) has its per-scenario
// override panel open, mirrors homeBlockCollapsed/modernSharedRowOpen's pattern of session UI
// state living as a plain exported var here, mutated from app.js's event handlers.
export var scenarioOverrideOpenIdx = null;

function scenarioOverridePanelHtml(idx){
  var item = state.shared[idx];
  if(!item) return "";
  var baseLabel = fmtCurrency2.format(item.amount) + " " + item.freq;
  var rows = state.scenarios.map(function(name){
    var isBaseline = name === state.baselineScenario;
    var hasOverride = !!(item.scenarioOverrides && item.scenarioOverrides[name] != null);
    var value = resolveSharedAmount(item, name);
    return '<div class="scen-override-row">' +
      '<span class="scen-override-name">' + escapeAttr(name) +
        (isBaseline ? ' <span class="home-baseline-badge">Current situation</span>' : '') + '</span>' +
      '<input type="number" step="0.01" min="0" class="scen-override-input" data-override-scenario="' + escapeAttr(name) + '" value="' + value + '" aria-label="Amount for ' + escapeAttr(name) + '">' +
      (hasOverride ? '<button type="button" class="btn btn-ghost btn-sm" data-override-reset="' + escapeAttr(name) + '" title="Use the shared amount instead" aria-label="Use the shared amount instead for ' + escapeAttr(name) + '">↺ Reset</button>' : '') +
      '<button type="button" class="btn btn-ghost btn-sm" data-override-use-everywhere="' + escapeAttr(name) + '" title="Set this amount for every scenario, including Current situation">Use everywhere</button>' +
    '</div>';
  }).join("");
  return '<div class="scen-override-backdrop" data-override-backdrop data-override-idx="' + idx + '">' +
    '<div class="scen-override-panel" role="dialog" aria-label="Vary &quot;' + escapeAttr(item.what) + '&quot; by scenario">' +
      '<div class="scen-override-head"><h4>Vary "' + escapeAttr(item.what) + '" by scenario</h4>' +
        '<button type="button" class="icon-btn" data-override-close aria-label="Close">✕</button></div>' +
      '<p class="scen-override-note">Shared amount (used by any scenario without its own value below): <b>' + baseLabel + '</b></p>' +
      '<div class="scen-override-rows">' + rows + '</div>' +
    '</div>' +
  '</div>';
}

export function openScenarioOverridePanel(idx){
  scenarioOverrideOpenIdx = idx;
  renderScenarioOverridePanel();
}
export function closeScenarioOverridePanel(){
  scenarioOverrideOpenIdx = null;
  var root = document.getElementById("scenarioOverrideRoot");
  if(root) root.innerHTML = "";
}
export function renderScenarioOverridePanel(){
  var root = document.getElementById("scenarioOverrideRoot");
  if(!root) return;
  if(scenarioOverrideOpenIdx == null || !state.shared[scenarioOverrideOpenIdx]){
    scenarioOverrideOpenIdx = null;
    root.innerHTML = "";
    return;
  }
  root.innerHTML = scenarioOverridePanelHtml(scenarioOverrideOpenIdx);
}

export function setScenarioOverride(idx, scenarioName, amount){
  var item = state.shared[idx];
  if(!item) return;
  if(!item.scenarioOverrides) item.scenarioOverrides = {};
  item.scenarioOverrides[scenarioName] = amount;
}
export function resetScenarioOverride(idx, scenarioName){
  var item = state.shared[idx];
  if(!item || !item.scenarioOverrides) return;
  delete item.scenarioOverrides[scenarioName];
}
export function copyScenarioAmountToAll(idx, scenarioName){
  var item = state.shared[idx];
  if(!item) return;
  var value = resolveSharedAmount(item, scenarioName);
  item.amount = value;
  item.scenarioOverrides = {};
  showToast('Set "' + item.what + '" to ' + fmtCurrency2.format(value) + ' for every scenario');
}

// Read-only mirror of each IP property's costs onto the Expenses page — same idea as the
// synthetic rent row on the Income tab, but this never touches state.shared, since property
// costs are already counted separately (ipExpenseItemsForClassification/ipExpensesMonthly/
// ipLoansMonthly) in every real total. Adding it as a real row there would double-count it.
function propertyMonthlyCost(p){
  var loanMonthly = (p.loans || []).reduce(function(s, l){ return s + loanRepaymentMonthly(l); }, 0);
  return sumField(p.expenses, "monthly") + loanMonthly;
}
function propertyExpensesModernHtml(ips){
  var rows = ips.map(function(p){
    var monthly = propertyMonthlyCost(p);
    return '<div class="m-row computed"><div class="m-row-summary" style="cursor:default">' +
      '<div style="flex:1 1 auto; min-width:0">' +
        '<div class="m-row-name">' + escapeAttr(p.what) + ' — Property costs</div>' +
        '<div class="m-row-sub">auto: expenses + loan repayment — edit on the Properties tab</div>' +
      '</div>' +
      '<span class="m-row-amt">' + fmtCurrency0.format(monthly) + '/mo</span>' +
    '</div></div>';
  }).join("");
  return '<div class="m-card"><div class="m-rows">' + rows + '</div></div>';
}

export function renderPropertyExpensesSummary(){
  var wrap = document.getElementById("propertyExpensesCard");
  var table = document.getElementById("propertyExpensesTable");
  var modernWrap = document.getElementById("propertyExpensesModern");
  if(!wrap || !table) return;
  var ips = ipProperties();
  wrap.hidden = !ips.length;
  if(!ips.length) return;
  var rows = ips.map(function(p){
    var monthly = propertyMonthlyCost(p);
    return '<tr class="is-computed">' +
      '<td class="what-cell">' + escapeAttr(p.what) + ' — Property costs</td>' +
      '<td class="amount-cell"><span class="computed-value">' + fmtCurrency0.format(monthly) + '</span>' +
        '<span class="computed-note">auto: expenses + loan repayment for ' + escapeAttr(p.what) + ' — edit on the Properties tab</span></td>' +
      '<td class="freq-cell">Monthly</td>' +
      '<td class="num">' + fmtCurrency0.format(monthly) + '</td>' +
      '<td class="num">' + fmtCurrency0.format(monthly * 12) + '</td>' +
      '</tr>';
  }).join("");
  var total = ips.reduce(function(s, p){ return s + propertyMonthlyCost(p); }, 0);
  table.innerHTML = '<thead><tr><th>What</th><th>Amount</th><th>Frequency</th><th class="num">Monthly</th><th class="num">Yearly</th></tr></thead><tbody>' + rows + '</tbody>';
  document.getElementById("propertyExpensesTotal").textContent = fmtCurrency0.format(total);
  var scrollWrap = table.closest(".table-scroll");
  var isModern = state.uiMode === "modern";
  if(scrollWrap) scrollWrap.hidden = isModern;
  if(modernWrap){
    modernWrap.hidden = !isModern;
    if(isModern) modernWrap.innerHTML = propertyExpensesModernHtml(ips);
  }
}

// ---------------- Review expenses: one-at-a-time swipe/confirm flow ----------------
// Session-only (not persisted) — which state.shared indices are queued for review and how far
// through the queue the user has gotten. null when the review flow is closed. A snapshot of
// indices taken at open time (not re-derived live), so deleting/reordering rows elsewhere while
// a review is somehow still open can't shift what "next" points at mid-review.
export var expenseReview = null;

export function openExpenseReview(){
  if(!state.shared.length){
    showToast("No expenses to review yet — add one on this page first.");
    return;
  }
  expenseReview = { queue: state.shared.map(function(_, i){ return i; }), pos: 0, reviewedCount: 0 };
  renderExpenseReviewPanel();
}
export function closeExpenseReview(){
  expenseReview = null;
  var root = document.getElementById("expenseReviewRoot");
  if(root) root.innerHTML = "";
}
// Records the (possibly edited) amount/date for the currently-shown expense and advances the
// queue. Updates item.amount itself (not just a separate "actual" field) — same convention as
// every other Log button in this app, where the logged value and the ongoing planned amount are
// the same field. Caller (app.js) is responsible for the cross-cutting refresh afterward
// (totals, projections, persist) — same split as the scenario-override panel's mutation helpers.
export function logCurrentReviewCard(amount, dateStr){
  if(!expenseReview) return;
  var item = state.shared[expenseReview.queue[expenseReview.pos]];
  if(!item) return;
  item.amount = amount;
  if(!Array.isArray(item.history)) item.history = [];
  appendHistorySnapshot(item.history, amount, dateStr);
  expenseReview.reviewedCount++;
  expenseReview.pos++;
}
export function skipCurrentReviewCard(){
  if(!expenseReview) return;
  expenseReview.pos++;
}
function reviewCardHtml(item){
  var todayStr = new Date().toISOString().slice(0, 10);
  var trend = historyTrendHtml(item);
  return '<div class="review-card-badge ' + classificationSwatchClass(item.classification || "N/A") + '">' + escapeAttr(item.classification || "N/A") + '</div>' +
    '<div class="review-card-name">' + escapeAttr(item.what) + '</div>' +
    '<div class="review-card-freq">Currently ' + fmtCurrency2.format(item.amount) + ' / ' + item.freq + '</div>' +
    trend +
    '<div class="review-card-fields">' +
      '<div class="m-edit-field"><label>Amount</label><input type="number" step="0.01" min="0" class="review-amount" value="' + item.amount + '" aria-label="Amount to log"></div>' +
      '<div class="m-edit-field"><label>Date</label><input type="date" class="review-date" value="' + todayStr + '" aria-label="Date to log under"></div>' +
    '</div>';
}
export function renderExpenseReviewPanel(){
  var root = document.getElementById("expenseReviewRoot");
  if(!root) return;
  if(!expenseReview){ root.innerHTML = ""; return; }
  var total = expenseReview.queue.length;
  if(expenseReview.pos >= total){
    root.innerHTML = '<div class="review-backdrop" data-review-backdrop>' +
      '<div class="review-panel" role="dialog" aria-label="Expense review complete">' +
        '<div class="review-head"><h4>All done!</h4><button type="button" class="icon-btn" data-review-close aria-label="Close">✕</button></div>' +
        '<p class="review-complete-note">Logged ' + expenseReview.reviewedCount + ' of ' + total + ' expense' + (total === 1 ? "" : "s") + '.</p>' +
        '<button type="button" class="btn btn-sm" data-review-close>Close</button>' +
      '</div></div>';
    return;
  }
  var item = state.shared[expenseReview.queue[expenseReview.pos]];
  root.innerHTML = '<div class="review-backdrop" data-review-backdrop>' +
    '<div class="review-panel" role="dialog" aria-label="Review expenses">' +
      '<div class="review-head"><span class="review-progress">' + (expenseReview.pos + 1) + ' of ' + total + '</span><button type="button" class="icon-btn" data-review-close aria-label="Close">✕</button></div>' +
      '<div class="review-card">' + reviewCardHtml(item) + '</div>' +
      '<div class="review-actions">' +
        '<button type="button" class="btn review-skip-btn" data-review-skip>✕ Skip</button>' +
        '<button type="button" class="btn review-log-btn" data-review-log>✓ Log</button>' +
      '</div>' +
      '<p class="review-hint">Swipe the card left to skip, right to log — or use the buttons.</p>' +
    '</div></div>';
}

// ---------------- Transactions: real dated spend, separate from the planned budget ----------------
// Deliberately not built on ledger-table.js's machinery — a transaction has a different shape
// (date/description/amount/link, no freq/period math) and, like debts, is simple enough that a
// small bespoke renderer beats fighting the generic row's amount+frequency assumptions.
function transactionLinkOptionsHtml(selectedId){
  var options = '<option value=""' + (!selectedId ? " selected" : "") + '>— One-off (not linked) —</option>';
  return options + state.shared.map(function(item){
    return '<option value="' + escapeAttr(item.id) + '"' + (item.id === selectedId ? " selected" : "") + '>' + escapeAttr(item.what) + '</option>';
  }).join("");
}
function transactionRowHtml(t, idx){
  var dateInput = '<input type="date" class="tx-date" data-tx-index="' + idx + '" value="' + escapeAttr(t.date || "") + '" aria-label="Date">';
  var whatInput = '<input type="text" class="tx-what" data-tx-index="' + idx + '" value="' + escapeAttr(t.what || "") + '" placeholder="Description" aria-label="Description">';
  var amountInput = '<input type="number" step="0.01" min="0" class="tx-amount" data-tx-index="' + idx + '" value="' + t.amount + '" aria-label="Amount">';
  var linkSelect = '<select class="tx-link" data-tx-index="' + idx + '" aria-label="Linked expense">' + transactionLinkOptionsHtml(t.linkedExpenseId) + '</select>';
  var delBtn = '<button type="button" class="btn btn-ghost btn-sm row-del" data-tx-del="' + idx + '" aria-label="Delete transaction">✕</button>';
  if(state.uiMode === "modern"){
    return '<div class="m-row computed tx-row" data-tx-index="' + idx + '">' +
      '<div class="m-row-summary" style="cursor:default;flex-wrap:wrap;gap:8px">' + dateInput + whatInput + amountInput + delBtn + '</div>' +
      '<div class="tx-link-row">' + linkSelect + '</div>' +
    '</div>';
  }
  return '<tr data-tx-index="' + idx + '">' +
    '<td>' + dateInput + '</td>' +
    '<td class="what-cell">' + whatInput + '</td>' +
    '<td class="amount-cell">' + amountInput + '</td>' +
    '<td>' + linkSelect + '</td>' +
    '<td>' + delBtn + '</td>' +
    '</tr>';
}
export function renderTransactions(){
  var container = document.getElementById("transactionsTable");
  var totalEl = document.getElementById("totalTransactionsAmount");
  if(!container) return;
  var total = state.transactions.reduce(function(s, t){ return s + (Number(t.amount) || 0); }, 0);
  if(totalEl) totalEl.textContent = fmtCurrency0.format(total);
  if(!state.transactions.length){
    container.innerHTML = '<p class="ledger-note" style="margin:0">No transactions logged yet — add one below to start tracking actual spend against your budget, optionally linked to one of the expenses above.</p>';
    return;
  }
  // Newest first for review, but data-tx-index always keeps pointing at the item's real
  // position in state.transactions (not its position in this sorted display).
  var sorted = state.transactions
    .map(function(t, i){ return { t: t, i: i }; })
    .sort(function(a, b){ return (b.t.date || "") < (a.t.date || "") ? -1 : ((b.t.date || "") > (a.t.date || "") ? 1 : 0); });
  var rows = sorted.map(function(x){ return transactionRowHtml(x.t, x.i); }).join("");
  container.innerHTML = state.uiMode === "modern"
    ? '<div class="m-rows">' + rows + '</div>'
    : '<div class="table-scroll"><table class="ledger-table"><thead><tr><th>Date</th><th>Description</th><th class="num">Amount</th><th>Linked to</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}
export function addTransaction(){
  state.transactions.push({ id: genId("t"), date: new Date().toISOString().slice(0, 10), amount: 0, what: "", linkedExpenseId: null });
  renderTransactions();
  renderActualVsPlannedPanel();
  persist();
}
export function deleteTransaction(idx){
  var removed = state.transactions[idx];
  if(!removed) return;
  state.transactions.splice(idx, 1);
  renderTransactions();
  renderActualVsPlannedPanel();
  persist();
  showUndoToast("Deleted transaction", function(){
    state.transactions.splice(Math.min(idx, state.transactions.length), 0, removed);
    renderTransactions();
    renderActualVsPlannedPanel();
    persist();
  });
}

// ---------------- Actual vs. planned: this month's transactions against the budget ----------------
// Reuses the Dashboard's .acct-row layout (name / mid-detail / right-aligned figure) — the shape
// fits, and it keeps this panel visually consistent with the other "reality check" panels rather
// than inventing a new row style for one more three-column list.
export function renderActualVsPlannedPanel(){
  var el = document.getElementById("actualVsPlannedPanel");
  if(!el) return;
  var monthTxns = transactionsInMonth(state.transactions);
  var byExpense = sumTransactionsByExpense(monthTxns);
  if(!state.shared.length && !monthTxns.length){
    el.innerHTML = '<p class="ledger-note" style="margin:0">Add a shared expense and log a transaction against it to see actual vs. planned here.</p>';
    return;
  }
  var plannedTotal = sumField(state.shared, "monthly");
  var actualTotal = monthTxns.reduce(function(s, t){ return s + (Number(t.amount) || 0); }, 0);
  var overallDelta = actualTotal - plannedTotal;
  // Framed from a spending point of view: spending less than planned is "good" (green), more is
  // "bad" (red) — the inverse of the up/down convention used for asset values elsewhere in the
  // app, where "up" is always good. Both read correctly for what they each represent.
  var overallColor = overallDelta > 0.5 ? "var(--bad)" : (overallDelta < -0.5 ? "var(--good)" : "");
  var rows = state.shared.map(function(item){
    var planned = periodsOf(item.amount, item.freq).monthly;
    var actual = byExpense[item.id] || 0;
    var delta = actual - planned;
    var color = delta > 0.5 ? "var(--bad)" : (delta < -0.5 ? "var(--good)" : "");
    return '<div class="acct-row"><span class="acct-name" title="' + escapeAttr(item.what) + '">' + escapeAttr(item.what) + '</span>' +
      '<span style="font-size:11px;color:var(--ink-soft)">' + fmtCurrency0.format(actual) + ' actual / ' + fmtCurrency0.format(planned) + ' planned</span>' +
      '<span class="acct-amt"' + (color ? ' style="color:' + color + '"' : '') + '>' + (delta >= 0 ? "+" : "−") + fmtCurrency0.format(Math.abs(delta)) + '</span></div>';
  }).join("");
  var unlinkedTotal = byExpense.__unlinked || 0;
  var unlinkedRow = unlinkedTotal
    ? '<div class="acct-row"><span class="acct-name" style="font-style:italic">Uncategorized (one-off)</span><span></span><span class="acct-amt">' + fmtCurrency0.format(unlinkedTotal) + '</span></div>'
    : "";
  el.innerHTML =
    '<div class="fire-stat-row"><span>This month — actual vs. planned</span><b' + (overallColor ? ' style="color:' + overallColor + '"' : '') + '>' + fmtCurrency0.format(actualTotal) + ' / ' + fmtCurrency0.format(plannedTotal) + '</b></div>' +
    '<p class="fire-note" style="margin:2px 0 12px">' + (overallDelta >= 0 ? "+" : "−") + fmtCurrency0.format(Math.abs(overallDelta)) + (overallDelta > 0.5 ? " over budget so far this month." : overallDelta < -0.5 ? " under budget so far this month." : " right on budget so far this month.") + '</p>' +
    rows + unlinkedRow;
}
