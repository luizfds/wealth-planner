import { state } from "../state.js";
import { getTaxPeople, personOneOffSplit, takeHomeAdjust } from "./tax.js";
import { receivedFor } from "./received.js";

// ---------------- Pay received against the plan (v3.87.0) ----------------
//
// The plan's take-home comes from gross pay and the tax tables. When what actually lands has sat
// clearly off it for three whole months running — the same direction each month — the plan is
// what's wrong, and every cash-flow figure and projection inherits it. This finds that, and the
// figure to plan with instead. Pure apart from reading state.
var MONTHS = 3;
function ym(iso){ return iso.slice(0, 7); }
function shift(m, n){ var d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
function lastDay(m){ return m + "-" + String(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate()).padStart(2, "0"); }

// { person, months: [{ym, received}], actual (monthly average), plan, estimate, adjust, gap, suggestedAdjust }
// or null when there aren't three whole logged months, or they don't agree.
export function takeHomeDrift(person, today){
  var cur = ym(today);
  var months = [];
  for(var i = MONTHS; i >= 1; i--){
    var m = shift(cur, -i);
    var got = receivedFor("net:" + person, m + "-01", lastDay(m)).reduce(function(s, r){ return s + (Number(r.amount) || 0); }, 0);
    months.push({ ym: m, received: Math.round(got * 100) / 100 });
  }
  if(months.some(function(x){ return !(x.received > 0); })) return null;
  var estimate = personOneOffSplit(person).regularNet / 12;
  var adjust = takeHomeAdjust(person);
  var plan = estimate + adjust;
  var actual = months.reduce(function(s, x){ return s + x.received; }, 0) / months.length;
  var tol = Math.max(150, plan * 0.04);
  var under = months.every(function(x){ return x.received < plan - tol; });
  var over = months.every(function(x){ return x.received > plan + tol; });
  if(!under && !over) return null;
  return { person: person, months: months, actual: r2(actual), plan: r2(plan), estimate: r2(estimate), adjust: adjust,
    gap: r2(actual - plan), suggestedAdjust: r2(actual - estimate) };
}
export function takeHomeDrifts(today){
  return getTaxPeople().map(function(p){ return takeHomeDrift(p, today); }).filter(Boolean);
}
export function setTakeHomeAdjust(person, value){
  if(!state.tax) state.tax = {};
  if(!state.tax.settings) state.tax.settings = {};
  if(!state.tax.settings[person]) state.tax.settings[person] = {};
  var v = Math.round((Number(value) || 0) * 100) / 100;
  if(v) state.tax.settings[person].takeHomeAdjust = v;
  else delete state.tax.settings[person].takeHomeAdjust;
}
function r2(n){ return Math.round(n * 100) / 100; }
