// ---------------- What-ifs you can drag (v3.177.0, item 204) ----------------
//
// Plan → Projections' sliders — retire at, investment return, inflation, saved more a month, rates up —
// are a scenario that doesn't exist yet: the household (or whichever scenario is picked) plus a few
// changes. whatIfChanges turns the sliders into those changes; previewSeries draws them through the
// engine on a scratch scenario that's removed again before it returns; keepWhatIf makes the same thing
// a real scenario. One construction for both, so a kept what-if is exactly what was previewed.
//
//   { kind: "assume", investReturnRate, inflationRate, rateShockPct } — this scenario's own assumptions
//   { kind: "retire", age }                                          — pay stops from the year of this age
//   { kind: "cost", what: "Saved more each month", amount: -X }      — X a month more saved

import { state } from "../state.js";
import { computeNetWorthSeries } from "./engine.js";
import { changesFor } from "./scenariochanges.js";

var SCRATCH = "\u0000what-if";
function num(v){ var n = Number(v); return isFinite(n) ? n : 0; }

// The sliders' starting values: the saved plan.
export function whatIfDefaults(st){
  st = st || state;
  var p = st.projection || {}, f = st.fire || {};
  return { retireAge: null, investReturnRate: num(p.investReturnRate), inflationRate: num(p.inflationRate), extraMonthly: 0, rateShockPct: num(p.rateShockPct),
    currentAge: f.currentAge == null || f.currentAge === "" ? null : num(f.currentAge) };
}
// Whether the sliders say anything the saved plan doesn't.
export function whatIfMoved(w, st){
  var d = whatIfDefaults(st);
  return w.retireAge != null || num(w.extraMonthly) !== 0 || num(w.investReturnRate) !== d.investReturnRate || num(w.inflationRate) !== d.inflationRate || num(w.rateShockPct) !== d.rateShockPct;
}
export function whatIfChanges(w, st, idFactory){
  var d = whatIfDefaults(st), out = [];
  var id = idFactory || (function(){ var n = 0; return function(){ return "wi" + (++n); }; })();
  var assume = {};
  if(num(w.investReturnRate) !== d.investReturnRate) assume.investReturnRate = num(w.investReturnRate);
  if(num(w.inflationRate) !== d.inflationRate) assume.inflationRate = num(w.inflationRate);
  if(num(w.rateShockPct) !== d.rateShockPct) assume.rateShockPct = num(w.rateShockPct);
  if(Object.keys(assume).length) out.push(Object.assign({ id: id(), kind: "assume" }, assume));
  if(w.retireAge != null) out.push({ id: id(), kind: "retire", age: num(w.retireAge) });
  if(num(w.extraMonthly) !== 0) out.push({ id: id(), kind: "cost", what: "Saved more each month", amount: -num(w.extraMonthly), freq: "Monthly", fromYear: 0 });
  return out;
}
// A scenario built on `base` with the what-if's changes: base's own changes stay, except the ones a
// slider replaces (its assumptions and retirement).
function install(st, name, base, changes){
  var copy = function(x){ return x == null ? x : JSON.parse(JSON.stringify(x)); };
  st.purchase[name] = copy(st.purchase[base]);
  st.invest[name] = copy(st.invest[base]);
  st.home[name] = copy(st.home[base]) || [];
  if(!st.scenarioChanges) st.scenarioChanges = {};
  var replaced = {};
  changes.forEach(function(c){ if(c.kind === "assume" || c.kind === "retire") replaced[c.kind] = true; });
  st.scenarioChanges[name] = changesFor(base, st).filter(function(c){ return !replaced[c.kind]; }).map(copy).concat(changes);
}
export function previewSeries(base, w, horizon, opts){
  var st = state;
  try {
    install(st, SCRATCH, base, whatIfChanges(w, st));
    return computeNetWorthSeries(SCRATCH, horizon, opts);
  } finally {
    delete st.purchase[SCRATCH]; delete st.invest[SCRATCH]; delete st.home[SCRATCH];
    if(st.scenarioChanges) delete st.scenarioChanges[SCRATCH];
  }
}
// A name for it, in words: "Retire at 58, 2% more saved…" — short.
export function whatIfName(w, st){
  var d = whatIfDefaults(st), bits = [];
  if(w.retireAge != null) bits.push("Retire at " + num(w.retireAge));
  if(num(w.extraMonthly)) bits.push((num(w.extraMonthly) > 0 ? "Save $" : "Save -$") + Math.abs(Math.round(num(w.extraMonthly))).toLocaleString("en-AU") + " more");
  if(num(w.investReturnRate) !== d.investReturnRate) bits.push(num(w.investReturnRate) + "% return");
  if(num(w.inflationRate) !== d.inflationRate) bits.push(num(w.inflationRate) + "% inflation");
  if(num(w.rateShockPct) !== d.rateShockPct) bits.push("rates +" + num(w.rateShockPct));
  return bits.join(", ") || "What if";
}
export function keepWhatIf(base, w, idFactory, st){
  st = st || state;
  var name = whatIfName(w, st), n = 2, stem = name;
  while(st.scenarios.indexOf(name) !== -1) name = stem + " (" + (n++) + ")";
  install(st, name, base, whatIfChanges(w, st, idFactory));
  st.scenarios.push(name);
  return name;
}
