import { state, persist, genId } from "../state.js";
import { CLASSES, FREQS } from "../constants.js";
import { sumField, resolveSharedAmount, periodsOf, transactionDisplayName, transactionsInMonth, transactionsInYear, sumTransactionsByExpense, currentStatementCycle, transactionsInRange, isOverdue, daysUntil, lastTransactionDateFor } from "../calc/ledger.js";
import { loanRepaymentMonthly, ipProperties } from "../calc/property.js";
import { fmtCurrency0, fmtCurrency2, fmtPercent1, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { modernPlainRowHtml, modernRowSummaryHtml, modernRowEditHtml, modernRowShellHtml } from "../lib/ledger-table.js";
import { showToast, showUndoToast } from "../lib/toast.js";
import { parseCsv } from "../lib/backup.js";

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


// ---------------- Import expenses from a spreadsheet ----------------
// Mirrors exportExpensesCsv()'s own column headers (lib/backup.js) rather than trying to auto-map
// an arbitrary spreadsheet's layout — there's no backend/LLM here to guess a mapping reliably, so
// the dependable path is "download our template (or a past export), fill it in, import it back".
// Matching is case/order-insensitive on header names so a reordered or re-cased copy still works.
var EXPENSES_IMPORT_HEADERS = ["what", "classification", "amount", "frequency", "account"];
function matchExpensesImportHeader(headerRow){
  var colOf = {};
  headerRow.forEach(function(h, i){
    var key = (h || "").trim().toLowerCase();
    if(EXPENSES_IMPORT_HEADERS.indexOf(key) !== -1 && colOf[key] === undefined) colOf[key] = i;
  });
  return colOf;
}
// Pure parse+validate — doesn't touch state. The caller renders this as a preview and only calls
// commitExpensesImport() once the user confirms (see app.js's expenseImportFile/Confirm wiring).
// What/Amount are required to make sense of a row at all; Classification/Frequency fall back to
// the same default "+Add expense" uses rather than rejecting the row, so a spreadsheet that left
// them blank still imports cleanly. headerOk is false when the file doesn't even have recognizable
// What/Amount columns — a different failure mode than "every row had a problem", worth its own
// message in the preview.
export function parseExpensesImportCsv(text){
  var rows = parseCsv(text);
  if(!rows.length) return { valid: [], errors: [], headerOk: false };
  var colOf = matchExpensesImportHeader(rows[0]);
  if(colOf.what === undefined || colOf.amount === undefined) return { valid: [], errors: [], headerOk: false };
  var valid = [], errors = [];
  rows.slice(1).forEach(function(cells, i){
    var rowNum = i + 2; // header row + 1-based display
    var what = (cells[colOf.what] || "").trim();
    var amountRaw = (cells[colOf.amount] || "").trim();
    if(!what && !amountRaw && cells.every(function(c){ return !c || !c.trim(); })) return; // fully blank row
    if(!what){ errors.push({ row: rowNum, reason: 'Missing "What"' }); return; }
    var amount = parseFloat(amountRaw.replace(/[^0-9.\-]/g, ""));
    if(!amountRaw || isNaN(amount)){ errors.push({ row: rowNum, reason: 'Amount "' + amountRaw + '" isn\'t a number' }); return; }
    var classRaw = colOf.classification !== undefined ? (cells[colOf.classification] || "").trim() : "";
    var classMatch = CLASSES.find(function(c){ return c.toLowerCase() === classRaw.toLowerCase(); });
    var freqRaw = colOf.frequency !== undefined ? (cells[colOf.frequency] || "").trim() : "";
    var freqMatch = FREQS.find(function(f){ return f.toLowerCase() === freqRaw.toLowerCase(); });
    var account = colOf.account !== undefined ? (cells[colOf.account] || "").trim() : "";
    valid.push({ what: what, classification: classMatch || "Needs", amount: amount, freq: freqMatch || "Monthly", account: account });
  });
  return { valid: valid, errors: errors, headerOk: true };
}
// Renders the parsed result into the inline preview panel (below the shared-expenses ledger note)
// and returns the pending valid rows for app.js to hold onto — nothing is added to state until
// the user clicks the confirm button this renders, per commitExpensesImport() below.
export function renderExpensesImportPreview(parsed){
  var container = document.getElementById("expenseImportPreview");
  if(!container) return parsed.valid;
  container.hidden = false;
  if(!parsed.headerOk){
    container.innerHTML = '<p class="ledger-note" style="margin:0;color:var(--brass-strong)">Couldn\'t find "What" and "Amount" columns in that file — download the import template below, or check your header row matches it.</p>' +
      '<div style="margin-top:10px"><button type="button" class="btn btn-sm btn-ghost" id="expenseImportCancelBtn">Dismiss</button></div>';
    return parsed.valid;
  }
  if(!parsed.valid.length && !parsed.errors.length){
    container.innerHTML = '<p class="ledger-note" style="margin:0">No rows found in that file.</p>' +
      '<div style="margin-top:10px"><button type="button" class="btn btn-sm btn-ghost" id="expenseImportCancelBtn">Dismiss</button></div>';
    return parsed.valid;
  }
  var summary = parsed.valid.length + " row" + (parsed.valid.length === 1 ? "" : "s") + " ready to import" +
    (parsed.errors.length ? ", " + parsed.errors.length + " skipped" : "");
  var errorsHtml = parsed.errors.length
    ? '<ul style="margin:6px 0 0;padding-left:18px;font-size:12px;color:var(--ink-soft)">' +
        parsed.errors.slice(0, 10).map(function(e){ return "<li>Row " + e.row + ": " + escapeAttr(e.reason) + "</li>"; }).join("") +
        (parsed.errors.length > 10 ? "<li>and " + (parsed.errors.length - 10) + " more</li>" : "") +
      "</ul>"
    : "";
  var previewRows = parsed.valid.slice(0, 8).map(function(item){
    return "<tr><td>" + escapeAttr(item.what) + "</td><td>" + escapeAttr(item.classification) + '</td><td class="num">' + fmtCurrency2.format(item.amount) + "</td><td>" + escapeAttr(item.freq) + "</td><td>" + escapeAttr(item.account) + "</td></tr>";
  }).join("");
  var moreNote = parsed.valid.length > 8 ? '<p class="ledger-note" style="margin:6px 0 0">and ' + (parsed.valid.length - 8) + " more…</p>" : "";
  container.innerHTML =
    '<p class="ledger-note" style="margin:0"><b>' + summary + "</b></p>" +
    errorsHtml +
    (parsed.valid.length ? '<div class="table-scroll" style="margin-top:8px"><table class="import-preview-table"><thead><tr><th>What</th><th>Classification</th><th class="num">Amount</th><th>Frequency</th><th>Account</th></tr></thead><tbody>' + previewRows + "</tbody></table></div>" + moreNote : "") +
    '<div style="margin-top:10px;display:flex;gap:8px">' +
      (parsed.valid.length ? '<button type="button" class="btn btn-sm" id="expenseImportConfirmBtn">Import ' + parsed.valid.length + " expense" + (parsed.valid.length === 1 ? "" : "s") + "</button>" : "") +
      '<button type="button" class="btn btn-sm btn-ghost" id="expenseImportCancelBtn">Cancel</button>' +
    "</div>";
  return parsed.valid;
}
export function clearExpensesImportPreview(){
  var container = document.getElementById("expenseImportPreview");
  if(container){ container.hidden = true; container.innerHTML = ""; }
}
// Same minimal shape "+Add expense" pushes onto state.shared today — no id, no factory, so this
// stays a plain mutation the caller wraps with its own render/persist/undo (see app.js).
export function commitExpensesImport(items){
  items.forEach(function(item){
    state.shared.push({ what: item.what, classification: item.classification, account: item.account, amount: item.amount, freq: item.freq });
  });
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

export function renderSharedGroups(){
  // The overdue count depends on the budget lines and on what's been logged against them, so it's
  // refreshed from both of the renders that follow a change to either (see also
  // renderActualVsPlannedPanel) rather than from every call site that mutates them.
  renderExpenseReviewButton();
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
      '<div class="m-rows">' + g.items.map(function(item, i){ return modernPlainRowHtml(item, g.indices[i], "shared", modernSharedRowOpen, {showClass:true, showDone:true}); }).join("") + '</div>' +
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
  var modernWrap = document.getElementById("propertyExpensesModern");
  if(!wrap || !modernWrap) return;
  var ips = ipProperties();
  wrap.hidden = !ips.length;
  if(!ips.length) return;
  var total = ips.reduce(function(s, p){ return s + propertyMonthlyCost(p); }, 0);
  document.getElementById("propertyExpensesTotal").textContent = fmtCurrency0.format(total);
  modernWrap.innerHTML = propertyExpensesModernHtml(ips);
}

// ---------------- Review expenses: one-at-a-time swipe/confirm flow ----------------
// Session-only (not persisted) — which state.shared indices are queued for review and how far
// through the queue the user has gotten. null when the review flow is closed. A snapshot of
// indices taken at open time (not re-derived live), so deleting/reordering rows elsewhere while
// a review is somehow still open can't shift what "next" points at mid-review.
export var expenseReview = null;

// A shared expense's amount/freq is purely the planned budget — logging against it (below,
// and the row's own Log button) records a transaction instead, so "when was this last paid" now
// lives on state.transactions[], not a field on the budget line itself. lastTransactionDateFor()
// reads that back out.
//
// "Needs review" means overdue against its own frequency — no transaction ever recorded at all,
// or a full period has elapsed since the most recent one (isOverdue(), not nextDueDate(): that
// always projects forward to the next occurrence on/after today, so it can never itself land in
// the past — useless for "is this actually overdue"). An expense with a recent-enough transaction
// has nothing to review, so it's left out rather than re-shown every time.
function isDueForReview(item){
  if(item.irregular) return false;
  var lastDate = lastTransactionDateFor(state.transactions, item.id);
  if(!lastDate) return true;
  return isOverdue(lastDate, item.freq);
}
// Explains *why* a card is in the review queue — distinct from ledger-table.js's
// dueDateNoteHtml(), which projects the next upcoming date and would misleadingly read as
// "due in Xd" for an item that's actually already overdue (nextDueDate always rolls forward
// past today, see isDueForReview() above).
function reviewDueNoteHtml(item){
  var lastDate = lastTransactionDateFor(state.transactions, item.id);
  if(!lastDate) return '<span class="due-note due-unset">No transaction logged yet</span>';
  var daysAgo = -daysUntil(lastDate);
  return '<span class="due-note due-overdue">Last transaction ' + escapeAttr(lastDate) + ' (' + daysAgo + 'd ago) — overdue for a new ' + escapeAttr(item.freq) + ' entry</span>';
}
// The Spending tab's "Catch up" button only earns its place when there's actually something to
// catch up on, so it's hidden at zero and carries the count otherwise — a standing, honest
// answer to "am I behind on logging?" instead of a button that has to be pressed to find out
// (which is what the old always-visible "Review expenses" was).
export function renderExpenseReviewButton(){
  var btn = document.getElementById("reviewExpensesBtn");
  if(!btn) return;
  var dueCount = state.shared.reduce(function(n, item){ return n + (isDueForReview(item) ? 1 : 0); }, 0);
  btn.hidden = dueCount === 0;
  btn.textContent = "Catch up on " + dueCount + " overdue";
}
export function openExpenseReview(){
  if(!state.shared.length){
    showToast("No expenses to review yet — add one on this page first.");
    return;
  }
  var due = [];
  state.shared.forEach(function(item, i){ if(isDueForReview(item)) due.push(i); });
  if(!due.length){
    showToast("Nothing due for review — every expense has been logged recently enough.");
    return;
  }
  expenseReview = { queue: due, pos: 0, reviewedCount: 0 };
  renderExpenseReviewPanel();
}
export function closeExpenseReview(){
  expenseReview = null;
  var root = document.getElementById("expenseReviewRoot");
  if(root) root.innerHTML = "";
}
// Records the (possibly edited) amount/date for the currently-shown expense as a transaction and
// advances the queue. Deliberately does NOT touch item.amount — the planned budget stays exactly
// as planned regardless of what was actually spent this time; edit the row's own Amount field
// directly (always available, independent of this flow) if the plan itself needs to change.
// Caller (app.js) is responsible for the cross-cutting refresh afterward (totals, projections,
// persist) — same split as the scenario-override panel's mutation helpers.
export function logCurrentReviewCard(amount, dateStr){
  if(!expenseReview) return;
  var item = state.shared[expenseReview.queue[expenseReview.pos]];
  if(!item) return;
  logExpenseTransaction(item, amount, dateStr);
  expenseReview.reviewedCount++;
  expenseReview.pos++;
}
export function skipCurrentReviewCard(){
  if(!expenseReview) return;
  expenseReview.pos++;
}
function reviewCardHtml(item){
  var todayStr = localDateStr();
  return '<div class="review-card-badge ' + classificationSwatchClass(item.classification || "N/A") + '">' + escapeAttr(item.classification || "N/A") + '</div>' +
    '<div class="review-card-name">' + escapeAttr(item.what) + '</div>' +
    '<div class="review-card-freq">Budgeted ' + fmtCurrency2.format(item.amount) + ' / ' + item.freq + '</div>' +
    reviewDueNoteHtml(item) +
    '<div class="review-card-fields">' +
      '<div class="m-edit-field"><label>Amount spent</label><input type="number" step="0.01" min="0" class="review-amount" value="' + item.amount + '" aria-label="Amount actually spent"></div>' +
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

// ---------------- Quick log: the one-tap "I just spent money" sheet ----------------
// The everyday path into state.transactions[], and the reason the budget lines above are worth
// keeping current: logging spend has to be faster than not logging it, or the actual-vs-planned
// picture quietly stops being true. So this is deliberately not the transaction row's full form
// (link / description / amount / date / account, five fields, all optional-looking) — it's
// amount, then which budget line, then Log. Everything else is either inferred (account comes
// from the budget line, date defaults to today) or genuinely optional and tucked away.
//
// Session-only, like every other overlay's state here: which line is picked and whether the date
// row has been expanded. The amount and note are read straight off the DOM at submit time rather
// than mirrored into here on every keystroke — re-rendering the sheet mid-typing would blow away
// focus and the caret position in the field the user is actually using.
export var quickLog = null;
// How many budget-line chips to show before "More…" — enough to cover the handful of lines a
// household actually logs against week to week (which is what the recency ordering surfaces),
// without turning the sheet into a scrolling list of every budget line.
var QUICK_LOG_CHIP_COUNT = 8;

// Budget lines ordered by how recently something was logged against them, most recent first,
// then everything never logged against in their existing order. Recency (rather than
// alphabetical or biggest-budget-first) is what puts groceries and petrol under the thumb, since
// the lines you log most often are by definition the ones you logged most recently.
export function quickLogChipOrder(){
  var lastByExpense = {};
  (state.transactions || []).forEach(function(t){
    if(!t.linkedExpenseId) return;
    var d = t.date || "";
    if(!lastByExpense[t.linkedExpenseId] || d > lastByExpense[t.linkedExpenseId]) lastByExpense[t.linkedExpenseId] = d;
  });
  return state.shared
    .map(function(item, i){ return { item: item, i: i, last: lastByExpense[item.id] || "" }; })
    .sort(function(a, b){
      if(a.last !== b.last) return a.last > b.last ? -1 : 1;
      return a.i - b.i;
    })
    .map(function(x){ return x.item; });
}
export function openQuickLog(){
  quickLog = { linkedId: null, dateOpen: false, showAllChips: false };
  renderQuickLogSheet();
}
export function closeQuickLog(){
  quickLog = null;
  var root = document.getElementById("quickLogRoot");
  if(root) root.innerHTML = "";
}
// Picking a chip only ever changes which line is selected — the sheet is patched in place
// (see app.js) rather than re-rendered, so an amount already typed survives changing your mind
// about what it was for.
export function setQuickLogLink(id){
  if(!quickLog) return;
  quickLog.linkedId = id || null;
}
export function setQuickLogShowAllChips(value){
  if(!quickLog) return;
  quickLog.showAllChips = !!value;
  renderQuickLogSheet();
}
export function setQuickLogDateOpen(value){
  if(!quickLog) return;
  quickLog.dateOpen = !!value;
  renderQuickLogSheet();
}
// The reassurance line under the chips: what this line is budgeted at and how much of that has
// already gone this month. It's the whole reason to pick a line before logging rather than
// after — you find out you're at $120 of $200 *while* deciding, not on a report later.
export function quickLogContextText(item){
  if(!item) return "One-off spend — not counted against any budget line.";
  var spent = monthTransactionsForExpense(item.id).reduce(function(sum, pair){ return sum + (Number(pair.t.amount) || 0); }, 0);
  var planned = resolveSharedAmount(item, state.activeScenario);
  var monthlyPlanned = periodsOf(planned, item.freq).monthly;
  return fmtCurrency0.format(spent) + " of " + fmtCurrency0.format(monthlyPlanned) + " logged this month";
}
// Records the sheet's contents as a transaction. Mirrors logExpenseTransaction()'s contract —
// the planned budget line is never touched, and the description stays empty unless the user
// actually typed one (see transactionDisplayName). Returns the transaction so the caller can
// name it in a confirmation toast.
export function submitQuickLog(amount, note, dateStr){
  if(!quickLog) return null;
  var item = quickLog.linkedId && state.shared.find(function(i){ return i.id === quickLog.linkedId; });
  var t = {
    id: genId("t"),
    date: dateStr || localDateStr(),
    amount: Number(amount) || 0,
    what: (note || "").trim(),
    linkedExpenseId: item ? item.id : null,
    account: item && item.account ? item.account : ""
  };
  state.transactions.push(t);
  return t;
}
function quickLogChipsHtml(){
  var ordered = quickLogChipOrder();
  var hasMore = ordered.length > QUICK_LOG_CHIP_COUNT;
  var shown = (quickLog.showAllChips || !hasMore) ? ordered : ordered.slice(0, QUICK_LOG_CHIP_COUNT);
  var chips = shown.map(function(item){
    var selected = quickLog.linkedId === item.id;
    return '<button type="button" class="qlog-chip' + (selected ? " is-selected" : "") + '" data-qlog-chip="' + escapeAttr(item.id) + '"' +
      ' aria-pressed="' + (selected ? "true" : "false") + '">' + escapeAttr(item.what) + '</button>';
  }).join("");
  // "One-off" sits last, not first: it's the fallback for spend with no budget line, and putting
  // it under the thumb ahead of the real lines would make the easy path the one that doesn't
  // actually feed actual-vs-planned.
  var oneOffSelected = !quickLog.linkedId;
  chips += '<button type="button" class="qlog-chip qlog-chip-oneoff' + (oneOffSelected ? " is-selected" : "") + '" data-qlog-chip=""' +
    ' aria-pressed="' + (oneOffSelected ? "true" : "false") + '">One-off</button>';
  if(hasMore && !quickLog.showAllChips){
    chips += '<button type="button" class="qlog-chip qlog-chip-more" data-qlog-more>More…</button>';
  }
  return '<div class="qlog-chips">' + chips + '</div>';
}
function quickLogDateRowHtml(){
  var today = localDateStr();
  if(quickLog.dateOpen){
    return '<div class="qlog-date-row"><label class="qlog-date-label" for="quickLogDate">Date</label>' +
      '<input type="date" id="quickLogDate" class="qlog-date" value="' + escapeAttr(today) + '" aria-label="Date to log this under"></div>';
  }
  // Collapsed by default and showing what it will use, so the overwhelmingly common case (I spent
  // this today) needs no interaction at all, while backdating is still one tap away.
  return '<div class="qlog-date-row"><button type="button" class="qlog-date-toggle" data-qlog-date-open>' +
    'Today · ' + escapeAttr(today) + ' <span class="qlog-date-change">Change</span></button></div>';
}
export function renderQuickLogSheet(){
  var root = document.getElementById("quickLogRoot");
  if(!root) return;
  if(!quickLog){ root.innerHTML = ""; return; }
  if(!state.shared.length){
    // Nothing to log against yet — the sheet would be all "One-off", which teaches the wrong
    // model of what this page is for. Point at the budget instead.
    root.innerHTML = '<div class="review-backdrop" data-qlog-backdrop>' +
      '<div class="review-panel qlog-panel" role="dialog" aria-label="Log spend">' +
        '<div class="review-head"><h4>Log spend</h4><button type="button" class="icon-btn" data-qlog-close aria-label="Close">✕</button></div>' +
        '<p class="qlog-empty">Add a budget line above first — then logging what you actually spend against it is a couple of taps.</p>' +
        '<button type="button" class="btn btn-sm" data-qlog-close>Close</button>' +
      '</div></div>';
    return;
  }
  var item = quickLog.linkedId && state.shared.find(function(i){ return i.id === quickLog.linkedId; });
  root.innerHTML = '<div class="review-backdrop" data-qlog-backdrop>' +
    '<div class="review-panel qlog-panel" role="dialog" aria-label="Log spend">' +
      '<div class="review-head"><h4>Log spend</h4><button type="button" class="icon-btn" data-qlog-close aria-label="Close">✕</button></div>' +
      '<div class="qlog-amount-row">' +
        '<span class="qlog-currency" aria-hidden="true">$</span>' +
        '<input type="number" step="0.01" min="0" inputmode="decimal" id="quickLogAmount" class="qlog-amount" placeholder="0.00" aria-label="Amount spent">' +
      '</div>' +
      '<div class="qlog-section-label">What was it for?</div>' +
      quickLogChipsHtml() +
      '<p class="qlog-context">' + escapeAttr(quickLogContextText(item)) + '</p>' +
      '<input type="text" id="quickLogNote" class="qlog-note" placeholder="' + escapeAttr(item ? "Note (optional)" : "What was it? (optional)") + '" aria-label="Note (optional)">' +
      quickLogDateRowHtml() +
      '<button type="button" class="btn review-log-btn qlog-submit" data-qlog-submit>Log spend</button>' +
    '</div></div>';
  var amountInput = document.getElementById("quickLogAmount");
  // Focus lands on the amount every time the sheet re-renders (a chip page change, expanding the
  // date row) — the amount is always the next thing to type, and re-rendering would otherwise
  // silently drop focus to the body. Preserved across those re-renders by the caller reading the
  // old value back in (see app.js's quick-log click handler).
  if(amountInput) amountInput.focus();
}

// ---------------- Transactions: real dated spend, separate from the planned budget ----------------
// Deliberately not built on ledger-table.js's machinery — a transaction has a different shape
// (date/description/amount/link, no freq/period math) and, like debts, is simple enough that a
// small bespoke renderer beats fighting the generic row's amount+frequency assumptions.
// Session-only (not persisted) — collapsed to the most recent TRANSACTIONS_RECENT_COUNT by
// default so a real transaction history doesn't turn the Expenses page into a mile-long scroll;
// "Show all" flips this for the rest of the session, same lifetime as the shares filter/sort.
export var transactionsShowAll = false;
export function setTransactionsShowAll(value){
  transactionsShowAll = value;
  renderTransactions();
}
var TRANSACTIONS_RECENT_COUNT = 10;
// Modern-mode open/closed state per row, same lifetime/shape as modernSharedRowOpen etc. — keyed
// "tx:<idx>" (idx is the transaction's real state.transactions[] position, stable across a
// resort) so an in-progress edit stays open across the rebuild a date edit triggers.
export var modernTransactionRowOpen = {};
function transactionLinkOptionsHtml(selectedId){
  var options = '<option value=""' + (!selectedId ? " selected" : "") + '>— One-off (not linked) —</option>';
  return options + state.shared.map(function(item){
    return '<option value="' + escapeAttr(item.id) + '"' + (item.id === selectedId ? " selected" : "") + '>' + escapeAttr(item.what) + '</option>';
  }).join("");
}
function transactionAccountOptionsHtml(selected){
  var options = '<option value=""' + (!selected ? " selected" : "") + '>— No account —</option>';
  return options + state.accounts.map(function(a){
    return '<option value="' + escapeAttr(a.name) + '"' + (a.name === selected ? " selected" : "") + '>' + escapeAttr(a.name) + (a.type === "credit" ? " (credit)" : "") + '</option>';
  }).join("");
}
// What the Review-expenses flow's logCurrentReviewCard() delegates to (the quick-log sheet builds
// its own transaction inline, since it also has to handle the unlinked One-off case).
// Deliberately leaves item.amount/freq untouched: the planned budget doesn't move just because
// this instance's actual spend differs from it.
export function logExpenseTransaction(item, amount, dateStr){
  // what stays empty on purpose: a linked transaction already shows its budget line's name
  // through transactionDisplayName(), so copying it in would just be a stale duplicate the
  // moment the budget line is renamed. The description field is there for the times the extra
  // detail actually matters ("Miscellaneous" → "new kettle"), not as a required label.
  var t = {
    id: genId("t"),
    date: dateStr || localDateStr(),
    amount: Number(amount) || 0,
    what: "",
    linkedExpenseId: item.id,
    account: item.account || ""
  };
  state.transactions.push(t);
  return t;
}
// A transaction's own account wins if set; otherwise falls back to its linked expense's account
// (e.g. a transaction linked to "Netflix" inherits Netflix's account without the user having to
// set it twice) — mirrors resolveSharedAmount()'s override-then-fallback shape.
export function transactionAccount(t){
  var direct = (t.account || "").trim();
  if(direct) return direct;
  if(t.linkedExpenseId){
    var item = state.shared.find(function(i){ return i.id === t.linkedExpenseId; });
    if(item && item.account) return item.account;
  }
  return "";
}
// Summary sub-line for a collapsed row — date, what it's linked to (or "One-off"), and its
// resolved account, so the closed row already answers "what is this" without expanding it.
// Exported so app.js's live-input handlers can re-derive it to patch an open row's header text
// (see the tx-what/tx-link/tx-account cases) instead of waiting for a full renderTransactions().
export function transactionSummaryText(t){
  var linked = t.linkedExpenseId && state.shared.find(function(i){ return i.id === t.linkedExpenseId; });
  var acct = transactionAccount(t);
  var bits = [t.date || "—", linked ? linked.what : "One-off"];
  if(acct) bits.push(acct);
  return bits.map(escapeAttr).join(" · ");
}
// The Description placeholder doubles as the "you don't have to fill this in" hint: for a linked
// transaction it shows the name it will be listed under if left blank, so the field reads as a
// refinement of an already-complete entry rather than a blank required box.
function transactionDescriptionPlaceholder(t){
  var linked = t.linkedExpenseId && state.shared.find(function(i){ return i.id === t.linkedExpenseId; });
  return linked && linked.what ? linked.what : "Optional note";
}
function transactionRowHtml(t, idx){
  var dateInput = '<input type="date" class="tx-date" data-tx-index="' + idx + '" value="' + escapeAttr(t.date || "") + '" aria-label="Date">';
  var whatInput = '<input type="text" class="tx-what" data-tx-index="' + idx + '" value="' + escapeAttr(t.what || "") + '" placeholder="' + escapeAttr(transactionDescriptionPlaceholder(t)) + '" aria-label="Description (optional)" title="Optional — only worth filling in when the budget line\'s own name doesn\'t say enough (e.g. what the Miscellaneous spend actually was)">';
  var amountInput = '<input type="number" step="0.01" min="0" class="tx-amount" data-tx-index="' + idx + '" value="' + t.amount + '" aria-label="Amount">';
  var linkSelect = '<select class="tx-link" data-tx-index="' + idx + '" aria-label="Linked expense" title="Pick a budget line to log this transaction against — fills in its description and amount for you, or leave it as One-off for spend that has no matching budget line">' + transactionLinkOptionsHtml(t.linkedExpenseId) + '</select>';
  var acctSelect = '<select class="tx-account" data-tx-index="' + idx + '" aria-label="Account">' + transactionAccountOptionsHtml(t.account || "") + '</select>';
  var summary = modernRowSummaryHtml({
    name: transactionDisplayName(t, state.shared),
    subLines: [transactionSummaryText(t)],
    amountHtml: fmtCurrency2.format(Number(t.amount) || 0)
  });
  // "Linked to" leads (not Description) and autoFocus (see openNewRowModal) lands there for a
  // freshly-added transaction — picking a budget line first, before typing anything, mirrors the
  // quick-log sheet's chips and keeps this form from opening on a blank Description with no
  // obvious way to connect the transaction to a budget line at all. This is the deliberate
  // long-form path ("Add with full details"); the sheet is the everyday one.
  var fieldsHtml =
    '<div class="m-edit-field span3"><label>Linked to</label>' + linkSelect + '</div>' +
    '<div class="m-edit-field span3"><label>Description <span class="label-optional">(optional)</span></label>' + whatInput + '</div>' +
    '<div class="m-edit-field"><label>Amount</label>' + amountInput + '</div>' +
    '<div class="m-edit-field"><label>Date</label>' + dateInput + '</div>' +
    '<div class="m-edit-field"><label>Account</label>' + acctSelect + '</div>';
  // See modernPlainRowHtml's identical doneButtonHtml for why: every field here already
  // auto-saves as you type, but a transaction reads as a deliberate, dated action, not a setting
  // you tweak, so it gets an explicit confirm button the generic rows don't. data-row-toggle
  // re-uses wireModernRowToggle's existing "tap anything so-marked closes an open row" handling.
  var actionsHtml =
    '<button type="button" class="btn btn-primary btn-sm" data-row-toggle>Done</button>' +
    '<button type="button" class="btn btn-ghost btn-sm row-del" data-tx-del="' + idx + '">Delete</button>';
  var edit = modernRowEditHtml(fieldsHtml, actionsHtml);
  return modernRowShellHtml("tx", idx, modernTransactionRowOpen, summary, edit, { extraClass: "tx-row" });
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
  var hasMore = sorted.length > TRANSACTIONS_RECENT_COUNT;
  var visible = (transactionsShowAll || !hasMore) ? sorted : sorted.slice(0, TRANSACTIONS_RECENT_COUNT);
  var rows = visible.map(function(x){ return transactionRowHtml(x.t, x.i); }).join("");
  var toggleHtml = hasMore
    ? '<div class="ledger-footer"><button type="button" class="btn btn-sm btn-ghost" data-tx-show-all-toggle="' + (transactionsShowAll ? "0" : "1") + '">' +
        (transactionsShowAll ? "Show recent only" : "Show all " + sorted.length + " transactions") +
      '</button></div>'
    : "";
  container.innerHTML = '<div class="m-rows">' + rows + '</div>' + toggleHtml;
}
export function addTransaction(){
  state.transactions.push({ id: genId("t"), date: localDateStr(), amount: 0, what: "", linkedExpenseId: null, account: "" });
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

// Session-only (not persisted) — which budget rows are expanded to show their own this-month
// transactions, keyed by the shared expense's id ("__unlinked" for the Uncategorized row).
// Mirrors modernSharedRowOpen's lifetime/shape: re-read on every render, reset on reload.
export var budgetRowTxnsOpen = {};
// Real state.transactions[] indices (not positions in some filtered array) are what
// data-tx-del/deleteTransaction expect, so this keeps {t, i} pairs the same way
// renderTransactions() does, rather than returning bare transactions like sumTransactionsByExpense
// does — that's fine for a sum, but this list needs a working Delete button on each row.
function monthTransactionsForExpense(expenseId){
  var monthStr = localDateStr().slice(0, 7);
  var pairs = [];
  state.transactions.forEach(function(t, i){
    if((t.date || "").slice(0, 7) !== monthStr) return;
    var matches = expenseId === "__unlinked" ? !t.linkedExpenseId : t.linkedExpenseId === expenseId;
    if(matches) pairs.push({ t: t, i: i });
  });
  return pairs.sort(function(a, b){ return (b.t.date || "") < (a.t.date || "") ? -1 : ((b.t.date || "") > (a.t.date || "") ? 1 : 0); });
}
// The expand panel's own transaction rows — deliberately read-only (date/description/amount +
// Delete) rather than the full editable tx-row shape from the Transactions list below: this is a
// "what's actually logged against this line" drill-down, not a second place to edit everything.
// data-tx-del reuses the exact same global delete handler the Transactions list already wires up
// (app.js binds it on document, not scoped to #transactionsTable), so Delete here works for free.
function budgetRowTxnListHtml(pairs){
  var rows = pairs.map(function(pair){
    return '<div class="budget-row-txn">' +
      '<span class="budget-row-txn-date">' + escapeAttr(pair.t.date || "") + '</span>' +
      '<span class="budget-row-txn-what" title="' + escapeAttr(transactionDisplayName(pair.t, state.shared)) + '">' + escapeAttr(transactionDisplayName(pair.t, state.shared)) + '</span>' +
      '<span class="budget-row-txn-amt">' + fmtCurrency2.format(Number(pair.t.amount) || 0) + '</span>' +
      '<button type="button" class="btn btn-ghost btn-sm row-del" data-tx-del="' + pair.i + '" aria-label="Delete transaction">✕</button>' +
    '</div>';
  }).join("");
  return '<div class="budget-row-txns">' + rows + '</div>';
}
// Items marked "no fixed timing" (Extras, property maintenance, etc.) are lumpy by nature — a
// $0 actual most months is expected, not a budget miss. Comparing them against this month's
// slice of their budget (like every regular item below) produced a false "over/under budget"
// reading almost every month; comparing year-to-date actual against a full year's budget instead
// only flags a real problem (spending more than the whole year's allowance, this early in the
// year) and stays quiet the rest of the time. Rendered as its own section regardless of whether
// anything's been logged this month, since it's answering a different question ("on track for
// the year") than the month-by-month panel above it.
function irregularBudgetSectionHtml(irregularItems){
  if(!irregularItems.length) return "";
  var yearTxns = transactionsInYear(state.transactions);
  var byExpenseYear = sumTransactionsByExpense(yearTxns);
  var rows = irregularItems.map(function(item){
    var plannedYear = Math.round(periodsOf(item.amount, item.freq).yearly * 100) / 100;
    var actualYear = Math.round((byExpenseYear[item.id] || 0) * 100) / 100;
    var delta = actualYear - plannedYear;
    var color = delta > 0.5 ? "var(--bad)" : "";
    var pct = plannedYear > 0 ? Math.min(100, (actualYear / plannedYear) * 100) : (actualYear > 0 ? 100 : 0);
    var remaining = plannedYear - actualYear;
    var remainingLabel = remaining >= 0 ? (fmtCurrency0.format(remaining) + " left this year") : (fmtCurrency0.format(-remaining) + " over this year's budget");
    return '<div class="budget-row">' +
      '<div class="acct-row"><span class="acct-name" title="' + escapeAttr(item.what) + '">' + escapeAttr(item.what) + '</span>' +
        '<span style="font-size:11px;color:var(--ink-soft)">' + fmtCurrency0.format(actualYear) + ' actual / ' + fmtCurrency0.format(plannedYear) + ' planned this year — ' + remainingLabel + '</span>' +
        '<span class="acct-amt"' + (color ? ' style="color:' + color + '"' : '') + '>' + (delta >= 0 ? "+" : "−") + fmtCurrency0.format(Math.abs(delta)) + '</span></div>' +
      '<div class="budget-bar-track"><div class="budget-bar-fill' + (delta > 0.5 ? " over" : "") + '" style="width:' + pct + '%"></div></div>' +
    '</div>';
  }).join("");
  return '<div style="margin-top:16px"><div class="fire-stat-row" style="margin-bottom:2px"><span>Irregular / reserve budgets <span style="font-weight:400;color:var(--ink-soft)">— this year</span></span></div>' +
    '<p class="ledger-note" style="margin:0 0 8px">Marked "no fixed timing" — compared against a full year\'s budget instead of this month\'s, since these aren\'t expected on any particular schedule.</p>' +
    rows + '</div>';
}
export function renderActualVsPlannedPanel(){
  renderExpenseReviewButton();
  var el = document.getElementById("actualVsPlannedPanel");
  if(!el) return;
  var regularItems = state.shared.filter(function(item){ return !item.irregular; });
  var irregularItems = state.shared.filter(function(item){ return item.irregular; });
  var irregularIds = {};
  irregularItems.forEach(function(item){ irregularIds[item.id] = true; });
  var irregularSection = irregularBudgetSectionHtml(irregularItems);
  var allMonthTxns = transactionsInMonth(state.transactions);
  // This month's aggregate/per-row breakdown only ever concerns regular (predictable) items —
  // an irregular item's own transaction, if one lands this month, is reported in the year-to-date
  // section above instead, not folded into "this month" actual (which would otherwise read as a
  // budget miss against a monthly slice that was never a real expectation for that item).
  var monthTxns = allMonthTxns.filter(function(t){ return !t.linkedExpenseId || !irregularIds[t.linkedExpenseId]; });
  var byExpense = sumTransactionsByExpense(monthTxns);
  if(!state.shared.length && !allMonthTxns.length){
    el.innerHTML = '<p class="ledger-note" style="margin:0">Add a shared expense and log a transaction against it to see actual vs. planned here.</p>';
    return;
  }
  // With shared expenses defined but nothing logged yet this month, the full row-by-row
  // breakdown below is pure noise — every single row would repeat the Shared Expenses list above
  // at "$0 actual / $X planned", telling you nothing you don't already know from that list. Skip
  // straight to a compact nudge instead. Credit statement cycles still get their own section
  // regardless — a card's current bill runs on its own cycle dates, not the calendar month, so it
  // can be genuinely nonzero even with nothing logged today.
  if(!monthTxns.length){
    var plannedTotalEmpty = Math.round(sumField(regularItems, "monthly") * 100) / 100;
    el.innerHTML =
      '<p class="ledger-note" style="margin:0 0 12px">No transactions logged yet this month — planned budget is ' + fmtCurrency0.format(plannedTotalEmpty) + '/mo. Tap <b>+ Log spend</b> above to record what you actually spent and start tracking actual vs. planned.</p>' +
      creditStatementCyclesHtml() + irregularSection;
    return;
  }
  // Rounded to cents before any comparison/formatting below — periodsOf()'s weekly-then-back
  // conversion leaves a float epsilon (e.g. 2.4900000000000007) that can land a genuinely-exact
  // $0.50 delta a hair under the ">0.5" thresholds and, worse, make the displayed whole-dollar
  // "over"/"left" figure not match the difference between the whole-dollar actual/planned figures
  // shown right next to it (e.g. "$3 actual / $2 planned — $0 over").
  var plannedTotal = Math.round(sumField(regularItems, "monthly") * 100) / 100;
  var actualTotal = Math.round(monthTxns.reduce(function(s, t){ return s + (Number(t.amount) || 0); }, 0) * 100) / 100;
  var overallDelta = actualTotal - plannedTotal;
  // Framed from a spending point of view: spending less than planned is "good" (green), more is
  // "bad" (red) — the inverse of the up/down convention used for asset values elsewhere in the
  // app, where "up" is always good. Both read correctly for what they each represent.
  var overallColor = overallDelta > 0.5 ? "var(--bad)" : (overallDelta < -0.5 ? "var(--good)" : "");
  var overallPct = plannedTotal > 0 ? Math.min(100, (actualTotal / plannedTotal) * 100) : (actualTotal > 0 ? 100 : 0);
  var rows = regularItems.map(function(item){
    var planned = Math.round(periodsOf(item.amount, item.freq).monthly * 100) / 100;
    var actual = Math.round((byExpense[item.id] || 0) * 100) / 100;
    var delta = actual - planned;
    var color = delta > 0.5 ? "var(--bad)" : (delta < -0.5 ? "var(--good)" : "");
    var pct = planned > 0 ? Math.min(100, (actual / planned) * 100) : (actual > 0 ? 100 : 0);
    var remaining = planned - actual;
    var remainingLabel = remaining >= 0 ? (fmtCurrency0.format(remaining) + " left") : (fmtCurrency0.format(-remaining) + " over");
    // Only worth expanding once there's actually a transaction logged against it this month —
    // nothing to drill into otherwise, so a row with $0 actual stays a plain, non-interactive row.
    var txnPairs = monthTransactionsForExpense(item.id);
    var isExpandable = txnPairs.length > 0;
    var isOpen = isExpandable && !!budgetRowTxnsOpen[item.id];
    var chev = isExpandable ? '<svg class="budget-row-chev" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg>' : "";
    return '<div class="budget-row' + (isExpandable ? " is-expandable" : "") + (isOpen ? " open" : "") + '"' +
        (isExpandable ? ' data-budget-row-toggle="' + escapeAttr(item.id) + '" role="button" tabindex="0" aria-expanded="' + isOpen + '"' : '') + '>' +
      '<div class="acct-row"><span class="acct-name" title="' + escapeAttr(item.what) + '">' + escapeAttr(item.what) + '</span>' +
        '<span style="font-size:11px;color:var(--ink-soft)">' + fmtCurrency0.format(actual) + ' actual / ' + fmtCurrency0.format(planned) + ' planned — ' + remainingLabel + '</span>' +
        '<span class="acct-amt"' + (color ? ' style="color:' + color + '"' : '') + '>' + (delta >= 0 ? "+" : "−") + fmtCurrency0.format(Math.abs(delta)) + '</span>' + chev + '</div>' +
      '<div class="budget-bar-track"><div class="budget-bar-fill' + (delta > 0.5 ? " over" : "") + '" style="width:' + pct + '%"></div></div>' +
      (isOpen ? budgetRowTxnListHtml(txnPairs) : '') +
    '</div>';
  }).join("");
  var unlinkedTotal = byExpense.__unlinked || 0;
  var unlinkedPairs = unlinkedTotal ? monthTransactionsForExpense("__unlinked") : [];
  var unlinkedOpen = unlinkedPairs.length > 0 && !!budgetRowTxnsOpen.__unlinked;
  var unlinkedChev = unlinkedPairs.length ? '<svg class="budget-row-chev" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg>' : "";
  var unlinkedRow = unlinkedTotal
    ? '<div class="budget-row' + (unlinkedPairs.length ? " is-expandable" : "") + (unlinkedOpen ? " open" : "") + '"' +
        (unlinkedPairs.length ? ' data-budget-row-toggle="__unlinked" role="button" tabindex="0" aria-expanded="' + unlinkedOpen + '"' : '') + '>' +
        '<div class="acct-row"><span class="acct-name" style="font-style:italic">Uncategorized (one-off)</span><span></span>' +
        '<span class="acct-amt">' + fmtCurrency0.format(unlinkedTotal) + '</span>' + unlinkedChev + '</div>' +
        (unlinkedOpen ? budgetRowTxnListHtml(unlinkedPairs) : '') +
      '</div>'
    : "";
  el.innerHTML =
    '<div class="fire-stat-row"><span>This month — actual vs. planned</span><b' + (overallColor ? ' style="color:' + overallColor + '"' : '') + '>' + fmtCurrency0.format(actualTotal) + ' / ' + fmtCurrency0.format(plannedTotal) + '</b></div>' +
    '<div class="fire-bar-track"><div class="fire-bar-fill' + (overallDelta > 0.5 ? " over" : "") + '" style="width:' + overallPct + '%"></div></div>' +
    '<p class="fire-note" style="margin:2px 0 12px">' + (overallDelta >= 0 ? "+" : "−") + fmtCurrency0.format(Math.abs(overallDelta)) + (overallDelta > 0.5 ? " over budget so far this month." : overallDelta < -0.5 ? " under budget so far this month." : " right on budget so far this month.") + '</p>' +
    rows + unlinkedRow +
    creditStatementCyclesHtml() + irregularSection;
}

// A credit card's bill is charges grouped by its own statement cycle, not the calendar month —
// see calc/ledger.js's currentStatementCycle(). Logging "the bill" as its own transaction would
// double-count what's already logged per-purchase, so this is a pure rollup of existing
// transactions attributed (directly or via a linked expense) to a credit-type account.
function creditStatementCyclesHtml(){
  var creditAccounts = state.accounts.filter(function(a){ return a.type === "credit"; });
  if(!creditAccounts.length) return "";
  var rows = creditAccounts.map(function(a){
    var cycle = currentStatementCycle(a.statementStartDay || 1);
    var cycleTxns = transactionsInRange(state.transactions, cycle.start, cycle.end)
      .filter(function(t){ return transactionAccount(t) === a.name; });
    var total = cycleTxns.reduce(function(s, t){ return s + (Number(t.amount) || 0); }, 0);
    return '<div class="acct-row"><span class="acct-name" title="' + escapeAttr(a.name) + '">' + escapeAttr(a.name) + '</span>' +
      '<span style="font-size:11px;color:var(--ink-soft)">' + cycle.start + ' – ' + cycle.end + ' · ' + cycleTxns.length + ' charge' + (cycleTxns.length === 1 ? "" : "s") + '</span>' +
      '<span class="acct-amt">' + fmtCurrency0.format(total) + '</span></div>';
  }).join("");
  return '<div style="margin-top:16px"><div class="fire-stat-row" style="margin-bottom:2px"><span>This bill so far — by statement cycle</span></div>' + rows + '</div>';
}

// ---------------- Accounts: named money sources, used to group transactions into a credit card's statement cycle ----------------
function accountRowHtml(a, idx){
  var nameInput = '<input type="text" class="acct-mgmt-name" data-acct-index="' + idx + '" value="' + escapeAttr(a.name || "") + '" placeholder="Account name" aria-label="Account name">';
  var typeSelect = '<select class="acct-mgmt-type" data-acct-index="' + idx + '" aria-label="Account type">' +
    '<option value="debit"' + (a.type !== "credit" ? " selected" : "") + '>Debit / savings — no due date</option>' +
    '<option value="credit"' + (a.type === "credit" ? " selected" : "") + '>Credit card — has a statement cycle</option>' +
    '</select>';
  var dayInput = a.type === "credit"
    ? '<input type="number" min="1" max="28" step="1" class="acct-mgmt-day" data-acct-index="' + idx + '" value="' + (a.statementStartDay || 1) + '" aria-label="Statement start day (1-28)">'
    : "";
  var delBtn = '<button type="button" class="btn btn-ghost btn-sm row-del" data-acct-del="' + idx + '" aria-label="Delete account">✕</button>';
  return '<div class="m-row acct-mgmt-row" data-acct-index="' + idx + '">' +
    '<div class="m-row-summary" style="cursor:default;flex-wrap:wrap;gap:8px">' + nameInput + typeSelect + dayInput + delBtn + '</div>' +
  '</div>';
}
export function renderAccounts(){
  var container = document.getElementById("accountsTable");
  if(!container) return;
  if(!state.accounts.length){
    container.innerHTML = '<p class="ledger-note" style="margin:0">No accounts yet — add one below (e.g. your credit card) to group its transactions into a statement cycle.</p>';
    return;
  }
  var rows = state.accounts.map(function(a, i){ return accountRowHtml(a, i); }).join("");
  container.innerHTML = '<div class="m-rows">' + rows + '</div>';
}
export function addAccount(){
  state.accounts.push({ id: genId("acct"), name: "", type: "debit", statementStartDay: 1 });
  renderAccounts();
  persist();
}
export function deleteAccount(idx){
  var removed = state.accounts[idx];
  if(!removed) return;
  state.accounts.splice(idx, 1);
  renderAccounts();
  renderTransactions();
  renderActualVsPlannedPanel();
  persist();
  showUndoToast("Deleted account", function(){
    state.accounts.splice(Math.min(idx, state.accounts.length), 0, removed);
    renderAccounts();
    renderTransactions();
    renderActualVsPlannedPanel();
    persist();
  });
}
// Cascades a rename across every plain "account" string in the app — those fields predate
// state.accounts[] and were never a foreign key, so nothing else keeps them in sync automatically.
export function renameAccountEverywhere(oldName, newName){
  if(!oldName || oldName === newName) return;
  function retarget(items){
    (items || []).forEach(function(item){ if((item.account || "") === oldName) item.account = newName; });
  }
  retarget(state.income);
  retarget(state.shared);
  (state.properties || []).forEach(function(p){ retarget(p.income); retarget(p.expenses); });
  state.transactions.forEach(function(t){ if((t.account || "") === oldName) t.account = newName; });
}
