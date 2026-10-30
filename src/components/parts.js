import { state } from "../state.js";
import { PARTS, partOn, partReading } from "../calc/parts.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Only the parts you use (v3.161.0, item 191) — calc/parts.js decides ----------------
// A part that's off adds `no-part-<key>` to <body>, and CSS hides anything marked data-part="<key>":
// the Property tab on the Net worth rail, Investments' Shares tab. Lists built in JS (reports,
// Benchmarks, notices, Checks) ask partOn() themselves.
export function applyParts(){
  if(typeof document === "undefined") return;
  PARTS.forEach(function(p){ document.body.classList.toggle("no-part-" + p.key, !partOn(p.key, state)); });
}

// Settings → Preferences → What this household has.
export function partsSettingsHtml(st){
  st = st || state;
  return '<div class="parts-list">' + PARTS.map(function(p){
    var r = partReading(p.key, st);
    var auto = r.hasData ? "yes — you have one" : "no — none added yet";
    var opt = function(v, label){ return '<button type="button" class="seg-option' + (r.setting === v ? " active" : "") + '" data-part-set="' + p.key + '" data-part-value="' + v + '" aria-pressed="' + (r.setting === v) + '">' + label + '</button>'; };
    return '<div class="parts-row"><div class="parts-name"><b>' + escapeAttr(p.label) + '</b><small>' + escapeAttr(p.hint) + '</small></div>' +
      '<div class="seg-control" role="group" aria-label="' + escapeAttr(p.label) + '">' + opt("auto", "From my data") + opt("on", "Yes") + opt("off", "No") + '</div>' +
      (r.setting === "auto" ? '<small class="parts-auto">Right now: ' + auto + '</small>' : '') + '</div>';
  }).join("") + '</div>';
}
export function renderPartsSettings(){
  var el = document.getElementById("partsSettings");
  if(el) el.innerHTML = partsSettingsHtml(state);
}
export function setPart(key, value){
  if(!state.parts || typeof state.parts !== "object") state.parts = {};
  if(value === "auto") delete state.parts[key]; else state.parts[key] = value === "on" ? "on" : "off";
}

// Under Net worth, while a part is hidden: the way back in, one tap — it turns the part on and opens it.
export function hiddenPartsLineHtml(st){
  st = st || state;
  var off = PARTS.filter(function(p){ return !partOn(p.key, st); });
  if(!off.length) return "";
  var label = { property: "Add a property", shares: "Add shares" };
  return '<p class="ledger-note parts-hidden-line">Own ' + off.map(function(p){ return p.key === "property" ? "a property" : "shares"; }).join(" or ") + ' too? ' +
    off.map(function(p){ return '<button type="button" class="link-btn" data-part-show="' + p.key + '">' + label[p.key] + '</button>'; }).join(" · ") + '</p>';
}
