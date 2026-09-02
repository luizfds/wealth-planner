import { state } from "../state.js";
import { LIQUID_CATEGORIES } from "../constants.js";
import { toWeekly, sumField, sumFieldForScenario } from "./ledger.js";
import {
  recalcPurchase, ipProperties, ipExpensesMonthly, ipLoansMonthly,
  shockedLoanRepaymentMonthly, scenarioInflatableMonthly, calcStampDuty,
  calcLMI, calcRepaymentMonthly, purchaseActiveRate, loanBalanceAfterMonths,
  propertiesTotalEquityToday, propertiesOffsetTotal
} from "./property.js";
import { getTaxPeople, computePersonTax, effectiveIncomeItems } from "./tax.js";
import { fmtCurrency0, localDateStr } from "../lib/format.js";

export function totalAssetsValue(){
  return state.assets.reduce(function(s, a){ return s + (Number(a.amount) || 0); }, 0);
}

// Anything owed outside a property loan (credit cards, personal loans, BNPL — property loans
// stay tracked on the Properties tab, already netted into propertiesTotalEquityToday()). No
// interest/repayment modeling here on purpose — just a flat balance subtracted from net worth,
// unlike a property loan's full amortization schedule. Keeping it this simple was a deliberate
// scope call, not an oversight; a fuller debt-payoff model (minimum payments, interest accrual)
// would be a real follow-up feature, not a quick addition to this one.
export function totalDebtsValue(){
  return state.debts.reduce(function(s, d){ return s + (Number(d.balance) || 0); }, 0);
}

export function totalNetWorthValue(){
  return totalAssetsValue() + propertiesTotalEquityToday() - totalDebtsValue();
}

// Cash + Shares (readily spendable) plus any property offset balances — the same definition
// already used by the Assets page's "Net worth if you buy" table, extracted here so the
// Dashboard's runway stat can reuse it instead of re-deriving it.
export function liquidAssetsValue(){
  return state.assets.filter(function(a){ return LIQUID_CATEGORIES.indexOf(a.category) !== -1; })
    .reduce(function(s, a){ return s + (Number(a.amount) || 0); }, 0) + propertiesOffsetTotal();
}

// How many months of expenses your liquid assets would cover at zero income — the standard
// "emergency fund" health check. Infinity reads oddly in the UI, so a scenario with $0 monthly
// expenses (nothing entered yet) reports null rather than a nonsensical number.
export function runwayMonths(monthlyExpenses){
  if(!monthlyExpenses || monthlyExpenses <= 0) return null;
  return liquidAssetsValue() / monthlyExpenses;
}

// Sums each asset/property's logged value ~30 days ago against its latest logged value, for
// comparing real month-over-month growth against a scenario's projected monthly surplus
// (scenarioTotals().netMonthly) — a reality check on whether net worth is actually tracking the
// plan. Only counts items with at least one snapshot on/before the reference date and one after
// it (or today, for the "after" side) — an item with no history at all, or only very recent
// history, doesn't silently count as $0 growth; it's just excluded from the comparison.
export function actualAssetGrowthLastMonth(){
  var today = new Date();
  var monthAgo = new Date(today.getTime());
  monthAgo.setDate(monthAgo.getDate() - 30);
  var monthAgoStr = localDateStr(monthAgo);
  var todayStr = localDateStr(today);

  function latestValueOnOrBefore(history, d){
    if(!history || !history.length) return null;
    var atOrBefore = history.filter(function(h){ return h.date <= d; });
    if(!atOrBefore.length) return null;
    return atOrBefore[atOrBefore.length - 1].value;
  }

  var trackedCount = 0;
  var deltaSum = 0;
  state.assets.forEach(function(a){
    var before = latestValueOnOrBefore(a.history, monthAgoStr);
    var after = latestValueOnOrBefore(a.history, todayStr);
    if(after == null) after = Number(a.amount) || 0; // today's live value if never explicitly logged today
    if(before == null) return; // no snapshot old enough to compare against — exclude, don't assume $0
    deltaSum += after - before;
    trackedCount++;
  });

  return { deltaSum: deltaSum, trackedCount: trackedCount, hasData: trackedCount > 0 };
}

// Assets whose logged value is stale (>=30 days old) or that have never been logged at all —
// a nudge, not an error: the app has no way to push a notification when it's closed (no
// backend), so this only surfaces on load/whenever the Dashboard re-renders.
export function staleAssets(){
  var todayMs = Date.now();
  var STALE_DAYS = 30;
  var result = [];
  state.assets.forEach(function(a){
    var hist = a.history;
    var lastDate = hist && hist.length ? hist[hist.length - 1].date : null;
    var days = lastDate ? Math.floor((todayMs - new Date(lastDate + "T00:00:00").getTime()) / (24 * 60 * 60 * 1000)) : null;
    if(days == null || days >= STALE_DAYS) result.push({ what: a.what, days: days });
  });
  return result;
}

export function computeNetWorthSeries(scenario, horizonYears){
  var cfg = state.purchase[scenario];
  var investCfg = state.invest[scenario];
  var investEnabled = !!(investCfg && investCfg.enabled);
  // Invest wins if a scenario's stored state somehow has both legs enabled (shouldn't happen —
  // the UI keeps them mutually exclusive, and migrateState() resolves it the same way on load —
  // but this keeps the math itself correct regardless of how state got here).
  var purchaseEnabled = !!(cfg && cfg.enabled) && !investEnabled;
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

  // Debts have no growth/repayment schedule of their own (see totalDebtsValue()) — folded into
  // the starting portfolio balance as a flat reduction, same treatment as any other liquid
  // asset/liability that isn't a property loan or the purchase/invest leg's own math.
  var nonPropertyAssets = totalAssetsValue() - totalDebtsValue();

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
  // The invest leg's initial lump sum is money reallocated out of today's non-property assets
  // (the same way upfrontCash above leaves the liquid portfolio to become a deposit) — subtract
  // it from portfolio's starting point so it isn't compounded in both buckets at once.
  var investGrowthMonthly = investEnabled ? Math.pow(1 + (Number(investCfg.growthRatePct) || 0) / 100, 1 / 12) - 1 : 0;
  var investInitial = investEnabled ? Math.max(0, Number(investCfg.initialAmount) || 0) : 0;
  var investBalance = investInitial;
  var portfolio = nonPropertyAssets - upfrontCash - investInitial;

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
      // "auto" mode redirects the scenario's own real monthly surplus into the invest leg's
      // growth rate instead of the generic portfolio rate — not an extra contribution on top of
      // it, which would double-count the same money. "manual" pins a fixed figure instead, and
      // whatever's left of the actual surplus still compounds in the generic portfolio as usual.
      var investContribThisYear = investEnabled
        ? (investCfg.contributionMode === "manual" ? (Number(investCfg.monthlyContribution) || 0) : savingsThisYear)
        : 0;
      for(var m = 0; m < 12; m++){
        portfolio = portfolio * (1 + monthlyInvestRate) + (savingsThisYear - investContribThisYear);
        if(investEnabled) investBalance = investBalance * (1 + investGrowthMonthly) + investContribThisYear;
      }
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
    points.push({ x: year, y: homeEquity + portfolio + investBalance + propertiesEquitySum });
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
  var sharedMonthly = sumFieldForScenario(state.shared, scenario, "monthly");
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
