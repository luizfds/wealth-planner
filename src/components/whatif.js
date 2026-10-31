// ---------------- What-ifs you can drag (v3.177.0, item 204) ----------------
//
// The strip of sliders on Plan → Projections. Values live here for the session (not saved — a
// what-if is a question, not a plan, until "Keep this" makes it a scenario); calc/whatif.js turns
// them into changes and the projection draws them against the saved plan, dashed.

import { state } from "../state.js";
import { whatIfDefaults, whatIfMoved } from "../calc/whatif.js";
import { fmtCurrency0 } from "../lib/format.js";

export var wi = { values: null };
export function whatIfValues(){
  if(!wi.values) wi.values = whatIfDefaults();
  return wi.values;
}
export function resetWhatIf(){ wi.values = whatIfDefaults(); }

var KEEP_WORKING = 76;
export var WI_SLIDERS = [
  { key: "retireAge", label: "Retire at", min: 0, max: KEEP_WORKING, step: 1 },
  { key: "investReturnRate", label: "Investment return", min: 0, max: 12, step: 0.5 },
  { key: "inflationRate", label: "Inflation", min: 0, max: 8, step: 0.25 },
  { key: "extraMonthly", label: "Saved more a month", min: -2000, max: 5000, step: 50 },
  { key: "rateShockPct", label: "Rates up", min: 0, max: 5, step: 0.25 }
];
export function wiValueText(key, v, w){
  if(key === "retireAge") return v == null ? "Keep working" : String(v);
  if(key === "extraMonthly") return (v < 0 ? "−" : v > 0 ? "+" : "") + fmtCurrency0.format(Math.abs(v));
  if(key === "rateShockPct") return "+" + v + " pts";
  return v + "%";
}
// From a slider's position to a value (retire's last notch is "keep working").
export function wiFromSlider(key, raw){
  var n = Number(raw);
  if(key === "retireAge") return n >= KEEP_WORKING ? null : n;
  return n;
}
export function whatIfStripHtml(){
  var w = whatIfValues();
  var age = whatIfDefaults().currentAge; // live: the age can be set on Retirement after the strip first drew
  var moved = whatIfMoved(w);
  var row = function(s){
    var min = s.min, v = w[s.key], pos = v;
    if(s.key === "retireAge"){
      if(age == null) return '<div class="wi-field wi-off"><span class="wi-label">Retire at</span><span class="wi-note">Add your age on Plan → Retirement to try a retirement age</span></div>';
      min = Math.min(KEEP_WORKING - 1, Math.max(age + 1, 30));
      pos = v == null ? KEEP_WORKING : v;
    }
    return '<label class="wi-field"><span class="wi-label">' + s.label + ' <b data-wi-val="' + s.key + '">' + wiValueText(s.key, v, w) + '</b></span>' +
      '<input type="range" class="proj-slider" data-wi="' + s.key + '" min="' + min + '" max="' + s.max + '" step="' + s.step + '" value="' + pos + '" aria-label="' + s.label + '"></label>';
  };
  return '<div class="wi-head"><b>What if…</b><span class="wi-hint">Drag — the chart redraws against your saved plan (dashed). Nothing is saved until you keep it.</span></div>' +
    '<div class="wi-grid">' + WI_SLIDERS.map(row).join("") + '</div>' +
    '<div class="wi-actions"><button type="button" class="btn btn-sm btn-primary" data-wi-keep' + (moved ? '' : ' disabled') + '>Keep this as a scenario</button>' +
    '<button type="button" class="btn btn-sm btn-ghost" data-wi-reset' + (moved ? '' : ' disabled') + '>Back to the plan</button></div>';
}
