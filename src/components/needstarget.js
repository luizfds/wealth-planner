// ---------------- Needs as a share of take-home: the setting and what it would take (#389) ----------------
//
// One household setting (state.needsTarget, 1–100, default 50) read in two places: Settings → Preferences, and the
// scenario comparison, where it is changed beside the figures it moves. The calculation is calc/needstarget.js.
import { needsTargetFor, needsTargetPct } from "../calc/needstarget.js";
import { fieldHtml } from "../lib/field.js";
import { fmtCurrency0, fmtPercent1 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { keepUi } from "../lib/keepui.js";
import { state } from "../state.js";

function money(n){ return (n < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(n)); }
function pct(n){ return Math.round(n * 10) / 10 + "%"; }

// The field, wherever it's shown. `id` keeps the two copies' labels apart.
export function needsTargetFieldHtml(id){
  return fieldHtml({ id: id, label: "Essentials at most", type: "number", value: needsTargetPct(state), unit: "% of take-home",
    className: "needs-target-input", attrs: { "data-needs-target": "", min: "1", max: "100", step: "1", inputmode: "decimal" } });
}

// One copy's answer, in words: what Needs are now, the take-home the target would take, and how much more.
export function needsTargetLinesHtml(r){
  var lines = [];
  if(r.state === "noNeeds") return '<p class="needs-target-line">Nothing is marked Essential here, so there is nothing to measure.</p>';
  if(r.state === "noIncome"){
    lines.push("No take-home in a normal month. Essentials of " + money(r.needs) + "/mo at " + pct(r.target) + " would take " + money(r.required) + "/mo of take-home.");
  } else {
    lines.push("Essentials are " + money(r.needs) + "/mo, " + fmtPercent1.format(r.share) + " of " + money(r.income) + "/mo take-home.");
    if(r.state === "met") lines.push("Within " + pct(r.target) + " — no more take-home needed.");
    else {
      if(r.state === "over") lines.push("Essentials are " + money(r.cover) + "/mo more than the whole take-home, before anything else.");
      lines.push("For Essentials to be " + pct(r.target) + ": " + money(r.required) + "/mo take-home — " + money(r.more) + "/mo more, " + fmtPercent1.format(r.increase) + " above today's.");
    }
  }
  return lines.map(function(l){ return '<p class="needs-target-line">' + escapeAttr(l) + "</p>"; }).join("");
}

// The scenario comparison's part: baseline and scenario side by side, from scenarioBudgetComposition()'s figures.
export function needsTargetCompareHtml(a, b, name){
  var t = needsTargetPct(state), ra = needsTargetFor(a, t), rb = needsTargetFor(b, t);
  var gap = rb.more - ra.more;
  return '<section class="needs-target" aria-labelledby="needsTargetHead">' +
    '<h4 id="needsTargetHead">Take-home for Essentials at ' + escapeAttr(pct(t)) + '</h4>' +
    needsTargetFieldHtml("needsTargetScenario") +
    '<div class="needs-target-pair">' +
      '<div><h5>Current / baseline</h5>' + needsTargetLinesHtml(ra) + '</div>' +
      '<div><h5>' + escapeAttr(name) + '</h5>' + needsTargetLinesHtml(rb) + '</div>' +
    '</div>' +
    (ra.state !== "noNeeds" && rb.state !== "noNeeds" && Math.round(gap) ? '<p class="needs-target-line"><b>' + escapeAttr(name) + " needs " + escapeAttr(money(Math.abs(gap))) + "/mo " + (gap > 0 ? "more" : "less") + " take-home than today to keep Essentials at " + escapeAttr(pct(t)) + ".</b></p>" : "") +
    '<p class="ledger-note needs-target-note">A target share of a normal month’s take-home, not a spending recommendation. Essentials stay as they are; more take-home is room for Lifestyle, savings and what’s left over. Annual income (a bonus, a tax refund) is left out, as above. This is take-home, after tax — a pay rise before tax would have to be larger. 50% is the Needs part of Home’s 50/30/20.</p>' +
  "</section>";
}

// Settings → Preferences.
export function renderNeedsTargetPref(){
  var el = typeof document !== "undefined" && document.getElementById("needsTargetPref");
  if(!el) return;
  keepUi(function(){ el.innerHTML = needsTargetFieldHtml("needsTargetPrefInput"); });
}
