// ---------------- Tax and people, wired (v3.206.1, item 237) ----------------
//
// People, the Tax & super card, Checks' fixes, the year's worksheet and documents, and Close the year.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order. What it shares with app.js it reaches through `app` (lib/appctx.js).
import { renderNotifBadge } from "./notifpanel.js";
import { oddCardRepayments, usualCardSource } from "../calc/bills.js";
import { applyRentalComparison, applyBudgetComparison, householdBudgetLines } from "../calc/closeyear.js";
import { recalcComputedItems } from "../calc/engine.js";
import { dataHealthChecks, dismissCheck } from "../calc/health.js";
import { appendHistorySnapshot } from "../calc/ledger.js";
import { renamePersonEverywhere, removePersonFromTax } from "../calc/people.js";
import { fyLabel } from "../calc/property.js";
import { rentCheck } from "../calc/rentcheck.js";
import { phiPremiumsAnnual, getTaxPeople, personTaxSettings, computePersonTax } from "../calc/tax.js";
import { setUseBudgetLines, setLineExcluded, setRentalActual } from "../calc/taxyear.js";
import { fmtCurrency2, localDateStr } from "../lib/format.js";
import { onHorizontalSwipe } from "../lib/swipe.js";
import { showToast, showUndoToast } from "../lib/toast.js";
import { state, persist, genId } from "../state.js";
import { renderCards, renderDetail } from "./dashboard.js";
import { budgetLineItems } from "./expenses.js";
import { renderHealth } from "./health.js";
import { renderHomeSummary } from "./home.js";
import { patchOpenRowBreakdowns, patchIncomeGroupTotals, patchSyntheticIncomeRows, patchIncomeSuperNotes, renderTaxSuper, withholdingCheckText, flipTaxCard, patchAllTaxPersonOutputs, patchPhiNote, modernIncomeRowOpen } from "./income.js";
import { showPage, showAssetsSubpage, showExpensesSubpage, showAccountsSubpage, showTaxSubpage } from "./nav.js";
import { renderPeople, setPersonField, peopleSummaryText } from "./people.js";
import { renderProjectionOutputs } from "./projections.js";
import { renderTotals, renderAll, renderChecksBadge, updatePersonSuggestions } from "./redraw.js";
import { findProperty, rerenderTableFor, openNewRowModal } from "./rows.js";
import { saveTransfer } from "./spendingwiring.js";
import { taxYearFillStatements, renderTaxYear, setTaxYearSelected, taxYearAddRow, taxYearDeleteRow, taxYearRestoreRow, taxYearSetField, taxYearToggleEvidence, taxYearMarkLodged, worksheetText, taxYearSelected, taxYearPrintHtml } from "./taxyear.js";

var peopleTable, taxYearBody, taxDocsBody;

// ---------------- Tax & super ----------------
// A line claimed against a property shows its rental schedule line; one claimed by a person, its
// return label (v3.45.0). Both are in the DOM; this picks which is visible.
function syncClaimFields(tr, item){
  tr.querySelectorAll(".f-claim-prop").forEach(function(el){ el.hidden = !(item.deductible && item.claimProperty); });
  tr.querySelectorAll(".f-claim-person").forEach(function(el){ el.hidden = !(item.deductible && !item.claimProperty); });
}// People (v3.44.0): the rename and remove themselves live in calc/people.js, which walks every
// row and record that names a person; this is the refresh after either.
function afterPeopleChange(){
  recalcComputedItems();
  rerenderTableFor("income");
  updatePersonSuggestions();
  renderTaxSuper();
  renderPeopleTab();
  renderCards();
  renderDetail();
  renderTotals();
  renderProjectionOutputs();
  persist();
}function renderPeopleTab(){
  renderPeople();
  var sum = document.getElementById("peopleSummary");
  if(sum) sum.textContent = peopleSummaryText();
}function renameTaxPerson(oldName, newName){
  var res = renamePersonEverywhere(oldName, newName);
  if(res.error){ showToast(res.error); renderPeopleTab(); return; }
  if(res.changed) afterPeopleChange();
}function removeTaxPerson(name){
  if(!confirm('Remove "' + name + '" from tax? Their income rows go back to Type "Net" (counted as-is, at face value) and keep their current amounts; their date of birth, HELP and property shares are cleared.')) return;
  removePersonFromTax(name);
  afterPeopleChange();
}function openPeopleTab(){
  showAccountsSubpage("people");
  renderPeopleTab();
}function flipTaxCardFromSwipe(e){
  if(!window.matchMedia("(max-width: 880px)").matches) return;
  var panel = e.target.closest("[data-tax-person]");
  if(!panel) return;
  flipTaxCard(panel, panel.getAttribute("data-tax-person"));
}
// ---------------- Tax return worksheet ----------------
// Every edit re-runs the year's figures and re-renders the section. Inputs commit on "change"
// (blur / Enter / select), not per keystroke, so a re-render never takes focus mid-number.
function afterTaxYearEdit(){
  renderTaxYear();
  persist();
}// Close the year (v3.48.0): the ticked lines become the plan. Undo puts back exactly what was
// there — the rows' amounts and histories — so it's a snapshot rather than a reversed edit.
function closeYear(fy){
  var body = document.getElementById("taxYearBody");
  var rentPicks = {}, linePicks = [];
  body.querySelectorAll("[data-cy-rent]:checked").forEach(function(b){
    var pid = b.getAttribute("data-cy-rent");
    (rentPicks[pid] = rentPicks[pid] || []).push(b.getAttribute("data-cy-key"));
  });
  body.querySelectorAll("[data-cy-line]:checked").forEach(function(b){ linePicks.push(b.getAttribute("data-cy-line")); });
  if(!Object.keys(rentPicks).length && !linePicks.length){ showToast("Tick the lines to carry into the plan"); return; }
  var before = JSON.stringify({ properties: state.properties, shared: state.shared, home: state.home });
  var today = localDateStr();
  var changed = 0;
  Object.keys(rentPicks).forEach(function(pid){
    var p = findProperty(pid);
    if(p) changed += applyRentalComparison(p, fy, rentPicks[pid], today);
  });
  if(linePicks.length) changed += applyBudgetComparison(householdBudgetLines(budgetLineItems(), state.properties), state.transactions, fy, linePicks, today);
  afterCloseYear();
  showUndoToast(changed + " line" + (changed === 1 ? "" : "s") + " updated from " + fyLabel(fy), function(){
    var snap = JSON.parse(before);
    state.properties = snap.properties; state.shared = snap.shared; state.home = snap.home;
    afterCloseYear();
  });
}// A loan's balance or offset edited on Property or Investments → Offsets is the same number the
// matching account shows (v3.56.0) — record it in that history too, so the account's chart, its
// savings-goal pace and the net worth comparison see the change wherever it was typed (v3.67.1).
// Same-day edits replace each other, so typing doesn't pile up snapshots.
function recordLoanSnapshot(loan, key, value){
  if(!Array.isArray(loan[key])) loan[key] = [];
  appendHistorySnapshot(loan[key], Math.round((Number(value) || 0) * 100) / 100, localDateStr());
}function afterCloseYear(){
  recalcComputedItems();
  renderAll();
  persist();
}// Builds the static print copy at the top level, prints, and takes it away again. afterprint
// fires once the dialog closes, whatever the user chose.
function printTaxYear(){ printStatic(taxYearPrintHtml()); }function printStatic(html){
  var root = document.getElementById("printRoot");
  if(!root){ root = document.createElement("div"); root.id = "printRoot"; document.body.appendChild(root); }
  root.innerHTML = html;
  document.body.classList.add("printing-worksheet");
  var done = function(){
    document.body.classList.remove("printing-worksheet");
    root.innerHTML = "";
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}function onTaxYearChange(e){
  var t = e.target;
  if(t.hasAttribute("data-ty-evidence")){
    taxYearToggleEvidence(t.getAttribute("data-ty-evidence"), t.checked);
    var boxes = taxDocsBody.querySelectorAll("[data-ty-evidence]");
    var on = Array.prototype.filter.call(boxes, function(b){ return b.checked; }).length;
    var count = taxDocsBody.querySelector(".ty-docs-count");
    if(count) count.textContent = on + " of " + boxes.length;
    persist();
    return;
  }
  if(t.hasAttribute("data-ty-uselines")){
    setUseBudgetLines(taxYearSelected(), t.getAttribute("data-ty-uselines"), t.checked);
    afterTaxYearEdit();
    return;
  }
  if(t.hasAttribute("data-ty-line")){
    setLineExcluded(taxYearSelected(), t.getAttribute("data-ty-person"), t.getAttribute("data-ty-line"), !t.checked);
    afterTaxYearEdit();
    return;
  }
  if(t.hasAttribute("data-ty-rent")){
    setRentalActual(taxYearSelected(), t.getAttribute("data-ty-rent"), t.getAttribute("data-ty-key"), t.value);
    afterTaxYearEdit();
    return;
  }
  if(t.hasAttribute("data-ty-kind")){
    taxYearSetField(t.getAttribute("data-ty-kind"), t.getAttribute("data-ty-person"), Number(t.getAttribute("data-ty-index")), t.getAttribute("data-ty-key"), t.value);
    afterTaxYearEdit();
  }
}

export function wireTax(){  peopleTable = document.getElementById("peopleTable");  peopleTable.addEventListener("change", function(e){
    var t = e.target, person = t.getAttribute("data-pp-person");
    if(!person) return;
    if(t.classList.contains("pp-name")){ renameTaxPerson(person, t.value); return; }
    var cls = ["pp-dob", "pp-help", "pp-cap", "pp-carry", "pp-losses", "pp-wfh", "pp-week", "pp-var"].find(function(c){ return t.classList.contains(c); });
    if(!cls || !setPersonField(person, cls, t.type === "checkbox" ? t.checked : t.value, t.getAttribute("data-fy"))) return;
    afterPeopleChange();
  });  peopleTable.addEventListener("click", function(e){
    var rm = e.target.closest("[data-pp-remove]");
    if(rm) removeTaxPerson(rm.getAttribute("data-pp-remove"));
  });  document.getElementById("addPersonBtn").addEventListener("click", function(){
    var name = prompt("Their name — they're added with a Gross income row you can fill in:");
    if(name === null) return;
    name = name.trim();
    if(!name) return;
    if(getTaxPeople().indexOf(name) !== -1){ showToast('"' + name + '" already exists'); return; }
    var row = { id: genId("inc"), what: name + "'s pay", classification: "", category: "", account: "", amount: 0, freq: "Yearly", person: name, incomeType: "Gross", superMode: "On top", sacrificeMode: "none", sacrificeValue: 0 };
    state.income.push(row);
    afterPeopleChange();
    showPage("income");
    // Deferred like runQuickAction's: the page's view transition has to settle before the row
    // modal can open over it.
    // indexOf, not length - 1: the recalculation above appends the new person's synthetic
    // net-income row after theirs.
    setTimeout(function(){ openNewRowModal("incomeGroups", "income", state.income.indexOf(row), modernIncomeRowOpen, row); }, 240);
  });  document.addEventListener("click", function(e){
    if(e.target.closest("[data-goto-people]")) openPeopleTab();
  });
  document.getElementById("taxSuperBody").addEventListener("click", function(e){
    var flipBtn = e.target.closest("[data-tax-flip]");
    if(flipBtn){
      var flipPanel = flipBtn.closest("[data-tax-person]");
      if(flipPanel) flipTaxCard(flipPanel, flipBtn.getAttribute("data-tax-flip"));
      return;
    }
    var maxCapBtn = e.target.closest("[data-tax-maxcap]");
    if(maxCapBtn){
      var maxPerson = maxCapBtn.getAttribute("data-tax-maxcap");
      var maxSettings = personTaxSettings(maxPerson);
      var maxR = computePersonTax(maxPerson);
      maxSettings.superSacrificeAnnual = Math.max(0, Math.round(maxR.capAvailable - maxR.sg - maxR.autoSacrifice));
      recalcComputedItems();
      patchSyntheticIncomeRows();
      patchIncomeGroupTotals();
      patchOpenRowBreakdowns();
      renderTaxSuper();
      renderCards();
      renderDetail();
      renderTotals();
      renderProjectionOutputs();
      persist();
    }
  });
  // Swipe a Tax & Super card (either direction) to flip it to/from the calculation breakdown on
  // mobile — same reach-vs-thumb reasoning as the Assets subnav swipe above. Only two faces exist,
  // so there's no "which direction reveals what" to get wrong — either direction just flips it.
  onHorizontalSwipe(document.getElementById("taxSuperBody"), {
    onSwipeLeft: function(e){ flipTaxCardFromSwipe(e); },
    onSwipeRight: function(e){ flipTaxCardFromSwipe(e); }
  });
  document.getElementById("taxSuperBody").addEventListener("input", function(e){
    var panel = e.target.closest("[data-tax-person]");
    if(panel){
      var person = panel.getAttribute("data-tax-person");
      var settings = personTaxSettings(person);
      var t = e.target;
      if(t.classList.contains("tax-sacrifice")) settings.superSacrificeAnnual = parseFloat(t.value) || 0;
      else if(t.classList.contains("tax-cap")) settings.concessionalCap = parseFloat(t.value) || 0;
      else if(t.classList.contains("tax-carryforward")) settings.carryForward = parseFloat(t.value) || 0;
      else if(t.classList.contains("tax-help")) settings.helpBalance = Math.max(0, parseFloat(t.value) || 0);
      else if(t.classList.contains("tax-cgt-losses")) settings.capitalLossCarriedForward = Math.max(0, parseFloat(t.value) || 0);
      else if(t.classList.contains("tax-topup-amt")) settings.topUpAmount = Math.max(0, parseFloat(t.value) || 0);
      else if(t.classList.contains("tax-ytd-asof") || t.classList.contains("tax-ytd-gross") || t.classList.contains("tax-ytd-withheld")){
        if(!settings.ytd || typeof settings.ytd !== "object") settings.ytd = {};
        if(t.classList.contains("tax-ytd-asof")) settings.ytd.asOf = t.value || "";
        else settings.ytd[t.classList.contains("tax-ytd-gross") ? "gross" : "withheld"] = Math.max(0, parseFloat(t.value) || 0);
        var ytdOut = panel.querySelector(".tax-ytd-out");
        if(ytdOut) ytdOut.innerHTML = withholdingCheckText(person);
        persist();
        return;
      }
      else if(t.classList.contains("tax-dob")){ settings.dateOfBirth = t.value || ""; patchPhiNote(); }
      else if(t.classList.contains("tax-wfh-hours")){
        if(!settings.wfhHours) settings.wfhHours = {};
        settings.wfhHours[t.getAttribute("data-fy")] = Math.max(0, parseFloat(t.value) || 0);
      }
      else return;
    } else if(e.target.id === "taxSgRate"){
      state.tax.sgRate = parseFloat(e.target.value) || 0;
    } else if(e.target.id === "taxPrivateCover"){
      state.tax.privateHospitalCover = e.target.checked;
    } else if(e.target.id === "taxFamilyThresholds"){
      state.tax.familyThresholds = e.target.checked;
    } else if(e.target.id === "taxPhiPremiums"){
      state.tax.phiPremiums = Math.max(0, parseFloat(e.target.value) || 0);
    } else if(e.target.id === "taxPhiTier"){
      state.tax.phiTierClaimed = Number(e.target.value);
      var premEl = document.getElementById("taxPhiPremiums");
      if(premEl && state.tax.phiLineId) premEl.value = phiPremiumsAnnual();
    } else if(e.target.id === "taxPhiLine"){
      state.tax.phiLineId = e.target.value || "";
      var premInput = document.getElementById("taxPhiPremiums");
      if(premInput){
        premInput.disabled = !!state.tax.phiLineId;
        premInput.value = state.tax.phiLineId ? phiPremiumsAnnual() : (Number(state.tax.phiPremiums) || 0);
      }
    } else return;

    recalcComputedItems();
    patchSyntheticIncomeRows();
    patchIncomeGroupTotals();
    patchOpenRowBreakdowns();
    patchAllTaxPersonOutputs();
    patchPhiNote();
    patchIncomeSuperNotes();
    renderCards();
    renderDetail();
    renderTotals();
    renderProjectionOutputs();
    persist();
  });  // Checks → "Open …": straight to where the fix is.
  document.getElementById("healthBody").addEventListener("click", function(e){
    // "Looks right" / "Show again" (v3.70.0)
    var ok = e.target.closest("[data-hc-dismiss], [data-hc-undismiss]");
    if(ok){
      var id = ok.getAttribute("data-hc-dismiss") || ok.getAttribute("data-hc-undismiss");
      var c = dataHealthChecks({ includeDismissed: true }).find(function(x){ return x.id === id; });
      if(c){
        var on = ok.hasAttribute("data-hc-dismiss");
        dismissCheck(c, on);
        persist(); renderHealth(); renderChecksBadge(); renderHomeSummary(); renderNotifBadge();
        if(on) showUndoToast("Marked as looking right", function(){ dismissCheck(c, false); persist(); renderHealth(); renderChecksBadge(); renderHomeSummary(); renderNotifBadge(); });
      }
      return;
    }
    // v3.144.0: a check that can fix itself.
    var fix = e.target.closest("[data-hc-fix]");
    if(fix){
      // v3.146.0: a card repayment nobody logged, at the amount checked against the statement.
      // v3.153.0: the rent the agent's statements add up to, into the plan (kept in its history).
      if(fix.getAttribute("data-hc-fix") === "rent-from-statements"){
        var rp = (state.properties || []).find(function(x){ return x.id === fix.getAttribute("data-hc-fix-arg"); });
        var rc = rp && rentCheck(rp);
        if(!rc) return;
        var rrow = rp.income[0], wasAmt = rrow.amount, wasHist = (rrow.history || []).slice();
        rrow.amount = rc.fromStatements;
        if(!Array.isArray(rrow.history)) rrow.history = [];
        appendHistorySnapshot(rrow.history, rc.fromStatements, localDateStr());
        recalcComputedItems(); persist(); renderAll(); renderHealth(); renderChecksBadge(); renderNotifBadge();
        showUndoToast("Rent set to " + fmtCurrency2.format(rc.fromStatements) + " " + rc.freq.toLowerCase(), function(){ rrow.amount = wasAmt; rrow.history = wasHist; recalcComputedItems(); persist(); renderAll(); renderHealth(); renderChecksBadge(); renderNotifBadge(); });
        return;
      }
      if(fix.getAttribute("data-hc-fix") === "card-log"){
        var arg = (fix.getAttribute("data-hc-fix-arg") || "").split("|");
        var item = fix.closest(".hc-item"), amtEl = item && item.querySelector("[data-hc-fix-amount]");
        var amount = Math.round((Number(amtEl && amtEl.value) || 0) * 100) / 100;
        if(!(amount > 0)){ showToast("Enter the statement balance"); return; }
        var card = state.accounts.find(function(a){ return a.name === arg[0]; });
        var from = card && usualCardSource(card, state.accounts, state.transfers);
        if(!card || !from){ showToast("Couldn't tell which account pays this card — log it on Cash flow → Spending"); return; }
        saveTransfer({ date: arg[1], amount: amount, from: from, to: card.name, what: card.name + " repayment" }, true, "Repayment saved");
        renderHealth(); renderChecksBadge(); renderNotifBadge();
        return;
      }
      if(fix.getAttribute("data-hc-fix") === "card-from"){
        var was = [];
        oddCardRepayments(state.accounts, state.transfers).forEach(function(o){ if(o.usual){ was.push([o.transfer, o.transfer.from]); o.transfer.from = o.usual; } });
        var redo = function(){ persist(); renderAll(); renderHealth(); renderChecksBadge(); renderNotifBadge(); };
        redo();
        showUndoToast(was.length + " repayment" + (was.length === 1 ? "" : "s") + " moved to " + (was[0] ? was[0][0].from : "the usual account"), function(){ was.forEach(function(w){ w[0].from = w[1]; }); redo(); });
      }
      return;
    }
    var go = e.target.closest(".hc-go");
    if(!go) return;
    var page = go.getAttribute("data-hc-page"), sub = go.getAttribute("data-hc-sub"), fy = go.getAttribute("data-hc-fy");
    if(page === "accounts" && sub){ showAccountsSubpage(sub); if(sub === "people") renderPeopleTab(); }
    else showPage(page);
    if(page === "expenses" && sub) showExpensesSubpage(sub, { replace: true });
    if(page === "assets" && sub) showAssetsSubpage(sub, { replace: true });
    if(page === "tax"){
      if(fy) setTaxYearSelected(fy);
      showTaxSubpage(sub || "returns", { replace: true });
      renderTaxYear();
      var close = document.querySelector("#taxYearBody .ty-close");
      if(close){ close.open = true; setTimeout(function(){ close.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60); }
    }
  });  taxYearBody = document.getElementById("taxYearBody");  taxDocsBody = document.getElementById("taxDocsBody");  taxYearBody.addEventListener("change", onTaxYearChange);  taxDocsBody.addEventListener("change", onTaxYearChange);  // "Open FY25/26" while the current year is still running: moves the whole app's period there.
  [taxYearBody, taxDocsBody].forEach(function(body){
    body.addEventListener("click", function(e){
      var b = e.target.closest("button[data-ty-year]");
      if(b) setTaxYearSelected(b.getAttribute("data-ty-year"));
    });
  });  taxDocsBody.addEventListener("click", function(e){
    if(e.target.closest("[data-ty-import]")) document.getElementById("taxYearImportFile").click();
  });  document.getElementById("taxSubnav").addEventListener("click", function(e){
    var btn = e.target.closest("[data-tax-sub]");
    if(!btn) return;
    showTaxSubpage(btn.getAttribute("data-tax-sub"));
    if(btn.getAttribute("data-tax-sub") === "people") renderPeopleTab();
    renderTaxYear();
  });  taxYearBody.addEventListener("click", function(e){
    var cyApply = e.target.closest("[data-cy-apply]");
    if(cyApply){ closeYear(Number(cyApply.getAttribute("data-cy-apply"))); return; }
    var fill = e.target.closest("[data-ty-fill]");
    if(fill){ taxYearFillStatements(fill.getAttribute("data-ty-fill")); afterTaxYearEdit(); return; }
    var add = e.target.closest("[data-ty-add]");
    if(add){
      taxYearAddRow(add.getAttribute("data-ty-add"), add.getAttribute("data-ty-person"));
      afterTaxYearEdit();
      return;
    }
    var del = e.target.closest("[data-ty-del]");
    if(del){
      var kind = del.getAttribute("data-ty-del"), who = del.getAttribute("data-ty-person"), i = Number(del.getAttribute("data-ty-index"));
      var removed = taxYearDeleteRow(kind, who, i);
      afterTaxYearEdit();
      if(removed) showUndoToast("Row deleted", function(){ taxYearRestoreRow(kind, who, i, removed); afterTaxYearEdit(); });
      return;
    }
    var lodge = e.target.closest("[data-ty-lodge]");
    if(lodge){
      taxYearMarkLodged(lodge.getAttribute("data-ty-lodge"));
      afterTaxYearEdit();
      showToast("Saved as lodged — next year's worksheet will compare against it");
      return;
    }
    if(e.target.closest("[data-ty-print]")){ printTaxYear(); return; }
    if(e.target.closest("[data-ty-import]")){ document.getElementById("taxYearImportFile").click(); return; }
    var copy = e.target.closest("[data-ty-copy]");
    if(copy){
      var text = worksheetText(copy.getAttribute("data-ty-copy"));
      try {
        navigator.clipboard.writeText(text).then(function(){ showToast("Worksheet copied"); }, function(){ showToast("Couldn't copy — select the worksheet and copy it instead"); });
      } catch(err){ showToast("Couldn't copy — select the worksheet and copy it instead"); }
    }
  });
}

export { printStatic, recordLoanSnapshot, renderPeopleTab, syncClaimFields };
