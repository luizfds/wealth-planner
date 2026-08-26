import { state, setState, storageAvailable, persist, setStatus, defaultState, defaultHomeBlock, defaultPurchaseConfig, migrateState, genId } from "./state.js";
import {
  INCOME_COL_DEFS, MAX_SUPER_BASE, PERIODS,
  FREQS, CLASSES, INCOME_TYPES, SUPER_MODES, SACRIFICE_MODES, sacrificeModeToLabel, sacrificeLabelToMode
} from "./constants.js";
import { fmtCurrency0, fmtCurrency2, fmtPercent1 } from "./lib/format.js";
import { showToast, showUndoToast } from "./lib/toast.js";
import { escapeAttr } from "./lib/html.js";
import { syncUiModeToggle, applyPeriodVisibility } from "./lib/uimode.js";
import { renderLineChart } from "./lib/charts.js";
import { periodTh, periodTd, optionsHtml, buildTable, rowHtml, modernPlainRowHtml } from "./lib/ledger-table.js";
import { toWeekly, periodsOf, sumField, sumByClassification, safeDiv, sumByAccount } from "./calc/ledger.js";
import {
  recalcPurchase, propertyGearingAnnual, ipNetResultAnnual,
  loanRepaymentMonthly, ipProperties, ipExpensesMonthly, ipLoansMonthly, ipExpenseItemsForClassification,
  propertyEquityToday, propertiesOffsetTotal, propertiesIlliquidEquityToday
} from "./calc/property.js";
import {
  effectiveIncomeItems, getTaxPeople, incomeRowSuperNote, personTaxSettings, computePersonTax
} from "./calc/tax.js";
import { recalcComputedItems, scenarioTotals, computeNetWorthSeries, totalAssetsValue, totalNetWorthValue } from "./calc/engine.js";
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
  patchHoldingRow, patchVehicleRow, modernAssetRowOpen, renderAssetCategoryPage, renderVehiclesSubpage,
  renderSharesSubpage, parseSharesPasteLine, renderAssetsSummary, patchAssetCategoryTotals,
  renderNetWorthPanel, renderPortfolioHistoryChart, assetTrendHtml
} from "./components/assets.js";
import {
  modernPropRowOpen, renderPropListModern, renderProperties, patchPropertyCardComputed
} from "./components/properties.js";

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

  var PURCHASE_STATE_CODES = ["NSW", "VIC", "Other"];
  var EXPENSE_COL_DEFS = [
    { key: "classification", label: "Classification" },
    { key: "account", label: "Account" }
  ];

  // Long-run compound annual growth in established house prices, 1980-2022 (Landmark
  // Valuations analysis of ABS/state-government median price series). These are historical
  // averages for context, not a forecast — past growth doesn't predict future growth, which
  // is why this is only ever a suggested starting point the user can override per scenario.
  var STATE_GROWTH_RATES = { NSW: 6.8, VIC: 7.2, Other: 6.4 };

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
  function selectScenario(name){
    if(state.activeScenario === name) return;
    state.activeScenario = name;
    persist();
    renderCards();
    renderDetail();
    renderHomeBody();
  }

  function addScenario(){
    var name = prompt('Name the new scenario (e.g. "Buy Brisbane"):', "");
    if(name === null) return;
    name = name.trim();
    if(!name) return;
    if(state.scenarios.indexOf(name) !== -1){ showToast('A scenario named "' + name + '" already exists'); return; }
    state.scenarios.push(name);
    state.home[name] = defaultHomeBlock();
    state.purchase[name] = defaultPurchaseConfig(0, 20, 6.0, 30, "NSW", true);
    state.activeScenario = name;
    persist();
    renderCards();
    renderDetail();
    renderHomeBody();
    renderAssets();
    showToast('Added "' + name + '"');
  }

  function renameScenario(oldName){
    var name = prompt("Rename scenario:", oldName);
    if(name === null) return;
    name = name.trim();
    if(!name || name === oldName) return;
    if(state.scenarios.indexOf(name) !== -1){ showToast('A scenario named "' + name + '" already exists'); return; }
    var idx = state.scenarios.indexOf(oldName);
    if(idx === -1) return;
    state.scenarios[idx] = name;
    state.home[name] = state.home[oldName];
    delete state.home[oldName];
    state.purchase[name] = state.purchase[oldName];
    delete state.purchase[oldName];
    if(state.activeScenario === oldName) state.activeScenario = name;
    persist();
    renderCards();
    renderDetail();
    renderHomeBody();
    renderAssets();
  }

  function deleteScenario(name){
    if(state.scenarios.length <= 1){ showToast("You need at least one scenario"); return; }
    if(!confirm('Delete "' + name + '"? This removes its home-cost inputs.')) return;
    state.scenarios = state.scenarios.filter(function(s){ return s !== name; });
    delete state.home[name];
    delete state.purchase[name];
    if(state.activeScenario === name) state.activeScenario = state.scenarios[0];
    persist();
    renderCards();
    renderDetail();
    renderHomeBody();
    renderAssets();
  }

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


  function slug(s){ return s.replace(/[^a-z0-9]/gi, ""); }

  function homeReconciliationHtml(scenario){
    var items = state.home[scenario] || [];
    var loanRow = items.find(function(i){ return i.id === "homeLoanRow"; });
    var loanMonthly = loanRow ? periodsOf(loanRow.amount, loanRow.freq).monthly : 0;
    var total = sumField(items, "monthly");
    var other = total - loanMonthly;
    return "Adds up: " + escapeAttr(loanRow ? loanRow.what : "Rent / Home Loan") + " " + fmtCurrency0.format(loanMonthly) +
      " + other recurring costs " + fmtCurrency0.format(other) + " = <b>" + fmtCurrency0.format(total) + " / mo</b> total home cost";
  }

  // Session-only UI preference (not persisted app data, like colPickers below) — which
  // scenario cards are collapsed on the Scenarios page. Seeded per-scenario the first time
  // it's rendered so comparing several scenarios at once doesn't mean scrolling past every
  // purchase calculator fully expanded; the active scenario starts open, the rest start closed.
  var homeBlockCollapsed = {};

  // Session-only (not persisted) — mirrors modernPropRowOpen, shared across every scenario's
  // recurring-costs list (the "home:<scenario>" section prefix keeps each scenario's rows
  // unique in the map, the same way "propinc:<id>"/"propexp:<id>" do for Properties).
  var modernHomeRowOpen = {};
  // Every non-computed cost row gets a color, cycling the same 8-color series used everywhere
  // else — shared by each row's identity dot and the card's composition bar so the two stay in
  // sync (mirrors incomeGroupRowMeta/loanRowMeta).
  function homeRowMeta(scenario){
    var contribIdx = 0;
    return (state.home[scenario] || []).map(function(item, idx){
      var colorIdx = null;
      if(!item.computed){ colorIdx = contribIdx % 8; contribIdx++; }
      return { item: item, idx: idx, colorIdx: colorIdx };
    });
  }
  function modernHomeCompBarHtml(rowMeta){
    var segs = rowMeta.filter(function(m){ return m.colorIdx != null; }).map(function(m){
      return { item: m.item, colorIdx: m.colorIdx, monthly: Math.max(0, periodsOf(m.item.amount, m.item.freq).monthly) };
    }).filter(function(x){ return x.monthly > 0.5; });
    if(segs.length < 2) return "";
    var total = segs.reduce(function(s, x){ return s + x.monthly; }, 0);
    return '<div class="m-comp-bar" data-comp-bar>' + segs.map(function(x){
      var pct = total > 0 ? x.monthly / total : 0;
      return '<div class="m-comp-seg series-color-' + x.colorIdx + '" style="flex:' + x.monthly + ' 1 0%" title="' + escapeAttr(x.item.what) + ': ' + fmtCurrency0.format(x.monthly) + '/mo (' + fmtPercent1.format(pct) + ')"></div>';
    }).join("") + '</div>';
  }
  function modernHomeListHtml(scenario){
    return homeRowMeta(scenario).map(function(m){
      return modernPlainRowHtml(m.item, m.idx, "home:" + scenario, modernHomeRowOpen, {showClass:true, primaryId:"homeLoanRow", colorIdx:m.colorIdx});
    }).join("");
  }
  function renderHomeListModern(scenario, i){
    var container = document.getElementById("homeRows_" + slug(scenario) + i);
    if(container) container.innerHTML = modernHomeListHtml(scenario);
  }

  function renderHomeBody(){
    syncUiModeToggle();
    var body = document.getElementById("homeBody");
    var canDelete = state.scenarios.length > 1;
    state.scenarios.forEach(function(scenario){
      if(!(scenario in homeBlockCollapsed)) homeBlockCollapsed[scenario] = (scenario !== state.activeScenario);
    });
    body.innerHTML = state.scenarios.map(function(scenario, i){
      var isActive = state.activeScenario === scenario;
      var isCollapsed = !!homeBlockCollapsed[scenario];
      var total = sumField(state.home[scenario], "monthly");
      return '<div class="home-block' + (isActive ? " is-active" : "") + (isCollapsed ? " is-collapsed" : "") + '">' +
        '<div class="home-block-head">' +
          '<div class="home-block-head-left">' +
            '<button type="button" class="icon-btn home-collapse-toggle" data-collapse-toggle="' + escapeAttr(scenario) + '" aria-expanded="' + (!isCollapsed) + '" aria-label="' + (isCollapsed ? "Expand" : "Collapse") + ' ' + escapeAttr(scenario) + '"><svg class="ledger-caret" width="9" height="9" viewBox="0 0 8 8"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg></button>' +
            '<span class="home-dot"></span><h4>' + escapeAttr(scenario) + '</h4>' +
            (isActive
              ? '<span class="home-active-badge" title="This is the scenario shown on the Dashboard and compared against the others">Active on Dashboard</span>'
              : '<button type="button" class="home-setactive-btn" data-edit-scenario2="' + escapeAttr(scenario) + '" title="Make this the scenario shown on the Dashboard">Set active</button>') +
          '</div>' +
          '<div class="home-block-right" title="Total home cost per month — rent/repayment plus insurance, rates, water &amp; maintenance">' +
            '<span class="home-block-total-label">Home cost</span>' +
            '<span class="home-block-total">' + fmtCurrency0.format(total) + ' / mo</span>' +
            '<button type="button" class="icon-btn" data-rename="' + escapeAttr(scenario) + '" aria-label="Rename ' + escapeAttr(scenario) + '" title="Rename">✎</button>' +
            (canDelete ? '<button type="button" class="icon-btn icon-del" data-delete="' + escapeAttr(scenario) + '" aria-label="Delete ' + escapeAttr(scenario) + '" title="Delete">✕</button>' : "") +
          '</div>' +
        '</div>' +
        '<div class="home-block-body">' +
          renderPurchasePanelHtml(scenario) +
          '<div class="home-recurring-label">Recurring costs — per month</div>' +
          '<p class="income-summary-line home-recon-line">' + homeReconciliationHtml(scenario) + '</p>' +
          (state.uiMode === "modern"
            ? '<div class="m-card" id="homeCard_' + slug(scenario) + i + '">' + modernHomeCompBarHtml(homeRowMeta(scenario)) + '<div class="m-rows" id="homeRows_' + slug(scenario) + i + '">' + modernHomeListHtml(scenario) + '</div></div>'
            : '<div class="table-scroll"><table class="ledger-table" id="homeTable_' + slug(scenario) + i + '"></table></div>') +
          '<div class="ledger-footer"><button class="btn btn-sm" data-add="home:' + escapeAttr(scenario) + '">+ Add item</button></div>' +
        '</div>' +
        '</div>';
    }).join("") +
    '<button type="button" class="add-scenario-row" id="addScenarioBtn2"><span class="add-plus" style="font-size:16px">+</span> Add another scenario</button>';
    if(state.uiMode !== "modern"){
      state.scenarios.forEach(function(scenario, i){
        buildTable(document.getElementById("homeTable_" + slug(scenario) + i), "home:" + scenario, state.home[scenario], {showClass:true, acctColClass:"col-account-home"});
      });
    }
    applyPeriodVisibility();
  }

  // Every acquisition cost gets a color, cycling the same 8-color series used everywhere else —
  // shared by each row's identity dot and this list's composition bar so the two stay in sync.
  function costRowMeta(cfg){
    return (cfg.otherCosts || []).map(function(c, ci){ return { cost: c, ci: ci, colorIdx: ci % 8 }; });
  }
  function modernCostCompBarHtml(rowMeta){
    var segs = rowMeta.map(function(m){ return { cost: m.cost, colorIdx: m.colorIdx, amount: Math.max(0, Number(m.cost.amount) || 0) }; })
      .filter(function(x){ return x.amount > 0.5; });
    if(segs.length < 2) return "";
    var total = segs.reduce(function(s, x){ return s + x.amount; }, 0);
    return '<div class="m-comp-bar" data-comp-bar>' + segs.map(function(x){
      var pct = total > 0 ? x.amount / total : 0;
      return '<div class="m-comp-seg series-color-' + x.colorIdx + '" style="flex:' + x.amount + ' 1 0%" title="' + escapeAttr(x.cost.what) + ': ' + fmtCurrency0.format(x.amount) + ' (' + fmtPercent1.format(pct) + ')"></div>';
    }).join("") + '</div>';
  }
  function renderPurchasePanelHtml(scenario){
    var cfg = state.purchase[scenario];
    if(!cfg) return "";
    var enabled = !!cfg.enabled;
    var body = "";
    if(enabled){
      var out = recalcPurchase(scenario);
      var stateOptions = PURCHASE_STATE_CODES.map(function(sc){
        return '<option value="' + sc + '"' + (sc === cfg.state ? " selected" : "") + '>' + sc + '</option>';
      }).join("");
      var isModern = state.uiMode === "modern";
      var costsRows = (cfg.otherCosts || []).map(function(c, ci){
        return '<tr class="cc-row">' +
          '<td><input type="text" class="cc-what" value="' + escapeAttr(c.what) + '" aria-label="Cost name"></td>' +
          '<td class="cc-amount-cell"><input type="number" step="1" min="0" class="cc-amount" value="' + c.amount + '" aria-label="Cost amount"></td>' +
          '<td class="cc-del"><button type="button" class="btn btn-ghost btn-sm row-del" data-cc-del="' + ci + '" aria-label="Remove cost">✕</button></td>' +
          '</tr>';
      }).join("");
      var modernCostsRows = costRowMeta(cfg).map(function(m){
        return '<div class="cc-row m-cost-row">' +
          '<span class="m-row-dot series-color-' + m.colorIdx + '" aria-hidden="true"></span>' +
          '<input type="text" class="cc-what" value="' + escapeAttr(m.cost.what) + '" aria-label="Cost name" placeholder="Cost name">' +
          '<input type="number" step="1" min="0" class="cc-amount" value="' + m.cost.amount + '" aria-label="Cost amount">' +
          '<button type="button" class="btn btn-ghost btn-sm row-del" data-cc-del="' + m.ci + '" aria-label="Remove cost">✕</button>' +
        '</div>';
      }).join("");
      var modernCostsCompBar = modernCostCompBarHtml(costRowMeta(cfg));
      var stampDutyHtml = out.stampDuty === null
        ? '<input type="number" step="1" min="0" class="calc-manual-stampduty" value="' + (Number(cfg.manualStampDuty) || 0) + '" style="width:100%;font-family:\'IBM Plex Mono\',monospace;font-size:15px;background:transparent;border:1px solid var(--border);border-radius:6px;padding:2px 4px;">'
        : fmtCurrency0.format(out.stampDuty);
      body =
        '<div class="calc-body">' +
          '<div class="calc-grid">' +
            '<div class="calc-field"><label>Property price</label><input type="number" step="1000" min="0" class="calc-price" value="' + cfg.price + '"></div>' +
            '<div class="calc-field" title="Below 20% usually means paying Lenders Mortgage Insurance (LMI) — see the settlement costs below."><label>Deposit %</label><input type="number" step="1" min="0" max="100" class="calc-depositPct" value="' + cfg.depositPct + '"><span class="calc-hint" data-out="deposit">' + fmtCurrency0.format(out.depositAmt) + '</span></div>' +
            '<div class="calc-field"><label>Loan term (years)</label><input type="number" step="1" min="1" class="calc-term" value="' + cfg.termYears + '"></div>' +
            '<div class="calc-field"><label>State</label><select class="calc-state">' + stateOptions + '</select></div>' +
            '<div class="calc-field" title="Overrides the global Property growth % p.a. (Projections tab) for this scenario only. Leave blank to use the global rate for every scenario alike."><label>Property growth % p.a. <span style="text-transform:none;font-weight:400">(this scenario)</span></label><input type="number" step="0.1" min="-10" max="30" class="calc-growth-override" placeholder="Global: ' + (Number(state.projection.propertyAppreciationRate) || 0) + '%" value="' + (cfg.propertyGrowthRate != null ? cfg.propertyGrowthRate : '') + '"><span class="calc-hint">' + (STATE_GROWTH_RATES[cfg.state] != null ? (cfg.state + ' long-run avg ' + STATE_GROWTH_RATES[cfg.state] + '%/yr (1980–2022) — <button type="button" class="calc-hint-link" data-use-growth="' + STATE_GROWTH_RATES[cfg.state] + '">use this</button>') : '') + '</span></div>' +
            '<div class="calc-field" title="Rate for a standard principal &amp; interest loan — get your bank/broker\'s quoted rate for an accurate comparison."><label>Interest rate % p.a. (P&amp;I)</label><input type="number" step="0.05" min="0" class="calc-rate" value="' + cfg.rate + '"></div>' +
            '<div class="calc-field" title="Interest-only rate — lenders usually price this higher than P&amp;I. Get the actual IO rate quoted by your bank, don\'t assume it matches P&amp;I."><label>Interest rate % p.a. (IO)</label><input type="number" step="0.05" min="0" class="calc-iorate" value="' + cfg.ioRate + '"></div>' +
            '<div class="calc-field" title="Which repayment feeds your budget below and the long-term projection. Both are shown for comparison regardless of this choice."><label>Repayment type used</label><select class="calc-repaymenttype"><option value="PI"' + (cfg.repaymentType !== "IO" ? " selected" : "") + '>Principal &amp; interest</option><option value="IO"' + (cfg.repaymentType === "IO" ? " selected" : "") + '>Interest only</option></select></div>' +
            '<div class="calc-field"><label>First home buyer <span class="calc-help" title="Applies first-home-buyer stamp duty savings: full exemption below $800k (NSW) / $600k (VIC), tapering down to no discount at $1M (NSW) / $750k (VIC). No effect when State is \'Other\' — stamp duty is entered manually there.">ⓘ</span></label><label class="calc-check-inline"><span class="switch"><input type="checkbox" class="calc-fhb"' + (cfg.firstHomeBuyer ? " checked" : "") + '><span class="switch-track"><span class="switch-thumb"></span></span></span> Yes</label></div>' +
          '</div>' +
          '<div class="calc-outputs-label">At settlement — one-off</div>' +
          '<div class="calc-outputs">' +
            '<div class="calc-out"><span>Loan amount</span><b data-out="loan">' + fmtCurrency0.format(out.loanAmount) + '</b></div>' +
            '<div class="calc-out" title="Loan amount ÷ property price. Above 80% usually triggers Lenders Mortgage Insurance (LMI) below."><span>LVR</span><b data-out="lvr">' + fmtPercent1.format(out.lvr) + '</b></div>' +
            '<div class="calc-out"><span>Stamp duty' + (out.stampDuty === null ? " (enter manually)" : "") + '</span><b data-out="stampduty">' + stampDutyHtml + '</b></div>' +
            '<div class="calc-out" title="Lenders Mortgage Insurance — a one-off premium lenders charge when your deposit is under 20% (LVR over 80%), protecting the lender, not you. $0 below 80% LVR."><span>LMI (estimate)</span><b data-out="lmi">' + fmtCurrency0.format(out.lmi) + '</b></div>' +
            '<div class="calc-out"><span>Other costs</span><b data-out="othercosts">' + fmtCurrency0.format(out.otherTotal) + '</b></div>' +
            '<div class="calc-out emph" title="Deposit + stamp duty + LMI + other costs — the cash you need available on settlement day."><span>Total upfront cash</span><b data-out="upfront">' + fmtCurrency0.format(out.upfrontCash) + '</b></div>' +
          '</div>' +
          '<div class="calc-outputs-label">Ongoing — per month · compare repayment options</div>' +
          '<div class="calc-outputs">' +
            '<div class="calc-out' + (cfg.repaymentType !== "IO" ? " emph" : "") + '" data-repayment-out="PI" title="Loan principal &amp; interest — pays down the balance over the loan term"><span>Repayment (P&amp;I)' + (cfg.repaymentType !== "IO" ? " ✓ used below" : "") + '</span><b data-out="repaymentpi">' + fmtCurrency0.format(out.repaymentMonthlyPI) + '/mo</b></div>' +
            '<div class="calc-out' + (cfg.repaymentType === "IO" ? " emph" : "") + '" data-repayment-out="IO" title="Interest only — cheaper monthly, but the loan balance never reduces. Get the actual IO rate from your bank, don\'t assume it matches the P&amp;I rate."><span>Repayment (Interest only)' + (cfg.repaymentType === "IO" ? " ✓ used below" : "") + '</span><b data-out="repaymentio">' + fmtCurrency0.format(out.repaymentMonthlyIO) + '/mo</b></div>' +
          '</div>' +
          '<div>' +
            '<div class="calc-costs-title">Other acquisition costs</div>' +
            (isModern ? '<div class="m-card m-cost-rows">' + modernCostsCompBar + modernCostsRows + '</div>' : '<table class="calc-costs-table">' + costsRows + '</table>') +
            '<button type="button" class="btn btn-sm" style="margin-top:8px" data-cc-add="1">+ Add cost</button>' +
          '</div>' +
          '<label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer">' +
            '<span class="switch"><input type="checkbox" class="calc-sync"' + (cfg.syncRepayment ? " checked" : "") + '><span class="switch-track"><span class="switch-thumb"></span></span></span> Use this repayment as "Rent / Home Loan" below' +
          '</label>' +
          '<p class="calc-note">P&amp;I repayment is exact (standard amortisation). Interest-only repayment is simplified — modelled flat for the full loan term rather than a fixed IO period reverting to P&amp;I, and the projection assumes the balance never reduces while IO is selected. Stamp duty (NSW/VIC) and LMI are estimates based on published general scales and typical lender premiums — all rates and fees vary by lender/insurer and change over time, so confirm exact figures with your bank, broker or state revenue office before relying on them.</p>' +
        '</div>';
    }
    return (
      '<div class="calc-panel" data-calc-scenario="' + escapeAttr(scenario) + '">' +
        '<label class="calc-enable"><span class="switch"><input type="checkbox" class="calc-enabled"' + (enabled ? " checked" : "") + '><span class="switch-track"><span class="switch-thumb"></span></span></span> This is a property purchase — show the calculator</label>' +
        body +
      '</div>'
    );
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

  function renderHomeBodyTotalsOnly(){
    document.querySelectorAll('#homeBody .home-block').forEach(function(block, i){
      var scenario = state.scenarios[i];
      var monthly = sumField(state.home[scenario], "monthly");
      var totalSpan = block.querySelector('.home-block-total');
      if(totalSpan) totalSpan.textContent = fmtCurrency0.format(monthly) + " / mo";
      var reconLine = block.querySelector('.home-recon-line');
      if(reconLine) reconLine.innerHTML = homeReconciliationHtml(scenario);
      var barWrap = block.querySelector('[id^="homeCard_"] [data-comp-bar]');
      if(barWrap) barWrap.outerHTML = modernHomeCompBarHtml(homeRowMeta(scenario));
    });
  }

  // ---------------- Purchase calculator: wiring ----------------

  function patchHomeLoanRowIfSynced(scenario){
    var cfg = state.purchase[scenario];
    if(!cfg || !cfg.enabled || !cfg.syncRepayment) return;
    var arr = state.home[scenario] || [];
    var idx = arr.findIndex(function(i){ return i.id === "homeLoanRow"; });
    if(idx === -1) return;
    var item = arr[idx];
    var i = state.scenarios.indexOf(scenario);
    if(i === -1) return;
    var wrap = document.getElementById(state.uiMode === "modern" ? ("homeRows_" + slug(scenario) + i) : ("homeTable_" + slug(scenario) + i));
    if(!wrap) return;
    var tr = wrap.querySelector('[data-index="' + idx + '"]');
    if(!tr) return;
    var amountInput = tr.querySelector(".f-amount");
    if(amountInput) amountInput.value = item.amount;
    var cells = tr.querySelectorAll("td.computed");
    var p = periodsOf(item.amount, item.freq);
    PERIODS.forEach(function(pd, pi){ if(cells[pi]) cells[pi].textContent = fmtCurrency2.format(p[pd.key]); });
    var modernAmt = tr.querySelector('[data-computed="amt"]');
    if(modernAmt) modernAmt.textContent = fmtCurrency2.format(p.monthly) + "/mo";
  }

  function patchCalcOutputs(panel, scenario){
    var out = recalcPurchase(scenario);
    if(!out) return;
    var setOut = function(key, text){ var el = panel.querySelector('[data-out="' + key + '"]'); if(el) el.textContent = text; };
    setOut("loan", fmtCurrency0.format(out.loanAmount));
    setOut("lvr", fmtPercent1.format(out.lvr));
    if(out.stampDuty !== null) setOut("stampduty", fmtCurrency0.format(out.stampDuty));
    setOut("lmi", fmtCurrency0.format(out.lmi));
    setOut("othercosts", fmtCurrency0.format(out.otherTotal));
    setOut("upfront", fmtCurrency0.format(out.upfrontCash));
    setOut("repaymentpi", fmtCurrency0.format(out.repaymentMonthlyPI) + "/mo");
    setOut("repaymentio", fmtCurrency0.format(out.repaymentMonthlyIO) + "/mo");
    setOut("deposit", fmtCurrency0.format(out.depositAmt));
    var barWrap = panel.querySelector(".m-cost-rows [data-comp-bar]");
    if(barWrap) barWrap.outerHTML = modernCostCompBarHtml(costRowMeta(state.purchase[scenario]));
  }

  function afterCalcChange(scenario){
    recalcComputedItems();
    renderCards();
    renderDetail();
    renderHomeBodyTotalsOnly();
    renderAssets();
    persist();
  }

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

  // ---------------- Assets & net worth ----------------
  function logAssetSnapshot(idx){
    var asset = state.assets[idx];
    if(!asset) return;
    var num = Number(asset.amount) || 0;
    var dateStr = new Date().toISOString().slice(0, 10);
    if(!Array.isArray(asset.history)) asset.history = [];
    var existing = asset.history.find(function(h){ return h.date === dateStr; });
    if(existing) existing.value = num;
    else asset.history.push({ date: dateStr, value: num });
    asset.history.sort(function(a, b){ return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
    renderAssets();
    renderProjectionOutputs();
    persist();
    showToast("Logged " + fmtCurrency0.format(num) + " for " + asset.what + " (" + dateStr + ")");
  }

  function showAssetsSubpage(id, opts){
    opts = opts || {};
    currentAssetsSub = id;
    document.querySelectorAll(".assets-subpage").forEach(function(el){ el.hidden = el.id !== "assetsSub-" + id; });
    document.querySelectorAll("#assetsSubnav .subnav-item").forEach(function(btn){
      btn.classList.toggle("active", btn.getAttribute("data-assets-sub") === id);
    });
    if(!opts.skipUrl) syncUrl("assets", !!opts.replace);
  }

  function applySharesPaste(){
    var area = document.getElementById("sharesPasteArea");
    if(!area) return;
    var lines = area.value.split(/\r?\n/);
    var updatedCount = 0, notFound = [];
    var todayStr = new Date().toISOString().slice(0, 10);
    lines.forEach(function(line){
      var parsed = parseSharesPasteLine(line);
      if(!parsed) return;
      var matches = state.assets.filter(function(a){ return a.category === "Shares" && (a.symbol || "").toUpperCase() === parsed.symbol; });
      if(!matches.length){ notFound.push(parsed.symbol); return; }
      matches.forEach(function(item){
        item.price = parsed.price;
        item.priceUpdated = todayStr;
        item.amount = Math.round((Number(item.quantity) || 0) * parsed.price * 100) / 100;
      });
      updatedCount += matches.length;
    });
    renderAssets();
    renderNetWorthPanel();
    persist();
    var msg = updatedCount + " price" + (updatedCount === 1 ? "" : "s") + " updated" +
      (notFound.length ? " — no holding found for " + notFound.join(", ") : "");
    showToast(msg);
  }

  function renderAssets(){
    syncUiModeToggle();
    renderAssetCategoryPage("Cash");
    renderSharesSubpage();
    renderAssetCategoryPage("Super");
    renderVehiclesSubpage();
    renderAssetCategoryPage("Other");
    renderAssetsSummary();
    renderNetWorthPanel();
    renderPortfolioHistoryChart();
    renderProjectionOutputs();
  }

  // ---------------- Properties ----------------
  function logPropertySnapshot(id){
    var property = findProperty(id);
    if(!property) return;
    var num = Number(property.value) || 0;
    var dateStr = new Date().toISOString().slice(0, 10);
    if(!Array.isArray(property.history)) property.history = [];
    var existing = property.history.find(function(h){ return h.date === dateStr; });
    if(existing) existing.value = num;
    else property.history.push({ date: dateStr, value: num });
    property.history.sort(function(a, b){ return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
    renderProperties();
    renderProjectionOutputs();
    persist();
    showToast("Logged " + fmtCurrency0.format(num) + " for " + property.what + " (" + dateStr + ")");
  }

  // ---------------- Long-term projection ----------------
  function renderProjectionOutputs(){
    var container = document.getElementById("projOutputs");
    if(!container) return;
    var horizon = Math.max(1, Number(state.projection.horizonYears) || 1);
    var series = state.scenarios.map(function(scenario, idx){
      return {
        label: scenario,
        colorClass: "series-color-" + (idx % 8),
        points: computeNetWorthSeries(scenario, horizon)
      };
    });

    var headlineEl = document.getElementById("projHeadline");
    if(headlineEl){
      var finals = series.map(function(s){
        var pt = s.points.find(function(p){ return p.x === horizon; });
        return { label: s.label, value: pt ? pt.y : 0 };
      }).sort(function(a, b){ return b.value - a.value; });
      var yrWord = horizon === 1 ? "year" : "years";
      if(finals.length > 1){
        var margin = finals[0].value - finals[1].value;
        headlineEl.innerHTML = "In " + horizon + " " + yrWord + ", <b>" + escapeAttr(finals[0].label) + "</b> comes out ahead at <b>" +
          fmtCurrency0.format(finals[0].value) + "</b> — " + fmtCurrency0.format(margin) + " more than " + escapeAttr(finals[1].label) + ".";
      } else if(finals.length === 1){
        headlineEl.innerHTML = "In " + horizon + " " + yrWord + ", <b>" + escapeAttr(finals[0].label) + "</b> reaches <b>" + fmtCurrency0.format(finals[0].value) + "</b>.";
      } else {
        headlineEl.innerHTML = "";
      }
    }

    renderLineChart(container, series, {
      height: 280,
      yFormat: function(v){ return fmtCurrency0.format(v); },
      xFormat: function(v){ return "Yr " + v; },
      ariaLabel: "Net worth projection by scenario"
    });

    var milestones = [0, 5, 10, 15, 20, horizon].filter(function(y, i, arr){ return y <= horizon && arr.indexOf(y) === i; }).sort(function(a,b){return a-b;});
    var table = document.createElement("table");
    table.className = "milestone-table";
    var headRow = "<tr><th>Scenario</th>" + milestones.map(function(y){ return "<th>" + (y === 0 ? "Today" : "Year " + y) + "</th>"; }).join("") + "</tr>";
    var bodyRows = series.map(function(s){
      var cells = milestones.map(function(y){
        var pt = s.points.find(function(p){ return p.x === y; });
        return "<td>" + fmtCurrency0.format(pt ? pt.y : 0) + "</td>";
      }).join("");
      return "<tr><td><span class=\"proj-swatch " + s.colorClass + "\"></span>" + escapeAttr(s.label) + "</td>" + cells + "</tr>";
    }).join("");
    table.innerHTML = "<thead>" + headRow + "</thead><tbody>" + bodyRows + "</tbody>";
    container.appendChild(table);
  }

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
  var PAGES = [
    { id: "dashboard", label: "Dashboard" },
    { id: "income", label: "Income & Tax" },
    { id: "expenses", label: "Expenses" },
    { id: "assets", label: "Assets" },
    { id: "properties", label: "Properties" },
    { id: "scenarios", label: "Scenarios" },
    { id: "projections", label: "Projections" }
  ];
  var PAGE_KEY = "wealthPlanner.page";

  // Shareable URLs: /<page>[/<assets-subpage>], e.g. /assets/shares. GitHub Pages serves
  // this project under a fixed /wealth-planner base; local dev (python http.server, etc.)
  // serves it from root — no generic base-path detection needed for a single-repo app.
  var BASE_PATH = location.hostname.indexOf("github.io") !== -1 ? "/wealth-planner" : "";
  var ASSETS_SUB_TO_SLUG = { summary: "summary", Cash: "cash", Shares: "shares", Super: "super", Vehicle: "vehicle", Other: "other" };
  var SLUG_TO_ASSETS_SUB = { summary: "summary", cash: "Cash", shares: "Shares", super: "Super", vehicle: "Vehicle", other: "Other" };
  var currentAssetsSub = "summary";

  function buildRoutePath(pageId, assetsSub){
    var parts = [pageId];
    if(pageId === "assets") parts.push(ASSETS_SUB_TO_SLUG[assetsSub] || "summary");
    return BASE_PATH + "/" + parts.join("/");
  }
  function syncUrl(pageId, replace){
    var path = buildRoutePath(pageId, currentAssetsSub);
    if(location.pathname === path) return;
    history[replace ? "replaceState" : "pushState"]({page: pageId, assetsSub: currentAssetsSub}, "", path + location.search);
  }
  function parseRouteFromLocation(){
    var path = location.pathname;
    if(BASE_PATH && path.indexOf(BASE_PATH) === 0) path = path.slice(BASE_PATH.length);
    var segs = path.split("/").filter(Boolean).map(function(s){
      try{ return decodeURIComponent(s).toLowerCase(); }catch(e){ return s.toLowerCase(); }
    });
    if(!segs.length) return null;
    var page = PAGES.find(function(p){ return p.id === segs[0]; });
    if(!page) return null;
    var sub = (page.id === "assets" && segs[1] && SLUG_TO_ASSETS_SUB[segs[1]]) ? SLUG_TO_ASSETS_SUB[segs[1]] : null;
    return { page: page.id, sub: sub };
  }

  // Pages reachable directly from the mobile bottom tab bar; the rest live behind its "More"
  // tab. Scenarios/Projections are occasional "what-if" pages, unlike the four data-entry
  // pages above them, so the More tab's own active state also lights up for those two.
  var MOBILE_MORE_PAGES = ["scenarios", "projections"];
  function showPage(id, opts){
    opts = opts || {};
    if(!PAGES.some(function(p){ return p.id === id; })) id = "dashboard";
    PAGES.forEach(function(p){
      var section = document.getElementById("page-" + p.id);
      if(section) section.hidden = (p.id !== id);
      document.querySelectorAll('.nav-item[data-page="' + p.id + '"], .mobile-tab[data-page="' + p.id + '"], .mobile-more-item[data-page="' + p.id + '"]').forEach(function(navBtn){
        navBtn.classList.toggle("active", p.id === id);
        if(p.id === id) navBtn.setAttribute("aria-current", "page"); else navBtn.removeAttribute("aria-current");
      });
    });
    var moreTab = document.getElementById("mobileTabMore");
    if(moreTab) moreTab.classList.toggle("active", MOBILE_MORE_PAGES.indexOf(id) !== -1);
    var page = PAGES.find(function(p){ return p.id === id; });
    document.getElementById("pageTitle").textContent = page ? page.label : "Dashboard";
    var navLabel = document.getElementById("navMenuCurrentLabel");
    if(navLabel) navLabel.textContent = page ? page.label : "Dashboard";
    try{ localStorage.setItem(PAGE_KEY, id); }catch(e){}
    if(id === "dashboard") renderDashboardStats();
    if(!opts.skipScroll) window.scrollTo(0, 0);
    if(!opts.skipUrl) syncUrl(id, !!opts.replace);
    closeMobileMore();
  }

  document.getElementById("appNav").addEventListener("click", function(e){
    var btn = e.target.closest(".nav-item");
    if(!btn) return;
    showPage(btn.getAttribute("data-page"));
    closeNavMenu();
  });

  // Mobile-only dropdown: appNav is a vertical panel behind this toggle below 880px
  // (see styles.css), so a page's 7 tabs stay reachable without horizontal scroll-hunting.
  var navMenuToggle = document.getElementById("navMenuToggle");
  function closeNavMenu(){
    document.querySelector(".app-sidebar").classList.remove("nav-open");
    navMenuToggle.setAttribute("aria-expanded", "false");
  }
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
  function closeMobileMore(){
    mobileMorePanel.hidden = true;
    mobileTabMore.setAttribute("aria-expanded", "false");
  }
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
