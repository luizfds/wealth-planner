// ---------------- A row's editor and the ledgers' edits, wired (v3.206.1, item 237) ----------------
//
// Every list's rows — open one in its editor (a sheet on a phone), type into it, add, delete — and the
// dispatch by section name (getArrayForSection, rerenderTableFor) that finds the list a row belongs to.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order. What it shares with app.js it reaches through `app` (lib/appctx.js).
import { recalcComputedItems, currentScenario } from "../calc/engine.js";
import { periodsOf, resolveSharedAmount, appendHistorySnapshot, transactionDisplayName } from "../calc/ledger.js";
import { sacrificeLabelToMode } from "../constants.js";
import { app } from "../lib/appctx.js";
import { exportIncomeCsv, exportExpensesCsv, exportAssetsCsv, exportPropertyLoansCsv } from "../lib/backup.js";
import { fmtCurrency0, fmtCurrency2, localDateStr, fmtDate } from "../lib/format.js";
import { materializeRowEdit } from "../lib/ledger-table.js";
import { showToast, showUndoToast } from "../lib/toast.js";
import { redraw } from "../lib/views.js";
import { state, persist, genId } from "../state.js";
import { modernAssetRowOpen, renderAssets } from "./assets.js";
import { renderCards, renderDetail } from "./dashboard.js";
import { patchSharedGroupTotals, renderSharedGroups, modernSharedRowOpen, openScenarioOverridePanel, renderTransactions, renderActualVsPlannedPanel, transactionSummaryText, budgetLineItems } from "./expenses.js";
import { personBreakdownHtml, renderIncomeGroups, patchOpenRowBreakdowns, patchIncomeGroupTotals, patchSyntheticIncomeRows, patchIncomeAfterTax, patchIncomeSuperNotes, renderTaxSuper, modernIncomeRowOpen } from "./income.js";
import { renderProjectionOutputs, renderProjectionsWhenSeen } from "./projections.js";
import { modernPropRowOpen, renderPropListModern, renderProperties, patchPropertyCardComputed } from "./properties.js";
import { renderTotals, updatePersonSuggestions } from "./redraw.js";
import { renderHomeListModern, renderHomeBodyTotalsOnly, modernHomeRowOpen } from "./scenarios.js";
import { patchCategoryCharts } from "./settingswiring.js";
import { syncClaimFields } from "./taxwiring.js";

// True for any section the Budget tab lists: state.shared, plus the active scenario's housing
// (see budgetLineSources in expenses.js). A housing row edited there needs the same live totals,
// charts and regrouping a shared row gets — the same scenario's block on the Scenarios page is
// updated alongside it by rerenderTableFor.
// Set when a row's category changes and cleared once the list has been rebuilt — see
// closeActiveModernRowUI for why the rebuild waits.
var budgetRegroupPending = false;

// Only one row can be a modal at a time (openModernRow closes whichever was open before opening
// a new one) — nothing enforced that before, harmless for an inline accordion where several
// could stay expanded at once, but two would visually stack as a modal.
var activeModernRow = null;

// ---------------- Rendering: cards ----------------
function findProperty(id){
  return state.properties.find(function(p){ return p.id === id; });
}
function getArrayForSection(section){
  if(section === "income") return state.income;
  if(section === "shared") return state.shared;
  var mHome = /^home:(.+)$/.exec(section);
  if(mHome) return state.home[mHome[1]];
  var mPropInc = /^propinc:(.+)$/.exec(section);
  if(mPropInc){ var pi = findProperty(mPropInc[1]); return pi ? pi.income : null; }
  var mPropExp = /^propexp:(.+)$/.exec(section);
  if(mPropExp){ var pe = findProperty(mPropExp[1]); return pe ? pe.expenses : null; }
  return null;
}
function rerenderTableFor(section){
  if(section === "income") renderIncomeGroups();
  else if(section === "shared") renderSharedGroups();
  else {
    var mHome = /^home:(.+)$/.exec(section);
    if(mHome){
      var hi = state.scenarios.indexOf(mHome[1]);
      renderHomeListModern(mHome[1], hi);
      // The active scenario's housing is also listed on the Budget tab (see budgetLineSources),
      // so it has two renderers to keep in step — the Scenarios block above and the budget list.
      if(mHome[1] === currentScenario()) renderSharedGroups();
    }
    var mPropInc = /^propinc:(.+)$/.exec(section);
    if(mPropInc){
      var pi = findProperty(mPropInc[1]);
      if(pi) renderPropListModern(pi.id, section, pi.income, false);
    }
    var mPropExp = /^propexp:(.+)$/.exec(section);
    if(mPropExp){
      var pe = findProperty(mPropExp[1]);
      if(pe) renderPropListModern(pe.id, section, pe.expenses, true);
      // Same two-renderer situation as housing above: an IP's costs are shown both on its
      // Properties card and as budget lines on the Expenses page, off the one array.
      if(pe && pe.kind === "IP") renderSharedGroups();
    }
  }
}
// Live-refresh the labels of every rendered transaction that takes its display name from a
// budget line being renamed — the rows whose own description is blank. Also repoints their
// Description placeholder, which shows the same inherited name.
function patchLinkedTransactionNames(item){
  var container = document.getElementById("transactionsTable");
  if(!container || !item || !item.id) return;
  container.querySelectorAll(".m-row[data-section='tx']").forEach(function(row){
    var t = state.transactions[Number(row.getAttribute("data-index"))];
    if(!t || t.linkedExpenseId !== item.id) return;
    // A closed row's form is still in its <template> (v3.108.0) — patch it there.
    var tpl = row.querySelector(":scope > template.m-row-edit-tpl");
    var whatField = row.querySelector(".tx-what") || (tpl && tpl.content.querySelector(".tx-what"));
    if(whatField) whatField.placeholder = item.what || "Optional note";
    if((t.what || "").trim()) return;
    var nameEl = row.querySelector(".m-row-name");
    if(nameEl) nameEl.textContent = transactionDisplayName(t, budgetLineItems());
    var subEl = row.querySelector(".m-row-sub");
    if(subEl) subEl.innerHTML = transactionSummaryText(t);
  });
}// "Does a row in this section appear in the Budget tab's list?" — which is what decides whether
// an edit has to keep #sharedGroups in step, not which page the edit was made from. An IP's
// costs are editable from either end (its Properties card, or the budget list), and both write
// to the same p.expenses array, so both need the same follow-up either way.
function isBudgetListSection(section){
  if(section === "shared" || section === "home:" + currentScenario()) return true;
  var mPropExp = /^propexp:(.+)$/.exec(section);
  if(!mPropExp) return false;
  var p = findProperty(mPropExp[1]);
  return !!(p && p.kind === "IP");
}
// ---------------- Event wiring ----------------
function onLedgerInput(e){
  var tr = e.target.closest("[data-section]");
  if(!tr) return;
  var section = tr.getAttribute("data-section");
  var idx = Number(tr.getAttribute("data-index"));
  var arr = getArrayForSection(section);
  if(!arr) return;
  var item = arr[idx];
  var structural = false;
  // A deduction edit changes somebody's taxable income, which changes their net income row, which
  // changes every total on every page. Flagged here and acted on below rather than calling the
  // tax re-render from three separate branches.
  var taxDeductionsChanged = false;
  if(e.target.classList.contains("f-what")){
    item.what = e.target.value;
    var nameEl = tr.querySelector(".m-row-name");
    if(nameEl) nameEl.textContent = item.what;
  }
  else if(e.target.classList.contains("f-account")) item.account = e.target.value;
  else if(e.target.classList.contains("f-class")){ item.classification = e.target.value; if(isBudgetListSection(section)) structural = true; }
  // Not structural: category is a reporting dimension, so it changes both by-category charts
  // but never which card this row sits in — no need to rebuild the list around it.
  else if(e.target.classList.contains("f-category")){ item.category = e.target.value; }
  // v3.164.0 (item 194): which part of the flexible view a line counts in — blank is the app's guess.
  else if(e.target.classList.contains("f-flexkind")){ if(e.target.value) item.flexKind = e.target.value; else delete item.flexKind; if(state.budgetGroupBy === "flex") structural = true; }
  else if(e.target.classList.contains("f-freq")){
    item.freq = e.target.value;
    // Income only: which pay-schedule field the row offers is chosen by the frequency (a weekday
    // for Weekly, an anchor date for Fortnightly, a day of the month otherwise), so changing it
    // has to rebuild the row. Everywhere else a frequency change is still just a number change
    // and a re-render would needlessly tear down whatever row is being edited.
    if(section === "income") structural = true;
  }
  else if(e.target.classList.contains("f-amount")) item.amount = parseFloat(e.target.value) || 0;
  else if(e.target.classList.contains("f-person")){ item.person = e.target.value; structural = true; }
  else if(e.target.classList.contains("f-incometype")){ item.incomeType = e.target.value; structural = true; }
  else if(e.target.classList.contains("f-superincluded")){ item.superMode = e.target.value; }
  else if(e.target.classList.contains("f-sacrificemode")){ item.sacrificeMode = sacrificeLabelToMode(e.target.value); structural = true; }
  else if(e.target.classList.contains("f-sacrificevalue")){ item.sacrificeValue = parseFloat(e.target.value) || 0; }
  // The pay schedule: one of these per row, whichever the frequency calls for. structural,
  // because the row's "Next pay …" sub-line is derived from it and has to be re-rendered.
  else if(e.target.classList.contains("f-payday")){ item.payDay = e.target.value === "last" ? "last" : (e.target.value ? Number(e.target.value) : null); structural = true; }
  else if(e.target.classList.contains("f-payweekday")){ item.payWeekday = e.target.value === "" ? null : Number(e.target.value); structural = true; }
  else if(e.target.classList.contains("f-payanchor")){ item.payAnchor = e.target.value || ""; structural = true; }
  else if(e.target.classList.contains("f-irregular")){
    item.irregular = e.target.checked;
    // "Budget year" only means anything for a reserve line, so it lives behind this checkbox —
    // revealed in place rather than by re-rendering the row, which would close the editor the
    // user is standing in. (.m-edit-field sets no `display` of its own, so plain [hidden] works
    // here — see the CSS gotcha in CLAUDE.md for when it wouldn't.)
    var reserveField = tr.querySelector(".f-reserveyear-field");
    if(reserveField) reserveField.hidden = !e.target.checked;
  }
  // structural: the collapsed row carries an "Ends …" note derived from this, and on the budget
  // pages an ended line is excluded from the projection — both need the row rebuilt, not patched.
  else if(e.target.classList.contains("f-startdate")){ item.startDate = e.target.value || ""; structural = true; taxDeductionsChanged = !!item.deductible; }
  else if(e.target.classList.contains("f-enddate")){ item.endDate = e.target.value || ""; structural = true; }
  // Deduction fields. structural on the flag only: ticking it reveals the share/person fields,
  // which are already in the DOM hidden — revealed in place rather than by re-rendering the row
  // out from under the user, same as the "no fixed timing" checkbox below.
  else if(e.target.classList.contains("f-deductible")){
    item.deductible = e.target.checked;
    tr.querySelectorAll(".f-deduct-extra").forEach(function(el){ el.hidden = !e.target.checked; });
    syncClaimFields(tr, item);
    taxDeductionsChanged = true;
  }
  else if(e.target.classList.contains("f-deductpct")){ item.deductiblePct = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)); taxDeductionsChanged = true; }
  else if(e.target.classList.contains("f-deductperson")){
    // "property:<id>" claims the line against an investment property instead (v3.45.0).
    var claimVal = e.target.value || "";
    if(claimVal.indexOf("property:") === 0){ item.claimProperty = claimVal.slice(9); item.deductiblePerson = ""; }
    else { item.claimProperty = ""; item.deductiblePerson = claimVal; }
    syncClaimFields(tr, item);
    taxDeductionsChanged = true;
  }
  else if(e.target.classList.contains("f-rentline")){ item.rentLine = e.target.value; taxDeductionsChanged = true; }
  else if(e.target.classList.contains("f-deductlabel")){ item.deductionLabel = e.target.value; taxDeductionsChanged = true; }
  else if(e.target.classList.contains("f-deductfrom")){ item.deductibleFrom = e.target.value || ""; taxDeductionsChanged = true; }
  else if(e.target.classList.contains("f-deductuntil")){ item.deductibleUntil = e.target.value || ""; taxDeductionsChanged = true; }
  else if(e.target.classList.contains("f-duemonth")) item.dueMonth = e.target.value ? Number(e.target.value) : null;
  else if(e.target.classList.contains("f-dueday")){ var dd = parseInt(e.target.value, 10); item.dueDay = dd >= 1 && dd <= 31 ? dd : null; }
  else if(e.target.classList.contains("f-reserveyear")) item.reserveYear = e.target.value;
  else return;

  if(e.target.classList.contains("f-amount") || e.target.classList.contains("f-freq")){
    // Scenario-resolved, matching what the renderer puts there — otherwise editing the default
    // on an overridden row would overwrite the headline with a figure this scenario doesn't pay.
    var p = periodsOf(resolveSharedAmount(item, currentScenario()), item.freq);
    var modernAmt = tr.querySelector('[data-computed="amt"]');
    if(modernAmt) modernAmt.textContent = fmtCurrency2.format(p.monthly) + "/mo";
  }
  if(section === "income" && (e.target.classList.contains("f-amount") || e.target.classList.contains("f-freq") || e.target.classList.contains("f-superincluded"))){
    // A single row's edit can shift the Maximum Super Contribution Base cap for every one of
    // this person's Gross rows (the cap is shared across all of them), so refresh every note,
    // not just this row's.
    patchIncomeSuperNotes();
  }

  recalcComputedItems();
  if(taxDeductionsChanged){
    // recalcComputedItems() above has already rebuilt the synthetic net-income rows from the new
    // taxable income; these repaint the Tax & super card and the Income list that show them.
    renderTaxSuper();
    patchSyntheticIncomeRows();
    patchIncomeGroupTotals();
  }

  if(section === "income" && structural){
    rerenderTableFor("income");
    updatePersonSuggestions();
  } else if(section === "income"){
    patchSyntheticIncomeRows();
    // v3.152.0: each pay row's after-tax figure and the take-home line, from the recomputed tax.
    patchIncomeAfterTax();
    patchIncomeGroupTotals();
    patchOpenRowBreakdowns();
  } else if(isBudgetListSection(section) && structural){
    rerenderTableFor(section);
  } else if(isBudgetListSection(section)){
    patchSharedGroupTotals();
    // A transaction logged against this budget line with no description of its own is listed
    // under the line's name (transactionDisplayName), so renaming the line has to move those
    // labels too. Patched in place rather than re-rendering #transactionsTable, since this
    // fires on every keystroke of the rename.
    if(e.target.classList.contains("f-what")) patchLinkedTransactionNames(item);
    if(e.target.classList.contains("f-category")){
      budgetRegroupPending = true;
      patchCategoryCharts();
      renderActualVsPlannedPanel();
    }
    // Toggling "irregular" moves this item between the regular monthly rows and the
    // year-to-date reserve section below on the same page — worth a live refresh rather than
    // waiting for whatever next unrelated action happens to re-render the panel.
    if(e.target.classList.contains("f-irregular")) renderActualVsPlannedPanel();
    // Changing which twelve months a reserve is measured over changes its numbers immediately —
    // and it's the one edit whose whole point is the figure on the panel below.
    if(e.target.classList.contains("f-reserveyear")) renderActualVsPlannedPanel();
  } else if(section.indexOf("propinc:") === 0){
    rerenderTableFor("propexp:" + section.slice(8));
    patchSyntheticIncomeRows();
  }
  if(section.indexOf("propinc:") === 0 || section.indexOf("propexp:") === 0){
    var editedProperty = findProperty(section.slice(section.indexOf(":") + 1));
    if(editedProperty) patchPropertyCardComputed(editedProperty);
  }

  // v3.206.0 (item 236b): the cards and Home's detail only if they're on screen — on Cash flow they're left
  // stale for when Home or Plan opens, not redrawn on every keystroke. (Not a commit: that would redraw the
  // list being typed into; the list is patched above.)
  redraw(["cards", "detail"]);
  renderTotals();
  if(section.indexOf("home:") === 0) renderHomeBodyTotalsOnly();
  renderProjectionsWhenSeen();
  if(section === "income" || section.indexOf("propinc:") === 0 || section.indexOf("propexp:") === 0) renderTaxSuper();
  persist();
}
function onLedgerClick(e){
  var breakdownBtn = e.target.closest(".row-breakdown-toggle");
  if(breakdownBtn){
    var tr = breakdownBtn.closest("tr");
    var next = tr.nextElementSibling;
    if(next && next.classList.contains("row-breakdown-row")){
      next.remove();
      breakdownBtn.setAttribute("aria-expanded", "false");
      breakdownBtn.textContent = "▸ Breakdown";
    } else {
      var person = breakdownBtn.getAttribute("data-breakdown-person");
      var newRow = document.createElement("tr");
      newRow.className = "row-breakdown-row";
      newRow.setAttribute("data-breakdown-person", person);
      var td = document.createElement("td");
      td.colSpan = tr.children.length;
      td.innerHTML = personBreakdownHtml(person);
      newRow.appendChild(td);
      tr.parentNode.insertBefore(newRow, tr.nextSibling);
      breakdownBtn.setAttribute("aria-expanded", "true");
      breakdownBtn.textContent = "▾ Breakdown";
    }
    return;
  }
  var varyBtn = e.target.closest("[data-vary-scenario]");
  if(varyBtn){
    openScenarioOverridePanel(varyBtn.getAttribute("data-vary-section") || "shared", Number(varyBtn.getAttribute("data-vary-scenario")));
    return;
  }
  // "Record a pay change" (Income). Distinct from [data-log] below, which snapshots whatever is
  // already in the Amount field: this takes the new figure directly and *applies* it, which is
  // what a pay rise actually is — the amount changes, as of a date.
  var payChangeBtn = e.target.closest("[data-pay-change]");
  if(payChangeBtn){
    var pIdx = Number(payChangeBtn.getAttribute("data-pay-change"));
    var pItem = state.income[pIdx];
    var pWrap = payChangeBtn.closest(".pay-change");
    var amountEl = pWrap && pWrap.querySelector(".pay-change-amount");
    var dateEl = pWrap && pWrap.querySelector(".pay-change-date");
    var newAmount = amountEl ? parseFloat(amountEl.value) : NaN;
    if(!pItem || isNaN(newAmount)){ showToast("Enter the new amount first."); return; }
    var effectiveFrom = (dateEl && dateEl.value) || undefined;
    var previousAmount = Number(pItem.amount) || 0;
    if(!Array.isArray(pItem.history)) pItem.history = [];
    // Seed the history with what it was *before* this change, so a first-ever recorded rise
    // still produces a comparison rather than a lone entry with nothing to be a change from.
    // Dated the day before, since the old amount applied right up until the new one started.
    if(!pItem.history.length && previousAmount && previousAmount !== newAmount){
      var dayBefore = new Date((effectiveFrom || localDateStr()) + "T00:00:00");
      dayBefore.setDate(dayBefore.getDate() - 1);
      pItem.history.push({ date: localDateStr(dayBefore), value: previousAmount });
    }
    pItem.amount = newAmount;
    var recordedOn = appendHistorySnapshot(pItem.history, newAmount, effectiveFrom);
    recalcComputedItems();
    rerenderTableFor("income");
    renderTaxSuper();
    renderCards(); renderDetail(); renderTotals();
    renderProjectionsWhenSeen();
    persist();
    var move = newAmount - previousAmount;
    showToast(move === 0
      ? pItem.what + " recorded at " + fmtCurrency0.format(newAmount) + " from " + fmtDate(recordedOn)
      : pItem.what + " " + (move > 0 ? "up" : "down") + " " + fmtCurrency0.format(Math.abs(move)) +
        " to " + fmtCurrency0.format(newAmount) + " from " + fmtDate(recordedOn));
    return;
  }
  var logBtn2 = e.target.closest("[data-log]");
  if(logBtn2){
    var lparts = logBtn2.getAttribute("data-log").split(":");
    var lsection = lparts.length > 2 ? lparts[0] + ":" + lparts[1] : lparts[0];
    var lidx = Number(lparts[lparts.length - 1]);
    var larr = getArrayForSection(lsection);
    var litem = larr && larr[lidx];
    if(litem){
      var dateInput = logBtn2.previousElementSibling;
      var logDate = (dateInput && dateInput.classList.contains("log-date") && dateInput.value) || undefined;
      if(!Array.isArray(litem.history)) litem.history = [];
      var ldate = appendHistorySnapshot(litem.history, Number(litem.amount) || 0, logDate);
      rerenderTableFor(lsection);
      renderProjectionsWhenSeen();
      persist();
      showToast("Logged " + fmtCurrency0.format(Number(litem.amount) || 0) + " for " + litem.what + " (" + ldate + ")");
    }
    return;
  }
  var del = e.target.closest("[data-del]");
  if(del){
    var parts = del.getAttribute("data-del").split(":");
    var section = parts.length > 2 ? parts[0] + ":" + parts[1] : parts[0];
    var idx = Number(parts[parts.length - 1]);
    var arr = getArrayForSection(section);
    if(arr && arr.length > 0){
      var removedItem = arr[idx];
      var removedWhat = removedItem && removedItem.what ? removedItem.what : "Item";
      arr.splice(idx, 1);
      refreshAfterLedgerChange(section);
      showUndoToast('Deleted "' + removedWhat + '"', function(){
        var arrNow = getArrayForSection(section);
        if(!arrNow) return;
        arrNow.splice(Math.min(idx, arrNow.length), 0, removedItem);
        refreshAfterLedgerChange(section);
      });
    }
  }
}
function refreshAfterLedgerChange(section){
  recalcComputedItems();
  rerenderTableFor(section);
  if(section.indexOf("propinc:") === 0 || section.indexOf("propexp:") === 0){
    patchSyntheticIncomeRows();
    renderTaxSuper();
    var editedProperty = findProperty(section.slice(section.indexOf(":") + 1));
    if(editedProperty) patchPropertyCardComputed(editedProperty);
  }
  redraw(["cards", "detail"]); renderTotals(); renderHomeBodyTotalsOnly();
  renderProjectionsWhenSeen();
  persist();
}// section+index does NOT identify a row uniquely across the document: the same underlying row
// can be rendered on two pages at once. The active scenario's housing appears both in the
// Scenarios block and in the Expenses page's budget list, and an investment property's costs
// appear both on its Properties card and in that same list — by design, since both ends edit
// the one array. #page-expenses comes first in index.html, so a document-wide lookup always
// returned the budget-list copy, and closing a housing row opened on the Scenarios page cleared
// "open" off a row that didn't have it while the one actually on screen stayed open forever
// (with activeModernRow then null, no further tap could close it either). So the search is
// scoped to the container the row was opened in.
function containerIdForRow(row){
  // Nearest id-bearing ancestor: every wired container has one ("homeBody", "sharedGroups",
  // "propertiesBody"…), and an inner wrapper that has one too (e.g. "propExpRows_<id>") only
  // scopes tighter, which is just as correct.
  var el = row && row.parentElement;
  while(el && !el.id) el = el.parentElement;
  return el ? el.id : null;
}// Looked up fresh by data-section/data-index rather than a cached element reference — an
// action taken *while* a row is open (e.g. the "Log" button inside a shared expense's edit
// panel) can trigger a full re-render of that row's container (renderSharedGroups() and
// friends replace the whole innerHTML), which detaches the original element from the document
// even though openState still says it's open, so the freshly-rendered replacement row also
// renders with the "open" class. A cached reference to the old, now-detached node would have
// its "open" class removed with no visible effect, permanently stranding the new node open and
// (since activeModernRow then goes stale/null) un-closeable by any further tap. The container is
// re-resolved by id for the same reason — a render one level up (renderProperties() rebuilding
// #propertiesBody) can replace the wrapper element itself, not just its contents.
function findModernRowElement(section, idx, containerId){
  var scope = (containerId && document.getElementById(containerId)) || document;
  return scope.querySelector('.m-row[data-section="' + CSS.escape(section) + '"][data-index="' + CSS.escape(String(idx)) + '"]');
}// Pure DOM/state cleanup, no history involved — used both as the overlay's close callback (the
// entry's already gone by the time the popstate handler calls this) and internally when
// swapping directly from one open row to another (see openModernRow's switchingRow case), where
// touching history would mean an async round-trip through popstate for what should be an
// instant swap.
// Removes a row created by "+ Add" and then closed untouched (see closeActiveModernRowUI) —
// the same splice-and-refresh every Delete button already does, minus the undo toast, since
// from the user's own side nothing was ever really added.
//
// Guarded by identity, not just bounds: if the row was instead removed by an explicit tap on its
// own Delete button (which doesn't itself close the modal — see the [data-del]/[data-asset-del]
// handlers), `activeModernRow.freshItem` is a detached object no longer in `arr` at all, and a
// later Escape/backdrop-close reaching this function must not splice out whatever now happens to
// sit at the old index.
function discardUneditedRow(section, idx, freshItem){
  // getArrayForSection covers income/shared/home:/propinc:/propexp: — the three sections that
  // add straight into state.assets, a property's own loans, and a manually-added transaction
  // each live outside that helper's reach (see the matching "+Add" branches below), so they're
  // resolved here on the same terms rather than widening what every *other* caller of
  // getArrayForSection has to expect back.
  var mLoan = section.indexOf("loan:") === 0 ? /^loan:(.+)$/.exec(section) : null;
  var loanProperty = mLoan ? findProperty(mLoan[1]) : null;
  var arr = section === "assets" ? state.assets
    : section === "tx" ? state.transactions
    : mLoan ? (loanProperty ? loanProperty.loans : null)
    : getArrayForSection(section);
  if(!arr || idx < 0 || idx >= arr.length || arr[idx] !== freshItem) return;
  arr.splice(idx, 1);
  if(section === "assets"){ renderAssets(); renderProjectionOutputs(); persist(); return; }
  if(section === "tx"){ renderTransactions(); renderActualVsPlannedPanel(); persist(); return; }
  if(mLoan){ renderProperties(); renderProjectionOutputs(); persist(); return; }
  refreshAfterLedgerChange(section);
}function closeActiveModernRowUI(){
  if(!activeModernRow) return;
  var row = findModernRowElement(activeModernRow.section, activeModernRow.idx, activeModernRow.containerId);
  if(row) row.classList.remove("open");
  activeModernRow.openState[activeModernRow.key] = false;
  var wasBudgetRow = isBudgetListSection(activeModernRow.section);
  // A row opened straight from "+ Add" (see openNewRowModal) carries the item it just created
  // and a snapshot taken the instant it was pushed. Closing it — Done, tapping away, Escape, the
  // backdrop, the back button, or switching straight to another row — without a single field
  // having changed means the tap was accidental or abandoned, so it's discarded here rather than
  // left behind as a "New item"/$0 record nobody asked for. Comparing against the *current*
  // object (not a "was anything ever typed" flag) also means typing something and then
  // undoing it back to the same defaults still discards — which is correct, since nothing about
  // the row actually differs from one nobody touched.
  var discardSection = null, discardIdx = -1, discardItem = null;
  if(activeModernRow.freshItem && JSON.stringify(activeModernRow.freshItem) === activeModernRow.freshSnapshot){
    discardSection = activeModernRow.section;
    discardIdx = Number(activeModernRow.idx);
    discardItem = activeModernRow.freshItem;
  }
  activeModernRow = null;
  document.getElementById("mRowBackdrop").hidden = true;
  if(discardSection){ discardUneditedRow(discardSection, discardIdx, discardItem); return; }
  // Recategorising is the one edit whose effect can't be patched in place: grouped by category
  // it moves the row into a different card, which means rebuilding the list — and doing that
  // while the modal is open would tear the row out from under the person editing it. So it's
  // deferred to here, the moment the modal closes.
  if(wasBudgetRow && budgetRegroupPending){ budgetRegroupPending = false; renderSharedGroups(); }
}// The close entry point for every on-screen affordance (tap the row/header, Escape, tap the
// backdrop) — see wireModernRowToggle, the Escape listener, and #mRowBackdrop's click listener
// below.
function closeActiveModernRow(){
  if(!activeModernRow) return;
  app.requestCloseActiveOverlay();
}// Exported to module scope (not just wireModernRowToggle's closure) so every "+Add" handler
// below can open the row it just created as a modal immediately — matching a native app's
// "tap + → the new entry's fields are already in front of you" flow, instead of silently
// appending a collapsed row somewhere in the list that has to be found and tapped first.
//
// autoFocus is only ever true for that "+Add" flow (see openNewRowModal below) — focusing a
// text input on a phone immediately raises the on-screen keyboard, which is exactly what you
// want the instant a blank "New item" field appears in front of you, but is an unwanted
// surprise every time you tap an *existing* row just to glance at or adjust one of its fields.
// Plain taps route through wireModernRowToggle's click handler below, which never passes it.
//
// freshItem is likewise only ever passed by the "+Add" flow — the object just pushed into its
// array, so closeActiveModernRowUI can tell an abandoned add from an ordinary look-and-close on
// a row that already had real data in it (see discardUneditedRow).
function openModernRow(row, openState, key, autoFocus, freshItem){
  // Swapping directly from one open row to another re-uses the same history entry (replaceState)
  // rather than stacking a second one — the back button should undo "a row was open" once, not
  // once per row visited on the way to this one.
  // Compared on container as well as key: the two copies of a housing row share a section, an
  // index and therefore a key, but are separate rows on separate pages with separate open-state
  // maps — treating a tap on one as "the same row" as the other would leave the first open.
  var containerId = containerIdForRow(row);
  var switchingRow = !!activeModernRow && (activeModernRow.key !== key || activeModernRow.containerId !== containerId);
  if(switchingRow) closeActiveModernRowUI();
  materializeRowEdit(row);
  row.classList.add("open");
  // .is-entering is what actually carries the slide-in/fade-in animation (see ledger.css) — a
  // transient marker so a container re-render that recreates an already-open row doesn't replay
  // the entrance and read as a whole new page opening. The timeout is a fallback for the case
  // where no animation runs at all (reduced motion, or the row being detached mid-animation),
  // since animationend would then never fire and the class would stick around for the next open.
  row.classList.add("is-entering");
  var clearEntering = function(){ row.classList.remove("is-entering"); };
  row.addEventListener("animationend", clearEntering, { once: true });
  setTimeout(clearEntering, 400);
  openState[key] = true;
  activeModernRow = {
    section: row.getAttribute("data-section"), idx: row.getAttribute("data-index"), openState: openState, key: key, containerId: containerId,
    freshItem: freshItem || null,
    // Taken here, not at push time — a fresh row can pick up a computed default (a vehicle's
    // recalcComputedItems() stamps computed:false onto it) between being pushed and being opened,
    // and the snapshot has to reflect the state the row is actually shown in, not the bare literal
    // it was created with, or that stamp alone would read as "touched" on every unedited close.
    freshSnapshot: freshItem ? JSON.stringify(freshItem) : null
  };
  document.getElementById("mRowBackdrop").hidden = false;
  app.pushActiveOverlay(closeActiveModernRowUI, switchingRow);
  if(!autoFocus) return;
  var firstField = row.querySelector(".m-row-edit input, .m-row-edit select");
  if(firstField){
    firstField.focus();
    // A freshly-added item's "What" field still holds its generic default ("New item", "New
    // loan", "New asset"...) — select it so typing immediately replaces it, rather than
    // requiring a select-all first.
    if(firstField.tagName === "INPUT" && /^New /.test(firstField.value)) firstField.select();
  }
}function wireModernRowToggle(containerId, openState){
  var container = document.getElementById(containerId);
  if(!container) return;
  container.addEventListener("click", function(e){
    var toggle = e.target.closest("[data-row-toggle]");
    if(!toggle) return;
    var row = toggle.closest(".m-row");
    if(!row) return;
    // Keyed by section+index, not index alone — a bare index would collide once the same
    // container can hold rows from more than one entity (e.g. Properties, where each
    // property's income/expenses are separately-indexed arrays sharing one open-state map).
    var key = row.getAttribute("data-section") + ":" + row.getAttribute("data-index");
    if(!row.classList.contains("open")){ openModernRow(row, openState, key); return; }
    // Safety net, not the fix for anything in particular: a row that renders "open" while
    // activeModernRow is null has no close path at all — closeActiveModernRow() early-returns
    // and the modal is stuck with no way out but a reload, which on a phone reads as the app
    // having crashed. If tracking and the DOM ever disagree again, believe the DOM.
    if(!activeModernRow){
      row.classList.remove("open");
      openState[key] = false;
      document.getElementById("mRowBackdrop").hidden = true;
      return;
    }
    closeActiveModernRow();
  });
  container.addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    var toggle = e.target.closest("[data-row-toggle]");
    if(!toggle) return;
    e.preventDefault();
    toggle.click();
  });
}
// Finds the row a just-pushed item rendered as and opens it as a modal immediately — matching
// a native app's "tap + → the new entry's fields are already in front of you" flow, instead of
// silently appending a collapsed row somewhere in the list that has to be found and tapped first.
//
// item is that same just-pushed object, threaded through to openModernRow so an accidental or
// abandoned "+Add" tap doesn't leave a "New item"/$0 row behind — see discardUneditedRow.
function openNewRowModal(containerId, section, idx, openState, item){
  var container = document.getElementById(containerId);
  var row = container && container.querySelector('[data-section="' + CSS.escape(section) + '"][data-index="' + idx + '"]');
  if(row) openModernRow(row, openState, section + ":" + idx, true, item);
}

export function wireLedgerEdits(){
  document.addEventListener("input", function(e){
    if(e.target.closest("table.ledger-table") || e.target.closest(".m-rows")) onLedgerInput(e);
  });  document.addEventListener("change", function(e){
    if((e.target.closest("table.ledger-table") || e.target.closest(".m-rows")) && (e.target.tagName === "SELECT")) onLedgerInput(e);
  });  document.addEventListener("click", onLedgerClick);
}

export function wireRowEditors(){
  document.getElementById("mRowBackdrop").addEventListener("click", closeActiveModernRow);  document.addEventListener("keydown", function(e){
    if(e.key === "Escape" && activeModernRow) closeActiveModernRow();
  });  wireModernRowToggle("incomeGroups", modernIncomeRowOpen);  wireModernRowToggle("sharedGroups", modernSharedRowOpen);
}

export function wireMoreRowEditors(){
  wireModernRowToggle("propertiesBody", modernPropRowOpen);  wireModernRowToggle("homeBody", modernHomeRowOpen);  ["Cash", "Shares", "Super", "Vehicle", "Other"].forEach(function(cat){
    wireModernRowToggle("assetsSub-" + cat, modernAssetRowOpen);
  });
}

export function wireAddButtons(){
  document.addEventListener("click", function(e){
    var addBtn = e.target.closest("[data-add]");
    if(!addBtn) return;
    var raw = addBtn.getAttribute("data-add");
    var section, groupValue;
    // "home:", "propinc:" and "propexp:" all embed a further-qualified id after their own colon
    // (a scenario name, a property id) that's part of the section itself, not a separate group
    // value — unlike "shared:Needs"/"income:Sam"/"assets:Cash", where the part after the colon
    // really is a separate classification/person/category. Splitting on the first colon
    // regardless used to silently break propinc:/propexp: specifically (section became just
    // "propinc"/"propexp" with the property id lost, which getArrayForSection() never matches —
    // "+ Add income"/"+ Add expense" on a property card did nothing at all, with no error).
    if(raw.indexOf("home:") === 0 || raw.indexOf("propinc:") === 0 || raw.indexOf("propexp:") === 0){
      section = raw; groupValue = null;
    } else {
      var colonIdx = raw.indexOf(":");
      section = colonIdx === -1 ? raw : raw.slice(0, colonIdx);
      groupValue = colonIdx === -1 ? null : raw.slice(colonIdx + 1);
    }
    if(section === "assets"){
      var assetCat = groupValue != null ? groupValue : "Cash";
      var newAsset = { what:"New asset", category: assetCat, amount:0 };
      state.assets.push(newAsset);
      renderAssets();
      openNewRowModal("assetsSub-" + assetCat, "assets", state.assets.length - 1, modernAssetRowOpen, newAsset);
      persist();
      return;
    }
    if(section === "holding"){
      var newHolding = { what:"New holding", category:"Shares", symbol:"", market:"ASX", quantity:0, avgCost:null, price:0, priceUpdated:"", person: groupValue != null ? groupValue : "", amount:0 };
      state.assets.push(newHolding);
      renderAssets();
      openNewRowModal("assetsSub-Shares", "assets", state.assets.length - 1, modernAssetRowOpen, newHolding);
      persist();
      return;
    }
    if(section === "vehicle"){
      var newVehicle = { what:"New vehicle", category:"Vehicle", purchasePrice:0, purchaseDate:"", depreciationRate:15, amount:0 };
      state.assets.push(newVehicle);
      recalcComputedItems();
      renderAssets();
      openNewRowModal("assetsSub-Vehicle", "assets", state.assets.length - 1, modernAssetRowOpen, newVehicle);
      persist();
      return;
    }
    // "sharedcat:<name>" is the same add as "shared:" but presets the category instead of the
    // classification — what "+ Add expense" on a card means while the list is grouped by category.
    var addCategory = "";
    if(section === "sharedcat"){ addCategory = groupValue || ""; section = "shared"; groupValue = null; }
    var arr = getArrayForSection(section);
    if(!arr) return;
    var showClass = section !== "income" && section.indexOf("propinc:") !== 0;
    var newItem = { what:"New item", classification: showClass ? (groupValue != null ? groupValue : "Needs") : "", category: addCategory, account:"", amount:0, freq:"Monthly" };
    if(section === "income"){ newItem.id = genId("inc"); newItem.person = groupValue != null ? groupValue : ""; newItem.incomeType = "Net"; }
    arr.push(newItem);
    var newIdx = arr.length - 1;
    rerenderTableFor(section);
    if(section === "income") openNewRowModal("incomeGroups", "income", newIdx, modernIncomeRowOpen, newItem);
    else if(section === "shared") openNewRowModal("sharedGroups", "shared", newIdx, modernSharedRowOpen, newItem);
    else if(section.indexOf("propinc:") === 0 || section.indexOf("propexp:") === 0) openNewRowModal("propertiesBody", section, newIdx, modernPropRowOpen, newItem);
    else if(section.indexOf("home:") === 0) openNewRowModal("homeBody", section, newIdx, modernHomeRowOpen, newItem);
    if(section.indexOf("propinc:") === 0){
      recalcComputedItems();
      rerenderTableFor("propexp:" + section.slice(8));
      patchSyntheticIncomeRows();
      var addedToProperty = findProperty(section.slice(8));
      if(addedToProperty) patchPropertyCardComputed(addedToProperty);
    } else if(section.indexOf("propexp:") === 0){
      recalcComputedItems();
      var expAddedProperty = findProperty(section.slice(8));
      if(expAddedProperty) patchPropertyCardComputed(expAddedProperty);
    }
    if(section.indexOf("home:") === 0) renderHomeBodyTotalsOnly();
    renderCards(); renderDetail(); renderTotals();
    renderTaxSuper();
    renderProjectionOutputs();
    persist();
  });
  document.getElementById("incomeExportCsvBtn").addEventListener("click", exportIncomeCsv);  document.getElementById("expenseExportCsvBtn").addEventListener("click", exportExpensesCsv);  document.getElementById("assetsExportCsvBtn").addEventListener("click", exportAssetsCsv);  document.getElementById("propertyLoansExportCsvBtn").addEventListener("click", exportPropertyLoansCsv);
}

export { closeActiveModernRow, findProperty, openNewRowModal, refreshAfterLedgerChange, rerenderTableFor, wireModernRowToggle };
