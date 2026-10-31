// ---------------- Side by side (v3.175.0, item 210) ----------------
//
// Each scenario against "stay as we are", in the figures a decision turns on: the cash it needs at
// settlement against the cash there is; what a month leaves, before and after the tax effect of an
// investment property; the lowest cash gets over the projection; net worth in 5, 10 and 20 years;
// the month under stress (rates up 2%, a month more vacant, rent down a tenth); the first year it's
// ahead of staying put; and a one-line verdict. Every figure is read off the engine (scenarioTotals,
// computeNetWorthSeries), so this can't disagree with the cards or the projection.

import { state } from "../state.js";
import { scenarioTotals, computeNetWorthSeries, currentScenario, liquidAssetsValue, scenarioLegChanges, scenarioLegContext } from "./engine.js";
import { recalcPurchase, calcRepaymentMonthly, purchaseActiveRate, ipProperties, shockedLoanRepaymentMonthly } from "./property.js";
import { sumField } from "./ledger.js";
import { ipFigures } from "./scenariolegs.js";

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
  var upfront = (buying ? (recalcPurchase(scenario) || {}).upfrontCash || 0 : 0) + (t.changesUpfront || 0) + (investing ? Number(inv.initialAmount) || 0 : 0);
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
  var monthAfter = t.regularNetMonthly != null ? t.regularNetMonthly : t.netMonthly;
  var monthBefore = monthAfter - (t.changesTaxMonthly || 0);
  var out = {
    scenario: scenario, isBaseline: scenario === base,
    upfront: r0(upfront), available: r0(available), short: r0(Math.max(0, upfront - available)),
    monthBeforeTax: r0(monthBefore), monthAfterTax: r0(monthAfter), monthUnderStress: r0(monthAfter - stress),
    lowestCash: r0(lowest),
    netWorth: COMPARE_YEARS.map(function(yr){ return { year: yr, value: r0(series[Math.min(yr, series.length - 1)].y), vsBase: r0(series[Math.min(yr, series.length - 1)].y - baseSeries[Math.min(yr, baseSeries.length - 1)].y) }; }),
    aheadFrom: aheadFrom, aheadForAWhile: aheadForAWhile
  };
  out.verdict = verdict(out);
  return out;
}

// One line a person can act on: the deal-breakers first, then how it compares.
export function verdict(c){
  if(c.isBaseline) return "The household as it is — what every other scenario is measured against.";
  var parts = [];
  if(c.short > 0) parts.push("needs " + money(c.short) + " more cash at settlement than there is");
  if(c.monthUnderStress < 0) parts.push("runs " + money(-c.monthUnderStress) + " a month short under stress");
  else if(c.monthAfterTax < 0) parts.push("runs " + money(-c.monthAfterTax) + " a month short");
  if(c.lowestCash < 0) parts.push("cash runs out along the way");
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
