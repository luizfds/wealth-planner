// Household benchmarks (v3.35.0) — where a figure sits against a published Australian one.
// Pure: tables come from constants.js, ages and amounts come from the caller.
import { BENCHMARKS } from "../constants.js";

export function bandFor(bands, age){
  if(age == null || !isFinite(age)) return null;
  return (bands || []).find(function(b){ return age >= b.from && age <= b.to; }) || null;
}
export function bandLabel(b){
  return b.to >= 200 ? b.from + "+" : b.from + "–" + b.to;
}
// "2.1× the median" / "62% of the median" — a ratio reads better than a difference across bands
// whose figures differ tenfold.
export function relativeText(value, ref){
  if(!(ref > 0)) return "";
  var r = value / ref;
  if(r >= 1.995) return r.toFixed(1) + "× ";
  return Math.round(r * 100) + "% of ";
}
// One person's super against people their age. null when their age isn't known or out of range.
export function superComparison(balance, age){
  var b = bandFor(BENCHMARKS.super.bands, age);
  if(!b) return null;
  return {
    band: bandLabel(b), median: b.median, average: b.average, balance: balance,
    vsMedian: balance / b.median, aboveMedian: balance >= b.median, aboveAverage: balance >= b.average
  };
}
export function netWorthComparison(netWorth, age){
  var b = bandFor(BENCHMARKS.netWorth.bands, age);
  if(!b) return null;
  return { band: bandLabel(b), mean: b.mean, netWorth: netWorth, vsMean: netWorth / b.mean };
}
// Super against the ASFA lump sum at 67. Couples compare their combined balance with the couple
// figure — that is how ASFA states it.
export function retirementComparison(totalSuper, couple){
  var r = BENCHMARKS.retirement;
  var key = couple ? "couple" : "single";
  return { comfortable: r.comfortable[key], modest: r.modest[key], share: totalSuper / r.comfortable[key], couple: !!couple };
}
export function housingComparison(homeYearly, grossYearly, buying){
  if(!(grossYearly > 0)) return null;
  var ref = buying ? BENCHMARKS.housingShare.mortgage : BENCHMARKS.housingShare.renters;
  return { share: homeYearly / grossYearly, ref: ref, tenure: buying ? "owners with a mortgage" : "renters" };
}

// ---------------- Property against its suburb (v3.37.0) ----------------
// Compound annual growth between two values and dates. null under ~3 months — a yearly rate from
// a few weeks of change is noise blown up by the exponent.
export function cagr(fromValue, fromDate, toValue, toDate){
  var a = Number(fromValue), b = Number(toValue);
  if(!(a > 0) || !(b > 0) || !fromDate || !toDate) return null;
  var yrs = (Date.parse(toDate) - Date.parse(fromDate)) / (365.25 * 86400000);
  if(!(yrs >= 0.25)) return null;
  return Math.pow(b / a, 1 / yrs) - 1;
}
// One property's figures against what was typed for its suburb ({growthPa, yield, rentWeekly} as
// percentages / dollars). Each comparison only when both sides exist.
export function propertyMarketComparison(mine, market){
  market = market || {};
  var out = {};
  var g = Number(market.growthPa), y = Number(market.yield), r = Number(market.rentWeekly);
  if(mine.growthPa != null && market.growthPa !== "" && market.growthPa != null && isFinite(g)) out.growth = { mine: mine.growthPa, market: g / 100, diff: mine.growthPa - g / 100 };
  if(mine.yield != null && market.yield !== "" && market.yield != null && y > 0) out.yield = { mine: mine.yield, market: y / 100, diff: mine.yield - y / 100 };
  if(mine.rentWeekly > 0 && r > 0) out.rent = { mine: mine.rentWeekly, market: r, ratio: mine.rentWeekly / r };
  return out;
}
