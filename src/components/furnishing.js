import { state, commit } from "../state.js";
import { escapeAttr } from "../lib/html.js";
import { fmtCurrency2 } from "../lib/format.js";
import { furnishingDecision } from "../calc/furnishing.js";

var inputs = [
  ["budget", "Furnishing budget"], ["spent", "Already spent on furniture"],
  ["cash", "Expected cash after settlement before this purchase"],
  ["buffer", "Cash buffer to keep"], ["price", "Try a purchase amount"]
];
function result(form){
  var values = inputs.map(function(field){ return form.elements[field[0]].valueAsNumber; });
  if(!form.checkValidity() || values.some(function(n){ return !Number.isFinite(n); })) return "Enter the amounts to compare a purchase. Use zero where appropriate.";
  var d = furnishingDecision(...values);
  var money = function(n){ return fmtCurrency2.format(Math.abs(n)); };
  return money(d.remaining) + (d.remaining < 0 ? " over budget. " : " remaining. ") +
    money(d.available) + " available before settlement. After this purchase: " +
    fmtCurrency2.format(d.after) + " cash, " + money(d.bufferMargin) +
    (d.bufferMargin < 0 ? " below" : " above") + " your buffer. " +
    money(d.budgetMargin) + (d.budgetMargin < 0 ? " over the project budget." : " left in the project budget.");
}
export function furnishingHtml(){
  return (state.purchases || []).map(function(p){
    var saved = p.furnishing || {};
    var fields = inputs.map(function(field){
      var key = field[0];
      return '<label class="field-label">' + field[1] + ' ($)<input class="field-control" name="' + key +
        '" required type="number" step="0.01"' + (key === "cash" ? "" : ' min="0"') +
        ' value="' + escapeAttr(saved[key] == null ? "" : String(saved[key])) + '"></label>';
    }).join("");
    return '<form class="trip-form" data-furnishing="' + escapeAttr(p.id) + '"><h3>Furnish the new home</h3><p>From savings · Linked to ' +
      escapeAttr(p.what || "property purchase") + '</p><div class="trip-form-grid">' + fields +
      '</div><p role="status"></p><button class="btn btn-primary" type="submit">Save estimate</button></form>';
  }).join("");
}
export function updateFurnishingResults(body){
  body.querySelectorAll("[data-furnishing]").forEach(function(form){ form.querySelector('[role="status"]').textContent = result(form); });
}
export function wireFurnishing(body){
  body.addEventListener("input", function(e){
    var form = e.target.closest("[data-furnishing]");
    if(form) form.querySelector('[role="status"]').textContent = result(form);
  });
  body.addEventListener("submit", function(e){
    var form = e.target.closest("[data-furnishing]");
    if(!form) return;
    e.preventDefault();
    var p = (state.purchases || []).find(function(entry){ return entry.id === form.dataset.furnishing; });
    if(!p || !form.reportValidity()) return;
    p.furnishing = Object.fromEntries(inputs.map(function(field){ return [field[0], form.elements[field[0]].valueAsNumber]; }));
    commit(["purchases"]);
  });
}
