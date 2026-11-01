// ---------------- Side by side (v3.175.0, item 210) ----------------
//
// Each scenario against "stay as we are", in the figures a decision turns on: the cash it needs at
// settlement against the cash there is; what a month leaves, before and after the tax effect of an
// investment property; the lowest cash gets over the projection; net worth in 5, 10 and 20 years;
// the month under stress (rates up 2%, a month more vacant, rent down a tenth); the first year it's
// ahead of staying put; and a one-line verdict. Every figure is read off the engine (scenarioTotals,
// computeNetWorthSeries), so this can't disagree with the cards or the projection.

import { state } from "../state.js";
import { scenarioTotals, computeNetWorthSeries, currentScenario, liquidAssetsValue, scenarioLegChanges, scenarioLegContext, isCashTriggered } from "./engine.js";
import { recalcPurchase, calcRepaymentMonthly, purchaseActiveRate, ipProperties, shockedLoanRepaymentMonthly, loanPaidOut } from "./property.js";
import { sumField } from "./ledger.js";
import { ipFigures } from "./scenariolegs.js";
import { badStartSeries } from "./outcomes.js";
import { serviceability, SERVICE_BUFFER } from "./salecgt.js";
import { scenarioSharedItems, livesElsewhere } from "./scenariochanges.js";
import { scenarioIncomeMonthly } from "./tax.js";
import { periodsOf } from "./ledger.js";
import { localDateStr } from "../lib/format.js";

export var COMPARE_YEARS = [5, 10, 20];
function r0(n){ return Math.round(n); }

// What a scenario's month loses under stress: its purchase loan and investment properties' loans 2
// points dearer, an extra month vacant and rent a tenth lower; the household's own investment
// properties' loans 2 points dearer too.
export function stressMonthly(scenario){
  var hit = 0;
  var cfg = state.purchase && state.purchase[scenario], inv = state.invest && state.invest[scenario];
  if(cfg && cfg.enabled && !(inv && inv.enabled)){
    var out = recalcPurchase(scenario);
    if(out) hit += calcRepaymentMonthly(out.loanBalance, purchaseActiveRate(cfg) + 2, cfg.termYears, cfg.repaymentType) - out.repaymentMonthly;
  }
  var legs = scenarioLegChanges(scenario);
  if(legs.length){
    var ctx = scenarioLegContext(scenario);
    legs.forEach(function(c){
      if(c.kind !== "ip") return;
      var rate = ctx.marginalRateFor(c.owner);
      var taxEffect = function(tx){ return ctx.taxEffectFor(c.owner, tx); };
      var base = ipFigures(c, { marginalRate: rate, taxEffect: taxEffect });
      var hard = ipFigures(Object.assign({}, c, { rentWeekly: (Number(c.rentWeekly) || 0) * 0.9, vacancyWeeks: (Number(c.vacancyWeeks) || 0) + 4 }), { marginalRate: rate, rateShockPts: 2, taxEffect: taxEffect });
      hit += base.cashAfterTaxMonthly - hard.cashAfterTaxMonthly;
    });
  }
  ipProperties().forEach(function(p){
    (p.loans || []).forEach(function(l){ hit += shockedLoanRepaymentMonthly(l, 2) - shockedLoanRepaymentMonthly(l, 0); });
    hit += sumField(p.income || [], "monthly") * (0.1 + 4 / 52);
  });
  return r0(hit);
}

export function compareScenario(scenario, opts){
  opts = opts || {};
  var base = opts.baseline || currentScenario();
  var horizon = Math.max(20, Number(opts.horizon) || 20);
  var t = scenarioTotals(scenario);
  var series = computeNetWorthSeries(scenario, horizon);
  var baseSeries = scenario === base ? series : (opts.baseSeries || computeNetWorthSeries(base, horizon));
  var cfg = state.purchase && state.purchase[scenario], inv = state.invest && state.invest[scenario];
  var buying = !!(cfg && cfg.enabled && !(inv && inv.enabled));
  var investing = !!(inv && inv.enabled);
  // Cash at settlement: what's needed now — an investment property bought in a later year, at an age not
  // reached or once cash reaches an amount is paid for then, from what's there then (v3.192.0).
  var upfrontNow = scenarioLegChanges(scenario).reduce(function(sum, c){
    if(c.kind !== "ip" || (Number(c.fromYear) || 0) > 0 || isCashTriggered(c)) return sum;
    return sum + ipFigures(c, {}).upfront;
  }, 0);
  var upfront = (buying ? (recalcPurchase(scenario) || {}).upfrontCash || 0 : 0) + upfrontNow + (investing ? Number(inv.initialAmount) || 0 : 0);
  var available = liquidAssetsValue();
  var lowest = series.reduce(function(m, p){ return Math.min(m, p.investments); }, Infinity);
  // Ahead from a year means ahead from then to the end: the first year after the last one it was
  // behind. A scenario that pulls ahead for a while and falls back is said to, not called ahead.
  var aheadFrom = null, aheadForAWhile = null;
  if(scenario !== base){
    var lastBehind = 0;
    for(var y = 1; y < series.length; y++){
      if(series[y].y > baseSeries[y].y){ if(aheadForAWhile == null) aheadForAWhile = y; }
      else lastBehind = y;
    }
    if(lastBehind < series.length - 1) aheadFrom = lastBehind + 1;
    if(aheadFrom != null) aheadForAWhile = null;
  }
  var stress = stressMonthly(scenario);
  var lender = lenderCheck(scenario, base);
  // v3.184.0 (item 215): a bad first year (shares −20%, property −10%) — net worth at 10 years and the
  // lowest cash, beside the usual.
  var bad = badStartSeries(scenario, horizon), ten = Math.min(10, series.length - 1);
  var monthAfter = t.regularNetMonthly != null ? t.regularNetMonthly : t.netMonthly;
  var monthBefore = monthAfter - (t.changesTaxMonthly || 0);
  var out = {
    scenario: scenario, isBaseline: scenario === base,
    upfront: r0(upfront), available: r0(available), short: r0(Math.max(0, upfront - available)),
    monthBeforeTax: r0(monthBefore), monthAfterTax: r0(monthAfter), monthUnderStress: r0(monthAfter - stress),
    lowestCash: r0(lowest),
    // The difference of the two figures as shown, so "vs today" always adds up to what's on screen.
    netWorth: COMPARE_YEARS.map(function(yr){ var v = r0(series[Math.min(yr, series.length - 1)].y); return { year: yr, value: v, vsBase: v - r0(baseSeries[Math.min(yr, baseSeries.length - 1)].y) }; }),
    aheadFrom: aheadFrom, aheadForAWhile: aheadForAWhile, lender: lender,
    badStart: { netWorth10: r0(bad[ten].y), vsUsual: r0(bad[ten].y) - r0(series[ten].y), lowestCash: r0(bad.reduce(function(m, p){ return Math.min(m, p.investments); }, Infinity)) }
  };
  out.verdict = verdict(out);
  return out;
}

// v3.186.0 (item 217): whether a lender would likely lend what a scenario borrows — null when it borrows
// nothing new. Take-home pay (the household's), the rents (existing and new), living costs as the scenario
// has them (loan repayments aside), and every loan, new and existing, at its rate plus the buffer.
export function lenderCheck(scenario, base){
  var cfg = state.purchase && state.purchase[scenario], inv = state.invest && state.invest[scenario];
  var loans = [], rent = 0, living = 0;
  if(cfg && cfg.enabled && !(inv && inv.enabled)){
    var out = recalcPurchase(scenario);
    if(out && out.loanBalance > 0) loans.push({ balance: out.loanBalance, rate: purchaseActiveRate(cfg), termYears: cfg.termYears });
  }
  scenarioLegChanges(scenario).forEach(function(c){
    if(c.kind === "ip"){ var f = ipFigures(c, {}); loans.push({ balance: f.loan, rate: Number(c.rate) || 0, termYears: Number(c.termYears) || 30 }); rent += f.rentYearly / 12; living += f.costsYearly / 12; }
    else if(c.kind === "rent" || c.kind === "cost") living += periodsOf(Number(c.amount) || 0, c.freq || "Monthly").monthly;
  });
  if(!loans.length) return null;
  ipProperties().forEach(function(p){
    rent += sumField(p.income || [], "monthly");
    living += sumField(p.expenses || [], "monthly");
    (p.loans || []).forEach(function(l){ if(!loanPaidOut(l, localDateStr())) loans.push({ balance: Math.max(0, (Number(l.balance) || 0) - (Number(l.offsetBalance) || 0)), rate: Number(l.rate) || 0, termYears: Number(l.termYears) || 30 }); });
  });
  (state.properties || []).filter(function(p){ return p.kind !== "IP"; }).forEach(function(p){
    (p.loans || []).forEach(function(l){ if(!loanPaidOut(l, localDateStr())) loans.push({ balance: Math.max(0, (Number(l.balance) || 0) - (Number(l.offsetBalance) || 0)), rate: Number(l.rate) || 0, termYears: Number(l.termYears) || 30 }); });
  });
  // Living costs: the budget as this scenario has it, less lines that are loan repayments (the loans above
  // are assessed instead), plus its own home's running costs.
  living += sumField(scenarioSharedItems(scenario).filter(function(l){ return !/\b(loan|mortgage)\b/i.test(String(l.what || "")); }), "monthly");
  if(livesElsewhere(scenario)) living += sumField((state.home[scenario] || []).filter(function(r){ return r.id !== "homeLoanRow"; }), "monthly");
  var r = serviceability({ incomeMonthly: scenarioIncomeMonthly({ scenario: base }), rentMonthly: rent, livingMonthly: living, loans: loans });
  return { ok: r.ok, surplus: Math.round(r.surplus), assessedMonthly: Math.round(r.assessedMonthly) };
}

// One line a person can act on: the deal-breakers first, then how it compares.
export function verdict(c){
  if(c.isBaseline) return "The household as it is — what every other scenario is measured against.";
  var parts = [];
  if(c.short > 0) parts.push("needs " + money(c.short) + " more cash at settlement than there is");
  if(c.lender && !c.lender.ok) parts.push("a lender would likely say no (repayments at the rate plus " + SERVICE_BUFFER + " points)");
  if(c.monthUnderStress < 0) parts.push("runs " + money(-c.monthUnderStress) + " a month short under stress");
  else if(c.monthAfterTax < 0) parts.push("runs " + money(-c.monthAfterTax) + " a month short");
  if(c.lowestCash < 0) parts.push("cash runs out along the way");
  else if(c.badStart && c.badStart.lowestCash < 0) parts.push("cash runs out after a bad first year");
  var end = c.netWorth[c.netWorth.length - 1].year;
  var ahead = c.aheadFrom != null ? (c.aheadFrom <= 1 ? "ahead of staying put from the first year" : "ahead of staying put from year " + c.aheadFrom)
    : c.aheadForAWhile != null ? "ahead of staying put for a while from year " + c.aheadForAWhile + ", behind again by year " + end
    : "behind staying put for the whole " + end + " years";
  if(!parts.length) return cap(ahead) + ", affordable on the figures here, and holds up under stress.";
  return cap(ahead) + " — but " + parts.join(", ") + ".";
}
function money(n){ return "$" + Math.round(n).toLocaleString("en-AU"); }
function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

// The baseline's series is worked out once for every column, not once per scenario.
export function compareAll(opts){
  opts = Object.assign({}, opts);
  var base = opts.baseline || currentScenario(), horizon = Math.max(20, Number(opts.horizon) || 20);
  if(!opts.baseSeries) opts.baseSeries = computeNetWorthSeries(base, horizon);
  return (state.scenarios || []).map(function(s){ return compareScenario(s, opts); });
}
