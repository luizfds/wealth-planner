// ---------------- Properties, wired (v3.206.1, item 237) ----------------
//
// A property's card — its loans, offsets, depreciation, rent and costs, a loan strategy, "If you sold" — the
// comparison list and + Add property.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order.
import { renderNotifBadge } from "./notifpanel.js";
import { logAgentStatement, removeAgentStatement, statementTotals } from "../calc/agentstatement.js";
import { recalcComputedItems } from "../calc/engine.js";
import { agentStatementFromLines } from "../calc/pdfstatement.js";
import { financialYearOf, fyLabel, recordRateChange, sortedRateHistory, loanRateOn } from "../calc/property.js";
import { recordRentReview } from "../calc/propertylife.js";
import { fmtCurrency0, fmtCurrency2, localDateStr } from "../lib/format.js";
import { pdfLines } from "../lib/pdftext.js";
import { showToast, showUndoToast } from "../lib/toast.js";
import { state, persist, genId, commit } from "../state.js";
import { renderAssetsSummary, patchOffsetsRow } from "./assets.js";
import { renderCards, renderDetail } from "./dashboard.js";
import { patchIncomeGroupTotals, patchSyntheticIncomeRows, renderTaxSuper } from "./income.js";
import { renderProjectionOutputs } from "./projections.js";
import { modernPropRowOpen, renderProperties, patchPropertyCardComputed, logPropertySnapshot, PROPERTY_SECTION_KEYS, borrowingNoteText, moveAcquisitionCostToLoan, setSaleWhatIfField, patchSaleWhatIf, setLoanStrategyField, patchLoanStrategy, propertyTabs, propertyEditing, fixedExpiryHtml, rentPanelHtml, fixedWhatIf, agentStatementUi, agentStatementFormValues } from "./properties.js";
import { renderTotals, withUndo, renderAll } from "./redraw.js";
import { findProperty, rerenderTableFor, openNewRowModal } from "./rows.js";
import { recordLoanSnapshot } from "./taxwiring.js";
import { defineSection } from "../lib/sections.js";
import { renderPropListModern } from "./properties.js";
import { renderSharedGroups } from "./expenses.js";
import { fillAgentStatementForm, openStatementForm } from "./rentstatement.js";
import { removeLedgerRecord } from "../calc/propertyactuals.js";
// ---------------- A property's lists, registered (v3.206.2, item 237b) ----------------
// "propinc:<id>" and "propexp:<id>": a property's income and costs; "loan:<id>": its loans (edited by their own
// handlers here — the generic row code only discards an untouched new one).
function propertyCardFigures(id){ var p = findProperty(id); if(p) patchPropertyCardComputed(p); }
defineSection("propinc", {
  qualified: true,
  rows: function(id){ var p = findProperty(id); return p ? p.income : null; },
  redraw: function(id){ var p = findProperty(id); if(p) renderPropListModern(p.id, "propinc:" + id, p.income, false); },
  editor: { container: "propertiesBody", openState: modernPropRowOpen },
  noClassification: true,
  taxes: true,
  afterEdit: function(id){ rerenderTableFor("propexp:" + id); patchSyntheticIncomeRows(); },
  afterAnyEdit: propertyCardFigures,
  afterAdd: function(id){ recalcComputedItems(); rerenderTableFor("propexp:" + id); patchSyntheticIncomeRows(); propertyCardFigures(id); },
  afterRemove: function(id){ patchSyntheticIncomeRows(); renderTaxSuper(); propertyCardFigures(id); }
});
defineSection("propexp", {
  qualified: true,
  rows: function(id){ var p = findProperty(id); return p ? p.expenses : null; },
  redraw: function(id){
    var p = findProperty(id);
    if(p) renderPropListModern(p.id, "propexp:" + id, p.expenses, true);
    // Same two-renderer situation as a scenario's housing: an IP's costs are shown both on its
    // Properties card and as budget lines on the Expenses page, off the one array.
    if(p && p.kind === "IP") renderSharedGroups();
  },
  // An IP's costs are editable from either end (its Properties card, or the budget list), and both write to
  // the same p.expenses array, so both need the same follow-up either way.
  inBudget: function(id){ var p = findProperty(id); return !!(p && p.kind === "IP"); },
  editor: { container: "propertiesBody", openState: modernPropRowOpen },
  taxes: true,
  afterAnyEdit: propertyCardFigures,
  afterAdd: function(id){ recalcComputedItems(); propertyCardFigures(id); },
  afterRemove: function(id){ patchSyntheticIncomeRows(); renderTaxSuper(); propertyCardFigures(id); }
});
defineSection("loan", {
  qualified: true,
  discardRows: function(id){ var p = findProperty(id); return p ? p.loans : null; },
  discard: function(){ renderProperties(); renderProjectionOutputs(); persist(); }
});

// Depreciation changes the property's taxable result, which changes each owner's taxable income,
// their synthetic net-income row, and every total derived from it — and the depreciation
// section prints a live summary, hence the full property re-render.
function refreshAfterDepreciationChange(){
  recalcComputedItems();
  renderProperties();
  renderTaxSuper();
  patchSyntheticIncomeRows();
  patchIncomeGroupTotals();
  renderCards(); renderDetail(); renderTotals();
  renderProjectionOutputs();
  persist();
}

export function wireProperties(){
  document.getElementById("propertiesBody").addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    var sectionToggleBtn = e.target.closest("[data-prop-section-toggle]");
    if(!sectionToggleBtn) return;
    e.preventDefault();
    sectionToggleBtn.click();
  });  // Fixed-rate what-if and the rent panel (v3.72.0).
  document.getElementById("propertiesBody").addEventListener("input", function(e){
    var wi = e.target.getAttribute("data-fixed-whatif");
    if(wi == null) return;
    fixedWhatIf[wi] = e.target.value === "" ? null : Number(e.target.value);
    var c = e.target.closest("[data-property-id]"), prop = c && findProperty(c.getAttribute("data-property-id"));
    var panel = c && c.querySelector("[data-fixed-panel]");
    if(!prop || !panel) return;
    var pos = e.target.selectionStart;
    panel.innerHTML = fixedExpiryHtml(prop);
    var again = panel.querySelector('[data-fixed-whatif="' + wi + '"]');
    if(again){ again.focus(); try{ again.setSelectionRange(pos, pos); }catch(err){} }
  });
  // Item 244: a payment in a property's Activity moved to another of its cost lines.
  document.getElementById("propertiesBody").addEventListener("change", function(e){
    var sel = e.target.closest("[data-pa-line]");
    if(!sel || !sel.value) return;
    var t = state.transactions.find(function(x){ return x.id === sel.getAttribute("data-pa-line"); });
    if(!t || t.linkedExpenseId === sel.value) return;
    withUndo("Moved to " + (sel.options[sel.selectedIndex].text || "another line"), function(){
      t.linkedExpenseId = sel.value;
      t.category = "";
      commit(["transactions"]);
    });
  });
  document.getElementById("propertiesBody").addEventListener("change", function(e){
    if(!e.target.hasAttribute("data-rent-next")) return;
    var c = e.target.closest("[data-property-id]"), prop = c && findProperty(c.getAttribute("data-property-id"));
    if(prop){ prop.nextRentReview = e.target.value || ""; persist(); renderAll(); }
  });
  document.getElementById("propertiesBody").addEventListener("click", function(e){
    var c = e.target.closest("[data-property-id]"), prop = c && findProperty(c.getAttribute("data-property-id"));
    if(!prop) return;
    var rentPanel = function(){ var el = c.querySelector("[data-rent-panel]"); if(el) el.innerHTML = rentPanelHtml(prop); };
    if(e.target.closest("[data-rent-review]")){
      var v = c.querySelector("[data-rent-new]").value;
      if(v === "" || isNaN(Number(v))){ showToast("Type the new rent"); return; }
      var rev = recordRentReview(prop, localDateStr(), Number(v));
      if(!rev) return;
      if(prop.nextRentReview && prop.nextRentReview <= localDateStr()) prop.nextRentReview = "";
      recalcComputedItems(); persist(); renderAll();
      showUndoToast("Rent now " + fmtCurrency0.format(rev.to) + " " + String(rev.freq).toLowerCase(), function(){ prop.income[0].amount = rev.from; prop.rentReviews.pop(); recalcComputedItems(); persist(); renderAll(); });
      return;
    }
    if(e.target.closest("[data-vac-add]")){
      var from = c.querySelector("[data-vac-from]").value, to = c.querySelector("[data-vac-to]").value;
      if(!from){ showToast("Pick the date it became vacant"); return; }
      if(!Array.isArray(prop.vacancies)) prop.vacancies = [];
      prop.vacancies.push({ from: from, to: to || "" });
      persist(); rentPanel();
      return;
    }
    var vd = e.target.closest("[data-vac-del]");
    if(vd){ prop.vacancies.splice(Number(vd.getAttribute("data-vac-del")), 1); persist(); rentPanel(); return; }
    // v3.79.0: a property manager's statement in one step.
    if(e.target.closest("[data-as-log]")){
      var asPanel = e.target.closest("[data-as-panel]");
      var vals = agentStatementFormValues(asPanel);
      // Rent already logged by hand for this statement would count twice.
      var net = statementTotals(vals).net, dayMs = 86400000;
      var already = (state.incomeLog || []).find(function(r){ return r.target === "rent:" + prop.id && Math.abs((Number(r.amount) || 0) - net) < 0.01 && Math.abs(Date.parse(r.date) - Date.parse(vals.date)) <= 31 * dayMs; });
      if(already && !confirm("Rent of " + fmtCurrency2.format(net) + " was already logged on " + already.date + ". Log this statement anyway? (Remove the earlier one on Cash flow → Income if it's the same payment.)")) return;
      var rec = logAgentStatement(state, prop, vals);
      if(!rec){ showToast("Type at least the rent collected"); return; }
      agentStatementUi.open[prop.id] = true;
      recalcComputedItems(); persist(); renderAll();
      showUndoToast("Statement logged — " + fmtCurrency2.format(rec.net) + " to you" + (rec.txIds.length ? ", " + rec.txIds.length + " bill" + (rec.txIds.length === 1 ? "" : "s") + " paid from the rent" : ""), function(){
        removeAgentStatement(state, prop, rec.id); recalcComputedItems(); persist(); renderAll();
      });
      return;
    }
    var asDel = e.target.closest("[data-as-del]");
    if(asDel){
      withUndo("Removed the statement and the rent and bills it logged", function(){
        removeAgentStatement(state, prop, asDel.getAttribute("data-as-del"));
        agentStatementUi.open[prop.id] = true;
        recalcComputedItems(); renderAll();
      });
    }
  });  // v3.92.0: fill the statement form from the manager's PDF; the person checks it and logs it.
  document.getElementById("propertiesBody").addEventListener("change", function(e){
    if(!e.target.matches || !e.target.matches("[data-as-pdf]")) return;
    var file = e.target.files && e.target.files[0];
    var asPanel = e.target.closest("[data-as-panel]");
    e.target.value = "";
    if(!file || !asPanel) return;
    showToast("Reading the statement…");
    file.arrayBuffer().then(function(buf){ return pdfLines(new Uint8Array(buf)); }).then(function(lines){
      var r = agentStatementFromLines(lines);
      if(!(r.rent > 0)){ showToast("Couldn't find the rent in that PDF — type it in"); return; }
      fillAgentStatementForm(asPanel, r);
    }).catch(function(){ showToast("Couldn't read that PDF"); });
  });
  document.getElementById("propertiesBody").addEventListener("input", function(e){
    if(!e.target.matches || !e.target.matches("[data-as]")) return;
    var asPanel = e.target.closest("[data-as-panel]"), out = asPanel && asPanel.querySelector("[data-as-net]");
    if(out) out.textContent = fmtCurrency2.format(statementTotals(agentStatementFormValues(asPanel)).net);
  });
  document.getElementById("propertiesBody").addEventListener("toggle", function(e){
    if(e.target.matches && e.target.matches("[data-as-panel]")) agentStatementUi.open[e.target.getAttribute("data-as-panel")] = e.target.open;
  }, true);
  document.getElementById("propertiesBody").addEventListener("input", function(e){
    var card = e.target.closest("[data-property-id]");
    if(!card) return;
    var property = findProperty(card.getAttribute("data-property-id"));
    if(!property) return;
    var loanTr = e.target.closest("[data-loan-index]");
    if(loanTr){
      var loan = property.loans[Number(loanTr.getAttribute("data-loan-index"))];
      if(!loan) return;
      if(e.target.classList.contains("loan-what")){
        loan.what = e.target.value;
        var loanNameEl = loanTr.querySelector(".m-row-name");
        if(loanNameEl) loanNameEl.textContent = loan.what;
      }
      else if(e.target.classList.contains("loan-fixed-until") || e.target.classList.contains("loan-revert-rate")){
        // v3.72.0: the fixed period's end and the rate after — only the "when fixed rates end" panel reads them.
        if(e.target.classList.contains("loan-fixed-until")) loan.fixedUntil = e.target.value || "";
        else loan.revertRate = e.target.value === "" ? null : Number(e.target.value);
        var fxp = card.querySelector("[data-fixed-panel]");
        if(fxp) fxp.innerHTML = fixedExpiryHtml(property);
        persist();
        return;
      }
      else if(e.target.classList.contains("loan-balance")){ loan.balance = parseFloat(e.target.value) || 0; recordLoanSnapshot(loan, "balanceHistory", loan.balance); }
      else if(e.target.classList.contains("loan-rate")) loan.rate = parseFloat(e.target.value) || 0;
      else if(e.target.classList.contains("loan-term")) loan.termYears = parseFloat(e.target.value) || 0;
      else if(e.target.classList.contains("loan-manual-amount")) loan.manualRepaymentAmount = parseFloat(e.target.value) || 0;
      else if(e.target.classList.contains("loan-settled") || e.target.classList.contains("loan-borrowing") || e.target.classList.contains("loan-borrowing-term") || e.target.classList.contains("loan-ended") || e.target.classList.contains("loan-invest-pct")){
        if(e.target.classList.contains("loan-settled")) loan.settlementDate = e.target.value || "";
        else if(e.target.classList.contains("loan-invest-pct")){
          if(e.target.value === "") delete loan.investPct;
          else loan.investPct = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
        }
        else if(e.target.classList.contains("loan-ended")) loan.endedOn = e.target.value || "";
        else if(e.target.classList.contains("loan-borrowing")) loan.borrowingCosts = Math.max(0, parseFloat(e.target.value) || 0);
        else loan.borrowingTermYears = Math.max(0, parseFloat(e.target.value) || 0);
        var borrowNote = loanTr.querySelector('[data-computed="borrow"]');
        if(borrowNote) borrowNote.textContent = borrowingNoteText(loan);
        // Moves taxable income, not cash: the tax card is what has to catch up.
        recalcComputedItems();
        renderTaxSuper();
        patchSyntheticIncomeRows();
        patchIncomeGroupTotals();
      }
      else if(e.target.classList.contains("loan-offset")){
        loan.offsetBalance = parseFloat(e.target.value) || 0;
        recordLoanSnapshot(loan, "offsetHistory", loan.offsetBalance);
        // The mirror of this file's own offset-balance-input handler — without it, editing the
        // offset from here would leave the Assets → Offsets tab showing a stale figure until the
        // next full renderAssets().
        patchOffsetsRow(property.id, Number(loanTr.getAttribute("data-loan-index")), loan.offsetBalance);
        renderAssetsSummary();
      }
      else return;
      patchPropertyCardComputed(property);
      renderProjectionOutputs();
      persist();
      return;
    }
    if(e.target.classList.contains("prop-pmfee-percent") || e.target.classList.contains("prop-pmfee-flat")){
      if(e.target.classList.contains("prop-pmfee-percent")) property.pmFee.percent = parseFloat(e.target.value) || 0;
      else property.pmFee.flat = parseFloat(e.target.value) || 0;
      recalcComputedItems();
      rerenderTableFor("propexp:" + property.id);
      patchPropertyCardComputed(property);
      renderProjectionOutputs();
      persist();
      return;
    }
    if(e.target.classList.contains("prop-what")) property.what = e.target.value;
    else if(e.target.classList.contains("prop-value")){ property.value = parseFloat(e.target.value) || 0; patchPropertyCardComputed(property); }
    else return;
    renderProjectionOutputs();
    persist();
  });
  document.getElementById("propertiesBody").addEventListener("change", function(e){
    var card = e.target.closest("[data-property-id]");
    if(!card) return;
    var property = findProperty(card.getAttribute("data-property-id"));
    if(!property) return;
    var loanTr = e.target.closest("[data-loan-index]");
    if(loanTr){
      var loan = property.loans[Number(loanTr.getAttribute("data-loan-index"))];
      if(!loan) return;
      if(e.target.classList.contains("loan-type")) loan.repaymentType = e.target.value;
      else if(e.target.classList.contains("loan-repay-mode")) loan.repaymentMode = e.target.value;
      else if(e.target.classList.contains("loan-repay-freq")) loan.manualRepaymentFreq = e.target.value;
      else return;
      renderProperties();
      renderProjectionOutputs();
      persist();
      return;
    }
    if(e.target.classList.contains("prop-kind")){
      property.kind = e.target.value;
      recalcComputedItems();
      renderProperties();
      rerenderTableFor("income");
      renderTaxSuper();
      renderProjectionOutputs();
      persist();
      return;
    }
    // Ownership %. On `change` (blur/Enter), not `input`, so a full card rebuild can't yank the
    // field out from under someone mid-keystroke — same trade-off the depreciation fields below
    // already make, and the section header total and the "doesn't add to 100%" warning both have
    // to move with the value. A blank field means 0%, not "unset": leaving one person out is how
    // you say a property is owned solely by the other, so it has to be expressible.
    if(e.target.classList.contains("prop-ownership")){
      var ownershipPerson = e.target.getAttribute("data-ownership-person");
      if(!property.ownership) property.ownership = {};
      property.ownership[ownershipPerson] = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
      renderProperties();
      // Same downstream set as depreciation: whose taxable income carries this property's result
      // is exactly what just changed.
      renderTaxSuper();
      patchSyntheticIncomeRows();
      patchIncomeGroupTotals();
      renderCards(); renderDetail(); renderTotals();
      renderProjectionOutputs();
      persist();
      return;
    }
    // Quantity surveyor's schedule rows — same full re-render as the depreciation fields below, for
    // the same reason: the section total and every owner's tax figures move with them.
    if(e.target.hasAttribute("data-dep-sched-index")){
      var schedRow = property.depreciationSchedule[Number(e.target.getAttribute("data-dep-sched-index"))];
      if(!schedRow) return;
      if(e.target.classList.contains("dep-sched-fy")) schedRow.fy = Number(e.target.value);
      else if(e.target.classList.contains("dep-sched-cw")) schedRow.capitalWorks = Math.max(0, parseFloat(e.target.value) || 0);
      else if(e.target.classList.contains("dep-sched-plant")) schedRow.plant = Math.max(0, parseFloat(e.target.value) || 0);
      else return;
      refreshAfterDepreciationChange();
      return;
    }
    // Depreciation. Full re-render for the same reason prop-purchase-price uses one: the section
    // prints a live "capital works + plant = $X/yr" summary and a section total in its header, and
    // both have to move together with the tax figures below.
    if(e.target.classList.contains("prop-construction-cost") || e.target.classList.contains("prop-construction-date") ||
       e.target.classList.contains("prop-plant-value") || e.target.classList.contains("prop-plant-life") ||
       e.target.classList.contains("prop-plant-secondhand")){
      if(e.target.classList.contains("prop-plant-secondhand")) property.plantSecondHand = e.target.checked;
      else if(e.target.classList.contains("prop-construction-cost")) property.constructionCost = Math.max(0, parseFloat(e.target.value) || 0);
      else if(e.target.classList.contains("prop-construction-date")) property.constructionDate = e.target.value;
      else if(e.target.classList.contains("prop-plant-value")) property.plantValue = Math.max(0, parseFloat(e.target.value) || 0);
      else property.plantEffectiveLife = Math.max(1, parseFloat(e.target.value) || 10);
      refreshAfterDepreciationChange();
      return;
    }
    if(e.target.classList.contains("prop-land-value") || e.target.classList.contains("prop-state")){
      // Full re-render of every property, not a patch and not just this card: land tax is assessed
      // on the *combined* land value of all this state's investment properties, so changing one
      // property's land value or state changes what every other property in that state owes, and
      // the explanatory note under each of them. recalcComputedItems() (called by renderAll's
      // chain) is what turns that into each property's "Land Tax" expense row.
      if(e.target.classList.contains("prop-land-value")) property.landValue = parseFloat(e.target.value) || 0;
      else property.state = e.target.value;
      renderAll();
      persist();
      return;
    }
    if(e.target.classList.contains("prop-purchase-price") || e.target.classList.contains("prop-purchase-date")){
      // Full re-render (like prop-kind above), not a patch — Capital gain and the yield-on-cost
      // badge only exist in the DOM once purchasePrice is set, so a patch here could be patching
      // an element that was never rendered in the first place (going from unset to set).
      if(e.target.classList.contains("prop-purchase-price")) property.purchasePrice = e.target.value === "" ? null : (parseFloat(e.target.value) || 0);
      else property.purchaseDate = e.target.value;
      renderProperties();
      persist();
      return;
    }
    if(e.target.hasAttribute("data-acq-cost-index")){
      // Editing an existing row's fields, not adding/removing one — Capital gain and yield-on-cost
      // already exist in the DOM whenever purchasePrice is set (unaffected by whether any
      // acquisition-cost rows exist yet), so this can use the fast patch path, same as prop-value.
      // cc-what/cc-amount are the same shared classes scenarios.js's own cost list uses (see
      // properties.js's acquisitionCostRowHtml) — safe to key off directly since this whole
      // handler is already scoped to #propertiesBody, nowhere near that other list's container.
      var acqIdx = Number(e.target.getAttribute("data-acq-cost-index"));
      var costItem = property.acquisitionCosts[acqIdx];
      if(!costItem) return;
      if(e.target.classList.contains("cc-what")) costItem.what = e.target.value;
      else costItem.amount = parseFloat(e.target.value) || 0;
      patchPropertyCardComputed(property);
      persist();
      return;
    }
    if(e.target.classList.contains("prop-income-paid-freq")){
      // Informational only (see propertyCardHtml's incomePaidPanel comment) — nothing else on
      // screen depends on this value, so no recompute/re-render needed beyond persisting it.
      property.incomePaidFreq = e.target.value;
      persist();
    }
  });
  // v3.107.0: Edit details / Done on a property's Overview. Both views are rendered; the card's class
  // picks one, so nothing typed is lost. Done re-renders so the summary shows what was just edited.
  document.getElementById("propertiesBody").addEventListener("click", function(e){
    var edit = e.target.closest("[data-prop-edit]"), done = e.target.closest("[data-prop-edit-done]");
    if(!edit && !done) return;
    var pid = (edit || done).getAttribute(edit ? "data-prop-edit" : "data-prop-edit-done");
    propertyEditing[pid] = !!edit;
    if(edit){
      var card = edit.closest(".property-card");
      card.classList.add("is-editing");
      var first = card.querySelector('.prop-edit input');
      if(first) first.focus();
    } else renderProperties();
  });  // A property's tabs (v3.61.0): every panel is already rendered, so switching is a visibility
  // toggle — no re-render, nothing typed in another tab is lost.
  document.getElementById("propertiesBody").addEventListener("click", function(e){
    // v3.208.0 (item 240): the Overview tab's "Log a statement" opens the form on Income & costs.
    var asOpen = e.target.closest("[data-as-open]");
    if(asOpen){ var asProp = findProperty(asOpen.getAttribute("data-as-open")); if(asProp) openStatementForm(asProp); return; }
    var tab = e.target.closest("[data-prop-tab]");
    if(!tab) return;
    var pid = tab.getAttribute("data-prop-tab"), key = tab.getAttribute("data-tab");
    propertyTabs[pid] = key;
    var card = tab.closest(".property-card");
    card.querySelectorAll("[data-prop-tab]").forEach(function(b){ var on = b === tab; b.classList.toggle("active", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
    card.querySelectorAll("[data-prop-panel]").forEach(function(pn){ pn.hidden = pn.getAttribute("data-prop-panel") !== key; });
  });
  document.getElementById("propertiesBody").addEventListener("click", function(e){
    var sectionToggleBtn = e.target.closest("[data-prop-section-toggle]");
    if(sectionToggleBtn){
      var toggleCard = sectionToggleBtn.closest("[data-property-id]");
      var toggleProperty = toggleCard && findProperty(toggleCard.getAttribute("data-property-id"));
      if(!toggleProperty) return;
      var sectionKey = sectionToggleBtn.getAttribute("data-prop-section-toggle");
      if(!toggleProperty.sectionsCollapsed) toggleProperty.sectionsCollapsed = {};
      toggleProperty.sectionsCollapsed[sectionKey] = !toggleProperty.sectionsCollapsed[sectionKey];
      renderProperties();
      persist();
      return;
    }
    var collapseAllBtn = e.target.closest("[data-prop-collapse-toggle]");
    if(collapseAllBtn){
      var collapseProperty = findProperty(collapseAllBtn.getAttribute("data-prop-collapse-toggle"));
      if(!collapseProperty) return;
      if(!collapseProperty.sectionsCollapsed) collapseProperty.sectionsCollapsed = {};
      var wasAllCollapsed = PROPERTY_SECTION_KEYS.every(function(k){ return !!collapseProperty.sectionsCollapsed[k]; });
      PROPERTY_SECTION_KEYS.forEach(function(k){ collapseProperty.sectionsCollapsed[k] = !wasAllCollapsed; });
      renderProperties();
      persist();
      return;
    }
    var addLoanBtn = e.target.closest("[data-loan-add]");
    if(addLoanBtn){
      var forProperty = findProperty(addLoanBtn.getAttribute("data-loan-add"));
      if(forProperty){
        var newLoan = { id: genId("l"), what:"New loan", balance:0, rate:0, termYears:30, repaymentType:"PI", repaymentMode:"auto", manualRepaymentAmount:0, manualRepaymentFreq:"Monthly", offsetBalance:0 };
        forProperty.loans.push(newLoan);
        renderProperties();
        openNewRowModal("propertiesBody", "loan:" + forProperty.id, forProperty.loans.length - 1, modernPropRowOpen, newLoan);
        renderProjectionOutputs();
        persist();
      }
      return;
    }
    // Item 244: a property's Activity — remove a record, or type a loan interest charge.
    var paDel = e.target.closest("[data-pa-del]");
    if(paDel){
      var paCard = e.target.closest("[data-property-id]"), paProp = paCard && findProperty(paCard.getAttribute("data-property-id"));
      if(!paProp) return;
      var parts = paDel.getAttribute("data-pa-del").split(":");
      withUndo("Removed from " + (paProp.what || "the property"), function(){
        if(!removeLedgerRecord(state, paProp, parts[0], parts[1], parts[2])) return false;
        commit(["properties", "transactions", "incomeLog"]);
      });
      return;
    }
    var paAdd = e.target.closest("[data-pa-charge-add]");
    if(paAdd){
      var aProp = findProperty(paAdd.getAttribute("data-pa-charge-add")), box = paAdd.closest(".pa-add-row");
      var aLoan = aProp && (aProp.loans || []).find(function(l){ return l.id === box.querySelector("[data-pa-charge-loan]").value; });
      var aDate = box.querySelector("[data-pa-charge-date]").value, aAmt = parseFloat(box.querySelector("[data-pa-charge-amount]").value);
      if(!aLoan || !aDate || !(aAmt > 0)){ showToast("Type the date and the interest charged"); return; }
      withUndo("Interest charge added to " + (aLoan.what || "the loan"), function(){
        if(!Array.isArray(aLoan.charges)) aLoan.charges = [];
        aLoan.charges.push({ id: genId("lc"), date: aDate, amount: Math.round(aAmt * 100) / 100, kind: "interest", what: "Interest charge (typed)" });
        commit(["properties"]);
      });
      return;
    }
    // Item 243: the bank's repayment, from the loan's last imported statement, becomes the one it uses.
    var useBank = e.target.closest("[data-loan-usebank]");
    if(useBank){
      var bCard = e.target.closest("[data-property-id]"), bRow = e.target.closest("[data-loan-index]");
      var bProp = bCard && findProperty(bCard.getAttribute("data-property-id"));
      var bLoan = bProp && bRow && bProp.loans[Number(bRow.getAttribute("data-loan-index"))];
      if(!bLoan || !bLoan.bankRepayment) return;
      withUndo((bLoan.what || "The loan") + " now uses the bank's repayment", function(){
        bLoan.repaymentMode = "manual";
        bLoan.manualRepaymentAmount = Number(bLoan.bankRepayment.amount) || 0;
        bLoan.manualRepaymentFreq = bLoan.bankRepayment.freq || "Monthly";
        commit(["properties"]);
      });
      return;
    }
    // Rate changes (v3.53.0): recorded with their date; a past year's interest follows them.
    var rateRec = e.target.closest("[data-rate-record]"), rateDel = e.target.closest("[data-rate-del]");
    if(rateRec || rateDel){
      var rCard = e.target.closest("[data-property-id]"), rRow = e.target.closest("[data-loan-index]");
      var rProp = rCard && findProperty(rCard.getAttribute("data-property-id"));
      var rLoan = rProp && rRow && rProp.loans[Number(rRow.getAttribute("data-loan-index"))];
      if(!rLoan) return;
      if(rateRec){
        var newRate = parseFloat(rRow.querySelector(".loan-rate-new").value);
        var onDate = rRow.querySelector(".loan-rate-date").value;
        if(!(newRate > 0) || !onDate){ showToast("Type the new rate and the date it applies from"); return; }
        recordRateChange(rLoan, onDate, newRate, localDateStr());
      } else {
        var hist = sortedRateHistory(rLoan);
        hist.splice(Number(rateDel.getAttribute("data-rate-del")), 1);
        rLoan.rateHistory = hist;
        if(hist.length) rLoan.rate = loanRateOn(rLoan, localDateStr());
      }
      recalcComputedItems();
      renderProperties();
      renderTaxSuper();
      patchSyntheticIncomeRows();
      renderProjectionOutputs();
      renderNotifBadge();
      persist();
      return;
    }
    var delLoanBtn = e.target.closest("[data-loan-del]");
    if(delLoanBtn){
      var loanCard = e.target.closest("[data-property-id]");
      var loanProperty = loanCard ? findProperty(loanCard.getAttribute("data-property-id")) : null;
      if(loanProperty){
        var li = Number(delLoanBtn.getAttribute("data-loan-del"));
        var removedLoan = loanProperty.loans[li];
        loanProperty.loans.splice(li, 1);
        renderProperties();
        renderProjectionOutputs();
        persist();
        showUndoToast('Deleted loan "' + (removedLoan.what || "Loan") + '"', function(){
          loanProperty.loans.splice(Math.min(li, loanProperty.loans.length), 0, removedLoan);
          renderProperties();
          renderProjectionOutputs();
          persist();
        });
      }
      return;
    }
    var addSchedBtn = e.target.closest("[data-dep-sched-add]");
    if(addSchedBtn){
      var schedProperty = findProperty(addSchedBtn.getAttribute("data-dep-sched-add"));
      if(schedProperty){
        var sched = schedProperty.depreciationSchedule;
        // The year after the last one listed, which is how a report is read off top to bottom;
        // the first row defaults to the year the property was bought.
        var nextFy = sched.length ? Math.max.apply(null, sched.map(function(r){ return Number(r.fy) || 0; })) + 1
          : financialYearOf(schedProperty.purchaseDate || localDateStr());
        sched.push({ fy: nextFy, capitalWorks: 0, plant: 0 });
        refreshAfterDepreciationChange();
      }
      return;
    }
    var delSchedBtn = e.target.closest("[data-dep-sched-del]");
    if(delSchedBtn){
      var schedCard = e.target.closest("[data-property-id]");
      var schedProperty2 = schedCard ? findProperty(schedCard.getAttribute("data-property-id")) : null;
      if(schedProperty2){
        var si = Number(delSchedBtn.getAttribute("data-dep-sched-del"));
        var removedRow = schedProperty2.depreciationSchedule.splice(si, 1)[0];
        refreshAfterDepreciationChange();
        showUndoToast("Deleted " + fyLabel(Number(removedRow.fy)) + " from the schedule", function(){
          schedProperty2.depreciationSchedule.splice(Math.min(si, schedProperty2.depreciationSchedule.length), 0, removedRow);
          refreshAfterDepreciationChange();
        });
      }
      return;
    }
    var addAcqCostBtn = e.target.closest("[data-acq-cost-add]");
    if(addAcqCostBtn){
      var acqCostProperty = findProperty(addAcqCostBtn.getAttribute("data-acq-cost-add"));
      if(acqCostProperty){
        acqCostProperty.acquisitionCosts.push({ id: genId("ac"), what: "New cost", amount: 0 });
        renderProperties();
        persist();
      }
      return;
    }
    var moveAcqBtn = e.target.closest("[data-acq-cost-move]");
    if(moveAcqBtn){
      var moveCard = e.target.closest("[data-property-id]");
      var moveProperty = moveCard ? findProperty(moveCard.getAttribute("data-property-id")) : null;
      if(moveProperty){
        var moved = moveAcquisitionCostToLoan(moveProperty, Number(moveAcqBtn.getAttribute("data-acq-cost-move")));
        if(moved){
          refreshAfterDepreciationChange();
          showUndoToast('Moved "' + (moved.cost.what || "cost") + '" to ' + (moved.loan.what || "the loan") + "'s borrowing costs", function(){
            moved.undo();
            refreshAfterDepreciationChange();
          });
        }
      }
      return;
    }
    var delAcqCostBtn = e.target.closest("[data-acq-cost-del]");
    if(delAcqCostBtn){
      var acqCostCard = e.target.closest("[data-property-id]");
      var acqCostProperty2 = acqCostCard ? findProperty(acqCostCard.getAttribute("data-property-id")) : null;
      if(acqCostProperty2){
        var aci = Number(delAcqCostBtn.getAttribute("data-acq-cost-del"));
        var removedCost = acqCostProperty2.acquisitionCosts[aci];
        acqCostProperty2.acquisitionCosts.splice(aci, 1);
        renderProperties();
        persist();
        showUndoToast('Deleted "' + (removedCost.what || "cost") + '"', function(){
          acqCostProperty2.acquisitionCosts.splice(Math.min(aci, acqCostProperty2.acquisitionCosts.length), 0, removedCost);
          renderProperties();
          persist();
        });
      }
      return;
    }
    var propLogBtn = e.target.closest("[data-property-log]");
    if(propLogBtn){ logPropertySnapshot(propLogBtn.getAttribute("data-property-log")); return; }
    var delPropBtn = e.target.closest("[data-property-del]");
    if(delPropBtn){
      var pid = delPropBtn.getAttribute("data-property-del");
      var pidx = state.properties.findIndex(function(p){ return p.id === pid; });
      if(pidx === -1) return;
      var removedProperty = state.properties[pidx];
      var afterPropertyDelete = function(){
        recalcComputedItems();
        renderProperties();
        rerenderTableFor("income");
        renderTaxSuper();
        renderProjectionOutputs();
        persist();
      };
      state.properties.splice(pidx, 1);
      afterPropertyDelete();
      showUndoToast('Deleted "' + (removedProperty.what || "Property") + '"', function(){
        state.properties.splice(Math.min(pidx, state.properties.length), 0, removedProperty);
        afterPropertyDelete();
      });
    }
  });
  // Portfolio-wide comparison list (rendered above #propertiesBody) doubles as jump-nav — click
  // a row to scroll straight to that property's card, useful once there's enough properties that
  // the list itself is a shorter overview than scrolling past every card to find the one you want.
  document.getElementById("propertiesCompareList").addEventListener("click", function(e){
    var jumpBtn = e.target.closest("[data-jump-property]");
    if(!jumpBtn) return;
    var target = document.getElementById("property-card-" + jumpBtn.getAttribute("data-jump-property"));
    if(target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("addPropertyBtn").addEventListener("click", function(){
    var newPropId = genId("p");
    propertyEditing[newPropId] = true; // a new property has nothing to summarise yet — open its fields
    state.properties.push({ id: newPropId, what:"New property", kind:"IP", value:0, purchasePrice:null, purchaseDate:"", acquisitionCosts:[], history:[], pmFee:{percent:6, flat:5.5}, incomePaidFreq:"Monthly", sectionsCollapsed:{acquisition:true, ownership:true, loans:true, income:true, expenses:true}, ownership:{}, loans:[], income:[], expenses:[] });
    recalcComputedItems();
    renderProperties();
    renderProjectionOutputs();
    persist();
  });
}

export function wirePropertyExtras(){  // v3.41.0: Loan strategy on a property card.
  document.addEventListener("change", function(e){
    if(!e.target.matches) return;
    var host = e.target.closest("[data-strategy-property]");
    if(!host) return;
    var prop = findProperty(host.getAttribute("data-strategy-property"));
    if(!prop) return;
    if(e.target.matches("[data-strategy-pick]")){ prop.strategyLoan = Number(e.target.value) || 0; persist(); patchLoanStrategy(prop); return; }
    if(e.target.matches("[data-strategy-field]")){
      setLoanStrategyField(prop, Number(e.target.getAttribute("data-strategy-loan")), e.target.getAttribute("data-strategy-field"), e.target.value);
      patchLoanStrategy(prop);
    }
  });  // v3.39.0: "If you sold" on an investment property card.
  document.addEventListener("change", function(e){
    if(!e.target.matches || !e.target.matches("[data-sale-field]")) return;
    var host = e.target.closest("[data-sale-property]");
    var prop = host && findProperty(host.getAttribute("data-sale-property"));
    if(!prop) return;
    setSaleWhatIfField(prop, e.target.getAttribute("data-sale-field"), e.target.value);
    patchSaleWhatIf(prop);
  });
}
