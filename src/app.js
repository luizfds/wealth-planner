import { state, setState, storageAvailable, persist, setStatus, defaultState, defaultPurchaseConfig, defaultInvestConfig, migrateState, genId, normalizeShareAsset } from "./state.js";
import { sacrificeModeToLabel, sacrificeLabelToMode, TRANSFER_FEE_BY_STATE, MORTGAGE_REG_FEE_BY_STATE, INVEST_LEG_TYPES } from "./constants.js";
import { fmtCurrency0, fmtCurrency2, localDateStr, parseAmountInput } from "./lib/format.js";
import { showToast, showUndoToast, showPersistentToast } from "./lib/toast.js";
import { initHelp, setShowHelp, showHelpPreference } from "./lib/help.js";
import { escapeAttr } from "./lib/html.js";
import { getNotifications, unreadNotificationCount, markNotificationRead, markAllNotificationsRead } from "./lib/notifications.js";
import { onHorizontalSwipe } from "./lib/swipe.js";
import { initTableScrollShadows } from "./lib/scroll-shadow.js";
import { setDeductionPeopleProvider, setDeductionPropertiesProvider, setRentLinesProvider } from "./lib/ledger-table.js";
import {
  decryptBackup, doExport, doShare, canShareFiles, exportIncomeCsv, exportExpensesCsv, exportAssetsCsv, exportPropertyLoansCsv, exportSharesPriceTemplateCsv, copySharesPriceTemplateToClipboard, copyPriceSheetTemplate, exportYearTransactionsCsv,
  exportExpensesImportTemplateCsv, exportIncomeImportTemplateCsv, exportAssetsImportTemplateCsv, parseCsv, exportProjectionCsv
} from "./lib/backup.js";
import { periodsOf, sumField, sumFieldForScenario, resolveSharedAmount, appendHistorySnapshot, transactionDisplayName } from "./calc/ledger.js";
import { phiPremiumsAnnual, effectiveIncomeItems, getTaxPeople, personTaxSettings, computePersonTax, setDeductibleItemsProvider, saleCapitalGain, lotsUnitsAvailable } from "./calc/tax.js";
import { recalcComputedItems, scenarioTotals, totalNetWorthValue, totalDebtsValue } from "./calc/engine.js";
import { financialYearOf, fyLabel, recordRateChange, sortedRateHistory, loanRateOn } from "./calc/property.js";
import { taxYearFillStatements, renderTaxYear, setTaxYearSelected, taxYearAddRow, taxYearDeleteRow, taxYearRestoreRow, taxYearSetField, taxYearToggleEvidence, taxYearMarkLodged, worksheetText, taxYearSelected, taxYearPrintHtml, lodgedSnapshot } from "./components/taxyear.js";
import { renderPeople, setPersonField, peopleSummaryText } from "./components/people.js";
import { renamePersonEverywhere, removePersonFromTax } from "./calc/people.js";
import { renderHealth } from "./components/health.js";
import { renderMonthReview, stepReviewMonth, reviewMonthShown, setReviewMonth, setReviewStep, dismissReviewIntro } from "./components/monthreview.js";
import { markReviewed, setStatementAmount, monthLabel, monthBounds } from "./calc/monthreview.js";
import { logIncomeReceived, deleteIncomeReceived } from "./calc/received.js";
import { renderReceived, toggleReceivedRow, receivedSheet, openReceivedSheet, closeReceivedSheet, setReceivedTarget, receivedSheetHtml } from "./components/received.js";
import { applyRentalComparison, applyBudgetComparison, householdBudgetLines } from "./calc/closeyear.js";
import { setUseBudgetLines, setLineExcluded, RENT_EXPENSE_LINES, rentLineFor, setRentalActual, mergeTaxYearFile, matchPerson, taxYearRecord, TAX_YEAR_FILE_KIND } from "./calc/taxyear.js";
import { renderCards, renderDashboardStats, renderDetail, setProjectionReference, logNetWorthSnapshot } from "./components/dashboard.js";
import {
  personBreakdownHtml, renderIncomeGroups, patchOpenRowBreakdowns, patchIncomeGroupTotals,
  patchSyntheticIncomeRows, patchIncomeSuperNotes, renderTaxSuper, withholdingCheckText, flipTaxCard, patchAllTaxPersonOutputs, patchPhiNote,
  modernIncomeRowOpen, parseIncomeImportCsv, renderIncomeImportPreview, clearIncomeImportPreview, commitIncomeImport
} from "./components/income.js";
import {
  patchSharedGroupTotals, renderSharedGroups, renderPropertyExpensesSummary, modernSharedRowOpen,
  openScenarioOverridePanel, closeScenarioOverridePanel, renderScenarioOverridePanel,
  setScenarioOverride, resetScenarioOverride, copyScenarioAmountToAll,
  openExpenseReview, closeExpenseReview, renderExpenseReviewPanel,
  logCurrentReviewCard, skipCurrentReviewCard, expenseReview,
  renderTransactions, addTransaction, deleteTransaction, renderActualVsPlannedPanel,
  setTransactionsShowAll, setTransactionsRange, modernTransactionRowOpen, budgetRowTxnsOpen, transactionSummaryText, visibleSpendingIndices, loggableBudgetLineItems,
  openQuickLog, closeQuickLog, renderQuickLogSheet, setQuickLogLink, setQuickLogDateOpen,
  setQuickLogShowAllChips, setQuickLogChipFilter, setQuickLogSign, setQuickLogRefundOf, submitQuickLog, quickLogContextText, quickLog,
  renderAccounts, addAccount, deleteAccount, renameAccountEverywhere, logExpenseTransaction,
  renderCategories, addCategory, deleteCategory, renameCategoryEverywhere,
  setBudgetGroupBy, renderBudgetGroupByToggle, budgetLineItems,
  toggleBudgetGroup, setAllBudgetGroupsCollapsed, allBudgetGroupsCollapsed, revealBudgetLine,
  renderYearSpending, renderYearBasisPreference, setYearBasis, transactionCategory,
  parseExpensesImportCsv, renderExpensesImportPreview, clearExpensesImportPreview, commitExpensesImport,
  renderSpendCategoryChart, renderSpendingTrends
} from "./components/expenses.js";
import {
  patchHoldingRow, patchVehicleRow, modernAssetRowOpen, patchAssetCategoryTotals,
  renderNetWorthPanel, renderAssets, logAssetSnapshot, applySharesPaste, logDebtSnapshot, setUsdAudRate,
  patchSharesGlance, setAssetPersonFilter, renderAssetPersonFilter, renderAssetPersonSheet, assetPersonSheetOpen, setAssetPersonSheetOpen, setSharesGainFilter, setSharesSortMode, setSharesChangeWindow, setAllocationRange, setPortfolioRange,
  parseAssetsImportCsv, renderAssetsImportPreview, clearAssetsImportPreview, commitAssetsImport, dividendNoteText,
  recordAssetSale, deleteAssetSale, renderAssetsSummary, patchOffsetsRow, addAssetLot, syncAvgCostFromLots, lotsSectionHtml, lotsNoteText, addAssetStatement, statementsSectionHtml, payoutsSectionHtml, payoutsNoteText, addAssetPayout
} from "./components/assets.js";
import {
  modernPropRowOpen, renderPropListModern, renderProperties, patchPropertyCardComputed,
  logPropertySnapshot, PROPERTY_SECTION_KEYS, borrowingNoteText, moveAcquisitionCostToLoan, setSaleWhatIfField, patchSaleWhatIf, setLoanStrategyField, patchLoanStrategy, propertyTabs,
  fixedExpiryHtml, rentPanelHtml, fixedWhatIf
} from "./components/properties.js";
import { renderProjectionOutputs, projectionSeriesShown } from "./components/projections.js";
import { renderBenchmarks, setBenchmarkField, applyBenchmarkPaste, addGoal, setGoalField, removeGoal, setPropertyMarketField } from "./components/benchmarks.js";
import { copyBenchmarkTemplateToClipboard } from "./lib/backup.js";
import {
  selectScenario, addScenario, renameScenario, cloneScenario, deleteScenario, renderHomeBody, renderHomeListModern,
  renderHomeBodyTotalsOnly, homeBlockCollapsed, modernHomeRowOpen, patchHomeLoanRowIfSynced,
  patchCalcOutputs, afterCalcChange, patchInvestOutputs
} from "./components/scenarios.js";
import { ACCOUNT_TYPE_KEYS, accountSourceOptions, setAccountBalance, resolveLink, accountBalance } from "./calc/accounts.js";
import { addTransfer, deleteTransfer, splitTransaction, unsplit, bulkEditTransactions, bulkDeleteTransactions } from "./calc/cashflowlist.js";
import { txFilters, txSelect, transferForm, splitEditing, resetTxFilters } from "./components/cashflow.js";
import { rulesPageHtml, setRuleField, ruleIsEmpty, ruleTest } from "./components/rules.js";
import { normaliseDescription } from "./calc/bank-import.js";
import { openAccounts, balanceEditing } from "./components/accounts.js";
import { renderHomeSummary } from "./components/home.js";
import { dataHealthChecks, dismissCheck } from "./calc/health.js";
import { applyFirstRun, shouldOfferFirstRun } from "./calc/firstrun.js";
import { normaliseTrip, applyTripRefile } from "./calc/trips.js";
import { tripsCardHtml, tripPlan, tripProtectedLineIds } from "./components/trips.js";
import { refreshPriceSheet, priceSheetDue, priceSheetResultText, defaultBackfillFrom, priceSheetUi } from "./components/pricesheet.js";
import { firstRun, startFirstRun, firstRunHtml } from "./components/firstrun.js";
import { chooseFolder, backupToFolder, forgetFolder, maybeAutoBackup, setPasscode, clearPasscode, checkPasscode, newestFolderBackup, compareCopies } from "./lib/safekeeping.js";
import { renderSafekeeping } from "./components/safekeeping.js";
import { goalsSectionHtml, goalOpen } from "./components/savegoals.js";
import { addSavingsGoal } from "./calc/savegoals.js";
import { unbudgetedRecurring, risingLines } from "./calc/recurring.js";
import { recordRentReview } from "./calc/propertylife.js";
import { retirementHtml, retireLevers } from "./components/retirement.js";
import { recurringHtml, recurringDismissed } from "./components/recurring.js";
import { renderReports, reportShown, reportPrintHtml, reportCsv } from "./components/reports.js";
import { exportTableCsv } from "./lib/backup.js";
import { yearEndPrintHtml, yearEndDocumentsCsv } from "./components/yearend.js";
import { loadPeriod, applyPeriod, setPeriodRerender, renderPeriodButton, renderPeriodMenu } from "./components/period.js";
import { selectedYearWindow, yearStartOf, householdYearBasis } from "./calc/ledger.js";
import { showPage, parseRouteFromLocation, closeNavMenu, closeMobileMore, showAssetsSubpage, showDashboardSubpage, showExpensesSubpage, showAccountsSubpage, showTaxSubpage, showPlanSubpage, taxSubpage, setOverlayCleanup, QUICK_ACTIONS, quickActionsSheetHtml, PAGE_KEY, appAssetUrl } from "./components/nav.js";
import { openSearch, closeSearch, setSearchQuery, getSearchResults } from "./components/search.js";
import {
  startBankImport, reparseBankImportWith, clearBankImport,
  setBankImportGroupLine, setBankImportGroupCategory, renderBankImportPanel, patchBankImportPanel, renderBankImportHelp,
  setIncludePossibleDuplicates, commitBankImport, undoBankImport, setStatementAccount, setStatementBalanceOn
} from "./components/bank-import.js";

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

  function rndBetween(min, max){ return Math.random() * (max - min) + min; }
  function rndStep(min, max, step){ return Math.round(rndBetween(min, max) / step) * step; }

  // A few backdated snapshots ending exactly at today's real value, so a fresh "Sample data"
  // holding shows a sparkline immediately instead of the empty history every holding actually
  // starts with (the sparkline needs 2+ logged points, which nobody has on day one) — the whole
  // point of sample data is to show what the feature looks like once it's in use.
  function syntheticPriceHistory(qty, currentPrice){
    var days = [-45, -30, -15, -7, -2, 0];
    var driftPct = rndBetween(-0.18, 0.22);
    return days.map(function(d, i){
      var dt = new Date();
      dt.setDate(dt.getDate() + d);
      var progress = i / (days.length - 1);
      var histPrice = i === days.length - 1 ? currentPrice : currentPrice * (1 - driftPct * (1 - progress));
      histPrice = Math.round(histPrice * 100) / 100;
      // The per-unit price, not just the total value below — holdingWindowChange() (Change/
      // Gain-Loss on the Shares page) compares price to price for a given lookback window and
      // ignores any entry missing this field, the same way a real Log/paste-prices entry would.
      // Without it, every mock share holding showed "— 1D"/"— 1W"/etc. for both Change and
      // Gain/Loss no matter which window was picked — sample data is the one first-touch a new
      // visitor gets, and it should actually demonstrate the feature.
      return { date: localDateStr(dt), value: Math.round(qty * histPrice * 100) / 100, price: histPrice };
    });
  }
  function rndPick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
  function rndInt(min, max){ return Math.floor(rndBetween(min, max + 1)); }
  // Distinct random picks (no repeats) — used to choose a varying-size, varying-membership
  // subset of a larger pool (which expenses/holdings appear this time), not just varying amounts
  // on an always-identical fixed list.
  function rndPickN(arr, n){
    var pool = arr.slice();
    var out = [];
    n = Math.min(n, pool.length);
    for(var i = 0; i < n; i++){ out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); }
    return out;
  }

  // A pool for each category (expenses/shares/vehicles/employers/...), with a *varying-size,
  // varying-membership* random subset picked each run — not just randomized amounts on an
  // always-identical fixed list. Household size itself varies too (1 or 2 people), which cuts
  // through everything below: income, super, and how share holdings get attributed by person.
  var MOCK_NAMES = ["Alex","Jordan","Sam","Taylor","Morgan","Casey","Riley","Jamie","Charlie","Sydney","Harper","Quinn","Avery","Rowan","Skyler","Dakota","Reese","Emerson","Finley","Hayden","Kai","Logan","Micah","Parker","Sage","Drew","Elliot","Frankie"];
  var MOCK_EMPLOYERS = ["Woolworths","Coles","Commonwealth Bank","Telstra","Qantas","Atlassian","Canva","BHP","Rio Tinto","Westpac","NAB","ANZ","Officeworks","JB Hi-Fi","Bunnings","Deloitte","PwC","KPMG","EY","Optus","Woodside","Suncorp"];
  var MOCK_CITIES = ["Sydney","Melbourne","Brisbane","Perth","Adelaide","Hobart","Canberra","Gold Coast"];
  var MOCK_EXPENSE_POOL = [
    { what:"Internet", classification:"Needs", freq:"Monthly", min:60, max:120, step:5 },
    { what:"Electricity", classification:"Needs", freq:"Monthly", min:120, max:280, step:5 },
    { what:"Gas", classification:"Needs", freq:"Quarterly", min:80, max:220, step:5 },
    { what:"Mobile Phones", classification:"Needs", freq:"Monthly", min:40, max:120, step:5 },
    { what:"Health Insurance", classification:"Needs", freq:"Monthly", min:100, max:260, step:5 },
    { what:"Streaming Subscriptions", classification:"Wants", freq:"Monthly", min:20, max:60, step:1 },
    { what:"Gym Membership", classification:"Wants", freq:"Fortnightly", min:40, max:100, step:5 },
    { what:"Car Insurance", classification:"Needs", freq:"Monthly", min:80, max:200, step:5 },
    { what:"Car Rego", classification:"Needs", freq:"Yearly", min:400, max:900, step:10 },
    { what:"Petrol", classification:"Needs", freq:"Monthly", min:100, max:250, step:5 },
    { what:"Groceries", classification:"Needs", freq:"Weekly", min:150, max:350, step:5 },
    { what:"Public Transport", classification:"Needs", freq:"Weekly", min:20, max:60, step:5 },
    { what:"Eating Out", classification:"Wants", freq:"Fortnightly", min:80, max:250, step:5 },
    { what:"Trips / Travel", classification:"Wants", freq:"Yearly", min:3000, max:20000, step:500 },
    { what:"Pets", classification:"Wants", freq:"Weekly", min:30, max:120, step:5 },
    { what:"Miscellaneous", classification:"Wants", freq:"Yearly", min:500, max:2000, step:50 },
    { what:"Childcare", classification:"Needs", freq:"Weekly", min:100, max:400, step:10 },
    { what:"Private School Fees", classification:"Needs", freq:"Yearly", min:5000, max:25000, step:500 },
    { what:"Home & Contents Insurance", classification:"Needs", freq:"Yearly", min:600, max:1800, step:50 },
    { what:"Life Insurance", classification:"Needs", freq:"Monthly", min:40, max:200, step:5 },
    { what:"Charity Donations", classification:"Wants", freq:"Monthly", min:20, max:150, step:5 },
    { what:"Clothing & Shoes", classification:"Wants", freq:"Monthly", min:50, max:300, step:10 },
    { what:"Haircuts / Grooming", classification:"Wants", freq:"Monthly", min:30, max:150, step:5 },
    { what:"Parking", classification:"Needs", freq:"Monthly", min:50, max:250, step:5 },
    { what:"Tolls", classification:"Needs", freq:"Monthly", min:20, max:150, step:5 },
    { what:"Home Cleaning", classification:"Wants", freq:"Fortnightly", min:80, max:220, step:10 },
    { what:"Music Lessons", classification:"Wants", freq:"Monthly", min:40, max:150, step:5 }
  ];
  // priceMin/priceMax are per-unit; US/Crypto tickers are USD (see MARKET_CURRENCY, constants.js)
  // just like a real holding under those markets would be.
  var MOCK_SHARE_UNIVERSE = [
    { what:"CSL Limited", symbol:"CSL", market:"ASX", priceMin:180, priceMax:320 },
    { what:"BHP Group", symbol:"BHP", market:"ASX", priceMin:35, priceMax:55 },
    { what:"Commonwealth Bank", symbol:"CBA", market:"ASX", priceMin:90, priceMax:170 },
    { what:"Fortescue", symbol:"FMG", market:"ASX", priceMin:15, priceMax:25 },
    { what:"Telstra", symbol:"TLS", market:"ASX", priceMin:3.5, priceMax:5 },
    { what:"Wesfarmers", symbol:"WES", market:"ASX", priceMin:50, priceMax:85 },
    { what:"Vanguard Australian Shares ETF", symbol:"VAS", market:"ASX", priceMin:80, priceMax:110 },
    { what:"iShares Core S&P 500 ETF", symbol:"IVV", market:"ASX", priceMin:50, priceMax:75 },
    { what:"Apple Inc", symbol:"AAPL", market:"US", priceMin:140, priceMax:260 },
    { what:"Microsoft Corp", symbol:"MSFT", market:"US", priceMin:300, priceMax:470 },
    { what:"Amazon.com Inc", symbol:"AMZN", market:"US", priceMin:100, priceMax:220 },
    { what:"Alphabet Inc", symbol:"GOOGL", market:"US", priceMin:100, priceMax:200 },
    { what:"NVIDIA Corp", symbol:"NVDA", market:"US", priceMin:60, priceMax:150 },
    { what:"Tesla Inc", symbol:"TSLA", market:"US", priceMin:150, priceMax:350 }
  ];
  var MOCK_VEHICLES = ["Toyota Corolla","Mazda 3","Tesla Model 3","Ford Ranger","Hyundai i30","Mitsubishi ASX","Subaru Outback","Kia Sportage"];

  function generateMockData(){
    var numPeople = rndPick([1, 2]);
    var personA = rndPick(MOCK_NAMES);
    var personB = numPeople === 2 ? rndPick(MOCK_NAMES.filter(function(n){ return n !== personA; })) : null;
    var cityA = rndPick(MOCK_CITIES);
    var cityB = rndPick(MOCK_CITIES.filter(function(c){ return c !== cityA; }));
    var scenarios = ["Renting", "Buy " + cityA, "Buy " + cityB];

    function incomeForPerson(person, idPrefix){
      var employer = rndPick(MOCK_EMPLOYERS);
      var items = [
        { id: idPrefix + "Salary", what: person + "'s Salary (" + employer + ")", classification:"", account:"Everyday Account", person: person, incomeType:"Gross", amount: rndStep(4500, 13000, 50), freq:"Monthly" }
      ];
      if(Math.random() < 0.55){
        var hasSacrifice = Math.random() < 0.4;
        items.push({ what: person + "'s Bonus", classification:"", account:"Everyday Account", person: person, incomeType:"Gross", amount: rndStep(1500, 20000, 500), freq:"Yearly", sacrificeMode: hasSacrifice ? "percent" : "none", sacrificeValue: hasSacrifice ? rndStep(10, 50, 10) : 0 });
      }
      if(Math.random() < 0.25){
        items.push({ what: person + "'s Side Income", classification:"", account:"Everyday Account", person: person, incomeType:"Net", amount: rndStep(200, 2000, 50), freq:"Monthly" });
      }
      return items;
    }
    var income = incomeForPerson(personA, "mockIncomeA").concat(personB ? incomeForPerson(personB, "mockIncomeB") : []);

    var chosenExpenses = rndPickN(MOCK_EXPENSE_POOL, rndInt(12, MOCK_EXPENSE_POOL.length));
    var shared = chosenExpenses.map(function(e){
      return { what: e.what, classification: e.classification, account: rndPick(["Everyday Account", "Credit Card"]), amount: rndStep(e.min, e.max, e.step), freq: e.freq };
    });

    var homeCats = function(rentAmt, rentFreq, acct, insurance, council, water, maintenance){
      return [
        { id:"homeLoanRow", what:"Rent / Home Loan", classification:"Needs", account: acct, amount: rentAmt, freq: rentFreq },
        { what:"Home Insurance", classification: insurance ? "Needs" : "N/A", account: insurance ? acct : "", amount: insurance || 0, freq:"Yearly" },
        { what:"Council Rates", classification: council ? "Needs" : "N/A", account: council ? acct : "", amount: council || 0, freq:"Monthly" },
        { what:"Water & Wastewater", classification:"Needs", account: acct, amount: water, freq: council ? "Monthly" : "Quarterly" },
        { what:"Property Maintenance", classification: maintenance ? "Needs" : "N/A", account: maintenance ? acct : "", amount: maintenance || 0, freq:"Yearly" }
      ];
    };

    var rentWeekly = rndStep(450, 900, 10);
    var priceA = rndStep(650000, 1800000, 5000);
    var priceB = rndStep(500000, 1400000, 5000);

    var chosenShares = rndPickN(MOCK_SHARE_UNIVERSE, rndInt(2, 5));
    var shareHoldings = chosenShares.map(function(s){
      var isUs = s.market === "US";
      var qty = isUs ? rndStep(2, 40, 1) : rndStep(10, 300, 5);
      var priceStep = isUs ? 1 : 0.5;
      var price = rndStep(s.priceMin, s.priceMax, priceStep);
      var cost = rndStep(price * 0.7, price * 1.15, priceStep);
      var person = personB ? rndPick([personA, personB, ""]) : personA;
      return { what: s.what, category:"Shares", symbol: s.symbol, market: s.market, quantity: qty, avgCost: cost, price: price, priceUpdated:"", person: person, amount: Math.round(qty * price * 100) / 100, history: syntheticPriceHistory(qty, price) };
    });
    if(Math.random() < 0.3){
      var btcQty = Math.round(rndBetween(0.001, 0.05) * 1e8) / 1e8;
      var btcPrice = rndStep(60000, 130000, 500);
      shareHoldings.push({ what:"Bitcoin", category:"Shares", symbol:"BTC", market:"Crypto", quantity: btcQty, avgCost: rndStep(btcPrice * 0.7, btcPrice * 1.3, 500), price: btcPrice, priceUpdated:"", person: personA, amount: Math.round(btcQty * btcPrice * 100) / 100, history: syntheticPriceHistory(btcQty, btcPrice) });
    }

    var assets = [{ what:"Cash Savings", category:"Cash", amount: rndStep(3000, 90000, 500) }].concat(shareHoldings);
    assets.push({ what:"Superannuation", category:"Super", person: personA, amount: rndStep(15000, 250000, 500) });
    if(personB) assets.push({ what:"Superannuation", category:"Super", person: personB, amount: rndStep(15000, 250000, 500) });
    if(Math.random() < 0.5){
      var vehiclePrice = rndStep(15000, 60000, 500);
      assets.push({ what: rndPick(MOCK_VEHICLES), category:"Vehicle", purchasePrice: vehiclePrice, purchaseDate: "202" + rndInt(1, 4) + "-0" + rndInt(1, 9) + "-01", depreciationRate: rndStep(8, 15, 1), amount: Math.round(vehiclePrice * 0.65), computed:true, computedNote:"auto: declining balance" });
    }

    return {
      activeScenario: "Renting",
      scenarios: scenarios,
      baselineScenario: "Renting",
      showAllPeriods: false,
      income: income,
      ip: [],
      shared: shared,
      // Explicit, not left to migrateState()'s seedAccountsFromUsage() fallback — that seeder
      // only knows account *names* already typed into an Account field (from shared/income
      // above, both of which randomly use "Credit Card" as a label) and has no way to tell a
      // credit card apart from a debit account by name alone, so it always defaults type
      // "debit". Sample data is the one first-touch a new visitor gets, and it should actually
      // demonstrate the credit-card statement-cycle grouping ("Actual vs. planned" on the
      // Expenses tab) rather than silently leave the exact account named "Credit Card"
      // unconfigured for it.
      accounts: [
        { id: genId("acct"), name: "Everyday Account", type: "everyday", statementStartDay: 1 },
        { id: genId("acct"), name: "Credit Card", type: "credit", statementStartDay: rndStep(1, 28, 1) }
      ],
      home: (function(){
        var h = {};
        h["Renting"] = homeCats(rentWeekly, "Weekly", "Everyday Account", 0, 0, rndStep(30, 60, 1), 0);
        h[scenarios[1]] = homeCats(rndStep(2000, 7500, 50), "Monthly", "Everyday Account", rndStep(1200, 2500, 50), rndStep(150, 350, 10), rndStep(150, 250, 10), rndStep(1000, 3000, 100));
        h[scenarios[2]] = homeCats(rndStep(1500, 5500, 50), "Monthly", "Everyday Account", rndStep(1200, 2500, 50), rndStep(150, 350, 10), rndStep(90, 200, 10), rndStep(1000, 3000, 100));
        return h;
      })(),
      purchase: (function(){
        var p = {};
        p["Renting"] = defaultPurchaseConfig(0, 20, 6.0, 30, "NSW", false);
        p[scenarios[1]] = defaultPurchaseConfig(priceA, 20, rndStep(5.5, 7, 0.25), 30, rndPick(["NSW","VIC","Other"]), true);
        p[scenarios[2]] = defaultPurchaseConfig(priceB, 20, rndStep(5.5, 7, 0.25), 30, rndPick(["NSW","VIC","Other"]), true);
        return p;
      })(),
      assets: assets,
      properties: Math.random() < 0.6 ? (function(){
        var ipValue = rndStep(500000, 900000, 5000);
        var ipLoanBalance = Math.round(ipValue * rndBetween(0.6, 0.8));
        var ipRentWeekly = rndStep(450, 750, 10);
        var ipPurchasePrice = Math.round(ipValue * rndBetween(0.65, 0.9));
        var ipPurchaseDate = "20" + rndInt(15, 21) + "-0" + rndInt(1, 9) + "-01";
        var ipAcquisitionCosts = [
          { id: genId("ac"), what: "Stamp duty", amount: Math.round(ipPurchasePrice * rndBetween(0.03, 0.05)) },
          { id: genId("ac"), what: "Legal / conveyancing", amount: rndStep(1200, 2500, 100) },
          { id: genId("ac"), what: "Building & pest inspection", amount: rndStep(400, 800, 50) }
        ];
        return [{
          id: genId("p"), what: rndStep(1, 99, 1) + " Example St", kind: "IP", value: ipValue,
          purchasePrice: ipPurchasePrice, purchaseDate: ipPurchaseDate, acquisitionCosts: ipAcquisitionCosts, history: [],
          pmFee: { percent: rndStep(5, 8, 0.5), flat: rndStep(0, 8, 0.5) }, incomePaidFreq: "Monthly",
          loans: [{
            id: genId("l"), what: "Investment Loan", balance: ipLoanBalance, rate: rndStep(5.8, 6.8, 0.05), termYears: 27,
            repaymentType: "PI", repaymentMode: "auto", manualRepaymentAmount: 0, manualRepaymentFreq: "Monthly",
            offsetBalance: rndStep(0, 15000, 500)
          }],
          income: [{ what: "Rent", account: "Everyday Account", amount: ipRentWeekly, freq: "Weekly", classification: "" }],
          expenses: [
            { what: "Building Insurance", classification: "Needs", account: "Everyday Account", amount: rndStep(800, 1800, 50), freq: "Yearly" },
            { what: "Council Rates", classification: "Needs", account: "Everyday Account", amount: rndStep(400, 900, 25), freq: "Quarterly" },
            { what: "Water Rates", classification: "Needs", account: "Everyday Account", amount: rndStep(200, 400, 10), freq: "Quarterly" },
            { what: "Property Maintenance", classification: "Needs", account: "Everyday Account", amount: rndStep(1000, 3000, 100), freq: "Yearly" },
            { id: "pmFee6", what: "Property Manager Fee", classification: "Needs", account: "Everyday Account", amount: 0, freq: "Weekly", computed: true, computedNote: "" }
          ]
        }];
      })() : [],
      projection: { horizonYears: 20, investReturnRate: 7, propertyAppreciationRate: 5, inflationRate: 3, rateShockPct: 0, incomeGrowthRate: 3, realTerms: true },
      tax: { sgRate: 12, settings: {} }
    };
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
        if(mHome[1] === state.activeScenario) renderSharedGroups();
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


  function renderTotals(){
    document.getElementById("totalIncomeMonthly").textContent = fmtCurrency0.format(sumField(effectiveIncomeItems(), "monthly"));
    // Totals what the list actually shows — shared plus the active scenario's housing — not just
    // state.shared, or the header disagrees with the cards beneath it by the size of your rent.
    // Scenario-resolved, matching the cards below it and every other total in the app.
    document.getElementById("totalSharedMonthly").textContent = fmtCurrency0.format(sumFieldForScenario(budgetLineItems(), state.activeScenario, "monthly"));
    renderGlobalMetrics();
  }

  // Sticky header figures — always visible regardless of which tab is open, so a change
  // made three tabs deep is immediately reflected in the two numbers that matter most.
  function renderGlobalMetrics(){
    var netWorthEl = document.getElementById("globalNetWorth");
    var cashFlowEl = document.getElementById("globalCashFlow");
    if(!netWorthEl || !cashFlowEl) return;
    netWorthEl.textContent = fmtCurrency0.format(totalNetWorthValue());
    var t = scenarioTotals(state.activeScenario);
    cashFlowEl.textContent = (t.netMonthly >= 0 ? "+" : "") + fmtCurrency0.format(t.netMonthly) + "/mo";
    cashFlowEl.classList.toggle("pos", t.netMonthly >= 0);
    cashFlowEl.classList.toggle("neg", t.netMonthly < 0);
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
      var whatField = row.querySelector(".tx-what");
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
    if(section === "shared" || section === "home:" + state.activeScenario) return true;
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
      var p = periodsOf(resolveSharedAmount(item, state.activeScenario), item.freq);
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

    renderCards();
    renderDetail();
    renderTotals();
    if(section.indexOf("home:") === 0) renderHomeBodyTotalsOnly();
    renderProjectionOutputs();
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
      renderProjectionOutputs();
      persist();
      var move = newAmount - previousAmount;
      showToast(move === 0
        ? pItem.what + " recorded at " + fmtCurrency0.format(newAmount) + " from " + recordedOn
        : pItem.what + " " + (move > 0 ? "up" : "down") + " " + fmtCurrency0.format(Math.abs(move)) +
          " to " + fmtCurrency0.format(newAmount) + " from " + recordedOn);
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
        renderProjectionOutputs();
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
    renderCards(); renderDetail(); renderTotals(); renderHomeBodyTotalsOnly();
    renderProjectionOutputs();
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
        ? "Every figure below is deflated by " + (Number(state.projection.inflationRate) || 0) + "% a year — what it would buy today."
        : "Raw future dollars, not adjusted for inflation.";
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
    var cls = ["pp-dob", "pp-help", "pp-cap", "pp-carry", "pp-losses", "pp-wfh"].find(function(c){ return t.classList.contains(c); });
    if(!cls || !setPersonField(person, cls, t.value, t.getAttribute("data-fy"))) return;
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
      if(deleteAssetSale(Number(parts[0]), Number(parts[1]))){
        showToast("Sale removed — the units are back in the holding");
        afterAssetSaleChange();
      }
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
    if(vd){ prop.vacancies.splice(Number(vd.getAttribute("data-vac-del")), 1); persist(); rentPanel(); }
  });
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
      else if(e.target.classList.contains("loan-settled") || e.target.classList.contains("loan-borrowing") || e.target.classList.contains("loan-borrowing-term") || e.target.classList.contains("loan-ended")){
        if(e.target.classList.contains("loan-settled")) loan.settlementDate = e.target.value || "";
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
    state.properties.push({ id: genId("p"), what:"New property", kind:"IP", value:0, purchasePrice:null, purchaseDate:"", acquisitionCosts:[], history:[], pmFee:{percent:6, flat:5.5}, incomePaidFreq:"Monthly", sectionsCollapsed:{acquisition:true, ownership:true, loans:true, income:true, expenses:true}, ownership:{}, loans:[], income:[], expenses:[] });
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
  setDeductibleItemsProvider(budgetLineItems);
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

  // ---------------- Review expenses: one-at-a-time swipe/confirm flow ----------------
  // A brief slide-out + fade before advancing to the next card — skipped for
  // prefers-reduced-motion, matching the flip-card pattern on Tax & Super.
  function animateReviewCard(direction, callback){
    var card = document.querySelector(".review-card");
    if(!card || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)){
      callback();
      return;
    }
    card.classList.add("swipe-out-" + direction);
    setTimeout(callback, 200);
  }
  function performReviewSkip(){
    if(!expenseReview || expenseReview.pos >= expenseReview.queue.length) return;
    animateReviewCard("left", function(){
      skipCurrentReviewCard();
      renderExpenseReviewPanel();
    });
  }
  function performReviewLog(){
    if(!expenseReview || expenseReview.pos >= expenseReview.queue.length) return;
    var amountInput = document.querySelector(".review-amount");
    var dateInput = document.querySelector(".review-date");
    var amount = amountInput ? (parseFloat(amountInput.value) || 0) : 0;
    var dateStr = (dateInput && dateInput.value) || undefined;
    animateReviewCard("right", function(){
      logCurrentReviewCard(amount, dateStr);
      refreshAfterLedgerChange("shared");
      renderExpenseReviewPanel();
    });
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
    if(e.target.closest("[data-review-skip]")){ performReviewSkip(); return; }
    if(e.target.closest("[data-review-log]")){ performReviewLog(); return; }
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    if(document.querySelector("[data-review-backdrop]")) requestCloseActiveOverlay();
  });
  onHorizontalSwipe(document.getElementById("expenseReviewRoot"), {
    onSwipeLeft: performReviewSkip,
    onSwipeRight: performReviewLog
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
  document.getElementById("mobileSearchBtn").addEventListener("click", openSearchOverlay);
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
    showPage(result.page, { replace: true });
    // `sub` means different things per page: an Assets category, or one of the Expenses subtabs.
    // Routed by page rather than by guessing from the value, so "budget" can never be mistaken for
    // an asset category.
    if(result.extra.sub){
      if(result.page === "expenses") showExpensesSubpage(result.extra.sub, { replace: true });
      else showAssetsSubpage(result.extra.sub, { replace: true });
    }
    // A budget line lives inside a group card that starts collapsed, so it has to be opened before
    // there is anything on screen to scroll to. Without this the search lands on the page at scroll
    // 0 with the row display:none — the result looks like it did nothing.
    if(result.extra.lineId && revealBudgetLine(result.extra.lineId)){
      renderSharedGroups();
      renderBudgetGroupByToggle();
      persist();
    }
    if(result.extra.scrollToId || result.extra.lineId){
      // Give showPage's own render + view-transition a moment to finish before scrolling —
      // scrolling to an element mid-transition can land at the wrong offset once it settles.
      setTimeout(function(){
        var el = result.extra.scrollToId
          ? document.getElementById(result.extra.scrollToId)
          : document.querySelector('#sharedGroups [data-line-id="' + (window.CSS && window.CSS.escape ? window.CSS.escape(result.extra.lineId) : result.extra.lineId) + '"]');
        if(el) el.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 200);
    }
  });
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
  document.getElementById("transactionsTable").addEventListener("click", function(e){
    var rangeBtn = e.target.closest("[data-tx-range]");
    if(rangeBtn){ setTransactionsRange(rangeBtn.getAttribute("data-tx-range")); return; }
    onCashflowListClick(e);
  });

  // ---------------- Cash flow → Spending: filters, money in, transfers, splits, bulk edit (v3.59.0) ----------------
  function afterTransactionsChange(){
    renderRecurring();
    renderTrips();
    renderTransactions();
    renderActualVsPlannedPanel();
    renderSharedGroups();
    renderHomeSummary();
    renderMonthReview();
    persist();
  }
  function pickedIndices(){
    return Object.keys(txSelect.picked).filter(function(k){ return txSelect.picked[k]; }).map(Number).filter(function(i){ return state.transactions[i]; });
  }
  function onCashflowListClick(e){
    var b = e.target.closest("button");
    if(!b || b.disabled) return;
    if(b.hasAttribute("data-cf-dir")){ txFilters.direction = b.getAttribute("data-cf-dir"); setTransactionsShowAll(false); renderTransactions(); return; }
    if(b.hasAttribute("data-cf-clear")){ resetTxFilters(); renderTransactions(); return; }
    if(b.hasAttribute("data-cf-select")){ txSelect.on = !txSelect.on; txSelect.picked = {}; renderTransactions(); return; }
    if(b.hasAttribute("data-cf-transfer")){ transferForm.open = true; renderTransactions(); var f = document.querySelector('#transactionsTable [data-tf="amount"]'); if(f) f.focus(); return; }
    if(b.hasAttribute("data-tf-cancel")){ transferForm.open = false; renderTransactions(); return; }
    if(b.hasAttribute("data-tf-save")){
      var get = function(k){ var el = document.querySelector('#transactionsTable [data-tf="' + k + '"]'); return el ? (el.type === "checkbox" ? el.checked : el.value) : ""; };
      var amt = Number(get("amount"));
      if(!(amt > 0)){ showToast("Enter the amount moved"); return; }
      if(!get("from") || get("from") === get("to")){ showToast("Pick two different accounts"); return; }
      var rec = addTransfer({ date: get("date") || localDateStr(), amount: amt, from: get("from"), to: get("to"), what: get("what") });
      var moved = [];
      if(get("balances")){
        [[rec.from, -1], [rec.to, 1]].forEach(function(pair){
          var acct = state.accounts.find(function(a){ return a.name === pair[0]; });
          if(!acct) return;
          var bal = accountBalance(acct);
          if(bal.balance == null) return;
          // Money into a card or loan lowers what's owed; out of one raises it.
          var delta = (bal.owed ? -pair[1] : pair[1]) * amt;
          setAccountBalance(acct, bal.balance + delta, rec.date);
          moved.push(acct.name);
        });
      }
      transferForm.open = false;
      renderAll();
      persist();
      showUndoToast("Transfer saved" + (moved.length ? " — " + moved.join(" and ") + " updated" : ""), function(){ deleteTransfer(rec.id); renderAll(); persist(); });
      return;
    }
    if(b.hasAttribute("data-cf-del-transfer")){
      var gone = deleteTransfer(b.getAttribute("data-cf-del-transfer"));
      renderTransactions(); persist();
      if(gone) showUndoToast("Transfer deleted (balances unchanged)", function(){ state.transfers.splice(gone.index, 0, gone.record); renderTransactions(); persist(); });
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
      if(!del.length || !confirm("Delete " + del.length + " transaction" + (del.length === 1 ? "" : "s") + "?")) return;
      var removed = bulkDeleteTransactions(del);
      txSelect.picked = {};
      afterTransactionsChange();
      showUndoToast("Deleted " + removed.length, function(){ removed.forEach(function(x){ state.transactions.splice(x.index, 0, x.t); }); afterTransactionsChange(); });
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
    persist();
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
      persist();
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
      var oldName = a.name;
      a.name = e.target.value;
      renameAccountEverywhere(oldName, a.name);
      renderTransactions();
      updateAccountSuggestions();
    }
    else if(e.target.classList.contains("acct-mgmt-type")){
      a.type = ACCOUNT_TYPE_KEYS.indexOf(e.target.value) !== -1 ? e.target.value : "everyday";
      // A link only makes sense for the kinds of record this type can draw from.
      if(a.link && !accountSourceOptions(a).some(function(o){ return o.key === a.link; })) a.link = "";
      renderActualVsPlannedPanel();
      persist();
      // Deferred: showing/hiding the statement-day field means rebuilding #accountsTable, an
      // ancestor of this <select> that's still mid-event right now — same reentrant-DOM-mutation
      // issue as the Transactions date field above.
      setTimeout(renderAccounts, 0);
      return;
    }
    else if(e.target.classList.contains("acct-mgmt-day")){
      a.statementStartDay = Math.min(28, Math.max(1, parseInt(e.target.value, 10) || 1));
    }
    else if(e.target.classList.contains("acct-mgmt-limit")){
      var lim = e.target.value === "" ? null : Number(e.target.value);
      if(lim == null || !(lim >= 0)) delete a.limit; else a.limit = lim;
    }
    else if(e.target.classList.contains("acct-mgmt-link")){
      a.link = e.target.value;
      persist();
      setTimeout(function(){ renderAll(); }, 0);
      return;
    }
    else return;
    renderActualVsPlannedPanel();
    persist();
  });

  // ---------------- Categories: the spending rollup ----------------
  document.getElementById("planSubnav").addEventListener("click", function(e){
    var b = e.target.closest("[data-plan-sub]");
    if(b) showPlanSubpage(b.getAttribute("data-plan-sub"));
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
    if(!e.target.hasAttribute("data-rl-test")) return;
    ruleTest.text = e.target.value;
    clearTimeout(rulesTestTimer);
    rulesTestTimer = setTimeout(function(){
      var pos = e.target.selectionStart;
      renderRules();
      var again = rulesBody.querySelector("[data-rl-test]");
      if(again){ again.focus(); try{ again.setSelectionRange(pos, pos); }catch(err){} }
    }, 180);
  });
  rulesBody.addEventListener("click", function(e){
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
    if(delBtn){ deleteScenario(delBtn.getAttribute("data-delete")); return true; }
    if(e.target.closest("#addScenarioBtn") || e.target.closest("#addScenarioBtn2")){ addScenario(); return true; }
    var editBtn = e.target.closest("[data-edit-scenario]");
    if(editBtn){ selectScenario(editBtn.getAttribute("data-edit-scenario")); showPage("scenarios"); return true; }
    var setActiveBtn = e.target.closest("[data-edit-scenario2]");
    if(setActiveBtn){ selectScenario(setActiveBtn.getAttribute("data-edit-scenario2")); return true; }
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
    if(cardSel) selectScenario(cardSel.getAttribute("data-scenario"));
  });
  document.getElementById("cards").addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    var cardSel = e.target.closest(".card-select");
    // Only the card itself — Enter on a button inside it (the ⋯ menu) must reach that button.
    if(cardSel && e.target === cardSel){ e.preventDefault(); selectScenario(cardSel.getAttribute("data-scenario")); }
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
  });
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
    // Folding the maybes in or out changes which rows exist, so this one does need a full render —
    // unlike assigning a group, where re-rendering would move the row out from under the finger.
    var maybesBtn = e.target.closest("[data-bank-maybes]");
    if(maybesBtn){
      setIncludePossibleDuplicates(maybesBtn.getAttribute("data-bank-maybes") === "1");
      renderBankImportPanel();
      return;
    }
    if(e.target.closest("#bankImportCancelBtn")){ clearBankImport(); return; }
    if(!e.target.closest("#bankImportConfirmBtn")) return;
    var result = commitBankImport();
    clearBankImport();
    refreshAfterBankImport();
    // Transfers and a statement balance reach Accounts, Home and net worth too.
    if((result.transferIds && result.transferIds.length) || result.balanceSet) renderAll();
    showUndoToast(
      "Imported " + result.ids.length + " transaction" + (result.ids.length === 1 ? "" : "s") +
        (result.refunds ? " · " + result.refunds + " refund" + (result.refunds === 1 ? "" : "s") : "") +
        (result.receivedIds && result.receivedIds.length ? " · " + result.receivedIds.length + " income received" : "") +
        (result.transferIds && result.transferIds.length ? " · " + result.transferIds.length + " transfer" + (result.transferIds.length === 1 ? "" : "s") : "") +
        (result.balanceSet ? " · " + result.balanceSet.account + " balance updated" : "") +
        (result.linesCreated ? " · " + result.linesCreated + " new budget line" + (result.linesCreated === 1 ? "" : "s") : "") +
        (result.learned ? " · learned " + result.learned + " shop" + (result.learned === 1 ? "" : "s") : ""),
      function(){
        // Rules the import taught are left in place on purpose — they're a preference, not part of
        // the data being undone, and re-importing the same file is the usual reason to undo.
        undoBankImport(result.ids, result.lineIds, result.receivedIds, result.transferIds, result.balanceSet);
        refreshAfterBankImport();
        renderAll();
      }
    );
  });
  // Every panel on the Spending tab reads state.transactions, and an import moves all of them at
  // once — which is the point, and also why this is one named function rather than a list repeated
  // at the import and undo call sites where the two could drift apart.
  function refreshAfterBankImport(){
    renderRecurring();
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
    document.getElementById("mobileShareBtn").hidden = false;
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
    if(!confirm("Fill in randomised sample data so you can try the tool? This replaces everything currently entered — export a backup first if you want to keep it.")) return;
    setState(migrateState(generateMockData()));
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
    if(go){ showPage(go.getAttribute("data-setup-go")); return; }
    if(e.target.closest("[data-setup-dismiss]")){
      // Remembered, not session-only: re-offering a dismissed checklist every morning in a
      // daily-use app is its own small annoyance.
      state.setupDismissed = true;
      persist();
      renderDashboardStats();
      showToast("Setup checklist hidden");
    }
  });

  function updateThemeButtonLabel(){
    var mode = getThemePref();
    var label = mode === "light" ? "Theme: Light" : mode === "dark" ? "Theme: Dark" : "Theme: System";
    document.getElementById("themeToggleBtn").textContent = label;
    document.getElementById("mobileThemeBtn").textContent = label;
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

  // Mobile bottom tab bar — the primary nav on a mobile viewport (<880px), replacing the old
  // dropdown above. Five pages are one tap away; Scenarios/Projections live behind "More"
  // since they're occasional "what-if" pages rather than day-to-day data entry.
  var mobileTabMore = document.getElementById("mobileTabMore");
  var mobileMorePanel = document.getElementById("mobileMorePanel");
  document.getElementById("mobileTabbar").addEventListener("click", function(e){
    var pageBtn = e.target.closest("[data-page]");
    if(pageBtn){ showPage(pageBtn.getAttribute("data-page")); return; }
    if(e.target.closest("#mobileTabMore")){
      e.stopPropagation();
      var willOpen = mobileMorePanel.hidden;
      mobileMorePanel.hidden = !willOpen;
      mobileTabMore.setAttribute("aria-expanded", String(willOpen));
    }
  });
  document.addEventListener("click", closeMobileMore);
  document.addEventListener("keydown", function(e){ if(e.key === "Escape") closeMobileMore(); });

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
    // Deferred for the same reason the search handler defers its scroll: showPage's render and
    // view transition have to settle before the target button exists in its final form.
    setTimeout(function(){
      var target = action.selector
        ? document.querySelector(action.selector)
        : firstVisibleAddButton(action.page);
      if(target) target.click();
    }, 240);
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

  // Mirrors the sidebar footer's version text into the mobile "More" panel, which is the only
  // place a mobile viewport (<880px, where .app-version is hidden) can see it.
  document.getElementById("mobileMoreVersion").textContent = document.querySelector(".app-version-num").textContent;

  // The utility actions (Theme/Import/Export/Sample data/Reset) live in .actions on desktop,
  // hidden on mobile in favor of the bottom tab bar — these forward to the same real buttons
  // rather than duplicating their logic, so behavior (confirms, dialogs, label state) matches
  // exactly with nothing to keep in sync beyond the label mirrors above.
  [
    ["mobileThemeBtn", "themeToggleBtn"],
    ["mobileShareBtn", "shareBtn"],
    ["mobileImportBtn", "importBtn"],
    ["mobileExportBtn", "exportBtn"],
    ["mobileCheckUpdatesBtn", "checkUpdatesLink"],
    ["mobileSampleDataBtn", "mockDataBtn"],
    ["mobileResetBtn", "resetBtn"]
  ].forEach(function(pair){
    document.getElementById(pair[0]).addEventListener("click", function(){
      closeMobileMore();
      document.getElementById(pair[1]).click();
    });
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

  document.getElementById("dashboardSubnav").addEventListener("click", function(e){
    var btn = e.target.closest("[data-dashboard-sub]");
    if(!btn) return;
    showDashboardSubpage(btn.getAttribute("data-dashboard-sub"));
    if(btn.getAttribute("data-dashboard-sub") === "benchmarks") renderBenchmarks();
    if(btn.getAttribute("data-dashboard-sub") === "review") renderMonthReview();
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
      else { showPage("expenses"); showExpensesSubpage("spending", { replace: true }); var card = document.getElementById("bankImportCard"); if(card){ card.open = true; setTimeout(function(){ card.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80); } }
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
    if(routeFromUrl.sub && routeFromUrl.page === "assets") initialAssetsSub = routeFromUrl.sub;
    if(routeFromUrl.sub && routeFromUrl.page === "expenses") initialExpensesSub = routeFromUrl.sub;
    if(routeFromUrl.sub && routeFromUrl.page === "tax") initialTaxSub = routeFromUrl.sub;
    if(routeFromUrl.sub && routeFromUrl.page === "plan") initialPlanSub = routeFromUrl.sub;
    if(routeFromUrl.page === "settings") initialSettingsSub = routeFromUrl.sub || "people";
  } else {
    try{ initialPage = localStorage.getItem(PAGE_KEY) || "dashboard"; }catch(e){}
    // A page remembered from before v3.57.0 that is now a subpage.
    var legacyPage = { income: ["expenses", "income"], scenarios: ["plan", "scenarios"], projections: ["plan", "projections"] }[initialPage];
    if(legacyPage){
      initialPage = legacyPage[0];
      if(legacyPage[0] === "expenses") initialExpensesSub = legacyPage[1]; else initialPlanSub = legacyPage[1];
    }
    if(initialPage === "settings") initialSettingsSub = "people";
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
    showPage(route.page, { skipUrl: true });
    if(route.page === "assets") showAssetsSubpage(route.sub || "summary", { skipUrl: true });
    if(route.page === "expenses") showExpensesSubpage(route.sub || "budget", { skipUrl: true });
    if(route.page === "tax") showTaxSubpage(route.sub || taxSubpage(), { skipUrl: true });
    if(route.page === "plan") showPlanSubpage(route.sub || "scenarios", { skipUrl: true });
    if(route.page === "settings") showAccountsSubpage(route.sub || "people", { skipUrl: true });
  });

  function renderAll(){
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
    syncProjBasisControl();
    // Static copy, but rendered from the component that owns the parser it describes — see
    // renderBankImportHelp. Cheap enough to redo here rather than needing its own lifecycle.
    renderBankImportHelp();
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
    renderIncomeGroups();
    renderProperties();
    renderSharedGroups();
    renderAccounts();
    renderCategories();
    renderBudgetGroupByToggle();
    renderYearBasisPreference();
    renderTransactions();
    renderActualVsPlannedPanel();
    renderHomeBody();
    renderCards();
    renderDetail();
    renderBenchmarks();
    renderTotals();
    renderAssets();
    updatePersonSuggestions();
    updateAccountSuggestions();
    renderTaxSuper();
    renderTaxYear();
    renderPeopleTab();
    renderReceived();
    renderHealth();
    renderMonthReview();
    renderNotifBadge();
    renderPeriodButton();
    renderHomeSummary();
    renderReports();
    renderChecksBadge();
    renderSafekeeping();
    renderSavingsGoals();
    renderRecurring();
    renderTrips();
    renderRetirement();
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
  // A quiet weekly backup into the chosen folder, if the browser still allows it.
  // v3.71.0: first, is there a newer copy from another device in the folder? Then offer it, and
  // don't back up over the top of it until the person has chosen.
  newestFolderBackup(false).then(function(r){
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
      if(!trip2 || !confirm("Remove the trip \u201c" + trip2.name + "\u201d? Transactions already moved to its line stay there.")) return;
      state.trips = state.trips.filter(function(x){ return x.id !== id; });
      persist(); renderTrips();
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
  if(priceSheetDue()) setTimeout(function(){ readPriceSheetNow(false); }, 800);

  // ---------------- First-run setup (v3.74.0) ----------------
  // Offered once to an empty app; also from Home's setup card ("Guided setup"). Answers are held in
  // components/firstrun.js until Finish, so closing half-way writes nothing.
  var firstRunRoot = document.getElementById("firstRunRoot");
  function renderFirstRun(){ firstRunRoot.innerHTML = firstRun.open ? firstRunHtml() : ""; }
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
      o[path[path.length - 1]] = el.value;
    });
  }
  document.addEventListener("click", function(e){ if(e.target.closest("[data-firstrun-open]")) openFirstRun(); });
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
    return { u: unbudgetedRecurring(state.transactions, localDateStr()), r: risingLines(loggableBudgetLineItems(), state.transactions) };
  }
  function renderRecurring(){
    var el = document.getElementById("recurringBody");
    if(!el) return;
    var c = currentRecurring();
    el.innerHTML = recurringHtml(c.u, c.r);
    var n = c.u.filter(function(x){ return !recurringDismissed.keys["u:" + x.key]; }).length + c.r.filter(function(x){ return !recurringDismissed.keys["r:" + x.id + ":" + x.recent]; }).length;
    var cnt = document.getElementById("recurringCount");
    if(cnt) cnt.textContent = n ? n + " to look at" : "";
  }
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
    else showPage("accounts");
  });

  // ---------------- Accounts → Savings goals (v3.65.0) ----------------
  function renderSavingsGoals(){
    var el = document.getElementById("savingsGoalsBody");
    if(el) el.innerHTML = goalsSectionHtml(localDateStr(), scenarioTotals(state.activeScenario).netMonthly);
  }
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
  document.getElementById("reportsBody").addEventListener("click", function(e){
    var pick = e.target.closest("[data-report]");
    if(pick){ reportShown.key = pick.getAttribute("data-report"); renderReports(); return; }
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

  // ---------------- Home (v3.58.0): the summary's links and to-dos ----------------
  document.getElementById("homeSummary").addEventListener("click", function(e){
    if(e.target.closest("[data-goal-go]")){ showPage("accounts"); return; }
    var b = e.target.closest("[data-home-go]");
    if(!b) return;
    var go = b.getAttribute("data-home-go"), sub = b.getAttribute("data-home-sub"), fy = b.getAttribute("data-home-fy");
    if(go === "backup"){ var exp = document.getElementById("exportBtn"); if(exp) exp.click(); return; }
    if(go === "dashboard"){
      showDashboardSubpage(sub || "overview");
      if(sub === "review") renderMonthReview();
      var sn = document.getElementById("dashboardSubnav");
      if(sn) sn.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if(go === "settings"){ showAccountsSubpage(sub || "people"); if(sub === "checks") renderHealth(); return; }
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

  renderAll();
  initTableScrollShadows();
  showPage(initialPage, { replace: true, skipScroll: true });
  if(initialPage === "assets") showAssetsSubpage(initialAssetsSub, { replace: true });
  // Always applied, not just when landing on Expenses: showExpensesSubpage seeds the module's
  // currentExpensesSub, which buildRoutePath needs to be correct the first time the user
  // navigates *to* Expenses from somewhere else.
  showExpensesSubpage(initialExpensesSub, { skipUrl: initialPage !== "expenses", replace: true });
  // Same seeding for Tax, whose default tab depends on the time of year (nav.js defaultTaxSub).
  showTaxSubpage(initialTaxSub || taxSubpage(), { skipUrl: initialPage !== "tax", replace: true });
  showPlanSubpage(initialPlanSub, { skipUrl: initialPage !== "plan", replace: true });
  if(initialSettingsSub){ showAccountsSubpage(initialSettingsSub, { replace: true }); renderSettingsTab(initialSettingsSub); }

  // onboarding.html's "Try it with sample data" link lands here with ?mock=1 — generate it
  // immediately (no confirm needed, unlike the header's own Sample data button: there's nothing
  // to lose landing here for the first time) and strip the query param via replaceState so a
  // later reload or bookmark of this URL doesn't keep re-rolling random data.
  if(new URLSearchParams(location.search).get("mock") === "1"){
    setState(migrateState(generateMockData()));
    renderAll();
    persist();
    showToast("Sample data generated");
    history.replaceState(history.state, "", location.pathname + location.hash);
  }

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
