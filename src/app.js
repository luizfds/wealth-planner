import { state, setState, storageAvailable, persist, setStatus, defaultState, defaultPurchaseConfig, defaultInvestConfig, migrateState, genId, normalizeShareAsset } from "./state.js";
import { INCOME_COL_DEFS, PERIODS, sacrificeModeToLabel, sacrificeLabelToMode, TRANSFER_FEE_BY_STATE, MORTGAGE_REG_FEE_BY_STATE, INVEST_LEG_TYPES } from "./constants.js";
import { fmtCurrency0, fmtCurrency2 } from "./lib/format.js";
import { showToast, showUndoToast, showPersistentToast } from "./lib/toast.js";
import { escapeAttr, slug } from "./lib/html.js";
import { syncUiModeToggle, applyPeriodVisibility } from "./lib/uimode.js";
import { buildTable } from "./lib/ledger-table.js";
import { onHorizontalSwipe } from "./lib/swipe.js";
import {
  decryptBackup, doExport, exportIncomeCsv, exportExpensesCsv, exportAssetsCsv, exportPropertyLoansCsv, exportSharesPriceTemplateCsv, copySharesPriceTemplateToClipboard
} from "./lib/backup.js";
import { periodsOf, sumField, appendHistorySnapshot } from "./calc/ledger.js";
import { effectiveIncomeItems, getTaxPeople, personTaxSettings, computePersonTax } from "./calc/tax.js";
import { recalcComputedItems, scenarioTotals, totalNetWorthValue, totalDebtsValue } from "./calc/engine.js";
import { renderCards, renderDashboardStats, renderDetail, setProjectionReference, logNetWorthSnapshot } from "./components/dashboard.js";
import {
  personBreakdownHtml, renderIncomeGroups, patchOpenRowBreakdowns, patchIncomeGroupTotals,
  patchSyntheticIncomeRows, patchIncomeSuperNotes, renderTaxSuper, flipTaxCard, patchAllTaxPersonOutputs,
  modernIncomeRowOpen
} from "./components/income.js";
import {
  patchSharedGroupTotals, renderSharedGroups, renderPropertyExpensesSummary, modernSharedRowOpen,
  openScenarioOverridePanel, closeScenarioOverridePanel, renderScenarioOverridePanel,
  setScenarioOverride, resetScenarioOverride, copyScenarioAmountToAll,
  openExpenseReview, closeExpenseReview, renderExpenseReviewPanel,
  logCurrentReviewCard, skipCurrentReviewCard, expenseReview,
  renderTransactions, addTransaction, deleteTransaction, renderActualVsPlannedPanel,
  renderAccounts, addAccount, deleteAccount, renameAccountEverywhere, logExpenseTransaction
} from "./components/expenses.js";
import {
  patchHoldingRow, patchVehicleRow, modernAssetRowOpen, patchAssetCategoryTotals,
  renderNetWorthPanel, renderAssets, logAssetSnapshot, applySharesPaste, logDebtSnapshot,
  patchSharesGlance, setAssetPersonFilter, renderAssetPersonFilter
} from "./components/assets.js";
import {
  modernPropRowOpen, renderPropListModern, renderProperties, patchPropertyCardComputed,
  logPropertySnapshot
} from "./components/properties.js";
import { renderProjectionOutputs } from "./components/projections.js";
import {
  selectScenario, addScenario, renameScenario, deleteScenario, renderHomeBody, renderHomeListModern,
  renderHomeBodyTotalsOnly, homeBlockCollapsed, modernHomeRowOpen, patchHomeLoanRowIfSynced,
  patchCalcOutputs, afterCalcChange, patchInvestOutputs
} from "./components/scenarios.js";
import { showPage, parseRouteFromLocation, closeNavMenu, closeMobileMore, showAssetsSubpage, PAGE_KEY } from "./components/nav.js";

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

  var EXPENSE_COL_DEFS = [
    { key: "classification", label: "Classification" },
    { key: "account", label: "Account" }
  ];

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
      return { date: dt.toISOString().slice(0, 10), value: Math.round(qty * histPrice * 100) / 100 };
    });
  }
  function rndPick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

  function generateMockData(){
    var names = ["Alex", "Jordan", "Sam", "Taylor", "Morgan", "Casey", "Riley", "Jamie"];
    var personA = rndPick(names);
    var personB = rndPick(names.filter(function(n){ return n !== personA; }));
    var cities = ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Hobart"];
    var cityA = rndPick(cities);
    var cityB = rndPick(cities.filter(function(c){ return c !== cityA; }));
    var scenarios = ["Renting", "Buy " + cityA, "Buy " + cityB];

    var income = [
      { id:"mockIncomeA", what: personA + "'s Salary", classification:"", account:"Everyday Account", person: personA, incomeType:"Gross", amount: rndStep(6000, 13000, 50), freq:"Monthly" },
      { id:"mockIncomeB", what: personB + "'s Salary", classification:"", account:"Everyday Account", person: personB, incomeType:"Gross", amount: rndStep(4000, 10000, 50), freq:"Monthly" },
      { what: personA + "'s Bonus", classification:"", account:"Everyday Account", person: personA, incomeType:"Gross", amount: rndStep(2000, 20000, 500), freq:"Yearly", sacrificeMode: "percent", sacrificeValue: rndStep(0, 50, 10) }
    ];

    var shared = [
      { what:"Internet", classification:"Needs", account:"Everyday Account", amount: rndStep(60, 120, 5), freq:"Monthly" },
      { what:"Electricity", classification:"Needs", account:"Everyday Account", amount: rndStep(120, 280, 5), freq:"Monthly" },
      { what:"Gas", classification:"Needs", account:"Everyday Account", amount: rndStep(80, 220, 5), freq:"Quarterly" },
      { what:"Mobile Phones", classification:"Needs", account:"Credit Card", amount: rndStep(40, 120, 5), freq:"Monthly" },
      { what:"Health Insurance", classification:"Needs", account:"Credit Card", amount: rndStep(100, 260, 5), freq:"Monthly" },
      { what:"Streaming Subscriptions", classification:"Wants", account:"Credit Card", amount: rndStep(20, 60, 1), freq:"Monthly" },
      { what:"Gym Membership", classification:"Wants", account:"Credit Card", amount: rndStep(40, 100, 5), freq:"Fortnightly" },
      { what:"Car Insurance", classification:"Needs", account:"Credit Card", amount: rndStep(80, 200, 5), freq:"Monthly" },
      { what:"Car Rego", classification:"Needs", account:"Credit Card", amount: rndStep(400, 900, 10), freq:"Yearly" },
      { what:"Petrol", classification:"Needs", account:"Credit Card", amount: rndStep(100, 250, 5), freq:"Monthly" },
      { what:"Groceries", classification:"Needs", account:"Credit Card", amount: rndStep(150, 350, 5), freq:"Weekly" },
      { what:"Public Transport", classification:"Needs", account:"Credit Card", amount: rndStep(20, 60, 5), freq:"Weekly" },
      { what:"Eating Out", classification:"Wants", account:"Credit Card", amount: rndStep(80, 250, 5), freq:"Fortnightly" },
      { what:"Trips / Travel", classification:"Wants", account:"Credit Card", amount: rndStep(3000, 20000, 500), freq:"Yearly" },
      { what:"Pets", classification:"Wants", account:"Credit Card", amount: rndStep(30, 120, 5), freq:"Weekly" },
      { what:"Miscellaneous", classification:"Wants", account:"Credit Card", amount: rndStep(500, 2000, 50), freq:"Yearly" }
    ];

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

    return {
      activeScenario: "Renting",
      scenarios: scenarios,
      baselineScenario: "Renting",
      showAllPeriods: false,
      income: income,
      ip: [],
      shared: shared,
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
      assets: (function(){
        var h1Qty = rndStep(20, 150, 5), h1Price = rndStep(220, 320, 1), h1Cost = rndStep(180, 260, 1);
        var h2Qty = rndStep(5, 40, 1), h2Price = rndStep(150, 300, 1), h2Cost = rndStep(140, 280, 1);
        var h3Qty = rndStep(50, 300, 5), h3Price = rndStep(30, 90, 1), h3Cost = rndStep(35, 85, 1);
        return [
          { what:"Cash Savings", category:"Cash", amount: rndStep(5000, 90000, 500) },
          { what:"CSL Limited", category:"Shares", symbol:"CSL", market:"ASX", quantity:h1Qty, avgCost:h1Cost, price:h1Price, person:personA, priceUpdated:"", amount: Math.round(h1Qty * h1Price * 100) / 100, history: syntheticPriceHistory(h1Qty, h1Price) },
          { what:"Apple Inc", category:"Shares", symbol:"AAPL", market:"US", quantity:h2Qty, avgCost:h2Cost, price:h2Price, person:personB, priceUpdated:"", amount: Math.round(h2Qty * h2Price * 100) / 100, history: syntheticPriceHistory(h2Qty, h2Price) },
          { what:"Vanguard Australian Shares ETF", category:"Shares", symbol:"VAS", market:"ASX", quantity:h3Qty, avgCost:h3Cost, price:h3Price, person:"", priceUpdated:"", amount: Math.round(h3Qty * h3Price * 100) / 100, history: syntheticPriceHistory(h3Qty, h3Price) },
          { what:"Superannuation", category:"Super", person: personA, amount: rndStep(20000, 250000, 500) },
          { what:"Superannuation", category:"Super", person: personB, amount: rndStep(20000, 250000, 500) }
        ];
      })(),
      properties: (function(){
        var ipValue = rndStep(500000, 900000, 5000);
        var ipLoanBalance = Math.round(ipValue * rndBetween(0.6, 0.8));
        var ipRentWeekly = rndStep(450, 750, 10);
        return [{
          id: genId("p"), what: "48 Example St", kind: "IP", value: ipValue, history: [],
          pmFee: { percent: rndStep(5, 8, 0.5), flat: rndStep(0, 8, 0.5) },
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
      })(),
      projection: { horizonYears: 20, investReturnRate: 7, propertyAppreciationRate: 5, inflationRate: 3, rateShockPct: 0 },
      tax: { sgRate: 12, ipOwnership: {}, settings: {} }
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
        if(state.uiMode === "modern") renderHomeListModern(mHome[1], hi);
        else buildTable(document.getElementById("homeTable_" + slug(mHome[1]) + hi), section, state.home[mHome[1]], {showClass:true, acctColClass:"col-account-home"});
      }
      var mPropInc = /^propinc:(.+)$/.exec(section);
      if(mPropInc){
        var pi = findProperty(mPropInc[1]);
        if(pi){
          if(state.uiMode === "modern") renderPropListModern(pi.id, section, pi.income, false);
          else buildTable(document.getElementById("propIncomeTable_" + pi.id), section, pi.income, {showClass:false});
        }
      }
      var mPropExp = /^propexp:(.+)$/.exec(section);
      if(mPropExp){
        var pe = findProperty(mPropExp[1]);
        if(pe){
          if(state.uiMode === "modern") renderPropListModern(pe.id, section, pe.expenses, true);
          else buildTable(document.getElementById("propExpTable_" + pe.id), section, pe.expenses, {showClass:true, hideAcctToggle:true, hideClassToggle:true});
        }
      }
    }
    applyPeriodVisibility();
  }


  function renderTotals(){
    document.getElementById("totalIncomeMonthly").textContent = fmtCurrency2.format(sumField(effectiveIncomeItems(), "monthly"));
    document.getElementById("totalSharedMonthly").textContent = fmtCurrency2.format(sumField(state.shared, "monthly"));
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
    if(e.target.classList.contains("f-what")){
      item.what = e.target.value;
      var nameEl = tr.querySelector(".m-row-name");
      if(nameEl) nameEl.textContent = item.what;
    }
    else if(e.target.classList.contains("f-account")) item.account = e.target.value;
    else if(e.target.classList.contains("f-class")){ item.classification = e.target.value; if(section === "shared") structural = true; }
    else if(e.target.classList.contains("f-freq")) item.freq = e.target.value;
    else if(e.target.classList.contains("f-amount")) item.amount = parseFloat(e.target.value) || 0;
    else if(e.target.classList.contains("f-person")){ item.person = e.target.value; structural = true; }
    else if(e.target.classList.contains("f-incometype")){ item.incomeType = e.target.value; structural = true; }
    else if(e.target.classList.contains("f-superincluded")){ item.superMode = e.target.value; }
    else if(e.target.classList.contains("f-sacrificemode")){ item.sacrificeMode = sacrificeLabelToMode(e.target.value); structural = true; }
    else if(e.target.classList.contains("f-sacrificevalue")){ item.sacrificeValue = parseFloat(e.target.value) || 0; }
    else return;

    if(e.target.classList.contains("f-amount") || e.target.classList.contains("f-freq")){
      var cells = tr.querySelectorAll("td.computed");
      var p = periodsOf(item.amount, item.freq);
      PERIODS.forEach(function(pd, i){ if(cells[i]) cells[i].textContent = fmtCurrency2.format(p[pd.key]); });
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

    if(section === "income" && structural){
      rerenderTableFor("income");
      updatePersonSuggestions();
    } else if(section === "income"){
      patchSyntheticIncomeRows();
      patchIncomeGroupTotals();
      patchOpenRowBreakdowns();
    } else if(section === "shared" && structural){
      rerenderTableFor("shared");
    } else if(section === "shared"){
      patchSharedGroupTotals();
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
      openScenarioOverridePanel(Number(varyBtn.getAttribute("data-vary-scenario")));
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
        if(logBtn2.hasAttribute("data-log-tx")){
          // Shared expenses: "Log" records a transaction against this budget line instead of a
          // value snapshot — the plan (amount/freq) itself is untouched. See
          // logExpenseTransaction() in expenses.js for why.
          var amountInput = dateInput && dateInput.previousElementSibling;
          var logAmount = (amountInput && amountInput.classList.contains("log-amount")) ? (parseFloat(amountInput.value) || 0) : (Number(litem.amount) || 0);
          var tx = logExpenseTransaction(litem, logAmount, logDate);
          rerenderTableFor(lsection);
          renderTransactions();
          renderActualVsPlannedPanel();
          persist();
          showToast("Logged " + fmtCurrency0.format(logAmount) + " against " + litem.what + " (" + tx.date + ")");
        } else {
          if(!Array.isArray(litem.history)) litem.history = [];
          var ldate = appendHistorySnapshot(litem.history, Number(litem.amount) || 0, logDate);
          rerenderTableFor(lsection);
          renderProjectionOutputs();
          persist();
          showToast("Logged " + fmtCurrency0.format(Number(litem.amount) || 0) + " for " + litem.what + " (" + ldate + ")");
        }
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
    renderProjectionOutputs();
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
  pairSlider("projRateShock", "projRateShockRange");


  // ---------------- Tax & super ----------------
  function renameTaxPerson(oldName){
    var name = prompt("Rename this person (updates every income row):", oldName);
    if(name === null) return;
    name = name.trim();
    if(!name || name === oldName) return;
    if(getTaxPeople().indexOf(name) !== -1){ showToast('"' + name + '" already exists'); return; }
    state.income.forEach(function(i){ if(i.person === oldName) i.person = name; });
    if(state.tax.settings[oldName]){ state.tax.settings[name] = state.tax.settings[oldName]; delete state.tax.settings[oldName]; }
    if(state.tax.ipOwnership && state.tax.ipOwnership[oldName] != null){ state.tax.ipOwnership[name] = state.tax.ipOwnership[oldName]; delete state.tax.ipOwnership[oldName]; }
    recalcComputedItems();
    rerenderTableFor("income");
    updatePersonSuggestions();
    renderTaxSuper();
    renderCards();
    renderDetail();
    renderTotals();
    renderProjectionOutputs();
    persist();
  }

  function removeTaxPerson(name){
    if(!confirm('Remove "' + name + '" from Tax & Super? Their income rows go back to Type "Net" (counted as-is, at face value) and keep their current amounts.')) return;
    state.income.forEach(function(i){ if(i.person === name){ i.incomeType = "Net"; i.person = ""; } });
    delete state.tax.settings[name];
    if(state.tax.ipOwnership) delete state.tax.ipOwnership[name];
    recalcComputedItems();
    rerenderTableFor("income");
    updatePersonSuggestions();
    renderTaxSuper();
    renderCards();
    renderDetail();
    renderTotals();
    renderProjectionOutputs();
    persist();
  }

  document.getElementById("taxSuperBody").addEventListener("click", function(e){
    var renameBtn = e.target.closest("[data-tax-rename]");
    if(renameBtn){ renameTaxPerson(renameBtn.getAttribute("data-tax-rename")); return; }
    var removeBtn = e.target.closest("[data-tax-remove]");
    if(removeBtn){ removeTaxPerson(removeBtn.getAttribute("data-tax-remove")); return; }
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
      if(t.classList.contains("tax-ipshare")){
        if(!state.tax.ipOwnership) state.tax.ipOwnership = {};
        state.tax.ipOwnership[person] = parseFloat(t.value) || 0;
      } else if(t.classList.contains("tax-sacrifice")) settings.superSacrificeAnnual = parseFloat(t.value) || 0;
      else if(t.classList.contains("tax-cap")) settings.concessionalCap = parseFloat(t.value) || 0;
      else if(t.classList.contains("tax-carryforward")) settings.carryForward = parseFloat(t.value) || 0;
      else return;
    } else if(e.target.id === "taxSgRate"){
      state.tax.sgRate = parseFloat(e.target.value) || 0;
    } else return;

    recalcComputedItems();
    patchSyntheticIncomeRows();
    patchIncomeGroupTotals();
    patchOpenRowBreakdowns();
    patchAllTaxPersonOutputs();
    patchIncomeSuperNotes();
    renderCards();
    renderDetail();
    renderTotals();
    renderProjectionOutputs();
    persist();
  });

  document.getElementById("homeBody").addEventListener("input", onCalcInput);
  document.getElementById("homeBody").addEventListener("change", onCalcChange);
  document.getElementById("homeBody").addEventListener("click", onCalcClick);
  document.getElementById("homeBody").addEventListener("input", onInvestInput);
  document.getElementById("homeBody").addEventListener("change", onInvestChange);

  document.addEventListener("input", function(e){
    if(e.target.closest("table.assets-table, .m-asset-rows")){
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
      else if(e.target.classList.contains("h-avgcost")){
        item.avgCost = e.target.value === "" ? null : (parseFloat(e.target.value) || 0);
        patchHoldingRow(tr, item);
        patchSharesGlance();
      }
      else if(e.target.classList.contains("h-price")){
        item.price = parseFloat(e.target.value) || 0;
        item.priceUpdated = new Date().toISOString().slice(0, 10);
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
    if(e.target.closest("table.assets-table, .m-asset-rows") && e.target.classList.contains("a-category")){
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
    if(e.target.closest("table.assets-table, .m-asset-rows") && e.target.classList.contains("h-market")){
      var htr = e.target.closest("[data-index]");
      if(!htr) return;
      var hidx = Number(htr.getAttribute("data-index"));
      if(state.assets[hidx]){ state.assets[hidx].market = e.target.value; persist(); }
    }
    if(e.target.closest("table.assets-table, .m-asset-rows") &&
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
    var logBtn = e.target.closest("[data-asset-log]");
    if(logBtn){ logAssetSnapshot(Number(logBtn.getAttribute("data-asset-log"))); return; }
    if(e.target.id === "sharesPasteApply") applySharesPaste();
    if(e.target.id === "sharesExportPriceTemplateBtn") exportSharesPriceTemplateCsv();
    if(e.target.id === "sharesCopyPriceTemplateBtn") copySharesPriceTemplateToClipboard();
    var personFilterBtn = e.target.closest("[data-asset-person-filter]");
    if(personFilterBtn){ setAssetPersonFilter(personFilterBtn.getAttribute("data-asset-person-filter")); return; }
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
      else if(e.target.classList.contains("loan-balance")) loan.balance = parseFloat(e.target.value) || 0;
      else if(e.target.classList.contains("loan-rate")) loan.rate = parseFloat(e.target.value) || 0;
      else if(e.target.classList.contains("loan-term")) loan.termYears = parseFloat(e.target.value) || 0;
      else if(e.target.classList.contains("loan-manual-amount")) loan.manualRepaymentAmount = parseFloat(e.target.value) || 0;
      else if(e.target.classList.contains("loan-offset")) loan.offsetBalance = parseFloat(e.target.value) || 0;
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
    }
  });

  document.getElementById("propertiesBody").addEventListener("click", function(e){
    var addLoanBtn = e.target.closest("[data-loan-add]");
    if(addLoanBtn){
      var forProperty = findProperty(addLoanBtn.getAttribute("data-loan-add"));
      if(forProperty){
        forProperty.loans.push({ id: genId("l"), what:"New loan", balance:0, rate:0, termYears:30, repaymentType:"PI", repaymentMode:"auto", manualRepaymentAmount:0, manualRepaymentFreq:"Monthly", offsetBalance:0 });
        renderProperties();
        renderProjectionOutputs();
        persist();
      }
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

  document.getElementById("addPropertyBtn").addEventListener("click", function(){
    state.properties.push({ id: genId("p"), what:"New property", kind:"IP", value:0, history:[], pmFee:{percent:6, flat:5.5}, loans:[], income:[], expenses:[] });
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

  // Modern rows (Income and Expenses both) expand in place instead of showing every field at
  // once — purely a UI toggle, doesn't touch state.
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
      var willOpen = !row.classList.contains("open");
      row.classList.toggle("open", willOpen);
      openState[key] = willOpen;
    });
    container.addEventListener("keydown", function(e){
      if(e.key !== "Enter" && e.key !== " ") return;
      var toggle = e.target.closest("[data-row-toggle]");
      if(!toggle) return;
      e.preventDefault();
      toggle.click();
    });
  }
  wireModernRowToggle("incomeGroups", modernIncomeRowOpen);
  wireModernRowToggle("sharedGroups", modernSharedRowOpen);

  // ---------------- Shared expenses: per-scenario override panel ----------------
  document.getElementById("scenarioOverrideRoot").addEventListener("click", function(e){
    if(e.target.closest("[data-override-close]") || e.target === e.target.closest("[data-override-backdrop]")){
      closeScenarioOverridePanel();
      return;
    }
    var backdrop = e.target.closest("[data-override-backdrop]");
    if(!backdrop) return;
    var idx = Number(backdrop.getAttribute("data-override-idx"));
    var resetBtn = e.target.closest("[data-override-reset]");
    if(resetBtn){
      resetScenarioOverride(idx, resetBtn.getAttribute("data-override-reset"));
      refreshAfterLedgerChange("shared");
      renderScenarioOverridePanel();
      return;
    }
    var useBtn = e.target.closest("[data-override-use-everywhere]");
    if(useBtn){
      copyScenarioAmountToAll(idx, useBtn.getAttribute("data-override-use-everywhere"));
      refreshAfterLedgerChange("shared");
      renderScenarioOverridePanel();
      return;
    }
  });
  document.getElementById("scenarioOverrideRoot").addEventListener("change", function(e){
    var input = e.target.closest(".scen-override-input");
    if(!input) return;
    var backdrop = e.target.closest("[data-override-backdrop]");
    if(!backdrop) return;
    var idx = Number(backdrop.getAttribute("data-override-idx"));
    var scenarioName = input.getAttribute("data-override-scenario");
    setScenarioOverride(idx, scenarioName, parseFloat(input.value) || 0);
    refreshAfterLedgerChange("shared");
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
  if(reviewBtn) reviewBtn.addEventListener("click", openExpenseReview);
  document.getElementById("expenseReviewRoot").addEventListener("click", function(e){
    if(e.target.closest("[data-review-close]") || e.target === e.target.closest("[data-review-backdrop]")){
      closeExpenseReview();
      return;
    }
    if(e.target.closest("[data-review-skip]")){ performReviewSkip(); return; }
    if(e.target.closest("[data-review-log]")){ performReviewLog(); return; }
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    if(document.querySelector("[data-review-backdrop]")) closeExpenseReview();
  });
  onHorizontalSwipe(document.getElementById("expenseReviewRoot"), {
    onSwipeLeft: performReviewSkip,
    onSwipeRight: performReviewLog
  });

  // ---------------- Transactions: real dated spend, separate from the planned budget ----------------
  document.getElementById("addTransactionBtn").addEventListener("click", addTransaction);
  document.addEventListener("click", function(e){
    var delTxBtn = e.target.closest("[data-tx-del]");
    if(delTxBtn){ deleteTransaction(Number(delTxBtn.getAttribute("data-tx-del"))); return; }
  });
  document.addEventListener("input", function(e){
    if(!e.target.closest("#transactionsTable")) return;
    var idx = Number(e.target.getAttribute("data-tx-index"));
    var t = state.transactions[idx];
    if(!t) return;
    if(e.target.classList.contains("tx-what")) t.what = e.target.value;
    else if(e.target.classList.contains("tx-amount")){
      t.amount = parseFloat(e.target.value) || 0;
      var totalEl = document.getElementById("totalTransactionsAmount");
      if(totalEl) totalEl.textContent = fmtCurrency0.format(state.transactions.reduce(function(s, x){ return s + (Number(x.amount) || 0); }, 0));
    }
    else if(e.target.classList.contains("tx-link")) t.linkedExpenseId = e.target.value || null;
    else if(e.target.classList.contains("tx-account")){
      t.account = e.target.value || "";
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
  document.getElementById("addAccountBtn").addEventListener("click", function(){ addAccount(); updateAccountSuggestions(); });
  document.addEventListener("click", function(e){
    var delAcctBtn = e.target.closest("[data-acct-del]");
    if(delAcctBtn){ deleteAccount(Number(delAcctBtn.getAttribute("data-acct-del"))); updateAccountSuggestions(); return; }
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
      a.type = e.target.value === "credit" ? "credit" : "debit";
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
    else return;
    renderActualVsPlannedPanel();
    persist();
  });

  wireModernRowToggle("propertiesBody", modernPropRowOpen);
  wireModernRowToggle("homeBody", modernHomeRowOpen);
  ["Cash", "Shares", "Super", "Vehicle", "Other"].forEach(function(cat){
    wireModernRowToggle("assetsSub-" + cat, modernAssetRowOpen);
  });

  // state.uiMode is a single global preference, not per-page — switching it has to refresh every
  // page that has a modern layout, or the others sit stale (still showing the old mode's content
  // and controls, like a Classic-mode-only "Columns" picker) until something else re-renders them.
  function refreshAllUiModePages(){
    renderIncomeGroups();
    renderTaxSuper();
    renderSharedGroups();
    renderAccounts();
    renderTransactions();
    renderPropertyExpensesSummary();
    renderProperties();
    renderAssets();
    renderHomeBody();
  }
  // One switch in the sidebar (desktop) — the five separate per-page segmented toggles this used
  // to be were redundant duplicates of the same global setting, crowding each page's intro row.
  document.getElementById("uiModeToggle").addEventListener("change", function(e){
    state.uiMode = e.target.checked ? "modern" : "classic";
    refreshAllUiModePages();
    syncUiModeToggle();
    persist();
  });
  // Mobile's equivalent — a cycling button instead of a switch, matching the Theme button's
  // interaction right above it in the same More panel.
  document.getElementById("mobileLayoutBtn").addEventListener("click", function(){
    state.uiMode = state.uiMode === "modern" ? "classic" : "modern";
    refreshAllUiModePages();
    syncUiModeToggle();
    persist();
    closeMobileMore();
  });

  function onScenarioControlClick(e){
    // More specific controls first — data-rename/data-delete/data-edit-scenario2 all live
    // *inside* the now-clickable .home-block-head (data-collapse-toggle), so that catch-all has
    // to be checked last or it would swallow clicks meant for the buttons nested inside it.
    var renameBtn = e.target.closest("[data-rename]");
    if(renameBtn){ renameScenario(renameBtn.getAttribute("data-rename")); return true; }
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
    var cardSel = e.target.closest(".card-select");
    if(cardSel) selectScenario(cardSel.getAttribute("data-scenario"));
  });
  document.getElementById("cards").addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    var cardSel = e.target.closest(".card-select");
    if(cardSel){ e.preventDefault(); selectScenario(cardSel.getAttribute("data-scenario")); }
  });
  document.getElementById("homeBody").addEventListener("click", onScenarioControlClick);
  document.getElementById("homeBody").addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    var collapseBtn = e.target.closest("[data-collapse-toggle]");
    if(!collapseBtn) return;
    e.preventDefault();
    collapseBtn.click();
  });

  document.addEventListener("click", function(e){
    var addBtn = e.target.closest("[data-add]");
    if(!addBtn) return;
    var raw = addBtn.getAttribute("data-add");
    var section, groupValue;
    if(raw.indexOf("home:") === 0){
      section = raw; groupValue = null;
    } else {
      var colonIdx = raw.indexOf(":");
      section = colonIdx === -1 ? raw : raw.slice(0, colonIdx);
      groupValue = colonIdx === -1 ? null : raw.slice(colonIdx + 1);
    }
    if(section === "assets"){
      state.assets.push({ what:"New asset", category: groupValue != null ? groupValue : "Cash", amount:0 });
      renderAssets();
      persist();
      return;
    }
    if(section === "holding"){
      state.assets.push({ what:"New holding", category:"Shares", symbol:"", market:"ASX", quantity:0, avgCost:null, price:0, priceUpdated:"", person: groupValue != null ? groupValue : "", amount:0 });
      renderAssets();
      persist();
      return;
    }
    if(section === "vehicle"){
      state.assets.push({ what:"New vehicle", category:"Vehicle", purchasePrice:0, purchaseDate:"", depreciationRate:15, amount:0 });
      recalcComputedItems();
      renderAssets();
      persist();
      return;
    }
    var arr = getArrayForSection(section);
    if(!arr) return;
    var showClass = section !== "income" && section.indexOf("propinc:") !== 0;
    var newItem = { what:"New item", classification: showClass ? (groupValue != null ? groupValue : "Needs") : "", account:"", amount:0, freq:"Monthly" };
    if(section === "income"){ newItem.person = groupValue != null ? groupValue : ""; newItem.incomeType = "Net"; }
    arr.push(newItem);
    rerenderTableFor(section);
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

  // Both checkboxes (desktop sidebar + mobile More panel) toggle themselves natively and just
  // mirror the other's .checked by plain assignment on change — a preventDefault-and-forward
  // approach doesn't work here, since the browser reverts a checkbox's own checked state after
  // preventDefault() regardless of what a same-tick listener sets it to.
  document.getElementById("periodsToggle").addEventListener("change", function(e){
    state.showAllPeriods = e.target.checked;
    applyPeriodVisibility();
    persist();
    document.getElementById("mobilePeriodsToggle").checked = e.target.checked;
  });
  document.getElementById("mobilePeriodsToggle").addEventListener("change", function(e){
    state.showAllPeriods = e.target.checked;
    applyPeriodVisibility();
    persist();
    document.getElementById("periodsToggle").checked = e.target.checked;
  });
  // Keeps the More panel open on this toggle specifically — it's a preference to sit and watch
  // take effect, not a one-off action like the buttons above it that close the panel on click.
  document.getElementById("mobilePeriodsToggleWrap").addEventListener("click", function(e){ e.stopPropagation(); });

  document.getElementById("homeAcctToggle").addEventListener("change", function(e){
    state.homeCols.account = e.target.checked;
    applyPeriodVisibility();
    persist();
  });

  var colPickers = [];
  function setupColPicker(btnId, panelId, colDefs, stateKey){
    var btn = document.getElementById(btnId);
    var panel = document.getElementById(panelId);
    if(!btn || !panel) return function(){};
    function render(){
      panel.innerHTML = colDefs.map(function(c){
        var checked = state[stateKey][c.key] !== false;
        return '<label class="col-picker-row"><input type="checkbox" class="col-picker-check" data-col-key="' + c.key + '"' + (checked ? " checked" : "") + '>' + escapeAttr(c.label) + '</label>';
      }).join("");
    }
    render();
    btn.addEventListener("click", function(e){
      e.stopPropagation();
      var willOpen = panel.hidden;
      colPickers.forEach(function(p){ if(p.panel !== panel){ p.panel.hidden = true; p.btn.setAttribute("aria-expanded", "false"); } });
      panel.hidden = !willOpen;
      btn.setAttribute("aria-expanded", String(willOpen));
      if(willOpen) render();
    });
    panel.addEventListener("click", function(e){ e.stopPropagation(); });
    panel.addEventListener("change", function(e){
      if(!e.target.classList.contains("col-picker-check")) return;
      state[stateKey][e.target.getAttribute("data-col-key")] = e.target.checked;
      applyPeriodVisibility();
      persist();
    });
    colPickers.push({ btn: btn, panel: panel });
    return render;
  }
  document.addEventListener("click", function(){
    colPickers.forEach(function(p){
      if(!p.panel.hidden){ p.panel.hidden = true; p.btn.setAttribute("aria-expanded", "false"); }
    });
  });
  var renderIncomeColPicker = setupColPicker("incomeColPickerBtn", "incomeColPickerPanel", INCOME_COL_DEFS, "incomeCols");
  var renderExpenseColPicker = setupColPicker("expenseColPickerBtn", "expenseColPickerPanel", EXPENSE_COL_DEFS, "expenseCols");

  document.getElementById("incomeExportCsvBtn").addEventListener("click", exportIncomeCsv);
  document.getElementById("expenseExportCsvBtn").addEventListener("click", exportExpensesCsv);
  document.getElementById("assetsExportCsvBtn").addEventListener("click", exportAssetsCsv);
  document.getElementById("propertyLoansExportCsvBtn").addEventListener("click", exportPropertyLoansCsv);

  document.getElementById("exportBtn").addEventListener("click", doExport);
  document.getElementById("exportLink2").addEventListener("click", doExport);

  document.getElementById("importBtn").addEventListener("click", function(){
    document.getElementById("importFile").click();
  });
  function applyImportedBackupJson(jsonStr){
    try{
      var parsed = JSON.parse(jsonStr);
      if(!parsed || !parsed.income || !parsed.home) throw new Error("bad shape");
      setState(migrateState(parsed));
      renderAll();
      persist();
      showToast("Backup imported");
    }catch(err){
      showToast("That file doesn't look like a valid backup");
    }
  }
  document.getElementById("importFile").addEventListener("change", function(e){
    var file = e.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      var raw = reader.result, envelope;
      try{ envelope = JSON.parse(raw); }catch(err){ showToast("That file doesn't look like a valid backup"); return; }
      if(envelope && envelope.wealthPlannerEncrypted){
        var passphrase = prompt("This backup is encrypted. Enter its passphrase to unlock it:");
        if(passphrase == null) return;
        decryptBackup(envelope, passphrase).then(function(plainStr){
          applyImportedBackupJson(plainStr);
        }).catch(function(){
          showToast("Wrong passphrase, or this backup is corrupted.");
        });
      } else {
        applyImportedBackupJson(raw);
      }
    };
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

  document.getElementById("mockDataBtn").addEventListener("click", function(){
    if(!confirm("Fill in randomised sample data so you can try the tool? This replaces everything currently entered — export a backup first if you want to keep it.")) return;
    setState(migrateState(generateMockData()));
    renderAll();
    persist();
    showToast("Sample data generated");
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

  // Mirrors the sidebar footer's version text into the mobile "More" panel, which is the only
  // place a mobile viewport (<880px, where .app-version is hidden) can see it.
  document.getElementById("mobileMoreVersion").textContent = document.querySelector(".app-version").textContent;

  // The utility actions (Theme/Import/Export/Sample data/Reset) live in .actions on desktop,
  // hidden on mobile in favor of the bottom tab bar — these forward to the same real buttons
  // rather than duplicating their logic, so behavior (confirms, dialogs, label state) matches
  // exactly with nothing to keep in sync beyond the label mirrors above.
  [
    ["mobileThemeBtn", "themeToggleBtn"],
    ["mobileImportBtn", "importBtn"],
    ["mobileExportBtn", "exportBtn"],
    ["mobileSampleDataBtn", "mockDataBtn"],
    ["mobileResetBtn", "resetBtn"]
  ].forEach(function(pair){
    document.getElementById(pair[0]).addEventListener("click", function(){
      closeMobileMore();
      document.getElementById(pair[1]).click();
    });
  });

  document.getElementById("assetsSubnav").addEventListener("click", function(e){
    var btn = e.target.closest("[data-assets-sub]");
    if(!btn) return;
    showAssetsSubpage(btn.getAttribute("data-assets-sub"));
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
  if(routeFromUrl){
    initialPage = routeFromUrl.page;
    if(routeFromUrl.sub) initialAssetsSub = routeFromUrl.sub;
  } else {
    try{ initialPage = localStorage.getItem(PAGE_KEY) || "dashboard"; }catch(e){}
  }

  window.addEventListener("popstate", function(){
    var route = parseRouteFromLocation() || { page: "dashboard", sub: null };
    showPage(route.page, { skipUrl: true });
    if(route.page === "assets") showAssetsSubpage(route.sub || "summary", { skipUrl: true });
  });

  function renderAll(){
    document.getElementById("periodsToggle").checked = !!state.showAllPeriods;
    document.getElementById("mobilePeriodsToggle").checked = !!state.showAllPeriods;
    document.getElementById("homeAcctToggle").checked = !!state.homeCols.account;
    renderIncomeColPicker();
    renderExpenseColPicker();
    document.getElementById("projHorizon").value = state.projection.horizonYears;
    document.getElementById("projInvestRate").value = state.projection.investReturnRate;
    document.getElementById("projInvestRateRange").value = state.projection.investReturnRate;
    document.getElementById("projPropertyRate").value = state.projection.propertyAppreciationRate;
    document.getElementById("projPropertyRateRange").value = state.projection.propertyAppreciationRate;
    document.getElementById("projInflationRate").value = state.projection.inflationRate;
    document.getElementById("projInflationRateRange").value = state.projection.inflationRate;
    document.getElementById("projRateShock").value = state.projection.rateShockPct;
    document.getElementById("projRateShockRange").value = state.projection.rateShockPct;
    recalcComputedItems();
    renderIncomeGroups();
    renderProperties();
    renderSharedGroups();
    renderAccounts();
    renderTransactions();
    renderActualVsPlannedPanel();
    renderHomeBody();
    renderCards();
    renderDetail();
    renderTotals();
    renderAssets();
    updatePersonSuggestions();
    updateAccountSuggestions();
    renderTaxSuper();
    applyPeriodVisibility();
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
  document.addEventListener("change", renderGlobalMetrics);

  renderAll();
  showPage(initialPage, { replace: true, skipScroll: true });
  if(initialPage === "assets") showAssetsSubpage(initialAssetsSub, { replace: true });

  // Matching #appLoading's inline styles in index.html — fades out only once the real UI above
  // has actually been built, not on a fixed timer, so a slow first load (cold cache, slow device)
  // keeps the loading screen up for exactly as long as it's needed and no longer.
  var appLoadingEl = document.getElementById("appLoading");
  if(appLoadingEl){
    appLoadingEl.classList.add("is-hidden");
    setTimeout(function(){ appLoadingEl.remove(); }, 300);
  }
})();

// ---------------- Update detection ----------------
// sw.js's own script rarely changes between releases (this app has no fixed precache list, so
// most version bumps only touch app.js/CSS/index.html) — the browser's built-in service-worker
// update check only re-installs a worker when sw.js's own bytes differ, so relying on that alone
// would miss the common case entirely. Polling index.html's own <p class="app-version"> instead
// catches every release, regardless of what changed.
var CURRENT_APP_VERSION = (function(){
  var el = document.querySelector(".app-version");
  return el ? el.textContent.trim() : "";
})();
var updateBannerShown = false;
function announceUpdateAvailable(newVersion){
  if(updateBannerShown) return;
  updateBannerShown = true;
  var msg = newVersion ? ("A new version (" + newVersion + ") is available") : "A new version is available";
  showPersistentToast(msg, "Reload", function(){ window.location.reload(); });
}
function checkForNewVersion(){
  // A relative fetch resolves against the document's own URL, so this lands on the right
  // index.html whether served from domain root (local dev) or a GitHub Pages project subpath —
  // same reasoning as nav.js's BASE_PATH — even from a pushState'd path like /properties.
  // cache:"no-store" bypasses the browser's HTTP cache, same reasoning as sw.js's own fetch.
  fetch("index.html", { cache: "no-store" }).then(function(r){ return r.text(); }).then(function(html){
    var match = html.match(/<p class="app-version">([^<]*)<\/p>/);
    var latest = match ? match[1].trim() : "";
    if(latest && CURRENT_APP_VERSION && latest !== CURRENT_APP_VERSION) announceUpdateAvailable(latest);
  }).catch(function(){ /* offline, or the request was blocked — next check will just retry */ });
}
// Cheap enough to run whenever the tab regains focus (the common "came back after a while" case)
// plus a periodic fallback for a tab that's simply left open and never loses focus.
document.addEventListener("visibilitychange", function(){
  if(document.visibilityState === "visible") checkForNewVersion();
});
setInterval(checkForNewVersion, 30 * 60 * 1000);

// Registered from the page's own origin/path, so this resolves correctly whether served from
// domain root (local dev) or a GitHub Pages project subpath — same reasoning as nav.js's BASE_PATH.
if("serviceWorker" in navigator){
  var hadControllerAtLoad = !!navigator.serviceWorker.controller;
  window.addEventListener("load", function(){
    navigator.serviceWorker.register("sw.js").catch(function(){});
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
