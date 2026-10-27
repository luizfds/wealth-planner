// ---------------- Estimates between logs (v3.114.0) ----------------
//
// Super arrives on a statement twice a year and a property's value once in a while, but the app
// asked for every asset every 30 days, so the banner nagged about things nobody has a new figure
// for. Between real figures the app can say roughly where each stands: super grows by the employer
// contributions since the last statement (after the 15% contributions tax) and the projection's
// return; a property by the projection's growth rate. Shown dated and marked as an estimate. A
// value is only called "due" once a real figure would normally have come (DUE_DAYS).
//
// Pure apart from reading state's projection and people.
import { state } from "../state.js";
import { computePersonTax } from "./tax.js";

// How long until a fresh real figure is normally available, by asset category.
export var DUE_DAYS = { Super: 190, Cash: 35, Shares: 35, Vehicle: 365, Other: 120 };
export var PROPERTY_DUE_DAYS = 365;

function daysBetween(a, b){ return Math.round((Date.parse(b + "T00:00:00") - Date.parse(a + "T00:00:00")) / 86400000); }
function lastOf(history){ var h = (history || []).filter(function(x){ return x && x.date; }); return h.length ? h[h.length - 1] : null; }

// Days after which this asset is due a fresh value, or null when it never is: a car whose value
// is worked out from its price and age, or shares priced from the sheet in the last week.
export function dueAfterDays(asset, today){
  if(asset.computed) return null;
  if(asset.category === "Shares" && asset.priceUpdated && today && daysBetween(String(asset.priceUpdated).slice(0, 10), today) <= 7) return null;
  return DUE_DAYS[asset.category] || DUE_DAYS.Other;
}

// { value, from: {date, value}, days, contributions, growth } or null without a dated figure.
export function superEstimate(asset, today, opts){
  opts = opts || {};
  var last = lastOf(asset.history);
  if(!last) return null;
  var days = Math.max(0, daysBetween(last.date, today));
  var yearsFrac = days / 365.25;
  var rate = (opts.returnPct != null ? opts.returnPct : Number((state.projection || {}).investReturnRate) || 0) / 100;
  var sgYear = opts.sgYearly;
  if(sgYear == null){ sgYear = 0; if(asset.person){ try { sgYear = Number(computePersonTax(asset.person).sg) || 0; } catch(e){ sgYear = 0; } } }
  var growth = (Number(last.value) || 0) * (Math.pow(1 + rate, yearsFrac) - 1);
  var contributions = sgYear * 0.85 * yearsFrac;
  var value = (Number(last.value) || 0) + growth + contributions;
  return { value: Math.round(value), from: { date: last.date, value: Number(last.value) || 0 }, days: days,
    contributions: Math.round(contributions), growth: Math.round(growth) };
}

// { value, from, days, ratePct } for a property's value today, or null without a dated record.
export function propertyEstimate(p, today, opts){
  opts = opts || {};
  var last = lastOf(p.history);
  if(!last) return null;
  var days = Math.max(0, daysBetween(last.date, today));
  var ratePct = opts.ratePct != null ? opts.ratePct : Number((state.projection || {}).propertyAppreciationRate) || 0;
  var value = (Number(last.value) || 0) * Math.pow(1 + ratePct / 100, days / 365.25);
  return { value: Math.round(value / 1000) * 1000, from: { date: last.date, value: Number(last.value) || 0 }, days: days, ratePct: ratePct };
}
