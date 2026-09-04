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

// Fills in a Shares-holding asset's quantity/price/avgCost/market/symbol from whatever it had
// before (a plain dollar amount, most commonly) — used both by migrateState() below for
// legacy/imported data and by app.js's category-switch handler, so an existing Cash/Other/etc.
// asset (a crypto holding tracked under "Other", say) keeps its dollar value intact the moment
// its category is changed to "Shares" live in the UI, not just on the next reload.
export function normalizeShareAsset(a){
  if(a.quantity == null) a.quantity = 1;
  if(a.price == null) a.price = (Number(a.amount) || 0) / (Number(a.quantity) || 1);
  if(a.avgCost === undefined) a.avgCost = null;
  if(a.market == null) a.market = "ASX";
  if(a.symbol == null) a.symbol = "";
  if(a.person == null) a.person = "";
  if(a.priceUpdated == null) a.priceUpdated = "";
  a.amount = Math.round((Number(a.quantity) || 0) * (Number(a.price) || 0) * 100) / 100;
  return a;
}

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
    // Real, dated spend events — deliberately separate from state.shared[]'s amount/freq (the
    // planned budget, unaffected by these). Each optionally links to a state.shared[] item via
    // its id (see migrateState()) so a period's actual spend can be compared against what was
    // budgeted for it; unlinked (linkedExpenseId: null) covers a one-off that has no matching
    // budget line at all. See expenses.js's renderTransactions()/renderActualVsPlannedPanel().
    transactions: [],
    // Named money sources referenced by the free-text "account" field elsewhere (income, shared
    // expenses, property income/expenses, transactions). {id, name, type: "debit"|"credit",
    // statementStartDay}. type controls what the Accounts card shows/expects: a credit account
    // has a statement cycle (statementStartDay, 1-28) used to group transactions into "the bill"
    // instead of a calendar month — see calc/ledger.js's currentStatementCycle(); a debit account
    // has no due date, since spending there just draws down whatever's in it. Seeded once from
    // existing account strings in migrateState() so nothing already typed in gets orphaned.
    accounts: [],
    home: { "Current situation": defaultHomeBlock() },
    purchase: { "Current situation": defaultPurchaseConfig(0, 20, 6.0, 30, "NSW", false) },
    invest: { "Current situation": defaultInvestConfig() },
    assets: [],
    debts: [],
    properties: [],
    // A frozen copy of a past projection, graded against real logged net worth over time — see
    // dashboard.js's setProjectionReference()/renderProjectionAccuracyPanel(). null until the
    // user sets one; never auto-captured, since silently freezing on first load would grade
    // against assumptions the user hasn't actually reviewed yet.
    projectionReference: null,
    // Manual, roughly-monthly net-worth snapshots (see dashboard.js's logNetWorthSnapshot()) —
    // deliberately not derived from assets/properties/debts history, since those are logged on
    // whatever cadence the user updates each item, not necessarily together or monthly.
    netWorthLog: [],
    projection: { horizonYears: 20, investReturnRate: 7, propertyAppreciationRate: 5, inflationRate: 3, rateShockPct: 0 },
    tax: { sgRate: 12, ipOwnership: {}, settings: {} },
    // 1 USD in AUD — the only cross-currency conversion this app needs, since MARKET_CURRENCY
    // only ever produces AUD or USD. Set via the Shares page's "Paste prices" box (pasting a
    // USDAUD row alongside your holdings, same GOOGLEFINANCE("CURRENCY:USDAUD") template
    // mechanism already used for share prices — see calc/engine.js's toAudAmount()) or typed in
    // directly. null until set, which every AUD total already treats the same as "no conversion
    // available" (US/Crypto holdings' native amounts pass through unconverted rather than being
    // zeroed out) — this app has never fetched anything itself, and a portfolio with no USD
    // holdings needs no rate at all.
    fx: { usdAud: null, usdAudUpdated: "" },
    // Last time Export or Share produced a full backup — not touched by CSV/template exports
    // (those are partial, one-section-at-a-time, not a way to recover from data loss) or Import.
    // "" until the first one. Powers the backup-reminder notification (lib/notifications.js) —
    // the only way this browser-only, no-backend app's data survives clearing site data or losing
    // the device.
    lastBackupDate: ""
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
  if(!Array.isArray(s.debts)) s.debts = [];
  s.debts.forEach(function(d){ if(d.balance == null) d.balance = 0; });
  if(!Array.isArray(s.shared)) s.shared = [];
  // A stable id so a transaction (see below) can still find the right expense after this array
  // is reordered/added to elsewhere — an array index would silently point at the wrong row.
  s.shared.forEach(function(item){ if(!item.id) item.id = genId("exp"); });
  if(!Array.isArray(s.transactions)) s.transactions = [];
  if(!Array.isArray(s.accounts)) s.accounts = [];
  s.accounts.forEach(function(a){
    if(!a.id) a.id = genId("acct");
    if(a.type !== "credit") a.type = "debit";
    if(a.statementStartDay == null) a.statementStartDay = 1;
  });
  // One-shot-per-load, idempotent: pick up every distinct account name already typed into an
  // "Account" field before this registry existed, so nothing gets silently orphaned. Only adds
  // names not already present — safe to re-run every load, unlike the one-off migrations below.
  (function seedAccountsFromUsage(){
    var known = {};
    s.accounts.forEach(function(a){ known[a.name] = true; });
    function collect(items){
      (items || []).forEach(function(item){
        var name = (item.account || "").trim();
        if(name && !known[name]){
          known[name] = true;
          s.accounts.push({ id: genId("acct"), name: name, type: "debit", statementStartDay: 1 });
        }
      });
    }
    collect(s.income);
    collect(s.shared);
    (s.properties || []).forEach(function(p){ collect(p.income); collect(p.expenses); });
  })();
  if(s.projectionReference === undefined) s.projectionReference = null;
  if(!Array.isArray(s.netWorthLog)) s.netWorthLog = [];
  if(!Array.isArray(s.assets)) s.assets = [];
  s.assets.forEach(function(a){
    if((a.category || "Other") === "Shares") normalizeShareAsset(a);
  });
  if(!s.projection) s.projection = { horizonYears: 20, investReturnRate: 7, propertyAppreciationRate: 5, inflationRate: 3, rateShockPct: 0 };
  if(s.projection.inflationRate == null) s.projection.inflationRate = 3;
  if(s.projection.rateShockPct == null) s.projection.rateShockPct = 0;
  if(!s.tax) s.tax = { sgRate: 12, ipOwnership: {}, settings: {} };
  if(!s.tax.ipOwnership) s.tax.ipOwnership = {};
  if(!s.tax.settings) s.tax.settings = {};
  if(s.tax.sgRate == null) s.tax.sgRate = 11.5;
  if(!s.fx) s.fx = { usdAud: null, usdAudUpdated: "" };
  if(s.fx.usdAud === undefined) s.fx.usdAud = null;
  if(s.fx.usdAudUpdated == null) s.fx.usdAudUpdated = "";
  if(s.lastBackupDate == null) s.lastBackupDate = "";
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
    // What was actually paid, and when — distinct from p.value (kept current via the Value
    // section's own Log button) and from p.history (a log of *current* value over time, which for
    // a property added to the app well after buying it starts from whatever day it was first
    // logged, not the purchase date). null/"" until set — capital gain and yield-on-cost both
    // gate on purchasePrice > 0 rather than guessing $0, same convention as Vehicle assets'
    // identical purchasePrice/purchaseDate fields (assets.js).
    if(p.purchasePrice === undefined) p.purchasePrice = null;
    if(p.purchaseDate == null) p.purchaseDate = "";
    // Stamp duty, legal/conveyancing, buyer's agent, building/pest inspection — itemized as
    // {id, what, amount} rows rather than auto-calculated from calcStampDuty() (that function's
    // brackets are today's rates, meant for planning a *future* purchase; recomputing "what stamp
    // duty would've been" for a property bought years ago against current brackets would misstate
    // a fixed historical fact, not approximate it). Meaningless without a purchase price, so it
    // only ever adds to the cost base alongside it — see propertyCapitalGain()/
    // propertyYieldOnCost() in calc/property.js, which sum this array.
    //
    // Was a single lump-sum number before itemization — a positive legacy value becomes one row
    // rather than being dropped, so nobody's already-entered total silently vanishes.
    if(typeof p.acquisitionCosts === "number"){
      p.acquisitionCosts = p.acquisitionCosts > 0 ? [{ id: genId("ac"), what: "Acquisition costs", amount: p.acquisitionCosts }] : [];
    }
    if(!Array.isArray(p.acquisitionCosts)) p.acquisitionCosts = [];
    p.acquisitionCosts.forEach(function(c){
      if(c.id == null) c.id = genId("ac");
      if(c.what == null) c.what = "";
      if(c.amount == null) c.amount = 0;
    });
    if(!p.pmFee) p.pmFee = { percent: 6, flat: 5.5 };
    if(p.pmFee.percent == null) p.pmFee.percent = 6;
    if(p.pmFee.flat == null) p.pmFee.flat = 5.5;
    // Purely informational — doesn't feed any calculation. Rent is typically entered/quoted
    // weekly (the AU market convention), but a property manager usually batches it into one
    // monthly disbursement — this just notes that expectation on the card, defaulting to the
    // overwhelmingly common case rather than leaving it unset.
    if(p.incomePaidFreq == null) p.incomePaidFreq = "Monthly";
    // Which of the card's five sections (value/acquisition/loans/income/expenses) are collapsed —
    // was a session-only in-memory map (propertySectionCollapsed) before this, which meant every
    // reload started from the same all-open state no matter what the user last set. Defaulting
    // everyone to acquisition/loans/income/expenses collapsed (value stays open) on first migration
    // through this code is deliberate, not just a placeholder default: a property card stacking all
    // five open is the single longest scroll in the app on mobile, and nobody has "customized" this
    // away from all-open before now since persistence didn't exist yet to customize.
    if(!p.sectionsCollapsed || typeof p.sectionsCollapsed !== "object"){
      p.sectionsCollapsed = { acquisition: true, loans: true, income: true, expenses: true };
    }
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
      incomePaidFreq: "Monthly",
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
        pmFee: { percent: 6, flat: 5.5 }, incomePaidFreq: "Monthly",
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
