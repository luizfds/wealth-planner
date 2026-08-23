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

  var STORAGE_KEY = "wealthPlanner.v1";
  var FREQS = ["Weekly","Fortnightly","Monthly","Quarterly","Yearly"];
  var CLASSES = ["Needs","Wants","Savings","N/A"];
  var HOME_CATEGORIES = ["Rent / Home Loan", "Home Insurance", "Council Rates", "Water & Wastewater", "Property Maintenance"];
  var ASSET_CATEGORIES = ["Cash", "Shares", "Super", "Other"];
  var LIQUID_CATEGORIES = ["Cash", "Shares"];
  var SHARE_MARKETS = ["ASX", "US"];
  var PURCHASE_STATE_CODES = ["NSW", "VIC", "Other"];
  var INCOME_TYPES = ["Net", "Gross"];
  var SUPER_MODES = ["On top", "Included"];
  var SACRIFICE_MODES = ["Cash out", "Sacrifice %", "Sacrifice $"];
  function sacrificeModeToLabel(mode){ return mode === "percent" ? "Sacrifice %" : mode === "amount" ? "Sacrifice $" : "Cash out"; }
  function sacrificeLabelToMode(label){ return label === "Sacrifice %" ? "percent" : label === "Sacrifice $" ? "amount" : "none"; }
  var INCOME_COL_DEFS = [
    { key: "person", label: "Person" },
    { key: "type", label: "Type" },
    { key: "super", label: "Super" },
    { key: "sacrifice", label: "Cash / Sacrifice" },
    { key: "account", label: "Account" }
  ];
  var EXPENSE_COL_DEFS = [
    { key: "classification", label: "Classification" },
    { key: "account", label: "Account" }
  ];

  // Australian resident individual tax brackets (2024-25, stage-3 rates). Estimates —
  // thresholds are indexed / change with policy; confirm with your accountant or the ATO.
  var AU_TAX_BRACKETS = [
    { from: 0, to: 18200, base: 0, rate: 0 },
    { from: 18200, to: 45000, base: 0, rate: 0.16 },
    { from: 45000, to: 135000, base: 4288, rate: 0.30 },
    { from: 135000, to: 190000, base: 31288, rate: 0.37 },
    { from: 190000, to: Infinity, base: 51638, rate: 0.45 }
  ];
  function incomeTaxAU(taxable){
    taxable = Math.max(0, Number(taxable) || 0);
    for(var i = 0; i < AU_TAX_BRACKETS.length; i++){
      var b = AU_TAX_BRACKETS[i];
      if(taxable <= b.to) return b.base + (taxable - b.from) * b.rate;
    }
    return 0;
  }
  function marginalRateAU(taxable){
    taxable = Math.max(0, Number(taxable) || 0);
    for(var i = 0; i < AU_TAX_BRACKETS.length; i++){
      if(taxable <= AU_TAX_BRACKETS[i].to) return AU_TAX_BRACKETS[i].rate;
    }
    return AU_TAX_BRACKETS[AU_TAX_BRACKETS.length - 1].rate;
  }
  // Medicare levy low-income shade-in — approximate current singles thresholds (also indexed yearly).
  function medicareLevyAU(taxable){
    taxable = Math.max(0, Number(taxable) || 0);
    var lower = 26000, upper = 32500;
    if(taxable <= lower) return 0;
    if(taxable <= upper) return (taxable - lower) * 0.10;
    return taxable * 0.02;
  }

  // Standard general (non-concession) transfer-duty marginal brackets.
  // Estimates only: state revenue offices update these periodically — confirm before settlement.
  var STAMP_DUTY_BRACKETS = {
    NSW: [
      {from:0, to:17000, base:0, rate:0.0125},
      {from:17000, to:36000, base:212, rate:0.015},
      {from:36000, to:97000, base:497, rate:0.0175},
      {from:97000, to:364000, base:1564, rate:0.035},
      {from:364000, to:1212000, base:10909, rate:0.045},
      {from:1212000, to:Infinity, base:48079, rate:0.055}
    ],
    VIC: [
      {from:0, to:25000, base:0, rate:0.014},
      {from:25000, to:130000, base:350, rate:0.024},
      {from:130000, to:960000, base:2870, rate:0.06}
      // 960k-2m and 2m+ handled as special cases below (VIC duty isn't purely marginal up there)
    ]
  };
  var FHB_RULES = {
    NSW: {exemptUpTo:800000, concessionUpTo:1000000},
    VIC: {exemptUpTo:600000, concessionUpTo:750000}
  };

  function bracketDuty(brackets, price){
    for(var i = 0; i < brackets.length; i++){
      var b = brackets[i];
      if(price > b.from && price <= b.to) return b.base + (price - b.from) * b.rate;
    }
    var last = brackets[brackets.length - 1];
    return last.base + (price - last.from) * last.rate;
  }

  function standardStampDuty(stateCode, price){
    price = Math.max(0, Number(price) || 0);
    if(stateCode === "NSW") return bracketDuty(STAMP_DUTY_BRACKETS.NSW, price);
    if(stateCode === "VIC"){
      if(price <= 960000) return bracketDuty(STAMP_DUTY_BRACKETS.VIC, price);
      if(price <= 2000000) return price * 0.055;
      return 110000 + (price - 2000000) * 0.065;
    }
    return null; // unmodelled state — caller should let the user enter it manually
  }

  function calcStampDuty(stateCode, price, isFHB){
    price = Math.max(0, Number(price) || 0);
    var standard = standardStampDuty(stateCode, price);
    if(standard === null) return null;
    if(!isFHB) return standard;
    var rule = FHB_RULES[stateCode];
    if(!rule) return standard;
    if(price <= rule.exemptUpTo) return 0;
    if(price >= rule.concessionUpTo) return standard;
    var frac = (price - rule.exemptUpTo) / (rule.concessionUpTo - rule.exemptUpTo);
    return standard * frac;
  }

  // Indicative single-premium LMI as a % of the loan amount. Real premiums are
  // lender/insurer-specific (Helia, QBE, etc.) and vary by loan size and risk fee — estimate only.
  var LMI_BANDS = [
    {upTo:0.80, rate:0},
    {upTo:0.85, rate:0.006},
    {upTo:0.90, rate:0.013},
    {upTo:0.95, rate:0.028},
    {upTo:1.01, rate:0.045}
  ];
  function calcLMI(loanAmount, lvr){
    if(lvr <= 0.8) return 0;
    var band = LMI_BANDS.find(function(b){ return lvr <= b.upTo; }) || LMI_BANDS[LMI_BANDS.length - 1];
    return Math.max(0, loanAmount) * band.rate;
  }

  function calcRepaymentMonthly(loanAmount, annualRatePct, termYears, repaymentType){
    loanAmount = Math.max(0, Number(loanAmount) || 0);
    if(repaymentType === "IO") return loanAmount * (Number(annualRatePct) || 0) / 100 / 12;
    var n = Math.max(1, Number(termYears) || 0) * 12;
    var r = (Number(annualRatePct) || 0) / 100 / 12;
    if(r <= 0) return loanAmount / n;
    return loanAmount * r / (1 - Math.pow(1 + r, -n));
  }

  function defaultPurchaseConfig(price, depositPct, rate, termYears, stateCode, enabled){
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
      syncRepayment: !!enabled,
      otherCosts: [
        {what:"Conveyancing / Legal Fees", amount:1800},
        {what:"Building & Pest Inspection", amount:500},
        {what:"Loan Application Fee", amount:600},
        {what:"Mortgage Registration Fee", amount:154},
        {what:"Transfer Fee", amount:154}
      ]
    };
  }

  function purchaseActiveRate(cfg){
    return cfg.repaymentType === "IO" ? (Number(cfg.ioRate) || 0) : (Number(cfg.rate) || 0);
  }

  function recalcPurchase(scenario){
    var cfg = state.purchase[scenario];
    if(!cfg) return null;
    var price = Math.max(0, Number(cfg.price) || 0);
    var depositAmt = price * (Math.max(0, Math.min(100, Number(cfg.depositPct) || 0)) / 100);
    var loanAmount = Math.max(0, price - depositAmt);
    var lvr = price > 0 ? loanAmount / price : 0;
    var stampDuty = calcStampDuty(cfg.state, price, cfg.firstHomeBuyer);
    var lmi = calcLMI(loanAmount, lvr);
    var otherTotal = (cfg.otherCosts || []).reduce(function(s, c){ return s + (Number(c.amount) || 0); }, 0);
    var stampDutyForTotal = stampDuty === null ? (Number(cfg.manualStampDuty) || 0) : stampDuty;
    var upfrontCash = depositAmt + stampDutyForTotal + lmi + otherTotal;
    var repaymentMonthlyPI = calcRepaymentMonthly(loanAmount, cfg.rate, cfg.termYears, "PI");
    var repaymentMonthlyIO = calcRepaymentMonthly(loanAmount, cfg.ioRate, cfg.termYears, "IO");
    var repaymentMonthly = cfg.repaymentType === "IO" ? repaymentMonthlyIO : repaymentMonthlyPI;
    return {
      price: price, depositAmt: depositAmt, loanAmount: loanAmount, lvr: lvr,
      stampDuty: stampDuty, stampDutyForTotal: stampDutyForTotal, lmi: lmi, otherTotal: otherTotal,
      upfrontCash: upfrontCash, repaymentMonthly: repaymentMonthly,
      repaymentMonthlyPI: repaymentMonthlyPI, repaymentMonthlyIO: repaymentMonthlyIO,
      repaymentPeriods: periodsOf(repaymentMonthly, "Monthly")
    };
  }

  function effectiveIncomeItems(){
    return state.income.filter(function(i){ return i.incomeType !== "Gross"; });
  }

  function getTaxPeople(){
    var seen = {};
    var order = [];
    state.income.forEach(function(i){
      if(i.incomeType === "Gross" && i.person){
        if(!seen[i.person]){ seen[i.person] = true; order.push(i.person); }
      }
    });
    return order;
  }

  function personIncomeBreakdown(person){
    var sgRate = (Number(state.tax.sgRate) || 11.5) / 100;
    var rows = state.income.filter(function(i){ return i.incomeType === "Gross" && i.person === person; });
    var baseGross = 0, sg = 0, packageTotal = 0, autoSacrifice = 0;
    rows.forEach(function(row){
      var annual = periodsOf(row.amount, row.freq).yearly;
      packageTotal += annual;
      var rowSg, cashPortion;
      if(row.superIncluded){
        rowSg = annual * sgRate / (1 + sgRate);
        cashPortion = annual - rowSg;
      } else {
        rowSg = annual * sgRate;
        cashPortion = annual;
      }
      sg += rowSg;
      baseGross += cashPortion;
      var rowSacrifice = 0;
      if(row.sacrificeMode === "percent"){
        rowSacrifice = cashPortion * (Math.max(0, Math.min(100, Number(row.sacrificeValue) || 0)) / 100);
      } else if(row.sacrificeMode === "amount"){
        rowSacrifice = periodsOf(Number(row.sacrificeValue) || 0, row.freq).yearly;
      }
      autoSacrifice += Math.max(0, Math.min(rowSacrifice, cashPortion));
    });
    return { baseGross: baseGross, sg: sg, packageTotal: packageTotal, autoSacrifice: autoSacrifice };
  }

  function propertyGearingAnnual(property){
    var rentYearly = sumField(property.income, "yearly");
    var expenseYearly = sumField(property.expenses, "yearly");
    var loanYearly = (property.loans || []).reduce(function(s, l){ return s + loanRepaymentMonthly(l) * 12; }, 0);
    return rentYearly - expenseYearly - loanYearly;
  }

  function ipNetResultAnnual(){
    return state.properties.filter(function(p){ return p.kind === "IP"; })
      .reduce(function(sum, p){ return sum + propertyGearingAnnual(p); }, 0);
  }

  function personTaxSettings(person){
    if(!state.tax.settings[person]){
      state.tax.settings[person] = { superSacrificeAnnual: 0, concessionalCap: 30000, carryForward: 0 };
    }
    return state.tax.settings[person];
  }

  function computePersonTax(person){
    var inc = personIncomeBreakdown(person);
    var gross = inc.baseGross;
    var settings = personTaxSettings(person);
    var people = getTaxPeople();
    var ownershipPct = (state.tax.ipOwnership && state.tax.ipOwnership[person] != null)
      ? Number(state.tax.ipOwnership[person])
      : (people.length ? 100 / people.length : 0);
    var ipShare = ipNetResultAnnual() * (ownershipPct / 100);
    var manualSacrifice = Math.max(0, Number(settings.superSacrificeAnnual) || 0);
    var autoSacrifice = inc.autoSacrifice || 0;
    var sacrifice = manualSacrifice + autoSacrifice;
    var taxable = Math.max(0, gross - sacrifice + ipShare);
    var incomeTax = incomeTaxAU(taxable);
    var medicare = medicareLevyAU(taxable);
    var totalTax = incomeTax + medicare;
    var netTakeHome = gross - sacrifice - totalTax;
    var sg = inc.sg;
    var totalConcessional = sg + sacrifice;
    var capAvailable = (Number(settings.concessionalCap) || 30000) + (Number(settings.carryForward) || 0);
    var capExceeded = Math.max(0, totalConcessional - capAvailable);
    var contributionsTax = Math.min(totalConcessional, capAvailable) * 0.15;
    var superNet = totalConcessional - contributionsTax;
    return {
      gross: gross, packageTotal: inc.packageTotal, ipShare: ipShare, ownershipPct: ownershipPct,
      sacrifice: sacrifice, manualSacrifice: manualSacrifice, autoSacrifice: autoSacrifice, taxable: taxable,
      incomeTax: incomeTax, medicare: medicare, totalTax: totalTax, netTakeHome: netTakeHome,
      effectiveRate: gross > 0 ? totalTax / gross : 0,
      sg: sg, totalConcessional: totalConcessional, capAvailable: capAvailable, capExceeded: capExceeded,
      contributionsTax: contributionsTax, superNet: superNet, marginalRate: marginalRateAU(taxable)
    };
  }


  function personBreakdownHtml(person){
    var r = computePersonTax(person);
    var row = function(label, value, cls){
      return '<div class="rb-row' + (cls ? " " + cls : "") + '"><span class="rb-label">' + escapeAttr(label) + '</span><span class="rb-value">' + value + '</span></div>';
    };
    var html = '<div class="row-breakdown-panel">';
    html += row("Gross income (excl. super)", fmtCurrency0.format(r.gross) + "/yr");
    if(Math.abs(r.ipShare) > 0.5) html += row("IP share", (r.ipShare >= 0 ? "+" : "") + fmtCurrency0.format(r.ipShare) + "/yr");
    html += row("Taxable income", fmtCurrency0.format(r.taxable) + "/yr");
    html += row("Income tax", "−" + fmtCurrency0.format(r.incomeTax) + "/yr", "neg");
    html += row("Medicare levy", "−" + fmtCurrency0.format(r.medicare) + "/yr", "neg");
    if(r.sacrifice > 0.5) html += row("Super sacrifice", "−" + fmtCurrency0.format(r.sacrifice) + "/yr", "neg");
    html += row("Net take-home", fmtCurrency0.format(r.netTakeHome) + "/yr", "rb-total");
    html += '</div>';
    return html;
  }

  function loanBalanceAfterMonths(principal, annualRatePct, termYears, monthsElapsed, repaymentType){
    var n = Math.max(1, Number(termYears) || 0) * 12;
    if(monthsElapsed >= n) return 0;
    if(repaymentType === "IO") return Math.max(0, Number(principal) || 0);
    var r = (Number(annualRatePct) || 0) / 100 / 12;
    if(r <= 0) return Math.max(0, principal - (principal / n) * monthsElapsed);
    var pow = Math.pow(1 + r, monthsElapsed);
    var M = calcRepaymentMonthly(principal, annualRatePct, termYears);
    return Math.max(0, principal * pow - M * ((pow - 1) / r));
  }

  function loanRepaymentMonthly(loan){
    if(loan.repaymentMode === "manual") return periodsOf(Number(loan.manualRepaymentAmount) || 0, loan.manualRepaymentFreq || "Monthly").monthly;
    return calcRepaymentMonthly(loan.balance, loan.rate, loan.termYears, loan.repaymentType);
  }
  // Only Investment Property costs are "kept in every scenario" for cash-flow purposes — a PPOR's costs
  // are out of scope here since they'd double up with whichever scenario's own home cost is being compared.
  function ipProperties(){ return state.properties.filter(function(p){ return p.kind === "IP"; }); }
  function ipExpensesMonthly(){ return ipProperties().reduce(function(s, p){ return s + sumField(p.expenses, "monthly"); }, 0); }
  function ipLoansMonthly(){ return ipProperties().reduce(function(s, p){ return s + p.loans.reduce(function(ss, l){ return ss + loanRepaymentMonthly(l); }, 0); }, 0); }
  function ipExpenseItemsForClassification(){
    var items = [];
    ipProperties().forEach(function(p){
      items = items.concat(p.expenses);
      p.loans.forEach(function(l){ items.push({ what: l.what, classification: "Needs", amount: loanRepaymentMonthly(l), freq: "Monthly" }); });
    });
    return items;
  }

  function scenarioInflatableMonthly(scenario){
    var homeItems = state.home[scenario] || [];
    var homeNonLoan = homeItems.filter(function(i){ return i.id !== "homeLoanRow"; });
    return sumField(state.shared, "monthly") + sumField(homeNonLoan, "monthly");
  }

  function computeNetWorthSeries(scenario, horizonYears){
    var cfg = state.purchase[scenario];
    var purchaseEnabled = !!(cfg && cfg.enabled);
    var proj = state.projection || {};
    var propRate = (Number(proj.propertyAppreciationRate) || 0) / 100;
    var investRate = (Number(proj.investReturnRate) || 0) / 100;
    var inflationRate = (Number(proj.inflationRate) || 0) / 100;
    var rateShock = (Number(proj.rateShockPct) || 0) / 100;
    var monthlyInvestRate = Math.pow(1 + investRate, 1 / 12) - 1;

    var nonPropertyAssets = totalAssetsValue();

    var price = purchaseEnabled ? Math.max(0, Number(cfg.price) || 0) : 0;
    var depositAmt = purchaseEnabled ? price * (Math.max(0, Math.min(100, Number(cfg.depositPct) || 0)) / 100) : 0;
    var loanAmount0 = Math.max(0, price - depositAmt);
    var rate = purchaseEnabled ? purchaseActiveRate(cfg) + rateShock * 100 : 0;
    var term = purchaseEnabled ? cfg.termYears : 0;
    var repaymentMonthly = purchaseEnabled ? calcRepaymentMonthly(loanAmount0, rate, term, cfg.repaymentType) : 0;

    var upfrontCash = 0;
    if(purchaseEnabled){
      var lvr0 = price > 0 ? loanAmount0 / price : 0;
      var stampDuty0 = calcStampDuty(cfg.state, price, cfg.firstHomeBuyer);
      var lmi0 = calcLMI(loanAmount0, lvr0);
      var otherTotal0 = (cfg.otherCosts || []).reduce(function(s, c){ return s + (Number(c.amount) || 0); }, 0);
      var stampDutyForTotal0 = stampDuty0 === null ? (Number(cfg.manualStampDuty) || 0) : stampDuty0;
      upfrontCash = depositAmt + stampDutyForTotal0 + lmi0 + otherTotal0;
    }
    var portfolio = nonPropertyAssets - upfrontCash;

    var incomeMonthly = scenarioTotals(scenario).incomeMonthly;
    var fixedMonthly = ipLoansMonthly() + repaymentMonthly;
    var inflatableBase = scenarioInflatableMonthly(scenario) + ipExpensesMonthly();

    var points = [];
    for(var year = 0; year <= horizonYears; year++){
      if(year > 0){
        var inflatableThisYear = inflatableBase * Math.pow(1 + inflationRate, year);
        var savingsThisYear = incomeMonthly - fixedMonthly - inflatableThisYear;
        for(var m = 0; m < 12; m++){ portfolio = portfolio * (1 + monthlyInvestRate) + savingsThisYear; }
      }
      var homeValue = price * Math.pow(1 + propRate, year);
      var loanBal = purchaseEnabled ? loanBalanceAfterMonths(loanAmount0, rate, term, year * 12, cfg.repaymentType) : 0;
      var homeEquity = purchaseEnabled ? (homeValue - loanBal) : 0;
      var propertiesEquitySum = state.properties.reduce(function(sum, p){
        var val = (Number(p.value) || 0) * Math.pow(1 + propRate, year);
        var loanNet = (p.loans || []).reduce(function(s, l){
          var bal = loanBalanceAfterMonths(l.balance, l.rate, l.termYears, year * 12, l.repaymentType);
          return s + Math.max(0, bal - (Number(l.offsetBalance) || 0));
        }, 0);
        return sum + (val - loanNet);
      }, 0);
      points.push({ x: year, y: homeEquity + portfolio + propertiesEquitySum });
    }
    return points;
  }

  var PERIODS = [
    {key:"weekly", label:"Weekly", hidden:true},
    {key:"fortnightly", label:"Fortnightly", hidden:true},
    {key:"monthly", label:"Monthly", hidden:false},
    {key:"quarterly", label:"Quarterly", hidden:true},
    {key:"yearly", label:"Yearly", hidden:false}
  ];

  function deepClone(o){ return JSON.parse(JSON.stringify(o)); }
  function genId(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function defaultState(){
    return {
      activeScenario: "Scenario 1",
      scenarios: ["Scenario 1"],
      showAllPeriods: false,
      incomeCols: { person: false, type: false, super: true, sacrifice: true, account: false },
      expenseCols: { classification: false, account: false },
      homeCols: { account: false },
      income: [],
      ip: [],
      shared: [],
      home: { "Scenario 1": defaultHomeBlock() },
      purchase: { "Scenario 1": defaultPurchaseConfig(0, 20, 6.0, 30, "NSW", false) },
      assets: [],
      properties: [],
      projection: { horizonYears: 20, investReturnRate: 7, propertyAppreciationRate: 5, inflationRate: 3, rateShockPct: 0 },
      tax: { sgRate: 12, ipOwnership: {}, settings: {} }
    };
  }

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

  function defaultHomeBlock(){
    return HOME_CATEGORIES.map(function(what, i){
      var item = { what: what, classification: "Needs", account: "", amount: 0, freq: "Monthly" };
      if(i === 0) item.id = "homeLoanRow";
      return item;
    });
  }

  function migrateState(s){
    if(!s.incomeCols) s.incomeCols = { person: false, type: false, super: true, sacrifice: true, account: false };
    INCOME_COL_DEFS.forEach(function(c){ if(s.incomeCols[c.key] == null) s.incomeCols[c.key] = true; });
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
    if(!s.purchase) s.purchase = {};
    s.scenarios.forEach(function(name){
      if(!s.purchase[name]) s.purchase[name] = defaultPurchaseConfig(0, 20, 6.0, 30, "NSW", false);
      var pcfg = s.purchase[name];
      if(pcfg.repaymentType == null) pcfg.repaymentType = "PI";
      if(pcfg.ioRate == null) pcfg.ioRate = pcfg.rate;
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

  var storageAvailable = true;
  var state;
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

  var saveTimer = null;
  function persist(){
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
  function setStatus(ok, text){
    document.getElementById("statusDot").className = "status-dot" + (ok ? "" : " warn");
    document.getElementById("statusText").textContent = text;
  }

  function toWeekly(amount, freq){
    amount = Number(amount) || 0;
    switch(freq){
      case "Weekly": return amount;
      case "Fortnightly": return amount / 2;
      case "Monthly": return amount / (52/12);
      case "Quarterly": return amount / 13;
      case "Yearly": return amount / 52;
      default: return 0;
    }
  }
  function periodsOf(amount, freq){
    var w = toWeekly(amount, freq);
    return { weekly:w, fortnightly:w*2, monthly:w*52/12, quarterly:w*13, yearly:w*52 };
  }
  function sumField(items, field){
    return items.reduce(function(s,i){ return s + periodsOf(i.amount, i.freq)[field]; }, 0);
  }
  function sumByClassification(items, cls, field){
    return items.filter(function(i){ return i.classification === cls; })
                .reduce(function(s,i){ return s + periodsOf(i.amount, i.freq)[field]; }, 0);
  }
  function safeDiv(a, b){ return b ? a / b : 0; }
  function sumByAccount(items, field){
    var map = {};
    items.forEach(function(i){
      var acct = (i.account || "").trim() || "Unassigned";
      var v = periodsOf(i.amount, i.freq)[field];
      map[acct] = (map[acct] || 0) + v;
    });
    return map;
  }

  var fmtCurrency0 = new Intl.NumberFormat("en-AU", {style:"currency", currency:"AUD", maximumFractionDigits:0});
  var fmtCurrency2 = new Intl.NumberFormat("en-AU", {style:"currency", currency:"AUD", minimumFractionDigits:2, maximumFractionDigits:2});
  var fmtPercent1 = new Intl.NumberFormat("en-AU", {style:"percent", maximumFractionDigits:1});

  function recalcComputedItems(){
    state.properties.forEach(function(p){
      if(p.kind !== "IP") return;
      var pmFeeItem = p.expenses.find(function(i){ return i.id === "pmFee6"; });
      if(!pmFeeItem){
        pmFeeItem = { id: "pmFee6", what: "Property Manager Fee", classification: "Needs", account: "", amount: 0, freq: "Weekly", computed: true, computedNote: "" };
        p.expenses.push(pmFeeItem);
      }
      var rentWeekly = toWeekly(sumField(p.income, "yearly") / 52, "Weekly");
      var pmPercent = p.pmFee.percent;
      var pmFlat = p.pmFee.flat;
      pmFeeItem.amount = Math.round((rentWeekly * (pmPercent / 100) + pmFlat) * 100) / 100;
      pmFeeItem.freq = "Weekly";
      pmFeeItem.computedNote = "auto: " + pmPercent + "% of rent + $" + pmFlat.toFixed(2);
    });
    state.scenarios.forEach(function(scenario){
      var cfg = state.purchase[scenario];
      var loanRow = (state.home[scenario] || []).find(function(i){ return i.id === "homeLoanRow"; });
      if(!loanRow) return;
      if(cfg && cfg.enabled && cfg.syncRepayment){
        var out = recalcPurchase(scenario);
        loanRow.amount = Math.round(out.repaymentMonthly * 100) / 100;
        loanRow.freq = "Monthly";
        loanRow.computed = true;
        loanRow.computedNote = "auto: from purchase calculator above";
      } else if(loanRow.computed){
        loanRow.computed = false;
      }
    });

    var people = getTaxPeople();
    state.income = state.income.filter(function(i){ return !(i.syntheticNetFor && people.indexOf(i.syntheticNetFor) === -1); });
    people.forEach(function(person){
      var result = computePersonTax(person);
      var monthly = Math.round((result.netTakeHome / 12) * 100) / 100;
      var existing = state.income.find(function(i){ return i.syntheticNetFor === person; });
      if(existing){
        existing.amount = monthly;
        existing.freq = "Monthly";
        existing.computed = true;
        existing.computedNote = "auto: " + person + "'s net income after tax & super sacrifice";
      } else {
        state.income.push({
          syntheticNetFor: person, computed: true, what: person + " — Net income (after tax & super)",
          classification: "", account: "", incomeType: "Net", amount: monthly, freq: "Monthly",
          computedNote: "auto: " + person + "'s net income after tax & super sacrifice"
        });
      }
    });

    var ipPropertyIds = state.properties.filter(function(p){ return p.kind === "IP"; }).map(function(p){ return p.id; });
    state.income = state.income.filter(function(i){ return !(i.syntheticRentForProperty && ipPropertyIds.indexOf(i.syntheticRentForProperty) === -1); });
    state.properties.filter(function(p){ return p.kind === "IP"; }).forEach(function(p){
      var monthlyRent = sumField(p.income, "monthly");
      var existingRent = state.income.find(function(i){ return i.syntheticRentForProperty === p.id; });
      var note = "auto: rent for " + p.what + " — edit on the Properties tab";
      if(existingRent){
        existingRent.amount = monthlyRent;
        existingRent.freq = "Monthly";
        existingRent.computed = true;
        existingRent.computedNote = note;
      } else {
        state.income.push({
          syntheticRentForProperty: p.id, computed: true, what: p.what + " — Rent",
          classification: "", account: "", incomeType: "Net", amount: monthlyRent, freq: "Monthly",
          computedNote: note
        });
      }
    });
  }


  function scenarioTotals(scenario){
    var incomeMonthly = sumField(effectiveIncomeItems(), "monthly");
    var ipMonthly = ipExpensesMonthly() + ipLoansMonthly();
    var sharedMonthly = sumField(state.shared, "monthly");
    var homeMonthly = sumField(state.home[scenario], "monthly");
    var expensesMonthly = ipMonthly + sharedMonthly + homeMonthly;
    var netMonthly = incomeMonthly - expensesMonthly;
    return {
      incomeMonthly: incomeMonthly, ipMonthly: ipMonthly, sharedMonthly: sharedMonthly,
      homeMonthly: homeMonthly, expensesMonthly: expensesMonthly,
      netMonthly: netMonthly, netYearly: netMonthly * 12,
      rate: incomeMonthly > 0 ? netMonthly / incomeMonthly : 0
    };
  }

  // ---------------- Rendering: cards ----------------
  function renderCards(){
    var el = document.getElementById("cards");
    var allRates = state.scenarios.map(function(s){ return scenarioTotals(s).rate; });
    var maxAbsRate = Math.max.apply(null, allRates.map(Math.abs).concat([0.01]));
    var canDelete = state.scenarios.length > 1;

    var html = state.scenarios.map(function(scenario){
      var t = scenarioTotals(scenario);
      var isActive = state.activeScenario === scenario;
      return (
        '<div class="card-select" role="radio" tabindex="0" aria-checked="' + (isActive ? "true" : "false") + '" data-scenario="' + escapeAttr(scenario) + '">' +
          '<div class="card' + (isActive ? " is-active" : "") + '">' +
            '<div class="card-top">' +
              '<span class="card-name">' + escapeAttr(scenario) + '</span>' +
              '<span class="card-controls">' +
                '<button type="button" class="icon-btn" data-rename="' + escapeAttr(scenario) + '" aria-label="Rename ' + escapeAttr(scenario) + '" title="Rename">✎</button>' +
                (canDelete ? '<button type="button" class="icon-btn icon-del" data-delete="' + escapeAttr(scenario) + '" aria-label="Delete ' + escapeAttr(scenario) + '" title="Delete">✕</button>' : "") +
                '<span class="card-radio"></span>' +
              '</span>' +
            '</div>' +
            '<div>' +
              '<div class="card-savings' + (t.netMonthly < 0 ? " neg" : "") + '">' + fmtCurrency0.format(t.netMonthly) + '<span style="font-size:13px;font-weight:400;color:var(--ink-soft)"> /mo</span></div>' +
              '<div class="card-sub">' + fmtCurrency0.format(t.netYearly) + ' / year net savings</div>' +
            '</div>' +
            '<div class="card-bar-track"><div class="card-bar-fill' + (t.rate < 0 ? " neg" : "") + '" style="width:' + Math.min(100, Math.abs(t.rate) / maxAbsRate * 100) + '%"></div></div>' +
            '<div class="card-stats"><span>Savings rate</span><b>' + fmtPercent1.format(t.rate) + '</b></div>' +
            '<div class="card-stats"><span>Home cost / mo</span><b>' + fmtCurrency0.format(t.homeMonthly) + '</b></div>' +
            '<button type="button" class="card-edit-link" data-edit-scenario="' + escapeAttr(scenario) + '">Edit rent/home loan &amp; purchase calculator →</button>' +
          '</div>' +
        '</div>'
      );
    }).join("") +
    '<button type="button" class="add-card" id="addScenarioBtn"><span class="add-plus">+</span><span class="add-label">Add scenario</span></button>';

    el.innerHTML = html;
    renderDashboardStats();
  }

  function renderDashboardStats(){
    var el = document.getElementById("dashboardStats");
    if(!el || el.closest(".app-page").hidden) return;
    var totalNetWorth = totalNetWorthValue();
    var itemCount = state.assets.length + state.properties.length;
    var active = state.activeScenario;
    var t = scenarioTotals(active);
    var horizon = Math.max(1, Number(state.projection.horizonYears) || 1);
    var series = computeNetWorthSeries(active, horizon);
    var projected = series[series.length - 1].y;
    el.innerHTML =
      '<div class="stat-tile"><span>Total net worth today</span><b>' + fmtCurrency0.format(totalNetWorth) + '</b><small>across ' + itemCount + ' item' + (itemCount === 1 ? "" : "s") + '</small></div>' +
      '<div class="stat-tile"><span>' + escapeAttr(active) + ' — net savings</span><b' + (t.netMonthly < 0 ? ' style="color:var(--bad)"' : '') + '>' + fmtCurrency0.format(t.netMonthly) + '/mo</b><small>' + fmtPercent1.format(t.rate) + ' savings rate</small></div>' +
      '<div class="stat-tile"><span>Projected net worth</span><b>' + fmtCurrency0.format(projected) + '</b><small>in ' + horizon + ' years, ' + escapeAttr(active) + '</small></div>' +
      '<div class="stat-tile"><span>Scenarios compared</span><b>' + state.scenarios.length + '</b><small>' + state.scenarios.map(escapeAttr).join(", ") + '</small></div>';
  }

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

  // ---------------- Rendering: 50/30/20 + accounts ----------------
  function renderDetail(){
    document.getElementById("activeLabel").textContent = state.activeScenario;
    var scenario = state.activeScenario;
    var combined = ipExpenseItemsForClassification().concat(state.shared).concat(state.home[scenario]);
    var incomeMonthly = sumField(effectiveIncomeItems(), "monthly");
    var needs = sumByClassification(combined, "Needs", "monthly");
    var wants = sumByClassification(combined, "Wants", "monthly");
    var t = scenarioTotals(scenario);
    var savings = t.netMonthly;

    var total = Math.max(incomeMonthly, needs + wants + Math.max(savings, 0), 1);
    var needsPct = needs / total, wantsPct = wants / total, savingsPct = Math.max(savings, 0) / total;

    var bar = document.getElementById("ruleBar");
    bar.innerHTML =
      '<div class="rule-seg needs" style="width:' + (needsPct*100) + '%">' + (needsPct > 0.1 ? fmtPercent1.format(safeDiv(needs,incomeMonthly)) : "") + '</div>' +
      '<div class="rule-seg wants" style="width:' + (wantsPct*100) + '%">' + (wantsPct > 0.1 ? fmtPercent1.format(safeDiv(wants,incomeMonthly)) : "") + '</div>' +
      '<div class="rule-seg savings" style="width:' + (savingsPct*100) + '%">' + (savingsPct > 0.1 ? fmtPercent1.format(safeDiv(savings,incomeMonthly)) : "") + '</div>' +
      '<div class="rule-target" style="left:50%"></div>' +
      '<div class="rule-target" style="left:80%"></div>';

    document.getElementById("ruleLegend").innerHTML =
      '<div class="rule-legend-item"><span class="rule-swatch needs"></span>Needs <b>' + fmtCurrency0.format(needs) + '</b> · target 50%</div>' +
      '<div class="rule-legend-item"><span class="rule-swatch wants"></span>Wants <b>' + fmtCurrency0.format(wants) + '</b> · target 30%</div>' +
      '<div class="rule-legend-item"><span class="rule-swatch savings"></span>Savings <b>' + fmtCurrency0.format(savings) + '</b> · target 20%</div>';

    var acctMap = sumByAccount(combined, "monthly");
    var entries = Object.keys(acctMap).map(function(k){ return [k, acctMap[k]]; }).sort(function(a,b){ return b[1]-a[1]; });
    var maxAcct = Math.max.apply(null, entries.map(function(e){ return e[1]; }).concat([1]));
    var acctList = document.getElementById("acctList");
    acctList.innerHTML = entries.length ? entries.map(function(e){
      return '<div class="acct-row"><span class="acct-name" title="' + e[0] + '">' + e[0] + '</span>' +
        '<span class="acct-track"><span class="acct-fill" style="width:' + (e[1]/maxAcct*100) + '%"></span></span>' +
        '<span class="acct-amt">' + fmtCurrency0.format(e[1]) + '</span></div>';
    }).join("") : '<p style="color:var(--ink-soft);font-size:12.5px;margin:0">No expenses yet.</p>';
  }

  // ---------------- Generic ledger table ----------------
  function periodTh(){
    return PERIODS.map(function(p){
      return '<th class="num period-col' + (p.hidden ? " hidden-period" : "") + '" data-period="' + p.key + '">' + p.label + '</th>';
    }).join("");
  }
  function periodTd(item){
    var p = periodsOf(item.amount, item.freq);
    return PERIODS.map(function(pd){
      return '<td class="num computed period-col' + (pd.hidden ? " hidden-period" : "") + '" data-period="' + pd.key + '">' + fmtCurrency2.format(p[pd.key]) + '</td>';
    }).join("");
  }
  function optionsHtml(list, value){
    return list.map(function(o){ return '<option value="' + o + '"' + (o === value ? " selected" : "") + '>' + o + '</option>'; }).join("");
  }

  function buildTable(tableEl, section, items, opts, indices){
    opts = opts || {};
    var showClass = opts.showClass !== false;
    var showIncomeFields = !!opts.showIncomeFields;
    var acctClass = opts.acctColClass || (opts.hideAcctToggle ? "col-account-exp" : "");
    var classClass = opts.hideClassToggle ? "col-classification" : "";
    var thead = '<thead><tr><th>What</th>' +
      (showClass ? '<th' + (classClass ? ' class="' + classClass + '"' : '') + '>Classification</th>' : '') +
      (showIncomeFields ? '<th class="col-person">Person</th><th class="col-type">Type</th><th class="col-super">Super</th><th class="col-sacrifice">Cash / Sacrifice</th>' : '') +
      '<th' + (showIncomeFields ? ' class="col-account"' : acctClass ? ' class="' + acctClass + '"' : '') + '>Account</th><th class="num">Amount</th><th>Frequency</th>' + periodTh() + '<th></th></tr></thead>';
    var rows = items.map(function(item, idx){ return rowHtml(section, item, indices ? indices[idx] : idx, showClass, showIncomeFields, acctClass, classClass); }).join("");
    tableEl.innerHTML = thead + "<tbody>" + rows + "</tbody>";
  }

  function rowHtml(section, item, idx, showClass, showIncomeFields, acctClass, classClass){
    var isComputed = !!item.computed;
    var isGrossRef = showIncomeFields && item.incomeType === "Gross" && !isComputed;
    var rowClass = (isComputed ? " is-computed" : (isGrossRef ? " is-gross-ref" : "")) + (item.id === "homeLoanRow" ? " is-home-loan-row" : "");
    return '<tr data-section="' + section + '" data-index="' + idx + '"' + (rowClass ? ' class="' + rowClass.trim() + '"' : "") + '>' +
      '<td class="what-cell"><input type="text" class="f-what" value="' + escapeAttr(item.what) + '" aria-label="Item name">' +
        (item.syntheticNetFor ? '<button type="button" class="row-breakdown-toggle" data-breakdown-person="' + escapeAttr(item.syntheticNetFor) + '" aria-expanded="false">▸ Breakdown</button>' : "") +
      '</td>' +
      (showClass ? '<td class="class-cell' + (classClass ? " " + classClass : "") + '"><select class="f-class">' + optionsHtml(CLASSES, item.classification || "Needs") + '</select></td>' : '') +
      (showIncomeFields ? (
        '<td class="account-cell col-person"><input type="text" class="f-person" list="personSuggestions" value="' + escapeAttr(item.person || "") + '" aria-label="Person" placeholder="—"' + (isComputed ? " disabled" : "") + '></td>' +
        '<td class="freq-cell col-type"><select class="f-incometype"' + (isComputed ? " disabled" : "") + '>' + optionsHtml(INCOME_TYPES, item.incomeType || "Net") + '</select></td>' +
        '<td class="freq-cell col-super"><select class="f-superincluded" title="Whether super is already included in the Amount, or paid on top"' + (isComputed ? " disabled" : "") + '>' + optionsHtml(SUPER_MODES, item.superIncluded ? "Included" : "On top") + '</select></td>' +
        '<td class="freq-cell sacrifice-cell col-sacrifice"><div class="sacrifice-wrap"><select class="f-sacrificemode" title="Take this item as cash, or redirect part of it into super instead"' + (isComputed ? " disabled" : "") + '>' + optionsHtml(SACRIFICE_MODES, sacrificeModeToLabel(item.sacrificeMode)) + '</select>' +
          (!isComputed && item.sacrificeMode && item.sacrificeMode !== "none" ? '<input type="number" min="0" step="' + (item.sacrificeMode === "percent" ? "1" : "50") + '" max="' + (item.sacrificeMode === "percent" ? "100" : "") + '" class="f-sacrificevalue" value="' + (item.sacrificeValue || 0) + '" aria-label="Sacrifice ' + (item.sacrificeMode === "percent" ? "percent" : "amount") + '">' : '') +
        '</div></td>'
      ) : '') +
      '<td class="account-cell' + (showIncomeFields ? " col-account" : acctClass ? " " + acctClass : "") + '"><input type="text" class="f-account" list="acctSuggestions" value="' + escapeAttr(item.account || "") + '" aria-label="Account"' + (isComputed ? " disabled" : "") + '></td>' +
      '<td class="amount-cell"><input type="number" step="0.01" min="0" class="f-amount" value="' + item.amount + '"' + (isComputed ? " readonly" : "") + ' aria-label="Amount">' +
        (isComputed ? '<span class="computed-note">' + escapeAttr(item.computedNote || "auto-calculated") + '</span>' : "") + '</td>' +
      '<td class="freq-cell"><select class="f-freq"' + (isComputed ? " disabled" : "") + '>' + optionsHtml(FREQS, item.freq) + '</select></td>' +
      periodTd(item) +
      '<td>' + (isComputed ? "" : '<button class="btn btn-ghost btn-sm row-del" data-del="' + section + ':' + idx + '" aria-label="Delete row">✕</button>') + '</td>' +
      '</tr>';
  }
  function escapeAttr(s){ return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }

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
      if(mHome){ var hi = state.scenarios.indexOf(mHome[1]); buildTable(document.getElementById("homeTable_" + slug(mHome[1]) + hi), section, state.home[mHome[1]], {showClass:true, acctColClass:"col-account-home"}); }
      var mPropInc = /^propinc:(.+)$/.exec(section);
      if(mPropInc){ var pi = findProperty(mPropInc[1]); if(pi) buildTable(document.getElementById("propIncomeTable_" + pi.id), section, pi.income, {showClass:false}); }
      var mPropExp = /^propexp:(.+)$/.exec(section);
      if(mPropExp){ var pe = findProperty(mPropExp[1]); if(pe) buildTable(document.getElementById("propExpTable_" + pe.id), section, pe.expenses, {showClass:true, hideAcctToggle:true, hideClassToggle:true}); }
    }
    applyPeriodVisibility();
  }

  function incomeGroupKey(item){
    if(item.syntheticNetFor) return item.syntheticNetFor;
    if(item.person) return item.person;
    return "__household";
  }

  function incomeGroupOrder(){
    var order = getTaxPeople().slice();
    state.income.forEach(function(item){
      var key = incomeGroupKey(item);
      if(key !== "__household" && order.indexOf(key) === -1) order.push(key);
    });
    if(state.income.some(function(item){ return incomeGroupKey(item) === "__household"; })) order.push("__household");
    return order;
  }

  function computeIncomeGroups(){
    return incomeGroupOrder().map(function(key){
      var indices = [];
      var items = [];
      state.income.forEach(function(item, idx){
        if(incomeGroupKey(item) === key){ indices.push(idx); items.push(item); }
      });
      return { key: key, indices: indices, items: items, monthly: sumField(items.filter(function(i){ return i.incomeType !== "Gross"; }), "monthly") };
    });
  }

  function patchOpenRowBreakdowns(){
    document.querySelectorAll(".row-breakdown-row").forEach(function(rowEl){
      var person = rowEl.getAttribute("data-breakdown-person");
      var cell = rowEl.querySelector("td");
      if(cell && person) cell.innerHTML = personBreakdownHtml(person);
    });
  }

  function patchIncomeGroupTotals(){
    var groups = computeIncomeGroups();
    var summaryEl = document.getElementById("incomeSummaryLine");
    if(summaryEl){
      if(groups.length > 1){
        var total = groups.reduce(function(s, g){ return s + g.monthly; }, 0);
        var parts = groups.map(function(g){ return (g.key === "__household" ? "Household" : g.key) + " " + fmtCurrency0.format(g.monthly); }).join(" + ");
        summaryEl.innerHTML = "Adds up: " + parts + " = <b>" + fmtCurrency0.format(total) + " / mo</b> total household income";
        summaryEl.style.display = "";
      } else {
        summaryEl.style.display = "none";
      }
    }
    document.querySelectorAll("#incomeGroups .income-group-total").forEach(function(el, gi){
      if(groups[gi]) el.textContent = fmtCurrency0.format(groups[gi].monthly) + " / mo";
    });
  }

  function renderIncomeGroups(){
    var container = document.getElementById("incomeGroups");
    if(!container) return;
    var groups = computeIncomeGroups();
    patchIncomeGroupTotals();
    container.innerHTML = groups.map(function(g, gi){
      var label = g.key === "__household" ? "Household / shared" : g.key;
      var addValue = g.key === "__household" ? "" : g.key;
      var hasGrossRows = g.items.some(function(i){ return i.incomeType === "Gross" && !i.computed; });
      return '<div class="income-group"><div class="income-group-head">' +
        '<div class="income-group-head-left"><h4>' + escapeAttr(label) + '</h4></div>' +
        '<div class="income-group-total">' + fmtCurrency0.format(g.monthly) + ' / mo</div>' +
        '</div>' +
        (hasGrossRows ? '<p class="income-group-note">Gross rows below are reference only, excluded from the total — see “' + escapeAttr(g.key) + ' — Net income” for the actual after-tax contribution.</p>' : '') +
        '<div class="table-scroll"><table class="ledger-table" id="incomeGroupTable' + gi + '"></table></div>' +
        '<button type="button" class="btn btn-sm btn-ghost group-add-btn" data-add="income:' + escapeAttr(addValue) + '">+ Add to ' + escapeAttr(label) + '</button></div>';
    }).join("");
    groups.forEach(function(g, gi){
      buildTable(document.getElementById("incomeGroupTable" + gi), "income", g.items, {showClass:false, showIncomeFields:true}, g.indices);
    });
  }

  function sharedGroupOrder(){
    return CLASSES.filter(function(cls){
      return state.shared.some(function(item){ return (item.classification || "N/A") === cls; });
    });
  }

  function computeSharedGroups(){
    return sharedGroupOrder().map(function(cls){
      var indices = [];
      var items = [];
      state.shared.forEach(function(item, idx){
        if((item.classification || "N/A") === cls){ indices.push(idx); items.push(item); }
      });
      return { key: cls, indices: indices, items: items, monthly: sumField(items, "monthly") };
    });
  }

  function patchSharedGroupTotals(){
    var groups = computeSharedGroups();
    var summaryEl = document.getElementById("sharedSummaryLine");
    if(summaryEl){
      if(groups.length > 1){
        var total = groups.reduce(function(s, g){ return s + g.monthly; }, 0);
        var parts = groups.map(function(g){ return g.key + " " + fmtCurrency0.format(g.monthly); }).join(" + ");
        summaryEl.innerHTML = "Adds up: " + parts + " = <b>" + fmtCurrency0.format(total) + " / mo</b> total shared expenses";
        summaryEl.style.display = "";
      } else {
        summaryEl.style.display = "none";
      }
    }
    document.querySelectorAll("#sharedGroups .income-group-total").forEach(function(el, gi){
      if(groups[gi]) el.textContent = fmtCurrency0.format(groups[gi].monthly) + " / mo";
    });
  }

  function renderSharedGroups(){
    var container = document.getElementById("sharedGroups");
    if(!container) return;
    var groups = computeSharedGroups();
    patchSharedGroupTotals();
    container.innerHTML = groups.map(function(g, gi){
      return '<div class="income-group"><div class="income-group-head">' +
        '<div class="income-group-head-left"><h4>' + escapeAttr(g.key) + '</h4></div>' +
        '<div class="income-group-total">' + fmtCurrency0.format(g.monthly) + ' / mo</div>' +
        '</div><div class="table-scroll"><table class="ledger-table" id="sharedGroupTable' + gi + '"></table></div>' +
        '<button type="button" class="btn btn-sm btn-ghost group-add-btn" data-add="shared:' + escapeAttr(g.key) + '">+ Add to ' + escapeAttr(g.key) + '</button></div>';
    }).join("");
    groups.forEach(function(g, gi){
      buildTable(document.getElementById("sharedGroupTable" + gi), "shared", g.items, {showClass:true, hideAcctToggle:true, hideClassToggle:true}, g.indices);
    });
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

  function renderHomeBody(){
    var body = document.getElementById("homeBody");
    var canDelete = state.scenarios.length > 1;
    body.innerHTML = state.scenarios.map(function(scenario, i){
      var isActive = state.activeScenario === scenario;
      var total = sumField(state.home[scenario], "monthly");
      return '<div class="home-block' + (isActive ? " is-active" : "") + '">' +
        '<div class="home-block-head">' +
          '<div class="home-block-head-left"><span class="home-dot"></span><h4>' + escapeAttr(scenario) + '</h4>' +
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
        renderPurchasePanelHtml(scenario) +
        '<div class="home-recurring-label">Recurring costs — per month</div>' +
        '<p class="income-summary-line home-recon-line">' + homeReconciliationHtml(scenario) + '</p>' +
        '<div class="table-scroll"><table class="ledger-table" id="homeTable_' + slug(scenario) + i + '"></table></div>' +
        '<div class="ledger-footer"><button class="btn btn-sm" data-add="home:' + escapeAttr(scenario) + '">+ Add item</button></div>' +
        '</div>';
    }).join("") +
    '<button type="button" class="add-scenario-row" id="addScenarioBtn2"><span class="add-plus" style="font-size:16px">+</span> Add another scenario</button>';
    state.scenarios.forEach(function(scenario, i){
      buildTable(document.getElementById("homeTable_" + slug(scenario) + i), "home:" + scenario, state.home[scenario], {showClass:true, acctColClass:"col-account-home"});
    });
    applyPeriodVisibility();
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
      var costsRows = (cfg.otherCosts || []).map(function(c, ci){
        return '<tr>' +
          '<td><input type="text" class="cc-what" value="' + escapeAttr(c.what) + '" aria-label="Cost name"></td>' +
          '<td class="cc-amount-cell"><input type="number" step="1" min="0" class="cc-amount" value="' + c.amount + '" aria-label="Cost amount"></td>' +
          '<td class="cc-del"><button type="button" class="btn btn-ghost btn-sm row-del" data-cc-del="' + ci + '" aria-label="Remove cost">✕</button></td>' +
          '</tr>';
      }).join("");
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
            '<div class="calc-field" title="Rate for a standard principal &amp; interest loan — get your bank/broker\'s quoted rate for an accurate comparison."><label>Interest rate % p.a. (P&amp;I)</label><input type="number" step="0.05" min="0" class="calc-rate" value="' + cfg.rate + '"></div>' +
            '<div class="calc-field" title="Interest-only rate — lenders usually price this higher than P&amp;I. Get the actual IO rate quoted by your bank, don\'t assume it matches P&amp;I."><label>Interest rate % p.a. (IO)</label><input type="number" step="0.05" min="0" class="calc-iorate" value="' + cfg.ioRate + '"></div>' +
            '<div class="calc-field" title="Which repayment feeds your budget below and the long-term projection. Both are shown for comparison regardless of this choice."><label>Repayment type used</label><select class="calc-repaymenttype"><option value="PI"' + (cfg.repaymentType !== "IO" ? " selected" : "") + '>Principal &amp; interest</option><option value="IO"' + (cfg.repaymentType === "IO" ? " selected" : "") + '>Interest only</option></select></div>' +
            '<div class="calc-field"><label>First home buyer <span class="calc-help" title="Applies first-home-buyer stamp duty savings: full exemption below $800k (NSW) / $600k (VIC), tapering down to no discount at $1M (NSW) / $750k (VIC). No effect when State is \'Other\' — stamp duty is entered manually there.">ⓘ</span></label><label class="calc-check-inline"><input type="checkbox" class="calc-fhb"' + (cfg.firstHomeBuyer ? " checked" : "") + '> Yes</label></div>' +
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
            '<table class="calc-costs-table">' + costsRows + '</table>' +
            '<button type="button" class="btn btn-sm" style="margin-top:8px" data-cc-add="1">+ Add cost</button>' +
          '</div>' +
          '<label style="display:flex;align-items:center;gap:7px;font-size:12.5px;cursor:pointer">' +
            '<input type="checkbox" class="calc-sync" style="width:14px;height:14px;accent-color:var(--brass)"' + (cfg.syncRepayment ? " checked" : "") + '> Use this repayment as "Rent / Home Loan" below' +
          '</label>' +
          '<p class="calc-note">P&amp;I repayment is exact (standard amortisation). Interest-only repayment is simplified — modelled flat for the full loan term rather than a fixed IO period reverting to P&amp;I, and the projection assumes the balance never reduces while IO is selected. Stamp duty (NSW/VIC) and LMI are estimates based on published general scales and typical lender premiums — all rates and fees vary by lender/insurer and change over time, so confirm exact figures with your bank, broker or state revenue office before relying on them.</p>' +
        '</div>';
    }
    return (
      '<div class="calc-panel" data-calc-scenario="' + escapeAttr(scenario) + '">' +
        '<label class="calc-enable"><input type="checkbox" class="calc-enabled"' + (enabled ? " checked" : "") + '> This is a property purchase — show the calculator</label>' +
        body +
      '</div>'
    );
  }

  function applyPeriodVisibility(){
    var show = state.showAllPeriods;
    document.querySelectorAll(".period-col").forEach(function(el){
      var isHiddenByDefault = PERIODS.find(function(p){ return p.key === el.getAttribute("data-period"); }).hidden;
      el.classList.toggle("hidden-period", isHiddenByDefault && !show);
    });
    INCOME_COL_DEFS.forEach(function(c){
      var visible = state.incomeCols[c.key] !== false;
      document.querySelectorAll(".col-" + c.key).forEach(function(el){
        el.classList.toggle("col-hidden", !visible);
      });
    });
    var expAcctVisible = !!state.expenseCols.account;
    document.querySelectorAll(".col-account-exp").forEach(function(el){
      el.classList.toggle("col-hidden", !expAcctVisible);
    });
    var expClassVisible = !!state.expenseCols.classification;
    document.querySelectorAll(".col-classification").forEach(function(el){
      el.classList.toggle("col-hidden", !expClassVisible);
    });
    var homeAcctVisible = !!state.homeCols.account;
    document.querySelectorAll(".col-account-home").forEach(function(el){
      el.classList.toggle("col-hidden", !homeAcctVisible);
    });
  }

  function renderTotals(){
    document.getElementById("totalIncomeMonthly").textContent = fmtCurrency2.format(sumField(effectiveIncomeItems(), "monthly"));
    document.getElementById("totalSharedMonthly").textContent = fmtCurrency2.format(sumField(state.shared, "monthly"));
  }

  // ---------------- Event wiring ----------------
  function patchSyntheticIncomeRows(){
    var table = document.getElementById("incomeGroups");
    if(!table) return;
    state.income.forEach(function(item, idx){
      if(!item.syntheticNetFor && !item.syntheticRentForProperty) return;
      var tr = table.querySelector('tr[data-index="' + idx + '"]');
      if(!tr) return;
      var amountInput = tr.querySelector(".f-amount");
      if(amountInput) amountInput.value = item.amount;
      var cells = tr.querySelectorAll("td.computed");
      var p = periodsOf(item.amount, item.freq);
      PERIODS.forEach(function(pd, i){ if(cells[i]) cells[i].textContent = fmtCurrency2.format(p[pd.key]); });
    });
  }

  function onLedgerInput(e){
    var tr = e.target.closest("tr[data-section]");
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
    else if(e.target.classList.contains("f-superincluded")){ item.superIncluded = e.target.value === "Included"; }
    else if(e.target.classList.contains("f-sacrificemode")){ item.sacrificeMode = sacrificeLabelToMode(e.target.value); structural = true; }
    else if(e.target.classList.contains("f-sacrificevalue")){ item.sacrificeValue = parseFloat(e.target.value) || 0; }
    else return;

    if(e.target.classList.contains("f-amount") || e.target.classList.contains("f-freq")){
      var cells = tr.querySelectorAll("td.computed");
      var p = periodsOf(item.amount, item.freq);
      PERIODS.forEach(function(pd, i){ cells[i].textContent = fmtCurrency2.format(p[pd.key]); });
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
    document.querySelectorAll('.home-block').forEach(function(block, i){
      var scenario = state.scenarios[i];
      var monthly = sumField(state.home[scenario], "monthly");
      var totalSpan = block.querySelector('.home-block-total');
      if(totalSpan) totalSpan.textContent = fmtCurrency0.format(monthly) + " / mo";
      var reconLine = block.querySelector('.home-recon-line');
      if(reconLine) reconLine.innerHTML = homeReconciliationHtml(scenario);
    });
  }

  // ---------------- Purchase calculator: wiring ----------------
  function getHomeTableEl(scenario){
    var i = state.scenarios.indexOf(scenario);
    if(i === -1) return null;
    return document.getElementById("homeTable_" + slug(scenario) + i);
  }

  function patchHomeLoanRowIfSynced(scenario){
    var cfg = state.purchase[scenario];
    if(!cfg || !cfg.enabled || !cfg.syncRepayment) return;
    var arr = state.home[scenario] || [];
    var idx = arr.findIndex(function(i){ return i.id === "homeLoanRow"; });
    if(idx === -1) return;
    var item = arr[idx];
    var table = getHomeTableEl(scenario);
    if(!table) return;
    var tr = table.querySelector('tr[data-index="' + idx + '"]');
    if(!tr) return;
    var amountInput = tr.querySelector(".f-amount");
    if(amountInput) amountInput.value = item.amount;
    var cells = tr.querySelectorAll("td.computed");
    var p = periodsOf(item.amount, item.freq);
    PERIODS.forEach(function(pd, i){ if(cells[i]) cells[i].textContent = fmtCurrency2.format(p[pd.key]); });
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
    else if(t.classList.contains("cc-what") || t.classList.contains("cc-amount")){
      var tr = t.closest("tr");
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
  function assetTrendHtml(item){
    var hist = item.history;
    if(!hist || hist.length < 2) return "";
    var last = hist[hist.length - 1], prev = hist[hist.length - 2];
    var delta = last.value - prev.value;
    var pct = prev.value ? (delta / Math.abs(prev.value)) : 0;
    var cls = delta > 0 ? "up" : (delta < 0 ? "down" : "");
    var arrow = delta > 0 ? "▲" : (delta < 0 ? "▼" : "–");
    return '<div class="asset-trend ' + cls + '">' + arrow + ' ' + fmtCurrency0.format(Math.abs(delta)) +
      ' (' + fmtPercent1.format(Math.abs(pct)) + ') since ' + escapeAttr(prev.date) + '</div>';
  }

  function assetRowHtml(item, idx){
    return '<tr data-index="' + idx + '">' +
      '<td><input type="text" class="a-what" value="' + escapeAttr(item.what) + '" aria-label="Asset name">' + assetTrendHtml(item) + '</td>' +
      '<td><select class="a-category" title="Move to a different category" aria-label="Category">' + optionsHtml(ASSET_CATEGORIES, item.category) + '</select></td>' +
      '<td class="num"><input type="number" step="100" min="0" class="a-amount" value="' + item.amount + '" aria-label="Asset value"></td>' +
      '<td><button type="button" class="asset-log-btn" data-asset-log="' + idx + '" title="Snapshot the value above with today\'s date, so it shows up in the portfolio-over-time chart below">Log</button></td>' +
      '<td><button type="button" class="btn btn-ghost btn-sm row-del" data-asset-del="' + idx + '" aria-label="Delete asset">✕</button></td>' +
      '</tr>';
  }

  function gainLossHtml(item){
    if(item.avgCost == null || item.avgCost === "") return '<span class="calc-note">—</span>';
    var qty = Number(item.quantity) || 0;
    var cost = Number(item.avgCost) || 0;
    var price = Number(item.price) || 0;
    var gainDollar = (price - cost) * qty;
    var pct = cost ? (price - cost) / cost : 0;
    var cls = gainDollar > 0 ? "up" : (gainDollar < 0 ? "down" : "");
    var arrow = gainDollar > 0 ? "▲" : (gainDollar < 0 ? "▼" : "–");
    return '<span class="asset-trend gain-cell ' + cls + '">' + arrow + ' ' + fmtCurrency0.format(Math.abs(gainDollar)) +
      ' (' + fmtPercent1.format(Math.abs(pct)) + ')</span>';
  }

  function holdingRowHtml(item, idx){
    var qty = Number(item.quantity) || 0;
    var price = Number(item.price) || 0;
    return '<tr data-index="' + idx + '">' +
      '<td><input type="text" class="h-what" value="' + escapeAttr(item.what) + '" aria-label="Holding name">' + assetTrendHtml(item) + '</td>' +
      '<td><input type="text" class="h-symbol" value="' + escapeAttr(item.symbol || "") + '" placeholder="e.g. CBA" aria-label="Ticker symbol"></td>' +
      '<td><select class="h-market">' + optionsHtml(SHARE_MARKETS, item.market || "ASX") + '</select></td>' +
      '<td class="num"><input type="number" step="1" min="0" class="h-qty" value="' + qty + '" aria-label="Quantity"></td>' +
      '<td class="num"><input type="number" step="0.01" min="0" class="h-avgcost" value="' + (item.avgCost != null ? item.avgCost : "") + '" placeholder="—" aria-label="Average cost per share"></td>' +
      '<td class="num"><input type="number" step="0.01" min="0" class="h-price" value="' + price + '" aria-label="Current price per share">' +
        (item.priceUpdated ? '<span class="computed-note h-price-note">as of ' + escapeAttr(item.priceUpdated) + '</span>' : '<span class="computed-note h-price-note"></span>') + '</td>' +
      '<td class="num h-value-cell">' + fmtCurrency0.format(qty * price) + '</td>' +
      '<td class="h-gain-cell">' + gainLossHtml(item) + '</td>' +
      '<td><input type="text" class="h-person" list="personSuggestions" value="' + escapeAttr(item.person || "") + '" placeholder="Household" aria-label="Person"></td>' +
      '<td><button type="button" class="asset-log-btn" data-asset-log="' + idx + '" title="Snapshot the value above with today\'s date, so it shows up in the portfolio-over-time chart below">Log</button></td>' +
      '<td><button type="button" class="btn btn-ghost btn-sm row-del" data-asset-del="' + idx + '" aria-label="Delete holding">✕</button></td>' +
      '</tr>';
  }

  function patchHoldingRow(tr, item){
    var qty = Number(item.quantity) || 0;
    var price = Number(item.price) || 0;
    var valueCell = tr.querySelector(".h-value-cell");
    if(valueCell) valueCell.textContent = fmtCurrency0.format(qty * price);
    var gainCell = tr.querySelector(".h-gain-cell");
    if(gainCell) gainCell.innerHTML = gainLossHtml(item);
    var priceNote = tr.querySelector(".h-price-note");
    if(priceNote) priceNote.textContent = item.priceUpdated ? ("as of " + item.priceUpdated) : "";
  }

  function assetPersonGroupKey(item){
    return item.person ? item.person : "__household";
  }

  function computeHoldingPersonGroups(items, indices){
    var order = [];
    items.forEach(function(item){
      var key = assetPersonGroupKey(item);
      if(order.indexOf(key) === -1) order.push(key);
    });
    if(order.indexOf("__household") !== -1){
      order.splice(order.indexOf("__household"), 1);
      order.push("__household");
    }
    return order.map(function(key){
      var subItems = [], subIndices = [];
      items.forEach(function(item, i){
        if(assetPersonGroupKey(item) === key){ subItems.push(item); subIndices.push(indices[i]); }
      });
      var total = subItems.reduce(function(s, a){ return s + (Number(a.amount) || 0); }, 0);
      return { key: key, items: subItems, indices: subIndices, total: total };
    });
  }

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

  function totalAssetsValue(){
    return state.assets.reduce(function(s, a){ return s + (Number(a.amount) || 0); }, 0);
  }

  function propertyEquityToday(property){
    var loanNet = (property.loans || []).reduce(function(s, l){
      return s + Math.max(0, (Number(l.balance) || 0) - (Number(l.offsetBalance) || 0));
    }, 0);
    return (Number(property.value) || 0) - loanNet;
  }
  function propertiesTotalEquityToday(){
    return state.properties.reduce(function(s, p){ return s + propertyEquityToday(p); }, 0);
  }
  function totalNetWorthValue(){
    return totalAssetsValue() + propertiesTotalEquityToday();
  }

  function assetCategoryItems(cat){
    var items = [], indices = [];
    state.assets.forEach(function(a, idx){ if((a.category || "Other") === cat){ items.push(a); indices.push(idx); } });
    return { items: items, indices: indices };
  }

  function showAssetsSubpage(id){
    document.querySelectorAll(".assets-subpage").forEach(function(el){ el.hidden = el.id !== "assetsSub-" + id; });
    document.querySelectorAll("#assetsSubnav .subnav-item").forEach(function(btn){
      btn.classList.toggle("active", btn.getAttribute("data-assets-sub") === id);
    });
  }

  function renderAssetCategoryPage(cat){
    var container = document.getElementById("assetsSub-" + cat);
    if(!container) return;
    var data = assetCategoryItems(cat);
    var total = data.items.reduce(function(s, a){ return s + (Number(a.amount) || 0); }, 0);
    var footerBtn = '<button type="button" class="btn btn-sm' + (data.items.length ? " btn-ghost" : "") + '" data-add="assets:' + escapeAttr(cat) + '">+ Add ' + escapeAttr(cat) + '</button>';
    var body = data.items.length
      ? '<div class="table-scroll"><table class="assets-table" id="assetCatTable-' + cat + '"></table></div><div class="ledger-footer">' + footerBtn + '</div>'
      : '<p class="ledger-note" style="margin:0 0 12px">No ' + escapeAttr(cat) + ' tracked yet.</p>' + footerBtn;
    container.innerHTML = '<div class="ledgers"><details class="ledger" open>' +
      '<summary><div class="ledger-title"><svg class="ledger-caret" width="9" height="9" viewBox="0 0 8 8"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg><h2 class="section-title">' + escapeAttr(cat) + '</h2></div>' +
      '<div class="ledger-total">Total <b>' + fmtCurrency0.format(total) + '</b></div></summary>' +
      '<div class="ledger-body">' + body + '</div></details></div>';
    if(data.items.length){
      var thead = '<thead><tr><th>What</th><th>Category</th><th class="num">Value</th><th></th><th></th></tr></thead>';
      var rows = data.items.map(function(item, i){ return assetRowHtml(item, data.indices[i]); }).join("");
      document.getElementById("assetCatTable-" + cat).innerHTML = thead + "<tbody>" + rows + "</tbody>";
    }
  }

  function renderSharesSubpage(){
    var container = document.getElementById("assetsSub-Shares");
    if(!container) return;
    var data = assetCategoryItems("Shares");
    var total = data.items.reduce(function(s, a){ return s + (Number(a.amount) || 0); }, 0);
    var personGroups = computeHoldingPersonGroups(data.items, data.indices);
    var body;
    if(!personGroups.length){
      body = '<p class="ledger-note" style="margin:0 0 12px">No share holdings yet.</p>' +
        '<button type="button" class="btn btn-sm" data-add="holding" title="Track an individual shareholding — symbol, quantity, cost, and value">+ Add share holding</button>';
    } else {
      body = personGroups.map(function(pg, pi){
        var label = pg.key === "__household" ? "Household / shared" : pg.key;
        var addValue = pg.key === "__household" ? "" : pg.key;
        return '<div class="holding-subgroup"><div class="income-group-head">' +
          '<div class="income-group-head-left"><h4>' + escapeAttr(label) + '</h4></div>' +
          '<div class="income-group-total">' + fmtCurrency0.format(pg.total) + '</div>' +
          '</div><div class="table-scroll"><table class="assets-table holdings-table" id="holdingGroupTable_' + pi + '"></table></div>' +
          '<button type="button" class="btn btn-sm btn-ghost group-add-btn" data-add="holding:' + escapeAttr(addValue) + '">+ Add holding to ' + escapeAttr(label) + '</button></div>';
      }).join("");
    }
    container.innerHTML = '<div class="ledgers"><details class="ledger" open>' +
      '<summary><div class="ledger-title"><svg class="ledger-caret" width="9" height="9" viewBox="0 0 8 8"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg><h2 class="section-title">Shares</h2></div>' +
      '<div class="ledger-total">Total <b>' + fmtCurrency0.format(total) + '</b></div></summary>' +
      '<div class="ledger-body">' + body + '</div></details></div>';
    personGroups.forEach(function(pg, pi){
      var tableEl = document.getElementById("holdingGroupTable_" + pi);
      var thead = '<thead><tr><th>What</th><th>Symbol</th><th>Mkt</th><th class="num">Qty</th><th class="num">Avg cost</th><th class="num">Price</th><th class="num">Value</th><th>Gain/Loss</th><th>Person</th><th></th><th></th></tr></thead>';
      var rows = pg.items.map(function(item, i){ return holdingRowHtml(item, pg.indices[i]); }).join("");
      tableEl.innerHTML = thead + "<tbody>" + rows + "</tbody>";
    });
  }

  var ASSET_ALLOC_SEGMENTS = [
    { key: "Cash", colorClass: "series-color-0" },
    { key: "Shares", colorClass: "series-color-2" },
    { key: "Super", colorClass: "series-color-6" },
    { key: "Other", colorClass: "series-color-3" },
    { key: "Property", colorClass: "series-color-1" }
  ];
  function assetAllocationValues(){
    var values = {};
    ASSET_CATEGORIES.forEach(function(cat){ values[cat] = assetCategoryItems(cat).items.reduce(function(s, a){ return s + (Number(a.amount) || 0); }, 0); });
    values.Property = propertiesTotalEquityToday();
    return values;
  }
  function renderAssetAllocationHtml(){
    var values = assetAllocationValues();
    var whole = ASSET_ALLOC_SEGMENTS.reduce(function(s, seg){ return s + Math.max(0, values[seg.key]); }, 0);
    if(whole <= 0) return '<p class="ledger-note" style="margin:0">Add some assets or properties to see your allocation.</p>';
    var bar = ASSET_ALLOC_SEGMENTS.filter(function(seg){ return values[seg.key] > 0; }).map(function(seg){
      return '<div class="tax-waterfall-seg ' + seg.colorClass + '" style="flex:' + values[seg.key] + ' 1 0%" title="' + seg.key + ': ' + fmtCurrency0.format(values[seg.key]) + ' (' + fmtPercent1.format(values[seg.key] / whole) + ')"></div>';
    }).join("");
    var legend = ASSET_ALLOC_SEGMENTS.filter(function(seg){ return values[seg.key] > 0; }).map(function(seg){
      return '<div class="tax-waterfall-item"><span class="proj-swatch ' + seg.colorClass + '"></span><div class="tax-waterfall-item-text"><span class="tax-waterfall-item-label">' + seg.key + '</span><span class="tax-waterfall-item-value">' + fmtCurrency0.format(values[seg.key]) + '</span></div></div>';
    }).join("");
    return '<div class="tax-waterfall-bar">' + bar + '</div><div class="tax-waterfall-legend">' + legend + '</div>';
  }

  function renderAssetsSummary(){
    var statsEl = document.getElementById("assetsSummaryStats");
    if(statsEl){
      var liquid = state.assets.filter(function(a){ return LIQUID_CATEGORIES.indexOf(a.category) !== -1; })
        .reduce(function(s, a){ return s + (Number(a.amount) || 0); }, 0);
      var illiquid = totalAssetsValue() - liquid;
      var propEquity = propertiesTotalEquityToday();
      statsEl.innerHTML =
        '<div class="stat-tile"><span>Total net worth</span><b>' + fmtCurrency0.format(totalNetWorthValue()) + '</b><small>assets + property equity</small></div>' +
        '<div class="stat-tile"><span>Liquid assets</span><b>' + fmtCurrency0.format(liquid) + '</b><small>Cash + Shares</small></div>' +
        '<div class="stat-tile"><span>Illiquid assets</span><b>' + fmtCurrency0.format(illiquid) + '</b><small>Super + Other</small></div>' +
        '<div class="stat-tile"><span>Property equity</span><b>' + fmtCurrency0.format(propEquity) + '</b><small>across ' + state.properties.length + ' propert' + (state.properties.length === 1 ? "y" : "ies") + '</small></div>';
    }
    var allocEl = document.getElementById("assetsAllocation");
    if(allocEl) allocEl.innerHTML = renderAssetAllocationHtml();
  }

  function patchAssetCategoryTotals(){
    ASSET_CATEGORIES.forEach(function(cat){
      if(cat === "Shares") return;
      var data = assetCategoryItems(cat);
      var total = data.items.reduce(function(s, a){ return s + (Number(a.amount) || 0); }, 0);
      var container = document.getElementById("assetsSub-" + cat);
      var totalEl = container && container.querySelector(".ledger-total b");
      if(totalEl) totalEl.textContent = fmtCurrency0.format(total);
    });
    var sharesData = assetCategoryItems("Shares");
    var sharesTotal = sharesData.items.reduce(function(s, a){ return s + (Number(a.amount) || 0); }, 0);
    var sharesContainer = document.getElementById("assetsSub-Shares");
    var sharesTotalEl = sharesContainer && sharesContainer.querySelector(".ledger-total b");
    if(sharesTotalEl) sharesTotalEl.textContent = fmtCurrency0.format(sharesTotal);
    var personGroups = computeHoldingPersonGroups(sharesData.items, sharesData.indices);
    document.querySelectorAll("#assetsSub-Shares .holding-subgroup .income-group-total").forEach(function(el, pi){
      if(personGroups[pi]) el.textContent = fmtCurrency0.format(personGroups[pi].total);
    });
    renderAssetsSummary();
  }

  function renderNetWorthPanel(){
    var total = totalNetWorthValue();
    var liquid = state.assets.filter(function(a){ return LIQUID_CATEGORIES.indexOf(a.category) !== -1; })
                              .reduce(function(s, a){ return s + (Number(a.amount) || 0); }, 0);
    var purchaseScenarios = state.scenarios.filter(function(s){ return state.purchase[s] && state.purchase[s].enabled; });
    var panel = document.getElementById("netWorthPanel");
    if(!purchaseScenarios.length){
      panel.innerHTML = '<p style="color:var(--ink-soft);font-size:12.5px;margin-top:14px">Turn on the purchase calculator for a scenario (under &quot;Your home&quot;) to see how buying would affect your net worth.</p>';
      return;
    }
    var rows = purchaseScenarios.map(function(s){
      var out = recalcPurchase(s);
      var costs = out.stampDutyForTotal + out.lmi + out.otherTotal;
      var netAfter = total - costs;
      var shortfall = out.upfrontCash - liquid;
      return '<tr><td>' + escapeAttr(s) + '</td>' +
        '<td class="num">' + fmtCurrency0.format(out.upfrontCash) + '</td>' +
        '<td class="num">' + fmtCurrency0.format(liquid) + '</td>' +
        '<td class="num ' + (shortfall > 0 ? "short" : "ok") + '">' + (shortfall > 0 ? "shortfall " : "surplus ") + fmtCurrency0.format(Math.abs(shortfall)) + '</td>' +
        '<td class="num">' + fmtCurrency0.format(netAfter) + '</td></tr>';
    }).join("");
    panel.innerHTML =
      '<div class="table-scroll"><table class="worth-table">' +
        '<thead><tr><th>Scenario</th>' +
          '<th class="num" title="Deposit + stamp duty + LMI + other acquisition costs for this scenario — the cash you need available on settlement day.">Upfront cash needed</th>' +
          '<th class="num" title="Your Cash + Shares from the assets above. Super and Property can\'t be drawn on for a deposit.">Liquid assets (cash + shares)</th>' +
          '<th class="num" title="Liquid assets minus upfront cash needed. A shortfall means your current liquid savings don\'t cover it — you\'d need to save more first, borrow a larger share (higher LVR, likely with LMI), or choose a cheaper property.">Surplus / shortfall</th>' +
          '<th class="num" title="Current total assets minus stamp duty, LMI and other acquisition costs (see note below).">Net worth after</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table></div>' +
      '<p class="calc-note" style="margin-top:10px">Net worth after purchase = current total assets minus stamp duty, LMI and other acquisition costs. The deposit itself just moves from cash into home equity, so it doesn\'t change net worth on its own.</p>';
  }

  function renderAssets(){
    renderAssetCategoryPage("Cash");
    renderSharesSubpage();
    renderAssetCategoryPage("Super");
    renderAssetCategoryPage("Other");
    renderAssetsSummary();
    renderNetWorthPanel();
    renderPortfolioHistoryChart();
    renderProjectionOutputs();
  }

  // ---------------- Properties ----------------
  function loanRowHtml(loan, li){
    var repayment = loanRepaymentMonthly(loan);
    return '<tr data-loan-index="' + li + '">' +
      '<td><input type="text" class="loan-what" value="' + escapeAttr(loan.what) + '" aria-label="Loan name"></td>' +
      '<td class="num"><input type="number" step="1000" min="0" class="loan-balance" value="' + (Number(loan.balance) || 0) + '" aria-label="Loan balance"></td>' +
      '<td class="num"><input type="number" step="0.01" min="0" class="loan-rate" value="' + (Math.round((Number(loan.rate) || 0) * 100) / 100) + '" aria-label="Interest rate percent"></td>' +
      '<td class="num"><input type="number" step="1" min="0" class="loan-term" value="' + (Number(loan.termYears) || 0) + '" aria-label="Term years remaining"></td>' +
      '<td><select class="loan-type" aria-label="Repayment type">' + optionsHtml(["PI", "IO"], loan.repaymentType) + '</select></td>' +
      '<td class="num loan-repayment-cell">' +
        '<select class="loan-repay-mode" aria-label="Repayment mode">' + optionsHtml(["auto", "manual"], loan.repaymentMode) + '</select>' +
        (loan.repaymentMode === "manual"
          ? '<input type="number" step="1" min="0" class="loan-manual-amount" value="' + (Number(loan.manualRepaymentAmount) || 0) + '" aria-label="Manual repayment amount">'
          : '<span class="computed-note">' + fmtCurrency0.format(repayment) + '/mo</span>') +
      '</td>' +
      '<td class="num"><input type="number" step="1000" min="0" class="loan-offset" value="' + (Number(loan.offsetBalance) || 0) + '" aria-label="Offset account balance" title="Netted against the balance for equity purposes"></td>' +
      '<td><button type="button" class="btn btn-ghost btn-sm row-del" data-loan-del="' + li + '" aria-label="Delete loan">✕</button></td>' +
      '</tr>';
  }

  function propertyCardHtml(p){
    var equity = propertyEquityToday(p);
    var loanRows = (p.loans || []).map(loanRowHtml).join("");
    var hasPmFee = p.kind === "IP";
    var pmFeePanel = hasPmFee
      ? '<div class="proj-controls prop-pmfee-panel">' +
          '<div class="proj-field" title="Applied to this property\'s Property Manager Fee expense row, worked out from its own rent — each property manager can charge a different rate"><label>PM fee % of rent</label><input type="number" min="0" max="100" step="0.1" class="prop-pmfee-percent" value="' + (Number(p.pmFee.percent) || 0) + '"></div>' +
          '<div class="proj-field"><label>+ flat $/week</label><input type="number" min="0" step="0.5" class="prop-pmfee-flat" value="' + (Number(p.pmFee.flat) || 0) + '"></div>' +
        '</div>'
      : "";
    var gearingBadge = "";
    if(p.kind === "IP"){
      var gearing = propertyGearingAnnual(p);
      var isPositive = gearing >= 0;
      gearingBadge = '<span class="gearing-badge ' + (isPositive ? "positive" : "negative") + '" title="Rent minus expenses and loan repayments, per year (' + fmtCurrency0.format(gearing) + '/yr). ' +
        (isPositive ? "Positively geared — the property earns more than it costs to hold." : "Negatively geared — the property costs more to hold than it earns, a common tax strategy.") +
        '">' + (isPositive ? "Positively geared" : "Negatively geared") + '</span>';
    }
    return '<div class="home-block" data-property-id="' + escapeAttr(p.id) + '">' +
      '<div class="home-block-head">' +
        '<div class="home-block-head-left">' +
          '<h4><input type="text" class="prop-what" value="' + escapeAttr(p.what) + '" aria-label="Property name">' +
          '<select class="prop-kind" aria-label="Property kind">' + optionsHtml(["IP", "PPOR"], p.kind) + '</select></h4>' +
          gearingBadge +
        '</div>' +
        '<div class="home-block-right">' +
          '<span class="home-block-total-label">Equity</span>' +
          '<span class="home-block-total' + (equity < 0 ? " short" : "") + '">' + fmtCurrency0.format(equity) + '</span>' +
          '<button type="button" class="btn btn-ghost btn-sm row-del" data-property-del="' + escapeAttr(p.id) + '" aria-label="Delete property">✕</button>' +
        '</div>' +
      '</div>' +
      '<div class="calc-grid">' +
        '<div class="calc-field"><label>Current value</label><input type="number" step="1000" min="0" class="prop-value" value="' + (Number(p.value) || 0) + '"></div>' +
      '</div>' +
      '<div class="prop-value-log"><button type="button" class="asset-log-btn" data-property-log="' + escapeAttr(p.id) + '" title="Snapshot the value above with today\'s date, so it shows up in the portfolio-over-time chart">Log</button>' + assetTrendHtml(p) + '</div>' +
      '<div class="calc-costs-title">Loans</div>' +
      '<div class="table-scroll"><table class="calc-costs-table prop-loans-table"><thead><tr><th>What</th><th class="num">Balance</th><th class="num">Rate %</th><th class="num">Term (yrs)</th><th>Type</th><th>Repayment</th><th class="num">Offset</th><th></th></tr></thead><tbody>' + loanRows + '</tbody></table></div>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-loan-add="' + escapeAttr(p.id) + '">+ Add loan</button>' +
      '<div class="income-group prop-subledger">' +
        '<div class="income-group-head"><div class="income-group-head-left"><h4>Income</h4></div></div>' +
        '<div class="table-scroll"><table class="ledger-table" id="propIncomeTable_' + escapeAttr(p.id) + '"></table></div>' +
        '<button type="button" class="btn btn-sm btn-ghost group-add-btn" data-add="propinc:' + escapeAttr(p.id) + '">+ Add income</button>' +
      '</div>' +
      '<div class="income-group prop-subledger">' +
        '<div class="income-group-head"><div class="income-group-head-left"><h4>Expenses</h4></div></div>' +
        pmFeePanel +
        '<div class="table-scroll"><table class="ledger-table" id="propExpTable_' + escapeAttr(p.id) + '"></table></div>' +
        '<button type="button" class="btn btn-sm btn-ghost group-add-btn" data-add="propexp:' + escapeAttr(p.id) + '">+ Add expense</button>' +
      '</div>' +
    '</div>';
  }

  function renderProperties(){
    var container = document.getElementById("propertiesBody");
    if(!container) return;
    container.innerHTML = state.properties.length
      ? state.properties.map(propertyCardHtml).join("")
      : '<p class="ledger-note" style="margin:0">No properties yet — add one below to start tracking its value, loans, and (for an investment property) rent and expenses.</p>';
    state.properties.forEach(function(p){
      buildTable(document.getElementById("propIncomeTable_" + p.id), "propinc:" + p.id, p.income, {showClass:false});
      buildTable(document.getElementById("propExpTable_" + p.id), "propexp:" + p.id, p.expenses, {showClass:true, hideAcctToggle:true, hideClassToggle:true});
    });
    applyPeriodVisibility();
  }

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

  // ---------------- Generic SVG line chart (used by projection + portfolio history) ----------------
  var SVG_NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs){
    var el = document.createElementNS(SVG_NS, tag);
    for(var k in attrs){ el.setAttribute(k, attrs[k]); }
    return el;
  }

  function renderLineChart(container, series, opts){
    opts = opts || {};
    container.innerHTML = "";
    var validSeries = series.filter(function(s){ return s.points && s.points.length; });
    if(!validSeries.length){
      container.innerHTML = '<p style="color:var(--ink-soft);font-size:12.5px;margin:0">' + (opts.emptyMessage || "Not enough data yet.") + '</p>';
      return;
    }
    var W = 720, H = opts.height || 260;
    var padL = 60, padR = 16, padT = 14, padB = 26;
    var innerW = W - padL - padR, innerH = H - padT - padB;

    var xs = [], ys = [];
    validSeries.forEach(function(s){ s.points.forEach(function(p){ xs.push(p.x); ys.push(p.y); }); });
    var xMin = Math.min.apply(null, xs), xMax = Math.max.apply(null, xs);
    if(xMin === xMax) xMax = xMin + 1;
    var yMin = Math.min(0, Math.min.apply(null, ys));
    var yMax = Math.max.apply(null, ys);
    if(yMax === yMin) yMax = yMin + 1;
    var yPad = (yMax - yMin) * 0.08;
    yMax += yPad; if(yMin < 0) yMin -= yPad;

    function xScale(x){ return padL + (x - xMin) / (xMax - xMin) * innerW; }
    function yScale(y){ return padT + innerH - (y - yMin) / (yMax - yMin) * innerH; }
    function xInvert(px){ return xMin + (px - padL) / innerW * (xMax - xMin); }

    var wrap = document.createElement("div");
    wrap.className = "proj-chart-wrap";

    if(validSeries.length > 1 || opts.alwaysLegend){
      var legend = document.createElement("div");
      legend.className = "proj-legend";
      validSeries.forEach(function(s){
        var item = document.createElement("div");
        item.className = "proj-legend-item";
        item.innerHTML = '<span class="proj-swatch ' + s.colorClass + '"></span><b>' + escapeAttr(s.label) + '</b>';
        legend.appendChild(item);
      });
      wrap.appendChild(legend);
    }

    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, class: "proj-svg", role: "img", "aria-label": opts.ariaLabel || "Chart" });

    var ticks = 5;
    for(var i = 0; i <= ticks; i++){
      var yVal = yMin + (yMax - yMin) * i / ticks;
      var yPix = yScale(yVal);
      svg.appendChild(svgEl("line", { x1: padL, x2: W - padR, y1: yPix, y2: yPix, class: "proj-grid" }));
      var lbl = svgEl("text", { x: padL - 8, y: yPix + 4, "text-anchor": "end", class: "proj-axislabel" });
      lbl.textContent = opts.yFormat ? opts.yFormat(yVal) : Math.round(yVal);
      svg.appendChild(lbl);
    }
    if(yMin < 0 && yMax > 0){
      var zp = yScale(0);
      svg.appendChild(svgEl("line", { x1: padL, x2: W - padR, y1: zp, y2: zp, class: "proj-zero" }));
    }
    var xTickCount = Math.max(2, opts.xTickCount || 7);
    for(var ti = 0; ti < xTickCount; ti++){
      var xv = xMin + (xMax - xMin) * ti / (xTickCount - 1);
      var xPix = xScale(xv);
      var xvLabel = (ti === 0) ? xMin : (ti === xTickCount - 1) ? xMax : Math.round(xv);
      var anchor = ti === 0 ? "start" : (ti === xTickCount - 1 ? "end" : "middle");
      var xlbl = svgEl("text", { x: xPix, y: H - 8, "text-anchor": anchor, class: "proj-axislabel" });
      xlbl.textContent = opts.xFormat ? opts.xFormat(xvLabel) : xvLabel;
      svg.appendChild(xlbl);
    }

    validSeries.forEach(function(s){
      var d = s.points.map(function(p, idx){ return (idx === 0 ? "M" : "L") + xScale(p.x).toFixed(1) + "," + yScale(p.y).toFixed(1); }).join(" ");
      svg.appendChild(svgEl("path", { d: d, class: "series-line " + s.colorClass }));
      var last = s.points[s.points.length - 1];
      svg.appendChild(svgEl("circle", { cx: xScale(last.x), cy: yScale(last.y), r: 3.5, class: "series-dot " + s.colorClass }));
    });

    var crosshair = svgEl("line", { y1: padT, y2: H - padB, class: "proj-crosshair", visibility: "hidden" });
    svg.appendChild(crosshair);
    var hitRect = svgEl("rect", { x: padL, y: padT, width: innerW, height: innerH, fill: "transparent" });
    hitRect.style.cursor = "crosshair";
    svg.appendChild(hitRect);

    var tooltip = document.createElement("div");
    tooltip.className = "viz-tooltip";
    wrap.appendChild(svg);
    wrap.appendChild(tooltip);
    container.appendChild(wrap);

    function nearestPointIndex(xData){
      var best = 0, bestDist = Infinity;
      validSeries[0].points.forEach(function(p, idx){
        var dist = Math.abs(p.x - xData);
        if(dist < bestDist){ bestDist = dist; best = idx; }
      });
      return best;
    }

    hitRect.addEventListener("mousemove", function(e){
      var rect = svg.getBoundingClientRect();
      var scaleX = W / rect.width;
      var px = (e.clientX - rect.left) * scaleX;
      var xData = xInvert(px);
      var idx = nearestPointIndex(xData);
      var xVal = validSeries[0].points[idx].x;
      var xPix = xScale(xVal);
      crosshair.setAttribute("x1", xPix); crosshair.setAttribute("x2", xPix);
      crosshair.setAttribute("visibility", "visible");
      var rows = validSeries.map(function(s){
        var pt = s.points[idx] || s.points[s.points.length - 1];
        return '<div class="viz-tooltip-row"><span class="proj-swatch ' + s.colorClass + '"></span>' + escapeAttr(s.label) + ': <b>' + (opts.yFormat ? opts.yFormat(pt.y) : Math.round(pt.y)) + '</b></div>';
      }).join("");
      tooltip.innerHTML = '<div style="margin-bottom:4px;color:var(--paper);opacity:.75">' + (opts.xFormat ? opts.xFormat(xVal) : xVal) + '</div>' + rows;
      tooltip.classList.add("show");
      var rectW = rect.width;
      var leftPct = (xPix / W) * 100;
      var tipWidthGuess = 150;
      var leftPx = (xPix / W) * rectW;
      var clampedLeft = Math.min(Math.max(leftPx, 4), rectW - tipWidthGuess - 4);
      tooltip.style.left = clampedLeft + "px";
      tooltip.style.top = "4px";
    });
    hitRect.addEventListener("mouseleave", function(){
      crosshair.setAttribute("visibility", "hidden");
      tooltip.classList.remove("show");
    });
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

  // ---------------- Portfolio value over time ----------------
  function renderPortfolioHistoryChart(){
    var container = document.getElementById("portfolioHistoryPanel");
    if(!container) return;
    var dateSet = {};
    state.assets.forEach(function(a){
      (a.history || []).forEach(function(h){ dateSet[h.date] = true; });
    });
    var dates = Object.keys(dateSet).sort();
    var today = new Date().toISOString().slice(0, 10);
    if(dates.indexOf(today) === -1) dates.push(today);

    if(dates.length < 2){
      container.innerHTML = '<h4 style="margin:0 0 8px;font-size:13.5px;font-weight:600">Portfolio value over time</h4>' +
        '<p style="color:var(--ink-soft);font-size:12.5px;margin:0">Log a value for at least one asset (click "Log" in the table above) to start tracking your total portfolio over time.</p>';
      return;
    }

    var points = dates.map(function(d){
      var total = state.assets.reduce(function(sum, a){
        if(!a.history || !a.history.length){
          return sum + (d === today ? (Number(a.amount) || 0) : 0);
        }
        var atOrBefore = a.history.filter(function(h){ return h.date <= d; });
        if(!atOrBefore.length) return sum;
        return sum + atOrBefore[atOrBefore.length - 1].value;
      }, 0);
      return { x: new Date(d + "T00:00:00").getTime(), y: total, dateLabel: d };
    });

    var header = document.createElement("h4");
    header.style.cssText = "margin:0 0 8px;font-size:13.5px;font-weight:600";
    header.textContent = "Portfolio value over time";
    container.innerHTML = "";
    container.appendChild(header);
    var chartDiv = document.createElement("div");
    container.appendChild(chartDiv);

    renderLineChart(chartDiv, [{ label: "Total portfolio", colorClass: "series-color-0", points: points }], {
      height: 220,
      yFormat: function(v){ return fmtCurrency0.format(v); },
      xFormat: function(ms){ return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short" }); },
      xTickCount: Math.min(7, Math.max(2, dates.length)),
      ariaLabel: "Total portfolio value over time",
      alwaysLegend: false
    });
  }

  // ---------------- Tax & super ----------------
  var TAX_WATERFALL_SEGMENTS = [
    { key: "nettakehome", label: "Net take-home", colorClass: "series-color-0" },
    { key: "incometax", label: "Income tax", colorClass: "series-color-1" },
    { key: "medicare", label: "Medicare levy", colorClass: "series-color-2" },
    { key: "sacrifice", label: "To super (sacrifice)", colorClass: "series-color-3" }
  ];
  function taxWaterfallValues(r){
    return { nettakehome: Math.max(0, r.netTakeHome), incometax: Math.max(0, r.incomeTax), medicare: Math.max(0, r.medicare), sacrifice: Math.max(0, r.sacrifice) };
  }
  function renderTaxWaterfallHtml(r){
    var values = taxWaterfallValues(r);
    var whole = values.nettakehome + values.incometax + values.medicare + values.sacrifice;
    var bar = TAX_WATERFALL_SEGMENTS.filter(function(seg){ return values[seg.key] > 0; }).map(function(seg){
      return '<div class="tax-waterfall-seg ' + seg.colorClass + '" data-seg-bar="' + seg.key + '" style="flex:' + values[seg.key] + ' 1 0%" title="' + escapeAttr(seg.label) + ': ' + fmtCurrency0.format(values[seg.key]) + ' (' + fmtPercent1.format(whole > 0 ? values[seg.key] / whole : 0) + ')"></div>';
    }).join("");
    var legend = TAX_WATERFALL_SEGMENTS.map(function(seg){
      return '<div class="tax-waterfall-item"><span class="proj-swatch ' + seg.colorClass + '"></span><div class="tax-waterfall-item-text"><span class="tax-waterfall-item-label">' + seg.label + '</span><span class="tax-waterfall-item-value" data-seg-val="' + seg.key + '">' + fmtCurrency0.format(values[seg.key]) + '</span></div></div>';
    }).join("");
    return '<div class="tax-waterfall-bar" data-waterfall-bar>' + bar + '</div><div class="tax-waterfall-legend">' + legend + '</div>';
  }
  function patchTaxWaterfall(panel, r){
    var values = taxWaterfallValues(r);
    var whole = values.nettakehome + values.incometax + values.medicare + values.sacrifice;
    var barWrap = panel.querySelector("[data-waterfall-bar]");
    if(barWrap) barWrap.innerHTML = TAX_WATERFALL_SEGMENTS.filter(function(seg){ return values[seg.key] > 0; }).map(function(seg){
      return '<div class="tax-waterfall-seg ' + seg.colorClass + '" data-seg-bar="' + seg.key + '" style="flex:' + values[seg.key] + ' 1 0%" title="' + escapeAttr(seg.label) + ': ' + fmtCurrency0.format(values[seg.key]) + ' (' + fmtPercent1.format(whole > 0 ? values[seg.key] / whole : 0) + ')"></div>';
    }).join("");
    TAX_WATERFALL_SEGMENTS.forEach(function(seg){
      var el = panel.querySelector('[data-seg-val="' + seg.key + '"]');
      if(el) el.textContent = fmtCurrency0.format(values[seg.key]);
    });
  }
  function renderTaxSuper(){
    var container = document.getElementById("taxSuperBody");
    if(!container) return;
    var people = getTaxPeople();
    if(!people.length){
      container.innerHTML = '<p class="tax-empty">Mark an Income row\'s Type as "Gross" and give it a Person to see their estimated tax, Medicare levy, and super here.</p>';
      return;
    }
    var ipResult = ipNetResultAnnual();
    var html = '<div class="tax-global">' +
      '<div class="proj-field"><label>Super guarantee % p.a.</label><input type="number" min="0" max="30" step="0.1" id="taxSgRate" value="' + (Number(state.tax.sgRate) || 11.5) + '"></div>' +
      '</div>';
    html += '<p class="ledger-note" style="margin:0 0 12px">Investment property result this year: <b style="font-family:\'IBM Plex Mono\',monospace">' + fmtCurrency0.format(ipResult) + '</b> (' + (ipResult < 0 ? "a loss — negatively geared, reduces taxable income" : "net rental profit — adds to taxable income") + '), split below by ownership share.</p>';

    html += people.map(function(person){
      var r = computePersonTax(person);
      var settings = personTaxSettings(person);
      var capPct = r.capAvailable > 0 ? Math.min(100, (r.totalConcessional / r.capAvailable) * 100) : 0;
      var pid = escapeAttr(person);
      var contributingRows = state.income.filter(function(i){ return i.incomeType === "Gross" && i.person === person; });
      var rowsSummary = contributingRows.map(function(i){ return escapeAttr(i.what) + " " + fmtCurrency0.format(periodsOf(i.amount, i.freq).yearly) + "/yr"; }).join(" + ");
      var baseLabel = Math.abs(r.packageTotal - r.gross) > 1 ? "Base salary (excl. super) /yr" : "Total gross income /yr";
      return '<div class="tax-person" data-tax-person="' + pid + '">' +
        '<div class="tax-person-head">' +
          '<h4>' + escapeAttr(person) + '<button type="button" class="icon-btn" data-tax-rename="' + pid + '" aria-label="Rename ' + pid + '" title="Rename this person (updates every income row)">✎</button><button type="button" class="icon-btn icon-del" data-tax-remove="' + pid + '" aria-label="Remove ' + pid + '" title="Remove this person from tax &amp; super (their income rows go back to Net)">✕</button></h4>' +
          '<span class="tax-marginal">Marginal rate ' + fmtPercent1.format(r.marginalRate) + ' · effective ' + fmtPercent1.format(r.effectiveRate) + '</span>' +
        '</div>' +
        (rowsSummary ? '<p class="tax-rows-summary">Adds up: ' + rowsSummary + ' = <b>' + fmtCurrency0.format(r.packageTotal) + '/yr</b> total gross</p>' : '') +
        '<div class="tax-hero"><span class="tax-hero-label">Net take-home</span><div class="tax-hero-value"><span data-out="nettakehome">' + fmtCurrency0.format(r.netTakeHome) + '</span><small> /yr · <span data-out="nettakehomemo">' + fmtCurrency0.format(r.netTakeHome / 12) + '</span> /mo</small></div></div>' +
        '<div class="tax-waterfall">' + renderTaxWaterfallHtml(r) + '</div>' +
        '<p class="tax-secondary-line">' + baseLabel.replace(" /yr", "") + ' <b data-out="gross">' + fmtCurrency0.format(r.gross) + '</b> · IP share <b data-out="ipshare" class="' + (r.ipShare < 0 ? "neg" : "") + '">' + (r.ipShare >= 0 ? "+" : "") + fmtCurrency0.format(r.ipShare) + '</b> · Taxable income <b data-out="taxable">' + fmtCurrency0.format(r.taxable) + '</b> /yr</p>' +
        (Math.abs(r.packageTotal - r.gross) > 1
          ? '<p class="tax-package-note" data-out="packagenote" style="margin:-6px 0 12px">Of that ' + fmtCurrency0.format(r.packageTotal) + ', ' + fmtCurrency0.format(r.packageTotal - r.gross) + ' is super already included inside a row marked "Super: Included" — so tax and take-home are calculated on ' + fmtCurrency0.format(r.gross) + ' base salary, not the full ' + fmtCurrency0.format(r.packageTotal) + '. (Total super for the year, from every row, is in the cap line below.)</p>'
          : '') +
        '<div class="tax-inputs-label">Your inputs</div>' +
        '<div class="tax-inputs-panel">' +
          '<div class="tax-inputs">' +
            '<div class="proj-field"><label>IP ownership %</label><input type="number" min="0" max="100" step="1" class="tax-ipshare" value="' + r.ownershipPct + '"></div>' +
            '<div class="proj-field"><label title="Separate from the Cash / Sacrifice column on income rows above — use this for sacrifice not tied to a specific item">Manual sacrifice $/yr</label><input type="number" min="0" step="500" class="tax-sacrifice" value="' + settings.superSacrificeAnnual + '"></div>' +
          '</div>' +
          '<details class="tax-advanced"><summary>Advanced — concessional cap &amp; carry-forward</summary>' +
            '<div class="tax-inputs">' +
              '<div class="proj-field"><label>Concessional cap $/yr</label><input type="number" min="0" step="500" class="tax-cap" value="' + settings.concessionalCap + '"></div>' +
              '<div class="proj-field"><label>Carry-forward available $</label><input type="number" min="0" step="500" class="tax-carryforward" value="' + settings.carryForward + '"></div>' +
            '</div>' +
          '</details>' +
        '</div>' +
        '<div class="tax-inputs-label">Concessional cap usage <span class="calc-help" title="Estimated from your inputs above — not something you set directly.">ⓘ</span></div>' +
        '<div class="cap-bar-track"><div class="cap-bar-fill' + (r.capExceeded > 0 ? " over" : "") + '" style="width:' + Math.min(100, capPct) + '%"></div></div>' +
        '<div class="tax-cap-note' + (r.capExceeded > 0 ? " warn" : "") + '">' +
          (r.capExceeded > 0
            ? ('Over cap by ' + fmtCurrency0.format(r.capExceeded) + ' — excess concessional contributions are taxed at your marginal rate, not just 15%. Check with your accountant.')
            : (fmtCurrency0.format(r.totalConcessional) + ' of ' + fmtCurrency0.format(r.capAvailable) + ' concessional cap used (SG ' + fmtCurrency0.format(r.sg) + (r.autoSacrifice > 0 ? ' + bonus/income sacrifice ' + fmtCurrency0.format(r.autoSacrifice) : '') + (r.manualSacrifice > 0 ? ' + manual sacrifice ' + fmtCurrency0.format(r.manualSacrifice) : '') + ') — super received net of 15% contributions tax: ' + fmtCurrency0.format(r.superNet))
          ) +
        '</div>' +
      '</div>';
    }).join("");
    container.innerHTML = html;
  }

  function patchAllTaxPersonOutputs(){
    document.querySelectorAll("[data-tax-person]").forEach(function(panel){
      var person = panel.getAttribute("data-tax-person");
      var r = computePersonTax(person);
      var set = function(key, text, isNeg){
        var el = panel.querySelector('[data-out="' + key + '"]');
        if(!el) return;
        el.textContent = text;
        if(isNeg !== undefined) el.classList.toggle("neg", isNeg);
      };
      set("gross", fmtCurrency0.format(r.gross));
      set("ipshare", (r.ipShare >= 0 ? "+" : "") + fmtCurrency0.format(r.ipShare), r.ipShare < 0);
      set("taxable", fmtCurrency0.format(r.taxable));
      set("nettakehome", fmtCurrency0.format(r.netTakeHome));
      set("nettakehomemo", fmtCurrency0.format(r.netTakeHome / 12));
      patchTaxWaterfall(panel, r);
      var marginalEl = panel.querySelector(".tax-marginal");
      if(marginalEl) marginalEl.textContent = "Marginal rate " + fmtPercent1.format(r.marginalRate) + " · effective " + fmtPercent1.format(r.effectiveRate);
      var capPct = r.capAvailable > 0 ? Math.min(100, (r.totalConcessional / r.capAvailable) * 100) : 0;
      var fill = panel.querySelector(".cap-bar-fill");
      if(fill){ fill.style.width = Math.min(100, capPct) + "%"; fill.classList.toggle("over", r.capExceeded > 0); }
      var note = panel.querySelector(".tax-cap-note");
      if(note){
        note.classList.toggle("warn", r.capExceeded > 0);
        note.textContent = r.capExceeded > 0
          ? ("Over cap by " + fmtCurrency0.format(r.capExceeded) + " — excess concessional contributions are taxed at your marginal rate, not just 15%. Check with your accountant.")
          : (fmtCurrency0.format(r.totalConcessional) + " of " + fmtCurrency0.format(r.capAvailable) + " concessional cap used (SG " + fmtCurrency0.format(r.sg) + (r.autoSacrifice > 0 ? " + bonus/income sacrifice " + fmtCurrency0.format(r.autoSacrifice) : "") + (r.manualSacrifice > 0 ? " + manual sacrifice " + fmtCurrency0.format(r.manualSacrifice) : "") + ") — super received net of 15% contributions tax: " + fmtCurrency0.format(r.superNet));
      }
      var pkgNote = panel.querySelector('[data-out="packagenote"]');
      if(pkgNote && Math.abs(r.packageTotal - r.gross) > 1){
        pkgNote.textContent = "Of that " + fmtCurrency0.format(r.packageTotal) + ", " + fmtCurrency0.format(r.packageTotal - r.gross) + " is super already included inside a row marked \"Super: Included\" — so tax and take-home are calculated on " + fmtCurrency0.format(r.gross) + " base salary, not the full " + fmtCurrency0.format(r.packageTotal) + ". (Total super for the year, from every row, is in the cap line below.)";
      }
    });
    var ipNote = document.querySelector("#taxSuperBody .ledger-note b");
    if(ipNote) ipNote.textContent = fmtCurrency0.format(ipNetResultAnnual());
  }

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
    if(removeBtn){ removeTaxPerson(removeBtn.getAttribute("data-tax-remove")); }
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
    if(e.target.closest("table.assets-table")){
      var tr = e.target.closest("tr[data-index]");
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
      else if(e.target.classList.contains("h-person")){
        item.person = e.target.value;
        renderSharesSubpage();
        updatePersonSuggestions();
        renderAssetsSummary();
        renderNetWorthPanel();
        persist();
        return;
      }
      else return;
      patchAssetCategoryTotals();
      renderNetWorthPanel();
      persist();
    }
  });
  document.addEventListener("change", function(e){
    if(e.target.closest("table.assets-table") && e.target.classList.contains("a-category")){
      var tr = e.target.closest("tr[data-index]");
      if(!tr) return;
      var idx = Number(tr.getAttribute("data-index"));
      if(state.assets[idx]){ state.assets[idx].category = e.target.value; renderAssets(); persist(); }
    }
    if(e.target.closest("table.assets-table") && e.target.classList.contains("h-market")){
      var htr = e.target.closest("tr[data-index]");
      if(!htr) return;
      var hidx = Number(htr.getAttribute("data-index"));
      if(state.assets[hidx]){ state.assets[hidx].market = e.target.value; persist(); }
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
    if(logBtn) logAssetSnapshot(Number(logBtn.getAttribute("data-asset-log")));
  });

  function patchPropertyCardComputed(property){
    var card = document.querySelector('.home-block[data-property-id="' + CSS.escape(property.id) + '"]');
    if(!card) return;
    var equity = propertyEquityToday(property);
    var totalEl = card.querySelector(".home-block-total");
    if(totalEl){ totalEl.textContent = fmtCurrency0.format(equity); totalEl.classList.toggle("short", equity < 0); }
    (property.loans || []).forEach(function(loan, li){
      var tr = card.querySelector('tr[data-loan-index="' + li + '"]');
      if(!tr) return;
      var note = tr.querySelector(".loan-repayment-cell .computed-note");
      if(note) note.textContent = fmtCurrency0.format(loanRepaymentMonthly(loan)) + "/mo";
    });
    var badge = card.querySelector(".gearing-badge");
    if(badge && property.kind === "IP"){
      var gearing = propertyGearingAnnual(property);
      var isPositive = gearing >= 0;
      badge.className = "gearing-badge " + (isPositive ? "positive" : "negative");
      badge.textContent = isPositive ? "Positively geared" : "Negatively geared";
      badge.title = "Rent minus expenses and loan repayments, per year (" + fmtCurrency0.format(gearing) + "/yr). " +
        (isPositive ? "Positively geared — the property earns more than it costs to hold." : "Negatively geared — the property costs more to hold than it earns, a common tax strategy.");
    }
  }

  document.getElementById("propertiesBody").addEventListener("input", function(e){
    var card = e.target.closest("[data-property-id]");
    if(!card) return;
    var property = findProperty(card.getAttribute("data-property-id"));
    if(!property) return;
    var loanTr = e.target.closest("tr[data-loan-index]");
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
    var loanTr = e.target.closest("tr[data-loan-index]");
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
    if(e.target.closest("table.ledger-table")) onLedgerInput(e);
  });
  document.addEventListener("change", function(e){
    if(e.target.closest("table.ledger-table") && (e.target.tagName === "SELECT")) onLedgerInput(e);
  });
  document.addEventListener("click", onLedgerClick);

  function onScenarioControlClick(e){
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

  document.getElementById("periodsToggle").addEventListener("change", function(e){
    state.showAllPeriods = e.target.checked;
    applyPeriodVisibility();
    persist();
  });

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

  function showToast(msg){
    var wrap = document.getElementById("toastWrap");
    var t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    wrap.appendChild(t);
    requestAnimationFrame(function(){ t.classList.add("show"); });
    setTimeout(function(){ t.classList.remove("show"); setTimeout(function(){ t.remove(); }, 200); }, 3200);
  }

  function showUndoToast(msg, undoFn){
    var wrap = document.getElementById("toastWrap");
    var t = document.createElement("div");
    t.className = "toast";
    var label = document.createElement("span");
    label.textContent = msg;
    var undoBtn = document.createElement("button");
    undoBtn.type = "button";
    undoBtn.className = "toast-undo-btn";
    undoBtn.textContent = "Undo";
    t.appendChild(label);
    t.appendChild(undoBtn);
    wrap.appendChild(t);
    requestAnimationFrame(function(){ t.classList.add("show"); });
    var dismissTimer = setTimeout(dismiss, 6000);
    function dismiss(){
      clearTimeout(dismissTimer);
      t.classList.remove("show");
      setTimeout(function(){ t.remove(); }, 200);
    }
    undoBtn.addEventListener("click", function(){
      undoFn();
      dismiss();
    });
  }

  function isoDateStamp(){
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    var hh = String(d.getHours()).padStart(2, "0");
    var mi = String(d.getMinutes()).padStart(2, "0");
    var ss = String(d.getSeconds()).padStart(2, "0");
    return d.getFullYear() + "-" + mm + "-" + dd + "_" + hh + "-" + mi + "-" + ss;
  }
  function doExport(){
    var payload = JSON.stringify(state, null, 2);
    var filename = "wealth-planner-backup-" + isoDateStamp() + ".json";
    if(window.claude && window.claude.use){
      window.claude.use("downloads").then(function(downloads){
        if(!downloads){ fallbackExport(payload, filename); return; }
        downloads.save({filename: filename, data: payload}).then(function(){
          showToast("Backup saved");
        }).catch(function(err){
          if(err && err.code === "declined") return;
          fallbackExport(payload, filename);
        });
      }).catch(function(){ fallbackExport(payload, filename); });
    } else {
      fallbackExport(payload, filename);
    }
  }
  function fallbackExport(payload, filename){
    try{
      var blob = new Blob([payload], {type:"application/json"});
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
      showToast("Backup saved");
    }catch(e){
      showToast("Couldn't save a file here — copy is in your clipboard? Try again from a full browser tab.");
    }
  }

  document.getElementById("exportBtn").addEventListener("click", doExport);
  document.getElementById("exportLink2").addEventListener("click", doExport);

  document.getElementById("importBtn").addEventListener("click", function(){
    document.getElementById("importFile").click();
  });
  document.getElementById("importFile").addEventListener("change", function(e){
    var file = e.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      try{
        var parsed = JSON.parse(reader.result);
        if(!parsed || !parsed.income || !parsed.home) throw new Error("bad shape");
        state = migrateState(parsed);
        renderAll();
        persist();
        showToast("Backup imported");
      }catch(err){
        showToast("That file doesn't look like a valid backup");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("resetBtn").addEventListener("click", function(){
    if(!confirm("Clear everything back to a blank slate? This replaces everything currently entered — export a backup first if you want to keep it.")) return;
    state = defaultState();
    renderAll();
    persist();
    showToast("Cleared");
  });

  document.getElementById("mockDataBtn").addEventListener("click", function(){
    if(!confirm("Fill in randomised sample data so you can try the tool? This replaces everything currently entered — export a backup first if you want to keep it.")) return;
    state = migrateState(generateMockData());
    renderAll();
    persist();
    showToast("Sample data generated");
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
  var PAGES = [
    { id: "dashboard", label: "Dashboard" },
    { id: "income", label: "Income & Tax" },
    { id: "expenses", label: "Expenses" },
    { id: "properties", label: "Properties" },
    { id: "scenarios", label: "Scenarios" },
    { id: "assets", label: "Assets" },
    { id: "projections", label: "Projections" }
  ];
  var PAGE_KEY = "wealthPlanner.page";

  function showPage(id){
    if(!PAGES.some(function(p){ return p.id === id; })) id = "dashboard";
    PAGES.forEach(function(p){
      var section = document.getElementById("page-" + p.id);
      if(section) section.hidden = (p.id !== id);
      var navBtn = document.querySelector('.nav-item[data-page="' + p.id + '"]');
      if(navBtn){
        navBtn.classList.toggle("active", p.id === id);
        if(p.id === id) navBtn.setAttribute("aria-current", "page"); else navBtn.removeAttribute("aria-current");
      }
    });
    var page = PAGES.find(function(p){ return p.id === id; });
    document.getElementById("pageTitle").textContent = page ? page.label : "Dashboard";
    try{ localStorage.setItem(PAGE_KEY, id); }catch(e){}
    if(id === "dashboard") renderDashboardStats();
    window.scrollTo(0, 0);
  }

  document.getElementById("appNav").addEventListener("click", function(e){
    var btn = e.target.closest(".nav-item");
    if(!btn) return;
    showPage(btn.getAttribute("data-page"));
  });

  document.getElementById("assetsSubnav").addEventListener("click", function(e){
    var btn = e.target.closest("[data-assets-sub]");
    if(!btn) return;
    showAssetsSubpage(btn.getAttribute("data-assets-sub"));
  });

  var initialPage = "dashboard";
  try{ initialPage = localStorage.getItem(PAGE_KEY) || "dashboard"; }catch(e){}

  function renderAll(){
    document.getElementById("periodsToggle").checked = !!state.showAllPeriods;
    document.getElementById("homeAcctToggle").checked = !!state.homeCols.account;
    renderIncomeColPicker();
    renderExpenseColPicker();
    document.getElementById("projHorizon").value = state.projection.horizonYears;
    document.getElementById("projInvestRate").value = state.projection.investReturnRate;
    document.getElementById("projPropertyRate").value = state.projection.propertyAppreciationRate;
    document.getElementById("projInflationRate").value = state.projection.inflationRate;
    document.getElementById("projRateShock").value = state.projection.rateShockPct;
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

  renderAll();
  showPage(initialPage);
})();
