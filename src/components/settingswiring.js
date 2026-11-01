// ---------------- Settings, wired (v3.206.1, item 237) ----------------
//
// Settings → Import rules, Categories and Preferences, the year's transactions as CSV, who changed what and the
// problems the app hit.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order.
import { undoEntry } from "../calc/activity.js";
import { normaliseDescription } from "../calc/bank-import.js";
import { recalcComputedItems } from "../calc/engine.js";
import { mergeSimilarRules } from "../calc/import-rules.js";
import { transactionDisplayName } from "../calc/ledger.js";
import { startActivityLog, setDevicePerson } from "../lib/activity.js";
import { exportYearTransactionsCsv } from "../lib/backup.js";
import { errorLog, clearErrorLog } from "../lib/errorlog.js";
import { showToast, showUndoToast } from "../lib/toast.js";
import { state, persist, genId, onSaved } from "../state.js";
import { renderActivity, activityUi } from "./activity.js";
import { renderAssets } from "./assets.js";
import { renderSharedGroups, renderTransactions, renderActualVsPlannedPanel, renderCategories, addCategory, deleteCategory, renameCategoryEverywhere, setCategoryLook, categoryLookUi, renderBudgetGroupByToggle, budgetLineItems, renderYearSpending, renderYearBasisPreference, setYearBasis, transactionCategory } from "./expenses.js";
import { renderHealth } from "./health.js";
import { renderTaxSuper } from "./income.js";
import { showAccountsSubpage } from "./nav.js";
import { applyPeriod } from "./period.js";
import { renderAll } from "./redraw.js";
import { rulesPageHtml, setRuleField, ruleIsEmpty, ruleTest, ruleView, RULES_PAGE } from "./rules.js";
import { renderSafekeeping } from "./safekeeping.js";
import { renderPeopleTab } from "./taxwiring.js";

var rulesBody, rulesTestTimer;

// ---------------- Settings → Import rules (v3.60.0) ----------------
function renderRules(){
  var el = document.getElementById("rulesBody");
  if(el) el.innerHTML = rulesPageHtml(budgetLineItems());
  var c = document.getElementById("rulesCount");
  if(c) c.textContent = (state.importRules || []).length + " rule" + ((state.importRules || []).length === 1 ? "" : "s");
}
function renderSettingsTab(id){
  if(id === "rules") renderRules();
  if(id === "categories") renderCategories();
  if(id === "people") renderPeopleTab();
  if(id === "checks") renderHealth();
  if(id === "preferences") renderYearBasisPreference();
}
// A category rename or delete changes what the Budget rows' selects offer and what both
// by-category charts total, so all of it is re-derived together rather than left to whatever
// happens to re-render next. Not renderCategories() itself — that would rebuild the row being
// typed into and drop the caret.
function refreshCategoryUi(){
  renderBudgetGroupByToggle();
  renderSharedGroups();
  renderActualVsPlannedPanel();
}
// Recategorising a line from the row editor can change which groups exist and what the
// composition bar shows — but only when the list is grouped by category, and a full
// renderSharedGroups() there would rebuild the very row the <select> lives in, closing the open
// modal mid-edit. So the list is left alone until the row is closed; the Spending tab's chart
// (rendered separately) still updates immediately.
function patchCategoryCharts(){
  renderBudgetGroupByToggle();
}

export function wireSettings(){  rulesBody = document.getElementById("rulesBody");
  rulesBody.addEventListener("change", function(e){
    if(e.target.hasAttribute("data-rl-sort")){ ruleView.sort = e.target.value; ruleView.shown = RULES_PAGE; renderRules(); return; }
    var t = e.target, i = t.getAttribute("data-rl-index");
    if(i == null) return;
    if(!setRuleField(Number(i), t.getAttribute("data-rl-key"), t.value)){ showToast("A rule needs some words to match"); renderRules(); return; }
    var r = state.importRules[Number(i)];
    persist();
    renderRules();
    if(r && ruleIsEmpty(r)) showToast("This rule now files nothing — give it a line or a category, or it's removed next time the app opens");
  });
  rulesTestTimer = null;
  rulesBody.addEventListener("input", function(e){
    var finding = e.target.hasAttribute("data-rl-find");
    if(!finding && !e.target.hasAttribute("data-rl-test")) return;
    if(finding){ ruleView.q = e.target.value; ruleView.shown = RULES_PAGE; }
    else ruleTest.text = e.target.value;
    var which = finding ? "[data-rl-find]" : "[data-rl-test]";
    clearTimeout(rulesTestTimer);
    rulesTestTimer = setTimeout(function(){
      var pos = e.target.selectionStart;
      renderRules();
      var again = rulesBody.querySelector(which);
      if(again){ again.focus(); try{ again.setSelectionRange(pos, pos); }catch(err){} }
    }, 180);
  });
  rulesBody.addEventListener("click", function(e){
    if(e.target.closest("[data-rl-merge]")){
      var before = state.importRules.slice().map(function(r){ return Object.assign({}, r); });
      var res = mergeSimilarRules(state.importRules);
      state.importRules = res.rules;
      persist(); renderRules();
      showUndoToast("Merged " + (before.length - res.rules.length) + " rules", function(){ state.importRules = before; persist(); renderRules(); });
      return;
    }
    if(e.target.closest("[data-rl-more]")){ ruleView.shown = (ruleView.shown || RULES_PAGE) + RULES_PAGE; renderRules(); return; }
    var del = e.target.closest("[data-rl-del]");
    if(del){
      var i = Number(del.getAttribute("data-rl-del"));
      var gone = state.importRules.splice(i, 1)[0];
      persist(); renderRules();
      if(gone) showUndoToast("Rule deleted", function(){ state.importRules.splice(i, 0, gone); persist(); renderRules(); });
      return;
    }
    if(e.target.closest("[data-rl-add]")){
      var m = rulesBody.querySelector('[data-rl-new="match"]').value, line = rulesBody.querySelector('[data-rl-new="line"]').value;
      var key = normaliseDescription(m);
      if(!key || !line){ showToast("Type the words to match and pick a line"); return; }
      var existing = state.importRules.find(function(r){ return r.match === key && !r.incomeTarget; });
      if(existing){ existing.linkedExpenseId = line; existing.category = ""; }
      else state.importRules.push({ id: genId("rule"), match: key, linkedExpenseId: line, category: "", account: "", hits: 0 });
      persist(); renderRules();
      showToast(existing ? "Updated the rule for “" + key + "”" : "Added a rule for “" + key + "”");
    }
  });
  document.getElementById("accountsSubnav").addEventListener("click", function(e){
    var accountsSubBtn = e.target.closest("[data-accounts-sub]");
    if(!accountsSubBtn) return;
    var accountsSubId = accountsSubBtn.getAttribute("data-accounts-sub");
    showAccountsSubpage(accountsSubId);
    if(accountsSubId === "rules") renderRules();
    // Each category row carries a live "used by N lines" count, which goes stale every time a
    // budget line is added, deleted, recategorised or imported — none of which re-render this
    // normally-hidden tab, and none of which should have to know it exists. Recounting on the way
    // in is both cheaper and more reliable than adding a renderCategories() to all of them.
    if(accountsSubId === "categories") renderCategories();
    if(accountsSubId === "people") renderPeopleTab();
    if(accountsSubId === "checks") renderHealth();
    // Same reasoning as renderCategories() above: this tab is normally hidden, and its labels are
    // derived from today's date ("FY26/27 so far", "20% through it"), so they go stale on their
    // own without anything having changed.
    if(accountsSubId === "preferences") renderYearBasisPreference();
  });
  document.getElementById("yearBasisControl").addEventListener("click", function(e){
    var btn = e.target.closest("[data-year-basis]");
    if(!btn) return;
    setYearBasis(btn.getAttribute("data-year-basis"));
    applyPeriod(null, "");
    renderYearBasisPreference();
    // The household year reaches further than any other preference in this app: the year-to-date
    // spending panel, every reserve line that hasn't been given its own budget year (so the
    // Actual-vs-planned panel and the budget rows' progress), the shares YTD timeframe, and the
    // tax estimate's heading. Re-rendering all of it is the cheap, reliable option.
    renderYearSpending();
    renderActualVsPlannedPanel();
    renderSharedGroups();
    renderAssets();
    renderTaxSuper();
  });
  document.getElementById("exportYearTransactionsBtn").addEventListener("click", function(){
    // The resolvers are passed in because the walks they do (a transaction's category via its
    // linked budget line, that line's name, the account) live in components/expenses.js, and
    // lib/backup.js can't import a component.
    exportYearTransactionsCsv({
      displayName: function(t){ return transactionDisplayName(t, budgetLineItems()); },
      categoryFor: transactionCategory,
      budgetLineFor: function(t){
        return (t.linkedExpenseId && budgetLineItems().find(function(i){ return i.id === t.linkedExpenseId; })) || null;
      },
      budgetLineName: function(t){
        var line = t.linkedExpenseId && budgetLineItems().find(function(i){ return i.id === t.linkedExpenseId; });
        return line ? line.what : "";
      },
      accountFor: function(t){ return t.account || ""; }
    });
  });
  document.getElementById("addCategoryBtn").addEventListener("click", function(){
    addCategory();
    // Straight into the new (blank) row's name field — a category with no name is useless, and
    // this saves a tap on the one control that has to be filled in.
    var lastCatInput = document.querySelector("#categoriesTable .m-row:last-child .cat-mgmt-name");
    if(lastCatInput) lastCatInput.focus();
  });
  document.addEventListener("click", function(e){
    var delCatBtn = e.target.closest("[data-cat-del]");
    if(delCatBtn){ deleteCategory(Number(delCatBtn.getAttribute("data-cat-del"))); refreshCategoryUi(); }
  });  // v3.157.0 (item 187): a category's colour and icon, picked from its badge.
  document.addEventListener("click", function(e){
    var pick = e.target.closest("[data-cat-look]");
    if(!pick) return;
    var i = Number(pick.getAttribute("data-cat-look"));
    if(pick.hasAttribute("data-cat-color")) setCategoryLook(i, "color", pick.getAttribute("data-cat-color"));
    else if(pick.hasAttribute("data-cat-icon")) setCategoryLook(i, "icon", pick.getAttribute("data-cat-icon"));
    else if(pick.hasAttribute("data-cat-look-reset")) setCategoryLook(i, "reset");
    else return;
    categoryLookUi.open = state.categories[i] || "";
    renderCategories();
    refreshCategoryUi();
    renderTransactions();
    persist();
  });
  document.addEventListener("toggle", function(e){
    if(e.target.matches && e.target.matches("[data-cat-look-for]")) categoryLookUi.open = e.target.open ? e.target.getAttribute("data-cat-look-for") : (categoryLookUi.open === e.target.getAttribute("data-cat-look-for") ? "" : categoryLookUi.open);
  }, true);
  document.addEventListener("input", function(e){
    if(!e.target.closest("#categoriesTable")) return;
    if(!e.target.classList.contains("cat-mgmt-name")) return;
    var catIdx = Number(e.target.getAttribute("data-cat-index"));
    var oldCatName = state.categories[catIdx];
    if(oldCatName == null) return;
    state.categories[catIdx] = e.target.value;
    renameCategoryEverywhere(oldCatName, e.target.value);
    refreshCategoryUi();
    persist();
  });
}

export function wireActivity(){
  // ---------------- Who changed what (v3.171.0, item 202) ----------------
  // The watcher logs edits made here a moment after they're saved (lib/activity.js); this is the
  // Settings section: whose device it is, the list, Undo.
  startActivityLog();
  onSaved(function(){ setTimeout(renderActivity, 1800); });
  document.addEventListener("change", function(e){
    if(!e.target.matches || !e.target.matches("[data-act-name]")) return;
    var nm = e.target.value.trim();
    setDevicePerson(nm);
    persist(); // stamps the name on this copy, for the other device's merge question
    showToast(nm ? "Changes made here now say they're from " + nm : "Changes made here are no longer named");
    e.target.blur(); renderActivity();
  });
  document.addEventListener("click", function(e){
    if(!e.target.closest) return;
    if(e.target.closest("[data-act-more]")){ activityUi.shown += 40; renderActivity(); return; }
    var u = e.target.closest("[data-act-undo]");
    if(!u) return;
    var entry = (state.activity || []).find(function(x){ return x.id === u.getAttribute("data-act-undo"); });
    if(!entry) return;
    if(!undoEntry(state, entry)){ showToast("That can't be undone any more — what it changed has changed again or gone"); return; }
    entry.undone = true;
    recalcComputedItems(); persist(); renderAll();
    showToast("Undone: " + entry.what);
  });
}

export function wireErrorLog(){
  // ---------------- Problems the app hit (v3.202.0, item 233) — lib/errorlog.js ----------------
  document.addEventListener("click", function(e){
    if(e.target.closest("[data-el-clear]")){ clearErrorLog(); renderSafekeeping(); showToast("Cleared"); return; }
    if(e.target.closest("[data-el-copy]")){
      var text = errorLog().map(function(x){ return [x.at, x.kind, x.message, x.where, x.version, x.count > 1 ? "x" + x.count : ""].filter(Boolean).join(" | "); }).join("\n");
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function(){ showToast("Copied"); }, function(){ showToast("Couldn't copy — select the list instead"); });
    }
  });
}

export { patchCategoryCharts, renderSettingsTab };
