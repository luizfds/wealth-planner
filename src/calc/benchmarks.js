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
