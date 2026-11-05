import { state } from "../state.js";
import { scenarioTotals, computeNetWorthSeries, currentScenario, scenarioLegChanges, scenarioLegContext } from "./engine.js";
import { ipProperties, recalcPurchase, calcRepaymentMonthly, loanPaidOut } from "./property.js";
import { legsMonthly } from "./scenariolegs.js";

// ---------------- How sturdy a scenario is (items 252, 253) ----------------
//
// Two questions every buy-or-wait comparison ends up asking, answered on each scenario's card from the same figures
// the card already uses. Pure apart from reading state.

function r0(n){ return Math.round(n); }
function repaymentDelta(balance, rate, termYears, type, pts, offset){
  if(type === "IO") return Math.max(0, (Number(balance) || 0) - (Number(offset) || 0)) * pts / 1200;
  return calcRepaymentMonthly(balance, rate + pts, termYears, "PI") - calcRepaymentMonthly(balance, rate, termYears, "PI");
}
// Item 253: a normal month if every variable rate rose `pts` points — the household's loans, the scenario's
// purchase and any investment property it buys (with that property's tax effect), and what the offsets a deposit
// emptied stop saving. A loan's repayment rises with its rate even when it's typed in (a lender recalculates it).
// `t`: the scenario's totals when the caller has them already (a card does).
export function rateStress(scenario, pts, t){
  t = t || scenarioTotals(scenario);
  var more = 0;
  ipProperties().forEach(function(p){
    (p.loans || []).forEach(function(l){
      if(loanPaidOut(l)) return;
      more += repaymentDelta(l.balance, Number(l.rate) || 0, l.termYears, l.repaymentType, pts, l.offsetBalance);
    });
  });
  var cfg = state.purchase && state.purchase[scenario], inv = state.invest && state.invest[scenario];
  if(scenario !== state.baselineScenario && cfg && cfg.enabled && !(inv && inv.enabled)){
    var pu = recalcPurchase(scenario);
    if(pu) more += cfg.repaymentType === "IO" ? pu.loanBalance * pts / 1200
      : calcRepaymentMonthly(pu.loanBalance, (Number(cfg.rate) || 0) + pts, cfg.termYears, "PI") - pu.repaymentMonthlyPI;
  }
  var legs = scenarioLegChanges(scenario);
  if(legs.length){
    var ctx = scenarioLegContext(scenario);
    var a = legsMonthly(legs, ctx), b = legsMonthly(legs, Object.assign({}, ctx, { rateShockPts: (Number(ctx.rateShockPts) || 0) + pts }));
    more += (b.expensesMonthly - a.expensesMonthly) - (b.incomeMonthly - a.incomeMonthly);
  }
  // Item 256: an emptied offset's loan costs more as rates rise only where its repayment is the interest; a P&I
  // loan's repayment rise is already above, on its whole balance.
  if(t.draw) t.draw.draws.forEach(function(d){ if(d.interestOnly) more += d.take * pts / 1200; });
  return { pts: pts, regularNetMonthly: r0(t.regularNetMonthly - more), extraMonthly: r0(more) };
}

// Each scenario's break-even, kept until something it depends on changes (Plan's cards redraw on every edit).
var memo = {};
export function breakEvenGrowthCached(scenario, years, key){
  var k = scenario + "\u0000" + key;
  if(!(k in memo)){ if(Object.keys(memo).length > 50) memo = {}; memo[k] = breakEvenGrowth(scenario, years); }
  return memo[k];
}
// Item 252: the yearly price growth at which a scenario that buys its home ends `years` from now with the same net
// worth as the household as it is — found by halving the range, with the projection the chart uses (only the home's
// growth changes; the year-by-year income and costs are worked out once and reused). { pct } — or { below } when it
// comes out ahead even with prices falling 5% a year, { above } when no growth up to 20% a year gets it there.
export function breakEvenGrowth(scenario, years){
  years = years || 10;
  var base = currentScenario();
  var cfg = state.purchase && state.purchase[scenario], inv = state.invest && state.invest[scenario];
  if(!scenario || scenario === base || !cfg || !cfg.enabled || (inv && inv.enabled)) return null;
  var target = computeNetWorthSeries(base, years)[years].y;
  var cache = {};
  var gap = function(g){ return computeNetWorthSeries(scenario, years, { homeGrowthPct: g, cache: cache })[years].y - target; };
  var lo = -5, hi = 20;
  if(gap(lo) >= 0) return { against: base, years: years, below: lo };
  if(gap(hi) < 0) return { against: base, years: years, above: hi };
  for(var i = 0; i < 18; i++){
    var mid = (lo + hi) / 2;
    if(gap(mid) >= 0) hi = mid; else lo = mid;
  }
  return { against: base, years: years, pct: Math.round(hi * 10) / 10 };
}
