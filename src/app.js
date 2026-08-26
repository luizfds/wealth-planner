import { state, setState, storageAvailable, persist, setStatus, defaultState, defaultPurchaseConfig, migrateState, genId } from "./state.js";
import { INCOME_COL_DEFS, PERIODS, sacrificeModeToLabel, sacrificeLabelToMode } from "./constants.js";
import { fmtCurrency0, fmtCurrency2 } from "./lib/format.js";
import { showToast, showUndoToast } from "./lib/toast.js";
import { escapeAttr, slug } from "./lib/html.js";
import { syncUiModeToggle, applyPeriodVisibility } from "./lib/uimode.js";
import { buildTable } from "./lib/ledger-table.js";
import { periodsOf, sumField } from "./calc/ledger.js";
import { effectiveIncomeItems, getTaxPeople, personTaxSettings, computePersonTax } from "./calc/tax.js";
import { recalcComputedItems, scenarioTotals, totalNetWorthValue } from "./calc/engine.js";
import { renderCards, renderDashboardStats, renderDetail } from "./components/dashboard.js";
import {
  personBreakdownHtml, renderIncomeGroups, patchOpenRowBreakdowns, patchIncomeGroupTotals,
  patchSyntheticIncomeRows, patchIncomeSuperNotes, renderTaxSuper, flipTaxCard, patchAllTaxPersonOutputs,
  modernIncomeRowOpen
} from "./components/income.js";
import {
  patchSharedGroupTotals, renderSharedGroups, renderPropertyExpensesSummary, modernSharedRowOpen
} from "./components/expenses.js";
import {
  patchHoldingRow, patchVehicleRow, modernAssetRowOpen, patchAssetCategoryTotals,
  renderNetWorthPanel, renderAssets, logAssetSnapshot, applySharesPaste
} from "./components/assets.js";
import {
  modernPropRowOpen, renderPropListModern, renderProperties, patchPropertyCardComputed,
  logPropertySnapshot
} from "./components/properties.js";
import { renderProjectionOutputs } from "./components/projections.js";
import {
  selectScenario, addScenario, renameScenario, deleteScenario, renderHomeBody, renderHomeListModern,
  renderHomeBodyTotalsOnly, homeBlockCollapsed, modernHomeRowOpen, patchHomeLoanRowIfSynced,
  patchCalcOutputs, afterCalcChange
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
          { what:"CSL Limited", category:"Shares", symbol:"CSL", market:"ASX", quantity:h1Qty, avgCost:h1Cost, price:h1Price, person:personA, priceUpdated:"", amount: Math.round(h1Qty * h1Price * 100) / 100 },
          { what:"Apple Inc", category:"Shares", symbol:"AAPL", market:"US", quantity:h2Qty, avgCost:h2Cost, price:h2Price, person:personB, priceUpdated:"", amount: Math.round(h2Qty * h2Price * 100) / 100 },
          { what:"Vanguard Australian Shares ETF", category:"Shares", symbol:"VAS", market:"ASX", quantity:h3Qty, avgCost:h3Cost, price:h3Price, person:"", priceUpdated:"", amount: Math.round(h3Qty * h3Price * 100) / 100 },
          { what:"Superannuation", category:"Super", amount: rndStep(20000, 250000, 500) }
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
    if(e.target.classList.contains("f-what")) item.what = e.target.value;
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
    if(t.classList.contains("calc-enabled")) cfg.enabled = t.checked;
    else if(t.classList.contains("calc-state")) cfg.state = t.value;
    else if(t.classList.contains("calc-fhb")) cfg.firstHomeBuyer = t.checked;
    else if(t.classList.contains("calc-sync")) cfg.syncRepayment = t.checked;
    else if(t.classList.contains("calc-repaymenttype")) cfg.repaymentType = t.value;
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

  document.addEventListener("input", function(e){
    if(e.target.closest("table.assets-table, .m-asset-rows")){
      var tr = e.target.closest("[data-index]");
      if(!tr) return;
      var idx = Number(tr.getAttribute("data-index"));
      var item = state.assets[idx];
      if(!item) return;
      if(e.target.classList.contains("a-what")) item.what = e.target.value;
      else if(e.target.classList.contains("a-amount")) item.amount = parseFloat(e.target.value) || 0;
      else if(e.target.classList.contains("h-what")) item.what = e.target.value;
      else if(e.target.classList.contains("h-symbol")) item.symbol = e.target.value;
      else if(e.target.classList.contains("h-qty")){
        item.quantity = parseFloat(e.target.value) || 0;
        item.amount = Math.round(item.quantity * (Number(item.price) || 0) * 100) / 100;
        patchHoldingRow(tr, item);
      }
      else if(e.target.classList.contains("h-avgcost")){
        item.avgCost = e.target.value === "" ? null : (parseFloat(e.target.value) || 0);
        patchHoldingRow(tr, item);
      }
      else if(e.target.classList.contains("h-price")){
        item.price = parseFloat(e.target.value) || 0;
        item.priceUpdated = new Date().toISOString().slice(0, 10);
        item.amount = Math.round((Number(item.quantity) || 0) * item.price * 100) / 100;
        patchHoldingRow(tr, item);
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
      else return;
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
      if(state.assets[idx]){ state.assets[idx].category = e.target.value; renderAssets(); persist(); }
    }
    if(e.target.closest("table.assets-table, .m-asset-rows") && e.target.classList.contains("h-market")){
      var htr = e.target.closest("[data-index]");
      if(!htr) return;
      var hidx = Number(htr.getAttribute("data-index"));
      if(state.assets[hidx]){ state.assets[hidx].market = e.target.value; persist(); }
    }
    if(e.target.closest("table.assets-table, .m-asset-rows") && e.target.classList.contains("h-person")){
      updatePersonSuggestions();
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
      if(e.target.classList.contains("loan-what")) loan.what = e.target.value;
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
    var collapseBtn = e.target.closest("[data-collapse-toggle]");
    if(collapseBtn){
      var cs = collapseBtn.getAttribute("data-collapse-toggle");
      homeBlockCollapsed[cs] = !homeBlockCollapsed[cs];
      renderHomeBody();
      return true;
    }
    var renameBtn = e.target.closest("[data-rename]");
    if(renameBtn){ renameScenario(renameBtn.getAttribute("data-rename")); return true; }
    var delBtn = e.target.closest("[data-delete]");
    if(delBtn){ deleteScenario(delBtn.getAttribute("data-delete")); return true; }
    if(e.target.closest("#addScenarioBtn") || e.target.closest("#addScenarioBtn2")){ addScenario(); return true; }
    var editBtn = e.target.closest("[data-edit-scenario]");
    if(editBtn){ selectScenario(editBtn.getAttribute("data-edit-scenario")); showPage("scenarios"); return true; }
    var setActiveBtn = e.target.closest("[data-edit-scenario2]");
    if(setActiveBtn){ selectScenario(setActiveBtn.getAttribute("data-edit-scenario2")); return true; }
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

  function isoDateStamp(){
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    var hh = String(d.getHours()).padStart(2, "0");
    var mi = String(d.getMinutes()).padStart(2, "0");
    var ss = String(d.getSeconds()).padStart(2, "0");
    return d.getFullYear() + "-" + mm + "-" + dd + "_" + hh + "-" + mi + "-" + ss;
  }
  // Encryption is entirely client-side (Web Crypto API): a passphrase derives an
  // AES-256-GCM key via PBKDF2 (250k iterations, random salt), which encrypts the
  // backup JSON. Nothing is sent anywhere — same privacy promise as the rest of the
  // app — this only protects the exported *file* if it ends up somewhere less trusted
  // than this browser (cloud sync, email, a shared drive). Forgetting the passphrase
  // means the backup is unrecoverable; there's no reset path by design.
  function bufToBase64(buf){
    var bytes = new Uint8Array(buf), binary = "";
    for(var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  function base64ToBuf(b64){
    var binary = atob(b64), bytes = new Uint8Array(binary.length);
    for(var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
  function deriveBackupKey(passphrase, saltBytes){
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(passphrase), {name: "PBKDF2"}, false, ["deriveKey"])
      .then(function(keyMaterial){
        return crypto.subtle.deriveKey(
          {name: "PBKDF2", salt: saltBytes, iterations: 250000, hash: "SHA-256"},
          keyMaterial, {name: "AES-GCM", length: 256}, false, ["encrypt", "decrypt"]
        );
      });
  }
  function encryptBackup(payloadStr, passphrase){
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return deriveBackupKey(passphrase, salt).then(function(key){
      var enc = new TextEncoder();
      return crypto.subtle.encrypt({name: "AES-GCM", iv: iv}, key, enc.encode(payloadStr)).then(function(ciphertextBuf){
        return JSON.stringify({
          wealthPlannerEncrypted: true, v: 1,
          salt: bufToBase64(salt), iv: bufToBase64(iv), ciphertext: bufToBase64(ciphertextBuf)
        }, null, 2);
      });
    });
  }
  function decryptBackup(envelope, passphrase){
    var salt = new Uint8Array(base64ToBuf(envelope.salt));
    var iv = new Uint8Array(base64ToBuf(envelope.iv));
    return deriveBackupKey(passphrase, salt).then(function(key){
      return crypto.subtle.decrypt({name: "AES-GCM", iv: iv}, key, base64ToBuf(envelope.ciphertext)).then(function(plainBuf){
        return new TextDecoder().decode(plainBuf);
      });
    });
  }

  function doExport(){
    var passphrase = prompt("Optional: encrypt this backup with a passphrase (leave blank for a plain, unencrypted backup as before). You'll need this exact passphrase to import it again — it can't be recovered if you forget it.");
    if(passphrase === null) return;
    var payload = JSON.stringify(state, null, 2);
    var filename = "wealth-planner-backup-" + isoDateStamp() + (passphrase ? "-encrypted" : "") + ".json";
    if(passphrase){
      encryptBackup(payload, passphrase).then(function(encPayload){
        finishExport(encPayload, filename);
      }).catch(function(){
        showToast("Encryption failed — nothing was exported. Try again.");
      });
    } else {
      finishExport(payload, filename);
    }
  }
  function finishExport(payload, filename, mime, savedMsg){
    mime = mime || "application/json";
    savedMsg = savedMsg || "Backup saved";
    if(window.claude && window.claude.use){
      window.claude.use("downloads").then(function(downloads){
        if(!downloads){ shareExport(payload, filename, mime, savedMsg); return; }
        downloads.save({filename: filename, data: payload}).then(function(){
          showToast(savedMsg);
        }).catch(function(err){
          if(err && err.code === "declined") return;
          shareExport(payload, filename, mime, savedMsg);
        });
      }).catch(function(){ shareExport(payload, filename, mime, savedMsg); });
    } else {
      shareExport(payload, filename, mime, savedMsg);
    }
  }
  // On iPad/Android, a plain download link just dumps the file into Downloads with no
  // choice of where it goes — the same friction Import avoids by using the OS's native
  // file picker. navigator.canShare() lets us check, synchronously and before ever
  // calling .share(), whether this browser can hand a File to the OS share sheet (Save
  // to Files, Drive, AirDrop, etc.) instead. Desktop browsers mostly don't support
  // sharing files this way, so canShare() correctly returns false there and we fall
  // straight through to the existing download-link behavior, unchanged.
  function shareExport(payload, filename, mime, savedMsg){
    try{
      var file = new File([payload], filename, {type: mime});
      if(navigator.canShare && navigator.canShare({files: [file]})){
        navigator.share({files: [file], title: filename}).then(function(){
          showToast(savedMsg.replace("saved", "shared"));
        }).catch(function(err){
          if(err && err.name === "AbortError") return; // user dismissed the share sheet — not a failure
          fallbackExport(payload, filename, mime, savedMsg);
        });
        return;
      }
    }catch(e){ /* fall through to the direct download */ }
    fallbackExport(payload, filename, mime, savedMsg);
  }
  function fallbackExport(payload, filename, mime, savedMsg){
    try{
      var blob = new Blob([payload], {type: mime});
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
      showToast(savedMsg);
    }catch(e){
      showToast("Couldn't save a file here — copy is in your clipboard? Try again from a full browser tab.");
    }
  }

  // ---------------- Per-section CSV export ----------------
  // A lighter-weight sibling to the full JSON backup above: one section's rows as a plain CSV,
  // for opening in a spreadsheet, sharing with an accountant, or a quick sanity check — not a
  // backup/restore format, so there's no matching CSV import (yet).
  function csvCell(v){
    var s = v == null ? "" : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function buildCsv(headers, rows){
    var lines = [headers.map(csvCell).join(",")];
    rows.forEach(function(row){ lines.push(row.map(csvCell).join(",")); });
    return lines.join("\r\n");
  }
  function exportCsv(filename, headers, rows){
    if(!rows.length){ showToast("Nothing to export yet"); return; }
    finishExport(buildCsv(headers, rows), filename, "text/csv", "CSV saved");
  }

  function exportIncomeCsv(){
    var headers = ["What", "Person", "Type", "Amount", "Frequency", "Super", "Sacrifice mode", "Sacrifice value", "Account"];
    var rows = state.income.filter(function(i){ return !i.computed; }).map(function(i){
      return [i.what, i.person || "", i.incomeType || "Net", i.amount, i.freq, i.superMode || "", sacrificeModeToLabel(i.sacrificeMode), i.sacrificeValue || "", i.account || ""];
    });
    exportCsv("income-" + isoDateStamp() + ".csv", headers, rows);
  }
  function exportExpensesCsv(){
    var headers = ["What", "Classification", "Amount", "Frequency", "Account"];
    var rows = state.shared.map(function(i){
      return [i.what, i.classification || "", i.amount, i.freq, i.account || ""];
    });
    exportCsv("expenses-" + isoDateStamp() + ".csv", headers, rows);
  }
  function exportAssetsCsv(){
    var headers = ["What", "Category", "Amount", "Symbol", "Market", "Quantity", "Avg cost", "Price", "Person", "Purchase price", "Purchase date", "Depreciation %/yr"];
    var rows = state.assets.map(function(a){
      return [a.what, a.category || "", a.amount, a.symbol || "", a.market || "", a.quantity != null ? a.quantity : "", a.avgCost != null ? a.avgCost : "", a.price != null ? a.price : "", a.person || "", a.purchasePrice != null ? a.purchasePrice : "", a.purchaseDate || "", a.depreciationRate != null ? a.depreciationRate : ""];
    });
    exportCsv("assets-" + isoDateStamp() + ".csv", headers, rows);
  }
  function exportPropertyLoansCsv(){
    var headers = ["Property", "What", "Balance", "Rate %", "Term (yrs)", "Type", "Repayment mode", "Manual repayment amount", "Offset balance"];
    var rows = [];
    state.properties.forEach(function(p){
      (p.loans || []).forEach(function(l){
        var rateDisplay = Math.round((Number(l.rate) || 0) * 100) / 100;
        rows.push([p.what, l.what, l.balance, rateDisplay, l.termYears, l.repaymentType, l.repaymentMode, l.repaymentMode === "manual" ? l.manualRepaymentAmount : "", l.offsetBalance]);
      });
    });
    exportCsv("property-loans-" + isoDateStamp() + ".csv", headers, rows);
  }
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
    renderHomeBody();
    renderCards();
    renderDetail();
    renderTotals();
    renderAssets();
    updatePersonSuggestions();
    renderTaxSuper();
    applyPeriodVisibility();
  }

  if(!storageAvailable) setStatus(false, "Storage unavailable — export to keep changes");

  var datalist = document.createElement("datalist");
  datalist.id = "acctSuggestions";
  datalist.innerHTML = '<option value="Everyday Account"><option value="Savings Account"><option value="Offset Account"><option value="Credit Card">';
  document.body.appendChild(datalist);

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
})();
