// ---------------- Investments, wired (v3.206.1, item 237) ----------------
//
// Investments' rows (assets, shares, super), debts, the Offsets tab, "Showing <person>", lots, payouts,
// statements and sales, share prices from a sheet or the price file, a broker's trades, the exchange rate and
// how the holdings compare with the market.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order. What it shares with app.js it reaches through `app` (lib/appctx.js).
import { applyTrades, parseTradeSheets } from "../calc/brokertrades.js";
import { recalcComputedItems, totalDebtsValue } from "../calc/engine.js";
import { parseCsvGrid } from "../calc/pricesheet.js";
import { saleCapitalGain, lotsUnitsAvailable } from "../calc/tax.js";
import { app } from "../lib/appctx.js";
import { exportSharesPriceTemplateCsv, copySharesPriceTemplateToClipboard, copyPriceSheetTemplate } from "../lib/backup.js";
import { fmtCurrency0, localDateStr } from "../lib/format.js";
import { showToast, showUndoToast } from "../lib/toast.js";
import { readXlsx } from "../lib/xlsx.js";
import { state, persist, genId, normalizeShareAsset } from "../state.js";
import { patchHoldingRow, patchVehicleRow, patchAssetCategoryTotals, renderNetWorthPanel, renderAssets, renderBenchmark, logAssetSnapshot, applySharesPaste, logDebtSnapshot, setUsdAudRate, patchSharesGlance, setAssetPersonFilter, renderAssetPersonFilter, renderAssetPersonSheet, assetPersonSheetOpen, setAssetPersonSheetOpen, setSharesGainFilter, setSharesSortMode, setSharesChangeWindow, setAllocationRange, setPortfolioRange, clearAssetsImportPreview, commitAssetsImport, dividendNoteText, recordAssetSale, deleteAssetSale, renderAssetsSummary, patchOffsetsRow, addAssetLot, syncAvgCostFromLots, lotsSectionHtml, lotsNoteText, addAssetStatement, statementsSectionHtml, payoutsSectionHtml, payoutsNoteText, addAssetPayout } from "./assets.js";
import { refreshAutoPrices, autoPricesResultText } from "./autoprices.js";
import { tradesUi, readTradesText, useParsedTrades, currentTradePlan } from "./brokertrades.js";
import { renderCards, renderDashboardStats, renderDetail, setProjectionReference, logNetWorthSnapshot } from "./dashboard.js";
import { clearExpensesImportPreview, commitExpensesImport } from "./expenses.js";
import { patchIncomeGroupTotals, patchSyntheticIncomeRows, renderTaxSuper, clearIncomeImportPreview, commitIncomeImport } from "./income.js";
import { bench, benchmarkCardHtml, targetMixCardHtml } from "./investreturn.js";
import { showPage } from "./nav.js";
import { refreshPriceSheet, priceSheetResultText, defaultBackfillFrom, priceSheetUi } from "./pricesheet.js";
import { renderProjectionOutputs } from "./projections.js";
import { patchPropertyCardComputed } from "./properties.js";
import { renderTotals, withUndo, renderAll, updatePersonSuggestions } from "./redraw.js";
import { findProperty, refreshAfterLedgerChange } from "./rows.js";
import { recordLoanSnapshot } from "./taxwiring.js";

// Navigating to another page while an overlay is open (open a row, tap another tab) used to
// leave it open and, worse, strand its history entry under the page entry syncUrl() then
// pushes — after which the overlay's own close path went back a *page* instead of closing it.
// nav.js calls this from showPage before it writes that entry; no history here, since it's
// about to be rewritten anyway.
// A sale changes units held (so the portfolio and net worth), and an assessable gain changes
// taxable income (so the tax card and every net figure). Both halves, in one place, because
// forgetting either leaves the app visibly disagreeing with itself.
// Adding or removing a lot rebuilds the holding's editor; the "Purchase lots" section is reopened
// afterwards so the row you just added is in front of you rather than behind a closed summary.
// Swaps just that section's markup rather than calling renderAssets(), which would close the
// holding's editor out from under the user mid-entry.
function afterLotListChange(idx){
  var item = state.assets[idx];
  var row = document.querySelector('.m-asset-rows [data-index="' + idx + '"]');
  var lotsDetails = row && row.querySelector("details.lots-section");
  if(item && lotsDetails){
    var holder = document.createElement("div");
    holder.innerHTML = lotsSectionHtml(item, idx);
    var fresh = holder.firstElementChild;
    fresh.open = true;
    lotsDetails.replaceWith(fresh);
    var avgInput = row.querySelector(".h-avgcost");
    if(avgInput) avgInput.value = item.avgCost != null ? item.avgCost : "";
    var hasLots = lotsUnitsAvailable(item) > 0;
    var cbInput = row.querySelector(".h-sale-costbase");
    if(cbInput) cbInput.placeholder = hasLots ? "from purchase lots" : (item.avgCost != null ? "avg cost x units" : "0");
    var acqInput = row.querySelector(".h-sale-acquired");
    if(acqInput){ if(hasLots) acqInput.placeholder = "from purchase lots"; else acqInput.removeAttribute("placeholder"); }
    patchHoldingRow(row, item);
    patchSharesGlance();
  } else {
    renderAssets();
  }
  persist();
}// v3.38.0: the same in-place swap for distributions, then the tax chain.
function afterPayoutListChange(idx){
  var item = state.assets[idx];
  var row = document.querySelector('.m-asset-rows [data-index="' + idx + '"]');
  var sec = row && row.querySelector("details.payouts-section");
  if(item && sec){
    var holder = document.createElement("div");
    holder.innerHTML = payoutsSectionHtml(item, idx);
    var fresh = holder.firstElementChild;
    fresh.open = true;
    sec.replaceWith(fresh);
  } else {
    renderAssets();
  }
  afterPayoutChange();
}function afterPayoutChange(){
  recalcComputedItems();
  renderTaxSuper();
  patchSyntheticIncomeRows();
  patchIncomeGroupTotals();
  renderCards(); renderDetail(); renderTotals();
  renderProjectionOutputs();
  persist();
}// Same in-place swap as afterLotListChange, then the tax chain — a statement is taxable income.
function afterStatementListChange(idx){
  var item = state.assets[idx];
  var row = document.querySelector('.m-asset-rows [data-index="' + idx + '"]');
  var sec = row && row.querySelector("details.stmts-section");
  if(item && sec){
    var holder = document.createElement("div");
    holder.innerHTML = statementsSectionHtml(item, idx);
    var fresh = holder.firstElementChild;
    fresh.open = true;
    sec.replaceWith(fresh);
  } else {
    renderAssets();
  }
  recalcComputedItems();
  renderTaxSuper();
  patchSyntheticIncomeRows();
  patchIncomeGroupTotals();
  renderCards(); renderDetail(); renderTotals();
  renderProjectionOutputs();
  persist();
}function afterAssetSaleChange(){
  recalcComputedItems();
  renderAssets();
  renderTaxSuper();
  patchSyntheticIncomeRows();
  patchIncomeGroupTotals();
  renderCards(); renderDetail(); renderTotals();
  renderProjectionOutputs();
  persist();
}// ---------------- Assets: "Showing <person>" sheet ----------------
function closeAssetPersonSheetUi(){
  setAssetPersonSheetOpen(false);
  renderAssetPersonSheet();
}function openAssetPersonSheet(){
  setAssetPersonSheetOpen(true);
  renderAssetPersonSheet();
  if(document.querySelector("[data-asset-person-backdrop]")) app.pushActiveOverlay(closeAssetPersonSheetUi);
}
// ---------------- Share prices from a Google Sheet (v3.75.0) ----------------
// Read once a day on open when a link is set; "Read now" reads on demand. Either way the result
// line on Investments → Shares says what happened, and a failure never touches a price.
function readPriceSheetNow(manual){
  var btn = document.querySelector("[data-ps-read]");
  if(btn){ btn.disabled = true; btn.textContent = "Reading…"; }
  return refreshPriceSheet().then(function(r){
    recalcComputedItems();
    renderAll();
    if(manual || !r.ok || r.updated || r.backfilled) showToast(r.ok ? "Prices: " + priceSheetResultText(r) : r.reason);
    return r;
  });
}// v3.132.0: automatic prices first, then the person's own Sheet (which wins where both price a holding).
function readAutoPricesNow(manual){
  var btn = document.querySelector("[data-ap-read]");
  if(btn){ btn.disabled = true; btn.textContent = "Updating…"; }
  return refreshAutoPrices().then(function(r){
    recalcComputedItems();
    renderAll();
    if(manual || !r.ok) showToast("Prices: " + autoPricesResultText(r));
    return r;
  });
}
// ---------------- Against the market, a target mix (v3.178.0, item 203) ----------------
function redrawCard(id, html){ var el = document.getElementById(id); if(el) el.outerHTML = html; }
// ---------------- Investments → Shares → Import trades (v3.91.0) ----------------
function afterTradesRead(parsed){
  tradesUi.open = true;
  renderAssets();
  if(!parsed.trades.length) showToast("No trades found in that file");
}

export function wireAssets(){
  document.addEventListener("input", function(e){
    if(e.target.closest(".m-asset-rows")){
      var tr = e.target.closest("[data-index]");
      if(!tr) return;
      var idx = Number(tr.getAttribute("data-index"));
      var item = state.assets[idx];
      if(!item) return;
      if(e.target.classList.contains("a-what")) item.what = e.target.value;
      else if(e.target.classList.contains("a-amount")) item.amount = parseFloat(e.target.value) || 0;
      else if(e.target.classList.contains("a-person")) item.person = e.target.value;
      else if(e.target.classList.contains("h-what")) item.what = e.target.value;
      else if(e.target.classList.contains("h-symbol")) item.symbol = e.target.value;
      else if(e.target.classList.contains("h-qty")){
        item.quantity = parseFloat(e.target.value) || 0;
        item.amount = Math.round(item.quantity * (Number(item.price) || 0) * 100) / 100;
        patchHoldingRow(tr, item);
        patchSharesGlance();
      }
      // A dividend change moves that person's taxable income, so it has to re-run the tax chain —
      // unlike price/qty, which only move the holding's value.
      else if(e.target.classList.contains("h-dividend") || e.target.classList.contains("h-franked")){
        if(e.target.classList.contains("h-dividend")) item.dividendPerUnit = Math.max(0, parseFloat(e.target.value) || 0);
        else item.frankedPct = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
        var divNote = tr.querySelector(".h-div-note");
        if(divNote) divNote.textContent = dividendNoteText(item);
        recalcComputedItems();
        renderTaxSuper();
        patchSyntheticIncomeRows();
        patchIncomeGroupTotals();
        renderCards(); renderDetail(); renderTotals();
        renderProjectionOutputs();
      }
      // v3.38.0: distributions received — edit in place, then the tax chain (they're income).
      else if(e.target.hasAttribute("data-payout-index")){
        var po = (item.payouts || [])[Number(e.target.getAttribute("data-payout-index"))];
        if(!po) return;
        if(e.target.classList.contains("po-date")) po.date = e.target.value;
        else if(e.target.classList.contains("po-cash")) po.cash = Math.max(0, parseFloat(e.target.value) || 0);
        else if(e.target.classList.contains("po-credit")) po.credit = Math.max(0, parseFloat(e.target.value) || 0);
        var poNote = tr.querySelector(".payouts-note");
        if(poNote) poNote.textContent = payoutsNoteText(item);
        afterPayoutChange();
      }
      // Purchase lots: edit in place. Avg cost follows the lots so the holding's gain figure agrees
      // with them; the cost-base change doesn't move tax (only a recorded sale does), so no tax re-run.
      else if(e.target.hasAttribute("data-lot-index")){
        var lot = (item.lots || [])[Number(e.target.getAttribute("data-lot-index"))];
        if(!lot) return;
        if(e.target.classList.contains("lot-date")) lot.date = e.target.value;
        else if(e.target.classList.contains("lot-units")) lot.units = Math.max(Number(lot.soldUnits) || 0, parseFloat(e.target.value) || 0);
        else if(e.target.classList.contains("lot-price")) lot.price = Math.max(0, parseFloat(e.target.value) || 0);
        else if(e.target.classList.contains("lot-brokerage")) lot.brokerage = Math.max(0, parseFloat(e.target.value) || 0);
        syncAvgCostFromLots(item);
        var lotsNote = tr.querySelector(".lots-note");
        if(lotsNote) lotsNote.textContent = lotsNoteText(item);
        var avgInput = tr.querySelector(".h-avgcost");
        if(avgInput && document.activeElement !== avgInput) avgInput.value = item.avgCost != null ? item.avgCost : "";
        patchHoldingRow(tr, item);
        patchSharesGlance();
      }
      // A statement figure moves taxable income, so it re-runs the tax chain like a dividend edit.
      else if(e.target.classList.contains("stmt-field") || e.target.classList.contains("stmt-fy")){
        var st = (item.taxStatements || [])[Number(e.target.getAttribute("data-stmt-index"))];
        if(!st) return;
        if(e.target.classList.contains("stmt-fy")) st.fy = Number(e.target.value);
        else st[e.target.getAttribute("data-stmt-key")] = parseFloat(e.target.value) || 0;
        recalcComputedItems();
        renderTaxSuper();
        patchSyntheticIncomeRows();
        patchIncomeGroupTotals();
        renderCards(); renderDetail(); renderTotals();
        renderProjectionOutputs();
      }
      else if(e.target.classList.contains("h-avgcost")){
        item.avgCost = e.target.value === "" ? null : (parseFloat(e.target.value) || 0);
        patchHoldingRow(tr, item);
        patchSharesGlance();
      }
      else if(e.target.classList.contains("h-price")){
        item.price = parseFloat(e.target.value) || 0;
        item.priceUpdated = localDateStr();
        item.amount = Math.round((Number(item.quantity) || 0) * item.price * 100) / 100;
        patchHoldingRow(tr, item);
        patchSharesGlance();
      }
      else if(e.target.classList.contains("h-person")) item.person = e.target.value;
      else if(e.target.classList.contains("v-what")) item.what = e.target.value;
      else if(e.target.classList.contains("v-purchaseprice")){
        item.purchasePrice = parseFloat(e.target.value) || 0;
        recalcComputedItems();
        patchVehicleRow(tr, item);
      }
      else if(e.target.classList.contains("v-purchasedate")){
        item.purchaseDate = e.target.value;
        recalcComputedItems();
        patchVehicleRow(tr, item);
      }
      else if(e.target.classList.contains("v-deprate")){
        item.depreciationRate = e.target.value === "" ? null : (parseFloat(e.target.value) || 0);
        recalcComputedItems();
        patchVehicleRow(tr, item);
      }
      else if(e.target.classList.contains("v-person")) item.person = e.target.value;
      else return;
      if(e.target.classList.contains("a-what") || e.target.classList.contains("h-what") || e.target.classList.contains("v-what")){
        var nameEl = tr.querySelector(".m-row-name");
        if(nameEl) nameEl.textContent = item.what;
      }
      var modernAmt = tr.querySelector('[data-computed="amt"]');
      if(modernAmt) modernAmt.textContent = fmtCurrency0.format(Number(item.amount) || 0);
      patchAssetCategoryTotals();
      renderNetWorthPanel();
      persist();
    }
  });  document.addEventListener("change", function(e){
    if(e.target.id === "sharesSortSelect"){ setSharesSortMode(e.target.value); return; }
    if(e.target.closest(".m-asset-rows") && e.target.classList.contains("a-category")){
      var tr = e.target.closest("[data-index]");
      if(!tr) return;
      var idx = Number(tr.getAttribute("data-index"));
      if(state.assets[idx]){
        state.assets[idx].category = e.target.value;
        // Moving INTO Shares needs the same quantity/price/avgCost defaulting migrateState()
        // does for legacy data — otherwise a plain-dollar item (e.g. a crypto holding tracked
        // under Other) would render as qty 0 / price 0 the instant it lands here, silently
        // losing its value instead of carrying it over as 1 unit at that price.
        if(e.target.value === "Shares") normalizeShareAsset(state.assets[idx]);
        renderAssets(); persist();
      }
    }
    if(e.target.closest(".m-asset-rows") && e.target.classList.contains("h-market")){
      var htr = e.target.closest("[data-index]");
      if(!htr) return;
      var hidx = Number(htr.getAttribute("data-index"));
      if(state.assets[hidx]){
        state.assets[hidx].market = e.target.value;
        // Market decides currency (see MARKET_CURRENCY) — patch immediately so the price/value
        // figures relabel without waiting on some other edit to trigger a re-render.
        patchHoldingRow(htr, state.assets[hidx]);
        persist();
      }
    }
    if(e.target.closest(".m-asset-rows") &&
       (e.target.classList.contains("h-person") || e.target.classList.contains("a-person") || e.target.classList.contains("v-person"))){
      updatePersonSuggestions();
      // Patches just the filter chip row (not a full renderAssets()), so typing a new person's
      // name into a still-focused field doesn't blow away that same field's own focus mid-edit.
      renderAssetPersonFilter();
    }
  });  document.addEventListener("click", function(e){
    var delBtn = e.target.closest("[data-asset-del]");
    if(delBtn){
      var idx = Number(delBtn.getAttribute("data-asset-del"));
      var removedAsset = state.assets[idx];
      var removedWhat = removedAsset && removedAsset.what ? removedAsset.what : "Asset";
      state.assets.splice(idx, 1);
      renderAssets();
      renderProjectionOutputs();
      persist();
      showUndoToast('Deleted "' + removedWhat + '"', function(){
        state.assets.splice(Math.min(idx, state.assets.length), 0, removedAsset);
        renderAssets();
        renderProjectionOutputs();
        persist();
      });
      return;
    }
    var stmtAddBtn = e.target.closest("[data-stmt-add]");
    if(stmtAddBtn){
      var stmtIdx = Number(stmtAddBtn.getAttribute("data-stmt-add"));
      addAssetStatement(stmtIdx);
      afterStatementListChange(stmtIdx);
      return;
    }
    var stmtDelBtn = e.target.closest("[data-stmt-del]");
    if(stmtDelBtn){
      var stParts = stmtDelBtn.getAttribute("data-stmt-del").split(":");
      var stItem = state.assets[Number(stParts[0])];
      if(!stItem || !stItem.taxStatements) return;
      var removedSt = stItem.taxStatements.splice(Number(stParts[1]), 1)[0];
      afterStatementListChange(Number(stParts[0]));
      showUndoToast("Statement deleted", function(){
        stItem.taxStatements.splice(Math.min(Number(stParts[1]), stItem.taxStatements.length), 0, removedSt);
        afterStatementListChange(Number(stParts[0]));
      });
      return;
    }
    var poAddBtn = e.target.closest("[data-payout-add]");
    if(poAddBtn){
      var poIdx = Number(poAddBtn.getAttribute("data-payout-add"));
      addAssetPayout(poIdx);
      afterPayoutListChange(poIdx);
      return;
    }
    var poDelBtn = e.target.closest("[data-payout-del]");
    if(poDelBtn){
      var poParts = poDelBtn.getAttribute("data-payout-del").split(":");
      var poItem = state.assets[Number(poParts[0])];
      if(!poItem || !poItem.payouts) return;
      var removedPo = poItem.payouts.splice(Number(poParts[1]), 1)[0];
      afterPayoutListChange(Number(poParts[0]));
      showUndoToast("Payment deleted", function(){
        poItem.payouts.splice(Math.min(Number(poParts[1]), poItem.payouts.length), 0, removedPo);
        afterPayoutListChange(Number(poParts[0]));
      });
      return;
    }
    var lotAddBtn = e.target.closest("[data-lot-add]");
    if(lotAddBtn){
      var lotIdx = Number(lotAddBtn.getAttribute("data-lot-add"));
      addAssetLot(lotIdx);
      afterLotListChange(lotIdx);
      return;
    }
    var lotDelBtn = e.target.closest("[data-lot-del]");
    if(lotDelBtn){
      var lotParts = lotDelBtn.getAttribute("data-lot-del").split(":");
      var lotItem = state.assets[Number(lotParts[0])];
      if(!lotItem || !lotItem.lots) return;
      var removedLot = lotItem.lots.splice(Number(lotParts[1]), 1)[0];
      syncAvgCostFromLots(lotItem);
      afterLotListChange(Number(lotParts[0]));
      showUndoToast("Lot deleted", function(){
        lotItem.lots.splice(Math.min(Number(lotParts[1]), lotItem.lots.length), 0, removedLot);
        syncAvgCostFromLots(lotItem);
        afterLotListChange(Number(lotParts[0]));
      });
      return;
    }
    var saleBtn = e.target.closest("[data-asset-sale]");
    if(saleBtn){
      var sIdx = Number(saleBtn.getAttribute("data-asset-sale"));
      var sRow = saleBtn.closest('[data-section="assets"]');
      var out = recordAssetSale(sIdx, {
        units: sRow.querySelector(".h-sale-units").value,
        proceeds: sRow.querySelector(".h-sale-proceeds").value,
        date: sRow.querySelector(".h-sale-date").value,
        acquired: sRow.querySelector(".h-sale-acquired").value,
        costBase: sRow.querySelector(".h-sale-costbase").value
      });
      if(!out) return;
      if(out.error){ showToast(out.error); return; }
      var gain = saleCapitalGain(out.sale);
      showToast(gain.isLoss
        ? "Sale recorded — a " + fmtCurrency0.format(Math.abs(gain.raw)) + " capital loss"
        : "Sale recorded — " + fmtCurrency0.format(gain.raw) + " gain" + (gain.discountApplied ? ", halved by the 12-month discount" : ", no discount (held " + gain.heldDays + " days)"));
      afterAssetSaleChange();
      return;
    }
    var saleDelBtn = e.target.closest("[data-asset-sale-del]");
    if(saleDelBtn){
      var parts = saleDelBtn.getAttribute("data-asset-sale-del").split(":");
      withUndo("Sale removed — the units are back in the holding", function(){
        if(!deleteAssetSale(Number(parts[0]), Number(parts[1]))) return false;
        afterAssetSaleChange();
      });
      return;
    }
    var logBtn = e.target.closest("[data-asset-log]");
    if(logBtn){ logAssetSnapshot(Number(logBtn.getAttribute("data-asset-log"))); return; }
    if(e.target.id === "sharesPasteApply") applySharesPaste();
    // v3.75.0: prices from a Google Sheet.
    if(e.target.closest("[data-ps-copy]")){
      var fromEl = document.querySelector("[data-ps-from]");
      copyPriceSheetTemplate((fromEl && fromEl.value) || state.priceSheet.backfillFrom || defaultBackfillFrom());
      return;
    }
    if(e.target.closest("[data-ps-read]")){
      var urlEl = document.querySelector("[data-ps-url]");
      var url = urlEl ? urlEl.value.trim() : "";
      if(!url){ showToast("Paste the sheet's link first"); return; }
      state.priceSheet.url = url;
      readPriceSheetNow(true);
      return;
    }
    if(e.target.closest("[data-ps-forget]")){
      state.priceSheet.url = ""; state.priceSheet.lastRead = ""; state.priceSheet.lastResult = null;
      persist(); renderAssets(); showToast("Link forgotten — prices won't be read any more");
      return;
    }
    if(e.target.id === "sharesExportPriceTemplateBtn") exportSharesPriceTemplateCsv();
    if(e.target.id === "sharesCopyPriceTemplateBtn") copySharesPriceTemplateToClipboard();
    if(e.target.id === "expenseImportCancelBtn"){
      app.pendingExpensesImport = [];
      clearExpensesImportPreview();
      return;
    }
    if(e.target.id === "expenseImportConfirmBtn"){
      if(!app.pendingExpensesImport.length) return;
      var importCount = app.pendingExpensesImport.length;
      var startingSharedLength = state.shared.length;
      commitExpensesImport(app.pendingExpensesImport);
      app.pendingExpensesImport = [];
      clearExpensesImportPreview();
      refreshAfterLedgerChange("shared");
      showUndoToast(importCount + " expense" + (importCount === 1 ? "" : "s") + " imported", function(){
        state.shared.length = startingSharedLength;
        refreshAfterLedgerChange("shared");
      });
      return;
    }
    if(e.target.id === "incomeImportCancelBtn"){
      app.pendingIncomeImport = [];
      clearIncomeImportPreview();
      return;
    }
    if(e.target.id === "incomeImportConfirmBtn"){
      if(!app.pendingIncomeImport.length) return;
      var incomeImportCount = app.pendingIncomeImport.length;
      var startingIncomeLength = state.income.length;
      commitIncomeImport(app.pendingIncomeImport);
      app.pendingIncomeImport = [];
      clearIncomeImportPreview();
      refreshAfterLedgerChange("income");
      updatePersonSuggestions();
      showUndoToast(incomeImportCount + " income row" + (incomeImportCount === 1 ? "" : "s") + " imported", function(){
        state.income.length = startingIncomeLength;
        refreshAfterLedgerChange("income");
        updatePersonSuggestions();
      });
      return;
    }
    if(e.target.id === "assetsImportCancelBtn"){
      app.pendingAssetsImport = [];
      clearAssetsImportPreview();
      return;
    }
    if(e.target.id === "assetsImportConfirmBtn"){
      if(!app.pendingAssetsImport.length) return;
      var assetsImportCount = app.pendingAssetsImport.length;
      var startingAssetsLength = state.assets.length;
      commitAssetsImport(app.pendingAssetsImport);
      app.pendingAssetsImport = [];
      clearAssetsImportPreview();
      recalcComputedItems();
      renderAssets();
      persist();
      showUndoToast(assetsImportCount + " asset" + (assetsImportCount === 1 ? "" : "s") + " imported", function(){
        state.assets.length = startingAssetsLength;
        recalcComputedItems();
        renderAssets();
        persist();
      });
      return;
    }
    if(e.target.closest("[data-asset-person-open]")){ openAssetPersonSheet(); return; }
    var personFilterBtn = e.target.closest("[data-asset-person-filter]");
    if(personFilterBtn){
      setAssetPersonFilter(personFilterBtn.getAttribute("data-asset-person-filter"));
      // renderAssets() has already redrawn the chip with the new name; this closes the sheet the
      // choice was made in, through the overlay stack so the back button stays in step.
      if(assetPersonSheetOpen) app.requestCloseActiveOverlay();
      return;
    }
    var gainFilterBtn = e.target.closest("[data-shares-gain-filter]");
    if(gainFilterBtn){ setSharesGainFilter(gainFilterBtn.getAttribute("data-shares-gain-filter")); return; }
    var changeWindowBtn = e.target.closest("[data-shares-change-window]");
    if(changeWindowBtn){ setSharesChangeWindow(changeWindowBtn.getAttribute("data-shares-change-window")); return; }
    var allocRangeBtn = e.target.closest("[data-allocation-range]");
    if(allocRangeBtn){ setAllocationRange(allocRangeBtn.getAttribute("data-allocation-range")); return; }
    var portfolioRangeBtn = e.target.closest("[data-portfolio-range]");
    if(portfolioRangeBtn){ setPortfolioRange(portfolioRangeBtn.getAttribute("data-portfolio-range")); return; }
    if(e.target.closest("[data-set-projection-reference]")){ setProjectionReference(); return; }
    if(e.target.closest("[data-log-networth]")){ logNetWorthSnapshot(); return; }
    var debtLogBtn = e.target.closest("[data-debt-log]");
    if(debtLogBtn){ logDebtSnapshot(Number(debtLogBtn.getAttribute("data-debt-log"))); return; }
    var debtDelBtn = e.target.closest("[data-debt-del]");
    if(debtDelBtn){
      var didx = Number(debtDelBtn.getAttribute("data-debt-del"));
      var removedDebt = state.debts[didx];
      var removedDebtWhat = removedDebt && removedDebt.what ? removedDebt.what : "Debt";
      state.debts.splice(didx, 1);
      renderAssets();
      renderDashboardStats();
      renderProjectionOutputs();
      persist();
      showUndoToast('Deleted "' + removedDebtWhat + '"', function(){
        state.debts.splice(Math.min(didx, state.debts.length), 0, removedDebt);
        renderAssets();
        renderDashboardStats();
        renderProjectionOutputs();
        persist();
      });
      return;
    }
  });  document.getElementById("addDebtBtn").addEventListener("click", function(){
    state.debts.push({ what: "New debt", balance: 0 });
    renderAssets();
    renderDashboardStats();
    renderProjectionOutputs();
    persist();
  });  // Per-keystroke: patches the total + downstream figures in place rather than a full
  // renderAssets(), which would blow away focus mid-keystroke on whichever field the user is
  // actually typing in (the same class of bug fixed earlier for the scenario-override panel).
  document.addEventListener("input", function(e){
    if(!e.target.classList.contains("debt-what") && !e.target.classList.contains("debt-balance")) return;
    var idx = Number(e.target.getAttribute("data-debt-index"));
    var debt = state.debts[idx];
    if(!debt) return;
    if(e.target.classList.contains("debt-what")) debt.what = e.target.value;
    else debt.balance = parseFloat(e.target.value) || 0;
    var totalEl = document.getElementById("totalDebtsAmount");
    if(totalEl) totalEl.textContent = fmtCurrency0.format(totalDebtsValue());
    renderDashboardStats();
    renderProjectionOutputs();
    persist();
  });
  // Assets → Offsets tab: the other half of the two-way sync with Properties' own .loan-offset
  // field below — see patchOffsetsRow's comment and offsetRowHtml's in assets.js for why this
  // writes straight back to the same property.loans[i].offsetBalance rather than a copy.
  document.addEventListener("input", function(e){
    if(!e.target.classList.contains("offset-balance-input")) return;
    var property = findProperty(e.target.getAttribute("data-offset-property"));
    var loanIdx = Number(e.target.getAttribute("data-offset-loan"));
    var loan = property && property.loans[loanIdx];
    if(!loan) return;
    loan.offsetBalance = parseFloat(e.target.value) || 0;
    recordLoanSnapshot(loan, "offsetHistory", loan.offsetBalance);
    patchOffsetsRow(property.id, loanIdx, loan.offsetBalance);
    patchPropertyCardComputed(property);
    // patchPropertyCardComputed only patches derived/computed figures, not the raw .loan-offset
    // input itself — that field is normally the source of truth on the Properties page, so nothing
    // else there ever needs to overwrite it. Editing from here is the one case that does, guarded
    // by activeElement the same way patchOffsetsRow guards its own input (so this can never fight
    // someone actively typing into the *other* copy of the same field at the same time).
    var propCard = document.querySelector('.property-card[data-property-id="' + CSS.escape(property.id) + '"]');
    var loanOffsetInput = propCard && propCard.querySelector('[data-loan-index="' + loanIdx + '"] .loan-offset');
    if(loanOffsetInput && document.activeElement !== loanOffsetInput) loanOffsetInput.value = loan.offsetBalance;
    renderAssetsSummary();
    renderProjectionOutputs();
    persist();
  });  // Jump straight to the loan's own property card — Assets → Offsets doesn't duplicate the loan's
  // other fields (balance, rate, term), so "I need to change more than the offset" has to be one
  // tap from here rather than a dead end.
  document.getElementById("assetsSub-Offsets").addEventListener("click", function(e){
    var jumpBtn = e.target.closest("[data-jump-property]");
    if(!jumpBtn) return;
    var propId = jumpBtn.getAttribute("data-jump-property");
    showPage("properties", { replace: true });
    setTimeout(function(){
      var target = document.getElementById("property-card-" + propId);
      if(target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
  });
}

export function wireAssetPersonSheet(){  document.getElementById("assetPersonSheetRoot").addEventListener("click", function(e){
    if(e.target.closest("[data-asset-person-close]") || e.target === e.target.closest("[data-asset-person-backdrop]")){
      app.requestCloseActiveOverlay();
    }
    // Picking a person is handled by the page-level [data-asset-person-filter] handler above —
    // this root sits outside .app-page, so the click never reaches it otherwise.
  });  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    if(document.querySelector("[data-asset-person-backdrop]")) app.requestCloseActiveOverlay();
  });
}

export function wireFxRate(){  // v3.32.1: the exchange rate typed into the Shares warning.
  document.addEventListener("change", function(e){
    if(!e.target.matches || !e.target.matches("[data-fx-usdaud]")) return;
    if(setUsdAudRate(e.target.value)) showToast("Exchange rate set — US$ holdings now count at A$" + Number(e.target.value).toFixed(4));
  });
}

export function wirePrices(){  document.addEventListener("toggle", function(e){
    if(e.target.matches && e.target.matches("[data-ps-panel]")) priceSheetUi.open = e.target.open;
  }, true);  document.addEventListener("change", function(e){
    if(e.target.matches && e.target.matches("[data-ps-from]")){ state.priceSheet.backfillFrom = e.target.value || ""; persist(); }
  });  document.addEventListener("change", function(e){
    var k = e.target.getAttribute && e.target.getAttribute("data-ap");
    if(!k) return;
    state.autoPrices[k] = !!e.target.checked;
    if(k === "on" && e.target.checked) state.autoPrices.lastRead = "";
    persist(); renderAll();
  });  document.addEventListener("click", function(e){ if(e.target.closest && e.target.closest("[data-ap-read]")) readAutoPricesNow(true); });
}

export function wireMarket(){  document.addEventListener("click", function(e){
    var b = e.target.closest && e.target.closest("[data-bench]");
    if(!b) return;
    bench.pick = b.getAttribute("data-bench");
    redrawCard("benchCard", benchmarkCardHtml());
    renderBenchmark();
  });  document.addEventListener("change", function(e){
    if(!e.target.matches) return;
    if(e.target.matches("[data-mix-target]")){
      var c = e.target.getAttribute("data-mix-target"), v = e.target.value.trim();
      if(!state.targetMix || typeof state.targetMix !== "object") state.targetMix = {};
      if(v === "" || isNaN(Number(v))) delete state.targetMix[c]; else state.targetMix[c] = Math.max(0, Math.min(100, Number(v)));
      persist();
      redrawCard("mixCard", targetMixCardHtml());
      var again = document.querySelector('[data-mix-target="' + c + '"]');
      if(again) again.focus();
    } else if(e.target.matches("[data-mix-next]")){
      bench.nextAmount = Math.max(0, Number(e.target.value) || 0);
      redrawCard("mixCard", targetMixCardHtml());
    } else if(e.target.matches(".m-asset-rows .h-class")){
      var row = e.target.closest("[data-index]"), a = row && state.assets[Number(row.getAttribute("data-index"))];
      if(!a) return;
      if(e.target.value) a.assetClass = e.target.value; else delete a.assetClass;
      persist();
      redrawCard("mixCard", targetMixCardHtml());
    }
  });
}

export function wireTrades(){  document.addEventListener("change", function(e){
    if(!e.target.matches) return;
    if(e.target.matches("[data-tr-file]")){
      // v3.96.0: CSV or Excel, and several at once (a broker report per financial year).
      var files = Array.prototype.slice.call(e.target.files || []);
      e.target.value = "";
      if(!files.length) return;
      Promise.all(files.map(function(f){
        return /\.xlsx$/i.test(f.name)
          ? f.arrayBuffer().then(readXlsx).then(function(sheets){ return sheets.map(function(x){ return x.grid; }); })
          : f.text().then(function(t){ return [parseCsvGrid(t)]; });
      })).then(function(lists){
        afterTradesRead(useParsedTrades(parseTradeSheets([].concat.apply([], lists))));
      }).catch(function(){ showToast("Couldn't read that file"); });
      return;
    }
    if(e.target.matches("[data-tr-pick]")){ tradesUi.choice[e.target.getAttribute("data-tr-pick")] = e.target.value === "skip" ? "skip" : Number(e.target.value); renderAssets(); return; }
    if(e.target.matches("[data-tr-skip]")){ if(e.target.checked) tradesUi.choice[e.target.getAttribute("data-tr-skip")] = "skip"; else delete tradesUi.choice[e.target.getAttribute("data-tr-skip")]; renderAssets(); return; }
  });  document.addEventListener("toggle", function(e){
    if(e.target.matches && e.target.matches("[data-tr-panel]")) tradesUi.open = e.target.open;
  }, true);  document.addEventListener("click", function(e){
    if(!e.target.closest) return;
    if(e.target.closest("[data-tr-read]")){
      var ta = document.querySelector("[data-tr-text]");
      if(!ta || !ta.value.trim()){ showToast("Choose a CSV or paste one first"); return; }
      afterTradesRead(readTradesText(ta.value));
      return;
    }
    if(e.target.closest("[data-tr-apply]")){
      var before = JSON.stringify(state.assets);
      var res = applyTrades(state.assets, currentTradePlan(), function(){ return genId("lot"); });
      tradesUi.parsed = null; tradesUi.choice = {};
      persist(); renderAll();
      showUndoToast("Added " + res.lots + " purchase lot" + (res.lots === 1 ? "" : "s") + (res.sales ? " and " + res.sales + " sale" + (res.sales === 1 ? "" : "s") : "") + (res.linked ? "; " + res.linked + " recorded sale" + (res.linked === 1 ? "" : "s") + " tied to the lots" : ""), function(){
        var restored = JSON.parse(before);
        state.assets.splice.apply(state.assets, [0, state.assets.length].concat(restored));
        persist(); renderAll();
      });
    }
  });
}

export { readAutoPricesNow, readPriceSheetNow };
