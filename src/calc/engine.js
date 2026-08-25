import { state } from "../state.js";
import { toWeekly, sumField } from "./ledger.js";
import {
  recalcPurchase, ipProperties, ipExpensesMonthly, ipLoansMonthly,
  shockedLoanRepaymentMonthly, scenarioInflatableMonthly, calcStampDuty,
  calcLMI, calcRepaymentMonthly, purchaseActiveRate, loanBalanceAfterMonths
} from "./property.js";
import { getTaxPeople, computePersonTax, effectiveIncomeItems } from "./tax.js";
import { fmtCurrency0 } from "../lib/format.js";

export function totalAssetsValue(){
  return state.assets.reduce(function(s, a){ return s + (Number(a.amount) || 0); }, 0);
}

export function computeNetWorthSeries(scenario, horizonYears){
  var cfg = state.purchase[scenario];
  var purchaseEnabled = !!(cfg && cfg.enabled);
  var proj = state.projection || {};
  var propRate = (Number(proj.propertyAppreciationRate) || 0) / 100;
  // A scenario can override the global growth rate (e.g. to reflect its own state's
  // long-run average) via cfg.propertyGrowthRate; null/unset falls back to the global rate.
  var homePropRate = (cfg && cfg.propertyGrowthRate != null && cfg.propertyGrowthRate !== "")
    ? (Number(cfg.propertyGrowthRate) || 0) / 100
    : propRate;
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

  var rateShockPts = Number(proj.rateShockPct) || 0;
  var incomeMonthly = scenarioTotals(scenario).incomeMonthly;
  var ipLoansMonthlyShocked = ipProperties().reduce(function(s, p){
    return s + p.loans.reduce(function(ss, l){ return ss + shockedLoanRepaymentMonthly(l, rateShockPts); }, 0);
  }, 0);
  var fixedMonthly = ipLoansMonthlyShocked + repaymentMonthly;
  var inflatableBase = scenarioInflatableMonthly(scenario) + ipExpensesMonthly();

  var points = [];
  for(var year = 0; year <= horizonYears; year++){
    if(year > 0){
      var inflatableThisYear = inflatableBase * Math.pow(1 + inflationRate, year);
      var savingsThisYear = incomeMonthly - fixedMonthly - inflatableThisYear;
      for(var m = 0; m < 12; m++){ portfolio = portfolio * (1 + monthlyInvestRate) + savingsThisYear; }
    }
    var homeValue = price * Math.pow(1 + homePropRate, year);
    var loanBal = purchaseEnabled ? loanBalanceAfterMonths(loanAmount0, rate, term, year * 12, cfg.repaymentType) : 0;
    var homeEquity = purchaseEnabled ? (homeValue - loanBal) : 0;
    var propertiesEquitySum = state.properties.reduce(function(sum, p){
      var val = (Number(p.value) || 0) * Math.pow(1 + propRate, year);
      var loanNet = (p.loans || []).reduce(function(s, l){
        var bal = loanBalanceAfterMonths(l.balance, (Number(l.rate) || 0) + rateShockPts, l.termYears, year * 12, l.repaymentType);
        return s + Math.max(0, bal - (Number(l.offsetBalance) || 0));
      }, 0);
      return sum + (val - loanNet);
    }, 0);
    points.push({ x: year, y: homeEquity + portfolio + propertiesEquitySum });
  }
  return points;
}

export function recalcComputedItems(){
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
    var pmFlatWeekly = pmFlat * 12 / 52; // pmFlat is a flat $/month fee; this row's frequency is Weekly
    pmFeeItem.amount = Math.round((rentWeekly * (pmPercent / 100) + pmFlatWeekly) * 100) / 100;
    pmFeeItem.freq = "Weekly";
    pmFeeItem.computedNote = "auto: " + pmPercent + "% of rent + $" + pmFlat.toFixed(2) + "/mo";
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
    var monthlyRent = Math.round(sumField(p.income, "monthly") * 100) / 100;
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

  state.assets.forEach(function(a){
    if(a.category !== "Vehicle") return;
    var price = Number(a.purchasePrice) || 0;
    var rate = Number(a.depreciationRate) || 0;
    if(!a.purchaseDate || price <= 0){ a.computed = false; return; }
    var years = Math.max(0, (Date.now() - new Date(a.purchaseDate + "T00:00:00").getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    a.amount = Math.max(0, Math.round(price * Math.pow(1 - rate / 100, years)));
    a.computed = true;
    a.computedNote = "auto: " + rate + "%/yr declining balance from " + fmtCurrency0.format(price) + " (" + a.purchaseDate + ")";
  });
}

export function scenarioTotals(scenario){
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
