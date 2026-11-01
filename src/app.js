// v3.202.0 (item 233): first, so it is listening before any other module runs.
import { errorLog, clearErrorLog } from "./lib/errorlog.js";
import { renderSubscriptions, subsUi } from "./components/subscriptions.js";
import { bench, benchmarkCardHtml, targetMixCardHtml } from "./components/investreturn.js";
import { whatIfValues, resetWhatIf, wiFromSlider, wiValueText } from "./components/whatif.js";
import { whatIfMoved, keepWhatIf } from "./calc/whatif.js";
import { state, setState, storageAvailable, persist, commit, onCommit, setStatus, defaultState, defaultInvestConfig, migrateState, genId, normalizeShareAsset, onSaved } from "./state.js";
import { sacrificeLabelToMode, TRANSFER_FEE_BY_STATE, MORTGAGE_REG_FEE_BY_STATE } from "./constants.js";
import { fmtCurrency0, fmtCurrency2, localDateStr, fmtDate, parseAmountInput } from "./lib/format.js";
import { showToast, showUndoToast, showPersistentToast } from "./lib/toast.js";
import { initHelp, setShowHelp, showHelpPreference } from "./lib/help.js";
import { escapeAttr } from "./lib/html.js";
import { getNotifications, unreadNotificationCount, markNotificationRead, markAllNotificationsRead } from "./lib/notifications.js";
import { onHorizontalSwipe } from "./lib/swipe.js";
import { initTableScrollShadows } from "./lib/scroll-shadow.js";
import { setDeductionPeopleProvider, setDeductionPropertiesProvider, setRentLinesProvider, materializeRowEdit } from "./lib/ledger-table.js";
import {
  decryptBackup, doExport, doShare, canShareFiles, exportIncomeCsv, exportExpensesCsv, exportAssetsCsv, exportPropertyLoansCsv, exportSharesPriceTemplateCsv, copySharesPriceTemplateToClipboard, copyPriceSheetTemplate, exportYearTransactionsCsv,
  exportExpensesImportTemplateCsv, exportIncomeImportTemplateCsv, exportAssetsImportTemplateCsv, exportProjectionCsv
} from "./lib/backup.js";
import { periodsOf, sumField, sumFieldForScenario, resolveSharedAmount, appendHistorySnapshot, transactionDisplayName } from "./calc/ledger.js";
import { phiPremiumsAnnual, effectiveIncomeItems, getTaxPeople, personTaxSettings, computePersonTax, setDeductibleItemsProvider, saleCapitalGain, lotsUnitsAvailable, takeHomeAdjust } from "./calc/tax.js";
import { recalcComputedItems, scenarioTotals, currentScenario, totalNetWorthValue, totalDebtsValue } from "./calc/engine.js";
import { setAccountOfProvider } from "./calc/accounts.js";
import { financialYearOf, fyLabel, recordRateChange, sortedRateHistory, loanRateOn } from "./calc/property.js";
import { taxYearFillStatements, renderTaxYear, setTaxYearSelected, taxYearAddRow, taxYearDeleteRow, taxYearRestoreRow, taxYearSetField, taxYearToggleEvidence, taxYearMarkLodged, worksheetText, taxYearSelected, taxYearPrintHtml, lodgedSnapshot } from "./components/taxyear.js";
import { renderPeople, setPersonField, peopleSummaryText } from "./components/people.js";
import { renamePersonEverywhere, removePersonFromTax } from "./calc/people.js";
import { renderHealth } from "./components/health.js";
import { renderMonthReview, stepReviewMonth, reviewMonthShown, setReviewMonth, setReviewStep, dismissReviewIntro } from "./components/monthreview.js";
import { markReviewed, setStatementAmount, monthLabel, monthBounds } from "./calc/monthreview.js";
import { logIncomeReceived, deleteIncomeReceived, incomeTargets } from "./calc/received.js";
import { demoHousehold, demoReceipts } from "./calc/demo.js";
import { setTakeHomeAdjust } from "./calc/takehome.js";
import { renderReceived, toggleReceivedRow, receivedSheet, openReceivedSheet, closeReceivedSheet, setReceivedTarget, receivedSheetHtml } from "./components/received.js";
import { applyRentalComparison, applyBudgetComparison, householdBudgetLines } from "./calc/closeyear.js";
import { setUseBudgetLines, setLineExcluded, RENT_EXPENSE_LINES, rentLineFor, setRentalActual, mergeTaxYearFile, matchPerson, taxYearRecord, TAX_YEAR_FILE_KIND } from "./calc/taxyear.js";
import { renderCards, renderDashboardStats, renderDetail, setProjectionReference, logNetWorthSnapshot } from "./components/dashboard.js";
import {
  personBreakdownHtml, renderIncomeGroups, patchOpenRowBreakdowns, patchIncomeGroupTotals,
  patchSyntheticIncomeRows, patchIncomeAfterTax, patchIncomeSuperNotes, renderTaxSuper, withholdingCheckText, withholdingCheckHtml, payslipRead, salaryRowFor, flipTaxCard, patchAllTaxPersonOutputs, patchPhiNote,
  modernIncomeRowOpen, parseIncomeImportCsv, renderIncomeImportPreview, clearIncomeImportPreview, commitIncomeImport,
  incomeHeaderTotal, setIncomeShowAs, taxUi
} from "./components/income.js";
import {
  patchSharedGroupTotals, renderSharedGroups, modernSharedRowOpen,
  openScenarioOverridePanel, closeScenarioOverridePanel, renderScenarioOverridePanel,
  setScenarioOverride, resetScenarioOverride, copyScenarioAmountToAll,
  openExpenseReview, closeExpenseReview, renderExpenseReviewPanel,
  confirmReviewBills, 
  renderTransactions, addTransaction, deleteTransaction, renderActualVsPlannedPanel,
  setTransactionsShowAll, setTransactionsRange, modernTransactionRowOpen, budgetRowTxnsOpen, transactionSummaryText, visibleSpendingIndices, loggableBudgetLineItems, renderBillsCalendar,
  openQuickLog, closeQuickLog, renderQuickLogSheet, setQuickLogLink, setQuickLogDateOpen,
  setQuickLogShowAllChips, setQuickLogChipFilter, setQuickLogSign, setQuickLogRefundOf, submitQuickLog, quickLogContextText, quickLog,
  renderAccounts, addAccount, deleteAccount, renameAccountEverywhere, 
  renderCategories, addCategory, deleteCategory, renameCategoryEverywhere, setCategoryLook, categoryLookUi,
  setBudgetGroupBy, renderBudgetGroupByToggle, budgetLineItems,
  toggleBudgetGroup, setAllBudgetGroupsCollapsed, allBudgetGroupsCollapsed, revealBudgetLine,
  renderYearSpending, renderYearBasisPreference, setYearBasis, transactionCategory,
  parseExpensesImportCsv, renderExpensesImportPreview, clearExpensesImportPreview, commitExpensesImport,
  renderSpendCategoryChart, renderSpendingTrends,
  listsShowAll,
  transactionAccount
} from "./components/expenses.js";
import {
  patchHoldingRow, patchVehicleRow, modernAssetRowOpen, patchAssetCategoryTotals,
  renderNetWorthPanel, renderAssets, renderBenchmark, logAssetSnapshot, applySharesPaste, logDebtSnapshot, setUsdAudRate,
  patchSharesGlance, setAssetPersonFilter, renderAssetPersonFilter, renderAssetPersonSheet, assetPersonSheetOpen, setAssetPersonSheetOpen, setSharesGainFilter, setSharesSortMode, setSharesChangeWindow, setAllocationRange, setPortfolioRange,
  parseAssetsImportCsv, renderAssetsImportPreview, clearAssetsImportPreview, commitAssetsImport, dividendNoteText,
  recordAssetSale, deleteAssetSale, renderAssetsSummary, patchOffsetsRow, addAssetLot, syncAvgCostFromLots, lotsSectionHtml, lotsNoteText, addAssetStatement, statementsSectionHtml, payoutsSectionHtml, payoutsNoteText, addAssetPayout
} from "./components/assets.js";
import {
  modernPropRowOpen, renderPropListModern, renderProperties, patchPropertyCardComputed,
  logPropertySnapshot, PROPERTY_SECTION_KEYS, borrowingNoteText, moveAcquisitionCostToLoan, setSaleWhatIfField, patchSaleWhatIf, setLoanStrategyField, patchLoanStrategy, propertyTabs, propertyEditing,
  fixedExpiryHtml, rentPanelHtml, fixedWhatIf, agentStatementUi, agentStatementFormValues
} from "./components/properties.js";
import { renderProjectionOutputs, renderProjectionsWhenSeen, renderWhatIfDrag, projectionSeriesShown } from "./components/projections.js";
import { renderBenchmarks, setBenchmarkField, applyBenchmarkPaste, addGoal, setGoalField, removeGoal, setPropertyMarketField } from "./components/benchmarks.js";
import { copyBenchmarkTemplateToClipboard } from "./lib/backup.js";
import {
  selectScenario, renameScenario, cloneScenario, deleteScenario, renderHomeBody, renderHomeListModern,
  renderHomeBodyTotalsOnly, homeBlockCollapsed, modernHomeRowOpen, patchHomeLoanRowIfSynced,
  patchCalcOutputs, afterCalcChange, patchInvestOutputs
} from "./components/scenarios.js";
import { ACCOUNT_TYPE_KEYS, accountSourceOptions, setAccountBalance, resolveLink, accountBalance } from "./calc/accounts.js";
import { addTransfer, deleteTransfer, splitTransaction, unsplit, bulkEditTransactions, bulkDeleteTransactions } from "./calc/cashflowlist.js";
import { txFilters, txSelect, transferForm, splitEditing, resetTxFilters, setTxGrid, txFilterPanel, transferHint, txViewForm } from "./components/cashflow.js";
import { rulesPageHtml, setRuleField, ruleIsEmpty, ruleTest, ruleView, RULES_PAGE } from "./components/rules.js";
import { normaliseDescription } from "./calc/bank-import.js";
import { openAccounts, balanceEditing } from "./components/accounts.js";
import { renderHomeSummary, weekView } from "./components/home.js";
import { autoPayView } from "./components/autopay.js";
import { answerAutoPay, makeAutoPay } from "./calc/autopay.js";
import { dismissWeekRecap } from "./calc/weekrecap.js";
import { saveView, deleteView, applyView, FILTER_FIELDS } from "./calc/txviews.js";
import { attachReceipt, detachReceipt, takeReceiptFiles } from "./calc/receipts.js";
import { saveReceiptFile, unpackReceipts, openReceipt, pruneReceipts } from "./lib/receipts.js";
import { startActivityLog, setDevicePerson } from "./lib/activity.js";
import { undoEntry } from "./calc/activity.js";
import { renderCompare } from "./components/compare.js";
import { wireScenarioEditor } from "./components/scenariowiring.js";
import { defineView, drawViews, redraw, redrawTouched } from "./lib/views.js";
import { renderActivity, activityUi } from "./components/activity.js";
import { receiptHolder } from "./components/receipts.js";
import { dataHealthChecks, dismissCheck } from "./calc/health.js";
import { applyFirstRun, shouldOfferFirstRun } from "./calc/firstrun.js";
import { normaliseTrip, applyTripRefile } from "./calc/trips.js";
import { logAgentStatement, removeAgentStatement, statementTotals, fillAgentAccount } from "./calc/agentstatement.js";
import { tripsCardHtml, tripPlan, tripProtectedLineIds } from "./components/trips.js";
import { refreshPriceSheet, priceSheetDue, priceSheetResultText, defaultBackfillFrom, priceSheetUi } from "./components/pricesheet.js";
import { refreshAutoPrices, autoPricesNeeded, autoPricesResultText } from "./components/autoprices.js";
import { firstRun, startFirstRun, firstRunHtml } from "./components/firstrun.js";
import { chooseFolder, backupToFolder, forgetFolder, maybeAutoBackup, setPasscode, clearPasscode, checkPasscode, newestFolderBackup, compareCopies, savedFolder } from "./lib/safekeeping.js";
import { syncOn, unlockSync, syncNow, pulled, merged as syncMerged, markChanged, stopSync } from "./lib/foldersync.js";
import { mergeStates } from "./calc/syncmerge.js";
import { mergeDialogHtml } from "./components/syncmerge.js";
import { setAppKey, connectDropbox, finishDropboxRedirect, disconnectDropbox, dropboxConnected } from "./lib/dropbox.js";
import { renderSafekeeping } from "./components/safekeeping.js";
import { goalsSectionHtml, goalOpen } from "./components/savegoals.js";
import { addSavingsGoal } from "./calc/savegoals.js";
import { unbudgetedRecurring, risingLines, catchAllSuggestions } from "./calc/recurring.js";
import { learnRule, mergeSimilarRules } from "./calc/import-rules.js";
import { pdfLines } from "./lib/pdftext.js";
import { parsePayslip, payFrequency } from "./calc/payslip.js";
import { payslipCheck } from "./calc/payslipcheck.js";
import { renderAdvice, adviceUi } from "./components/advice.js";
import { renderTrim, trimUi, trimScenario } from "./components/trim.js";
import { proposeBudget, applyBudgetProposals } from "./calc/budgetfromhistory.js";
import { budgetFromHistoryHtml, historyBudgetUi } from "./components/budgethistory.js";
import { setLeanLevel, leanLevel, trimReport } from "./calc/trim.js";
import { adviceFor } from "./calc/advice.js";
import { householdSummary } from "./calc/aisummary.js";
import { askUi, setAiKey, setAiModel, askClaude, setLastReview, copyPrompt } from "./components/askclaude.js";
import { emergencyFund } from "./calc/emergency.js";
import { renderEmergencyFund, existingEmergencyGoal } from "./components/emergency.js";
import { statementFromLines, statementCsv, agentStatementFromLines } from "./calc/pdfstatement.js";
import { tradesUi, readTradesText, useParsedTrades, currentTradePlan } from "./components/brokertrades.js";
import { applyTrades, parseTradeSheets } from "./calc/brokertrades.js";
import { readXlsx } from "./lib/xlsx.js";
import { parseCsvGrid, thinPriceHistory } from "./calc/pricesheet.js";
import { netWorthOn } from "./calc/nwhistory.js";
import { recordNetWorth, backfillNetWorth, isAutoPoint } from "./calc/nwauto.js";
import { recordRentReview } from "./calc/propertylife.js";
import { retirementHtml, retireLevers } from "./components/retirement.js";
import { recurringHtml, recurringDismissed, recurringOpen, catchAllShown } from "./components/recurring.js";
import { lifeEventsHtml, addLifeEvent, setLifeEventField, removeLifeEvent } from "./components/lifeevents.js";
import { detailTarget, detailView, renderDetailPage } from "./components/detail.js";
import { renderCanBuy } from "./components/canbuy.js";
import { goalsFireHtml } from "./components/retirement.js";
import { renderReports, reportShown, reportPrintHtml, reportCsv, reportFrame, pinReport, openSavedReport, unpinReport } from "./components/reports.js";
import { monthDetailUi, shownMonth as mdShownMonth } from "./components/monthdetail.js";
import { shiftMonth as mdShiftMonth } from "./calc/monthdetail.js";
import { cardPaymentsForMonth, oddCardRepayments, usualCardSource } from "./calc/bills.js";
import { rentCheck } from "./calc/rentcheck.js";
import { exportTableCsv } from "./lib/backup.js";
import { yearEndPrintHtml, yearEndDocumentsCsv } from "./components/yearend.js";
import { loadPeriod, applyPeriod, setPeriodRerender, renderPeriodButton, renderPeriodMenu } from "./components/period.js";
import { selectedYearWindow, yearStartOf, householdYearBasis, selectedMonth } from "./calc/ledger.js";
import { applyParts, renderPartsSettings, setPart } from "./components/parts.js";
import { txReview, txReviewHtml, reviewBannerHtml } from "./components/reviewqueue.js";
import { loadHomeLayout, saveHomeLayout, moveCard, applyHomeLayout, homeArrangeHtml } from "./lib/homelayout.js";
import { toReview, keepTransaction, refileTransaction, applyRuleFromReview, keepAll, ruleOfferFor } from "./calc/reviewqueue.js";
import { showPage, parseRouteFromLocation, closeNavMenu, showAssetsSubpage, showDashboardSubpage, showExpensesSubpage, showAccountsSubpage, showTaxSubpage, showPlanSubpage, taxSubpage, setOverlayCleanup, QUICK_ACTIONS, quickActionsSheetHtml, PAGE_KEY, appAssetUrl } from "./components/nav.js";
import { openSearch, closeSearch, setSearchQuery, getSearchResults } from "./components/search.js";
import {
  startBankImport, reparseBankImportWith, clearBankImport,
  setBankImportGroupLine, setBankImportGroupCategory, renderBankImportPanel, patchBankImportPanel, renderBankImportHelp,
  setIncludePossibleDuplicates, commitBankImport, undoBankImport, setStatementAccount, setStatementBalanceOn, inboxNoteHtml, bankImport
} from "./components/bank-import.js";
import { listInbox, readInboxFile, markInboxFileImported } from "./lib/inbox.js";
import { inboxMessage } from "./calc/inbox.js";

(function(){
  "use strict";

  var THEME_KEY = "wealthPlanner.theme";
  var THEME_MODES = ["system", "light", "dark"];
  function applyTheme(mode){
    if(mode === "light" || mode === "dark") document.documentElement.setAttribute("data-theme", mode);
    else document.documentElement.removeAttribute("data-theme");
  }
  function getThemePref(){
    try{ return localStorage.getItem(THEME_KEY) || "system"; }catch(e){ return "system"; }
  }
  applyTheme(getThemePref());

  // Sample data (v3.104.0): one fixed, invented household with about eighteen months of history —
  // calc/demo.js. Pay and rent received are added once recalc has made the take-home rows.
  function buildDemoState(){
    var today = localDateStr();
    setState(migrateState(demoHousehold(today)));
    recalcComputedItems();
    demoReceipts(state, today, incomeTargets());
  }

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


  // v3.140.0: the avatar is the household's first person's initial (a dot until there is one), and its
  // menu says whether backup & sync is on.
  function updateAvatar(){
    var first = getTaxPeople()[0] || "";
    var el = document.getElementById("avatarInitial");
    if(el) el.textContent = first ? first.trim().charAt(0).toUpperCase() : "·";
    var sync = document.getElementById("avatarSyncState");
    if(sync) sync.textContent = syncOn() ? "on" : "off";
  }
  function renderTotals(){
    updateAvatar();
    // v3.138.0: in the period Income is shown in (Show as).
    var incTotal = incomeHeaderTotal(sumField(effectiveIncomeItems(), "monthly"));
    document.getElementById("totalIncomeMonthly").textContent = incTotal.value;
    document.getElementById("totalIncomeLabel").textContent = incTotal.label;
    // Totals what the list actually shows — shared plus the active scenario's housing — not just
    // state.shared, or the header disagrees with the cards beneath it by the size of your rent.
    // Scenario-resolved, matching the cards below it and every other total in the app.
    document.getElementById("totalSharedMonthly").textContent = fmtCurrency0.format(sumFieldForScenario(budgetLineItems(), currentScenario(), "monthly"));
    renderGlobalMetrics();
  }

  // Selecting a scenario re-renders the pages that follow it; the header follows the Current situation
  // (v3.102.0), but its tooltip names the selected what-if, so it's redrawn too.
  function chooseScenario(name){ selectScenario(name); renderGlobalMetrics(); }

  // Sticky header figures — always visible regardless of which tab is open, so a change
  // made three tabs deep is immediately reflected in the two numbers that matter most.
  function renderGlobalMetrics(){
    var netWorthEl = document.getElementById("globalNetWorth");
    var cashFlowEl = document.getElementById("globalCashFlow");
    if(!netWorthEl || !cashFlowEl) return;
    netWorthEl.textContent = fmtCurrency0.format(totalNetWorthValue());
    // v3.102.0: the household as it is (Current situation), not the scenario selected for a look —
    // picking a Buy scenario on Plan used to turn this headline, on every page, into a what-if.
    var cur = currentScenario();
    var t = scenarioTotals(cur);
    // v3.80.0: what a normal month leaves — bonuses arrive in their own month, not a twelfth a month.
    var m = t.regularNetMonthly != null ? t.regularNetMonthly : t.netMonthly;
    cashFlowEl.textContent = (m >= 0 ? "+" : "") + fmtCurrency0.format(m) + "/mo";
    cashFlowEl.classList.toggle("pos", m >= 0);
    cashFlowEl.classList.toggle("neg", m < 0);
    var tip = "What a normal month leaves in " + cur + ".";
    if(t.oneOffYearly > 0.5) tip += " Plus " + fmtCurrency0.format(t.oneOffYearly) + " a year in bonuses, which land in their own month.";
    cashFlowEl.title = tip;
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
  }

  // True for any section the Budget tab lists: state.shared, plus the active scenario's housing
  // (see budgetLineSources in expenses.js). A housing row edited there needs the same live totals,
  // charts and regrouping a shared row gets — the same scenario's block on the Scenarios page is
  // updated alongside it by rerenderTableFor.
  // Set when a row's category changes and cleared once the list has been rebuilt — see
  // closeActiveModernRowUI for why the rebuild waits.
  var budgetRegroupPending = false;
  // "Does a row in this section appear in the Budget tab's list?" — which is what decides whether
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
  }

  // ---------------- Purchase calculator: wiring ----------------

  function onCalcInput(e){
    var panel = e.target.closest("[data-calc-scenario]");
    if(!panel) return;
    var scenario = panel.getAttribute("data-calc-scenario");
    var cfg = state.purchase[scenario];
    if(!cfg) return;
    var t = e.target;
    var matched = true;
    if(t.classList.contains("calc-price")) cfg.price = parseFloat(t.value) || 0;
    else if(t.classList.contains("calc-depositPct")) cfg.depositPct = Math.max(0, Math.min(100, parseFloat(t.value) || 0));
    else if(t.classList.contains("calc-rate")) cfg.rate = parseFloat(t.value) || 0;
    else if(t.classList.contains("calc-iorate")) cfg.ioRate = parseFloat(t.value) || 0;
    else if(t.classList.contains("calc-term")) cfg.termYears = Math.max(1, parseFloat(t.value) || 1);
    else if(t.classList.contains("calc-manual-stampduty")) cfg.manualStampDuty = parseFloat(t.value) || 0;
    else if(t.classList.contains("calc-growth-override")) cfg.propertyGrowthRate = t.value === "" ? null : (parseFloat(t.value) || 0);
    else if(t.classList.contains("cc-what") || t.classList.contains("cc-amount")){
      var tr = t.closest(".cc-row");
      var idx = Array.prototype.indexOf.call(tr.parentNode.children, tr);
      var cost = (cfg.otherCosts || [])[idx];
      if(!cost) return;
      if(t.classList.contains("cc-what")) cost.what = t.value; else cost.amount = parseFloat(t.value) || 0;
    } else { matched = false; }
    if(!matched) return;

    recalcComputedItems();
    patchCalcOutputs(panel, scenario);
    patchHomeLoanRowIfSynced(scenario);
    afterCalcChange(scenario);
  }

  function onCalcChange(e){
    var panel = e.target.closest("[data-calc-scenario]");
    if(!panel) return;
    var scenario = panel.getAttribute("data-calc-scenario");
    var cfg = state.purchase[scenario];
    if(!cfg) return;
    var t = e.target;
    if(t.classList.contains("calc-enabled")){
      cfg.enabled = t.checked;
      // Mutually exclusive with the invest-instead leg — see the invest-enabled handler below
      // and computeNetWorthSeries()'s own precedence for why both enabled would double-count.
      if(cfg.enabled && state.invest[scenario]) state.invest[scenario].enabled = false;
    }
    else if(t.classList.contains("calc-state")){
      cfg.state = t.value;
      // Transfer/Mortgage Registration are flat statutory land-registry fees, not something a
      // user has any reason to hand-tune the way Conveyancing or Building & Pest costs vary by
      // provider — so unlike every other otherCosts row, these two re-sync to the new state's
      // figure automatically, matching stamp duty's own state-driven recalculation just above.
      // Matched by exact label so a row the user has renamed/repurposed is left alone.
      (cfg.otherCosts || []).forEach(function(c){
        if(c.what === "Transfer Fee") c.amount = TRANSFER_FEE_BY_STATE[cfg.state] != null ? TRANSFER_FEE_BY_STATE[cfg.state] : TRANSFER_FEE_BY_STATE.Other;
        else if(c.what === "Mortgage Registration Fee") c.amount = MORTGAGE_REG_FEE_BY_STATE[cfg.state] != null ? MORTGAGE_REG_FEE_BY_STATE[cfg.state] : MORTGAGE_REG_FEE_BY_STATE.Other;
      });
    }
    else if(t.classList.contains("calc-fhb")) cfg.firstHomeBuyer = t.checked;
    else if(t.classList.contains("calc-sync")) cfg.syncRepayment = t.checked;
    else if(t.classList.contains("calc-repaymenttype")) cfg.repaymentType = t.value;
    else if(t.classList.contains("calc-lmi-capitalize")) cfg.lmiCapitalized = t.checked;
    else return;

    recalcComputedItems();
    renderHomeBody();
    renderCards();
    renderDetail();
    renderAssets();
    persist();
  }

  function onCalcClick(e){
    var useGrowthBtn = e.target.closest("[data-use-growth]");
    if(useGrowthBtn){
      var growthPanel = e.target.closest("[data-calc-scenario]");
      if(!growthPanel) return;
      var growthScenario = growthPanel.getAttribute("data-calc-scenario");
      var growthCfg = state.purchase[growthScenario];
      if(!growthCfg) return;
      growthCfg.propertyGrowthRate = parseFloat(useGrowthBtn.getAttribute("data-use-growth")) || 0;
      renderHomeBody();
      afterCalcChange(growthScenario);
      return;
    }
    var addBtn = e.target.closest("[data-cc-add]");
    var delBtn = e.target.closest("[data-cc-del]");
    if(!addBtn && !delBtn) return;
    var panel = e.target.closest("[data-calc-scenario]");
    if(!panel) return;
    var scenario = panel.getAttribute("data-calc-scenario");
    var cfg = state.purchase[scenario];
    if(!cfg) return;
    if(!cfg.otherCosts) cfg.otherCosts = [];
    if(addBtn) cfg.otherCosts.push({what:"New cost", amount:0});
    else if(delBtn) cfg.otherCosts.splice(Number(delBtn.getAttribute("data-cc-del")), 1);

    recalcComputedItems();
    renderHomeBody();
    renderCards();
    renderDetail();
    renderAssets();
    persist();
  }

  // ---------------- Invest-instead-of-buying calculator: wiring ----------------
  // Mirrors onCalcInput/onCalcChange's split: per-keystroke number fields patch in place
  // (afterCalcChange + patchInvestOutputs, no full re-render — preserves focus mid-keystroke),
  // checkbox/select fields go through a full renderHomeBody() since they can change which
  // fields are even shown (e.g. contribution mode revealing the manual-amount input).

  function onInvestInput(e){
    var panel = e.target.closest("[data-invest-scenario]");
    if(!panel) return;
    var scenario = panel.getAttribute("data-invest-scenario");
    var cfg = state.invest[scenario];
    if(!cfg) return;
    var t = e.target;
    var matched = true;
    if(t.classList.contains("invest-initial")) cfg.initialAmount = Math.max(0, parseFloat(t.value) || 0);
    else if(t.classList.contains("invest-growth")) cfg.growthRatePct = parseFloat(t.value) || 0;
    else if(t.classList.contains("invest-manual-amount")) cfg.monthlyContribution = Math.max(0, parseFloat(t.value) || 0);
    else { matched = false; }
    if(!matched) return;

    patchInvestOutputs(panel, scenario);
    afterCalcChange(scenario);
  }

  function onInvestChange(e){
    var panel = e.target.closest("[data-invest-scenario]");
    if(!panel) return;
    var scenario = panel.getAttribute("data-invest-scenario");
    var cfg = state.invest[scenario];
    if(!cfg) return;
    var t = e.target;
    if(t.classList.contains("invest-enabled")){
      cfg.enabled = t.checked;
      // Mutually exclusive with the purchase leg — see computeNetWorthSeries()'s own precedence
      // for why having both enabled would double-count.
      if(cfg.enabled && state.purchase[scenario]) state.purchase[scenario].enabled = false;
    }
    else if(t.classList.contains("invest-assettype")){
      var oldType = cfg.assetType;
      var oldDefault = defaultInvestConfig(oldType).growthRatePct;
      cfg.assetType = t.value;
      // Only follow the new type's suggested rate if the field still held the old type's
      // default — a rate the user deliberately typed in is left alone, same reasoning as the
      // Transfer/Mortgage Registration fee re-sync on the purchase panel's state field.
      if((Number(cfg.growthRatePct) || 0) === oldDefault) cfg.growthRatePct = defaultInvestConfig(t.value).growthRatePct;
    }
    else if(t.classList.contains("invest-contribmode")) cfg.contributionMode = t.value;
    else return;

    recalcComputedItems();
    renderHomeBody();
    renderCards();
    renderDetail();
    renderAssets();
    persist();
  }

  // ---------------- Long-term projection ----------------
  document.getElementById("projHorizon").addEventListener("input", function(e){
    state.projection.horizonYears = Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1));
    renderProjectionOutputs();
    persist();
  });
  document.getElementById("projInvestRate").addEventListener("input", function(e){
    state.projection.investReturnRate = parseFloat(e.target.value) || 0;
    renderProjectionOutputs();
    persist();
  });
  document.getElementById("projPropertyRate").addEventListener("input", function(e){
    state.projection.propertyAppreciationRate = parseFloat(e.target.value) || 0;
    renderProjectionOutputs();
    persist();
  });
  document.getElementById("projInflationRate").addEventListener("input", function(e){
    state.projection.inflationRate = parseFloat(e.target.value) || 0;
    // The basis note quotes this rate ("deflated by 3% a year"), so it goes stale otherwise.
    syncProjBasisControl();
    renderProjectionOutputs();
    persist();
  });
  document.getElementById("projIncomeGrowth").addEventListener("input", function(e){
    state.projection.incomeGrowthRate = parseFloat(e.target.value) || 0;
    renderProjectionOutputs();
    persist();
  });
  // Not an assumption but a unit — it doesn't change the plan, only which dollars it's reported
  // in, so it re-renders the outputs without touching anything the model computes from.
  document.getElementById("projBasis").addEventListener("click", function(e){
    var btn = e.target.closest("[data-proj-basis]");
    if(!btn) return;
    state.projection.realTerms = btn.getAttribute("data-proj-basis") === "real";
    syncProjBasisControl();
    renderProjectionOutputs();
    persist();
  });
  document.getElementById("projSourceRow").addEventListener("click", function(e){
    var btn = e.target.closest("[data-proj-source]");
    if(!btn || btn.disabled) return;
    state.projection.source = btn.getAttribute("data-proj-source") === "actuals" ? "actuals" : "plan";
    renderProjectionOutputs();
    renderDetail();
    persist();
  });
  document.getElementById("projRateShock").addEventListener("input", function(e){
    state.projection.rateShockPct = Math.max(0, parseFloat(e.target.value) || 0);
    renderProjectionOutputs();
    persist();
  });
  // Pairs each projection number input with a same-range slider: dragging the slider
  // writes into the number input and fires its native "input" event so the existing
  // handler above stays the single source of truth for updating state; typing in the
  // number input keeps the slider's thumb in sync going the other way.
  function pairSlider(numberId, sliderId){
    var numberInput = document.getElementById(numberId);
    var slider = document.getElementById(sliderId);
    if(!numberInput || !slider) return;
    slider.value = numberInput.value;
    slider.addEventListener("input", function(){
      numberInput.value = slider.value;
      numberInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    numberInput.addEventListener("input", function(){
      slider.value = numberInput.value || 0;
    });
  }
  pairSlider("projInvestRate", "projInvestRateRange");
  pairSlider("projPropertyRate", "projPropertyRateRange");
  pairSlider("projInflationRate", "projInflationRateRange");
  pairSlider("projIncomeGrowth", "projIncomeGrowthRange");
  pairSlider("projRateShock", "projRateShockRange");
  // v3.126.0: life events under the projection's assumptions.
  function renderLifeEvents(){ var el = document.getElementById("lifeEventsBody"); if(el) el.innerHTML = lifeEventsHtml(); }
  var leBody = document.getElementById("lifeEventsBody");
  leBody.addEventListener("click", function(e){
    var add = e.target.closest("[data-le-add]");
    if(add){ var ev = addLifeEvent(add.getAttribute("data-le-add")); persist(); renderLifeEvents(); renderProjectionOutputs();
      var f = leBody.querySelector('[data-le-id="' + ev.id + '"] [data-le-field="what"]'); if(f){ f.focus(); f.select(); } return; }
    var rm = e.target.closest("[data-le-remove]");
    if(rm){ removeLifeEvent(rm.getAttribute("data-le-remove")); persist(); renderLifeEvents(); renderProjectionOutputs(); }
  });
  leBody.addEventListener("change", function(e){
    var k = e.target.getAttribute("data-le-field"), row = e.target.closest("[data-le-id]");
    if(!k || !row) return;
    if(setLifeEventField(row.getAttribute("data-le-id"), k, e.target.value)){
      persist(); renderProjectionOutputs();
      // Re-sorted by year — after this event finishes, since a click elsewhere can fire this change
      // (on the blur) in the middle of its own redraw.
      if(k === "year") setTimeout(renderLifeEvents, 0);
    }
  });
  pairSlider("projInvestVol", "projInvestVolRange");
  pairSlider("projPropertyVol", "projPropertyVolRange");
  // v3.125.0: the spread of returns behind the shaded range.
  ["projInvestVol", "projPropertyVol"].forEach(function(id){
    document.getElementById(id).addEventListener("input", function(e){
      state.projection[id === "projInvestVol" ? "investVolatility" : "propertyVolatility"] = Math.max(0, parseFloat(e.target.value) || 0);
      renderProjectionOutputs(); renderRetirement();
      persist();
    });
  });

  // Both halves of the basis control in one place: the segmented button's pressed state, and the
  // sentence next to it that says what the choice actually means. Called on load and on every
  // change, rather than rebuilt inside renderProjectionOutputs(), because the control is static
  // markup in index.html — only its state moves.
  function syncProjBasisControl(){
    var real = state.projection.realTerms !== false;
    var group = document.getElementById("projBasis");
    if(group){
      group.querySelectorAll("[data-proj-basis]").forEach(function(btn){
        var on = (btn.getAttribute("data-proj-basis") === "real") === real;
        btn.classList.toggle("active", on);
        btn.setAttribute("aria-pressed", String(on));
      });
    }
    var note = document.getElementById("projBasisNote");
    if(note){
      note.textContent = real
        ? "Deflated " + (Number(state.projection.inflationRate) || 0) + "% a year."
        : "Not adjusted for inflation.";
    }
  }


  // ---------------- Tax & super ----------------
  // A line claimed against a property shows its rental schedule line; one claimed by a person, its
  // return label (v3.45.0). Both are in the DOM; this picks which is visible.
  function syncClaimFields(tr, item){
    tr.querySelectorAll(".f-claim-prop").forEach(function(el){ el.hidden = !(item.deductible && item.claimProperty); });
    tr.querySelectorAll(".f-claim-person").forEach(function(el){ el.hidden = !(item.deductible && !item.claimProperty); });
  }
  // People (v3.44.0): the rename and remove themselves live in calc/people.js, which walks every
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
  }
  function renderPeopleTab(){
    renderPeople();
    var sum = document.getElementById("peopleSummary");
    if(sum) sum.textContent = peopleSummaryText();
  }
  function renameTaxPerson(oldName, newName){
    var res = renamePersonEverywhere(oldName, newName);
    if(res.error){ showToast(res.error); renderPeopleTab(); return; }
    if(res.changed) afterPeopleChange();
  }
  function removeTaxPerson(name){
    if(!confirm('Remove "' + name + '" from tax? Their income rows go back to Type "Net" (counted as-is, at face value) and keep their current amounts; their date of birth, HELP and property shares are cleared.')) return;
    removePersonFromTax(name);
    afterPeopleChange();
  }
  function openPeopleTab(){
    showAccountsSubpage("people");
    renderPeopleTab();
  }
  var peopleTable = document.getElementById("peopleTable");
  peopleTable.addEventListener("change", function(e){
    var t = e.target, person = t.getAttribute("data-pp-person");
    if(!person) return;
    if(t.classList.contains("pp-name")){ renameTaxPerson(person, t.value); return; }
    var cls = ["pp-dob", "pp-help", "pp-cap", "pp-carry", "pp-losses", "pp-wfh", "pp-week", "pp-var"].find(function(c){ return t.classList.contains(c); });
    if(!cls || !setPersonField(person, cls, t.type === "checkbox" ? t.checked : t.value, t.getAttribute("data-fy"))) return;
    afterPeopleChange();
  });
  peopleTable.addEventListener("click", function(e){
    var rm = e.target.closest("[data-pp-remove]");
    if(rm) removeTaxPerson(rm.getAttribute("data-pp-remove"));
  });
  document.getElementById("addPersonBtn").addEventListener("click", function(){
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
  });
  document.addEventListener("click", function(e){
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
  function flipTaxCardFromSwipe(e){
    if(!window.matchMedia("(max-width: 880px)").matches) return;
    var panel = e.target.closest("[data-tax-person]");
    if(!panel) return;
    flipTaxCard(panel, panel.getAttribute("data-tax-person"));
  }

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
  });

  // ---------------- Tax return worksheet ----------------
  // Every edit re-runs the year's figures and re-renders the section. Inputs commit on "change"
  // (blur / Enter / select), not per keystroke, so a re-render never takes focus mid-number.
  function afterTaxYearEdit(){
    renderTaxYear();
    persist();
  }
  // Close the year (v3.48.0): the ticked lines become the plan. Undo puts back exactly what was
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
  }
  // Checks → "Open …": straight to where the fix is.
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
  });
  // A loan's balance or offset edited on Property or Investments → Offsets is the same number the
  // matching account shows (v3.56.0) — record it in that history too, so the account's chart, its
  // savings-goal pace and the net worth comparison see the change wherever it was typed (v3.67.1).
  // Same-day edits replace each other, so typing doesn't pile up snapshots.
  function recordLoanSnapshot(loan, key, value){
    if(!Array.isArray(loan[key])) loan[key] = [];
    appendHistorySnapshot(loan[key], Math.round((Number(value) || 0) * 100) / 100, localDateStr());
  }
  function afterCloseYear(){
    recalcComputedItems();
    renderAll();
    persist();
  }
  // Builds the static print copy at the top level, prints, and takes it away again. afterprint
  // fires once the dialog closes, whatever the user chose.
  function printTaxYear(){ printStatic(taxYearPrintHtml()); }
  function printStatic(html){
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
  }
  var taxYearBody = document.getElementById("taxYearBody");
  var taxDocsBody = document.getElementById("taxDocsBody");
  function onTaxYearChange(e){
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
  taxYearBody.addEventListener("change", onTaxYearChange);
  taxDocsBody.addEventListener("change", onTaxYearChange);
  // "Open FY25/26" while the current year is still running: moves the whole app's period there.
  [taxYearBody, taxDocsBody].forEach(function(body){
    body.addEventListener("click", function(e){
      var b = e.target.closest("button[data-ty-year]");
      if(b) setTaxYearSelected(b.getAttribute("data-ty-year"));
    });
  });
  taxDocsBody.addEventListener("click", function(e){
    if(e.target.closest("[data-ty-import]")) document.getElementById("taxYearImportFile").click();
  });
  document.getElementById("taxSubnav").addEventListener("click", function(e){
    var btn = e.target.closest("[data-tax-sub]");
    if(!btn) return;
    showTaxSubpage(btn.getAttribute("data-tax-sub"));
    if(btn.getAttribute("data-tax-sub") === "people") renderPeopleTab();
    renderTaxYear();
  });
  taxYearBody.addEventListener("click", function(e){
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

  document.getElementById("homeBody").addEventListener("input", onCalcInput);
  // v3.189.0 (item 220): a scenario's calculators also work on the Calculators page.
  ["input", "change", "click"].forEach(function(type){
    var el = document.getElementById("calcScenarioBody");
    el.addEventListener(type, type === "input" ? onCalcInput : type === "change" ? onCalcChange : onCalcClick);
    if(type !== "click") el.addEventListener(type, type === "input" ? onInvestInput : onInvestChange);
  });
  document.getElementById("homeBody").addEventListener("change", onCalcChange);
  document.getElementById("homeBody").addEventListener("click", onCalcClick);
  document.getElementById("homeBody").addEventListener("input", onInvestInput);
  document.getElementById("homeBody").addEventListener("change", onInvestChange);

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
  });
  document.addEventListener("change", function(e){
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
  });
  document.addEventListener("click", function(e){
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
      pendingExpensesImport = [];
      clearExpensesImportPreview();
      return;
    }
    if(e.target.id === "expenseImportConfirmBtn"){
      if(!pendingExpensesImport.length) return;
      var importCount = pendingExpensesImport.length;
      var startingSharedLength = state.shared.length;
      commitExpensesImport(pendingExpensesImport);
      pendingExpensesImport = [];
      clearExpensesImportPreview();
      refreshAfterLedgerChange("shared");
      showUndoToast(importCount + " expense" + (importCount === 1 ? "" : "s") + " imported", function(){
        state.shared.length = startingSharedLength;
        refreshAfterLedgerChange("shared");
      });
      return;
    }
    if(e.target.id === "incomeImportCancelBtn"){
      pendingIncomeImport = [];
      clearIncomeImportPreview();
      return;
    }
    if(e.target.id === "incomeImportConfirmBtn"){
      if(!pendingIncomeImport.length) return;
      var incomeImportCount = pendingIncomeImport.length;
      var startingIncomeLength = state.income.length;
      commitIncomeImport(pendingIncomeImport);
      pendingIncomeImport = [];
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
      pendingAssetsImport = [];
      clearAssetsImportPreview();
      return;
    }
    if(e.target.id === "assetsImportConfirmBtn"){
      if(!pendingAssetsImport.length) return;
      var assetsImportCount = pendingAssetsImport.length;
      var startingAssetsLength = state.assets.length;
      commitAssetsImport(pendingAssetsImport);
      pendingAssetsImport = [];
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
      if(assetPersonSheetOpen) requestCloseActiveOverlay();
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
  });
  document.getElementById("addDebtBtn").addEventListener("click", function(){
    state.debts.push({ what: "New debt", balance: 0 });
    renderAssets();
    renderDashboardStats();
    renderProjectionOutputs();
    persist();
  });
  // Per-keystroke: patches the total + downstream figures in place rather than a full
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
  });
  // Jump straight to the loan's own property card — Assets → Offsets doesn't duplicate the loan's
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

  document.getElementById("propertiesBody").addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    var sectionToggleBtn = e.target.closest("[data-prop-section-toggle]");
    if(!sectionToggleBtn) return;
    e.preventDefault();
    sectionToggleBtn.click();
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
  // Fixed-rate what-if and the rent panel (v3.72.0).
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
  });
  // v3.92.0: fill the statement form from the manager's PDF; the person checks it and logs it.
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
      var set = function(k, v){ var el = asPanel.querySelector('[data-as="' + k + '"]'); if(el) el.value = v; };
      if(r.date) set("date", r.date);
      set("rent", r.rent || ""); set("water", r.water || ""); set("fees", r.fees || ""); set("waterRates", r.waterRates || "");
      var other = r.others.reduce(function(t, o){ return t + o.amount; }, 0);
      set("otherAmount", other ? Math.round(other * 100) / 100 : "");
      var sel = asPanel.querySelector('[data-as="otherLine"]');
      if(sel && r.others.length){
        var want = r.others[0].what.toLowerCase();
        var hit = Array.prototype.find.call(sel.options, function(o){ return want.indexOf(o.text.toLowerCase().split(" ")[0]) !== -1; });
        if(hit) sel.value = hit.value;
      }
      var out = asPanel.querySelector("[data-as-net]"), net = statementTotals(agentStatementFormValues(asPanel)).net;
      if(out) out.textContent = fmtCurrency2.format(net);
      showToast(r.received != null && Math.abs(net - r.received) >= 0.01
        ? "Filled — but it adds to " + fmtCurrency2.format(net) + ", the statement says " + fmtCurrency2.format(r.received) + ". Check it before logging."
        : "Filled from the statement" + (r.others.length ? " (other: " + r.others.map(function(o){ return o.what; }).join(", ") + ")" : "") + " — check it, then Log statement");
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
  });
  // A property's tabs (v3.61.0): every panel is already rendered, so switching is a visibility
  // toggle — no re-render, nothing typed in another tab is lost.
  document.getElementById("propertiesBody").addEventListener("click", function(e){
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

  document.addEventListener("input", function(e){
    if(e.target.closest("table.ledger-table") || e.target.closest(".m-rows")) onLedgerInput(e);
  });
  document.addEventListener("change", function(e){
    if((e.target.closest("table.ledger-table") || e.target.closest(".m-rows")) && (e.target.tagName === "SELECT")) onLedgerInput(e);
  });
  document.addEventListener("click", onLedgerClick);

  // Every Modern-mode row (Income, Expenses, Transactions, Assets, Properties, Scenarios) used to
  // expand its edit fields in place, accordion-style, within the scrolling list — closer to a web
  // form than how a mobile finance app actually handles data entry (tap +, a focused sheet takes
  // over with the cursor already in the first field). Since every one of these rows already
  // funnels through this one shared toggle mechanism, turning `.open` into a real modal (see
  // `.m-row.open` in ledger.css — position:fixed, centered, backed by the single shared
  // #mRowBackdrop) fixes all of them at once, without touching any page's own field-building or
  // state-mutation code — only where that same already-correct content visually renders.
  //
  // ---------------- Overlay history integration ----------------
  // Any full-page-feeling overlay in this app (a row's edit modal below, cross-page search,
  // expense review) pushes exactly one history entry for as long as it's open, and every one of
  // its on-screen close affordances (tap outside, an explicit X, Escape) routes through
  // requestCloseActiveOverlay() rather than tearing itself down immediately. That makes the same
  // single entry what a device/browser back-button press naturally pops too — the popstate
  // handler below is the one place that actually runs the close callback, whichever way it was
  // triggered. Without this, opening one of these silently occupied no space in the browser's
  // back-history, so pressing back while one was open fell through to whatever the *page*
  // underneath was doing there instead — another page, or leaving the app — rather than just
  // closing the thing in front of you.
  var activeOverlayClose = null; // the pure cleanup function for whichever overlay is open, if any
  function pushActiveOverlay(onClose, replace){
    activeOverlayClose = onClose;
    try{ history[replace ? "replaceState" : "pushState"]({ overlayOpen: true }, "", location.href); }catch(e){}
  }
  function requestCloseActiveOverlay(){
    if(!activeOverlayClose) return;
    history.back();
  }
  // v3.167.0 (item 197): an open section's header sticks under the page header on a phone, which
  // changes height as it goes slim — so its height is kept as --topbar-h.
  (function(){
    var bar = document.querySelector(".app-topbar");
    if(!bar || typeof ResizeObserver === "undefined") return;
    new ResizeObserver(function(){ document.documentElement.style.setProperty("--topbar-h", bar.offsetHeight + "px"); }).observe(bar);
  })();
  // v3.167.0 (item 197): on a phone, a sheet (a row's editor, any dialog) closes by dragging it down
  // by its top — past 110px, or a quick flick. It follows the finger while dragged and springs back
  // when let go short. Closing goes through the same path as ✕ and the back button.
  (function(){
    var phone = window.matchMedia("(max-width: 880px)"), drag = null;
    function closeSheet(sheet){
      if(activeOverlayClose){ requestCloseActiveOverlay(); return; }
      var x = sheet.querySelector('.review-head [aria-label="Close"], .review-head .icon-btn');
      if(x) x.click();
    }
    document.addEventListener("touchstart", function(e){
      if(!phone.matches || e.touches.length !== 1) return;
      var head = e.target.closest(".review-backdrop > .review-panel > .review-head, .m-row.open > .m-row-summary");
      if(!head || e.target.closest("input, select, textarea")) return;
      var sheet = head.parentElement;
      drag = { sheet: sheet, y0: e.touches[0].clientY, t0: Date.now(), dy: 0 };
    }, { passive: true });
    document.addEventListener("touchmove", function(e){
      if(!drag) return;
      drag.dy = Math.max(0, e.touches[0].clientY - drag.y0);
      drag.sheet.style.transition = "none";
      drag.sheet.style.transform = "translateY(" + drag.dy + "px)";
    }, { passive: true });
    function end(){
      if(!drag) return;
      var d = drag, flick = d.dy > 40 && d.dy / Math.max(1, Date.now() - d.t0) > 0.6;
      drag = null;
      if(!d.dy){ d.sheet.style.transition = d.sheet.style.transform = ""; return; }
      d.sheet.style.transition = "transform .18s ease";
      if(d.dy > 110 || flick){
        d.sheet.style.transform = "translateY(100%)";
        setTimeout(function(){ d.sheet.style.transition = d.sheet.style.transform = ""; closeSheet(d.sheet); }, 170);
      } else {
        d.sheet.style.transform = "";
        setTimeout(function(){ d.sheet.style.transition = ""; }, 200);
      }
    }
    document.addEventListener("touchend", end);
    document.addEventListener("touchcancel", end);
  })();
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
  }
  // v3.38.0: the same in-place swap for distributions, then the tax chain.
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
  }
  function afterPayoutChange(){
    recalcComputedItems();
    renderTaxSuper();
    patchSyntheticIncomeRows();
    patchIncomeGroupTotals();
    renderCards(); renderDetail(); renderTotals();
    renderProjectionOutputs();
    persist();
  }
  // Same in-place swap as afterLotListChange, then the tax chain — a statement is taxable income.
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
  }
  function afterAssetSaleChange(){
    recalcComputedItems();
    renderAssets();
    renderTaxSuper();
    patchSyntheticIncomeRows();
    patchIncomeGroupTotals();
    renderCards(); renderDetail(); renderTotals();
    renderProjectionOutputs();
    persist();
  }

  // Two providers registered once at startup, both for the same reason: calc/ and lib/ can't import
  // a component, but the data they need (which budget lines exist, who the tax people are) is
  // assembled by one. See setDeductibleItemsProvider's own comment for why this beats threading the
  // list through every caller of computePersonTax.
  // v3.131.0: the household's own budget — the current scenario's — whichever what-if is being looked
  // at. A tax estimate is about the year you're actually living; it moved with the scenario picker.
  setDeductibleItemsProvider(function(){ return budgetLineItems(currentScenario()); });
  // v3.135.0: net worth rolls each account forward by what's logged against it (a line's default
  // account counts, as on the Accounts page).
  setAccountOfProvider(transactionAccount);
  setDeductionPeopleProvider(getTaxPeople);
  setDeductionPropertiesProvider(function(){ return state.properties.filter(function(p){ return p.kind === "IP"; }).map(function(p){ return { id: p.id, what: p.what }; }); });
  setRentLinesProvider(function(){ return { lines: RENT_EXPENSE_LINES, lineFor: rentLineFor }; });
  setOverlayCleanup(function(){
    if(!activeOverlayClose) return;
    var closeOverlay = activeOverlayClose;
    activeOverlayClose = null;
    closeOverlay();
  });

  // Only one row can be a modal at a time (openModernRow closes whichever was open before opening
  // a new one) — nothing enforced that before, harmless for an inline accordion where several
  // could stay expanded at once, but two would visually stack as a modal.
  var activeModernRow = null; // { section, idx, openState, key, containerId }
  // section+index does NOT identify a row uniquely across the document: the same underlying row
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
  }
  // Looked up fresh by data-section/data-index rather than a cached element reference — an
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
  }
  // Pure DOM/state cleanup, no history involved — used both as the overlay's close callback (the
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
  }
  function closeActiveModernRowUI(){
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
  }
  // The close entry point for every on-screen affordance (tap the row/header, Escape, tap the
  // backdrop) — see wireModernRowToggle, the Escape listener, and #mRowBackdrop's click listener
  // below.
  function closeActiveModernRow(){
    if(!activeModernRow) return;
    requestCloseActiveOverlay();
  }
  // Exported to module scope (not just wireModernRowToggle's closure) so every "+Add" handler
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
    pushActiveOverlay(closeActiveModernRowUI, switchingRow);
    if(!autoFocus) return;
    var firstField = row.querySelector(".m-row-edit input, .m-row-edit select");
    if(firstField){
      firstField.focus();
      // A freshly-added item's "What" field still holds its generic default ("New item", "New
      // loan", "New asset"...) — select it so typing immediately replaces it, rather than
      // requiring a select-all first.
      if(firstField.tagName === "INPUT" && /^New /.test(firstField.value)) firstField.select();
    }
  }
  function wireModernRowToggle(containerId, openState){
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
  // ---------------- Assets: "Showing <person>" sheet ----------------
  function closeAssetPersonSheetUi(){
    setAssetPersonSheetOpen(false);
    renderAssetPersonSheet();
  }
  function openAssetPersonSheet(){
    setAssetPersonSheetOpen(true);
    renderAssetPersonSheet();
    if(document.querySelector("[data-asset-person-backdrop]")) pushActiveOverlay(closeAssetPersonSheetUi);
  }
  document.getElementById("assetPersonSheetRoot").addEventListener("click", function(e){
    if(e.target.closest("[data-asset-person-close]") || e.target === e.target.closest("[data-asset-person-backdrop]")){
      requestCloseActiveOverlay();
    }
    // Picking a person is handled by the page-level [data-asset-person-filter] handler above —
    // this root sits outside .app-page, so the click never reaches it otherwise.
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    if(document.querySelector("[data-asset-person-backdrop]")) requestCloseActiveOverlay();
  });

  // ---------------- Page-header ⋯ menus ----------------
  // One delegated handler for all four (Income, Expenses, Properties, Assets). The menu is a
  // sibling of its own button inside .page-overflow, so "which menu?" is answered by walking up
  // from the click rather than by an id per page.
  function closeAllOverflowMenus(except){
    document.querySelectorAll(".page-overflow").forEach(function(wrap){
      if(wrap === except) return;
      var menu = wrap.querySelector("[data-overflow-menu]");
      var btn = wrap.querySelector("[data-overflow-toggle]");
      if(menu) menu.hidden = true;
      if(btn) btn.setAttribute("aria-expanded", "false");
    });
  }
  document.addEventListener("click", function(e){
    var toggle = e.target.closest("[data-overflow-toggle]");
    if(toggle){
      var wrap = toggle.closest(".page-overflow");
      var menu = wrap.querySelector("[data-overflow-menu]");
      var willOpen = menu.hidden;
      closeAllOverflowMenus(wrap);
      menu.hidden = !willOpen;
      toggle.setAttribute("aria-expanded", String(willOpen));
      return;
    }
    // A click on an item inside the menu (Export CSV, Import…) closes it too — those handlers run
    // on their own ids and don't know this menu exists, so closing is this handler's job either
    // way, whether the click was inside or outside.
    closeAllOverflowMenus(null);
  });
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape") closeAllOverflowMenus(null);
  });

  document.getElementById("mRowBackdrop").addEventListener("click", closeActiveModernRow);
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape" && activeModernRow) closeActiveModernRow();
  });
  wireModernRowToggle("incomeGroups", modernIncomeRowOpen);
  wireModernRowToggle("sharedGroups", modernSharedRowOpen);

  // ---------------- Per-scenario override panel (shared expenses and income) ----------------
  // The panel carries its own section now, because the same dialog serves state.shared and
  // state.income. An income change has to go through refreshAfterLedgerChange("income"), which
  // re-runs recalcComputedItems() — a Gross row's override changes that person's tax, and so the
  // synthetic net row and every total derived from it.
  function overrideBackdropTarget(e){
    var backdrop = e.target.closest("[data-override-backdrop]");
    if(!backdrop) return null;
    return { section: backdrop.getAttribute("data-override-section") || "shared", idx: Number(backdrop.getAttribute("data-override-idx")) };
  }
  document.getElementById("scenarioOverrideRoot").addEventListener("click", function(e){
    if(e.target.closest("[data-override-close]") || e.target === e.target.closest("[data-override-backdrop]")){
      closeScenarioOverridePanel();
      return;
    }
    var target = overrideBackdropTarget(e);
    if(!target) return;
    var resetBtn = e.target.closest("[data-override-reset]");
    if(resetBtn){
      resetScenarioOverride(target.section, target.idx, resetBtn.getAttribute("data-override-reset"));
      refreshAfterLedgerChange(target.section);
      renderScenarioOverridePanel();
      return;
    }
    var useBtn = e.target.closest("[data-override-use-everywhere]");
    if(useBtn){
      copyScenarioAmountToAll(target.section, target.idx, useBtn.getAttribute("data-override-use-everywhere"));
      refreshAfterLedgerChange(target.section);
      renderScenarioOverridePanel();
      return;
    }
  });
  document.getElementById("scenarioOverrideRoot").addEventListener("change", function(e){
    var input = e.target.closest(".scen-override-input");
    if(!input) return;
    var target = overrideBackdropTarget(e);
    if(!target) return;
    var scenarioName = input.getAttribute("data-override-scenario");
    setScenarioOverride(target.section, target.idx, scenarioName, parseFloat(input.value) || 0);
    refreshAfterLedgerChange(target.section);
    // Deferred to the next tick: this handler runs synchronously inside the input's own
    // 'change' dispatch, and rebuilding #scenarioOverrideRoot's innerHTML (an ancestor of the
    // input that's still mid-event) right now throws "the node to be removed is no longer a
    // child of this node" in Chromium — the same class of reentrant-DOM-mutation issue as the
    // checkbox preventDefault gotcha elsewhere in this codebase, just triggered by innerHTML
    // replacement instead of a checked-state revert.
    setTimeout(renderScenarioOverridePanel, 0);
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    if(document.querySelector("[data-override-backdrop]")) closeScenarioOverridePanel();
  });

  // ---------------- Bills to confirm (v3.113.0) ----------------
  function performReviewConfirm(){
    var values = [].map.call(document.querySelectorAll("#expenseReviewRoot [data-confirm-key]"), function(row){
      return { key: Number(row.getAttribute("data-confirm-key")), checked: row.querySelector(".bc-confirm-check").checked,
        amount: parseFloat(row.querySelector(".bc-confirm-amount").value), date: row.querySelector(".bc-confirm-date").value };
    });
    var n = confirmReviewBills(values);
    if(n) refreshAfterLedgerChange("shared");
    renderExpenseReviewPanel();
  }
  var reviewBtn = document.getElementById("reviewExpensesBtn");
  if(reviewBtn) reviewBtn.addEventListener("click", function(){
    openExpenseReview();
    // openExpenseReview() can no-op (nothing due for review, or no expenses at all — see its own
    // early-return toasts), so check the panel actually rendered before claiming a history entry.
    if(document.querySelector("[data-review-backdrop]")) pushActiveOverlay(closeExpenseReview);
  });
  document.getElementById("expenseReviewRoot").addEventListener("click", function(e){
    if(e.target.closest("[data-review-close]") || e.target === e.target.closest("[data-review-backdrop]")){
      requestCloseActiveOverlay();
      return;
    }
    if(e.target.closest("[data-review-confirm]")){ performReviewConfirm(); return; }
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    if(document.querySelector("[data-review-backdrop]")) requestCloseActiveOverlay();
  });
  // The Confirm button counts the ticked bills as they're ticked.
  document.getElementById("expenseReviewRoot").addEventListener("change", function(e){
    if(!e.target.classList.contains("bc-confirm-check")) return;
    var btn = document.querySelector("[data-review-confirm]");
    if(btn) btn.textContent = "Confirm " + document.querySelectorAll("#expenseReviewRoot .bc-confirm-check:checked").length;
  });

  // ---------------- Quick log ----------------
  // The everyday "I just spent money" path — the Expenses page's primary action and what the
  // mobile quick-action fab points at there. Deliberately a thin controller: expenses.js owns the
  // sheet's markup and session state, this owns the DOM events and the cross-cutting refresh.
  function openQuickLogSheet(){
    openQuickLog();
    if(document.querySelector("[data-qlog-backdrop]")) pushActiveOverlay(closeQuickLog);
  }
  // Chip changes and expanding the date row re-render the sheet, which would otherwise discard
  // whatever's already been typed into the amount/note. Read them out first, put them back after.
  function rerenderQuickLogPreservingInput(apply){
    var amountEl = document.getElementById("quickLogAmount");
    var noteEl = document.getElementById("quickLogNote");
    var amount = amountEl ? amountEl.value : "";
    var note = noteEl ? noteEl.value : "";
    apply();
    var newAmount = document.getElementById("quickLogAmount");
    var newNote = document.getElementById("quickLogNote");
    if(newAmount) newAmount.value = amount;
    if(newNote) newNote.value = note;
  }
  function performQuickLog(){
    var amountEl = document.getElementById("quickLogAmount");
    var noteEl = document.getElementById("quickLogNote");
    var dateEl = document.getElementById("quickLogDate");
    var amount = amountEl ? (parseFloat(amountEl.value) || 0) : 0;
    // A zero/blank amount is the one thing this sheet genuinely can't infer, so it's the only
    // thing it refuses — everything else has a sensible default (today, One-off, no note).
    //
    // This used to reject `amount <= 0`, which quietly made refunds impossible to log: a refund
    // *is* a negative transaction here (see the Amount field's own note in transactionRowHtml),
    // and every path that could produce one — typing a minus, pasting one in — died on this line
    // with "Enter an amount first", which is not what was wrong. Magnitude is what has to be
    // non-zero; the sign comes from the Spend/Refund toggle.
    if(!amount){
      showToast("Enter an amount first.");
      if(amountEl) amountEl.focus();
      return;
    }
    var catEl = document.getElementById("quickLogCategory");
    var t = submitQuickLog(amount, noteEl ? noteEl.value : "", dateEl && dateEl.value ? dateEl.value : undefined, catEl ? catEl.value : "");
    if(!t) return;
    requestCloseActiveOverlay();
    refreshAfterLedgerChange("shared");
    renderTransactions();
    // The whole point of logging is watching this move — refreshAfterLedgerChange only covers the
    // planned-budget side, so the actual-vs-planned bars need their own refresh to include the
    // transaction that was just recorded.
    renderActualVsPlannedPanel();
    showToast(t.amount < 0
      ? "Logged a " + fmtCurrency2.format(Math.abs(t.amount)) + " refund against " + transactionDisplayName(t, budgetLineItems())
      : "Logged " + fmtCurrency2.format(t.amount) + " to " + transactionDisplayName(t, budgetLineItems()));
  }
  var quickLogBtn = document.getElementById("quickLogBtn");
  if(quickLogBtn) quickLogBtn.addEventListener("click", openQuickLogSheet);
  document.getElementById("quickLogRoot").addEventListener("click", function(e){
    if(e.target.closest("[data-qlog-close]") || e.target === e.target.closest("[data-qlog-backdrop]")){
      requestCloseActiveOverlay();
      return;
    }
    var chip = e.target.closest("[data-qlog-chip]");
    if(chip){
      // Patched in place rather than re-rendered: the whole point of picking the line after
      // typing the amount is that changing your mind costs nothing, and a re-render here would
      // drop the caret out of a field the user may still be editing.
      var wasOneOff = !quickLog.linkedId;
      setQuickLogLink(chip.getAttribute("data-qlog-chip"));
      var isOneOff = !quickLog.linkedId;
      // Crossing between linked and one-off adds or removes the Category field (a linked
      // transaction inherits its line's), which needs a re-render; staying on the same side of
      // that line only needs the selection and context patched, so the caret stays put.
      if(wasOneOff !== isOneOff){
        rerenderQuickLogPreservingInput(function(){ renderQuickLogSheet(); });
        return;
      }
      document.querySelectorAll("[data-qlog-chip]").forEach(function(el){
        var on = el.getAttribute("data-qlog-chip") === (quickLog.linkedId || "");
        el.classList.toggle("is-selected", on);
        el.setAttribute("aria-pressed", on ? "true" : "false");
      });
      var linked = quickLog.linkedId && budgetLineItems().find(function(i){ return i.id === quickLog.linkedId; });
      var ctx = document.querySelector(".qlog-context");
      if(ctx) ctx.textContent = quickLogContextText(linked);
      var noteEl = document.getElementById("quickLogNote");
      if(noteEl) noteEl.placeholder = linked ? "Note (optional)" : "What was it? (optional)";
      return;
    }
    var merchantChip = e.target.closest("[data-qlog-merchant]");
    if(merchantChip){
      // Fills the note rather than submitting: the chip answers "where", the amount is still to
      // type, and a chip that logged a transaction on one tap would be a very easy way to record
      // a $0 spend by accident. Focus goes back to the amount, which is always the next thing.
      var noteInput = document.getElementById("quickLogNote");
      if(noteInput){
        noteInput.value = merchantChip.getAttribute("data-qlog-merchant") || "";
        noteInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      var amountInput = document.getElementById("quickLogAmount");
      if(amountInput) amountInput.focus();
      return;
    }
    var refundChip = e.target.closest("[data-qlog-refund-of]");
    if(refundChip){
      var refundId = refundChip.getAttribute("data-qlog-refund-of");
      var refundTarget = state.transactions.find(function(x){ return x.id === refundId; });
      var wasSelected = quickLog.refundOf === refundId;
      rerenderQuickLogPreservingInput(function(){ setQuickLogRefundOf(refundId); renderQuickLogSheet(); });
      // Prefill the amount with what was actually paid — the whole point of picking a purchase —
      // unless the tap just deselected it, where leaving whatever is already typed alone is more
      // useful than clearing it back to blank.
      if(!wasSelected && refundTarget){
        var refundAmountInput = document.getElementById("quickLogAmount");
        if(refundAmountInput){
          refundAmountInput.value = Math.abs(Number(refundTarget.amount) || 0);
          refundAmountInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      return;
    }
    var signBtn = e.target.closest("[data-qlog-sign]");
    if(signBtn){
      rerenderQuickLogPreservingInput(function(){ setQuickLogSign(Number(signBtn.getAttribute("data-qlog-sign"))); });
      return;
    }
    if(e.target.closest("[data-qlog-more]")){
      rerenderQuickLogPreservingInput(function(){ setQuickLogShowAllChips(true); });
      return;
    }
    if(e.target.closest("[data-qlog-date-open]")){
      rerenderQuickLogPreservingInput(function(){ setQuickLogDateOpen(true); });
      return;
    }
    if(e.target.closest("[data-qlog-submit]")){ performQuickLog(); return; }
  });
  // Typing in the sheet's search box narrows the chips. Patched, not re-rendered (see
  // setQuickLogChipFilter) — a re-render per keystroke would drop the caret out of the field
  // being typed into, the same reason picking a chip patches in place.
  document.getElementById("quickLogRoot").addEventListener("input", function(e){
    if(e.target.id === "quickLogSearch"){ setQuickLogChipFilter(e.target.value); return; }
    // A desktop keyboard has a minus key, so a negative amount typed straight into the field is
    // the natural thing to do there — and it must mean the same as tapping Refund, not quietly
    // disagree with a toggle still reading "Spend". The magnitude stays in the field and the
    // toggle carries the sign, which is the one rule this sheet has about the two of them.
    if(e.target.id !== "quickLogAmount") return;
    var typed = parseFloat(e.target.value);
    if(!(typed < 0)) return;
    e.target.value = String(Math.abs(typed));
    rerenderQuickLogPreservingInput(function(){ setQuickLogSign(-1); });
  });
  // Enter anywhere in the sheet logs it — on a phone that's the keyboard's own "go" key, so the
  // whole flow can be amount, chip, go without ever reaching for the button. The one exception is
  // the search box, where Enter means "the thing I just searched for": it picks the top match, so
  // a keyboard user can type three letters, press Enter and be on the right line without leaving
  // the field to hunt for the chip.
  document.getElementById("quickLogRoot").addEventListener("keydown", function(e){
    if(e.key !== "Enter") return;
    e.preventDefault();
    if(e.target.id === "quickLogSearch"){
      var topMatch = document.querySelector(".qlog-chips [data-qlog-chip]");
      if(topMatch) topMatch.click();
      return;
    }
    performQuickLog();
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    if(document.querySelector("[data-qlog-backdrop]")) requestCloseActiveOverlay();
  });

  // ---------------- Income → Received (v3.46.0) ----------------
  function renderReceivedSheet(){
    var root = document.getElementById("receivedRoot");
    if(root) root.innerHTML = receivedSheetHtml();
    var amt = document.getElementById("rcvAmount");
    if(amt) amt.focus();
  }
  function closeReceivedSheetDom(){
    closeReceivedSheet();
    var root = document.getElementById("receivedRoot");
    if(root) root.innerHTML = "";
  }
  function openReceivedSheetFor(target, date){
    openReceivedSheet(target, date);
    renderReceivedSheet();
    pushActiveOverlay(closeReceivedSheetDom);
  }
  // A logged distribution is a holding's payout too, which moves its return and the year's tax.
  function afterReceivedChange(){
    renderReceived();
    renderTransactions();
    renderHomeSummary();
    renderMonthReview();
    renderAssets();
    renderTaxSuper();
    persist();
  }
  document.getElementById("logReceivedBtn").addEventListener("click", function(){ openReceivedSheetFor(); });
  document.getElementById("receivedBody").addEventListener("click", function(e){
    var del = e.target.closest("[data-rcv-del]");
    if(del){
      var restore = deleteIncomeReceived(del.getAttribute("data-rcv-del"));
      afterReceivedChange();
      if(restore) showUndoToast("Record deleted", function(){ restore(); afterReceivedChange(); });
      return;
    }
    var th = e.target.closest("[data-th-apply]");
    if(th){
      var who = th.getAttribute("data-th-apply"), before = takeHomeAdjust(who);
      setTakeHomeAdjust(who, Number(th.getAttribute("data-th-value")) || 0);
      renderAll(); persist();
      showUndoToast(Number(th.getAttribute("data-th-value")) ? who + "'s take-home planned at what lands" : who + "'s take-home back to the tax estimate", function(){ setTakeHomeAdjust(who, before); renderAll(); persist(); });
      return;
    }
    var log = e.target.closest("[data-rcv-log]");
    if(log){ openReceivedSheetFor(log.getAttribute("data-rcv-log")); return; }
    var tog = e.target.closest("[data-rcv-toggle]");
    if(tog){ toggleReceivedRow(tog.getAttribute("data-rcv-toggle")); renderReceived(); }
  });
  document.getElementById("receivedRoot").addEventListener("click", function(e){
    if(e.target.closest("[data-rcv-close]") || e.target === e.target.closest("[data-rcv-backdrop]")){ requestCloseActiveOverlay(); return; }
    var chip = e.target.closest("[data-rcv-chip]");
    if(chip){
      var amountEl = document.getElementById("rcvAmount"), noteEl = document.getElementById("rcvNote"), dateEl = document.getElementById("rcvDate");
      var keep = [amountEl ? amountEl.value : "", noteEl ? noteEl.value : "", dateEl ? dateEl.value : ""];
      setReceivedTarget(chip.getAttribute("data-rcv-chip"));
      renderReceivedSheet();
      document.getElementById("rcvAmount").value = keep[0];
      document.getElementById("rcvNote").value = keep[1];
      if(keep[2]) document.getElementById("rcvDate").value = keep[2];
      return;
    }
    if(e.target.closest("[data-rcv-submit]")) submitReceived();
  });
  document.getElementById("receivedRoot").addEventListener("keydown", function(e){
    if(e.key === "Enter" && (e.target.id === "rcvAmount" || e.target.id === "rcvNote")){ e.preventDefault(); submitReceived(); }
  });
  function submitReceived(){
    if(!receivedSheet) return;
    var amountEl = document.getElementById("rcvAmount");
    var amount = parseAmountInput(amountEl.value || amountEl.placeholder);
    if(!(amount > 0)){ amountEl.focus(); showToast("Type the amount that arrived"); return; }
    var rec = logIncomeReceived({ target: receivedSheet.target, amount: amount, date: document.getElementById("rcvDate").value, what: document.getElementById("rcvNote").value });
    if(!rec){ showToast("Pick what it was"); return; }
    requestCloseActiveOverlay();
    afterReceivedChange();
    showUndoToast("Logged " + fmtCurrency2.format(amount) + " received", function(){ deleteIncomeReceived(rec.id); afterReceivedChange(); });
  }
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape" && document.querySelector("[data-rcv-backdrop]")) requestCloseActiveOverlay();
  });

  // ---------------- Cross-page search ----------------
  function openSearchOverlay(){
    openSearch();
    pushActiveOverlay(closeSearch);
  }
  document.getElementById("searchBtn").addEventListener("click", openSearchOverlay);
  document.getElementById("searchRoot").addEventListener("click", function(e){
    if(e.target.closest("[data-search-close]") || e.target === e.target.closest("[data-search-backdrop]")){
      requestCloseActiveOverlay();
      return;
    }
    var resultBtn = e.target.closest("[data-search-result]");
    if(!resultBtn) return;
    var input = document.getElementById("searchInput");
    var results = getSearchResults(input ? input.value : "");
    var result = results[Number(resultBtn.getAttribute("data-search-result"))];
    if(!result) return;
    closeSearch();
    // Not requestCloseActiveOverlay() — we're navigating to a specific destination right away, so
    // the search-open history entry gets replaced by that destination's own (via showPage's
    // {replace:true}) instead of popped: pressing back from there should land wherever the user
    // was *before* opening search, not resurrect an empty search overlay in between.
    activeOverlayClose = null;
    // v3.128.0: a thing with a page of its own lands there.
    if(result.extra.detail){ openDetail(result.extra.detail.kind, result.extra.detail.id, { replace: true }); return; }
    goToPlace(result.page, result.extra, { replace: true });
  });
  // A place in the app: a page, a subtab, and a row to open and scroll to. Search results and a
  // detail page's "Edit on …" both go through here.
  function goToPlace(page, extra, opts){
    extra = extra || {};
    showPage(page, { replace: !!(opts && opts.replace) });
    // `sub` means different things per page: an Assets category, or one of the Expenses subtabs.
    // Routed by page rather than by guessing from the value, so "budget" can never be mistaken for
    // an asset category.
    if(extra.sub){
      if(page === "expenses") showExpensesSubpage(extra.sub, { replace: true });
      else if(page === "assets") showAssetsSubpage(extra.sub, { replace: true });
    }
    // A budget line lives inside a group card that starts collapsed, so it has to be opened before
    // there is anything on screen to scroll to. Without this the search lands on the page at scroll
    // 0 with the row display:none — the result looks like it did nothing.
    if(extra.lineId && revealBudgetLine(extra.lineId)){
      renderSharedGroups();
      renderBudgetGroupByToggle();
      persist();
    }
    if(extra.scrollToId || extra.lineId){
      // Give showPage's own render + view-transition a moment to finish before scrolling —
      // scrolling to an element mid-transition can land at the wrong offset once it settles.
      setTimeout(function(){
        var el = extra.scrollToId
          ? document.getElementById(extra.scrollToId)
          : document.querySelector('#sharedGroups [data-line-id="' + (window.CSS && window.CSS.escape ? window.CSS.escape(extra.lineId) : extra.lineId) + '"]');
        if(el) el.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 200);
    }
  }
  // ---------------- Detail pages (v3.128.0) ----------------
  function openDetail(kind, id, opts){
    detailTarget.kind = kind; detailTarget.id = id;
    showPage("detail", { replace: !!(opts && opts.replace) });
  }
  document.addEventListener("click", function(e){
    var link = e.target.closest("[data-detail]");
    if(link){ e.preventDefault(); e.stopPropagation(); openDetail(link.getAttribute("data-detail"), link.getAttribute("data-detail-id")); return; }
    if(e.target.closest("[data-detail-back]")){ if(history.length > 1) history.back(); else showPage("dashboard"); return; }
    if(e.target.closest("[data-detail-edit]")){
      var v = detailView(detailTarget.kind, detailTarget.id);
      if(v && v.edit) goToPlace(v.edit.to.page, v.edit.to);
    }
  }, true);
  document.getElementById("searchRoot").addEventListener("input", function(e){
    if(e.target.id === "searchInput") setSearchQuery(e.target.value);
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    if(document.querySelector("[data-search-backdrop]")) requestCloseActiveOverlay();
  });

  // ---------------- Transactions: real dated spend, separate from the planned budget ----------------
  // The Transactions time-range picker. Delegated off the card because renderTransactions()
  // rebuilds the control itself on every change.
  // v3.144.0: the transfer form's word about a card repayment's From, as the accounts are picked.
  document.getElementById("transactionsTable").addEventListener("change", function(e){
    var k = e.target.getAttribute && e.target.getAttribute("data-tf");
    if(k !== "from" && k !== "to") return;
    var q = function(x){ var el = document.querySelector('#transactionsTable [data-tf="' + x + '"]'); return el ? el.value : ""; };
    var hintEl = document.querySelector("#transactionsTable [data-tf-hint]");
    if(!hintEl) return;
    var text = transferHint(q("from"), q("to"), state.accounts, state.transfers);
    hintEl.textContent = text; hintEl.hidden = !text;
  });
  document.getElementById("transactionsTable").addEventListener("click", function(e){
    var rangeBtn = e.target.closest("[data-tx-range]");
    if(rangeBtn){ setTransactionsRange(rangeBtn.getAttribute("data-tx-range")); return; }
    onCashflowListClick(e);
  });

  // ---------------- Cash flow → Spending: filters, money in, transfers, splits, bulk edit (v3.59.0) ----------------
  // v3.206.0 (item 236b): the commit redraws what reads them (lib/views.js) — on screen now, the rest when opened.
  function afterTransactionsChange(){ commit(["transactions", "transfers", "incomeLog"]); }
  function saveTxView(){
    var el = document.querySelector("#transactionsTable [data-cf-view-name]");
    var name = el ? el.value.trim() : "";
    if(!name){ if(el) el.focus(); showToast("Give the view a name"); return; }
    var v = saveView(state.txViews, name, txFilters, function(){ return genId("view"); });
    txViewForm.open = false;
    commit(["txViews"]); renderTransactions();
    if(v) showToast('Saved "' + v.name + '" — it\'s a chip above the list');
  }
  // "Show me in Spending" from anywhere: a button with data-sv and a data-sv-<filter> per filter to set
  // (data-sv-category, data-sv-line, data-sv-from …) opens Spending filtered to exactly that.
  document.addEventListener("click", function(e){
    var b = e.target.closest && e.target.closest("[data-sv]");
    if(!b) return;
    e.preventDefault();
    resetTxFilters();
    FILTER_FIELDS.forEach(function(k){ var v = b.getAttribute("data-sv-" + k); if(v != null) txFilters[k] = v; });
    txFilterPanel.open = false;
    setTransactionsShowAll(false);
    showPage("expenses");
    showExpensesSubpage("spending", { replace: true });
    renderTransactions();
    setTimeout(function(){ var t = document.getElementById("transactionsTable"); if(t) t.scrollIntoView({ behavior: "smooth", block: "start" }); }, 350);
  });
  function pickedIndices(){
    return Object.keys(txSelect.picked).filter(function(k){ return txSelect.picked[k]; }).map(Number).filter(function(i){ return state.transactions[i]; });
  }
  function onCashflowListClick(e){
    var b = e.target.closest("button");
    if(!b || b.disabled) return;
    if(b.hasAttribute("data-cf-dir")){ txFilters.direction = b.getAttribute("data-cf-dir"); setTransactionsShowAll(false); renderTransactions(); return; }
    if(b.hasAttribute("data-cf-clear")){ resetTxFilters(); renderTransactions(); return; }
    // v3.168.0: saved views — pick one, name the filters as one, or delete the one you're on.
    if(b.hasAttribute("data-cf-view")){
      var view = (state.txViews || []).find(function(v){ return v.id === b.getAttribute("data-cf-view"); });
      if(view){ Object.assign(txFilters, applyView(view)); txFilterPanel.open = false; setTransactionsShowAll(false); renderTransactions(); }
      return;
    }
    if(b.hasAttribute("data-cf-view-save")){ txViewForm.open = true; renderTransactions(); var nm = document.querySelector("#transactionsTable [data-cf-view-name]"); if(nm) nm.focus(); return; }
    if(b.hasAttribute("data-cf-view-cancel")){ txViewForm.open = false; renderTransactions(); return; }
    if(b.hasAttribute("data-cf-view-confirm")){ saveTxView(); return; }
    if(b.hasAttribute("data-cf-view-del")){
      var gone = deleteView(state.txViews, b.getAttribute("data-cf-view-del"));
      if(gone){
        commit(["txViews"]); renderTransactions();
        showUndoToast('Deleted the view "' + gone.name + '"', function(){ state.txViews.push(gone); commit(["txViews"]); renderTransactions(); });
      }
      return;
    }
    if(b.hasAttribute("data-cf-panel")){ txFilterPanel.open = !txFilterPanel.open; renderTransactions(); var first = txFilterPanel.open && document.querySelector('#transactionsTable #cfFilterRow select'); if(first) first.focus(); return; }
    if(b.hasAttribute("data-cf-chip-clear")){ txFilters[b.getAttribute("data-cf-chip-clear")] = ""; setTransactionsShowAll(false); renderTransactions(); var fb = document.querySelector('#transactionsTable [data-cf-panel]'); if(fb) fb.focus(); return; }
    if(b.hasAttribute("data-cf-select")){ txSelect.on = !txSelect.on; txSelect.picked = {}; renderTransactions(); return; }
    if(b.hasAttribute("data-cf-transfer")){ transferForm.open = true; renderTransactions(); var f = document.querySelector('#transactionsTable [data-tf="amount"]'); if(f) f.focus(); return; }
    if(b.hasAttribute("data-tf-cancel")){ transferForm.open = false; renderTransactions(); return; }
    if(b.hasAttribute("data-tf-save")){
      var get = function(k){ var el = document.querySelector('#transactionsTable [data-tf="' + k + '"]'); return el ? (el.type === "checkbox" ? el.checked : el.value) : ""; };
      var amt = Number(get("amount"));
      if(!(amt > 0)){ showToast("Enter the amount moved"); return; }
      if(!get("from") || get("from") === get("to")){ showToast("Pick two different accounts"); return; }
      transferForm.open = false;
      saveTransfer({ date: get("date") || localDateStr(), amount: amt, from: get("from"), to: get("to"), what: get("what") }, get("balances"), "Transfer saved");
      return;
    }
    if(b.hasAttribute("data-cf-del-transfer")){
      var goneTransfer = deleteTransfer(b.getAttribute("data-cf-del-transfer"));
      renderTransactions(); commit(["transfers"]);
      if(goneTransfer) showUndoToast("Transfer deleted (balances unchanged)", function(){ state.transfers.splice(goneTransfer.index, 0, goneTransfer.record); renderTransactions(); commit(["transfers"]); });
      return;
    }
    if(b.hasAttribute("data-cf-del-in")){
      var restore = deleteIncomeReceived(b.getAttribute("data-cf-del-in"));
      afterReceivedChange();
      if(restore) showUndoToast("Record deleted", function(){ restore(); afterReceivedChange(); });
      return;
    }
    if(b.hasAttribute("data-cf-pick-all")){ visibleSpendingIndices().forEach(function(i){ txSelect.picked[i] = true; }); renderTransactions(); return; }
    if(b.hasAttribute("data-cf-bulk-apply")){
      var idxs = pickedIndices();
      var lineSel = document.querySelector('#transactionsTable [data-cf-bulk="line"]').value;
      var acctSel = document.querySelector('#transactionsTable [data-cf-bulk="account"]').value;
      var changes = {};
      if(lineSel !== "__keep") changes.linkedExpenseId = lineSel;
      if(acctSel !== "__keep") changes.account = acctSel;
      if(!Object.keys(changes).length){ showToast("Choose a line or an account to set"); return; }
      var before = idxs.map(function(i){ return { i: i, t: Object.assign({}, state.transactions[i]) }; });
      var n = bulkEditTransactions(idxs, changes);
      txSelect.picked = {};
      afterTransactionsChange();
      showUndoToast("Updated " + n + " transaction" + (n === 1 ? "" : "s"), function(){ before.forEach(function(x){ state.transactions[x.i] = x.t; }); afterTransactionsChange(); });
      return;
    }
    if(b.hasAttribute("data-cf-bulk-delete")){
      var del = pickedIndices();
      if(!del.length) return;
      var removed = bulkDeleteTransactions(del);
      txSelect.picked = {};
      afterTransactionsChange();
      showUndoToast("Deleted " + removed.length + " transaction" + (removed.length === 1 ? "" : "s"), function(){ removed.forEach(function(x){ state.transactions.splice(x.index, 0, x.t); }); afterTransactionsChange(); });
      return;
    }
    if(b.hasAttribute("data-cf-split-add")){ splitEditing.parts.push({ linkedExpenseId: null, amount: "" }); renderTransactions(); return; }
    if(b.hasAttribute("data-cf-split-del")){ splitEditing.parts.splice(Number(b.getAttribute("data-cf-split-del")), 1); renderTransactions(); return; }
    if(b.hasAttribute("data-cf-split-cancel")){ splitEditing.idx = null; splitEditing.parts = []; renderTransactions(); return; }
    if(b.hasAttribute("data-cf-split-save")){
      var made = splitTransaction(splitEditing.idx, splitEditing.parts);
      splitEditing.idx = null; splitEditing.parts = [];
      if(made){ afterTransactionsChange(); showToast("Split into " + made.length + " transactions"); }
      return;
    }
  }
  // Split / Merge live inside a transaction's edit area, which on a phone opens as a sheet — so these
  // are delegated from the document rather than the list.
  document.addEventListener("click", function(e){
    var sp = e.target.closest("[data-tx-split]");
    if(sp){
      var idx = Number(sp.getAttribute("data-tx-split")), t = state.transactions[idx];
      if(!t) return;
      var half = Math.round((Number(t.amount) || 0) / 2 * 100) / 100;
      splitEditing.idx = idx;
      splitEditing.parts = [{ linkedExpenseId: t.linkedExpenseId || null, amount: half }, { linkedExpenseId: null, amount: Math.round(((Number(t.amount) || 0) - half) * 100) / 100 }];
      closeActiveModernRow();
      renderTransactions();
      var ed = document.querySelector("#transactionsTable .cf-split");
      if(ed) ed.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    var un = e.target.closest("[data-tx-unsplit]");
    if(un){
      var merged = unsplit(un.getAttribute("data-tx-unsplit"));
      closeActiveModernRow();
      if(merged){ afterTransactionsChange(); showToast("Merged back into one transaction — link it to a line"); }
    }
  });
  var txTable = document.getElementById("transactionsTable");
  // v3.167.0 (item 197): on a phone, swipe a transaction left for Edit, Split and Delete (with the
  // usual undo); swipe it back, or tap anywhere else, to put them away. The tray's buttons carry the
  // same data-tx-* attributes as the editor's, so the document's handlers do the work.
  (function(){
    var phone = window.matchMedia("(max-width: 880px)"), sw = null, shown = null, TRAY = 216;
    function trayHtml(idx){
      var t = state.transactions[idx] || {};
      return '<div class="row-swipe-tray">' +
        '<button type="button" class="btn btn-sm" data-swipe-edit>Edit</button>' +
        (t.splitGroup ? '<button type="button" class="btn btn-sm" data-tx-unsplit="' + escapeAttr(t.splitGroup) + '">Merge</button>'
          : '<button type="button" class="btn btn-sm" data-tx-split="' + idx + '">Split</button>') +
        '<button type="button" class="btn btn-sm btn-danger" data-tx-del="' + idx + '">Delete</button></div>';
    }
    function putAway(){
      if(!shown) return;
      var row = shown; shown = null;
      row.classList.remove("swiped");
      setTimeout(function(){ if(!row.classList.contains("swiped")){ var t = row.querySelector(":scope > .row-swipe-tray"); if(t) t.remove(); } }, 200);
    }
    txTable.addEventListener("touchstart", function(e){
      sw = null;
      if(!phone.matches || e.touches.length !== 1 || e.target.closest(".row-swipe-tray")) return;
      var row = e.target.closest(".m-row.tx-row:not(.open)");
      if(!row) return;
      sw = { row: row, x0: e.touches[0].clientX, y0: e.touches[0].clientY, dx: 0, horiz: null, base: row === shown ? -TRAY : 0 };
    }, { passive: true });
    txTable.addEventListener("touchmove", function(e){
      if(!sw) return;
      var dx = e.touches[0].clientX - sw.x0, dy = e.touches[0].clientY - sw.y0;
      if(sw.horiz === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) sw.horiz = Math.abs(dx) > Math.abs(dy) * 1.5;
      if(!sw.horiz) return;
      if(sw.row !== shown) putAway();
      if(!sw.row.querySelector(":scope > .row-swipe-tray")) sw.row.insertAdjacentHTML("beforeend", trayHtml(Number(sw.row.getAttribute("data-index"))));
      sw.dx = dx;
      var s = sw.row.querySelector(":scope > .m-row-summary");
      s.style.transition = "none";
      s.style.transform = "translateX(" + Math.max(-TRAY, Math.min(0, sw.base + dx)) + "px)";
    }, { passive: true });
    txTable.addEventListener("touchend", function(){
      if(!sw || !sw.horiz){ sw = null; return; }
      var row = sw.row, at = sw.base + sw.dx, s = row.querySelector(":scope > .m-row-summary");
      sw = null;
      s.style.transition = s.style.transform = "";
      if(at < -TRAY / 3){ row.classList.add("swiped"); shown = row; }
      else { shown = row; putAway(); }
    });
    // A tap outside the open tray puts it away; Edit opens the row's editor.
    document.addEventListener("click", function(e){
      if(!shown) return;
      var edit = e.target.closest("[data-swipe-edit]");
      if(edit){ var row = shown; putAway(); var s = row.querySelector(":scope > .m-row-summary"); if(s) s.click(); return; }
      if(!e.target.closest(".row-swipe-tray")) putAway();
    }, true);
  })();
  txTable.addEventListener("keydown", function(e){
    if(e.key === "Enter" && e.target.hasAttribute && e.target.hasAttribute("data-cf-view-name")){ e.preventDefault(); saveTxView(); }
    if(e.key === "Escape" && e.target.hasAttribute && e.target.hasAttribute("data-cf-view-name")){ txViewForm.open = false; renderTransactions(); }
  });
  txTable.addEventListener("change", function(e){
    var t = e.target;
    if(t.hasAttribute("data-cf-filter") && t.getAttribute("data-cf-filter") !== "text"){ txFilters[t.getAttribute("data-cf-filter")] = t.value; setTransactionsShowAll(false); renderTransactions(); return; }
    if(t.hasAttribute("data-cf-pick")){ txSelect.picked[t.getAttribute("data-cf-pick")] = t.checked; renderTransactions(); return; }
    if(t.hasAttribute("data-cf-split-line")){ splitEditing.parts[Number(t.getAttribute("data-cf-split-line"))].linkedExpenseId = t.value || null; return; }
  });
  var cfSearchTimer = null;
  txTable.addEventListener("input", function(e){
    var t = e.target;
    if(t.getAttribute("data-cf-filter") === "text"){
      txFilters.text = t.value;
      clearTimeout(cfSearchTimer);
      cfSearchTimer = setTimeout(function(){
        var pos = t.selectionStart;
        renderTransactions();
        var again = document.querySelector('#transactionsTable [data-cf-filter="text"]');
        if(again){ again.focus(); try{ again.setSelectionRange(pos, pos); }catch(err){} }
      }, 200);
      return;
    }
    if(t.hasAttribute("data-cf-split-amt")){
      splitEditing.parts[Number(t.getAttribute("data-cf-split-amt"))].amount = t.value;
      var tx = state.transactions[splitEditing.idx];
      var placed = splitEditing.parts.reduce(function(s2, p){ return s2 + (Number(p.amount) || 0); }, 0);
      var left = Math.round(((Number(tx && tx.amount) || 0) - placed) * 100) / 100;
      var leftEl = document.querySelector("#transactionsTable .cf-split-left"), saveEl = document.querySelector("#transactionsTable [data-cf-split-save]");
      if(leftEl){ leftEl.textContent = Math.abs(left) < 0.01 ? "All placed" : fmtCurrency2.format(Math.abs(left)) + (left > 0 ? " left to place" : " too much"); leftEl.classList.toggle("warn", Math.abs(left) >= 0.01); }
      if(saveEl) saveEl.disabled = Math.abs(left) >= 0.01;
    }
  });
  document.getElementById("addTransactionBtn").addEventListener("click", function(){
    addTransaction();
    var newTx = state.transactions[state.transactions.length - 1];
    openNewRowModal("transactionsTable", "tx", state.transactions.length - 1, modernTransactionRowOpen, newTx);
  });
  wireModernRowToggle("transactionsTable", modernTransactionRowOpen);
  document.addEventListener("click", function(e){
    var delTxBtn = e.target.closest("[data-tx-del]");
    if(delTxBtn){ deleteTransaction(Number(delTxBtn.getAttribute("data-tx-del"))); return; }
    var txShowAllBtn = e.target.closest("[data-tx-show-all-toggle]");
    if(txShowAllBtn){ setTransactionsShowAll(txShowAllBtn.getAttribute("data-tx-show-all-toggle") === "1"); return; }
    // Flip spend/refund on an existing transaction. Patched in place rather than re-rendered, for
    // the same reason every other field in this row is: a re-render would collapse the row the
    // user is still editing. The button's own label has to move with it, since it says what the
    // *next* press will do.
    var txSignBtn = e.target.closest("[data-tx-sign]");
    if(txSignBtn){
      var signIdx = Number(txSignBtn.getAttribute("data-tx-sign"));
      var signT = state.transactions[signIdx];
      if(!signT) return;
      signT.amount = -(Number(signT.amount) || 0);
      var signRow = txSignBtn.closest(".m-row");
      var signField = signRow && signRow.querySelector(".tx-amount");
      if(signField) signField.value = signT.amount;
      var negative = signT.amount < 0;
      txSignBtn.textContent = negative ? "+" : "\u2212";
      txSignBtn.setAttribute("aria-label", negative ? "Currently a refund — make it a spend" : "Make this a refund");
      var signAmountEl = signRow && signRow.querySelector(".m-row-amt");
      if(signAmountEl) signAmountEl.textContent = fmtCurrency2.format(signT.amount);
      var signTotalEl = document.getElementById("totalTransactionsAmount");
      if(signTotalEl) signTotalEl.textContent = fmtCurrency0.format(state.transactions.reduce(function(s, x){ return s + (Number(x.amount) || 0); }, 0));
      persist();
      renderActualVsPlannedPanel();
      return;
    }
  });
  // Pasting an amount.
  //
  // An <input type="number"> silently reads back "" for anything that isn't a bare number literal
  // — "-$24.99", "−24.99" (the Unicode minus a bank app or phone keyboard copies), "1,299.00",
  // a stray trailing space \u2014 with no error and no badInput flag to test. The field looks right
  // and `parseFloat(value) || 0` stores zero. Sanitising the clipboard text before it lands is
  // the only place this is catchable, so that is what this does; anything already valid is left
  // to the browser, caret behaviour and all.
  document.addEventListener("paste", function(e){
    var el = e.target;
    if(!el || (el.id !== "quickLogAmount" && !(el.classList && el.classList.contains("tx-amount")))) return;
    var text = (e.clipboardData && e.clipboardData.getData("text")) || "";
    if(String(Number(text.trim())) === text.trim()) return;
    var n = parseAmountInput(text);
    if(n === null) return;
    e.preventDefault();
    el.value = String(n);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

  // Actual vs. planned: click a budget row (that has at least one transaction logged against it
  // this month) to expand it in place and see exactly which transactions make up its "actual"
  // figure — no need to separately scroll the Transactions list below to find them.
  document.getElementById("actualVsPlannedPanel").addEventListener("click", function(e){
    if(e.target.closest("[data-tx-del]")) return; // let the delete handler above own this click
    var toggleRow = e.target.closest("[data-budget-row-toggle]");
    if(!toggleRow) return;
    var key = toggleRow.getAttribute("data-budget-row-toggle");
    budgetRowTxnsOpen[key] = !budgetRowTxnsOpen[key];
    renderActualVsPlannedPanel();
  });
  document.getElementById("actualVsPlannedPanel").addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    var toggleRow = e.target.closest("[data-budget-row-toggle]");
    if(!toggleRow) return;
    e.preventDefault();
    toggleRow.click();
  });
  // The collapsed row's title/subline (built once, at render time, from t.what and
  // transactionSummaryText()) is also what's visible in an *open* row's sticky header — but
  // editing tx-what/tx-link/tx-account only ever mutated state.transactions directly, with
  // nothing re-deriving that header text afterward. The edit was always saved correctly; the
  // header just silently went stale until something else (navigating away and back, etc.)
  // happened to trigger a full renderTransactions(). tx-date doesn't need this: it already forces
  // a full re-render itself (see below) since a date edit can also re-sort the row's position.
  function patchTransactionRowHeader(row, t){
    var nameEl = row.querySelector(".m-row-name");
    if(nameEl) nameEl.textContent = transactionDisplayName(t, budgetLineItems());
    var subEl = row.querySelector(".m-row-sub");
    if(subEl) subEl.innerHTML = transactionSummaryText(t);
  }
  document.addEventListener("input", function(e){
    if(!e.target.closest("#transactionsTable")) return;
    var idx = Number(e.target.getAttribute("data-tx-index"));
    var t = state.transactions[idx];
    if(!t) return;
    var txRow = e.target.closest(".m-row");
    if(e.target.classList.contains("tx-what")){
      t.what = e.target.value;
      if(txRow) patchTransactionRowHeader(txRow, t);
    }
    else if(e.target.classList.contains("tx-amount")){
      t.amount = parseFloat(e.target.value) || 0;
      var totalEl = document.getElementById("totalTransactionsAmount");
      if(totalEl) totalEl.textContent = fmtCurrency0.format(state.transactions.reduce(function(s, x){ return s + (Number(x.amount) || 0); }, 0));
      // The −/+ button says what the next press will do, so typing a minus by hand (or pasting
      // one) has to move it too, or the row offers to "make this a refund" when it already is.
      var signToggle = txRow && txRow.querySelector("[data-tx-sign]");
      if(signToggle){
        var isRefund = t.amount < 0;
        signToggle.textContent = isRefund ? "+" : "\u2212";
        signToggle.setAttribute("aria-label", isRefund ? "Currently a refund — make it a spend" : "Make this a refund");
      }
      // The collapsed row's own figure, which patchTransactionRowHeader doesn't cover (it owns the
      // name and sub-line). Without this the header keeps the pre-edit amount until something
      // else forces a full re-render — most visible when flipping a spend to a refund, where the
      // sign in the header would disagree with the field right above it.
      var amtEl = txRow && txRow.querySelector(".m-row-amt");
      if(amtEl) amtEl.textContent = fmtCurrency2.format(t.amount);
    }
    else if(e.target.classList.contains("tx-link")){
      var linkedId = e.target.value || null;
      t.linkedExpenseId = linkedId;
      // Picking a budget line to log against does most of the work for you, the same way an
      // existing expense row's own "Log a transaction" control already does — but only fills in
      // fields the user hasn't touched yet (still zero), never overwriting something they've
      // already typed. Description is deliberately *not* auto-filled: it's optional, and a blank
      // one already displays as the linked line's name (transactionDisplayName), so copying the
      // text in would only create a duplicate that goes stale when the line is renamed. The
      // placeholder is repointed instead, so the field still shows what it'll be listed as.
      if(linkedId){
        var linkedItem = budgetLineItems().find(function(i){ return i.id === linkedId; });
        if(linkedItem && txRow){
          var whatField = txRow.querySelector(".tx-what");
          if(whatField) whatField.placeholder = linkedItem.what || "Optional note";
          var amtField = txRow.querySelector(".tx-amount");
          if(amtField && (parseFloat(amtField.value) || 0) === 0){
            amtField.value = linkedItem.amount;
            t.amount = Number(linkedItem.amount) || 0;
            var totalEl2 = document.getElementById("totalTransactionsAmount");
            if(totalEl2) totalEl2.textContent = fmtCurrency0.format(state.transactions.reduce(function(s, x){ return s + (Number(x.amount) || 0); }, 0));
          }
        }
      } else if(txRow){
        var whatFieldOff = txRow.querySelector(".tx-what");
        if(whatFieldOff) whatFieldOff.placeholder = "Optional note";
      }
      if(txRow) patchTransactionRowHeader(txRow, t);
    }
    else if(e.target.classList.contains("tx-account")){
      t.account = e.target.value || "";
      if(txRow) patchTransactionRowHeader(txRow, t);
      renderActualVsPlannedPanel();
      persist();
      return;
    }
    else if(e.target.classList.contains("tx-date")){
      t.date = e.target.value;
      renderActualVsPlannedPanel();
      persist();
      // Deferred to the next tick: re-sorting the list (a date edit can move this row) means
      // rebuilding #transactionsTable's innerHTML — an ancestor of the input still mid-event
      // right now — which throws in Chromium, the same reentrant-DOM-mutation issue already
      // hit by the scenario-override panel's own date-adjacent edit.
      setTimeout(renderTransactions, 0);
      return;
    }
    else return;
    renderActualVsPlannedPanel();
    persist();
  });

  // ---------------- The transaction table (v3.117.0) ----------------
  document.addEventListener("click", function(e){
    var v = e.target.closest("[data-tx-view]");
    if(!v) return;
    setTxGrid(v.getAttribute("data-tx-view") === "table");
    renderTransactions();
  });
  // Narrowed past a phone's width (or widened back), the table and the list swap.
  var txGridWide = window.innerWidth > 720, txGridTimer = null;
  window.addEventListener("resize", function(){
    clearTimeout(txGridTimer);
    txGridTimer = setTimeout(function(){ var w = window.innerWidth > 720; if(w !== txGridWide){ txGridWide = w; renderTransactions(); } }, 200);
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Enter" || !e.target.closest || !e.target.closest(".tx-grid")) return;
    var newRow = e.target.closest(".txg-new");
    if(newRow){
      e.preventDefault();
      var val = function(c){ var el = newRow.querySelector(c); return el ? el.value : ""; };
      var link = val(".txg-new-link") || null;
      var line = link && budgetLineItems().find(function(i){ return i.id === link; });
      var amount = parseFloat(val(".txg-new-amount"));
      if(!(amount || 0) && line) amount = Number(line.amount) || 0;
      if(!(amount || 0) && !val(".txg-new-what").trim()){ showToast("Type an amount, or pick a line"); return; }
      state.transactions.push({ id: genId("t"), date: val(".txg-new-date") || localDateStr(), what: val(".txg-new-what").trim(), linkedExpenseId: link,
        account: val(".txg-new-account") || (line && line.account) || "", amount: amount || 0 });
      persist(); renderTransactions(); renderActualVsPlannedPanel();
      var again = document.querySelector("#transactionsTable .txg-new-what");
      if(again) again.focus();
      return;
    }
    // Enter in a cell moves down the column, the way a spreadsheet does.
    var cell = e.target.closest("td"), row = e.target.closest("tr");
    if(!cell || !row || !row.nextElementSibling) return;
    e.preventDefault();
    var next = row.nextElementSibling.children[cell.cellIndex];
    var input = next && next.querySelector("input, select");
    if(input) input.focus();
  });
  // ---------------- Accounts: named money sources, used for credit-card statement cycles ----------------
  document.getElementById("addAccountBtn").addEventListener("click", function(){
    addAccount();
    updateAccountSuggestions();
    var nameIn = document.querySelector("#accountsTable .acct-card.is-open:last-of-type .acct-mgmt-name") || document.querySelectorAll("#accountsTable .acct-mgmt-name");
    if(nameIn && nameIn.length !== undefined) nameIn = nameIn[nameIn.length - 1];
    if(nameIn) nameIn.focus();
  });
  // "Update balance" → Save: written to the record the balance lives in (calc/accounts.js), so net
  // worth, runway and the projections move with it.
  function saveAccountBalance(idx){
    var a = state.accounts[idx];
    var inp = document.querySelector('#accountsTable .acct-bal-input[data-acct-index="' + idx + '"]');
    if(!a || !inp) return;
    if(inp.value === "" || isNaN(Number(inp.value))){ inp.focus(); return; }
    if(!setAccountBalance(a, inp.value)){ showToast("Pick the loan this offset sits against first"); return; }
    delete balanceEditing[a.id];
    renderAll();
    commit(["accounts", "assets", "debts", "properties"]);
    showToast("Updated " + (a.name || "the account") + " to " + fmtCurrency0.format(Number(inp.value)));
  }
  document.getElementById("accountsTable").addEventListener("keydown", function(e){
    if(e.key === "Enter" && e.target.classList.contains("acct-bal-input")){ e.preventDefault(); saveAccountBalance(Number(e.target.getAttribute("data-acct-index"))); }
    if(e.key === "Escape" && e.target.classList.contains("acct-bal-input")){ var id = (state.accounts[Number(e.target.getAttribute("data-acct-index"))] || {}).id; delete balanceEditing[id]; renderAccounts(); }
  });
  document.addEventListener("click", function(e){
    var delAcctBtn = e.target.closest("[data-acct-del]");
    if(delAcctBtn){ deleteAccount(Number(delAcctBtn.getAttribute("data-acct-del"))); updateAccountSuggestions(); return; }
    var tog = e.target.closest("[data-acct-toggle]");
    if(tog){ var tid = tog.getAttribute("data-acct-toggle"); openAccounts[tid] = !openAccounts[tid]; renderAccounts(); return; }
    var balBtn = e.target.closest("[data-acct-bal]");
    if(balBtn){
      var bid = balBtn.getAttribute("data-acct-bal");
      balanceEditing[bid] = true; renderAccounts();
      var inp = document.querySelector('#accountsTable .acct-card[data-acct-index="' + state.accounts.findIndex(function(x){ return x.id === bid; }) + '"] .acct-bal-input');
      if(inp){ inp.focus(); inp.select(); }
      return;
    }
    var cancelBal = e.target.closest("[data-acct-bal-cancel]");
    if(cancelBal){ delete balanceEditing[cancelBal.getAttribute("data-acct-bal-cancel")]; renderAccounts(); return; }
    var saveBal = e.target.closest("[data-acct-bal-save]");
    if(saveBal){ saveAccountBalance(Number(saveBal.getAttribute("data-acct-bal-save"))); return; }
    var adopt = e.target.closest("[data-acct-adopt]");
    if(adopt){
      var link = adopt.getAttribute("data-acct-adopt");
      var src = resolveLink(link);
      state.accounts.push({ id: genId("acct"), name: src ? src.label.replace(/ — offset$/, " offset") : "Account", type: adopt.getAttribute("data-acct-adopt-type") || "savings", statementStartDay: 1, link: link });
      updateAccountSuggestions();
      renderAll();
      commit(["accounts", "assets", "debts", "properties"]);
      showToast("Added " + (src ? src.label : "the account") + " to Accounts");
      return;
    }
  });
  document.addEventListener("input", function(e){
    if(!e.target.closest("#accountsTable")) return;
    var idx = Number(e.target.getAttribute("data-acct-index"));
    var a = state.accounts[idx];
    if(!a) return;
    if(e.target.classList.contains("acct-mgmt-name")){
      // v3.204.0 (item 235b): the account's record, then the name copies on rows linked to it by id.
      renameAccountEverywhere(a, e.target.value);
      renderTransactions();
      updateAccountSuggestions();
    }
    else if(e.target.classList.contains("acct-mgmt-type")){
      a.type = ACCOUNT_TYPE_KEYS.indexOf(e.target.value) !== -1 ? e.target.value : "everyday";
      // A link only makes sense for the kinds of record this type can draw from.
      if(a.link && !accountSourceOptions(a).some(function(o){ return o.key === a.link; })) a.link = "";
      // v3.101.0: a property manager's account picks up the statement bills logged before it existed.
      if(a.type === "agent"){
        if(!a.link && (state.properties || []).length === 1 && state.properties[0].id) a.link = "property:" + state.properties[0].id;
        var filled = fillAgentAccount(state);
        if(filled) showToast(filled + " bill" + (filled === 1 ? "" : "s") + " from statements now on " + (a.name || "this account"));
      }
      renderActualVsPlannedPanel();
      commit(["accounts", "assets", "debts", "properties"]);
      // Deferred: showing/hiding the statement-day field means rebuilding #accountsTable, an
      // ancestor of this <select> that's still mid-event right now — same reentrant-DOM-mutation
      // issue as the Transactions date field above.
      setTimeout(renderAccounts, 0);
      return;
    }
    else if(e.target.classList.contains("acct-mgmt-day")){
      a.statementStartDay = Math.min(28, Math.max(1, parseInt(e.target.value, 10) || 1));
    }
    else if(e.target.classList.contains("acct-mgmt-autopay")){
      if(e.target.value) a.autoPayFrom = e.target.value; else delete a.autoPayFrom;
    }
    else if(e.target.classList.contains("acct-mgmt-payday")){
      var pd = parseInt(e.target.value, 10);
      if(pd >= 1 && pd <= 31) a.payDay = pd; else delete a.payDay;
    }
    else if(e.target.classList.contains("acct-mgmt-limit")){
      var lim = e.target.value === "" ? null : Number(e.target.value);
      if(lim == null || !(lim >= 0)) delete a.limit; else a.limit = lim;
    }
    else if(e.target.classList.contains("acct-mgmt-link")){
      a.link = e.target.value;
      if(a.type === "agent") fillAgentAccount(state);
      commit(["accounts", "assets", "debts", "properties"]);
      setTimeout(function(){ renderAll(); }, 0);
      return;
    }
    else return;
    renderActualVsPlannedPanel();
    commit(["accounts", "assets", "debts", "properties"]);
  });

  // ---------------- Categories: the spending rollup ----------------
  document.getElementById("planSubnav").addEventListener("click", function(e){
    var b = e.target.closest("[data-plan-sub]");
    if(b){ showPlanSubpage(b.getAttribute("data-plan-sub")); if(b.getAttribute("data-plan-sub") === "goals") renderGoalsTab(); }
  });
  // v3.129.0: Plan → Goals — the emergency fund and savings goals (from Accounts), Can we buy? and
  // where financial independence stands.
  function renderGoalsTab(){ renderSavingsGoals(); renderCanBuy(); var f = document.getElementById("goalsFireBody"); if(f) f.innerHTML = goalsFireHtml(); }
  // The rail over Net worth, Accounts, Investments and Property.
  document.addEventListener("click", function(e){
    var r = e.target.closest && e.target.closest(".nw-rail-item");
    if(r) showPage(r.getAttribute("data-page"));
    var pg = e.target.closest && e.target.closest("[data-plan-sub-go]");
    if(pg){ showPage("plan"); showPlanSubpage(pg.getAttribute("data-plan-sub-go"), { replace: true }); if(pg.getAttribute("data-plan-sub-go") === "retirement") renderRetirement(); }
  });
  // v3.109.0: "Show all" / "Show fewer" under a capped list (Actual vs. planned, This year so far).
  document.addEventListener("click", function(e){
    var b = e.target.closest("[data-list-all]");
    if(!b) return;
    var key = b.getAttribute("data-list-all");
    listsShowAll[key] = !listsShowAll[key];
    if(key === "avp") renderActualVsPlannedPanel();
    if(key === "ytd") renderYearSpending();
    if(key === "irr") renderActualVsPlannedPanel();
    if(key === "trend") renderSpendingTrends();
  });
  // ---------------- A payslip, read (v3.116.0) ----------------
  function redrawPayslipPanel(person){
    var host = [].find.call(document.querySelectorAll("[data-tax-person]"), function(el){ return el.getAttribute("data-tax-person") === person; });
    var d = host && host.querySelector(".tax-ytd");
    if(d){ d.outerHTML = withholdingCheckHtml(person); var again = host.querySelector(".tax-ytd"); if(again) again.open = true; }
  }
  function readPayslipLines(person, lines){
    var r = parsePayslip(lines);
    payslipRead[person] = r.found.length ? r : { error: "Nothing in that reads like a payslip — no Gross, Tax or Net lines with amounts." };
    if(r.found.length) applyPayslipYtd(person, r);
    redrawPayslipPanel(person);
  }
  // v3.149.0: a payslip with a year-to-date column sets the refund-or-bill check straight away —
  // unless what's there is from a later payslip. Undo puts the old figures back.
  function applyPayslipYtd(person, r){
    if(r.ytd.gross == null || r.ytd.tax == null || !r.periodEnd) return false;
    var st = personTaxSettings(person), was = st.ytd ? Object.assign({}, st.ytd) : null;
    if(was && was.asOf && was.asOf > r.periodEnd) return false;
    if(was && was.asOf === r.periodEnd && was.gross === r.ytd.gross && was.withheld === r.ytd.tax) return false;
    st.ytd = { asOf: r.periodEnd, gross: r.ytd.gross, withheld: r.ytd.tax };
    persist();
    showUndoToast("Refund-or-bill check updated from the payslip (to " + fmtDate(r.periodEnd) + ")", function(){
      if(was) st.ytd = was; else delete st.ytd;
      persist(); redrawPayslipPanel(person);
    });
    return true;
  }
  document.addEventListener("change", function(e){
    var person = e.target.getAttribute && e.target.getAttribute("data-slip-file");
    if(person == null || !e.target.files || !e.target.files[0]) return;
    var file = e.target.files[0];
    file.arrayBuffer().then(function(buf){ return pdfLines(new Uint8Array(buf)); }).then(function(lines){
      readPayslipLines(person, lines.map(function(l){ return l.cells.map(function(c){ return c.s; }).join("   "); }));
    }).catch(function(){ payslipRead[person] = { error: "That PDF couldn't be read. Paste its text instead." }; redrawPayslipPanel(person); });
  });
  document.addEventListener("click", function(e){
    var read = e.target.closest("[data-slip-read]");
    if(read){
      var p0 = read.getAttribute("data-slip-read");
      var ta = read.closest(".slip-paste").querySelector("textarea");
      readPayslipLines(p0, String(ta.value || "").split(/\r?\n/));
      return;
    }
    var use = e.target.closest("[data-slip-use]");
    if(use){
      var p1 = use.getAttribute("data-slip-use"), r1 = payslipRead[p1];
      if(!r1 || r1.error) return;
      var st1 = personTaxSettings(p1);
      st1.ytd = { asOf: r1.periodEnd, gross: r1.ytd.gross, withheld: r1.ytd.tax };
      persist(); redrawPayslipPanel(p1);
      showToast("Year-to-date figures set from the payslip");
      return;
    }
    // v3.148.0: the pay itself, logged as take-home received.
    var lg = e.target.closest("[data-slip-log]");
    if(lg){
      var p3 = lg.getAttribute("data-slip-log"), r3 = payslipRead[p3], chk = r3 && payslipCheck(p3, r3);
      if(!chk || !chk.loggable) return;
      var srow = salaryRowFor(p3);
      var rec = logIncomeReceived({ target: "net:" + p3, amount: chk.loggable.amount, date: chk.loggable.date, what: "Pay (from payslip)", account: srow ? srow.account || "" : "" });
      persist(); renderAll(); redrawPayslipPanel(p3);
      if(rec) showUndoToast("Pay logged as received", function(){ deleteIncomeReceived(rec.id); persist(); renderAll(); redrawPayslipPanel(p3); });
      return;
    }
    var sal = e.target.closest("[data-slip-salary]");
    if(sal){
      var p2 = sal.getAttribute("data-slip-salary"), r2 = payslipRead[p2], row = salaryRowFor(p2), freq = payFrequency(r2 || {});
      if(!r2 || !row || !freq) return;
      var was = { amount: row.amount, freq: row.freq };
      row.amount = r2.gross; row.freq = freq;
      persist(); renderAll();
      showUndoToast("Salary set from the payslip", function(){ row.amount = was.amount; row.freq = was.freq; persist(); renderAll(); });
    }
  });
  // ---------------- Settings → Import rules (v3.60.0) ----------------
  function renderRules(){
    var el = document.getElementById("rulesBody");
    if(el) el.innerHTML = rulesPageHtml(budgetLineItems());
    var c = document.getElementById("rulesCount");
    if(c) c.textContent = (state.importRules || []).length + " rule" + ((state.importRules || []).length === 1 ? "" : "s");
  }
  var rulesBody = document.getElementById("rulesBody");
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
  var rulesTestTimer = null;
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
  function renderSettingsTab(id){
    if(id === "rules") renderRules();
    if(id === "categories") renderCategories();
    if(id === "people") renderPeopleTab();
    if(id === "checks") renderHealth();
    if(id === "preferences") renderYearBasisPreference();
  }
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
  });
  // v3.157.0 (item 187): a category's colour and icon, picked from its badge.
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

  wireModernRowToggle("propertiesBody", modernPropRowOpen);
  wireModernRowToggle("homeBody", modernHomeRowOpen);
  ["Cash", "Shares", "Super", "Vehicle", "Other"].forEach(function(cat){
    wireModernRowToggle("assetsSub-" + cat, modernAssetRowOpen);
  });

  function onScenarioControlClick(e){
    // More specific controls first — data-rename/data-delete/data-edit-scenario2 all live
    // *inside* the now-clickable .home-block-head (data-collapse-toggle), so that catch-all has
    // to be checked last or it would swallow clicks meant for the buttons nested inside it.
    var renameBtn = e.target.closest("[data-rename]");
    if(renameBtn){ renameScenario(renameBtn.getAttribute("data-rename")); return true; }
    var cloneBtn = e.target.closest("[data-clone]");
    if(cloneBtn){ cloneScenario(cloneBtn.getAttribute("data-clone")); return true; }
    var delBtn = e.target.closest("[data-delete]");
    if(delBtn){ var scName = delBtn.getAttribute("data-delete"); withUndo('Deleted "' + scName + '"', function(){ deleteScenario(scName); return state.scenarios.indexOf(scName) === -1; }); return true; }
    // v3.174.0 (item 209): adding a scenario starts from a question.
    if(e.target.closest("#addScenarioBtn") || e.target.closest("#addScenarioBtn2")){ openStartSheet(); return true; }
    var editBtn = e.target.closest("[data-edit-scenario]");
    // v3.181.0 (item 212): Edit opens the scenario on its own page, as a draft.
    if(editBtn){ openScenarioEditor(editBtn.getAttribute("data-edit-scenario")); return true; }
    var setActiveBtn = e.target.closest("[data-edit-scenario2]");
    if(setActiveBtn){ chooseScenario(setActiveBtn.getAttribute("data-edit-scenario2")); return true; }
    var collapseBtn = e.target.closest("[data-collapse-toggle]");
    if(collapseBtn){
      var cs = collapseBtn.getAttribute("data-collapse-toggle");
      homeBlockCollapsed[cs] = !homeBlockCollapsed[cs];
      renderHomeBody();
      return true;
    }
    return false;
  }

  document.getElementById("cards").addEventListener("click", function(e){
    if(onScenarioControlClick(e)) return;
    // The ⋯ menu's own toggle is handled by the page-wide overflow handler; opening it isn't a vote
    // for this scenario.
    if(e.target.closest(".card-overflow")) return;
    var cardSel = e.target.closest(".card-select");
    if(cardSel) chooseScenario(cardSel.getAttribute("data-scenario"));
  });
  document.getElementById("homeBody").addEventListener("click", onScenarioControlClick);

  // Dashboard's own stats already tease the "Projected net worth" figure this links through to —
  // Projections itself had no reachable link from Dashboard at all, and lives behind the mobile
  // "More" tab (an occasional what-if page, not day-to-day data entry), so this is the one
  // one-tap bridge from the page everyone actually lands on first.
  document.getElementById("dashboardProjectionsLink").addEventListener("click", function(){ showPage("projections"); });
  // v3.33.0: tiles that open the panel behind them (FI → Insights, tax year → the worksheet).
  document.getElementById("dashboardStats").addEventListener("click", function(e){
    var jump = e.target.closest("[data-dashboard-jump]");
    if(!jump) return;
    var where = jump.getAttribute("data-dashboard-jump");
    if(where === "insights"){
      var tab = document.querySelector('[data-dashboard-sub="insights"]');
      if(tab){ tab.click(); tab.scrollIntoView({ behavior: "smooth", block: "start" }); }
    } else if(where === "taxyear"){
      if(jump.getAttribute("data-tax-fy")) setTaxYearSelected(jump.getAttribute("data-tax-fy"));
      showPage("tax");
      showTaxSubpage("returns", { replace: true });
      renderTaxYear();
    }
  });
  document.getElementById("homeBody").addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    var collapseBtn = e.target.closest("[data-collapse-toggle]");
    if(!collapseBtn) return;
    e.preventDefault();
    collapseBtn.click();
  });

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

  document.getElementById("incomeExportCsvBtn").addEventListener("click", exportIncomeCsv);
  document.getElementById("expenseExportCsvBtn").addEventListener("click", exportExpensesCsv);
  document.getElementById("assetsExportCsvBtn").addEventListener("click", exportAssetsCsv);
  document.getElementById("propertyLoansExportCsvBtn").addEventListener("click", exportPropertyLoansCsv);

  // ---------------- Expenses: import from a spreadsheet ----------------
  // Parsed rows live here (not in expenses.js) between file-select and the confirm click — nothing
  // touches state.shared until expenseImportConfirmBtn, handled in the global click delegate below.
  var pendingExpensesImport = [];
  document.getElementById("expenseDownloadTemplateBtn").addEventListener("click", exportExpensesImportTemplateCsv);
  document.getElementById("expenseImportBtn").addEventListener("click", function(){
    document.getElementById("expenseImportFile").click();
  });
  document.getElementById("expenseImportFile").addEventListener("change", function(e){
    var file = e.target.files[0];
    e.target.value = "";
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      var parsed = parseExpensesImportCsv(String(reader.result));
      pendingExpensesImport = renderExpensesImportPreview(parsed);
    };
    reader.onerror = function(){ showToast("Couldn't read that file"); };
    reader.readAsText(file);
  });

  // ---------------- Spending: import a bank CSV ----------------
  // Nothing here writes to state until bankImportConfirmBtn — the review panel is built entirely
  // from the module's own session-only `bankImport`, so cancelling or navigating away leaves the
  // transaction list exactly as it was.
  document.getElementById("bankImportPickBtn").addEventListener("click", function(){
    document.getElementById("bankImportFile").click();
  });
  document.getElementById("bankImportFile").addEventListener("change", function(e){
    var file = e.target.files[0];
    e.target.value = "";
    if(!file) return;
    importBankFile(file);
  });
  // v3.93.0: a statement shared to the installed app from a banking app. sw.js parks the file in
  // its own cache and opens the app with ?shared=1; it's picked up once and the cache cleared.
  (function pickUpSharedStatement(){
    if(!/[?&]shared=1\b/.test(location.search) || typeof caches === "undefined") return;
    var key = new URL("shared-statement", new URL(appAssetUrl("sw.js"), location.href)).href;
    try { history.replaceState(history.state, "", location.pathname + location.hash); } catch(e){}
    caches.open("wealth-planner-share").then(function(cache){
      return cache.match(key).then(function(res){
        if(!res) return;
        var name = decodeURIComponent(res.headers.get("X-File-Name") || "statement");
        var type = res.headers.get("Content-Type") || "";
        return res.blob().then(function(blob){
          cache.delete(key);
          showPage("expenses");
          showExpensesSubpage("spending", { replace: true });
          importBankFile(new File([blob], name, { type: type }));
        });
      });
    }).catch(function(){});
  })();
  // One way in for a statement file, whether chosen here or shared to the app (v3.93.0).
  function importBankFile(file, fromInbox){
    inbox.current = fromInbox || null;
    renderInbox();
    // v3.92.0: a PDF statement is read into the same CSV the import already understands.
    if(/\.pdf$/i.test(file.name) || file.type === "application/pdf"){
      showToast("Reading the PDF…");
      file.arrayBuffer().then(function(buf){ return pdfLines(new Uint8Array(buf)); }).then(function(lines){
        var st = statementFromLines(lines);
        // v3.148.0: a payslip, not a statement — to the payslip check instead.
        if(openAsPayslip(lines, st, fromInbox)) return;
        if(!st.rows.length){ showToast("Couldn't find transactions in that PDF — a CSV export from your bank will work"); return; }
        startBankImport(statementCsv(st.rows), file.name);
        // v3.149.1: a card's statement (a limit, a minimum payment) with no account picked from its
        // name: the only credit card, so its payment reads as a transfer and its balance can be set.
        var cards = (state.accounts || []).filter(function(a){ return a.type === "credit" && a.name; });
        if(st.card && cards.length === 1 && bankImport && !bankImport.account) setStatementAccount(cards[0].name);
        renderBankImportPanel();
        var card = document.getElementById("bankImportCard");
        if(card) card.scrollIntoView({ behavior: "smooth", block: "start" });
      }).catch(function(){ showToast("Couldn't read that PDF"); });
      return;
    }
    var reader = new FileReader();
    reader.onload = function(){
      var text = String(reader.result);
      // startBankImport holds onto the parsed rows itself, so the date-order control can re-parse
      // without the user having to find the file again.
      startBankImport(text, file.name);
      renderBankImportPanel();
      var card = document.getElementById("bankImportCard");
      if(card) card.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    reader.onerror = function(){ showToast("Couldn't read that file"); };
    reader.readAsText(file);
  }
  // v3.148.0: a payslip chosen or dropped in Statements reads as one (gross, net, and tax or super,
  // and next to no statement rows) — it opens on that person's tax card (Tax → This year), checked
  // against the plan.
  // Whose: the person it names, else the one whose pay is nearest its gross.
  function openAsPayslip(lines, st, fromInbox){
    var text = lines.map(function(l){ return l.cells.map(function(c){ return c.s; }).join("   "); });
    var slip = parsePayslip(text);
    if(!(slip.gross > 0 && slip.net > 0 && (slip.tax != null || slip.super != null)) || st.rows.length > 2) return false;
    var people = getTaxPeople();
    if(!people.length) return false;
    var all = text.join(" ").toLowerCase();
    var named = people.filter(function(p){ return new RegExp("\\b" + p.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(all); });
    var freq = payFrequency(slip);
    var near = function(p){ var row = salaryRowFor(p); return row && freq ? Math.abs(periodsOf(Number(row.amount) || 0, row.freq).yearly - periodsOf(slip.gross, freq).yearly) : Infinity; };
    var person = named.length === 1 ? named[0] : (named.length ? named : people).slice().sort(function(a, b){ return near(a) - near(b); })[0];
    payslipRead[person] = slip;
    applyPayslipYtd(person, slip);
    if(fromInbox) inboxFileDone(fromInbox);
    inbox.current = null; renderInbox();
    // The person's tax card, where the payslip panel lives: Tax → This year.
    showPage("tax");
    showTaxSubpage("year", { replace: true });
    setTimeout(function(){
      redrawPayslipPanel(person);
      var host = [].find.call(document.querySelectorAll("[data-tax-person]"), function(el){ return el.getAttribute("data-tax-person") === person; });
      var d = host && host.querySelector(".tax-ytd");
      if(d) d.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
    showToast("A payslip — checked against " + person + "'s plan");
    return true;
  }
  // Patched, not re-rendered. A full renderBankImportPanel() here would move the row the user just
  // touched out of "Needs you" and into "Ready" — reordering the list under their finger mid-review,
  // on a phone, which is how a review screen gets abandoned. The counts and badge update in place
  // and the row stays where it is until the next file is loaded.
  document.getElementById("bankImportPanel").addEventListener("change", function(e){
    // The statement's account changes what counts as a transfer and whose balance it sets — a full render.
    if(e.target.hasAttribute("data-bank-account")){ setStatementAccount(e.target.value); renderBankImportPanel(); return; }
    if(e.target.hasAttribute("data-bank-setbalance")){ setStatementBalanceOn(e.target.checked); return; }
    var lineSel = e.target.closest(".bank-group-line");
    if(lineSel) setBankImportGroupLine(lineSel.getAttribute("data-bank-group"), lineSel.value);
    var catSel = e.target.closest(".bank-group-category");
    if(catSel) setBankImportGroupCategory(catSel.getAttribute("data-bank-group"), catSel.value);
    if(lineSel || catSel) patchBankImportPanel((lineSel || catSel).getAttribute("data-bank-group"));
  });
  document.getElementById("bankImportPanel").addEventListener("click", function(e){
    var orderBtn = e.target.closest("[data-bank-date-order]");
    if(orderBtn){
      reparseBankImportWith(orderBtn.getAttribute("data-bank-date-order"));
      renderBankImportPanel();
      return;
    }
    // v3.150.0: a row logged on the statement's account that the statement doesn't have.
    var strayDel = e.target.closest("[data-bank-stray-del]");
    if(strayDel){
      var sid = strayDel.getAttribute("data-bank-stray-del");
      var si = state.transactions.findIndex(function(t){ return t.id === sid; });
      if(si === -1) return;
      var gone = state.transactions.splice(si, 1)[0];
      persist(); renderBankImportPanel(); refreshAfterBankImport();
      showUndoToast("Deleted " + (gone.what || "the row"), function(){ state.transactions.splice(si, 0, gone); persist(); renderBankImportPanel(); refreshAfterBankImport(); });
      return;
    }
    // Folding the maybes in or out changes which rows exist, so this one does need a full render —
    // unlike assigning a group, where re-rendering would move the row out from under the finger.
    var maybesBtn = e.target.closest("[data-bank-maybes]");
    if(maybesBtn){
      setIncludePossibleDuplicates(maybesBtn.getAttribute("data-bank-maybes") === "1");
      renderBankImportPanel();
      return;
    }
    if(e.target.closest("#bankImportCancelBtn")){ clearBankImport(); inbox.current = null; renderInbox(); return; }
    if(!e.target.closest("#bankImportConfirmBtn")) return;
    var result = commitBankImport();
    clearBankImport();
    if(inbox.current) inboxFileDone(inbox.current);
    refreshAfterBankImport();
    // v3.163.0 (item 193): what was just imported waits to be reviewed — say so where it's counted.
    renderTxReviewBanner(); renderHomeSummary();
    // Transfers and a statement balance reach Accounts, Home and net worth too.
    if((result.transferIds && result.transferIds.length) || result.balanceSet) renderAll();
    showUndoToast(
      (result.ids.length || !(result.reconciled && result.reconciled.length) ? "Imported " + result.ids.length + " transaction" + (result.ids.length === 1 ? "" : "s") : "Nothing new") +
        (result.refunds ? " · " + result.refunds + " refund" + (result.refunds === 1 ? "" : "s") : "") +
        (result.receivedIds && result.receivedIds.length ? " · " + result.receivedIds.length + " income received" : "") +
        (result.transferIds && result.transferIds.length ? " · " + result.transferIds.length + " transfer" + (result.transferIds.length === 1 ? "" : "s") : "") +
        (result.reconciled && result.reconciled.length ? " · " + result.reconciled.length + " matched to what you logged" : "") +
        (result.balanceSet ? " · " + result.balanceSet.account + " balance updated" : "") +
        (result.linesCreated ? " · " + result.linesCreated + " new budget line" + (result.linesCreated === 1 ? "" : "s") : "") +
        (result.learned ? " · learned " + result.learned + " shop" + (result.learned === 1 ? "" : "s") : ""),
      function(){
        // Rules the import taught are left in place on purpose — they're a preference, not part of
        // the data being undone, and re-importing the same file is the usual reason to undo.
        undoBankImport(result.ids, result.lineIds, result.receivedIds, result.transferIds, result.balanceSet, result.reconciled);
        refreshAfterBankImport();
        renderAll();
      }
    );
    // v3.162.0 (item 192): a first statement with three months in it and nothing budgeted yet goes
    // straight on to the budget it suggests — the step a new household would otherwise have to find.
    if(result.ids.length && !(state.shared || []).length){
      var pb = currentHistoryBudget();
      if(pb.ready && pb.proposals.length){
        renderBudgetFromHistory();
        showPage("expenses"); showExpensesSubpage("budget", { replace: true });
        var hb = document.getElementById("historyBudgetCard");
        if(hb){ hb.open = true; setTimeout(function(){ hb.scrollIntoView({ behavior: "smooth", block: "start" }); }, 120); }
      }
    }
  });
  // A transfer saved, and with `moveBalances` both accounts' balances moved by it (where each has
  // one) — the transfer form and Checks' "Save repayment" (v3.146.0). Undo puts both back (v3.144.0).
  // What a transfer touches (v3.206.0, item 236b: its commit redraws what reads them): the transfers, and —
  // when it moved both balances — "balances": the money in the accounts and the records that hold it (a Cash
  // asset, a debt, a property's loan or offset). Not "accounts" — nothing about an account but its balance
  // changed, and every Cash flow list reads accounts for their names.
  function transferTouched(balancesMoved){ return balancesMoved ? ["transfers", "balances"] : ["transfers"]; }

  function saveTransfer(t, moveBalances, message){
    var rec = addTransfer(t);
    var moved = [], before = [];
    if(moveBalances){
      [[rec.from, -1], [rec.to, 1]].forEach(function(pair){
        var acct = state.accounts.find(function(a){ return a.name === pair[0]; });
        if(!acct) return;
        var bal = accountBalance(acct);
        if(bal.balance == null) return;
        before.push([acct, bal.balance]);
        // Money into a card or loan lowers what's owed; out of one raises it.
        var delta = (bal.owed ? -pair[1] : pair[1]) * rec.amount;
        setAccountBalance(acct, bal.balance + delta, rec.date);
        moved.push(acct.name);
      });
    }
    commit(transferTouched(moved.length > 0));
    showUndoToast(message + (moved.length ? " — " + moved.join(" and ") + " updated" : ""), function(){
      deleteTransfer(rec.id);
      before.forEach(function(b){ setAccountBalance(b[0], b[1], rec.date); });
      commit(transferTouched(before.length > 0));
    });
    return rec;
  }

  // ---------------- Statements from a folder (v3.142.0, item 181) ----------------
  // What's waiting in Statements (Dropbox, or the backup folder) is listed once the app has opened
  // and synced; each goes through importBankFile like a chosen file, and moves to Statements/Imported
  // once confirmed. Cancelling leaves it where it is, for next time.
  var inbox = { files: [], places: [], current: null };
  function inboxPlaces(){
    var p = [];
    if(dropboxConnected()) p.push("your Dropbox app folder");
    return savedFolder().then(function(h){ if(h) p.push("the backup folder (" + h.name + ")"); return p; }).catch(function(){ return p; });
  }
  function renderInbox(){
    var el = document.getElementById("bankInboxNote");
    if(!el) return;
    var html = inboxNoteHtml(inbox.files, inbox.places, inbox.current);
    el.innerHTML = html;
    el.hidden = !html;
  }
  function checkInbox(announce){
    return Promise.all([listInbox(), inboxPlaces()]).then(function(r){
      inbox.files = r[0]; inbox.places = r[1];
      renderInbox();
      if(announce && inbox.files.length) showPersistentToast(inboxMessage(inbox.files.length, inbox.files[0].label) + ".", "Review", openNextInbox);
    }).catch(function(){});
  }
  function openNextInbox(){
    var f = inbox.files[0];
    if(!f) return;
    showPage("expenses");
    showExpensesSubpage("spending");
    showToast("Opening " + f.name + "…");
    readInboxFile(f).then(function(file){ importBankFile(file, f); }).catch(function(){ showToast("Couldn't open " + f.name + " — try again in a moment"); });
  }
  function inboxFileDone(f){
    inbox.current = null;
    inbox.files = inbox.files.filter(function(x){ return x !== f; });
    renderInbox();
    markInboxFileImported(f).catch(function(){ showToast("Imported, but " + f.name + " couldn't be moved to Imported — move it yourself so it isn't offered again"); });
    if(inbox.files.length) setTimeout(function(){
      showPersistentToast(inboxMessage(inbox.files.length, inbox.files[0].label) + ".", "Next", openNextInbox);
    }, 4500);
  }
  document.getElementById("bankInboxNote").addEventListener("click", function(e){
    if(e.target.closest("[data-inbox-next]")) openNextInbox();
  });

  // Every panel on the Spending tab reads state.transactions, and an import moves all of them at
  // once — which is the point, and also why this is one named function rather than a list repeated
  // at the import and undo call sites where the two could drift apart.
  function refreshAfterBankImport(){
    renderRecurring();
    renderBudgetFromHistory();
    renderTrips();
    renderReceived();
    renderTransactions();
    renderActualVsPlannedPanel();
    renderSpendCategoryChart();
    renderSpendingTrends();
    renderYearSpending();
    // An import can now create budget lines, which moves the planned side too — the Budget tab's
    // list and totals, and every scenario figure derived from them.
    renderSharedGroups();
    renderCards(); renderDetail(); renderTotals();
    renderProjectionOutputs();
  }

  // ---------------- Income: import from a spreadsheet ----------------
  var pendingIncomeImport = [];
  document.getElementById("incomeDownloadTemplateBtn").addEventListener("click", exportIncomeImportTemplateCsv);
  document.getElementById("incomeImportBtn").addEventListener("click", function(){
    document.getElementById("incomeImportFile").click();
  });
  document.getElementById("incomeImportFile").addEventListener("change", function(e){
    var file = e.target.files[0];
    e.target.value = "";
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      var parsed = parseIncomeImportCsv(String(reader.result));
      pendingIncomeImport = renderIncomeImportPreview(parsed);
    };
    reader.onerror = function(){ showToast("Couldn't read that file"); };
    reader.readAsText(file);
  });

  // ---------------- Assets: import from a spreadsheet ----------------
  var pendingAssetsImport = [];
  document.getElementById("assetsDownloadTemplateBtn").addEventListener("click", exportAssetsImportTemplateCsv);
  document.getElementById("assetsImportBtn").addEventListener("click", function(){
    document.getElementById("assetsImportFile").click();
  });
  document.getElementById("assetsImportFile").addEventListener("change", function(e){
    var file = e.target.files[0];
    e.target.value = "";
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      var parsed = parseAssetsImportCsv(String(reader.result));
      pendingAssetsImport = renderAssetsImportPreview(parsed);
    };
    reader.onerror = function(){ showToast("Couldn't read that file"); };
    reader.readAsText(file);
  });

  // The skip link moves focus, not just the scroll position. An href="#id" alone scrolls a <div>
  // into view and leaves focus where it was, so the very next Tab goes back to the nav item after
  // the link — which is exactly the 22 stops the user was trying to skip. tabindex="-1" makes the
  // container focusable without adding it to the tab order, and preventDefault keeps "#appContent"
  // out of the URL, where nav.js's route parsing would have to reason about it.
  document.querySelector(".skip-link").addEventListener("click", function(e){
    e.preventDefault();
    var target = document.getElementById("appContent");
    if(!target) return;
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start" });
  });

  document.getElementById("exportBtn").addEventListener("click", doExport);
  document.getElementById("exportLink2").addEventListener("click", doExport);

  // Only shown where the browser can actually hand a file to the OS share sheet — everywhere
  // else (most desktop browsers, notably) it stays hidden and Export remains the only path.
  if(canShareFiles()){
    document.getElementById("shareBtn").hidden = false;
  }
  document.getElementById("shareBtn").addEventListener("click", doShare);

  document.getElementById("importBtn").addEventListener("click", function(){
    document.getElementById("importFile").click();
  });
  // "Have they actually started using the app" — not just "does localStorage have an entry",
  // since state.js's own load path writes a fresh defaultState() back to STORAGE_KEY on first
  // run, before the user has touched anything. A genuinely untouched install has none of these
  // (home's own default scenario block doesn't count — that always exists).
  function hasRealUserData(){
    return !!(state.income.length || state.shared.length || state.assets.length ||
      state.properties.length || state.transactions.length || state.debts.length);
  }
  // v3.40.0: a tax year file merges one year into the plan — see calc/taxyear.js mergeTaxYearFile().
  function applyTaxYearFile(parsed){
    var people = getTaxPeople();
    var names = Object.keys(parsed.people || {});
    if(!confirm("Merge " + fyLabel(Number(parsed.fy)) + " figures for " + (names.join(" and ") || "nobody") +
      " into this plan? That year's income statements, interest, deductions and rental schedule are replaced by the file's; nothing else changes.")) return;
    var report;
    try{ report = mergeTaxYearFile(parsed, people, { genId: genId }); }
    catch(err){ showToast(err.message || "That file couldn't be read"); return; }
    if(parsed.markLodged){
      var rec = taxYearRecord(report.fy, true);
      Object.keys(parsed.people || {}).forEach(function(n){
        var to = matchPerson(n, people) || n;
        if(people.indexOf(to) !== -1) rec.lodged[to] = lodgedSnapshot(computePersonTax(to, { fy: report.fy }));
      });
    }
    setTaxYearSelected(report.fy);
    renderAll();
    persist();
    var bits = [];
    if(report.people.length) bits.push("people: " + report.people.join(", "));
    if(report.rental.length) bits.push("rent: " + report.rental.join(", "));
    if(report.statements.length) bits.push("statements: " + report.statements.join(", "));
    if(report.sales.length) bits.push("sales: " + report.sales.join(", "));
    if(report.addedHoldings.length) bits.push("added sold-out holdings: " + report.addedHoldings.join(", "));
    if(report.unmatchedPeople.length) bits.push("not in this plan yet (add a Gross income row for them): " + report.unmatchedPeople.join(", "));
    if(report.skipped.length) bits.push("skipped: " + report.skipped.join("; "));
    showPersistentToast(fyLabel(report.fy) + " imported — " + bits.join(" · "), "Open worksheet", function(){
      showPage("tax");
      showTaxSubpage("returns", { replace: true });
      renderTaxYear();
    });
  }
  document.getElementById("taxYearImportFile").addEventListener("change", function(e){
    var file = e.target.files[0];
    e.target.value = "";
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      var parsed;
      try{ parsed = JSON.parse(reader.result); }catch(err){ showToast("That file isn't JSON"); return; }
      if(!parsed || parsed.kind !== TAX_YEAR_FILE_KIND){ showToast("That isn't a tax year file — a full backup goes through Import backup"); return; }
      applyTaxYearFile(parsed);
    };
    reader.readAsText(file);
  });
  function applyImportedBackupJson(jsonStr){
    try{
      var parsed = JSON.parse(jsonStr);
      // A tax year file picked from the main Import merges instead of replacing everything.
      if(parsed && parsed.kind === TAX_YEAR_FILE_KIND){ applyTaxYearFile(parsed); return; }
      if(!parsed || !parsed.income || !parsed.home) throw new Error("bad shape");
      // v3.71.0: say which copy is newer, so restoring on a second device can't quietly put an
      // older copy over a newer one.
      var when = function(iso){ try{ return new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }catch(e){ return iso; } };
      var cmp = compareCopies(parsed.savedAt);
      if(hasRealUserData()){
        var msg = cmp === "here"
          ? "This backup is OLDER than what's on this device — it was last changed " + when(parsed.savedAt) + ", this device's copy " + when(state.savedAt) + ". Replace this device's newer copy with it?"
          : cmp === "incoming"
          ? "Replace this device's copy (last changed " + when(state.savedAt) + ") with this backup (last changed " + when(parsed.savedAt) + ")?"
          : "You already have data in Wealth Planner on this device. Importing will replace it — this can't be undone unless you've exported a backup first. Continue?";
        if(!confirm(msg)) return;
      }
      // v3.170.0: the receipts' files the backup carries go back into this device's store.
      unpackReceipts(takeReceiptFiles(parsed)).catch(function(){ showToast("The backup's receipts couldn't be stored on this device"); });
      setState(migrateState(parsed));
      renderAll();
      persist();
      showToast("Backup imported");
    }catch(err){
      showToast("That file doesn't look like a valid backup");
    }
  }
  // A backup's text, plain or encrypted — from a picked file or the backup folder (v3.71.0).
  function importBackupText(raw){
    var envelope;
    try{ envelope = JSON.parse(raw); }catch(err){ showToast("That file doesn't look like a valid backup"); return; }
    if(envelope && envelope.wealthPlannerEncrypted){
      var passphrase = prompt("This backup is encrypted. Enter its passphrase to unlock it:");
      if(passphrase == null) return;
      decryptBackup(envelope, passphrase).then(function(plainStr){ applyImportedBackupJson(plainStr); })
        .catch(function(){ showToast("Wrong passphrase, or this backup is corrupted."); });
    } else applyImportedBackupJson(raw);
  }
  document.getElementById("importFile").addEventListener("change", function(e){
    var file = e.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){ importBackupText(reader.result); };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("resetBtn").addEventListener("click", function(){
    if(!confirm("Clear everything back to a blank slate? This replaces everything currently entered — export a backup first if you want to keep it.")) return;
    setState(defaultState());
    renderAll();
    persist();
    showToast("Cleared");
  });

  function loadSampleData(){
    if(!confirm("Fill in a sample household so you can try the tool? This replaces everything currently entered — export a backup first if you want to keep it.")) return;
    buildDemoState();
    renderAll();
    persist();
    showToast("Sample data generated");
  }
  document.getElementById("mockDataBtn").addEventListener("click", loadSampleData);

  // The Dashboard's first-run actions. Same handler as the toolbar button above — the point of
  // these is only that they are reachable on a phone, where that button isn't rendered at all.
  document.getElementById("dashboardSetup").addEventListener("click", function(e){
    if(e.target.closest("[data-dash-start]")){ loadSampleData(); return; }
    var go = e.target.closest("[data-setup-go]");
    if(go){
      // v3.162.0: straight to the place — the tab, and the card on it, opened and in view.
      var gp = go.getAttribute("data-setup-go"), gs = go.getAttribute("data-setup-sub"), gopen = go.getAttribute("data-setup-open");
      showPage(gp);
      if(gs && gp === "expenses") showExpensesSubpage(gs, { replace: true });
      if(gopen){ var card = document.getElementById(gopen); if(card){ card.open = true; setTimeout(function(){ card.scrollIntoView({ behavior: "smooth", block: "start" }); }, 120); } }
      return;
    }
    if(e.target.closest("[data-setup-dismiss]")){
      // Remembered, not session-only: re-offering a dismissed checklist every morning in a
      // daily-use app is its own small annoyance.
      state.setupDismissed = true;
      persist();
      renderDashboardStats();
      showToast("Hidden — every page stays in the menu");
    }
  });

  function updateThemeButtonLabel(){
    var mode = getThemePref();
    var label = mode === "light" ? "Theme: Light" : mode === "dark" ? "Theme: Dark" : "Theme: System";
    document.getElementById("themeToggleBtn").textContent = label;
  }
  document.getElementById("themeToggleBtn").addEventListener("click", function(){
    var current = getThemePref();
    var next = THEME_MODES[(THEME_MODES.indexOf(current) + 1) % THEME_MODES.length];
    try{ localStorage.setItem(THEME_KEY, next); }catch(e){}
    applyTheme(next);
    updateThemeButtonLabel();
  });
  updateThemeButtonLabel();

  // ---------------- Page navigation ----------------
  document.getElementById("appNav").addEventListener("click", function(e){
    var btn = e.target.closest(".nav-item");
    if(!btn) return;
    showPage(btn.getAttribute("data-page"));
    closeNavMenu();
  });

  // Mobile-only dropdown: appNav is a vertical panel behind this toggle below 880px
  // (see styles.css), so a page's 7 tabs stay reachable without horizontal scroll-hunting.
  var navMenuToggle = document.getElementById("navMenuToggle");
  navMenuToggle.addEventListener("click", function(e){
    e.stopPropagation();
    var willOpen = !document.querySelector(".app-sidebar").classList.contains("nav-open");
    document.querySelector(".app-sidebar").classList.toggle("nav-open", willOpen);
    navMenuToggle.setAttribute("aria-expanded", String(willOpen));
  });
  document.getElementById("appNav").addEventListener("click", function(e){ e.stopPropagation(); });
  document.addEventListener("click", closeNavMenu);
  document.addEventListener("keydown", function(e){ if(e.key === "Escape") closeNavMenu(); });

  // Mobile bottom tab bar — the primary nav on a mobile viewport (<880px). v3.140.0: Home, Cash flow,
  // Net worth, Tax and Plan; Reports and Settings are in the avatar's menu.
  document.getElementById("mobileTabbar").addEventListener("click", function(e){
    var pageBtn = e.target.closest(".mobile-tab[data-page]");
    if(pageBtn) showPage(pageBtn.getAttribute("data-page"));
  });

  // Quick-action button — one button, present on every page, retargeted per page/subpage by
  // nav.js's updateQuickFab() (data-fab-mode/data-fab-selector). "networth" is the one mode with
  // no button to click (Dashboard has no add-something UI at all); everything else scrolls the
  // page's own real +Add control into view and clicks it, so this never duplicates what that
  // button already does — it just saves the trip down the page to find it.
  document.getElementById("quickFab").addEventListener("click", function(e){
    var fab = e.currentTarget;
    var fabMode = fab.getAttribute("data-fab-mode");
    if(fabMode === "networth"){ logNetWorthSnapshot(); return; }
    if(fabMode === "menu"){ openQuickActions(); return; }
    var selector = fab.getAttribute("data-fab-selector");
    var target = selector && document.querySelector(selector);
    if(!target) return;
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(function(){ target.click(); }, 220);
  });
  // ---------------- Quick actions menu (the fab's chevron) ----------------
  function openQuickActions(){
    document.getElementById("quickFabRoot").innerHTML = quickActionsSheetHtml();
    pushActiveOverlay(closeQuickActions);
  }
  function closeQuickActions(){
    document.getElementById("quickFabRoot").innerHTML = "";
  }
  // Unlike the fab itself — which only ever clicks something already on screen — a quick action
  // usually has to travel first: "Add shares" from the Dashboard means Assets, then the Shares
  // subpage, and only then the add button. Same shape as the search-result handler above,
  // including why the menu's own history entry is replaced rather than popped: we're navigating
  // straight to a destination, so back should return to wherever you were before opening the
  // menu, not resurrect the menu on the way.
  function runQuickAction(action){
    closeQuickActions();
    activeOverlayClose = null;
    showPage(action.page, { replace: true });
    if(action.page === "assets" && action.sub) showAssetsSubpage(action.sub, { replace: true });
    if(action.page === "expenses" && action.sub) showExpensesSubpage(action.sub, { replace: true });
    if(action.mode === "networth"){ logNetWorthSnapshot(); return; }
    if(action.mode === "received"){ setTimeout(function(){ openReceivedSheetFor(); }, 240); return; }
    if(action.mode === "paycard"){ setTimeout(openPayCard, 240); return; }
    // Deferred for the same reason the search handler defers its scroll: showPage's render and
    // view transition have to settle before the target button exists in its final form.
    setTimeout(function(){
      var target = action.selector
        ? document.querySelector(action.selector)
        : firstVisibleAddButton(action.page);
      if(target) target.click();
    }, 240);
  }
  // v3.141.0 (item 180): the transfer form, filled in for the card's next repayment — the card (the
  // first, if there are several), the account it's paid from (its direct debit, else an everyday
  // account) and the payment the bills calendar expects, the soonest unpaid one from last month on.
  function openPayCard(){
    var card = (state.accounts || []).find(function(a){ return a.type === "credit" && a.name; });
    // v3.144.0: the direct-debit account, else where its other repayments came from, else everyday.
    var from = (card && usualCardSource(card, state.accounts, state.transfers)) || ((state.accounts || []).find(function(a){ return a.type === "everyday" && a.name; }) || {}).name;
    var amount = 0, today = localDateStr();
    if(card){
      var ym = today.slice(0, 7), months = [mdShiftMonth(ym, -1), ym, mdShiftMonth(ym, 1)];
      for(var i = 0; i < months.length && !amount; i++){
        var due = cardPaymentsForMonth(state.accounts, state.transactions, state.transfers, months[i], today).find(function(p){ return p.card === card.name && (!p.paid || p.assumed) && p.amount > 0; });
        if(due) amount = due.amount;
      }
    }
    transferForm.open = true;
    transferForm.preset = { from: from || "", to: card ? card.name : "", amount: amount, what: card ? card.name + " repayment" : "" };
    renderTransactions();
    transferForm.preset = null;
    var f = document.querySelector('#transactionsTable [data-tf="amount"]');
    if(f){ f.scrollIntoView({ block: "center" }); f.focus(); }
    if(!card) showToast("No credit card yet — add one under Net worth → Accounts");
  }
  // Income and Assets name their add buttons after the group they belong to (a person, an asset
  // category), so a quick action can't carry a fixed selector for them — it takes whichever one is
  // on screen once we've navigated to the right page and subpage, exactly as updateQuickFab does.
  function firstVisibleAddButton(pageId){
    var section = document.getElementById("page-" + pageId);
    if(!section) return null;
    return Array.prototype.find.call(section.querySelectorAll("[data-add]"), function(el){
      return el.offsetParent !== null;
    }) || null;
  }
  var quickFabMore = document.getElementById("quickFabMore");
  if(quickFabMore) quickFabMore.addEventListener("click", openQuickActions);
  document.getElementById("quickFabRoot").addEventListener("click", function(e){
    if(e.target.closest("[data-qfab-close]") || e.target === e.target.closest("[data-qfab-backdrop]")){
      requestCloseActiveOverlay();
      return;
    }
    var actionBtn = e.target.closest("[data-quick-action]");
    if(!actionBtn) return;
    var action = QUICK_ACTIONS[Number(actionBtn.getAttribute("data-quick-action"))];
    if(action) runQuickAction(action);
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    if(document.querySelector("[data-qfab-backdrop]")) requestCloseActiveOverlay();
  });

  // v3.140.0: the avatar menu — the version, its links into the app, and the dot that says a save failed.
  // On a phone the page title is the header: large at the top, slim once you scroll.
  var topbar = document.querySelector(".app-topbar"), compact = false;
  window.addEventListener("scroll", function(){
    var c = window.scrollY > 24;
    if(c !== compact){ compact = c; topbar.classList.toggle("is-compact", c); }
  }, { passive: true });
  document.getElementById("avatarVersion").textContent = document.querySelector(".app-version-num").textContent;
  document.querySelector(".avatar-menu").addEventListener("click", function(e){
    var go = e.target.closest("[data-avatar-go]");
    if(!go) return;
    var where = go.getAttribute("data-avatar-go");
    closeAllOverflowMenus(null);
    if(where === "updates"){ document.getElementById("checkUpdatesLink").click(); return; }
    if(where === "backup"){ showPage("settings"); showAccountsSubpage("preferences"); return; }
    showPage(where);
  });

  // The FIRE panel's two age inputs. Delegated from #firePanel rather than bound by id, because
  // renderDetail() replaces that panel's innerHTML on every dashboard refresh — a direct listener
  // would be attached to a node that no longer exists by the second render.
  //
  // Written on "change" (not "input"): re-rendering the panel mid-keystroke would pull the field
  // out from under the caret, and a half-typed "5" on the way to "52" would briefly report a plan
  // that fails. Blurring or pressing Enter commits it.
  document.getElementById("firePanel").addEventListener("change", function(e){
    var isCurrent = e.target.id === "fireCurrentAge";
    var isRetire = e.target.id === "fireRetireAge";
    if(!isCurrent && !isRetire) return;
    if(!state.fire) state.fire = {};
    var raw = e.target.value === "" ? null : Number(e.target.value);
    var value = raw == null || isNaN(raw) ? null : Math.max(16, Math.min(99, Math.round(raw)));
    state.fire[isCurrent ? "currentAge" : "retireAge"] = value;
    renderDetail();
    persist();
  });

  document.getElementById("checkUpdatesLink").addEventListener("click", runManualUpdateCheck);

  document.getElementById("assetsSubnav").addEventListener("click", function(e){
    var btn = e.target.closest("[data-assets-sub]");
    if(!btn) return;
    showAssetsSubpage(btn.getAttribute("data-assets-sub"));
  });

  // v3.138.0: Income → Show as — the same figures per year, month, fortnight, week, day or hour.
  document.getElementById("incomeGroups").addEventListener("click", function(e){
    var b = e.target.closest("[data-showas]");
    if(!b) return;
    setIncomeShowAs(b.getAttribute("data-showas"));
    renderIncomeGroups();
    renderTotals();
  });
  // v3.138.0: the empty summary's "Add cash / shares / super" go to that tab.
  document.getElementById("assetsSummaryStats").addEventListener("click", function(e){
    var btn = e.target.closest("[data-empty-assets]");
    if(btn) showAssetsSubpage(btn.getAttribute("data-empty-assets"));
  });
  document.getElementById("dashboardSubnav").addEventListener("click", function(e){
    var btn = e.target.closest("[data-dashboard-sub]");
    if(!btn) return;
    showDashboardSubpage(btn.getAttribute("data-dashboard-sub"));
    if(btn.getAttribute("data-dashboard-sub") === "benchmarks") renderBenchmarks();
    if(btn.getAttribute("data-dashboard-sub") === "review"){ renderMonthReview(); renderHealth(); }
  });
  // Dashboard → Review (v3.54.0): every control in the four parts.
  var monthReviewBody = document.getElementById("monthReviewBody");
  monthReviewBody.addEventListener("click", function(e){
    var step = e.target.closest("[data-mr-step]");
    if(step && !step.disabled){ stepReviewMonth(Number(step.getAttribute("data-mr-step"))); renderMonthReview(); return; }
    if(e.target.closest("[data-mr-intro-ok]")){ dismissReviewIntro(); renderMonthReview(); return; }
    var to = e.target.closest("[data-mr-to]");
    if(to){
      setReviewStep(to.getAttribute("data-mr-to"));
      renderMonthReview();
      var card = monthReviewBody.querySelector(".mr-stepcard h3");
      if(card){ card.setAttribute("tabindex", "-1"); card.focus({ preventScroll: true }); monthReviewBody.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
      return;
    }
    var log = e.target.closest("[data-mr-log]");
    // Logged into the month under review: its last day, or today if that's still to come.
    if(log){ var mEnd = monthBounds(reviewMonthShown()).end; openReceivedSheetFor(log.getAttribute("data-mr-log"), mEnd < localDateStr() ? mEnd : localDateStr()); return; }
    var go = e.target.closest("[data-mr-go]");
    if(go){
      var where = go.getAttribute("data-mr-go");
      if(where === "checks"){ showAccountsSubpage("checks"); renderHealth(); }
      else if(where === "accounts"){ showPage("accounts"); }
      else { showPage("expenses"); showExpensesSubpage("spending", { replace: true }); var importCard = document.getElementById("bankImportCard"); if(importCard){ importCard.open = true; setTimeout(function(){ importCard.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80); } }
      return;
    }
    var done = e.target.closest("[data-mr-done]");
    if(done){
      var ym = done.getAttribute("data-mr-done");
      var was = !!(state.monthReviews[ym] && state.monthReviews[ym].done);
      setReviewMonth(ym);
      markReviewed(ym, !was, localDateStr());
      persist();
      renderMonthReview();
      renderNotifBadge();
      if(!was) showToast(monthLabel(ym) + " reviewed");
    }
  });
  monthReviewBody.addEventListener("change", function(e){
    var acct = e.target.getAttribute("data-mr-statement");
    if(acct == null) return;
    setStatementAmount(reviewMonthShown(), acct, e.target.value);
    persist();
    renderMonthReview();
  });

  // Swipe between Assets' Cash/Shares/Super/Vehicle/Other tabs on mobile — desktop already has
  // the subnav buttons within easy reach, so this only kicks in below the app's usual mobile
  // breakpoint. No wraparound (swiping past the last tab does nothing) — a jump from Other back
  // to Summary would be more disorienting than a swipe that simply stops.
  var ASSETS_SUB_ORDER = ["summary", "Cash", "Shares", "Super", "Vehicle", "Other"];
  function stepAssetsSubpage(step){
    if(!window.matchMedia("(max-width: 880px)").matches) return;
    var activeBtn = document.querySelector("#assetsSubnav .subnav-item.active");
    var current = activeBtn ? activeBtn.getAttribute("data-assets-sub") : "summary";
    var nextIndex = ASSETS_SUB_ORDER.indexOf(current) + step;
    if(nextIndex < 0 || nextIndex >= ASSETS_SUB_ORDER.length) return;
    showAssetsSubpage(ASSETS_SUB_ORDER[nextIndex]);
  }
  onHorizontalSwipe(document.getElementById("page-assets"), {
    onSwipeLeft: function(){ stepAssetsSubpage(1); },
    onSwipeRight: function(){ stepAssetsSubpage(-1); }
  });
  // v3.164.0 (item 194): a flexible category rolls what it doesn't spend into next month, from this month on.
  document.addEventListener("change", function(e){
    var cb = e.target.closest && e.target.closest("[data-rollover]");
    if(!cb) return;
    if(!state.rollover) state.rollover = {};
    var cat = cb.getAttribute("data-rollover");
    if(cb.checked) state.rollover[cat] = selectedMonth(); else delete state.rollover[cat];
    renderSharedGroups(); persist();
  });
  document.getElementById("budgetGroupBy").addEventListener("click", function(e){
    var groupByBtn = e.target.closest("[data-budget-groupby]");
    if(groupByBtn){ setBudgetGroupBy(groupByBtn.getAttribute("data-budget-groupby")); return; }
    if(!e.target.closest("#budgetCollapseAllBtn")) return;
    setAllBudgetGroupsCollapsed(!allBudgetGroupsCollapsed());
    renderSharedGroups();
    renderBudgetGroupByToggle();
    persist();
  });
  // One group card's head. Delegated off #sharedGroups because the whole list is rebuilt whenever
  // a budget line changes, so a listener bound to a head would be thrown away on the first edit.
  document.getElementById("sharedGroups").addEventListener("click", function(e){
    var head = e.target.closest("[data-budget-group-toggle]");
    if(!head) return;
    toggleBudgetGroup(head.getAttribute("data-budget-group-toggle"));
    renderSharedGroups();
    renderBudgetGroupByToggle();
    persist();
  });
  document.getElementById("sharedGroups").addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    var head = e.target.closest("[data-budget-group-toggle]");
    if(!head) return;
    e.preventDefault();
    toggleBudgetGroup(head.getAttribute("data-budget-group-toggle"));
    renderSharedGroups();
    renderBudgetGroupByToggle();
    persist();
  });
  // The budget total's "See them below" link. Delegated off document because the pointer line is
  // re-rendered by renderPropertyExpensesSummary() whenever a loan changes, so a listener bound to
  // the element itself would be thrown away on the first edit.
  document.addEventListener("click", function(e){
    if(!e.target.closest("#budgetLoanPointerLink")) return;
    var loanCard = document.getElementById("propertyExpensesCard");
    if(!loanCard) return;
    if(loanCard.tagName === "DETAILS") loanCard.open = true;
    loanCard.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("expensesSubnav").addEventListener("click", function(e){
    var expensesSubBtn = e.target.closest("[data-expenses-sub]");
    if(!expensesSubBtn) return;
    showExpensesSubpage(expensesSubBtn.getAttribute("data-expenses-sub"));
  });
  // Same swipe-between-tabs affordance as Assets above, and same mobile-only guard: two tabs, so
  // a swipe simply stops at either end rather than wrapping.
  var EXPENSES_SUB_ORDER = ["budget", "income", "spending", "bills"];
  function stepExpensesSubpage(step){
    if(!window.matchMedia("(max-width: 880px)").matches) return;
    var activeExpensesBtn = document.querySelector("#expensesSubnav .subnav-item.active");
    var currentExpensesTab = activeExpensesBtn ? activeExpensesBtn.getAttribute("data-expenses-sub") : "budget";
    var nextExpensesIndex = EXPENSES_SUB_ORDER.indexOf(currentExpensesTab) + step;
    if(nextExpensesIndex < 0 || nextExpensesIndex >= EXPENSES_SUB_ORDER.length) return;
    showExpensesSubpage(EXPENSES_SUB_ORDER[nextExpensesIndex]);
  }
  onHorizontalSwipe(document.getElementById("page-expenses"), {
    onSwipeLeft: function(){ stepExpensesSubpage(1); },
    onSwipeRight: function(){ stepExpensesSubpage(-1); }
  });


  // A fresh load of a deep link (e.g. /wealth-planner/assets/shares) has no matching file
  // on GitHub Pages, so 404.html stashes the intended path and bounces here — restore it
  // before parsing the route, so a shared/bookmarked URL lands on the right page.
  try{
    var stashedPath = sessionStorage.getItem("wealthPlanner.redirectPath");
    if(stashedPath){
      sessionStorage.removeItem("wealthPlanner.redirectPath");
      history.replaceState(null, "", stashedPath);
    }
  }catch(e){}

  var routeFromUrl = parseRouteFromLocation();
  var initialPage = "dashboard";
  var initialAssetsSub = "summary";
  var initialExpensesSub = "budget";
  var initialTaxSub = null;
  var initialPlanSub = "scenarios";
  var initialSettingsSub = null;
  if(routeFromUrl){
    initialPage = routeFromUrl.page;
    if(routeFromUrl.detail){ detailTarget.kind = routeFromUrl.detail.kind; detailTarget.id = routeFromUrl.detail.id; }
    if(routeFromUrl.sub && routeFromUrl.page === "assets") initialAssetsSub = routeFromUrl.sub;
    if(routeFromUrl.sub && routeFromUrl.page === "expenses") initialExpensesSub = routeFromUrl.sub;
    if(routeFromUrl.sub && routeFromUrl.page === "tax") initialTaxSub = routeFromUrl.sub;
    if(routeFromUrl.sub && routeFromUrl.page === "plan") initialPlanSub = routeFromUrl.sub;
    if(routeFromUrl.page === "settings") initialSettingsSub = routeFromUrl.sub || "categories";
  } else {
    try{ initialPage = localStorage.getItem(PAGE_KEY) || "dashboard"; }catch(e){}
    // A page remembered from before v3.57.0 that is now a subpage.
    var legacyPage = { income: ["expenses", "income"], scenarios: ["plan", "scenarios"], projections: ["plan", "projections"] }[initialPage];
    if(legacyPage){
      initialPage = legacyPage[0];
      if(legacyPage[0] === "expenses") initialExpensesSub = legacyPage[1]; else initialPlanSub = legacyPage[1];
    }
    if(initialPage === "settings") initialSettingsSub = "categories";
  }

  window.addEventListener("popstate", function(e){
    // A back navigation while an overlay (row modal, search, expense review) was open pops the
    // history entry pushActiveOverlay() pushed for it — this is that entry landing, so just run
    // the overlay's own close callback and stop, rather than also running the page-nav logic
    // below: the URL/page never actually changed underneath it, so that logic would at best no-op
    // and at worst reset scroll position for no reason.
    if(activeOverlayClose && !(e.state && e.state.overlayOpen)){
      var closeOverlay = activeOverlayClose;
      activeOverlayClose = null;
      closeOverlay();
      return;
    }
    var route = parseRouteFromLocation() || { page: "dashboard", sub: null };
    if(route.page === "detail" && route.detail){ detailTarget.kind = route.detail.kind; detailTarget.id = route.detail.id; }
    showPage(route.page, { skipUrl: true });
    if(route.page === "assets") showAssetsSubpage(route.sub || "summary", { skipUrl: true });
    if(route.page === "expenses") showExpensesSubpage(route.sub || "budget", { skipUrl: true });
    if(route.page === "tax") showTaxSubpage(route.sub || taxSubpage(), { skipUrl: true });
    if(route.page === "plan") showPlanSubpage(route.sub || "scenarios", { skipUrl: true });
    if(route.page === "settings") showAccountsSubpage(route.sub || "categories", { skipUrl: true });
    if(route.page === "tax" && route.sub === "people") renderPeopleTab();
    if(route.page === "dashboard" && route.sub){ showDashboardSubpage(route.sub); if(route.sub === "review"){ renderMonthReview(); renderHealth(); } }
  });

  // ---------------- What the app notices + Ask Claude (v3.98.0) ----------------
  document.addEventListener("toggle", function(e){
    if(e.target.matches && e.target.matches("[data-adv-id]")) adviceUi.open[e.target.getAttribute("data-adv-id")] = e.target.open;
    if(e.target.matches && e.target.matches("[data-adv-good]")) adviceUi.goodOpen = e.target.open;
    if(e.target.matches && e.target.matches("[data-tax-household]")) taxUi.householdOpen = e.target.open;
  }, true);
  document.addEventListener("change", function(e){
    if(e.target.matches && e.target.matches("[data-ai-model]")) setAiModel(e.target.value);
  });
  document.addEventListener("input", function(e){
    if(e.target.matches && e.target.matches("[data-ai-q]")) askUi.question = e.target.value;
  });
  document.addEventListener("click", function(e){
    if(!e.target.closest) return;
    var go = e.target.closest("[data-adv-go]");
    if(go){
      var pg = go.getAttribute("data-adv-go"), sub = go.getAttribute("data-adv-sub");
      showPage(pg);
      if(sub){
        if(pg === "dashboard") showDashboardSubpage(sub);
        else if(pg === "expenses") showExpensesSubpage(sub, { replace: true });
        else if(pg === "plan") showPlanSubpage(sub, { replace: true });
        else if(pg === "assets") showAssetsSubpage(sub, { replace: true });
        // v3.148.0: Tax's tabs too (the withholding-variation advice opens People).
        else if(pg === "tax"){ showTaxSubpage(sub, { replace: true }); if(sub === "people") renderPeopleTab(); }
      }
      return;
    }
    if(e.target.closest("[data-ai-save-key]")){
      var k = document.querySelector("[data-ai-key]");
      var v = k ? k.value.trim() : "";
      if(!/^sk-ant-/.test(v)){ showToast("That doesn't look like an Anthropic API key (they start sk-ant-)"); return; }
      setAiKey(v); renderAdvice(); showToast("Key saved in this browser only");
      return;
    }
    if(e.target.closest("[data-ai-forget]")){ setAiKey(""); askUi.preview = ""; renderAdvice(); showToast("Key removed from this browser"); return; }
    if(e.target.closest("[data-ai-preview]")){
      askUi.preview = askUi.preview ? "" : copyPrompt(householdSummary(adviceFor({ today: localDateStr() }), { today: localDateStr() }), askUi.question.trim());
      renderAdvice();
      return;
    }
    // v3.99.0: the prompt for any assistant, to the clipboard; the answer pasted back.
    if(e.target.closest("[data-ai-copy]")){
      var text = copyPrompt(householdSummary(adviceFor({ today: localDateStr() }), { today: localDateStr() }), askUi.question.trim());
      var fallback = function(){
        var ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        var ok = false; try { ok = document.execCommand("copy"); } catch(err){}
        document.body.removeChild(ta);
        return ok;
      };
      var done = function(ok){
        askUi.pasteOpen = true; renderAdvice();
        showToast(ok ? "Copied — paste it into any AI, then paste its answer back here" : "Couldn't copy — open the preview and copy it from there");
      };
      if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function(){ done(true); }, function(){ done(fallback()); });
      else done(fallback());
      return;
    }
    if(e.target.closest("[data-ai-paste-toggle]")){ askUi.pasteOpen = !askUi.pasteOpen; renderAdvice(); return; }
    if(e.target.closest("[data-ai-save-paste]")){
      var pa = document.querySelector("[data-ai-paste]"), src = document.querySelector("[data-ai-source]");
      var answer = pa ? pa.value.trim() : "";
      if(answer.length < 40){ showToast("Paste the assistant's whole answer first"); return; }
      setLastReview({ at: localDateStr(), question: askUi.question.trim(), text: answer, source: src ? src.value.trim().slice(0, 40) : "" });
      askUi.pasteOpen = false; askUi.preview = ""; renderAdvice();
      showToast("Answer saved on this device");
      return;
    }
    if(e.target.closest("[data-ai-ask]")){
      if(askUi.busy) return;
      var q = askUi.question.trim();
      var summary = householdSummary(adviceFor({ today: localDateStr() }), { today: localDateStr() });
      askUi.busy = true; askUi.error = ""; renderAdvice();
      askClaude(summary, q).then(function(text){
        setLastReview({ at: localDateStr(), question: q, text: text });
        askUi.busy = false; askUi.preview = ""; renderAdvice();
      }).catch(function(err){
        askUi.busy = false;
        askUi.error = "Couldn't get a review: " + (err && err.message ? err.message : "no connection") + ".";
        renderAdvice();
      });
    }
  });

  // ---------------- Cash flow → Budget → Trim (v3.100.0) ----------------
  var trimBody = document.getElementById("trimBody");
  function afterTrimChange(){ recalcComputedItems(); persist(); renderAll(); }
  trimBody.addEventListener("click", function(e){
    var one = e.target.closest("[data-trim-set]");
    if(one){
      var line = state.shared.find(function(l){ return l.id === one.getAttribute("data-trim-set"); });
      if(!line) return;
      var was = line.amount;
      line.amount = Number(one.getAttribute("data-trim-to")) || 0;
      afterTrimChange();
      showUndoToast((line.what || "Line") + " set to what you spend", function(){ line.amount = was; afterTrimChange(); });
      return;
    }
    if(e.target.closest("[data-trim-set-all]")){
      var rep = trimReport({ today: localDateStr() });
      var before = rep.over.map(function(x){ var l = state.shared.find(function(y){ return y.id === x.id; }); return l ? { l: l, was: l.amount, to: x.suggested } : null; }).filter(Boolean);
      before.forEach(function(b){ b.l.amount = b.to; });
      afterTrimChange();
      showUndoToast(before.length + " lines set to what you spend — " + fmtCurrency0.format(rep.overYearly) + "/yr out of the plan", function(){ before.forEach(function(b){ b.l.amount = b.was; }); afterTrimChange(); });
      return;
    }
    var lv = e.target.closest("[data-trim-level]");
    if(lv){
      var ln = state.shared.find(function(l){ return l.id === lv.getAttribute("data-trim-line"); });
      if(!ln) return;
      setLeanLevel(ln, trimScenario(), lv.getAttribute("data-trim-level"));
      afterTrimChange();
      return;
    }
    if(e.target.closest("[data-trim-clear]")){
      var sc = trimScenario();
      state.shared.forEach(function(l){ var k = leanLevel(l, sc); if(k === "half" || k === "pause") setLeanLevel(l, sc, "keep"); });
      afterTrimChange();
    }
  });
  trimBody.addEventListener("change", function(e){
    if(e.target.matches("[data-trim-scenario]")){ trimUi.scenario = e.target.value; renderTrim(); return; }
    if(e.target.matches("[data-trim-flex]")){
      var l = state.shared.find(function(x){ return x.id === e.target.getAttribute("data-trim-flex"); });
      if(!l) return;
      l.flexible = !!e.target.checked;
      trimUi.markOpen = true;
      persist(); renderTrim(); renderAdvice();
    }
  });
  trimBody.addEventListener("toggle", function(e){ if(e.target.matches && e.target.matches("[data-trim-mark]")) trimUi.markOpen = e.target.open; }, true);

  // v3.138.0: a delete that used to ask "are you sure?" first now just happens, with Undo on the
  // toast — the whole state as it was, put back. `change` returns false when it did nothing.
  function withUndo(message, change){
    var before = JSON.stringify(state);
    if(change() === false) return;
    persist();
    showUndoToast(message, function(){ setState(JSON.parse(before)); persist(); renderAll(); });
  }
  // v3.205.0 (item 236a): a full redraw draws the page on screen and what's on every page; every other page is
  // marked stale and drawn when it's opened (lib/views.js — nav.js calls drawStale before showing a page). The
  // data work (applying parts, recalculating derived rows) still happens here, every time, whatever's showing.
  // Each view's pages were measured: its writes, run under a MutationObserver, landed in those pages.
  var viewsDefined = false;
  function defineViews(){
    if(viewsDefined) return;
    viewsDefined = true;
    // v3.206.0 (item 236b): every commit redraws the views that read what it touched (lib/views.js).
    onCommit(redrawTouched);
    defineView("partsSettings", ["settings"], renderPartsSettings, ["parts", "properties", "assets"]);
    defineView("txReviewBanner", null, renderTxReviewBanner, ["transactions"]);
    defineView("projectionInputs", ["plan"], function(){
      document.getElementById("projHorizon").value = state.projection.horizonYears;
      document.getElementById("projInvestRate").value = state.projection.investReturnRate;
      document.getElementById("projInvestRateRange").value = state.projection.investReturnRate;
      document.getElementById("projPropertyRate").value = state.projection.propertyAppreciationRate;
      document.getElementById("projPropertyRateRange").value = state.projection.propertyAppreciationRate;
      document.getElementById("projInflationRate").value = state.projection.inflationRate;
      document.getElementById("projInflationRateRange").value = state.projection.inflationRate;
      document.getElementById("projIncomeGrowth").value = state.projection.incomeGrowthRate;
      document.getElementById("projIncomeGrowthRange").value = state.projection.incomeGrowthRate;
      document.getElementById("projRateShock").value = state.projection.rateShockPct;
      document.getElementById("projRateShockRange").value = state.projection.rateShockPct;
      renderLifeEvents();
      document.getElementById("projInvestVol").value = state.projection.investVolatility;
      document.getElementById("projInvestVolRange").value = state.projection.investVolatility;
      document.getElementById("projPropertyVol").value = state.projection.propertyVolatility;
      document.getElementById("projPropertyVolRange").value = state.projection.propertyVolatility;
      syncProjBasisControl();
    }, ["projection", "lifeEvents"]);
    // Static copy, but rendered from the component that owns the parser it describes — see renderBankImportHelp.
    defineView("bankImportHelp", ["expenses"], renderBankImportHelp, []);
    defineView("incomeGroups", ["expenses"], renderIncomeGroups, ["income", "incomeLog", "tax", "properties", "people", "accounts"]);
    defineView("properties", ["properties", "expenses"], renderProperties, ["properties", "balances", "shared", "transactions", "accounts", "income", "tax"]);
    defineView("sharedGroups", ["expenses"], renderSharedGroups, ["shared", "transactions", "home", "categories", "categoryLooks", "properties", "accounts", "budgetGroupBy", "budgetGroupsCollapsed", "rollover", "yearBasis", "autoPayments"]);
    defineView("accounts", ["accounts"], renderAccounts, ["accounts", "balances", "assets", "debts", "properties", "transactions", "transfers", "incomeLog", "autoPayments", "savingsGoals"]);
    defineView("categories", ["settings"], renderCategories, ["categories", "categoryLooks", "shared", "transactions", "home", "properties"]);
    defineView("budgetGroupBy", ["expenses"], renderBudgetGroupByToggle, ["budgetGroupBy"]);
    defineView("yearBasis", ["settings"], renderYearBasisPreference, ["yearBasis"]);
    defineView("transactions", ["expenses"], renderTransactions, ["transactions", "transfers", "incomeLog", "shared", "home", "properties", "accounts", "txViews", "trips", "categories", "categoryLooks", "income"]);
    defineView("actualVsPlanned", ["expenses"], renderActualVsPlannedPanel, ["transactions", "shared", "home", "properties", "accounts", "income", "incomeLog", "categories"]);
    // The bills calendar is drawn by the panel above too; a transfer or an automatic payment touches only it.
    defineView("billsCalendar", ["expenses"], renderBillsCalendar, ["transfers", "autoPayments"]);
    defineView("homeBody", ["plan", "scenario", "calc"], renderHomeBody, ["scenarioChanges", "scenarios", "purchase", "invest", "home", "shared", "properties", "scenarioNotes", "income"]);
    defineView("cards", ["plan", "dashboard"], renderCards, ["*"]);
    defineView("detail", ["dashboard"], renderDetail, ["*"]);
    defineView("benchmarks", ["dashboard"], renderBenchmarks, ["*"]);
    defineView("totals", null, renderTotals, ["*"]);
    defineView("assets", ["assets", "plan"], renderAssets, ["*"]);
    defineView("personSuggestions", null, updatePersonSuggestions, ["income", "assets"]);
    defineView("accountSuggestions", null, updateAccountSuggestions, ["accounts"]);
    defineView("taxSuper", ["tax"], renderTaxSuper, ["*"]);
    defineView("taxYear", ["tax"], renderTaxYear, ["*"]);
    defineView("people", ["tax"], renderPeopleTab, ["*"]);
    defineView("received", ["expenses"], renderReceived, ["incomeLog", "income", "properties", "accounts"]);
    defineView("health", ["dashboard"], renderHealth, ["*"]);
    defineView("monthReview", ["dashboard"], renderMonthReview, ["*"]);
    defineView("notifBadge", null, renderNotifBadge, ["*"], { later: true });
    defineView("periodButton", null, renderPeriodButton, ["yearBasis"]);
    defineView("homeSummary", ["dashboard"], renderHomeSummary, ["*"]);
    defineView("reports", ["reports"], renderReports, ["*"]);
    defineView("checksBadge", null, renderChecksBadge, ["*"], { later: true });
    defineView("safekeeping", ["settings"], renderSafekeeping, ["*"]);
    defineView("activity", ["settings"], renderActivity, ["*"]);
    defineView("compare", ["plan"], renderCompare, ["*"]);
    defineView("savingsGoals", ["plan"], renderSavingsGoals, ["*"]);
    defineView("goalsFire", ["plan"], function(){ var goalsFire = document.getElementById("goalsFireBody"); if(goalsFire) goalsFire.innerHTML = goalsFireHtml(); }, ["*"]);
    defineView("advice", ["dashboard", "plan", "expenses", "tax"], renderAdvice, ["*"]);
    defineView("trim", ["expenses"], renderTrim, ["shared", "transactions", "home", "scenarioChanges", "scenarios"]);
    defineView("recurring", ["expenses"], renderRecurring, ["transactions", "shared"]);
    defineView("budgetFromHistory", ["expenses"], renderBudgetFromHistory, ["transactions", "shared"]);
    defineView("trips", ["expenses"], renderTrips, ["trips", "transactions", "shared"]);
    defineView("retirement", ["plan"], renderRetirement, ["*"]);
  }
  function renderAll(){
    defineViews();
    // v3.161.0 (item 191): which parts show, before anything that lists them renders.
    applyParts();
    // recalcComputedItems() rewrites the derived rows — a vehicle's declining-balance value, the
    // synthetic net-income rows — against *today*. It has always run here and the result has never
    // been persisted, so localStorage kept whatever those rows were when something was last edited:
    // on a test household's data the Income page showed $9,415.20/mo while storage still held
    // $9,612.75 for the same row, and a vehicle a few days stale. The screen was right and the
    // stored copy was behind it. Harmless day to day (it self-corrects on the next edit) but it
    // means an exported backup and the browser's own copy could disagree, which is a bad property
    // for the one file standing between this app and losing everything.
    var beforeRecalc = JSON.stringify(state.income) + JSON.stringify(state.assets);
    recalcComputedItems();
    // Only when it actually changed something: persist() on every render would write to
    // localStorage on every page switch for no reason.
    if(JSON.stringify(state.income) + JSON.stringify(state.assets) !== beforeRecalc) persist();
    drawViews();
  }

  // Settings carries the number of Checks that need fixing (v3.63.0), so they're seen without
  // opening the tab — on the sidebar, the More tab and its Settings item.
  function renderChecksBadge(){
    var n = 0;
    try { n = dataHealthChecks({}).filter(function(c){ return c.severity !== "info"; }).length; } catch(e){ n = 0; }
    document.querySelectorAll("[data-checks-badge]").forEach(function(el){
      el.hidden = !n;
      el.textContent = el.classList.contains("nav-badge-dot") ? "" : String(n);
      el.setAttribute("aria-label", n + " check" + (n === 1 ? "" : "s") + " to fix");
    });
  }

  if(!storageAvailable) setStatus(false, "Storage unavailable — export to keep changes");

  var datalist = document.createElement("datalist");
  datalist.id = "acctSuggestions";
  document.body.appendChild(datalist);
  // A few generic starting points, plus whatever the user has actually named in the Accounts
  // card (Expenses page) — real names first since they're the ones actually meaningful to
  // autocomplete against.
  function updateAccountSuggestions(){
    var defaults = ["Everyday Account", "Savings Account", "Offset Account", "Credit Card"];
    var names = state.accounts.map(function(a){ return a.name; }).filter(Boolean);
    defaults.forEach(function(n){ if(names.indexOf(n) === -1) names.push(n); });
    datalist.innerHTML = names.map(function(n){ return '<option value="' + escapeAttr(n) + '">'; }).join("");
  }
  updateAccountSuggestions();

  var personDatalist = document.createElement("datalist");
  personDatalist.id = "personSuggestions";
  document.body.appendChild(personDatalist);
  function updatePersonSuggestions(){
    var names = {};
    state.income.forEach(function(i){ if(i.person) names[i.person] = true; });
    state.assets.forEach(function(a){ if(a.person) names[a.person] = true; });
    personDatalist.innerHTML = Object.keys(names).map(function(n){ return '<option value="' + escapeAttr(n) + '">'; }).join("");
  }

  // Catch-all so the sticky header stays correct after ANY edit anywhere in the app,
  // not just the paths that happen to call renderTotals() already. Registered last, so
  // by the time this fires in the bubble phase every other handler for the same event
  // has already run and mutated state.
  document.addEventListener("input", renderGlobalMetrics);
  // v3.35.0: Dashboard → Benchmarks controls. One delegated pair of listeners for every section;
  // each change persists and re-renders the tab.
  var benchmarksBody = document.getElementById("benchmarksBody");
  benchmarksBody.addEventListener("change", function(e){
    var t = e.target;
    if(t.matches("[data-bm-symbol]")){
      if(t.value === "__other"){ renderBenchmarksOther(); return; }
      setBenchmarkField("symbol", null, t.value);
    } else if(t.matches("[data-bm-other]")) setBenchmarkField("symbol", null, t.value);
    else if(t.matches("[data-bm-rate]")) setBenchmarkField("rate", null, t.value);
    else if(t.matches("[data-bm-price]")) setBenchmarkField("price", t.getAttribute("data-bm-price"), t.value);
    // v3.36.0: targets.
    else if(t.matches("[data-goal-kind]")){
      var catSel = benchmarksBody.querySelector("[data-goal-category]");
      if(catSel) catSel.hidden = t.value !== "categorySpend";
      return;
    }
    else if(t.matches("[data-goal-category]")) return;
    else if(t.matches("[data-goal-target]")) setGoalField(Number(t.getAttribute("data-goal-target")), "target", t.value);
    else if(t.matches("[data-goal-by]")) setGoalField(Number(t.getAttribute("data-goal-by")), "by", t.value);
    // v3.37.0: suburb figures.
    else if(t.matches("[data-pm-field]")) setPropertyMarketField(t.getAttribute("data-pm-id"), t.getAttribute("data-pm-field"), t.value);
    else return;
    renderBenchmarks();
  });
  // "Other ASX code…": show the code field without changing the stored symbol until one is typed.
  function renderBenchmarksOther(){
    var sel = benchmarksBody.querySelector("[data-bm-symbol]");
    if(!sel || benchmarksBody.querySelector("[data-bm-other]")) return;
    sel.closest("label").insertAdjacentHTML("afterend", '<label>ASX code <input type="text" data-bm-other maxlength="8" style="width:80px;text-transform:uppercase" placeholder="A200"></label>');
    benchmarksBody.querySelector("[data-bm-other]").focus();
  }
  benchmarksBody.addEventListener("click", function(e){
    if(e.target.closest("[data-bm-copy]")){ copyBenchmarkTemplateToClipboard(); return; }
    if(e.target.closest("[data-goal-add]")){
      var kind = benchmarksBody.querySelector("[data-goal-kind]").value;
      var cat = benchmarksBody.querySelector("[data-goal-category]").value;
      if(addGoal(kind, cat) === false){ showToast("Add a category first (Settings → Categories)"); return; }
      renderBenchmarks();
      var inputs = benchmarksBody.querySelectorAll("[data-goal-target]");
      if(inputs.length){ inputs[inputs.length - 1].focus(); inputs[inputs.length - 1].select(); }
      return;
    }
    var goalDel = e.target.closest("[data-goal-del]");
    if(goalDel){
      var idx = Number(goalDel.getAttribute("data-goal-del"));
      var removed = removeGoal(idx);
      renderBenchmarks();
      if(removed) showUndoToast("Target removed", function(){ state.goals.splice(idx, 0, removed); persist(); renderBenchmarks(); });
      return;
    }
    if(e.target.closest("[data-bm-paste-apply]")){
      var area = benchmarksBody.querySelector("[data-bm-paste]");
      var n = applyBenchmarkPaste(area ? area.value : "");
      showToast(n ? n + " benchmark price" + (n === 1 ? "" : "s") + " saved" : "No benchmark rows found — each line needs a symbol like IOZ@2024-03-01 and a price");
      if(n) renderBenchmarks();
    }
  });

  // v3.83.0: Bills calendar — a line is a bill or a spending budget (auto, or set here).
  document.addEventListener("change", function(e){
    if(!e.target.matches || !e.target.matches("[data-bc-kind]")) return;
    var id = e.target.getAttribute("data-bc-kind");
    var line = loggableBudgetLineItems().find(function(i){ return i.id === id; });
    if(!line) return;
    if(e.target.value === "bill" || e.target.value === "spending") line.billKind = e.target.value;
    else delete line.billKind;
    persist();
    renderBillsCalendar();
    var kinds = document.querySelector("#billsCalendar .bc-kinds");
    if(kinds) kinds.open = true;
  });
  // v3.84.0: a bill that stopped being paid — end it at its last payment.
  document.addEventListener("click", function(e){
    var btn = e.target.closest && e.target.closest("[data-bc-end]");
    if(!btn) return;
    var id = btn.getAttribute("data-bc-end");
    var line = loggableBudgetLineItems().find(function(i){ return i.id === id; });
    if(!line) return;
    line.endDate = btn.getAttribute("data-bc-end-date");
    persist();
    renderBillsCalendar();
    showToast((line.what || "Line") + " ended " + line.endDate);
  });
  // v3.41.0: Loan strategy on a property card.
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
  });
  // v3.39.0: "If you sold" on an investment property card.
  document.addEventListener("change", function(e){
    if(!e.target.matches || !e.target.matches("[data-sale-field]")) return;
    var host = e.target.closest("[data-sale-property]");
    var prop = host && findProperty(host.getAttribute("data-sale-property"));
    if(!prop) return;
    setSaleWhatIfField(prop, e.target.getAttribute("data-sale-field"), e.target.value);
    patchSaleWhatIf(prop);
  });
  // v3.34.0: the projection, every year, as a CSV.
  document.addEventListener("click", function(e){
    if(e.target.closest("#projCsvBtn")) exportProjectionCsv(projectionSeriesShown(), state.projection.realTerms !== false);
  });
  // v3.32.1: the exchange rate typed into the Shares warning.
  document.addEventListener("change", function(e){
    if(!e.target.matches || !e.target.matches("[data-fx-usdaud]")) return;
    if(setUsdAudRate(e.target.value)) showToast("Exchange rate set — US$ holdings now count at A$" + Number(e.target.value).toFixed(4));
  });
  // v3.33.0: section explanations behind an ⓘ unless this device asks for them all.
  initHelp();
  var showHelpToggle = document.getElementById("showHelpToggle");
  if(showHelpToggle){
    showHelpToggle.checked = showHelpPreference();
    showHelpToggle.addEventListener("change", function(){ setShowHelp(showHelpToggle.checked); });
  }
  document.addEventListener("change", renderGlobalMetrics);

  // ---------------- Safekeeping (v3.63.0): folder backups and the passcode ----------------
  var lockScreen = document.getElementById("lockScreen");
  function showLock(){
    document.documentElement.classList.add("is-locked");
    lockScreen.hidden = false;
    document.getElementById("lockError").hidden = true;
    var inp = document.getElementById("lockInput"); inp.value = ""; setTimeout(function(){ inp.focus(); }, 30);
  }
  function unlock(){
    try{ sessionStorage.setItem("wealthPlanner.unlocked", "1"); }catch(e){}
    document.documentElement.classList.remove("is-locked");
    lockScreen.hidden = true;
  }
  document.getElementById("lockForm").addEventListener("submit", function(e){
    e.preventDefault();
    checkPasscode(document.getElementById("lockInput").value).then(function(ok){
      if(ok) unlock(); else { document.getElementById("lockError").hidden = false; document.getElementById("lockInput").select(); }
    });
  });
  if(document.documentElement.classList.contains("is-locked")) showLock();
  function askNewPasscode(){
    var a = prompt("New passcode (at least 4 characters):");
    if(a == null) return Promise.resolve(false);
    if(a.length < 4){ showToast("A passcode needs at least 4 characters"); return Promise.resolve(false); }
    var b = prompt("Type it again:");
    if(b !== a){ if(b != null) showToast("They didn't match — nothing changed"); return Promise.resolve(false); }
    return setPasscode(a).then(function(){ try{ sessionStorage.setItem("wealthPlanner.unlocked", "1"); }catch(e){} return true; });
  }
  function folderResult(r){
    if(r.ok) showToast("Backed up to " + r.folder + " (" + r.name + ")");
    else if(r.reason === "permission") showToast("The browser didn't allow writing to " + r.folder);
    renderSafekeeping(); renderHomeSummary();
  }
  document.getElementById("safekeepingBody").addEventListener("click", function(e){
    var b = e.target.closest("[data-sk]");
    if(!b) return;
    var act = b.getAttribute("data-sk");
    if(act === "export"){ document.getElementById("exportBtn").click(); setTimeout(renderSafekeeping, 400); return; }
    if(act === "folder-pick" || act === "folder-change"){
      chooseFolder().then(function(){ return backupToFolder(true); }).then(folderResult).catch(function(err){ if(err && err.name !== "AbortError") showToast("Couldn't use that folder"); });
      return;
    }
    if(act === "folder-now"){ backupToFolder(true).then(folderResult).catch(function(){ showToast("Couldn't write the backup"); }); return; }
    if(act === "folder-open"){
      newestFolderBackup(true).then(function(r){
        if(!r || r.permission === false){ showToast("The browser didn't allow reading the folder"); return; }
        if(r.none){ showToast("No backups in " + r.folder + " yet"); return; }
        importBackupText(r.text);
      }).catch(function(){ showToast("Couldn't read the folder"); });
      return;
    }
    if(act === "file-open"){ document.getElementById("importFile").click(); return; }
    // v3.134.0: sync through the folder.
    if(act === "sync-on"){
      savedFolder().then(function(h){ return h ? h : chooseFolder(); }).then(function(){
        var pass = prompt("A passphrase for the synced copy. Use the same one on each computer — it isn't stored anywhere, so keep it somewhere safe:");
        if(!pass) return;
        return unlockSync(pass, true, "folder").then(function(r){
          if(!r.ok){ showToast(r.reason === "wrong-passphrase" ? "That passphrase doesn't open the copy already in the folder" : "Couldn't use the folder"); return; }
          if(!r.existing){
            var again = prompt("Type the passphrase again:");
            if(again !== pass){ stopSync(); showToast("The passphrases didn't match — sync is off"); renderSafekeeping(); return; }
          }
          showToast(r.existing ? "Sync on — checking the copy in the folder" : "Sync on");
          renderSafekeeping();
          return runSync({ interactive: true });
        });
      }).catch(function(err){ if(err && err.name !== "AbortError") showToast("Couldn't turn on sync"); });
      return;
    }
    if(act === "sync-now"){ runSync({ interactive: true, manual: true }); return; }
    // v3.136.0: through Dropbox.
    if(act === "dbx-key"){ var ki = document.querySelector("[data-dbx-key]"); var kv = ki && ki.value.trim(); if(!kv){ showToast("Paste the app key first"); return; } setAppKey(kv); renderSafekeeping(); return; }
    if(act === "dbx-key-forget"){ setAppKey(""); renderSafekeeping(); return; }
    if(act === "dbx-connect"){ connectDropbox().catch(function(){ showToast("Couldn't start the Dropbox sign-in"); }); return; }
    if(act === "dbx-disconnect"){ disconnectDropbox().then(function(){ showToast("Dropbox disconnected"); renderSafekeeping(); }); return; }
    if(act === "dbx-pass"){ dropboxPassphrase(); return; }
    if(act === "sync-off"){ if(confirm("Stop syncing on this device? The synced copy stays where it is.")) stopSync().then(function(){ showToast("Sync off on this device"); renderSafekeeping(); }); return; }
    if(act === "folder-stop"){ forgetFolder().then(function(){ showToast("Stopped backing up to the folder"); renderSafekeeping(); }); return; }
    if(act === "pass-set" || act === "pass-change"){ askNewPasscode().then(function(done){ if(done){ showToast("Passcode set"); renderSafekeeping(); } }); return; }
    if(act === "pass-off"){
      var cur = prompt("Current passcode:");
      if(cur == null) return;
      checkPasscode(cur).then(function(ok){ if(!ok){ showToast("That isn't the passcode"); return; } clearPasscode(); showToast("Passcode off"); renderSafekeeping(); });
      return;
    }
    if(act === "lock-now"){ try{ sessionStorage.removeItem("wealthPlanner.unlocked"); }catch(err){} showLock(); }
  });
  // ---------------- Sync through the folder (v3.134.0) — lib/foldersync.js ----------------
  // v3.136.0: Dropbox's passphrase step, after connecting (or on a new device).
  function dropboxPassphrase(){
    var pass = prompt("The passphrase for the synced copy. Use the same one on each device — it isn't stored anywhere, so keep it somewhere safe:");
    if(!pass) return Promise.resolve();
    return unlockSync(pass, true, "dropbox").then(function(r){
      if(!r.ok){ showToast(r.reason === "wrong-passphrase" ? "That passphrase doesn't open the copy already in Dropbox" : r.reason === "not-connected" ? "Connect Dropbox first" : "Couldn't reach Dropbox"); return; }
      if(!r.existing){
        var again = prompt("Type the passphrase again:");
        if(again !== pass){ stopSync(); showToast("The passphrases didn't match — sync is off"); renderSafekeeping(); return; }
      }
      showToast(r.existing ? "Sync on — checking the copy in Dropbox" : "Sync on");
      renderSafekeeping();
      return runSync({ interactive: true });
    }).catch(function(){ showToast("Couldn't reach Dropbox"); });
  }
  function whenText(iso){ try{ return new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }catch(e){ return iso || ""; } }
  var syncBusy = false, syncTimer = null;
  function runSync(opts){
    opts = opts || {};
    if(syncBusy) return Promise.resolve();
    syncBusy = true;
    return syncNow(opts).then(function(r){
      syncBusy = false;
      if(r.status === "pull"){
        try { var pulledObj = JSON.parse(r.text); unpackReceipts(takeReceiptFiles(pulledObj)).catch(function(){}); setState(migrateState(pulledObj)); } catch(e){ showToast("The synced copy couldn't be read"); return r; }
        pulled(r.rev);
        recalcComputedItems(); renderAll(); persist();
        showToast("Loaded the newer copy from " + r.folder + " (" + whenText(r.savedAt) + ")");
      } else if(r.status === "pushed"){ if(opts.manual) showToast("Synced"); renderSafekeeping(); }
      else if(r.status === "same"){ if(opts.manual) showToast("Already in sync"); }
      else if(r.status === "paused") showPersistentToast("Sync is paused until the browser is allowed to use " + r.folder + " again.", "Allow", function(){ runSync({ interactive: true }); });
      else if(r.status === "not-connected") showPersistentToast("Sync needs Dropbox connecting again on this device.", "Connect", function(){ connectDropbox(); });
      else if(r.status === "locked") showPersistentToast("Sync needs its passphrase on this computer.", "Type it", function(){ var p = prompt("Sync passphrase:"); if(p) unlockSync(p, true).then(function(u){ if(u.ok) runSync({ interactive: true }); else showToast("That passphrase doesn't open the synced copy"); }); });
      else if(r.status === "other-key") showPersistentToast("The copy in " + r.folder + " was started again with a different passphrase (" + whenText(r.savedAt) + ").", "Type it", function(){ var p = prompt("That copy's passphrase:"); if(p) unlockSync(p, true).then(function(u){ if(u.ok) runSync({ interactive: true }); else showToast("That passphrase doesn't open it"); }); });
      else if(r.status === "conflict" && r.text && r.base && !opts.force) mergeSync(r);
      else if(r.status === "conflict") showPersistentToast("This device and " + (r.fromThisDevice ? "an earlier session here" : "another one") + " both changed since they last synced (the copy in " + r.folder + ": " + whenText(r.savedAt) + ").", "Choose", function(){
        var load = confirm("Load the copy in " + r.folder + " (" + whenText(r.savedAt) + ")?\n\nOK — load it; this device's changes since the last sync are replaced.\nCancel — keep this device's copy and write it there instead.");
        runSync({ interactive: true, manual: true, force: load ? "pull" : "push" });
      });
      return r;
    }).catch(function(){ syncBusy = false; if(opts.manual) showToast("Sync couldn't reach the folder"); });
  }
  // v3.143.0 (item 182): both devices changed since they last synced — combine them. Everything
  // changed on one side only is taken from that side; only the same thing changed both ways is asked,
  // one choice each. Without the agreed copy (synced last on an older version) it's still a choice.
  var mergeAskedAt = 0;
  function mergeSync(r){
    var base, theirs;
    try {
      base = JSON.parse(r.base); takeReceiptFiles(base);
      var theirsObj = JSON.parse(r.text);
      unpackReceipts(takeReceiptFiles(theirsObj)).catch(function(){});
      theirs = migrateState(theirsObj);
    } catch(e){ showToast("The synced copy couldn't be read"); return; }
    var theirsText = JSON.stringify(theirs);
    // This device's copy as it is when combined — edits made while the question waited included.
    var ours = function(){ return JSON.parse(JSON.stringify(state)); };
    var apply = function(res){
      mergeAskedAt = 0;
      try { setState(migrateState(res.merged)); } catch(e){ showToast("Couldn't combine the two copies"); return; }
      recalcComputedItems(); renderAll(); persist();
      syncMerged(r.rev, theirsText).then(function(){ runSync({}); });
      var n = res.fromTheirs;
      showToast("Combined with the copy in " + r.folder + (n ? " — " + n + " change" + (n === 1 ? "" : "s") + " from there" : ""));
    };
    var first = mergeStates(base, ours(), JSON.parse(theirsText));
    if(!first.conflicts.length){ apply(first); return; }
    // Asked already and not answered yet: the next save's sync doesn't ask again for a while.
    if(Date.now() - mergeAskedAt < 10 * 60 * 1000) return;
    mergeAskedAt = Date.now();
    // v3.171.0: the other copy says whose device it came from, inside the encrypted data.
    var otherWho = r.fromThisDevice ? "an earlier session here" : theirs.savedByName ? theirs.savedByName + "'s device" : "another one";
    showPersistentToast("This device and " + otherWho + " both changed " +
      (first.conflicts.length === 1 ? "the same thing" : first.conflicts.length + " of the same things") + ". Everything else combines by itself.", "Choose", function(){
      var d = document.getElementById("mergeDialog");
      if(!d){ d = document.createElement("dialog"); d.id = "mergeDialog"; d.className = "shortcuts-dialog merge-dialog"; d.setAttribute("aria-label", "Combine two copies"); document.body.appendChild(d); }
      d.innerHTML = mergeDialogHtml(first.conflicts, r.folder, whenText(r.savedAt), theirs.savedByName);
      d.onclose = function(){
        if(d.returnValue !== "ok") return;
        var choices = {};
        d.querySelectorAll("input[data-merge-id]:checked").forEach(function(i){ choices[i.getAttribute("data-merge-id")] = i.value; });
        apply(mergeStates(base, ours(), JSON.parse(theirsText), choices));
      };
      d.showModal();
    });
  }
  // v3.139.0 (item 171): net worth keeps its own history — the day's figure as the app saves,
  // thinned as it ages. Recorded after a save, so it rides along with the next one.
  function keepNetWorthHistory(){
    if(!Array.isArray(state.netWorthLog)) state.netWorthLog = [];
    // Nothing owned or owed yet: no history of zeroes.
    if(!(state.assets || []).length && !(state.properties || []).length && !(state.debts || []).length) return false;
    var today = localDateStr();
    var changed = recordNetWorth(state.netWorthLog, totalNetWorthValue(), today);
    if(thinPriceHistory(state.netWorthLog, today, isAutoPoint)) changed = true;
    return changed;
  }
  onSaved(keepNetWorthHistory);
  onSaved(function(){
    if(!markChanged()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function(){ runSync({}); }, 8000);
  });
  document.addEventListener("visibilitychange", function(){ if(document.visibilityState === "hidden" && syncOn()){ clearTimeout(syncTimer); runSync({}); } });
  // A quiet weekly backup into the chosen folder, if the browser still allows it.
  // v3.71.0: first, is there a newer copy from another device in the folder? Then offer it, and
  // don't back up over the top of it until the person has chosen.
  // v3.134.0: with sync on, the encrypted sync copy does both jobs — no unencrypted weekly file.
  // Before the day's price check (below), so a copy changed elsewhere is loaded before this device
  // makes changes of its own.
  // v3.136.0: back from Dropbox's sign-in first — then straight to the passphrase.
  var initialSync = finishDropboxRedirect().then(function(r){
    if(r && r.connected){
      showAccountsSubpage("preferences"); renderSafekeeping();
      if(!syncOn()) showPersistentToast("Dropbox connected. Set the passphrase to start syncing.", "Set it", dropboxPassphrase);
      else return runSync({ interactive: true });
      return;
    }
    if(r && !r.connected) showToast(r.reason === "access_denied" ? "Dropbox wasn't connected" : "Couldn't connect Dropbox");
    return syncOn() ? runSync({}) : null;
  }).catch(function(){});
  // v3.142.0 (item 181): then the statements waiting in the Statements folder.
  initialSync.then(function(){ return checkInbox(true); });
  if(!syncOn()) newestFolderBackup(false).then(function(r){
    if(r && r.newerThanHere && !r.fromThisDevice && !r.none && r.permission !== false){
      var when = new Date(r.savedAt).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      showPersistentToast("A newer copy from another device (" + when + ") is in " + r.folder + ".", "Open it", function(){ importBackupText(r.text); });
      return;
    }
    return maybeAutoBackup().then(function(res){ if(res && res.ok){ showToast("Weekly backup saved to " + res.folder); renderSafekeeping(); } });
  }).catch(function(){});

  // ---------------- Cash flow → Spending → Trips (v3.78.0) ----------------
  function renderTrips(){
    var el = document.getElementById("tripsBody");
    if(el) el.innerHTML = tripsCardHtml();
  }
  document.getElementById("tripsBody").addEventListener("click", function(e){
    if(e.target.closest("[data-trip-add]")){
      var q = function(sel){ var x = document.querySelector(sel); return x ? x.value : ""; };
      var from = q("[data-trip-from]"), to = q("[data-trip-to]") || from, lineId = q("[data-trip-line]");
      if(!from){ showToast("Pick the first day of the trip"); return; }
      if(!lineId){ showToast("Pick the line its spending goes to"); return; }
      var trip = normaliseTrip({ name: q("[data-trip-name]"), from: from, to: to, lineId: lineId }, function(){ return genId("trip"); });
      state.trips.push(trip);
      persist(); renderTrips();
      var n = tripPlan(trip).length;
      showToast("Trip added" + (n ? " — " + n + " transaction" + (n === 1 ? "" : "s") + " in those dates can be moved to it" : ""));
      return;
    }
    var mv = e.target.closest("[data-trip-move]");
    if(mv){
      var t = state.trips.find(function(x){ return x.id === mv.getAttribute("data-trip-move"); });
      if(!t) return;
      var plan = tripPlan(t);
      if(!plan.length) return;
      if(!confirm("Move " + plan.length + " transaction" + (plan.length === 1 ? "" : "s") + " between " + t.from + " and " + t.to + " to this trip's line? Regular bills, rent and property costs stay where they are.")) return;
      var moved = applyTripRefile(t, state.transactions, budgetLineItems(), tripProtectedLineIds());
      persist(); afterTransactionsChange(); renderTrips();
      showToast(moved + " moved to " + t.name);
      return;
    }
    var del = e.target.closest("[data-trip-del]");
    if(del){
      var id = del.getAttribute("data-trip-del");
      var trip2 = state.trips.find(function(x){ return x.id === id; });
      if(!trip2) return;
      withUndo("Removed the trip \u201c" + trip2.name + "\u201d — transactions moved to its line stay there", function(){ state.trips = state.trips.filter(function(x){ return x.id !== id; }); renderTrips(); });
    }
  });
  renderTrips();

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
  }
  document.addEventListener("toggle", function(e){
    if(e.target.matches && e.target.matches("[data-ps-panel]")) priceSheetUi.open = e.target.open;
  }, true);
  document.addEventListener("change", function(e){
    if(e.target.matches && e.target.matches("[data-ps-from]")){ state.priceSheet.backfillFrom = e.target.value || ""; persist(); }
  });
  // v3.132.0: automatic prices first, then the person's own Sheet (which wins where both price a holding).
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
  document.addEventListener("change", function(e){
    var k = e.target.getAttribute && e.target.getAttribute("data-ap");
    if(!k) return;
    state.autoPrices[k] = !!e.target.checked;
    if(k === "on" && e.target.checked) state.autoPrices.lastRead = "";
    persist(); renderAll();
  });
  document.addEventListener("click", function(e){ if(e.target.closest && e.target.closest("[data-ap-read]")) readAutoPricesNow(true); });

  // ---------------- Pull to refresh (v3.167.0, item 197) ----------------
  // On a phone, pulling the page down from the top runs what "refresh" means here: share prices,
  // when there are holdings to price, and sync, when it's on. Not while a sheet or the review is open.
  (function(){
    var phone = window.matchMedia("(max-width: 880px)"), ptr = document.createElement("div"), pull = null, busy = false;
    ptr.className = "ptr"; ptr.setAttribute("aria-hidden", "true"); ptr.innerHTML = "<span>↻</span>";
    document.body.appendChild(ptr);
    function place(dy){ var d = Math.min(dy, 90); ptr.style.transform = "translateY(" + (d - 60) + "px) rotate(" + (d * 3) + "deg)"; ptr.style.opacity = String(Math.min(1, d / 70)); }
    function hide(){ ptr.classList.remove("is-busy"); ptr.style.transition = "transform .2s ease, opacity .2s ease"; ptr.style.transform = ""; ptr.style.opacity = "0"; }
    document.addEventListener("touchstart", function(e){
      pull = null;
      if(!phone.matches || busy || e.touches.length !== 1 || window.scrollY > 0) return;
      if(e.target.closest(".review-backdrop, .m-row.open, input, select, textarea, .table-scroll, .subnav, .m-row.tx-row") || activeOverlayClose) return;
      pull = { y0: e.touches[0].clientY, dy: 0 };
    }, { passive: true });
    document.addEventListener("touchmove", function(e){
      if(!pull) return;
      pull.dy = (e.touches[0].clientY - pull.y0) * 0.5;
      if(pull.dy <= 0 || window.scrollY > 0){ pull.dy = 0; ptr.style.opacity = "0"; return; }
      ptr.style.transition = "none"; place(pull.dy);
    }, { passive: true });
    document.addEventListener("touchend", function(){
      if(!pull) return;
      var go = pull.dy >= 70; pull = null;
      if(!go){ hide(); return; }
      var hasShares = state.assets.some(function(a){ return a.category === "Shares" && a.symbol; });
      if(!hasShares && !syncOn()){ hide(); showToast("Nothing to refresh — prices and sync are for shares and a second device"); return; }
      busy = true; ptr.classList.add("is-busy"); place(70);
      (hasShares ? readAutoPricesNow(true) : Promise.resolve())
        .then(function(){ return syncOn() ? runSync({ manual: true }) : null; })
        .catch(function(){})
        .then(function(){ busy = false; hide(); });
    });
  })();
  setTimeout(function(){ (typeof initialSync !== "undefined" ? initialSync : Promise.resolve()).then(function(){
    var first = autoPricesNeeded() && state.assets.some(function(a){ return a.category === "Shares" && a.symbol; }) ? readAutoPricesNow(false) : Promise.resolve();
    first.then(function(){ if(priceSheetDue()) return readPriceSheetNow(false); });
  }); }, 800);

  // ---------------- First-run setup (v3.74.0) ----------------
  // Offered once to an empty app; also from Home's setup card ("Guided setup"). Answers are held in
  // components/firstrun.js until Finish, so closing half-way writes nothing.
  var firstRunRoot = document.getElementById("firstRunRoot");
  function renderFirstRun(){ firstRunRoot.innerHTML = firstRun.open ? firstRunHtml() : ""; }

  // ---------------- The review queue for new transactions (v3.163.0, item 193) ----------------
  var txReviewRoot = document.getElementById("txReviewRoot");
  function renderTxReviewBanner(){ var b = document.getElementById("txReviewBanner"); if(b) b.innerHTML = reviewBannerHtml(); }
  function renderTxReview(){
    txReviewRoot.innerHTML = txReview.open ? txReviewHtml() : "";
    var card = txReviewRoot.querySelector("[data-txr-card]");
    if(card) onHorizontalSwipe(card, { onSwipeRight: function(){ txrKeep(); }, onSwipeLeft: function(){ txrChange(); } });
    var f = txReviewRoot.querySelector("[data-txr-keep], [data-txr-save], [data-txr-rule='always'], [data-txr-close]");
    if(f) f.focus({ preventScroll: true });
  }
  function openTxReview(){
    txReview.open = true; txReview.mode = "card"; txReview.choice = null; txReview.kept = 0;
    renderTxReview(); pushActiveOverlay(closeTxReviewUi);
  }
  function closeTxReviewUi(){
    txReview.open = false; renderTxReview();
    renderTransactions(); renderActualVsPlannedPanel(); renderTxReviewBanner(); renderHomeSummary();
  }
  function txrCurrent(){ return toReview(state.transactions)[0]; }
  function txrKeep(){ var t = txrCurrent(); if(!t || txReview.mode !== "card") return; keepTransaction(t); txReview.kept++; persist(); renderTxReview(); }
  function txrChange(){ if(!txrCurrent() || txReview.mode !== "card") return; txReview.mode = "change"; renderTxReview(); }
  txReviewRoot.addEventListener("click", function(e){
    if(e.target.closest("[data-txr-close]") || e.target === e.target.closest("[data-txr-backdrop]")){ requestCloseActiveOverlay(); return; }
    if(e.target.closest("[data-txr-keep]")){ txrKeep(); return; }
    if(e.target.closest("[data-txr-change]")){ txrChange(); return; }
    if(e.target.closest("[data-txr-back]")){ txReview.mode = "card"; renderTxReview(); return; }
    if(e.target.closest("[data-txr-keepall]")){ var n = keepAll(state.transactions); txReview.kept += n; persist(); renderTxReview(); showToast("Kept " + n + " as filed"); return; }
    if(e.target.closest("[data-txr-save]")){
      var line = txReviewRoot.querySelector("[data-txr-line]").value, cat = txReviewRoot.querySelector("[data-txr-cat]").value;
      txReview.choice = { linkedExpenseId: line || null, category: line ? "" : cat };
      // Something to file it to, and a shop to learn: ask whether it's always so. Otherwise just file it.
      var t = txrCurrent();
      if((line || cat) && ruleOfferFor(t)){ txReview.mode = "rule"; renderTxReview(); return; }
      refileTransaction(t, txReview.choice); txReview.kept++; txReview.mode = "card"; persist(); renderTxReview(); return;
    }
    var rule = e.target.closest("[data-txr-rule]");
    if(rule){
      var cur = txrCurrent();
      refileTransaction(cur, txReview.choice); txReview.kept++;
      if(rule.getAttribute("data-txr-rule") === "always"){
        var also = applyRuleFromReview(state.importRules, state.transactions, cur, txReview.choice, function(){ return genId("rule"); });
        txReview.kept += also;
        showToast("Rule saved" + (also ? " · " + also + " more filed the same way" : ""));
      }
      txReview.mode = "card"; txReview.choice = null; persist(); renderTxReview();
    }
  });
  document.addEventListener("keydown", function(e){
    if(!txReview.open || txReview.mode !== "card" || /input|select|textarea/i.test((e.target && e.target.tagName) || "")) return;
    if(e.key === "ArrowRight" || e.key === "k"){ e.preventDefault(); txrKeep(); }
    else if(e.key === "ArrowLeft" || e.key === "c"){ e.preventDefault(); txrChange(); }
  });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape" && txReview.open) requestCloseActiveOverlay(); });
  document.addEventListener("click", function(e){ if(e.target.closest("[data-txr-open]")) openTxReview(); });
  // ---------------- Plan → Scenarios: changes, the question sheet, a scenario's page, Make it real ----------------
  // v3.200.0 (item 230): wired in components/scenariowiring.js, from here — the order listeners are added in is kept.
  var scenarioWiring = wireScenarioEditor({ pushActiveOverlay: pushActiveOverlay, requestCloseActiveOverlay: requestCloseActiveOverlay, withUndo: withUndo, renderAll: renderAll });
  var openStartSheet = scenarioWiring.openStartSheet, openScenarioEditor = scenarioWiring.openScenarioEditor, afterScenarioChange = scenarioWiring.afterScenarioChange;

  // ---------------- Balance forecast by the day (v3.180.0, item 206) ----------------
  document.addEventListener("change", function(e){
    var id = e.target.getAttribute && e.target.getAttribute("data-acct-buffer");
    if(id == null) return;
    var a = (state.accounts || []).find(function(x){ return x.id === id; });
    if(!a) return;
    var v = e.target.value.trim();
    if(v === "" || isNaN(Number(v))) delete a.buffer; else a.buffer = Math.max(0, Number(v));
    persist(); renderDetailPage(); renderHomeSummary();
  });

  // ---------------- Every subscription in one list (v3.179.0, item 205) ----------------
  function subNote(key){ if(!state.subscriptionNotes) state.subscriptionNotes = {}; return (state.subscriptionNotes[key] = state.subscriptionNotes[key] || {}); }
  function tidySubNote(key){ var n = state.subscriptionNotes[key]; if(n && !n.cancelBy && !n.ignored) delete state.subscriptionNotes[key]; }
  document.addEventListener("change", function(e){
    var k = e.target.getAttribute && e.target.getAttribute("data-sub-cancel");
    if(k == null) return;
    if(e.target.value) subNote(k).cancelBy = e.target.value; else { subNote(k); delete state.subscriptionNotes[k].cancelBy; tidySubNote(k); }
    persist(); renderNotifBadge();
    showToast(e.target.value ? "A reminder comes a week before " + fmtDate(e.target.value) : "Cancel-by date cleared");
  });
  document.addEventListener("click", function(e){
    if(!e.target.closest) return;
    var ig = e.target.closest("[data-sub-ignore]");
    if(ig){
      var k = ig.getAttribute("data-sub-ignore"), n = subNote(k);
      if(n.ignored) delete n.ignored; else n.ignored = true;
      tidySubNote(k); persist(); renderSubscriptions(); renderNotifBadge();
      return;
    }
    if(e.target.closest("[data-sub-hidden]")){ subsUi.showHidden = !subsUi.showHidden; renderSubscriptions(); }
  });

  // ---------------- Against the market, a target mix (v3.178.0, item 203) ----------------
  function redrawCard(id, html){ var el = document.getElementById(id); if(el) el.outerHTML = html; }
  document.addEventListener("click", function(e){
    var b = e.target.closest && e.target.closest("[data-bench]");
    if(!b) return;
    bench.pick = b.getAttribute("data-bench");
    redrawCard("benchCard", benchmarkCardHtml());
    renderBenchmark();
  });
  document.addEventListener("change", function(e){
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

  // ---------------- What-ifs you can drag (v3.177.0, item 204) ----------------
  var whatIfStrip = document.getElementById("whatIfStrip"), wiFrame = 0;
  whatIfStrip.addEventListener("input", function(e){
    var k = e.target.getAttribute && e.target.getAttribute("data-wi");
    if(!k) return;
    var w = whatIfValues();
    w[k] = wiFromSlider(k, e.target.value);
    var lab = whatIfStrip.querySelector('[data-wi-val="' + k + '"]');
    if(lab) lab.textContent = wiValueText(k, w[k], w);
    var moved = whatIfMoved(w);
    whatIfStrip.querySelectorAll("[data-wi-keep], [data-wi-reset]").forEach(function(b){ b.disabled = !moved; });
    if(wiFrame) return;
    wiFrame = requestAnimationFrame(function(){ wiFrame = 0; renderWhatIfDrag(); });
  });
  // Let go: the table, milestones and the rest catch up.
  whatIfStrip.addEventListener("change", function(e){ if(e.target.getAttribute && e.target.getAttribute("data-wi")) renderProjectionOutputs(); });
  whatIfStrip.addEventListener("click", function(e){
    if(e.target.closest("[data-wi-reset]")){ resetWhatIf(); whatIfStrip.innerHTML = ""; renderProjectionOutputs(); return; }
    if(!e.target.closest("[data-wi-keep]")) return;
    var w = whatIfValues();
    if(!whatIfMoved(w)) return;
    var made = keepWhatIf(currentScenario(), w, function(){ return genId("chg"); });
    resetWhatIf();
    whatIfStrip.innerHTML = "";
    recalcComputedItems();
    afterScenarioChange();
    showToast('Kept as "' + made + '" — it\'s on Plan → Scenarios, and on the chart');
  });

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

  // ---------------- Receipts (v3.170.0, item 201) ----------------
  // Attach: a hidden file input, told whose receipt it's for. The file goes to IndexedDB (shrunk if
  // it's a photo) and the row gets its reference. Remove takes the reference (with undo); the file
  // goes at the next start once nothing refers to it.
  var receiptInput = document.getElementById("receiptFile");
  var receiptFor = null;
  function afterReceiptChange(){ persist(); renderTransactions(); rerenderTableFor("shared"); renderTaxYear(); }
  document.addEventListener("click", function(e){
    if(!e.target.closest) return;
    var add = e.target.closest("[data-rc-add]");
    if(add){ receiptFor = add.getAttribute("data-rc-add"); receiptInput.value = ""; receiptInput.click(); return; }
    var op = e.target.closest("[data-rc-open]");
    if(op){ openReceipt(op.getAttribute("data-rc-open")).then(function(ok){ if(!ok) showToast("That receipt's file isn't on this device yet — it arrives with the next sync or backup"); }); return; }
    var del = e.target.closest("[data-rc-del]");
    if(del){
      var owner = del.getAttribute("data-rc-owner"), holder = receiptHolder(owner, false);
      var gone = holder && detachReceipt(holder, del.getAttribute("data-rc-del"));
      if(!gone) return;
      afterReceiptChange();
      showUndoToast('Removed "' + gone.name + '"', function(){ var h = receiptHolder(owner, true); if(h){ attachReceipt(h, gone); afterReceiptChange(); } });
    }
  });
  receiptInput.addEventListener("change", function(){
    var file = receiptInput.files && receiptInput.files[0], owner = receiptFor;
    receiptFor = null;
    if(!file || !owner) return;
    saveReceiptFile(file, localDateStr()).then(function(ref){
      var holder = receiptHolder(owner, true);
      if(!holder){ showToast("That row has gone — the receipt wasn't attached"); return; }
      // A transaction without an id gets one, so the receipt follows it through sync.
      if(/^txi:/.test(owner) && !holder.id) holder.id = genId("t");
      attachReceipt(holder, ref);
      afterReceiptChange();
      showToast("Receipt attached — " + ref.name);
    }, function(err){ showToast((err && err.reason) || "Couldn't keep that file on this device"); });
  });
  setTimeout(function(){ pruneReceipts(state).catch(function(){}); }, 4000);

  // ---------------- Arrange Home (v3.165.0, item 195) — lib/homelayout.js decides ----------------
  var homeArrangeRoot = document.getElementById("homeArrangeRoot");
  var homeArrangeOpen = false;
  function renderHomeArrange(focusSel){
    homeArrangeRoot.innerHTML = homeArrangeOpen ? homeArrangeHtml() : "";
    var f = homeArrangeOpen && homeArrangeRoot.querySelector(focusSel || "[data-ha-close]:not(.icon-btn)");
    if(f) f.focus({ preventScroll: !focusSel });
  }
  function openHomeArrange(){ homeArrangeOpen = true; renderHomeArrange(); pushActiveOverlay(function(){ homeArrangeOpen = false; renderHomeArrange(); }); }
  function changeHomeLayout(fn, focusSel){ var l = loadHomeLayout(); fn(l); saveHomeLayout(l); applyHomeLayout(); renderHomeArrange(focusSel); }
  document.addEventListener("click", function(e){ if(e.target.closest("[data-ha-open]")) openHomeArrange(); });
  homeArrangeRoot.addEventListener("click", function(e){
    if(e.target.closest("[data-ha-close]") || e.target === e.target.closest("[data-ha-backdrop]")){ requestCloseActiveOverlay(); return; }
    var mv = e.target.closest("[data-ha-move]");
    if(mv){
      var key = mv.getAttribute("data-ha-move"), dir = Number(mv.getAttribute("data-ha-dir"));
      // Focus stays on the arrow that was pressed (or its twin, once the card reaches an end).
      changeHomeLayout(function(l){ var m = moveCard(l, key, dir); l.order = m.order; },
        '[data-ha-move="' + key + '"][data-ha-dir="' + dir + '"]:not([disabled]), [data-ha-move="' + key + '"]:not([disabled])');
      return;
    }
    if(e.target.closest("[data-ha-reset]")){ changeHomeLayout(function(l){ l.order = []; l.hidden = {}; l.pinned = []; }); showToast("Home is back to the default"); }
  });
  homeArrangeRoot.addEventListener("change", function(e){
    var show = e.target.closest("[data-ha-show]"), pin = e.target.closest("[data-ha-pin]");
    if(show){ var k = show.getAttribute("data-ha-show"), on = show.checked; changeHomeLayout(function(l){ if(on) delete l.hidden[k]; else l.hidden[k] = true; }, '[data-ha-show="' + k + '"]'); }
    if(pin){
      var id = pin.getAttribute("data-ha-pin"), want = pin.checked;
      changeHomeLayout(function(l){ l.pinned = l.pinned.filter(function(x){ return x !== id; }); if(want) l.pinned.push(id); }, '[data-ha-pin="' + id + '"]');
    }
  });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape" && homeArrangeOpen) requestCloseActiveOverlay(); });
  function openFirstRun(){
    startFirstRun(); renderFirstRun();
    pushActiveOverlay(closeFirstRunUi);
    var f = firstRunRoot.querySelector("input"); if(f) f.focus();
  }
  function closeFirstRunUi(){
    if(firstRun.open && !state.firstRunDone){ state.firstRunSkipped = true; persist(); }
    firstRun.open = false; renderFirstRun();
  }
  function readFirstRunFields(){
    firstRunRoot.querySelectorAll("[data-fr]").forEach(function(el){
      var path = el.getAttribute("data-fr").split("."), o = firstRun.answers;
      for(var i = 0; i < path.length - 1; i++) o = o[path[i]];
      o[path[path.length - 1]] = el.type === "checkbox" ? el.checked : el.value;
    });
  }
  document.addEventListener("click", function(e){ if(e.target.closest("[data-firstrun-open]")) openFirstRun(); });
  // v3.161.0 (item 191): Settings → What this household has, and Net worth's "Add a property" while it's hidden.
  document.addEventListener("click", function(e){
    var set = e.target.closest("[data-part-set]");
    if(set){ setPart(set.getAttribute("data-part-set"), set.getAttribute("data-part-value")); renderAll(); persist(); return; }
    var show = e.target.closest("[data-part-show]");
    if(show){
      var key = show.getAttribute("data-part-show");
      setPart(key, "on"); renderAll(); persist();
      if(key === "property") showPage("properties");
      else { showPage("assets"); showAssetsSubpage("Shares", { replace: true }); }
    }
  });
  firstRunRoot.addEventListener("change", function(e){
    if(e.target.matches("select[data-fr]")){ readFirstRunFields(); renderFirstRun(); }
  });
  firstRunRoot.addEventListener("click", function(e){
    if(e.target.closest("[data-fr-close]") || e.target === e.target.closest("[data-fr-backdrop]")){ requestCloseActiveOverlay(); return; }
    var a = firstRun.answers;
    if(!a) return;
    readFirstRunFields();
    if(e.target.closest("[data-fr-add-person]")){ a.people.push({ name: "", age: "", pay: "", payFreq: "Yearly" }); renderFirstRun(); return; }
    if(e.target.closest("[data-fr-add-acct]")){ a.accounts.push({ name: "", type: "savings", balance: "" }); renderFirstRun(); return; }
    var del = e.target.closest("[data-fr-del-acct]");
    if(del){ a.accounts.splice(Number(del.getAttribute("data-fr-del-acct")), 1); renderFirstRun(); return; }
    // v3.162.0 (item 192): straight to a statement — pay and the rest wait as Home's next steps.
    if(e.target.closest("[data-fr-statement]")){
      state.firstRunSkipped = true; persist();
      firstRun.open = false; activeOverlayClose = null; renderFirstRun();
      showPage("expenses", { replace: true }); showExpensesSubpage("spending", { replace: true });
      var ic = document.getElementById("bankImportCard");
      if(ic){ ic.open = true; setTimeout(function(){ ic.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80); }
      return;
    }
    if(e.target.closest("[data-fr-back]")){ firstRun.step = Math.max(0, firstRun.step - 1); renderFirstRun(); return; }
    if(e.target.closest("[data-fr-next]")){ firstRun.step++; renderFirstRun(); var f = firstRunRoot.querySelector("input,select"); if(f) f.focus(); return; }
    var fin = e.target.closest("[data-fr-finish]");
    if(fin){
      var made = applyFirstRun(a, localDateStr());
      recalcComputedItems();
      persist();
      // Like a search result: the sheet's history entry is replaced by the destination, not popped.
      firstRun.open = false; activeOverlayClose = null; renderFirstRun();
      renderAll();
      showToast("Set up: " + made.people + (made.people === 1 ? " person, " : " people, ") + made.accounts + (made.accounts === 1 ? " account, " : " accounts, ") + made.lines + " budget lines");
      if(fin.getAttribute("data-fr-finish") === "import"){
        showPage("expenses", { replace: true }); showExpensesSubpage("spending", { replace: true });
        var card = document.getElementById("bankImportCard");
        if(card){ card.open = true; setTimeout(function(){ card.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80); }
      } else showPage("dashboard", { replace: true });
    }
  });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape" && firstRun.open) requestCloseActiveOverlay(); });
  if(shouldOfferFirstRun()) setTimeout(openFirstRun, 300);

  // ---------------- Cash flow → Budget → Recurring payments (v3.66.0) ----------------
  function currentRecurring(){
    return { u: unbudgetedRecurring(state.transactions, localDateStr()), r: risingLines(loggableBudgetLineItems(), state.transactions),
      c: catchAllSuggestions(loggableBudgetLineItems(), state.transactions, localDateStr()) };
  }
  // v3.115.0: Budget → Build from what you've spent.
  function currentHistoryBudget(){ return proposeBudget(state.transactions, budgetLineItems(), localDateStr()); }
  function renderBudgetFromHistory(){
    var el = document.getElementById("historyBudgetBody");
    if(!el) return;
    var r = currentHistoryBudget();
    el.innerHTML = budgetFromHistoryHtml(r);
    var cnt = document.getElementById("historyBudgetCount");
    if(cnt) cnt.textContent = r.ready && r.proposals.length ? r.proposals.length + " to add" : "";
  }
  document.getElementById("historyBudgetBody").addEventListener("change", function(e){
    var k = e.target.getAttribute && e.target.getAttribute("data-bh-key");
    if(k == null) return;
    if(e.target.checked) delete historyBudgetUi.off[k]; else historyBudgetUi.off[k] = true;
    renderBudgetFromHistory();
  });
  document.getElementById("historyBudgetBody").addEventListener("click", function(e){
    if(!e.target.closest("[data-bh-apply]")) return;
    var chosen = currentHistoryBudget().proposals.filter(function(p){ return !historyBudgetUi.off[p.key]; });
    if(!chosen.length) return;
    var before = { shared: state.shared.length, tx: state.transactions.map(function(t){ return [t.linkedExpenseId, t.category]; }) };
    var made = applyBudgetProposals(state, chosen, function(){ return genId("exp"); });
    refreshAfterLedgerChange("shared");
    renderBudgetFromHistory();
    showUndoToast("Added " + made.length + " budget line" + (made.length === 1 ? "" : "s"), function(){
      state.shared.splice(before.shared, made.length);
      state.transactions.forEach(function(t, i){ if(before.tx[i]){ t.linkedExpenseId = before.tx[i][0]; t.category = before.tx[i][1]; } });
      refreshAfterLedgerChange("shared");
      renderBudgetFromHistory();
    });
  });
  function renderRecurring(){
    var el = document.getElementById("recurringBody");
    if(!el) return;
    var c = currentRecurring();
    el.innerHTML = recurringHtml(c.u, c.r, c.c, state.transactions);
    var n = c.u.filter(function(x){ return !recurringDismissed.keys["u:" + x.key]; }).length + c.r.filter(function(x){ return !recurringDismissed.keys["r:" + x.id + ":" + x.recent]; }).length + catchAllShown(c.c);
    var cnt = document.getElementById("recurringCount");
    if(cnt) cnt.textContent = n ? n + " to look at" : "";
  }
  // v3.95.0: a row's transactions, built only when opened.
  document.getElementById("recurringBody").addEventListener("toggle", function(e){
    if(!e.target.matches || !e.target.matches("[data-rc-tx]")) return;
    var k = e.target.getAttribute("data-rc-tx");
    if(!!recurringOpen.keys[k] === e.target.open) return;
    recurringOpen.keys[k] = e.target.open;
    renderRecurring();
    renderBudgetFromHistory();
  }, true);
  document.getElementById("recurringBody").addEventListener("click", function(e){
    var dis = e.target.closest("[data-rc-dismiss]");
    if(dis){ recurringDismissed.keys[dis.getAttribute("data-rc-dismiss")] = true; renderRecurring(); return; }
    var add = e.target.closest("[data-rc-add]");
    if(add){
      var x = currentRecurring().u.find(function(y){ return y.key === add.getAttribute("data-rc-add"); });
      if(!x) return;
      var lastTx = state.transactions[x.indices[x.indices.length - 1]] || {};
      var line = { id: genId("exp"), what: x.name, classification: "Wants", category: x.category || "", account: lastTx.account || "", amount: x.amount, freq: x.freq, irregular: false, dueMonth: null };
      state.shared.push(line);
      x.indices.forEach(function(i){ if(state.transactions[i]){ state.transactions[i].linkedExpenseId = line.id; state.transactions[i].category = ""; } });
      persist(); renderAll();
      showUndoToast("Added " + line.what + " to the budget and linked " + x.count + " charges", function(){
        x.indices.forEach(function(i){ if(state.transactions[i] && state.transactions[i].linkedExpenseId === line.id) state.transactions[i].linkedExpenseId = null; });
        state.shared = state.shared.filter(function(l){ return l.id !== line.id; });
        persist(); renderAll();
      });
      return;
    }
    var split = e.target.closest("[data-rc-split]");
    if(split){
      var sg = currentRecurring().c.find(function(y){ return y.id === split.getAttribute("data-rc-split"); });
      if(!sg) return;
      var from = loggableBudgetLineItems().find(function(l){ return l.id === sg.lineId; }) || {};
      var target = sg.existingLineId, created = null;
      if(!target){
        var cats = (state.categories || []).map(function(c){ return typeof c === "string" ? c : c && c.name; });
        var lastT = state.transactions[sg.indices[sg.indices.length - 1]] || {};
        created = { id: genId("exp"), what: sg.name, classification: "Wants", category: sg.category && cats.indexOf(sg.category) !== -1 ? sg.category : (from.category || ""),
          account: lastT.account || from.account || "", amount: Math.round(sg.monthly), freq: "Monthly", irregular: false, dueMonth: null };
        state.shared.push(created);
        target = created.id;
      }
      var rulesBefore = JSON.parse(JSON.stringify(state.importRules || []));
      sg.indices.forEach(function(i){ if(state.transactions[i]) state.transactions[i].linkedExpenseId = target; });
      if(!state.importRules) state.importRules = [];
      sg.keys.forEach(function(k){ learnRule(state.importRules, k, { linkedExpenseId: target }, function(){ return genId("rule"); }); });
      persist(); renderAll();
      showUndoToast("Moved " + sg.count + " purchases to " + (created ? created.what : sg.existingWhat) + " — future imports go there too", function(){
        sg.indices.forEach(function(i){ if(state.transactions[i] && state.transactions[i].linkedExpenseId === target) state.transactions[i].linkedExpenseId = sg.lineId; });
        if(created) state.shared = state.shared.filter(function(l){ return l.id !== created.id; });
        state.importRules = rulesBefore;
        persist(); renderAll();
      });
      return;
    }
    var up = e.target.closest("[data-rc-update]");
    if(up){
      var item = loggableBudgetLineItems().find(function(l){ return l.id === up.getAttribute("data-rc-update"); });
      if(!item) return;
      var was = item.amount, to = Number(up.getAttribute("data-rc-to"));
      item.amount = to;
      recalcComputedItems(); persist(); renderAll();
      showUndoToast((item.what || "Line") + " updated to " + fmtCurrency2.format(to), function(){ item.amount = was; recalcComputedItems(); persist(); renderAll(); });
    }
  });

  // ---------------- Investments → Shares → Import trades (v3.91.0) ----------------
  function afterTradesRead(parsed){
    tradesUi.open = true;
    renderAssets();
    if(!parsed.trades.length) showToast("No trades found in that file");
  }
  document.addEventListener("change", function(e){
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
  });
  document.addEventListener("toggle", function(e){
    if(e.target.matches && e.target.matches("[data-tr-panel]")) tradesUi.open = e.target.open;
  }, true);
  document.addEventListener("click", function(e){
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

  // ---------------- Plan → Retirement (v3.73.0) ----------------
  function renderRetirement(){
    var el = document.getElementById("retirementBody");
    if(el) el.innerHTML = retirementHtml();
  }
  var retireBody = document.getElementById("retirementBody");
  var RT_FMT = { retireAge: function(v){ return v; } };
  retireBody.addEventListener("input", function(e){
    var k = e.target.getAttribute("data-rt");
    if(!k) return;
    var out = retireBody.querySelector('[data-rt-out="' + k + '"]');
    if(out) out.textContent = RT_FMT[k] ? RT_FMT[k](Number(e.target.value)) : fmtCurrency0.format(Number(e.target.value));
  });
  retireBody.addEventListener("change", function(e){
    var k = e.target.getAttribute("data-rt");
    if(k){
      retireLevers[k] = Number(e.target.value);
      renderRetirement();
      var again = retireBody.querySelector('[data-rt="' + k + '"]');
      if(again) again.focus();
      return;
    }
    var fk = e.target.getAttribute("data-rt-fire");
    if(fk){
      if(!state.fire) state.fire = {};
      state.fire[fk] = e.target.value === "" ? null : Number(e.target.value);
      persist(); renderAll();
    }
  });
  retireBody.addEventListener("click", function(e){
    var g = e.target.closest("[data-rt-go]");
    if(!g) return;
    if(g.getAttribute("data-rt-go") === "super"){ showPage("assets"); showAssetsSubpage("Super", { replace: true }); }
    else { showPage("plan"); showPlanSubpage("goals", { replace: true }); renderGoalsTab(); }
  });

  // ---------------- Accounts → Savings goals (v3.65.0) ----------------
  function renderSavingsGoals(){
    var el = document.getElementById("savingsGoalsBody");
    if(el) el.innerHTML = goalsSectionHtml(localDateStr(), scenarioTotals(currentScenario()).netMonthly);
    renderEmergencyFund();
  }
  // ---------------- Accounts → Emergency fund (v3.94.0) ----------------
  document.getElementById("emergencyBody").addEventListener("click", function(e){
    var m = e.target.closest("[data-ef-months]");
    if(m){
      if(!state.emergency) state.emergency = {};
      state.emergency.months = Number(m.getAttribute("data-ef-months"));
      persist(); renderEmergencyFund();
      return;
    }
    if(e.target.closest("[data-ef-goal]")){
      var f = emergencyFund();
      var g = existingEmergencyGoal();
      if(g){ var was = g.target; g.target = f.target; persist(); renderSavingsGoals(); renderHomeSummary();
        showUndoToast(g.name + " set to " + fmtCurrency0.format(f.target), function(){ g.target = was; persist(); renderSavingsGoals(); renderHomeSummary(); });
        return; }
      var accts = state.accounts.filter(function(a){ return a.type === "savings" || a.type === "offset"; }).map(function(a){ return a.name; });
      var ng = addSavingsGoal({ name: "Emergency fund", target: f.target, accounts: accts });
      goalOpen[ng.id] = true;
      persist(); renderSavingsGoals(); renderHomeSummary();
      showUndoToast("Emergency fund goal added — on " + (accts.length ? accts.join(", ") : "no accounts yet; tick them on the goal"), function(){
        state.savingsGoals = state.savingsGoals.filter(function(x){ return x.id !== ng.id; }); persist(); renderSavingsGoals(); renderHomeSummary();
      });
    }
  });
  var goalsBody = document.getElementById("savingsGoalsBody");
  goalsBody.addEventListener("click", function(e){
    if(e.target.closest("[data-goal-add]")){
      var g = addSavingsGoal({ name: "New goal", target: 0, accounts: state.accounts.filter(function(a){ return a.type === "savings"; }).map(function(a){ return a.name; }) });
      goalOpen[g.id] = true;
      persist(); renderSavingsGoals(); renderHomeSummary();
      var nameIn = goalsBody.querySelector('.sgl.is-open [data-goal-field="name"]');
      if(nameIn){ nameIn.focus(); nameIn.select(); }
      return;
    }
    var tog = e.target.closest("[data-goal-toggle]");
    if(tog){ var id = tog.getAttribute("data-goal-toggle"); goalOpen[id] = !goalOpen[id]; renderSavingsGoals(); return; }
    var del = e.target.closest("[data-goal-del]");
    if(del){
      var i = Number(del.getAttribute("data-goal-del"));
      var gone = state.savingsGoals.splice(i, 1)[0];
      persist(); renderSavingsGoals(); renderHomeSummary();
      if(gone) showUndoToast("Goal deleted", function(){ state.savingsGoals.splice(i, 0, gone); persist(); renderSavingsGoals(); renderHomeSummary(); });
    }
  });
  goalsBody.addEventListener("change", function(e){
    var t = e.target, i = t.getAttribute("data-goal-index");
    if(i == null) return;
    var g = state.savingsGoals[Number(i)];
    if(!g) return;
    if(t.hasAttribute("data-goal-acct")){
      var n = t.getAttribute("data-goal-acct");
      g.accounts = g.accounts.filter(function(x){ return x !== n; });
      if(t.checked) g.accounts.push(n);
    } else {
      var f = t.getAttribute("data-goal-field");
      if(f === "target") g.target = Math.max(0, Number(t.value) || 0);
      else if(f === "by") g.by = t.value || "";
      else if(f === "name") g.name = t.value.trim() || "Savings goal";
    }
    persist(); renderSavingsGoals(); renderHomeSummary();
  });

  // ---------------- Reports (v3.62.0) ----------------
  // v3.118.0: the frame — period, comparison, grouping.
  document.getElementById("reportsBody").addEventListener("change", function(e){
    var k = e.target.getAttribute && e.target.getAttribute("data-rf");
    if(!k) return;
    reportFrame[k] = e.target.value;
    if(k === "group" || k === "range") reportFrame.open = {};
    if(k === "range" && e.target.value === "custom" && !reportFrame.from){ var t0 = localDateStr(); reportFrame.to = t0; reportFrame.from = (Number(t0.slice(0, 4)) - 1) + t0.slice(4); }
    renderReports();
  });
  document.getElementById("reportsBody").addEventListener("click", function(e){
    var pick = e.target.closest("[data-report]");
    if(pick){ reportShown.key = pick.getAttribute("data-report"); renderReports(); return; }
    // v3.124.0: pinned reports.
    var saved = e.target.closest("[data-report-saved]");
    if(saved){ if(openSavedReport(saved.getAttribute("data-report-saved"))) renderReports(); return; }
    var unpin = e.target.closest("[data-report-unpin]");
    if(unpin){ unpinReport(unpin.getAttribute("data-report-unpin")); persist(); renderReports(); return; }
    if(e.target.closest("[data-report-pin]")){ var pinned = pinReport(); if(pinned){ persist(); showToast("Pinned: " + pinned.name); } else showToast("Already pinned."); renderReports(); return; }
    // v3.118.0: a group row opens (or closes) the transactions behind it.
    var drill = e.target.closest("[data-rf-drill]");
    if(drill){ var dk = drill.getAttribute("data-rf-drill"); reportFrame.open[dk] = !reportFrame.open[dk]; renderReports(); return; }
    // v3.81.0: Month in detail.
    var mdOpen = e.target.closest("[data-md-open]");
    if(mdOpen){ monthDetailUi.ym = mdOpen.getAttribute("data-md-open"); monthDetailUi.open = {}; reportShown.key = "month"; renderReports(); return; }
    var mdStep = e.target.closest("[data-md-step]");
    if(mdStep){ monthDetailUi.ym = mdShiftMonth(mdShownMonth(), Number(mdStep.getAttribute("data-md-step"))); monthDetailUi.open = {}; renderReports(); return; }
    var mdCat = e.target.closest("[data-md-cat]");
    if(mdCat){ var cn = mdCat.getAttribute("data-md-cat"); monthDetailUi.open[cn] = !monthDetailUi.open[cn]; renderReports(); return; }
    if(e.target.closest("[data-report-print]")){ printStatic(reportPrintHtml()); return; }
    if(e.target.closest("[data-report-csv]")){ var c = reportCsv(); exportTableCsv(c.filename, c.headers, c.rows); return; }
    // Year-end pack (v3.68.0)
    if(e.target.closest("[data-ye-print]")){ printStatic(yearEndPrintHtml()); return; }
    if(e.target.closest("[data-ye-tx]")){ document.getElementById("exportYearTransactionsBtn").click(); return; }
    if(e.target.closest("[data-ye-docs]")){ var d = yearEndDocumentsCsv(); exportTableCsv(d.filename, d.headers, d.rows); return; }
    var go = e.target.closest("[data-ye-go]");
    if(go){
      var where = go.getAttribute("data-ye-go");
      if(where === "review"){ showPage("dashboard"); showDashboardSubpage("review"); renderMonthReview(); return; }
      showPage("tax");
      showTaxSubpage(where === "documents" ? "documents" : "returns", { replace: true });
      renderTaxYear();
      if(where === "close"){
        var close = document.querySelector("#taxYearBody .ty-close");
        if(close){ close.open = true; setTimeout(function(){ close.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80); }
        else showToast("Close the year appears on Returns once the year is over");
      }
    }
  });

  // ---------------- Automatic payments (v3.196.0, item 231) ----------------
  // Set up on an account's card; answered on Home. calc/autopay.js does the recording.
  function afterAutoPay(){ commit(["autoPayments", "transfers"]); }
  function answerAndUndo(id, date, answer, said){
    var r = answerAutoPay(state, id, date, answer, genId);
    if(!r) return;
    autoPayView.other = "";
    afterAutoPay();
    showUndoToast(said, function(){ answerAutoPay(state, id, date, { undo: true }); afterAutoPay(); });
  }
  document.addEventListener("click", function(e){
    var add = e.target.closest("[data-ap-add]");
    if(add){
      var name = add.getAttribute("data-ap-add");
      var acct = (state.accounts || []).find(function(x){ return x.name === name; }) || {};
      var owed = acct.type === "loan" || acct.type === "credit";
      if(!Array.isArray(state.autoPayments)) state.autoPayments = [];
      state.autoPayments.push(makeAutoPay({ from: owed ? "" : name, to: owed ? name : "", freq: "Monthly" }, localDateStr(), genId("ap")));
      commit(["autoPayments"]); renderAccounts();
      return;
    }
    var del = e.target.closest("[data-ap-del]");
    if(del){
      var di = (state.autoPayments || []).findIndex(function(x){ return x.id === del.getAttribute("data-ap-del"); });
      if(di === -1) return;
      var gone = state.autoPayments.splice(di, 1)[0];
      afterAutoPay();
      showUndoToast("Deleted the automatic payment — transfers it recorded stay", function(){ state.autoPayments.splice(di, 0, gone); afterAutoPay(); });
      return;
    }
    var b = e.target.closest("[data-ap-yes],[data-ap-skip],[data-ap-other],[data-ap-other-save],[data-ap-other-cancel]");
    if(!b) return;
    var id = b.getAttribute("data-ap-id"), date = b.getAttribute("data-ap-date");
    if(b.hasAttribute("data-ap-other-cancel")){ autoPayView.other = ""; renderHomeSummary(); return; }
    if(b.hasAttribute("data-ap-other")){
      autoPayView.other = id + "|" + date; renderHomeSummary();
      var inp = document.querySelector("#homeSummary .ap-other-amount"); if(inp){ inp.focus(); inp.select(); }
      return;
    }
    if(b.hasAttribute("data-ap-skip")){ answerAndUndo(id, date, { skipped: true }, "Marked as not gone through — nothing recorded"); return; }
    if(b.hasAttribute("data-ap-yes")){ answerAndUndo(id, date, { paid: true }, "Recorded as a transfer"); return; }
    var row = b.closest(".ap-due-row");
    var amt = Number((row.querySelector(".ap-other-amount") || {}).value);
    if(!(amt > 0)){ showToast("Type the amount that went out"); return; }
    var keep = !!(row.querySelector(".ap-other-keep") || {}).checked;
    answerAndUndo(id, date, { paid: true, amount: amt, keep: keep }, "Recorded " + fmtCurrency2.format(amt) + (keep ? " — and the amount from now on" : ""));
  });
  document.addEventListener("keydown", function(e){
    if(e.key === "Enter" && e.target.classList && e.target.classList.contains("ap-other-amount")){
      var save = e.target.closest(".ap-due-row").querySelector("[data-ap-other-save]"); if(save) save.click();
    }
  });
  document.addEventListener("change", function(e){
    var field = e.target.getAttribute && e.target.getAttribute("data-ap-field");
    if(!field) return;
    var ap = (state.autoPayments || []).find(function(x){ return x.id === e.target.getAttribute("data-ap-id"); });
    if(!ap) return;
    var v = e.target.value;
    if(field === "amount") ap.amount = Math.round((Number(v) || 0) * 100) / 100;
    else if(field === "line"){ if(v) ap.line = v; else delete ap.line; }
    else if(field === "what") ap.what = v.trim();
    else ap[field] = v;
    commit(["autoPayments"]);
    renderHomeSummary(); renderNotifBadge();
    // Rebuilt after the event: the note under it ("Next on …") follows the day and how often.
    if(field === "start" || field === "freq" || field === "line") setTimeout(renderAccounts, 0);
  });

  // ---------------- Problems the app hit (v3.202.0, item 233) — lib/errorlog.js ----------------
  document.addEventListener("click", function(e){
    if(e.target.closest("[data-el-clear]")){ clearErrorLog(); renderSafekeeping(); showToast("Cleared"); return; }
    if(e.target.closest("[data-el-copy]")){
      var text = errorLog().map(function(x){ return [x.at, x.kind, x.message, x.where, x.version, x.count > 1 ? "x" + x.count : ""].filter(Boolean).join(" | "); }).join("\n");
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function(){ showToast("Copied"); }, function(){ showToast("Couldn't copy — select the list instead"); });
    }
  });

  // ---------------- Home (v3.58.0): the summary's links and to-dos ----------------
  document.getElementById("homeSummary").addEventListener("click", function(e){
    if(e.target.closest("[data-goal-go]")){ showPage("accounts"); return; }
    // v3.166.0: Your week — step back through the last four, or put this week's away (synced).
    var step = e.target.closest("[data-wk-step]");
    if(step){
      weekView.back = Math.max(0, weekView.back + Number(step.getAttribute("data-wk-step")));
      renderHomeSummary();
      var again = document.querySelector('#homeSummary [data-wk-step="' + step.getAttribute("data-wk-step") + '"]:not([disabled]), #homeSummary [data-wk-step]:not([disabled])');
      if(again) again.focus();
      return;
    }
    if(e.target.closest("[data-wk-dismiss]")){
      dismissWeekRecap(state, localDateStr()); weekView.back = 0; persist();
      renderHomeSummary(); renderNotifBadge();
      showToast("Put away until next Monday");
      return;
    }
    var b = e.target.closest("[data-home-go]");
    if(!b) return;
    var go = b.getAttribute("data-home-go"), sub = b.getAttribute("data-home-sub"), fy = b.getAttribute("data-home-fy");
    if(go === "backup"){ var exp = document.getElementById("exportBtn"); if(exp) exp.click(); return; }
    if(go === "txreview"){ openTxReview(); return; }
    if(go === "dashboard"){
      showDashboardSubpage(sub || "overview");
      if(sub === "review") renderMonthReview();
      // v3.147.0: the tabs head the page now, so the top of it is where that tab starts.
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if(go === "settings"){ showAccountsSubpage(sub || "categories"); if(sub === "checks") renderHealth(); if(sub === "people") renderPeopleTab(); return; }
    if(go === "tax"){ if(fy) setTaxYearSelected(fy); showPage("tax"); showTaxSubpage(sub || "returns", { replace: true }); renderTaxYear(); return; }
    showPage(go);
    if(go === "expenses" && sub) showExpensesSubpage(sub, { replace: true });
  });

  // ---------------- The period selector (v3.55.0) ----------------
  // One year (and optionally a month) beside the page title that every page reads — see
  // components/period.js. Choosing re-renders everything; the menu stays open so a year and then a
  // month can be picked in one go.
  loadPeriod();
  setPeriodRerender(function(){ renderAll(); renderPeriodMenu(); });
  var periodBtn = document.getElementById("periodBtn");
  var periodMenu = document.getElementById("periodMenu");
  function setPeriodMenuOpen(open){
    periodMenu.hidden = !open;
    periodBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if(open){
      renderPeriodMenu();
      periodMenu.style.top = window.innerWidth <= 600 ? Math.round(periodBtn.getBoundingClientRect().bottom + 8) + "px" : "";
      var first = periodMenu.querySelector(".period-chip.active, .seg-option.active");
      if(first) first.focus();
    }
  }
  periodBtn.addEventListener("click", function(){ setPeriodMenuOpen(periodMenu.hidden); });
  periodMenu.addEventListener("click", function(e){
    var b = e.target.closest("button");
    if(!b || b.disabled) return;
    if(b.hasAttribute("data-period-basis")){
      if(b.getAttribute("data-period-basis") === householdYearBasis()) return;
      setYearBasis(b.getAttribute("data-period-basis"));
      // A year number means a different twelve months on the other basis — start again from today.
      applyPeriod(null, "");
    } else if(b.hasAttribute("data-period-year")){
      applyPeriod(Number(b.getAttribute("data-period-year")), "");
    } else if(b.hasAttribute("data-period-month")){
      applyPeriod(yearStartOf(householdYearBasis(), selectedYearWindow().start), b.getAttribute("data-period-month"));
    } else if(b.hasAttribute("data-period-today")){
      applyPeriod(null, "");
      setPeriodMenuOpen(false);
      periodBtn.focus();
      return;
    }
    var again = periodMenu.querySelector(b.hasAttribute("data-period-month") ? '[data-period-month="' + b.getAttribute("data-period-month") + '"]' : ".period-chip.active");
    if(again) again.focus();
  });
  document.addEventListener("click", function(e){
    if(periodMenu.hidden) return;
    // A chip inside the menu is rebuilt by the re-render its own click causes, so by the time this
    // runs it's detached and .closest() finds nothing — that's still a click inside.
    if(!e.target.isConnected) return;
    if(!e.target.closest(".period-wrap")) setPeriodMenuOpen(false);
  });
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape" && !periodMenu.hidden){ setPeriodMenuOpen(false); periodBtn.focus(); }
  });

  // v3.139.0 (item 171): the weeks before the first automatic point, rebuilt once from what each
  // record already knows, then today's point.
  (function(){
    if(!Array.isArray(state.netWorthLog)) state.netWorthLog = [];
    var today = localDateStr();
    var added = backfillNetWorth(state.netWorthLog, function(d){ return netWorthOn(d, today); }, today, 104);
    if(keepNetWorthHistory() || added) persist();
  })();
  renderAll();
  initTableScrollShadows();
  showPage(initialPage, { replace: true, skipScroll: true });
  // v3.203.1 (item 234): the speed budget (scripts/journeys.mjs) times startup to here.
  try { performance.mark("wp:ready"); } catch(e){}
  document.documentElement.setAttribute("data-wp-ready", "");
  // The speed budget compares a step with a full redraw, in the same browser at the same speed — only with ?perf=1.
  if(/[?&]perf=1\b/.test(location.search)) window.__wpRenderAll = renderAll;
  if(initialPage === "assets") showAssetsSubpage(initialAssetsSub, { replace: true });
  // Always applied, not just when landing on Expenses: showExpensesSubpage seeds the module's
  // currentExpensesSub, which buildRoutePath needs to be correct the first time the user
  // navigates *to* Expenses from somewhere else.
  showExpensesSubpage(initialExpensesSub, { skipUrl: initialPage !== "expenses", replace: true });
  // Same seeding for Tax, whose default tab depends on the time of year (nav.js defaultTaxSub).
  showTaxSubpage(initialTaxSub || taxSubpage(), { skipUrl: initialPage !== "tax", replace: true });
  showPlanSubpage(initialPlanSub, { skipUrl: initialPage !== "plan", replace: true });
  if(initialSettingsSub){ showAccountsSubpage(initialSettingsSub, { replace: true }); renderSettingsTab(initialSettingsSub); }
  if(initialPage === "tax" && initialTaxSub === "people") renderPeopleTab();
  if(initialPage === "plan" && initialPlanSub === "goals") renderGoalsTab();
  if(initialPage === "dashboard" && routeFromUrl && routeFromUrl.sub){ showDashboardSubpage(routeFromUrl.sub); if(routeFromUrl.sub === "review"){ renderMonthReview(); renderHealth(); } }

  // onboarding.html's "Try it with sample data" link lands here with ?mock=1 — generate it
  // immediately (no confirm needed, unlike the header's own Sample data button: there's nothing
  // to lose landing here for the first time) and strip the query param via replaceState so a
  // later reload or bookmark of this URL doesn't keep re-rolling random data.
  if(new URLSearchParams(location.search).get("mock") === "1"){
    buildDemoState();
    renderAll();
    persist();
    showToast("Sample data generated");
    history.replaceState(history.state, "", location.pathname + location.hash);
  }

  // ---------------- Keyboard shortcuts (v3.138.0) ----------------
  // For a desktop: / search, n log a spend, g then a letter to go to a page, ? to list them. Never
  // while typing in a field, and never with a modifier held (those belong to the browser).
  var GO_KEYS = { h: ["dashboard", "Home"], c: ["expenses", "Cash flow"], w: ["networth", "Net worth"], t: ["tax", "Tax"], p: ["plan", "Plan"], r: ["reports", "Reports"], s: ["settings", "Settings"] };
  var goPending = 0;
  function shortcutsDialog(){
    var d = document.getElementById("shortcutsDialog");
    if(d) return d;
    d = document.createElement("dialog");
    d.id = "shortcutsDialog";
    d.className = "shortcuts-dialog";
    d.setAttribute("aria-label", "Keyboard shortcuts");
    var row = function(k, what){ return '<li><span>' + k.map(function(x){ return "<kbd>" + x + "</kbd>"; }).join(" then ") + '</span>' + what + '</li>'; };
    d.innerHTML = '<h2>Keyboard shortcuts</h2><ul>' + row(["/"], "Search") + row(["n"], "Log a spend") +
      Object.keys(GO_KEYS).map(function(k){ return row(["g", k], "Go to " + GO_KEYS[k][1]); }).join("") + row(["?"], "This list") + row(["Esc"], "Close what's open") +
      '</ul><form method="dialog"><button class="btn btn-sm">Close</button></form>';
    document.body.appendChild(d);
    return d;
  }
  document.addEventListener("keydown", function(e){
    if(e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if(document.querySelector("dialog[open]") && e.key !== "?") return;
    if(goPending && Date.now() - goPending < 1200 && GO_KEYS[e.key]){
      goPending = 0; e.preventDefault();
      var nav = document.querySelector('.nav-item[data-page="' + GO_KEYS[e.key][0] + '"]');
      if(nav) nav.click();
      return;
    }
    goPending = 0;
    if(e.key === "g"){ goPending = Date.now(); return; }
    if(e.key === "/"){ e.preventDefault(); openSearchOverlay(); return; }
    if(e.key === "n"){ e.preventDefault(); openQuickLogSheet(); return; }
    if(e.key === "?"){ e.preventDefault(); var d = shortcutsDialog(); if(d.open) d.close(); else d.showModal(); }
  });

  // Matching #appLoading's inline styles in index.html — fades out only once the real UI above
  // has actually been built, not on a fixed timer, so a slow first load (cold cache, slow device)
  // keeps the loading screen up for exactly as long as it's needed and no longer.
  var appLoadingEl = document.getElementById("appLoading");
  if(appLoadingEl){
    appLoadingEl.classList.add("is-hidden");
    setTimeout(function(){ appLoadingEl.remove(); }, 300);
  }
})();

// ---------------- Notifications ----------------
// A bell over locally-computed alerts (overdue/upcoming bills, expenses due for review, stale
// assets, over-budget-this-month) — see lib/notifications.js for why this only ever refreshes on
// load/focus/open, same "nudge, not a push" limitation as the Dashboard's stale-assets banner.
// Two trigger buttons in the DOM (desktop topbar, mobile sidebar row — see index.html) share this
// one panel/badge-refresh logic; whichever one was clicked decides where the panel anchors.
var notifPanelOpen = false;
function renderNotifBadge(){
  var count = unreadNotificationCount();
  document.querySelectorAll(".notif-badge").forEach(function(el){
    el.textContent = count > 9 ? "9+" : String(count);
    el.hidden = count === 0;
  });
}
function closeNotifPanel(){
  if(!notifPanelOpen) return;
  notifPanelOpen = false;
  var root = document.getElementById("notifPanelRoot");
  if(root) root.innerHTML = "";
  document.querySelectorAll(".notif-bell-btn").forEach(function(btn){ btn.setAttribute("aria-expanded", "false"); });
}
function notifItemHtml(n){
  return '<button type="button" class="notif-item' + (n.read ? "" : " is-unread") + '" data-notif-id="' + escapeAttr(n.id) + '" data-notif-page="' + escapeAttr(n.page) + '"' + (n.sub ? ' data-notif-sub="' + escapeAttr(n.sub) + '"' : '') + '>' +
    '<span class="notif-dot ' + escapeAttr(n.severity) + '" aria-hidden="true"></span>' +
    '<span class="notif-item-body"><span class="notif-item-title">' + escapeAttr(n.title) + '</span><span class="notif-item-detail">' + escapeAttr(n.detail) + '</span></span>' +
  '</button>';
}
function renderNotifPanelContent(){
  var root = document.getElementById("notifPanelRoot");
  if(!root) return;
  var notifications = getNotifications();
  var hasUnread = notifications.some(function(n){ return !n.read; });
  var list = notifications.length
    ? '<div class="notif-list">' + notifications.map(notifItemHtml).join("") + '</div>'
    : '<p class="notif-empty">Nothing to flag right now — bills, review reminders, and budget alerts will show up here.</p>';
  root.innerHTML = '<div class="notif-panel" id="notifPanel" role="dialog" aria-label="Notifications">' +
    '<div class="notif-panel-head"><h4>Notifications</h4><button type="button" class="notif-mark-all-btn" id="notifMarkAllBtn"' + (hasUnread ? "" : " disabled") + '>Mark all read</button></div>' +
    list +
  '</div>';
}
// Rendered into #notifPanelRoot (a position:fixed root outside any scrolling ancestor — see the
// CSS comment on .notif-panel), so it's positioned in JS from the trigger button's own bounding
// rect rather than plain CSS anchoring, keeping it correct regardless of which of the two trigger
// buttons (desktop vs. mobile — different places in the layout entirely) opened it.
function positionNotifPanel(triggerBtn){
  var panel = document.getElementById("notifPanel");
  if(!panel || !triggerBtn) return;
  var rect = triggerBtn.getBoundingClientRect();
  var width = panel.offsetWidth || 340;
  var left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
  var top = Math.min(rect.bottom + 8, window.innerHeight - 60);
  panel.style.left = left + "px";
  panel.style.top = top + "px";
}
function openNotifPanel(triggerBtn){
  notifPanelOpen = true;
  renderNotifPanelContent();
  positionNotifPanel(triggerBtn);
  document.querySelectorAll(".notif-bell-btn").forEach(function(btn){ btn.setAttribute("aria-expanded", String(btn === triggerBtn)); });
}
document.querySelectorAll(".notif-bell-btn").forEach(function(btn){
  btn.addEventListener("click", function(e){
    e.stopPropagation();
    if(notifPanelOpen){ closeNotifPanel(); return; }
    openNotifPanel(btn);
  });
});
document.addEventListener("click", function(e){
  if(!notifPanelOpen) return;
  if(e.target.closest(".notif-panel") || e.target.closest(".notif-bell-btn")) return;
  closeNotifPanel();
});
document.addEventListener("keydown", function(e){
  if(e.key === "Escape") closeNotifPanel();
});
window.addEventListener("resize", function(){
  if(notifPanelOpen) positionNotifPanel(document.querySelector('.notif-bell-btn[aria-expanded="true"]'));
});
document.getElementById("notifPanelRoot").addEventListener("click", function(e){
  if(e.target.closest("#notifMarkAllBtn")){
    markAllNotificationsRead(getNotifications());
    renderNotifBadge();
    renderNotifPanelContent();
    return;
  }
  var item = e.target.closest("[data-notif-id]");
  if(item){
    markNotificationRead(item.getAttribute("data-notif-id"));
    renderNotifBadge();
    closeNotifPanel();
    showPage(item.getAttribute("data-notif-page"));
    var notifSub = item.getAttribute("data-notif-sub");
    if(notifSub && item.getAttribute("data-notif-page") === "dashboard"){ showDashboardSubpage(notifSub); if(notifSub === "review") renderMonthReview(); }
    if(notifSub && item.getAttribute("data-notif-page") === "accounts"){ showAccountsSubpage(notifSub); if(notifSub === "checks") renderHealth(); }
    if(notifSub && item.getAttribute("data-notif-page") === "expenses") showExpensesSubpage(notifSub, { replace: true });
  }
});
// Cheap enough to run on the same "tab regains focus" signal as the update checker below — local
// data can change while the tab was backgrounded (e.g. a bill's due date rolling over at midnight)
// without any edit happening in this tab to trigger a re-render otherwise.
document.addEventListener("visibilitychange", function(){
  if(document.visibilityState === "visible") renderNotifBadge();
});

// ---------------- Update detection ----------------
// sw.js's own script rarely changes between releases (this app has no fixed precache list, so
// most version bumps only touch app.js/CSS/index.html) — the browser's built-in service-worker
// update check only re-installs a worker when sw.js's own bytes differ, so relying on that alone
// would miss the common case entirely. Polling index.html's own <p class="app-version"> instead
// catches every release, regardless of what changed.
var CURRENT_APP_VERSION = (function(){
  var el = document.querySelector(".app-version-num");
  return el ? el.textContent.trim() : "";
})();
var updateBannerShown = false;
function announceUpdateAvailable(newVersion){
  if(updateBannerShown) return;
  updateBannerShown = true;
  var msg = newVersion ? ("A new version (" + newVersion + ") is available") : "A new version is available";
  showPersistentToast(msg, "Reload", reloadForUpdate);
}
// Ask the worker to purge and re-prime, then reload. Reloading alone isn't enough: this check only
// reads index.html's version string, so a freshly-deployed shell alongside a still-cached
// src/*.js would reload into a new version number running old code.
//
// Delegated to sw.js rather than clearing CacheStorage from here, for two reasons: the cache name
// and shell URL live there, and a bare purge would delete the cached shell that is the only thing
// making a reload work on a pushState'd path (/expenses/budget) if the network hiccups on the way
// back. The worker does both halves together.
//
// Reloads regardless of the reply — a failed purge is a stale cache, which is where we already
// were, whereas not reloading at all leaves a banner that does nothing. The timeout covers the
// worker being absent, asleep or wedged.
function reloadForUpdate(){
  var reloaded = false;
  var reload = function(){
    if(reloaded) return;
    reloaded = true;
    window.location.reload();
  };
  if(!navigator.serviceWorker || !navigator.serviceWorker.controller || typeof MessageChannel === "undefined"){
    reload();
    return;
  }
  try{
    var channel = new MessageChannel();
    channel.port1.onmessage = reload;
    navigator.serviceWorker.controller.postMessage({ type: "purge-and-reprime" }, [channel.port2]);
    setTimeout(reload, 3000);
  }catch(e){
    reload();
  }
}
// Resolves to the deployed version string, or "" when the response didn't carry one.
function fetchDeployedVersion(){
  // appAssetUrl(), NOT a bare "index.html": a document-relative fetch resolves against whatever
  // route is in the address bar, and by the time this runs the app has already rewritten it. From
  // /expenses/spending that fetched /expenses/index.html and 404'd, so the update check silently
  // never worked on a two-segment route. See appAssetUrl()'s own comment in nav.js.
  //
  // cache:"no-store" stops the *browser* answering from its own cache, but it says nothing about
  // what an intermediary does, and this app is served through a CDN. A URL nothing has requested
  // before can't be answered from an edge cache, so the timestamp is what makes the answer
  // trustworthy rather than possibly-minutes-stale — which matters most in exactly the case that
  // looks like a bug: a check that quietly concludes "no update" and then waits for the next one.
  return fetch(appAssetUrl("index.html") + "?v=" + Date.now(), { cache: "no-store" })
    .then(function(r){ return r.text(); })
    .then(function(html){
      var match = html.match(/<span class="app-version-num">([^<]*)<\/span>/);
      return match ? match[1].trim() : "";
    });
}
function checkForNewVersion(){
  fetchDeployedVersion().then(function(latest){
    if(latest && CURRENT_APP_VERSION && latest !== CURRENT_APP_VERSION) announceUpdateAvailable(latest);
  }).catch(function(){ /* offline, or the request was blocked — next check will just retry */ });
}
// The same check, asked for deliberately — so it answers either way. A background check that finds
// nothing is silent by design; a person who just tapped "Check for updates" and got silence has no
// way to tell that from a broken button.
function runManualUpdateCheck(){
  showToast("Checking for updates…");
  // Ask the browser to re-fetch sw.js at the same time. It normally only does this on navigation,
  // which an installed PWA left open for days may not have done in a while.
  if(navigator.serviceWorker && navigator.serviceWorker.getRegistration){
    navigator.serviceWorker.getRegistration()
      .then(function(reg){ if(reg && reg.update) reg.update(); })
      .catch(function(){});
  }
  fetchDeployedVersion().then(function(latest){
    if(!latest){
      showToast("Couldn't read the deployed version — try again in a minute.");
      return;
    }
    if(latest !== CURRENT_APP_VERSION){
      // Deliberately re-armed: a manual check is an explicit request to be told, even if a banner
      // for this same version was already dismissed earlier in the session.
      updateBannerShown = false;
      announceUpdateAvailable(latest);
      return;
    }
    showToast("You're on the latest version (" + CURRENT_APP_VERSION + ")");
  }).catch(function(){
    showToast("Couldn't check for updates — you may be offline.");
  });
}
// Cheap enough to run whenever the tab regains focus (the common "came back after a while" case)
// plus a periodic fallback for a tab that's simply left open and never loses focus. focus is
// listened for alongside visibilitychange because they don't fire in the same situations: moving
// between windows on a desktop fires focus without ever hiding the document.
document.addEventListener("visibilitychange", function(){
  if(document.visibilityState === "visible") checkForNewVersion();
});
window.addEventListener("focus", checkForNewVersion);
setInterval(checkForNewVersion, 15 * 60 * 1000);

// appAssetUrl(), NOT a bare "sw.js" — same trap as the version fetch above, and it cost more here:
// a bare "sw.js" resolved against the restored route, so on a fresh load of /expenses/spending or
// /assets/shares (a shared link, a bookmark, or a plain reload) registration 404'd and the service
// worker never installed. Offline support was silently absent for anyone who didn't land on the
// bare root. The resulting scope is "/" locally and "/wealth-planner/" on Pages — the whole app
// either way, which is what sw.js's own new URL("index.html", registration.scope) assumes.
if("serviceWorker" in navigator){
  var hadControllerAtLoad = !!navigator.serviceWorker.controller;
  window.addEventListener("load", function(){
    navigator.serviceWorker.register(appAssetUrl("sw.js")).catch(function(){});
  });
  // Fires when this page starts being controlled by a different worker than the one that had it
  // at load — the fast path for the (comparatively rare) release that touches sw.js itself.
  // Skipped on the very first-ever activation (no prior controller): that's a first-time visitor
  // gaining offline support, not an update.
  navigator.serviceWorker.addEventListener("controllerchange", function(){
    if(!hadControllerAtLoad) return;
    announceUpdateAvailable();
  });
}
