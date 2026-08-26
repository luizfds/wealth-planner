import { STORAGE_KEY, HOME_CATEGORIES, INCOME_COL_DEFS, TRANSFER_FEE_BY_STATE, MORTGAGE_REG_FEE_BY_STATE, INVEST_LEG_TYPES } from "./constants.js";
import { showToast } from "./lib/toast.js";

export function defaultPurchaseConfig(price, depositPct, rate, termYears, stateCode, enabled){
  return {
    enabled: !!enabled,
    price: price,
    depositPct: depositPct,
    rate: rate,
    termYears: termYears,
    state: stateCode,
    firstHomeBuyer: false,
    repaymentType: "PI",
    ioRate: rate,
    propertyGrowthRate: null,
    syncRepayment: !!enabled,
    lmiCapitalized: false,
    otherCosts: [
      {what:"Conveyancing / Legal Fees", amount:1800},
      {what:"Building & Pest Inspection", amount:500},
      {what:"Loan Application Fee", amount:600},
      {what:"Mortgage Registration Fee", amount: MORTGAGE_REG_FEE_BY_STATE[stateCode] != null ? MORTGAGE_REG_FEE_BY_STATE[stateCode] : MORTGAGE_REG_FEE_BY_STATE.Other},
      {what:"Transfer Fee", amount: TRANSFER_FEE_BY_STATE[stateCode] != null ? TRANSFER_FEE_BY_STATE[stateCode] : TRANSFER_FEE_BY_STATE.Other}
    ]
  };
}

// A scenario's alternative to defaultPurchaseConfig(): invest instead of buying. Mutually
// exclusive with the purchase leg in the UI (enabling one disables the other) — see
// computeNetWorthSeries() for why that matters for the math, not just the display.
export function defaultInvestConfig(assetType){
  var meta = INVEST_LEG_TYPES.find(function(t){ return t.key === assetType; }) || INVEST_LEG_TYPES[0];
  return {
    enabled: false,
    assetType: meta.key,
    initialAmount: 0,
    // "auto" redirects the scenario's own real monthly cash-flow surplus into this leg's growth
    // rate instead of the generic portfolio rate — see computeNetWorthSeries(). "manual" lets the
    // user pin an exact monthly figure instead, independent of actual cash flow.
    contributionMode: "auto",
    monthlyContribution: 0,
    growthRatePct: meta.defaultGrowthRate
  };
}

export function deepClone(o){ return JSON.parse(JSON.stringify(o)); }
export function genId(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export function defaultState(){
  return {
    activeScenario: "Current situation",
    scenarios: ["Current situation"],
    baselineScenario: "Current situation",
    showAllPeriods: false,
    // Classic's tables rely on horizontal scroll even with a sticky first column — a rough
    // landing experience on a phone. Modern was built mobile-first, so a fresh mobile visitor
    // (same breakpoint the CSS uses everywhere else) starts there instead. Desktop keeps the
    // long-standing Classic default.
    uiMode: window.innerWidth < 880 ? "modern" : "classic",
    incomeCols: { person: false, type: true, super: true, sacrifice: true, account: false },
    expenseCols: { classification: false, account: false },
    homeCols: { account: false },
    income: [],
    ip: [],
    shared: [],
    home: { "Current situation": defaultHomeBlock() },
    purchase: { "Current situation": defaultPurchaseConfig(0, 20, 6.0, 30, "NSW", false) },
    invest: { "Current situation": defaultInvestConfig() },
    assets: [],
    properties: [],
    projection: { horizonYears: 20, investReturnRate: 7, propertyAppreciationRate: 5, inflationRate: 3, rateShockPct: 0 },
    tax: { sgRate: 12, ipOwnership: {}, settings: {} }
  };
}

export function defaultHomeBlock(){
  return HOME_CATEGORIES.map(function(what, i){
    var item = { what: what, classification: "Needs", account: "", amount: 0, freq: "Monthly" };
    if(i === 0) item.id = "homeLoanRow";
    return item;
  });
}

export function migrateState(s){
  // Same viewport-aware default as defaultState() — generateMockData() (Sample data) never
  // sets uiMode itself, so it lands here too, and shouldn't skip the mobile default.
  if(s.uiMode !== "modern" && s.uiMode !== "classic") s.uiMode = window.innerWidth < 880 ? "modern" : "classic";
  if(!s.incomeCols) s.incomeCols = { person: false, type: true, super: true, sacrifice: true, account: false };
  INCOME_COL_DEFS.forEach(function(c){ if(s.incomeCols[c.key] == null) s.incomeCols[c.key] = true; });
  if(!s._incomeTypeColDefaultApplied){
    s.incomeCols.type = true;
    s._incomeTypeColDefaultApplied = true;
  }
  if(Array.isArray(s.income)){
    s.income.forEach(function(item){
      if(item.superMode == null) item.superMode = item.superIncluded ? "Included" : "On top";
    });
  }
  if(!s.expenseCols) s.expenseCols = { account: false };
  if(s.expenseCols.account == null) s.expenseCols.account = false;
  if(s.expenseCols.classification == null) s.expenseCols.classification = false;
  if(!s.homeCols) s.homeCols = { account: false };
  if(s.homeCols.account == null) s.homeCols.account = false;
  if(!s.home) s.home = {};
  if(!Array.isArray(s.scenarios) || !s.scenarios.length) s.scenarios = Object.keys(s.home);
  if(!s.scenarios.length) s.scenarios = ["Renting"];
  s.scenarios.forEach(function(name){ if(!s.home[name]) s.home[name] = defaultHomeBlock(); });
  s.scenarios.forEach(function(name){
    var block = s.home[name];
    if(block && block.length && !block.some(function(i){ return i.id === "homeLoanRow"; })) block[0].id = "homeLoanRow";
  });
  if(!s.activeScenario || s.scenarios.indexOf(s.activeScenario) === -1) s.activeScenario = s.scenarios[0];
  // One-shot-per-load (not flagged — cheap and idempotent): if there's no baseline yet, or the
  // named baseline no longer exists (e.g. it was renamed before this field existed), designate
  // whichever scenario is currently active as "Current situation" and pin it at index 0 so
  // every renderer that just iterates state.scenarios in order shows it first automatically.
  if(!s.baselineScenario || s.scenarios.indexOf(s.baselineScenario) === -1){
    s.baselineScenario = s.activeScenario;
    var baseIdx = s.scenarios.indexOf(s.baselineScenario);
    if(baseIdx > 0){
      s.scenarios.splice(baseIdx, 1);
      s.scenarios.unshift(s.baselineScenario);
    }
  }
  if(!s.purchase) s.purchase = {};
  s.scenarios.forEach(function(name){
    if(!s.purchase[name]) s.purchase[name] = defaultPurchaseConfig(0, 20, 6.0, 30, "NSW", false);
    var pcfg = s.purchase[name];
    if(pcfg.repaymentType == null) pcfg.repaymentType = "PI";
    if(pcfg.ioRate == null) pcfg.ioRate = pcfg.rate;
    if(pcfg.propertyGrowthRate === undefined) pcfg.propertyGrowthRate = null;
    if(pcfg.lmiCapitalized == null) pcfg.lmiCapitalized = false;
  });
  if(!s.invest) s.invest = {};
  s.scenarios.forEach(function(name){
    if(!s.invest[name]) s.invest[name] = defaultInvestConfig();
    var icfg = s.invest[name];
    if(icfg.assetType == null || !INVEST_LEG_TYPES.some(function(t){ return t.key === icfg.assetType; })) icfg.assetType = INVEST_LEG_TYPES[0].key;
    if(icfg.initialAmount == null) icfg.initialAmount = 0;
    if(icfg.contributionMode !== "manual") icfg.contributionMode = "auto";
    if(icfg.monthlyContribution == null) icfg.monthlyContribution = 0;
    if(icfg.growthRatePct == null) icfg.growthRatePct = defaultInvestConfig(icfg.assetType).growthRatePct;
    // Never carry both legs enabled at once out of a partial/manual edit to a saved backup —
    // see computeNetWorthSeries() for why that would double-count. Invest wins if both are
    // somehow true, matching computeNetWorthSeries()'s own precedence; the UI itself keeps them
    // mutually exclusive so this should only ever bite a hand-edited or very old backup.
    if(icfg.enabled && s.purchase[name]) s.purchase[name].enabled = false;
  });
  if(!Array.isArray(s.assets)) s.assets = [];
  s.assets.forEach(function(a){
    if((a.category || "Other") !== "Shares") return;
    if(a.quantity == null) a.quantity = 1;
    if(a.price == null) a.price = (Number(a.amount) || 0) / (Number(a.quantity) || 1);
    if(a.avgCost === undefined) a.avgCost = null;
    if(a.market == null) a.market = "ASX";
    if(a.symbol == null) a.symbol = "";
    if(a.person == null) a.person = "";
    if(a.priceUpdated == null) a.priceUpdated = "";
    a.amount = Math.round((Number(a.quantity) || 0) * (Number(a.price) || 0) * 100) / 100;
  });
  if(!s.projection) s.projection = { horizonYears: 20, investReturnRate: 7, propertyAppreciationRate: 5, inflationRate: 3, rateShockPct: 0 };
  if(s.projection.inflationRate == null) s.projection.inflationRate = 3;
  if(s.projection.rateShockPct == null) s.projection.rateShockPct = 0;
  if(!s.tax) s.tax = { sgRate: 12, ipOwnership: {}, settings: {} };
  if(!s.tax.ipOwnership) s.tax.ipOwnership = {};
  if(!s.tax.settings) s.tax.settings = {};
  if(s.tax.sgRate == null) s.tax.sgRate = 11.5;
  (s.income || []).forEach(function(i){
    if(i.sacrificeMode == null) i.sacrificeMode = "none";
    if(i.sacrificeValue == null) i.sacrificeValue = 0;
  });

  if(!Array.isArray(s.properties)) s.properties = [];
  s.properties.forEach(function(p){
    if(!Array.isArray(p.loans)) p.loans = [];
    if(!Array.isArray(p.income)) p.income = [];
    if(!Array.isArray(p.expenses)) p.expenses = [];
    if(!Array.isArray(p.history)) p.history = [];
    if(p.kind !== "IP" && p.kind !== "PPOR") p.kind = "IP";
    if(p.value == null) p.value = 0;
    if(!p.pmFee) p.pmFee = { percent: 6, flat: 5.5 };
    if(p.pmFee.percent == null) p.pmFee.percent = 6;
    if(p.pmFee.flat == null) p.pmFee.flat = 5.5;
    p.loans.forEach(function(l){
      if(l.id == null) l.id = genId("l");
      if(l.repaymentMode !== "manual") l.repaymentMode = "auto";
      if(l.manualRepaymentAmount == null) l.manualRepaymentAmount = 0;
      if(l.manualRepaymentFreq == null) l.manualRepaymentFreq = "Monthly";
      if(l.offsetBalance == null) l.offsetBalance = 0;
      if(l.repaymentType !== "IO") l.repaymentType = "PI";
      if(l.balance == null) l.balance = 0;
      if(l.rate == null) l.rate = 0;
      if(l.termYears == null) l.termYears = 30;
    });
  });

  var hasLegacyIp = (s.income || []).some(function(i){ return i.id === "rentIncome"; }) || !!(s.ip && s.ip.length > 0);
  if(hasLegacyIp && !s.propertiesMigratedFromIp){
    var rentIdx = (s.income || []).findIndex(function(i){ return i.id === "rentIncome"; });
    var rentRow = rentIdx !== -1 ? s.income.splice(rentIdx, 1)[0] : null;
    var pmFeeIdx = (s.ip || []).findIndex(function(i){ return i.id === "pmFee6"; });
    var pmFeeRow = pmFeeIdx !== -1 ? s.ip.splice(pmFeeIdx, 1)[0] : null;
    var remainingExpenses = (s.ip || []).slice();
    s.properties.push({
      id: genId("p"),
      what: rentRow ? (rentRow.what || "Investment Property").replace(/\s*-\s*Rent$/i, "") : "Investment Property",
      kind: "IP", value: 0, history: [], loans: [],
      pmFee: {
        percent: (s.pmFee && s.pmFee.percent != null) ? s.pmFee.percent : 6,
        flat: (s.pmFee && s.pmFee.flat != null) ? s.pmFee.flat : 5.5
      },
      income: rentRow ? [{ what: rentRow.what || "Rent", account: rentRow.account || "", amount: rentRow.amount || 0, freq: rentRow.freq || "Monthly", classification: "" }] : [],
      expenses: remainingExpenses.concat(pmFeeRow ? [pmFeeRow] : [])
    });
    s.ip = [];
    s.propertiesMigratedFromIp = true;
  }

  var legacyPropertyAssets = (s.assets || []).filter(function(a){ return (a.category || "Other") === "Property"; });
  if(legacyPropertyAssets.length && !s.assetPropertiesMigrated){
    legacyPropertyAssets.forEach(function(a){
      s.properties.push({
        id: genId("p"), what: a.what || "Property", kind: "IP",
        value: Number(a.amount) || 0, history: Array.isArray(a.history) ? a.history : [],
        pmFee: { percent: 6, flat: 5.5 },
        loans: [], income: [], expenses: []
      });
    });
    s.assets = (s.assets || []).filter(function(a){ return (a.category || "Other") !== "Property"; });
    s.assetPropertiesMigrated = true;
    showToast("Moved " + legacyPropertyAssets.length + " propert" + (legacyPropertyAssets.length === 1 ? "y" : "ies") + " to the new Properties tab — check the kind (IP/PPOR) for each");
  }

  return s;
}

export var storageAvailable = true;
export var state;
try{
  var raw = localStorage.getItem(STORAGE_KEY);
  state = raw ? JSON.parse(raw) : defaultState();
  if(!state || !state.income || !state.home) state = defaultState();
  state = migrateState(state);
  // Write back immediately (not debounced) so a one-time, non-idempotent migration (e.g. moving
  // state.ip into state.properties) can't re-run and duplicate data on the next reload before the
  // user has made any edit of their own to trigger the normal debounced persist().
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}catch(e){
  storageAvailable = false;
  state = defaultState();
}

export function setState(newState){
  state = newState;
}

var saveTimer = null;
export function persist(){
  if(!storageAvailable){
    setStatus(false, "Not saved — storage unavailable");
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setStatus(true, "Saved " + new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}));
    }catch(e){
      storageAvailable = false;
      setStatus(false, "Not saved — storage unavailable");
    }
  }, 300);
}
export function setStatus(ok, text){
  document.getElementById("statusDot").className = "status-dot" + (ok ? "" : " warn");
  document.getElementById("statusText").textContent = text;
  // Mirrors into the sticky top bar's copy — the only place a mobile viewport (<880px,
  // where .actions is hidden in favor of the bottom tab bar) can see save status.
  document.getElementById("mobileStatusDot").className = "status-dot" + (ok ? "" : " warn");
  document.getElementById("mobileStatusText").textContent = text;
}
