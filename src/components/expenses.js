import { state, persist, genId } from "../state.js";
import { CLASSES, FREQS, UNCATEGORISED } from "../constants.js";
import { sumField, sumFieldForScenario, resolveSharedAmount, periodsOf, budgetCycleFor, transactionDisplayName, transactionsInMonth, sumTransactionsByExpense, currentStatementCycle, transactionsInRange, isOverdue, daysUntil, lastTransactionDateFor, reserveYearWindowFor, householdYearWindow, householdYearToDate, householdYearProgress, householdYearBasis, HOUSEHOLD_YEAR_BASES } from "../calc/ledger.js";
import { loanRepaymentMonthly, ipProperties } from "../calc/property.js";
import { fmtCurrency0, fmtCurrency2, fmtPercent0, fmtPercent1, localDateStr } from "../lib/format.js";
import { spendingTrends, monthKeyLabel } from "../calc/trends.js";
import { escapeAttr } from "../lib/html.js";
import { modernPlainRowHtml, modernRowSummaryHtml, modernRowEditHtml, modernRowShellHtml, optionsHtml } from "../lib/ledger-table.js";
import { showToast, showUndoToast } from "../lib/toast.js";
import { parseCsv } from "../lib/backup.js";

// Which axis the Budget list is grouped by, and the value a given line sits under on it. The two
// axes are deliberately different in kind: classification is a fixed four-value scale every line
// has, category an open user-defined set most lines may not have yet — hence the "Uncategorised"
// bucket, which has no equivalent on the type axis (there, "N/A" is a real choice).
function budgetGroupKeyOf(item){
  return state.budgetGroupBy === "category"
    ? ((item.category || "").trim() || UNCATEGORISED)
    : (item.classification || "N/A");
}
// Group order is the *stable* one — CLASSES order, or the user's own category list — not biggest
// first. This is a list you edit: ordering it by amount would make cards jump around as you type
// into them. The charts sort by size instead, because a chart is read, not edited.
function sharedGroupOrder(){
  var lineItems = allBudgetLines().map(function(line){ return line.item; });
  if(state.budgetGroupBy !== "category"){
    return CLASSES.filter(function(cls){
      return lineItems.some(function(item){ return (item.classification || "N/A") === cls; });
    });
  }
  var used = {};
  lineItems.forEach(function(item){ used[budgetGroupKeyOf(item)] = true; });
  var order = state.categories.filter(function(name){ return used[name]; });
  // Uncategorised last: it's the leftovers, and putting it first would make an unstarted budget
  // look like one giant unnamed group standing in front of the real ones.
  if(used[UNCATEGORISED]) order.push(UNCATEGORISED);
  return order;
}

// Every budget line the Budget tab lists, each tagged with the array it actually lives in.
//
// Housing used to be invisible here: state.home is keyed by scenario, because scenarios were once
// this app's organising principle and housing was the thing being compared rather than a cost you
// budget for. That left the single largest household expense — rent, or a mortgage plus rates and
// insurance — out of the budget, its category rollups and its charts entirely.
//
// It isn't merged into state.shared, because scenarios differ by *row set*, not just amount:
// Council Rates and Home Insurance exist only if you buy. scenarioOverrides varies an amount on a
// row that exists everywhere, so a merge would need either $0 placeholder rows cluttering the
// everyday budget or a new "doesn't apply here" concept. Instead the active scenario's housing is
// listed alongside shared as first-class lines, carrying their own section so every existing
// handler (edit, delete, log, scenario override) routes to the right array unchanged. Scenarios
// keep their own blocks for comparison; this is just where you look at the one you live in.
//
// Investment-property costs join for the same reason and on the same terms. They were a read-only
// mirror here for a long time, on the grounds that they're already counted separately in every
// total — true of the *arithmetic*, but the point of this page isn't arithmetic: strata, rates and
// landlord insurance are bills that get paid, get logged against and belong in a category rollup
// like every other bill. They stay in p.expenses (the Properties tab is still where a property is
// managed as a whole) and are listed here through their own "propexp:<id>" section, so editing one
// from the Budget tab writes to exactly the same row the Properties tab shows.
//
// Loan repayments are deliberately not lines: they're derived from balance/rate/term rather than
// budgeted, so there's nothing to edit and nothing to fall behind on logging. They keep their own
// summary card below the list instead.
function budgetLineSources(){
  var sources = [{ section: "shared", items: state.shared }];
  var homeItems = state.home[state.activeScenario];
  if(homeItems && homeItems.length) sources.push({ section: "home:" + state.activeScenario, items: homeItems });
  ipProperties().forEach(function(p){
    if(p.expenses && p.expenses.length) sources.push({ section: "propexp:" + p.id, items: p.expenses });
  });
  return sources;
}
// Flat list of { item, section, idx } across every source, in display order.
function allBudgetLines(){
  var lines = [];
  budgetLineSources().forEach(function(source){
    source.items.forEach(function(item, idx){ lines.push({ item: item, section: source.section, idx: idx }); });
  });
  return lines;
}
function computeSharedGroups(){
  var lines = allBudgetLines();
  return sharedGroupOrder().map(function(key){
    var members = lines.filter(function(line){ return budgetGroupKeyOf(line.item) === key; });
    var items = members.map(function(line){ return line.item; });
    // Scenario-resolved, like scenarioTotals() and computeNetWorthSeries(). Raw amounts left the
    // Expenses page quoting a different household cost than the Dashboard for the very same
    // scenario, by the size of every override.
    return { key: key, members: members, items: items, monthly: sumFieldForScenario(items, state.activeScenario, "monthly") };
  });
}

export function patchSharedGroupTotals(){
  var groups = computeSharedGroups();
  // Matched by card name, not by position. Recategorising a row can create or empty a whole group,
  // so the freshly-computed list and the cards still on screen can differ in length and order —
  // writing totals by index then puts Rent's $3,510 under "Groceries". A card whose group no
  // longer exists is simply left alone until the next full render moves its rows.
  var byKey = {};
  groups.forEach(function(g){ byKey[g.key] = g; });
  document.querySelectorAll("#sharedGroups .m-card").forEach(function(card){
    var nameEl = card.querySelector(".m-card-name");
    var group = nameEl && byKey[nameEl.textContent];
    var totalEl = card.querySelector(".m-card-total");
    if(totalEl && group) totalEl.innerHTML = fmtCurrency0.format(group.monthly) + "<span>/mo</span>";
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
var EXPENSES_IMPORT_HEADERS = ["what", "classification", "category", "amount", "frequency", "account", "source"];
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
    // Free text rather than matched against state.categories: an import is usually how a category
    // set arrives in the first place, and migrateState's seed-from-usage pass registers whatever
    // comes in, so rejecting an unknown name here would be rejecting the point of the column.
    var category = colOf.category !== undefined ? (cells[colOf.category] || "").trim() : "";
    // Where the row belongs: "Housing" (the active scenario's block), the name of an investment
    // property (that property's costs), or anything else — including a blank cell or a file
    // predating the column — meaning a shared expense, which is what every import did before this
    // existed. "Housing" wins over a property that happens to be called that, so the keyword can
    // never stop working; matched case-insensitively so a hand-typed column still lands right.
    var sourceRaw = colOf.source !== undefined ? (cells[colOf.source] || "").trim() : "";
    var ipMatch = sourceRaw && ipProperties().find(function(p){ return (p.what || "").trim().toLowerCase() === sourceRaw.toLowerCase(); });
    var source = sourceRaw.toLowerCase() === "housing" ? "Housing" : (ipMatch ? ipMatch.what : "Shared");
    var propertyId = (source !== "Housing" && ipMatch) ? ipMatch.id : null;
    valid.push({ what: what, classification: classMatch || "Needs", category: category, amount: amount, freq: freqMatch || "Monthly", account: account, source: source, propertyId: propertyId });
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
    return "<tr><td>" + escapeAttr(item.what) + "</td><td>" + escapeAttr(item.classification) + '</td><td class="num">' + fmtCurrency2.format(item.amount) + "</td><td>" + escapeAttr(item.freq) + "</td><td>" + escapeAttr(item.account) + "</td><td>" + escapeAttr(item.source) + "</td></tr>";
  }).join("");
  var moreNote = parsed.valid.length > 8 ? '<p class="ledger-note" style="margin:6px 0 0">and ' + (parsed.valid.length - 8) + " more…</p>" : "";
  container.innerHTML =
    '<p class="ledger-note" style="margin:0"><b>' + summary + "</b></p>" +
    errorsHtml +
    (parsed.valid.length ? '<div class="table-scroll" style="margin-top:8px"><table class="import-preview-table"><thead><tr><th>What</th><th>Classification</th><th class="num">Amount</th><th>Frequency</th><th>Account</th><th>Goes to</th></tr></thead><tbody>' + previewRows + "</tbody></table></div>" + moreNote : "") +
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
    var row = { what: item.what, classification: item.classification, category: item.category || "", account: item.account, amount: item.amount, freq: item.freq };
    // Housing rows land in the active scenario's block, where the Budget tab reads them from —
    // pushing them onto state.shared would duplicate rent into a second, scenario-blind copy.
    // They need an id for the same reason every other budget line does (transactions link by it).
    var targetProperty = item.propertyId && state.properties.find(function(p){ return p.id === item.propertyId; });
    if(item.source === "Housing"){
      row.id = genId("exp");
      row.irregular = false;
      row.dueMonth = null;
      (state.home[state.activeScenario] = state.home[state.activeScenario] || []).push(row);
    } else if(targetProperty){
      // Named an investment property, so it's that property's cost — the same row the Properties
      // tab edits. Resolved by id captured at parse time rather than re-matching the name here,
      // so a property renamed between preview and confirm can't silently retarget the import.
      row.id = genId("exp");
      row.irregular = false;
      row.dueMonth = null;
      targetProperty.expenses.push(row);
    } else {
      state.shared.push(row);
    }
    // Register any category the file brought in that the manager doesn't know yet, so an import
    // can't leave a row pointing at a category missing from Accounts → Categories. Same contract
    // as migrateState's seed-from-usage pass, applied at the moment the rows actually land.
    var importedCat = (item.category || "").trim();
    if(importedCat && state.categories.indexOf(importedCat) === -1) state.categories.push(importedCat);
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

// Each budget line's own "how's this one going" line: a thin bar plus "$120 of $200 this month".
// This is what makes the Budget tab worth opening on any day other than set-up day — the planned
// figure on its own never changes, so a list of planned figures is a list you stop reading.
//
// Compared over the window the line is actually billed in (budgetCycleFor), not a calendar month:
// a $230 quarterly bill is smoothed to $76.67/mo everywhere else in the app, which is right for
// cash flow but wrong here — it made a payment that was exactly on plan render as 3x over in the
// month it landed. Now it reads "$230 of $230 this quarter" and stays green for the whole cycle.
//
// Irregular items are still excluded: they're budgeted as a smoothed yearly reserve with no fixed
// timing, so they have no billing cycle to compare against (same reasoning as the Actual vs.
// planned panel's own split).
function budgetRowProgressHtml(item){
  if(item.irregular) return "";
  // A computed line can't be logged against (it's not a quick-log chip and never enters the
  // overdue queue), so its progress bar would sit at "$0 of $173" forever — a permanent red herring
  // on a row that is, in fact, always paid.
  if(item.computed) return "";
  // item.amount, not resolveSharedAmount(): the row's own headline "/mo" figure right next to this
  // is the un-overridden amount, as is the Actual vs. planned panel's, so reading the scenario
  // override here would make the two numbers on the same row disagree whenever one is set.
  var cycle = budgetCycleFor(item, state.transactions);
  var target = Math.round(cycle.target * 100) / 100;
  if(target <= 0) return "";
  var spent = Math.round(spentInCycle(item, cycle) * 100) / 100;
  var over = spent - target > 0.5;
  var pct = Math.min(100, (spent / target) * 100);
  var text = fmtCurrency0.format(spent) + " of " + fmtCurrency0.format(target) + " " + cycle.label;
  return '<div class="budget-progress">' +
    '<div class="budget-progress-track"><div class="budget-progress-fill' + (over ? " over" : "") + '" style="width:' + pct + '%"></div></div>' +
    '<span class="budget-progress-text' + (over ? " over" : "") + '">' + escapeAttr(text) + '</span>' +
  '</div>';
}
// What's been logged against this line inside its current billing window.
function spentInCycle(item, cycle){
  return transactionsInRange(state.transactions, cycle.start, cycle.end)
    .reduce(function(sum, t){ return t.linkedExpenseId === item.id ? sum + (Number(t.amount) || 0) : sum; }, 0);
}
// A group is collapsed unless it has been explicitly opened. Reading "absent means collapsed"
// rather than seeding every name on migration is what makes this work across the Type/Category
// toggle — the two axes have entirely different group names, and a category created next month
// has never been seen by any migration.
export function isBudgetGroupCollapsed(key){
  var map = state.budgetGroupsCollapsed || {};
  return map[key] !== false;
}
export function toggleBudgetGroup(key){
  if(!state.budgetGroupsCollapsed) state.budgetGroupsCollapsed = {};
  state.budgetGroupsCollapsed[key] = !isBudgetGroupCollapsed(key);
}
export function setAllBudgetGroupsCollapsed(collapsed){
  if(!state.budgetGroupsCollapsed) state.budgetGroupsCollapsed = {};
  computeSharedGroups().forEach(function(g){ state.budgetGroupsCollapsed[g.key] = collapsed ? true : false; });
}
export function allBudgetGroupsCollapsed(){
  return computeSharedGroups().every(function(g){ return isBudgetGroupCollapsed(g.key); });
}
// Opens whichever group card contains this budget line, so something arriving from outside the page
// (cross-page search) can land on a row rather than on a closed card that happens to contain it.
// Returns false when the line isn't in the list at all — an income row, a deleted line — so the
// caller can skip the scroll rather than scrolling to nothing.
export function revealBudgetLine(lineId){
  if(!lineId) return false;
  var group = computeSharedGroups().find(function(g){
    return g.members.some(function(m){ return m.item && m.item.id === lineId; });
  });
  if(!group) return false;
  if(!state.budgetGroupsCollapsed) state.budgetGroupsCollapsed = {};
  state.budgetGroupsCollapsed[group.key] = false;
  return true;
}
export function renderSharedGroups(){
  // The overdue count depends on the budget lines and on what's been logged against them, so it's
  // refreshed from both of the renders that follow a change to either (see also
  // renderActualVsPlannedPanel) rather than from every call site that mutates them.
  renderExpenseReviewButton();
  var container = document.getElementById("sharedGroups");
  if(!container) return;
  // Names the scenario the housing rows came from, so it's never a mystery why rent changed.
  var scenarioLabel = document.getElementById("budgetHousingScenario");
  if(scenarioLabel) scenarioLabel.textContent = state.activeScenario;
  var groups = computeSharedGroups();
  patchSharedGroupTotals();
  var byCategory = state.budgetGroupBy === "category";
  // One bar, and it always splits the money the same way the cards below it do. This is what the
  // toggle really buys: the alternative was showing both splits at once, and two stacked
  // percentage-labelled bars compete for a single glance instead of answering one question each.
  var compositionHtml = byCategory
    ? categoryChartHtml(groups.map(function(g){ return { key: g.key, monthly: g.monthly }; }), "/mo")
    : sharedCompositionBarHtml(groups);
  // "+ Add expense" on a card presets whichever group it sits under, on whichever axis is showing
  // — sharedcat: for a category, shared: for a classification. The Uncategorised card presets
  // nothing, since it isn't a category you can put something into.
  var addPrefix = byCategory ? "sharedcat:" : "shared:";
  container.innerHTML = compositionHtml + '<div class="m-people">' + groups.map(function(g, gi){
    var initial = (g.key === "N/A" || g.key === UNCATEGORISED) ? "–" : g.key.charAt(0);
    // Category avatars take the same cycling palette as the chart, so a card and its slice are
    // the same colour; classification keeps its fixed named swatches.
    var avatarClass = byCategory
      ? (g.key === UNCATEGORISED ? "m-avatar-neutral" : "m-avatar-series series-color-" + (gi % 8))
      : "m-avatar-" + classificationSwatchClass(g.key);
    var addValue = (byCategory && g.key === UNCATEGORISED) ? "shared" : addPrefix + g.key;
    // Collapsed by default (see migrateState). A 37-line budget is 4,023px of rows on a 390px
    // screen — you cannot reach Groceries without scrolling past thirty other things. Collapsed,
    // the same budget is seven headers that each still state their own monthly total, so the shape
    // of the spending is legible at a glance and the detail is one tap away. Same call, and the
    // same reasoning, as defaulting a property card's sections closed.
    var collapsed = isBudgetGroupCollapsed(g.key);
    return '<div class="m-card' + (collapsed ? " is-collapsed" : "") + '">' +
      '<div class="m-card-head" data-budget-group-toggle="' + escapeAttr(g.key) + '" role="button" tabindex="0" aria-expanded="' + (!collapsed) + '">' +
      '<span class="icon-btn m-card-caret" aria-hidden="true"><svg class="ledger-caret" width="9" height="9" viewBox="0 0 8 8"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg></span>' +
      '<span class="m-avatar ' + avatarClass + '">' + escapeAttr(initial) + '</span>' +
      '<div class="m-card-name">' + escapeAttr(g.key) + '</div>' +
      '<div class="m-card-total">' + fmtCurrency0.format(g.monthly) + '<span>/mo</span></div></div>' +
      // Each row renders under its own source section, so a housing line's edits, deletes and
      // logs land in state.home[scenario] while a shared line's land in state.shared — no
      // special-casing anywhere downstream, since every handler already keys off data-section.
      '<div class="m-rows">' + g.members.map(function(line){ return modernPlainRowHtml(line.item, line.idx, line.section, modernSharedRowOpen, {showClass:true, showDone:true, categories: state.categories, activeScenario: state.activeScenario, extraSubLine: budgetRowProgressHtml(line.item)}); }).join("") + '</div>' +
      '<button type="button" class="m-add-row" data-add="' + escapeAttr(addValue) + '">+ Add expense</button>' +
    '</div>';
  }).join("") + '</div>';
  injectScenarioOverrideButtons();
}

// Only state.shared rows get a "vary by scenario" action — income/home/property rows use the
// same generic rowHtml()/modernPlainRowHtml() but have no scenarioOverrides concept, so this is
// a post-render DOM patch scoped to #sharedGroups rather than a change to those shared
// renderers (which would otherwise need to special-case every other section that reuses them).
export function injectScenarioOverrideButtons(containerId, section){
  containerId = containerId || "sharedGroups";
  section = section || "shared";
  document.querySelectorAll('#' + containerId + ' [data-section="' + section + '"]').forEach(function(rowEl){
    var idx = rowEl.getAttribute("data-index");
    var item = overrideItemAt(section, Number(idx));
    // A computed row's amount isn't the user's to set in the first place (a synced home-loan
    // repayment, a person's synthetic net income), so "vary it by scenario" is meaningless there.
    // On Income that's most of what's in the list, so this matters more than it did on shared.
    if(!item || item.computed || item.syntheticNetFor) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-ghost btn-sm";
    btn.setAttribute("data-vary-scenario", idx);
    btn.setAttribute("data-vary-section", section);
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

// The two lists whose rows can carry a per-scenario override. Kept as an explicit map rather than
// reusing app.js's getArrayForSection() — that one routes across every section in the app,
// including housing and property rows, and those *can't* vary by scenario (housing rows already
// belong to one scenario; property costs are global). Naming the two here makes the panel refuse
// anything else by construction rather than by a check someone can forget.
var OVERRIDE_SECTIONS = {
  shared: function(){ return state.shared; },
  income: function(){ return state.income; }
};
function overrideItemAt(section, idx){
  var get = OVERRIDE_SECTIONS[section];
  var arr = get && get();
  return arr ? arr[idx] : null;
}

// Session-only (not persisted) — which row (if any) has its per-scenario override panel open,
// as {section, idx}; mirrors homeBlockCollapsed/modernSharedRowOpen's pattern of session UI state
// living as a plain exported var here, mutated from app.js's event handlers.
export var scenarioOverrideOpen = null;

function scenarioOverridePanelHtml(section, idx){
  var item = overrideItemAt(section, idx);
  if(!item) return "";
  var baseLabel = fmtCurrency2.format(item.amount) + " " + item.freq;
  // Income needs a sentence expenses don't: on a Gross row the number being varied is pre-tax, and
  // the consequence people expect ("so my take-home drops by the same amount") is wrong — tax,
  // Medicare and super all move with it.
  var isGross = section === "income" && item.incomeType === "Gross";
  var incomeNote = section !== "income" ? "" :
    '<p class="scen-override-note">' + (isGross
      ? "This is a <b>pre-tax</b> amount, so each scenario\'s tax, Medicare levy and employer super are worked out again from the figure you set here — take-home won\'t move by the same amount you do."
      : "This amount is already after tax, so it carries straight into each scenario\'s savings.") +
    '</p>';
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
  return '<div class="scen-override-backdrop" data-override-backdrop data-override-section="' + escapeAttr(section) + '" data-override-idx="' + idx + '">' +
    '<div class="scen-override-panel" role="dialog" aria-label="Vary &quot;' + escapeAttr(item.what) + '&quot; by scenario">' +
      '<div class="scen-override-head"><h4>Vary "' + escapeAttr(item.what) + '" by scenario</h4>' +
        '<button type="button" class="icon-btn" data-override-close aria-label="Close">✕</button></div>' +
      '<p class="scen-override-note">' + (section === "income" ? "Default" : "Shared") + ' amount (used by any scenario without its own value below): <b>' + baseLabel + '</b></p>' +
      incomeNote +
      '<div class="scen-override-rows">' + rows + '</div>' +
    '</div>' +
  '</div>';
}

export function openScenarioOverridePanel(section, idx){
  scenarioOverrideOpen = { section: section, idx: idx };
  renderScenarioOverridePanel();
}
export function closeScenarioOverridePanel(){
  scenarioOverrideOpen = null;
  var root = document.getElementById("scenarioOverrideRoot");
  if(root) root.innerHTML = "";
}
export function renderScenarioOverridePanel(){
  var root = document.getElementById("scenarioOverrideRoot");
  if(!root) return;
  var open = scenarioOverrideOpen;
  if(!open || !overrideItemAt(open.section, open.idx)){
    scenarioOverrideOpen = null;
    root.innerHTML = "";
    return;
  }
  root.innerHTML = scenarioOverridePanelHtml(open.section, open.idx);
}

export function setScenarioOverride(section, idx, scenarioName, amount){
  var item = overrideItemAt(section, idx);
  if(!item) return;
  if(!item.scenarioOverrides) item.scenarioOverrides = {};
  item.scenarioOverrides[scenarioName] = amount;
}
export function resetScenarioOverride(section, idx, scenarioName){
  var item = overrideItemAt(section, idx);
  if(!item || !item.scenarioOverrides) return;
  delete item.scenarioOverrides[scenarioName];
}
export function copyScenarioAmountToAll(section, idx, scenarioName){
  var item = overrideItemAt(section, idx);
  if(!item) return;
  var value = resolveSharedAmount(item, scenarioName);
  item.amount = value;
  item.scenarioOverrides = {};
  showToast('Set "' + item.what + '" to ' + fmtCurrency2.format(value) + ' for every scenario');
}

// What's left of the old read-only "Investment property costs" mirror. Its expense half is gone:
// those rows are real budget lines in the list above now (see budgetLineSources), so keeping the
// mirror would have shown every strata and rates bill twice on one page.
//
// Loan repayments stay, and stay read-only, because they aren't budgeted — each is derived from
// its loan's balance, rate, term and repayment type, so there is nothing here to edit and nothing
// to fall behind on logging. They're still the single biggest line an investment property carries,
// though, and the Budget total above deliberately excludes them (it totals the list, and they
// aren't in it), so dropping them entirely would have left the Expenses page quietly understating
// what a property costs to hold. This card is the honest remainder.
function propertyLoanMonthly(p){
  return (p.loans || []).reduce(function(s, l){ return s + loanRepaymentMonthly(l); }, 0);
}
function propertyLoansModernHtml(ips){
  var rows = ips.map(function(p){
    return '<div class="m-row computed"><div class="m-row-summary" style="cursor:default">' +
      '<div style="flex:1 1 auto; min-width:0">' +
        '<div class="m-row-name">' + escapeAttr(p.what) + ' — Loan repayments</div>' +
        '<div class="m-row-sub">auto: from the loan\'s balance and rate — edit on the Properties tab</div>' +
      '</div>' +
      '<span class="m-row-amt">' + fmtCurrency0.format(propertyLoanMonthly(p)) + '/mo</span>' +
    '</div></div>';
  }).join("");
  return '<div class="m-card"><div class="m-rows">' + rows + '</div></div>';
}

export function renderPropertyExpensesSummary(){
  var wrap = document.getElementById("propertyExpensesCard");
  var modernWrap = document.getElementById("propertyExpensesModern");
  if(!wrap || !modernWrap) return;
  // Only properties that actually carry a loan — an unencumbered IP has nothing to say here, and
  // an empty card headed "Investment loan repayments" reads like a bug.
  var ips = ipProperties().filter(function(p){ return propertyLoanMonthly(p) > 0; });
  wrap.hidden = !ips.length;
  if(!ips.length) return;
  var total = ips.reduce(function(s, p){ return s + propertyLoanMonthly(p); }, 0);
  document.getElementById("propertyExpensesTotal").textContent = fmtCurrency0.format(total);
  modernWrap.innerHTML = propertyLoansModernHtml(ips);
  renderBudgetLoanPointer(total);
}

// The forward reference from the budget total to the loan card below it. Without it the Expenses
// page says the household spends $10,072/mo and the Dashboard's 50/30/20 bar says $14,613 — a
// $4,541 disagreement on the same real data, with the explanation 4,700px further down the page.
// Naming the amount here means the two figures reconcile on sight rather than after a scroll.
function renderBudgetLoanPointer(total){
  var el = document.getElementById("budgetLoanPointer");
  if(!el) return;
  el.hidden = !(total > 0);
  if(!(total > 0)) return;
  el.innerHTML = 'Not in this total: <b>' + fmtCurrency0.format(total) + '/mo</b> of investment loan ' +
    'repayments, which are worked out from each loan rather than budgeted. The Dashboard counts them, ' +
    'so its spending figure is that much higher. <button type="button" class="calc-hint-link" ' +
    'id="budgetLoanPointerLink">See them below</button>';
}

// ---------------- Review expenses: one-at-a-time swipe/confirm flow ----------------
// Session-only (not persisted) — which state.shared indices are queued for review and how far
// through the queue the user has gotten. null when the review flow is closed. A snapshot of
// indices taken at open time (not re-derived live), so deleting/reordering rows elsewhere while
// a review is somehow still open can't shift what "next" points at mid-review.
// queue holds budget-line *ids*, not indices. It used to hold positions in state.shared, which
// made the flow structurally incapable of covering housing (a different array) and quietly wrong
// if a row was added or deleted mid-review. Every budget line carries a stable id now, so the
// queue resolves through budgetLineItems() and works across every source without an index model.
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
  var dueCount = loggableBudgetLineItems().reduce(function(n, item){ return n + (isDueForReview(item) ? 1 : 0); }, 0);
  btn.hidden = dueCount === 0;
  btn.textContent = "Catch up on " + dueCount + " overdue";
}
export function reviewQueueItem(){
  if(!expenseReview) return null;
  var id = expenseReview.queue[expenseReview.pos];
  if(id == null) return null;
  return budgetLineItems().find(function(i){ return i.id === id; }) || null;
}
export function openExpenseReview(){
  var lines = loggableBudgetLineItems();
  if(!lines.length){
    showToast("No expenses to review yet — add one on this page first.");
    return;
  }
  var due = [];
  lines.forEach(function(item){ if(isDueForReview(item)) due.push(item.id); });
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
  var item = reviewQueueItem();
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
  var item = reviewQueueItem();
  if(!item){ expenseReview.pos++; renderExpenseReviewPanel(); return; }
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
  return loggableBudgetLineItems()
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
export function submitQuickLog(amount, note, dateStr, category){
  if(!quickLog) return null;
  var item = quickLog.linkedId && budgetLineItems().find(function(i){ return i.id === quickLog.linkedId; });
  var t = {
    id: genId("t"),
    date: dateStr || localDateStr(),
    amount: Number(amount) || 0,
    what: (note || "").trim(),
    linkedExpenseId: item ? item.id : null,
    account: item && item.account ? item.account : "",
    // Only ever set for a one-off — a linked transaction resolves its category through the link
    // (transactionCategory), so storing a copy here would go stale the moment the line is recategorised.
    category: item ? "" : (category || "")
  };
  state.transactions.push(t);
  return t;
}
// Shown only when nothing is linked: a transaction against a budget line already takes that
// line's category, so offering a second one would invite them to disagree. A one-off has nothing
// to inherit from, and without this every one-off would land in Uncategorised forever.
function quickLogCategoryHtml(item){
  if(item || !state.categories.length) return "";
  return '<div class="qlog-cat-row"><label class="qlog-cat-label" for="quickLogCategory">Category</label>' +
    '<select id="quickLogCategory" class="qlog-cat" aria-label="Category (optional)">' +
      '<option value="">— None —</option>' + optionsHtml(state.categories, "") +
    '</select></div>';
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
  var item = quickLog.linkedId && budgetLineItems().find(function(i){ return i.id === quickLog.linkedId; });
  root.innerHTML = '<div class="review-backdrop" data-qlog-backdrop>' +
    '<div class="review-panel qlog-panel" role="dialog" aria-label="Log spend">' +
      '<div class="review-head"><h4>Log spend</h4><button type="button" class="icon-btn" data-qlog-close aria-label="Close">✕</button></div>' +
      '<div class="qlog-amount-row">' +
        '<span class="qlog-currency" aria-hidden="true">$</span>' +
        '<input type="number" step="0.01" inputmode="decimal" id="quickLogAmount" class="qlog-amount" placeholder="0.00" aria-label="Amount spent — negative for a refund">' +
      '</div>' +
      '<div class="qlog-section-label">What was it for?</div>' +
      quickLogChipsHtml() +
      '<p class="qlog-context">' + escapeAttr(quickLogContextText(item)) + '</p>' +
      '<input type="text" id="quickLogNote" class="qlog-note" placeholder="' + escapeAttr(item ? "Note (optional)" : "What was it? (optional)") + '" aria-label="Note (optional)">' +
      quickLogCategoryHtml(item) +
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
// Persisted rather than session-only (see state.js) — so this both writes and re-renders.
export function setBudgetGroupBy(value){
  state.budgetGroupBy = value === "category" ? "category" : "type";
  renderSharedGroups();
  renderBudgetGroupByToggle();
  persist();
}
// Rendered beside the Group-by toggle rather than in the card footer, because it acts on every
// card at once and the toggle it sits next to is the other control that reshapes the whole list.
export function budgetCollapseAllHtml(){
  var all = allBudgetGroupsCollapsed();
  return '<button type="button" class="btn btn-ghost btn-sm" id="budgetCollapseAllBtn">' +
    (all ? "Expand all" : "Collapse all") + '</button>';
}
export function renderBudgetGroupByToggle(){
  var el = document.getElementById("budgetGroupBy");
  if(!el) return;
  // Hidden until there's a second way to slice the money: with no categories defined, "Group by"
  // offers a choice between one real grouping and a single "Uncategorised" pile.
  var anyCategorised = state.shared.some(function(item){ return (item.category || "").trim(); });
  // Expand/Collapse all applies whether or not there's a second axis to group by, so this row is
  // shown whenever there is more than one card to act on — the Group-by half is what's conditional,
  // not the row itself.
  var groupCount = computeSharedGroups().length;
  el.hidden = !anyCategorised && groupCount < 2;
  if(el.hidden) return;
  el.innerHTML = (anyCategorised
    ? '<span class="groupby-label">Group by</span>' +
      [["type", "Type"], ["category", "Category"]].map(function(pair){
        var on = (state.budgetGroupBy === "category" ? "category" : "type") === pair[0];
        return '<button type="button" class="groupby-option' + (on ? " is-selected" : "") + '"' +
          ' data-budget-groupby="' + pair[0] + '" aria-pressed="' + (on ? "true" : "false") + '">' + pair[1] + '</button>';
      }).join("")
    : "") +
    (groupCount > 1 ? '<span class="groupby-break" aria-hidden="true"></span>' + budgetCollapseAllHtml() : "");
}
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
  return options + loggableBudgetLineItems().map(function(item){
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
    var item = budgetLineItems().find(function(i){ return i.id === t.linkedExpenseId; });
    if(item && item.account) return item.account;
  }
  return "";
}
// A transaction's own category wins if set; otherwise it inherits from its linked budget line —
// the same override-then-fallback shape as transactionAccount() above. Categorising a budget line
// therefore retroactively categorises everything ever logged against it, while a one-off with no
// line to inherit from can still carry its own.
export function transactionCategory(t){
  var direct = (t.category || "").trim();
  if(direct) return direct;
  if(t.linkedExpenseId){
    var linkedItem = budgetLineItems().find(function(i){ return i.id === t.linkedExpenseId; });
    if(linkedItem && (linkedItem.category || "").trim()) return linkedItem.category.trim();
  }
  return "";
}
// Summary sub-line for a collapsed row — date, what it's linked to (or "One-off"), and its
// resolved account, so the closed row already answers "what is this" without expanding it.
// Exported so app.js's live-input handlers can re-derive it to patch an open row's header text
// (see the tx-what/tx-link/tx-account cases) instead of waiting for a full renderTransactions().
export function transactionSummaryText(t){
  var linked = t.linkedExpenseId && budgetLineItems().find(function(i){ return i.id === t.linkedExpenseId; });
  var acct = transactionAccount(t);
  var bits = [t.date || "—", linked ? linked.what : "One-off"];
  if(acct) bits.push(acct);
  return bits.map(escapeAttr).join(" · ");
}
// The Description placeholder doubles as the "you don't have to fill this in" hint: for a linked
// transaction it shows the name it will be listed under if left blank, so the field reads as a
// refinement of an already-complete entry rather than a blank required box.
function transactionDescriptionPlaceholder(t){
  var linked = t.linkedExpenseId && budgetLineItems().find(function(i){ return i.id === t.linkedExpenseId; });
  return linked && linked.what ? linked.what : "Optional note";
}
function transactionRowHtml(t, idx){
  var dateInput = '<input type="date" class="tx-date" data-tx-index="' + idx + '" value="' + escapeAttr(t.date || "") + '" aria-label="Date">';
  var whatInput = '<input type="text" class="tx-what" data-tx-index="' + idx + '" value="' + escapeAttr(t.what || "") + '" placeholder="' + escapeAttr(transactionDescriptionPlaceholder(t)) + '" aria-label="Description (optional)" title="Optional — only worth filling in when the budget line\'s own name doesn\'t say enough (e.g. what the Miscellaneous spend actually was)">';
  // No min="0": a refund is a real transaction with a negative amount, and every sum downstream
  // already reads `s + (Number(t.amount) || 0)` rather than clamping.
  var amountInput = '<input type="number" step="0.01" class="tx-amount" data-tx-index="' + idx + '" value="' + t.amount + '" aria-label="Amount (negative for a refund)">';
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
  var rows = irregularItems.map(function(item){
    // Each line carries its own twelve months (see reserveYearWindowFor): a travel budget usually
    // means the calendar year, an annual maintenance allowance often means the financial one, and
    // a standing allowance is best read as "the last twelve months" rather than one that resets to
    // zero every 1 January. So the window is resolved per row, not once for the section.
    var win = reserveYearWindowFor(item);
    var actualYear = Math.round((sumTransactionsByExpense(transactionsInRange(state.transactions, win.start, win.end))[item.id] || 0) * 100) / 100;
    var plannedYear = Math.round(periodsOf(item.amount, item.freq).yearly * 100) / 100;
    var delta = actualYear - plannedYear;
    var color = delta > 0.5 ? "var(--bad)" : "";
    var pct = plannedYear > 0 ? Math.min(100, (actualYear / plannedYear) * 100) : (actualYear > 0 ? 100 : 0);
    var remaining = plannedYear - actualYear;
    // The period now lives in the "planned <label>" half, so this half doesn't repeat it.
    var remainingLabel = remaining >= 0 ? (fmtCurrency0.format(remaining) + " left") : (fmtCurrency0.format(-remaining) + " over budget");
    return '<div class="budget-row">' +
      '<div class="acct-row"><span class="acct-name" title="' + escapeAttr(item.what) + '">' + escapeAttr(item.what) + '</span>' +
        '<span style="font-size:11px;color:var(--ink-soft)">' + fmtCurrency0.format(actualYear) + ' actual / ' + fmtCurrency0.format(plannedYear) + ' planned ' + escapeAttr(win.label) + ' — ' + remainingLabel + '</span>' +
        '<span class="acct-amt"' + (color ? ' style="color:' + color + '"' : '') + '>' + (delta >= 0 ? "+" : "−") + fmtCurrency0.format(Math.abs(delta)) + '</span></div>' +
      '<div class="budget-bar-track"><div class="budget-bar-fill' + (delta > 0.5 ? " over" : "") + '" style="width:' + pct + '%"></div></div>' +
    '</div>';
  }).join("");
  // No period in the heading any more — rows can each be on a different one, and a heading that
  // named only one of them would be wrong for the rest.
  return '<div style="margin-top:16px"><div class="fire-stat-row" style="margin-bottom:2px"><span>Irregular / reserve budgets</span></div>' +
    '<p class="ledger-note" style="margin:0 0 8px">Marked "no fixed timing" — compared against a full year\'s budget instead of this month\'s, since these aren\'t expected on any particular schedule. Each line names the twelve months it\'s measured over; change that with "Budget year" on the row.</p>' +
    rows + '</div>';
}
// What these budget lines actually put on this month's bills: every monthly (and sub-monthly) line
// plus only those less-than-monthly lines whose cycle opens this month. This is the denominator a
// single month's real spend can honestly be judged against — the smoothed sum over-states quiet
// months and under-states the month a quarterly bill lands, which is what made an on-plan payment
// read as a budget miss. It does mean the headline moves month to month, which is the point: real
// bills do.
function billedThisMonth(items){
  return items.reduce(function(sum, item){
    var cycle = budgetCycleFor(item, state.transactions);
    return cycle.dueThisMonth ? sum + cycle.target : sum;
  }, 0);
}
export function renderActualVsPlannedPanel(){
  renderExpenseReviewButton();
  renderSpendCategoryChart();
  renderSpendingTrends();
  renderYearSpending();
  var el = document.getElementById("actualVsPlannedPanel");
  if(!el) return;
  // Only lines you can log against. A computed line always reads "$0 actual of $X planned" —
  // nobody logs a mortgage direct debit — and this panel exists to answer "how am I tracking",
  // which a permanent, unfixable miss the size of a loan repayment actively obscures. Same
  // reasoning as the overdue queue; the Budget tab's own total still counts them, because there
  // the question is what the month costs, not what's been recorded.
  var budgetItems = loggableBudgetLineItems();
  var regularItems = budgetItems.filter(function(item){ return !item.irregular; });
  var irregularItems = budgetItems.filter(function(item){ return item.irregular; });
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
  // Every budget line, not just state.shared: a household whose only lines are housing and an
  // investment property's costs has plenty to report on, and used to be told to go add one.
  if(!budgetItems.length && !allMonthTxns.length){
    el.innerHTML = '<p class="ledger-note" style="margin:0">Add a budget line on the Budget tab, then log spend against it to see where the month is going.</p>';
    return;
  }
  // With shared expenses defined but nothing logged yet this month, the full row-by-row
  // breakdown below is pure noise — every single row would repeat the Shared Expenses list above
  // at "$0 actual / $X planned", telling you nothing you don't already know from that list. Skip
  // straight to a compact nudge instead. Credit statement cycles still get their own section
  // regardless — a card's current bill runs on its own cycle dates, not the calendar month, so it
  // can be genuinely nonzero even with nothing logged today.
  if(!monthTxns.length){
    var plannedTotalEmpty = Math.round(billedThisMonth(regularItems) * 100) / 100;
    el.innerHTML =
      '<p class="ledger-note" style="margin:0 0 12px">Nothing logged yet this month — ' + fmtCurrency0.format(plannedTotalEmpty) + ' is billed this month. Tap <b>+ Log spend</b> above and this fills in with where the month is actually going.</p>' +
      creditStatementCyclesHtml() + irregularSection;
    return;
  }
  // Rounded to cents before any comparison/formatting below — periodsOf()'s weekly-then-back
  // conversion leaves a float epsilon (e.g. 2.4900000000000007) that can land a genuinely-exact
  // $0.50 delta a hair under the ">0.5" thresholds and, worse, make the displayed whole-dollar
  // "over"/"left" figure not match the difference between the whole-dollar actual/planned figures
  // shown right next to it (e.g. "$3 actual / $2 planned — $0 over").
  var plannedTotal = Math.round(billedThisMonth(regularItems) * 100) / 100;
  // The smoothed average is still the right long-run number (it's what drives cash flow and
  // projections), so it stays on screen as a reference — just no longer as the denominator a
  // single month's real spend gets judged against.
  var smoothedMonthly = Math.round(sumField(regularItems, "monthly") * 100) / 100;
  var actualTotal = Math.round(monthTxns.reduce(function(s, t){ return s + (Number(t.amount) || 0); }, 0) * 100) / 100;
  var overallDelta = actualTotal - plannedTotal;
  // Framed from a spending point of view: spending less than planned is "good" (green), more is
  // "bad" (red) — the inverse of the up/down convention used for asset values elsewhere in the
  // app, where "up" is always good. Both read correctly for what they each represent.
  var overallColor = overallDelta > 0.5 ? "var(--bad)" : (overallDelta < -0.5 ? "var(--good)" : "");
  var overallPct = plannedTotal > 0 ? Math.min(100, (actualTotal / plannedTotal) * 100) : (actualTotal > 0 ? 100 : 0);
  // Only lines something was actually logged against this month. Every regular line's planned
  // figure and its progress against it now lives on the line's own row in the Budget tab (see
  // budgetRowProgressHtml), so listing all of them again here produced a second, longer copy of
  // that list where all but a handful of rows read "$0 actual / $X planned" — telling you nothing
  // the Budget tab doesn't already say, and burying the few rows that did move. What's left is
  // the one thing the Budget tab can't answer: where this month's money actually went.
  var spentItems = regularItems.filter(function(item){ return Math.round((byExpense[item.id] || 0) * 100) / 100 !== 0; });
  var rows = spentItems.map(function(item){
    // Same cycle-aware comparison as the budget rows: a quarterly line's planned figure here is
    // the whole bill over its own window, not a third of it against one month.
    var rowCycle = budgetCycleFor(item, state.transactions);
    var planned = Math.round(rowCycle.target * 100) / 100;
    var actual = Math.round(spentInCycle(item, rowCycle) * 100) / 100;
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
        '<span style="font-size:11px;color:var(--ink-soft)">' + fmtCurrency0.format(actual) + ' actual / ' + fmtCurrency0.format(planned) + ' planned ' + escapeAttr(rowCycle.label) + ' — ' + remainingLabel + '</span>' +
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
    '<div class="fire-stat-row"><span>This month — spent vs. billed</span><b' + (overallColor ? ' style="color:' + overallColor + '"' : '') + '>' + fmtCurrency0.format(actualTotal) + ' / ' + fmtCurrency0.format(plannedTotal) + '</b></div>' +
    '<div class="fire-bar-track"><div class="fire-bar-fill' + (overallDelta > 0.5 ? " over" : "") + '" style="width:' + overallPct + '%"></div></div>' +
    '<p class="fire-note" style="margin:2px 0 12px">' + (overallDelta >= 0 ? "+" : "−") + fmtCurrency0.format(Math.abs(overallDelta)) + (overallDelta > 0.5 ? " over what's billed this month." : overallDelta < -0.5 ? " under what's billed this month." : " right on what's billed this month.") + ' Smoothed average is ' + fmtCurrency0.format(smoothedMonthly) + '/mo.</p>' +
    '<div class="ledger-note" style="margin:0 0 6px">Where it went — tap a line for the individual transactions.</div>' +
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
// ---------------- Categories: the "where does it go" rollup ----------------
// A second, orthogonal axis to `classification` (Needs/Wants/Savings). Classification answers
// "is this discretionary?" and groups the Budget list; a category answers "where does it go?" and
// only ever *reports* — it never regroups the list, because two competing groupings on one page
// would be harder to read than either alone.
//
// Stored as the name on the line, not an id, matching how `account` works: renaming retargets
// every referencing row (renameCategoryEverywhere below), which keeps CSV exports and hand-edited
// backups readable rather than full of opaque ids.
function categoryRowHtml(name, idx){
  // Counted across every budget line, not just state.shared — housing and investment-property
  // costs carry categories too, and a manager that reported "unused" for a category three of them
  // sit on would be actively misleading about what deleting it costs.
  var usedBy = budgetLineItems().filter(function(item){ return (item.category || "") === name; }).length;
  var nameInput = '<input type="text" class="cat-mgmt-name" data-cat-index="' + idx + '" value="' + escapeAttr(name) + '" placeholder="Category name" aria-label="Category name">';
  var usage = '<span class="cat-mgmt-count">' + (usedBy ? usedBy + (usedBy === 1 ? " line" : " lines") : "unused") + '</span>';
  var delBtn = '<button type="button" class="btn btn-ghost btn-sm row-del" data-cat-del="' + idx + '" aria-label="Delete category">✕</button>';
  return '<div class="m-row acct-mgmt-row" data-cat-index="' + idx + '">' +
    '<div class="m-row-summary" style="cursor:default;flex-wrap:wrap;gap:8px">' + nameInput + usage + delBtn + '</div>' +
  '</div>';
}
export function renderCategories(){
  var container = document.getElementById("categoriesTable");
  if(!container) return;
  if(!state.categories.length){
    container.innerHTML = '<p class="ledger-note" style="margin:0">No categories yet — add one below to start grouping budget lines for the spending charts.</p>';
    return;
  }
  container.innerHTML = '<div class="m-rows">' + state.categories.map(categoryRowHtml).join("") + '</div>';
}
export function addCategory(){
  state.categories.push("");
  renderCategories();
  persist();
}
// Renaming retargets every budget line pointing at the old name, so a rename is a rename rather
// than a silent orphaning — same contract as renameAccountEverywhere below.
export function renameCategoryEverywhere(oldName, newName){
  if(!oldName || oldName === newName) return;
  // "Everywhere" means every array a budget line can live in — including scenarios you aren't
  // currently in. A rename that skipped them would leave the old name behind on rows the Budget
  // tab shows the moment you switch scenario, and migrateState's seed-from-usage pass would then
  // helpfully re-add the category you just renamed away from.
  everyCategorisableArray().forEach(function(items){
    items.forEach(function(item){ if((item.category || "") === oldName) item.category = newName; });
  });
}
// Every array whose rows carry a category, across all scenarios and properties — deliberately
// wider than budgetLineItems() (which is only what the Budget tab currently lists) because
// renaming and deleting a category have to reach rows that aren't on screen right now.
function everyCategorisableArray(){
  var arrays = [state.shared];
  Object.keys(state.home || {}).forEach(function(name){ if(Array.isArray(state.home[name])) arrays.push(state.home[name]); });
  (state.properties || []).forEach(function(p){ if(Array.isArray(p.expenses)) arrays.push(p.expenses); });
  return arrays;
}
// Deleting a category never deletes the budget lines using it — they fall back to uncategorised,
// which the charts report honestly as its own slice. Losing a label should not lose data.
export function deleteCategory(idx){
  var removed = state.categories[idx];
  if(removed == null) return;
  var orphaned = everyCategorisableArray().reduce(function(acc, items){
    return acc.concat(items.filter(function(item){ return (item.category || "") === removed; }));
  }, []);
  state.categories.splice(idx, 1);
  orphaned.forEach(function(item){ item.category = ""; });
  renderCategories();
  persist();
  showUndoToast('Deleted "' + (removed || "category") + '"' + (orphaned.length ? " — " + orphaned.length + " line" + (orphaned.length === 1 ? "" : "s") + " uncategorised" : ""), function(){
    state.categories.splice(Math.min(idx, state.categories.length), 0, removed);
    orphaned.forEach(function(item){ item.category = removed; });
    renderCategories();
    persist();
  });
}
// Every category that currently carries something, plus an "Uncategorised" bucket when anything
// is left over. valueFor is what to total per budget line — the planned monthly figure on the
// Budget tab, this month's real spend on Spending — so one function serves both charts.
export function categoryTotals(items, valueFor){
  var byName = {};
  var order = [];
  items.forEach(function(item){
    var name = (item.category || "").trim() || UNCATEGORISED;
    var value = valueFor(item);
    if(!value) return;
    if(byName[name] == null){ byName[name] = 0; order.push(name); }
    byName[name] += value;
  });
  // Biggest first: a spending chart is read to find where the money went, and that answer should
  // be the first thing in the legend rather than something to hunt for.
  return order.map(function(name){ return { key: name, monthly: byName[name] }; })
    .sort(function(a, b){ return b.monthly - a.monthly; });
}
// The by-category chart, used twice: planned spend on the Budget tab, real spend this month on
// Spending. Same 100%-stacked bar + legend as sharedCompositionBarHtml above, but coloured from
// the cycling series palette rather than the fixed Needs/Wants/Savings swatches — a category set
// is user-defined and open-ended, so its colours have to come from position rather than name.
//
// Nothing is drawn below two segments: a single full-width bar labelled with the only category
// in play says nothing the total above it doesn't already say.
// barless renders the legend alone. The Budget tab uses it because the composition bar directly
// below already splits the same money by Needs/Wants — two stacked 100% bars, both labelled in
// percentages, compete for the same glance and neither wins. What's genuinely new there is the
// number ("Car $280/mo" across four separate lines), not another bar, so Budget gets the totals
// and Spending — where "where did it actually go" is the whole question — gets the full chart.
export function categoryChartHtml(groups, unit, opts){
  opts = opts || {};
  if(groups.length < 2) return "";
  // A category can net negative now that refunds are real transactions — return more than you
  // bought in a month and Clothing is -$40. A proportional bar has no way to draw that: the
  // segment inverts to a negative width and, because the negative shrinks the denominator, every
  // other segment's percentage climbs past its true share and the bar overflows its track. So the
  // bar is built from the positive categories only, and the negatives stay in the legend where a
  // credit reads correctly as a credit.
  var positives = groups.filter(function(g){ return g.monthly > 0; });
  var total = positives.reduce(function(sum, g){ return sum + g.monthly; }, 0);
  if(total <= 0) return "";
  var colorOf = {};
  groups.forEach(function(g, i){ colorOf[g.key] = i % 8; });
  var segs = positives.map(function(g){
    var pct = g.monthly / total;
    return '<div class="rule-seg cat-seg series-color-' + colorOf[g.key] + '" style="width:' + (pct * 100) + '%"' +
      ' title="' + escapeAttr(g.key) + ': ' + fmtCurrency0.format(g.monthly) + unit + ' (' + fmtPercent1.format(pct) + ')">' +
      (pct > 0.12 ? fmtPercent1.format(pct) : "") + '</div>';
  }).join("");
  var legend = groups.map(function(g){
    return '<div class="rule-legend-item' + (g.monthly < 0 ? " is-credit" : "") + '"><span class="rule-swatch cat-seg series-color-' + colorOf[g.key] + '"></span>' +
      escapeAttr(g.key) + ' <b>' + fmtCurrency0.format(g.monthly) + '</b>' +
      (g.monthly < 0 ? ' <span class="cat-credit-tag" title="More came back than went out in this category — refunds outweighed spending">net refund</span>' : "") + '</div>';
  }).join("");
  var bar = opts.barless ? "" : '<div class="rule-bar">' + segs + '</div>';
  return '<div class="cat-chart' + (opts.barless ? " cat-chart-compact" : "") + '">' + bar + '<div class="rule-legend">' + legend + '</div></div>';
}
// Real spend this month per category, resolved through each transaction's linked budget line —
// so categorising a line retroactively categorises everything ever logged against it, and a
// one-off with no link falls into its own bucket rather than being dropped.
// Every budget line the Budget tab lists — shared plus the active scenario's housing. Exported so
// the actual-vs-planned panel totals exactly what the list shows, rather than the two disagreeing
// about whether rent counts.
export function budgetLineItems(){
  return budgetLineSources().reduce(function(acc, source){ return acc.concat(source.items); }, []);
}
// The subset you can actually log spend against. A computed line (a synced home-loan repayment, a
// property manager fee worked out from the rent) is a real cost and stays in the list and in the
// totals — but its amount isn't yours to set and there's no bill to fall behind on paying, so
// offering it as a quick-log chip or queuing it under "Catch up on overdue" is asking for a
// confirmation of something the app already knows. Same rows exportExpensesCsv() skips, same
// reason.
export function loggableBudgetLineItems(){
  return budgetLineItems().filter(function(item){ return !item.computed; });
}
export function renderSpendCategoryChart(){
  var el = document.getElementById("spendCategoryChart");
  if(!el) return;
  var monthTxns = transactionsInMonth(state.transactions);
  var byCategory = {};
  var order = [];
  monthTxns.forEach(function(t){
    var name = transactionCategory(t) || UNCATEGORISED;
    var value = Math.round((Number(t.amount) || 0) * 100) / 100;
    if(!value) return;
    if(byCategory[name] == null){ byCategory[name] = 0; order.push(name); }
    byCategory[name] += value;
  });
  var groups = order.map(function(name){ return { key: name, monthly: byCategory[name] }; })
    .sort(function(a, b){ return b.monthly - a.monthly; });
  var html = categoryChartHtml(groups, "");
  el.innerHTML = html ? '<div class="cat-chart-title">Spent by category this month</div>' + html : "";
  el.hidden = !html;
}
// ---------------- Spending over time ----------------
//
// The one view in this app that compares you against *yourself* rather than against a number you
// typed in. Everything else here answers "am I over budget this month"; this answers "is this
// getting worse", which is the question daily logging is actually paying for.
//
// Built as bar strips rather than the wide category-by-month grid the plan called for. On a 390px
// screen a six-column numeric table is a horizontal scroll you have to work at, and the shape of
// a category over six months is exactly the sort of thing a chart says instantly and a row of
// figures doesn't. The figures are still there, one <details> away, for anyone who wants them.

// How many months of history the strip shows, and how many prior months the average is taken
// over. Six reads well at 390px (six bars, six short labels) and gives the 3-month average three
// clear months of runway behind it.
var TRENDS_MONTHS = 6;
var TRENDS_LOOKBACK = 3;
// Below this, a category's window total isn't worth a row: a $4 line that doubled is a true
// statement and a useless one. Deliberately on the six-month total, not on one month, so a
// genuinely lumpy category (car rego once a year) still keeps its place.
var TRENDS_MIN_SPEND = 50;
// Below this many logged months, the panel shows the bars and the numbers but makes no comparison
// claims — no deltas, no "up N months running".
//
// The reason is a limit no amount of arithmetic gets around: **the app cannot tell "spent more"
// from "logged more thoroughly."** On the reference data August was logged mostly in its last
// week and September mostly in its first, so even a same-days-of-the-month comparison reported
// "515% more" — a statement about logging habits wearing the clothes of a statement about
// spending. Two points can't distinguish a trend from a difference; three can start to. It also
// matches what this panel exists to be able to say: "groceries have climbed three months running".
var TRENDS_MIN_MONTHS_FOR_COMPARISON = 3;

// "11th", "22nd", "3rd" — used in the like-for-like wording ("$1,500 by the 11th"), which is the
// one phrase that tells the reader the comparison isn't against whole months.
function ordinal(n){
  var rem100 = n % 100;
  if(rem100 >= 11 && rem100 <= 13) return n + "th";
  var suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10];
  return n + (suffix || "th");
}
function trendDeltaHtml(trend, opts){
  opts = opts || {};
  // Nothing spent this month. Distinguished from "new" because they look identical in the data
  // (both have a null trend) and mean opposite things: a category you've just started spending
  // in, versus one that's gone quiet — car rego, six months ago, and nothing since.
  if(opts.current === 0){
    return '<span class="trend-delta flat" title="Nothing logged against this category this month">none yet</span>';
  }
  if(!trend) return '<span class="trend-delta none" title="Not enough history yet to compare this against — it needs at least one earlier month with spend in it">new</span>';
  var cls = trend.direction === "up" ? "up" : (trend.direction === "down" ? "down" : "flat");
  var arrow = trend.direction === "up" ? "▲" : (trend.direction === "down" ? "▼" : "–");
  var label = trend.direction === "flat" ? "level" : fmtPercent0.format(Math.abs(trend.deltaPct));
  // "up" is bad here and "down" is good — this is spending, not net worth. Worth stating, since
  // every other up/down pair in this app (asset trends, capital gain) means the opposite.
  var through = trend.complete ? "" : " by the " + ordinal(trend.throughDay);
  var title = "Spent " + fmtCurrency0.format(trend.current) + through +
    (trend.lookback === 1
      ? " against last month's " + fmtCurrency0.format(trend.average)
      : " against a " + fmtCurrency0.format(trend.average) + " average over the previous " + trend.lookback + " months") +
    through +
    (trend.complete ? "" : " — same days of the month on both sides, so a month that isn't over yet still compares fairly");
  return '<span class="trend-delta ' + cls + '" title="' + escapeAttr(title) + '">' + arrow + " " + escapeAttr(label) + '</span>' +
    (opts.showBase && trend ? '<span class="trend-base">vs ' + fmtCurrency0.format(trend.average) + ' avg</span>' : "");
}

// One category's six months, as bars scaled to that category's own biggest month. Scaled per-row
// rather than across the whole panel on purpose: this strip is there to show a *shape*, and
// against a household's largest category every other row would be a flat line of nubs.
function trendSparkHtml(row, months, monthProgress){
  var max = Math.max.apply(null, row.values.concat([0]));
  var lastIdx = months.length - 1;
  return '<div class="trend-spark" role="img" aria-label="' + escapeAttr(row.category + " by month: " +
      months.map(function(m, i){ return monthKeyLabel(m, months[lastIdx]) + " " + fmtCurrency0.format(row.values[i]); }).join(", ")) + '">' +
    months.map(function(m, i){
      var value = row.values[i];
      // A zero month still gets a visible sliver, so the bar row reads as six months throughout
      // rather than appearing to start late.
      var pct = max > 0 ? Math.max(value > 0 ? 6 : 2, (value / max) * 100) : 2;
      var partial = i === lastIdx && monthProgress < 1;
      return '<div class="trend-bar' + (i === lastIdx ? " current" : "") + (partial ? " partial" : "") + '"' +
          ' title="' + escapeAttr(monthKeyLabel(m, months[lastIdx]) + " · " + fmtCurrency0.format(value) +
            (partial ? " so far" : "")) + '">' +
        '<div class="trend-bar-track"><div class="trend-bar-fill" style="height:' + pct + '%"></div></div>' +
        '<span class="trend-bar-label">' + escapeAttr(monthKeyLabel(m, months[lastIdx])) + '</span>' +
      '</div>';
    }).join("") +
  '</div>';
}

// The "climbing three months running" callouts — the single sentence this whole section exists to
// be able to say. Only streaks of 2+ qualify: one month up on the last is noise, and saying so
// every month would train people to ignore the line.
function trendAlertsHtml(rows){
  var alerts = [];
  rows.forEach(function(r){
    if(r.risingStreak >= 2){
      alerts.push({ cls: "up", text: r.category + " up " + r.risingStreak + " months running" });
    } else if(r.fallingStreak >= 2){
      alerts.push({ cls: "down", text: r.category + " down " + r.fallingStreak + " months running" });
    }
  });
  if(!alerts.length) return "";
  return '<div class="trend-alerts">' + alerts.map(function(a){
    return '<span class="trend-alert ' + a.cls + '">' + escapeAttr(a.text) + '</span>';
  }).join("") + '</div>';
}

function trendNumbersTableHtml(view){
  var lastIdx = view.months.length - 1;
  var head = "<tr><th>Category</th>" + view.months.map(function(m){
    return "<th>" + escapeAttr(monthKeyLabel(m, view.months[lastIdx])) + "</th>";
  }).join("") + "</tr>";
  var body = view.rows.map(function(r){
    return "<tr><td>" + escapeAttr(r.category) + "</td>" + r.values.map(function(v){
      return "<td>" + fmtCurrency0.format(v) + "</td>";
    }).join("") + "</tr>";
  }).join("");
  var totals = "<tr class=\"trend-total-row\"><td>Total</td>" + view.totals.map(function(v){
    return "<td>" + fmtCurrency0.format(v) + "</td>";
  }).join("") + "</tr>";
  return '<div class="table-scroll"><table class="milestone-table trend-table"><thead>' + head +
    '</thead><tbody>' + body + totals + '</tbody></table></div>';
}

// This panel's gate is a coverage gate, not a calendar one — it needs months that were genuinely
// being logged, not months that have merely elapsed. Which means the fastest way past it isn't
// waiting, it's importing: one bank export of last quarter satisfies it today. Worth saying here,
// because the gate's own wording ("comparisons start at 3 months") reads like a waiting period.
function trendsImportHintText(){
  return ' A bank CSV covering those months gets you there today — <b>Import from your bank</b>, above.';
}
function trendsImportHintHtml(){
  return '<p class="ledger-note" style="margin:8px 0 0">Already have the history at your bank? <b>Import from your bank</b> above takes a statement straight in, and remembers where each shop goes for next time.</p>';
}
export function renderSpendingTrends(){
  var el = document.getElementById("spendingTrendsPanel");
  if(!el) return;
  var view = spendingTrends(state.transactions, {
    months: TRENDS_MONTHS,
    lookback: TRENDS_LOOKBACK,
    minSpend: TRENDS_MIN_SPEND,
    categoryFor: transactionCategory,
    uncategorisedLabel: UNCATEGORISED
  });
  // One logged month is a list, not a trend. Say what's missing rather than drawing a chart of a
  // single bar with a "new" pill against every row. view.monthsCovered is already trimmed to the
  // months that were genuinely being logged, so this also catches "six months of history, five of
  // them empty" — which is what every new user has.
  if(view.monthsCovered < 2){
    el.innerHTML = '<p class="ledger-note" style="margin:0">Once you have spending logged in two different months, this is where you\'ll see which categories are climbing and which are settling down.' +
      (view.monthsCovered === 1 ? " One month in — keep logging." : "") + '</p>' + trendsImportHintHtml();
    return;
  }
  var lastIdx = view.months.length - 1;
  // "your $X average over the previous 3 months" is wrong when there are only two months of
  // history — there the honest phrasing is "last month", and saying so is what stops the panel
  // from implying a depth of history it doesn't have.
  // Whether this panel is allowed to make comparison claims at all (see the constant's comment).
  var comparing = view.monthsCovered >= TRENDS_MIN_MONTHS_FOR_COMPARISON;
  var sameDays = view.complete ? "" : " by the " + ordinal(view.throughDay);
  var spentSoFar = view.mtdTotals.length ? view.mtdTotals[view.mtdTotals.length - 1] : 0;
  var baselinePhrase = view.lookback === 1
    ? "the " + fmtCurrency0.format(view.totalsTrend ? view.totalsTrend.average : 0) + " you'd spent by then last month"
    : "the " + fmtCurrency0.format(view.totalsTrend ? view.totalsTrend.average : 0) + " you'd typically spent by then over the previous " + view.lookback + " months";
  var completeBaselinePhrase = view.lookback === 1
    ? "last month's " + fmtCurrency0.format(view.totalsTrend ? view.totalsTrend.average : 0)
    : "your " + fmtCurrency0.format(view.totalsTrend ? view.totalsTrend.average : 0) + " average over the previous " + view.lookback + " months";
  var headline = (comparing && view.totalsTrend)
    ? "You've spent <b>" + fmtCurrency0.format(view.totalsTrend.current) + "</b> this month" + sameDays + ", " +
      (view.totalsTrend.direction === "flat"
        ? "level with "
        : "<b class=\"trend-word " + view.totalsTrend.direction + "\">" + fmtPercent0.format(Math.abs(view.totalsTrend.deltaPct)) + " " +
          (view.totalsTrend.direction === "up" ? "more" : "less") + "</b> than ") +
      (view.complete ? completeBaselinePhrase : baselinePhrase) + "."
    : "You've spent <b>" + fmtCurrency0.format(spentSoFar) + "</b> this month" + sameDays + ".";
  // Said once, plainly, instead of quietly omitting the deltas and leaving the reader to wonder.
  var earlyDaysNote = comparing ? "" :
    '<p class="ledger-note trend-partial-note" style="margin:0 0 10px">' + view.monthsCovered + ' months logged so far. The bars below show what you\'ve recorded; comparisons start at ' +
    TRENDS_MIN_MONTHS_FOR_COMPARISON + ' months, because until then there\'s no way to tell a month you spent more from a month you simply logged more of.' +
    trendsImportHintText() + '</p>';
  // Said plainly whenever the window is shorter than asked for. Without this the panel shows two
  // bars where it normally shows six and leaves the user to work out why.
  var coverageNote = view.monthsCovered < view.monthsRequested
    ? '<p class="ledger-note trend-partial-note" style="margin:0 0 10px">Showing ' + view.monthsCovered + ' months — that\'s as far back as your logging goes. It\'ll fill out to ' + view.monthsRequested + ' as you keep going.</p>'
    : "";

  var rowsHtml = view.rows.map(function(r){
    return '<div class="trend-row">' +
      '<div class="trend-row-head">' +
        '<span class="trend-row-name">' + escapeAttr(r.category) + '</span>' +
        // Month-to-date, not the whole-month figure, whenever the month is still running: this
        // number and the delta beside it have to be the same number, and they'd differ for anyone
        // who has logged a bill dated later this month.
        '<span class="trend-row-amt" title="' + escapeAttr(view.complete ? "Spent this month" : "Spent so far this month — the figure the comparison beside it uses") + '">' +
          fmtCurrency0.format(view.complete ? r.values[lastIdx] : r.mtdValues[lastIdx]) + '</span>' +
        (comparing ? trendDeltaHtml(r.trend, { current: view.complete ? r.values[lastIdx] : r.mtdValues[lastIdx] }) : "") +
      '</div>' +
      trendSparkHtml(r, view.months, view.monthProgress) +
    '</div>';
  }).join("");

  el.innerHTML =
    '<p class="trend-headline">' + headline + '</p>' +
    (comparing ? trendAlertsHtml(view.rows) : "") +
    earlyDaysNote +
    coverageNote +
    (view.complete ? "" : '<p class="ledger-note trend-partial-note" style="margin:0 0 10px">' + view.throughDay + ' of ' + view.daysInMonth + ' days in, so this month\'s bar is still filling. Every comparison above counts only the same days of earlier months, never a whole one against a part-finished one.</p>') +
    (rowsHtml ? '<div class="trend-rows">' + rowsHtml + '</div>'
              : '<p class="ledger-note" style="margin:0">Nothing logged above ' + fmtCurrency0.format(TRENDS_MIN_SPEND) + ' over the last ' + TRENDS_MONTHS + ' months yet.</p>') +
    (rowsHtml ? '<details class="trend-numbers"><summary>Show the numbers</summary>' + trendNumbersTableHtml(view) + '</details>' : "");
}

// ---------------- This year so far ----------------
//
// The one period view that isn't "this month" or "this cycle". A tax return, a yearly review and
// an insurance renewal are all asked in years, and until state.yearBasis existed the app had no
// household year to answer them with — only per-reserve-line ones.
//
// Deliberately year-to-date rather than the whole year: on 11 September an FY is 20% done, and a
// figure that silently covers ten weeks while reading like a year is the same failure mode the
// spending-trends panel exists to avoid. Every figure here is labelled with how much of the year
// it covers, and nothing is ever scaled up to a full year.
export function renderYearSpending(){
  var panel = document.getElementById("yearSpendPanel");
  var labelEl = document.getElementById("yearSpendLabel");
  var win = householdYearToDate();
  if(labelEl) labelEl.textContent = win.displayLabel;
  if(!panel) return;

  var txns = transactionsInRange(state.transactions, win.start, win.end);
  if(!txns.length){
    panel.innerHTML = '<p class="ledger-note" style="margin:0">Nothing logged in ' + escapeAttr(win.label) +
      ' yet. Spending you log on this tab shows up here, grouped by category.</p>';
    return;
  }
  var byCategory = {};
  var order = [];
  var total = 0;
  txns.forEach(function(t){
    var amount = Number(t.amount) || 0;
    if(!amount) return;
    var name = transactionCategory(t) || UNCATEGORISED;
    if(byCategory[name] == null){ byCategory[name] = 0; order.push(name); }
    byCategory[name] += amount;
    total += amount;
  });
  var groups = order.map(function(name){ return { key: name, monthly: byCategory[name] }; })
    .sort(function(a, b){ return b.monthly - a.monthly; });

  var progress = householdYearProgress();
  var headline = '<p class="trend-headline"><b>' + fmtCurrency0.format(total) + '</b> logged in ' +
    escapeAttr(win.label) + ', across ' + txns.length + ' transaction' + (txns.length === 1 ? "" : "s") +
    (win.complete ? "." : " — " + fmtPercent0.format(progress) + " of the way through the year.") + '</p>';

  var rows = groups.map(function(g){
    var share = total > 0 ? g.monthly / total : 0;
    return '<div class="year-cat-row">' +
      '<span class="year-cat-name">' + escapeAttr(g.key) + '</span>' +
      '<span class="year-cat-bar"><span class="year-cat-fill" style="width:' + (share * 100) + '%"></span></span>' +
      '<span class="year-cat-amt">' + fmtCurrency0.format(g.monthly) + '</span>' +
      '<span class="year-cat-pct">' + fmtPercent0.format(share) + '</span>' +
    '</div>';
  }).join("");

  panel.innerHTML = headline +
    (categoryChartHtml(groups, "") || "") +
    '<div class="year-cat-rows">' + rows + '</div>';
}

// Which twelve months the household counts as a year — rendered here rather than in app.js because
// the label it writes is the same householdYearToDate() the panel above uses.
export function renderYearBasisPreference(){
  var group = document.getElementById("yearBasisControl");
  var basis = householdYearBasis();
  if(group){
    group.querySelectorAll("[data-year-basis]").forEach(function(btn){
      var on = btn.getAttribute("data-year-basis") === basis;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", String(on));
    });
  }
  var win = householdYearToDate();
  var current = document.getElementById("yearBasisCurrent");
  if(current) current.textContent = win.label;
  var note = document.getElementById("yearBasisNote");
  if(note){
    note.textContent = "Right now that's " + win.label + ": " + win.start + " to " + householdYearWindow().end +
      (win.complete ? "." : ", and you're " + fmtPercent0.format(householdYearProgress()) + " through it.") +
      " Budget lines marked \"no fixed timing\" follow this unless you give one its own budget year.";
  }
}
export function setYearBasis(basis){
  if(HOUSEHOLD_YEAR_BASES.indexOf(basis) === -1) return;
  state.yearBasis = basis;
  persist();
}

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
