// ---------------- A range of outcomes (v3.125.0) ----------------
//
// The projection and the retirement answer both assume the same return every year. Real returns
// arrive unevenly, and the order matters: a bad decade just after retiring does far more damage
// than the same decade twenty years earlier. This runs the same plan many times, each with its own
// sequence of yearly returns drawn around the rates set on Plan → Projections, and reports the
// spread: a 10th–90th percentile band on the projection, and the share of runs in which a
// retirement plan lasts.
//
// Returns are lognormal with the set rate as their average and the set volatility as their
// spread, independent year to year. The draws come from a fixed seed, so the band doesn't shift
// every time the page redraws — change an input and only that input's effect shows. Pure apart
// from what computeNetWorthSeries and simulateRetirementAt read.
import { computeNetWorthSeries } from "./engine.js";
import { simulateRetirementAt } from "./fire.js";
import { projectionRatios } from "./actuals.js";

export var DEFAULT_INVEST_VOL = 12, DEFAULT_PROPERTY_VOL = 6, LIVE_TO = 95;

// A small, fast, seedable generator (mulberry32) and a standard normal from it (Box–Muller).
export function seeded(seed){
  var a = seed >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normal(rng){ var u = 0, v = 0; while(u === 0) u = rng(); while(v === 0) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// `years` yearly returns averaging `mean` with standard deviation `vol` (both as fractions).
// index 0 is left undefined so path[year] lines up with the projection's year numbers.
export function returnPath(rng, years, mean, vol, fromZero){
  var g = 1 + mean;
  var s2 = Math.log(1 + (vol * vol) / (g * g)), mu = Math.log(g) - s2 / 2, s = Math.sqrt(s2);
  var out = [];
  for(var i = 0; i <= years; i++) out[i] = i === 0 && !fromZero ? undefined : Math.exp(mu + s * normal(rng)) - 1;
  return out;
}
export function percentile(sorted, p){
  if(!sorted.length) return null;
  var i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
function rates(projection){
  var p = projection || {};
  return {
    invest: (Number(p.investReturnRate) || 0) / 100, property: (Number(p.propertyAppreciationRate) || 0) / 100,
    inflation: (Number(p.inflationRate) || 0) / 100,
    investVol: (p.investVolatility == null || p.investVolatility === "" ? DEFAULT_INVEST_VOL : Number(p.investVolatility) || 0) / 100,
    propertyVol: (p.propertyVolatility == null || p.propertyVolatility === "" ? DEFAULT_PROPERTY_VOL : Number(p.propertyVolatility) || 0) / 100
  };
}

// { lo: [{x,y}], mid: [...], hi: [...], runs } — the 10th, 50th and 90th percentile of net worth
// each year across `runs` runs of the scenario. opts: { runs, seed, realTerms, projection }.
export function projectionBands(scenario, horizon, opts){
  opts = opts || {};
  var runs = opts.runs || 300, rng = seeded(opts.seed || 20260701), rt = rates(opts.projection);
  var cache = {}, ratios = projectionRatios(), byYear = [];
  for(var i = 0; i < runs; i++){
    var pts = computeNetWorthSeries(scenario, horizon, { realTerms: opts.realTerms, cache: cache, ratios: ratios,
      investReturns: returnPath(rng, horizon, rt.invest, rt.investVol), propertyReturns: returnPath(rng, horizon, rt.property, rt.propertyVol) });
    pts.forEach(function(p){ (byYear[p.x] = byYear[p.x] || []).push(p.y); });
  }
  var pick = function(q){ return byYear.map(function(ys, x){ return { x: x, y: percentile(ys, q) }; }); };
  byYear.forEach(function(ys){ ys.sort(function(a, b){ return a - b; }); });
  return { lo: pick(0.1), mid: pick(0.5), hi: pick(0.9), runs: runs };
}

// The share of runs in which stopping work at `age` bridges to preservation age and then lasts to
// LIVE_TO, spending the same each year. inputs: retirementInputs(). Real returns, so the average is
// the real rate and the spread the investment volatility.
export function retirementOdds(age, inputs, opts){
  opts = opts || {};
  var runs = opts.runs || 1000, rng = seeded(opts.seed || 19640701);
  var vol = rates(opts.projection).investVol;
  var years = LIVE_TO - inputs.currentAge + 1, ok = 0, lasts = [];
  for(var i = 0; i < runs; i++){
    var run = simulateRetirementAt(age, Object.assign({}, inputs, { returns: returnPath(rng, years, inputs.realReturn, vol, true), toAge: LIVE_TO }));
    if(!run) return null;
    if(run.bridgeSurvives && run.lastsTo >= LIVE_TO) ok++;
    lasts.push(run.bridgeSurvives ? run.lastsTo : age);
  }
  lasts.sort(function(a, b){ return a - b; });
  return { age: age, chance: ok / runs, runs: runs, worstTenthLastsTo: Math.round(percentile(lasts, 0.1)) };
}
// The earliest age at which at least `target` of runs last.
export function ageForOdds(inputs, target, opts){
  for(var age = inputs.currentAge; age <= 75; age++){
    var o = retirementOdds(age, inputs, Object.assign({ runs: 400 }, opts));
    if(o && o.chance >= target) return age;
  }
  return null;
}
