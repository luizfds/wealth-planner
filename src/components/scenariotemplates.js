import { state } from "../state.js";
import { TEMPLATES, questionsFor } from "../calc/scenariotemplates.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- "What are you weighing?" (v3.174.0, item 209) — calc/scenariotemplates.js builds ----------------
// The sheet "Add scenario" opens: a choice, then its few questions, then the scenario.
export var startQ = { open: false, key: null };

export function templateContext(){
  var today = state.baselineScenario;
  var homeLines = (state.shared || []).filter(function(l){ return l && l.homeCost; });
  var renting = homeLines.some(function(l){ return /rent/i.test(l.what || ""); }) || !(state.properties || []).some(function(p){ return p.kind !== "IP"; });
  var st = (state.purchase && today && state.purchase[today] && state.purchase[today].state) || "NSW";
  return { renting: renting, properties: state.properties || [], state: st };
}
function inputHtml(q){
  var id = "sq-" + q.key;
  var field = q.type === "select"
    ? '<select id="' + id + '" data-sq="' + q.key + '">' + (q.options || []).map(function(o){ var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return '<option value="' + escapeAttr(v) + '"' + (String(v) === String(q.value) ? " selected" : "") + '>' + escapeAttr(l) + '</option>'; }).join("") + '</select>'
    : '<input id="' + id + '" data-sq="' + q.key + '" type="' + (q.type === "number" ? "number" : "text") + '"' + (q.type === "number" ? ' step="any" inputmode="decimal"' : '') + ' value="' + escapeAttr(q.value == null ? "" : q.value) + '"' + (q.placeholder ? ' placeholder="' + escapeAttr(q.placeholder) + '"' : '') + '>';
  return '<label class="fr-field" for="' + id + '"><span>' + escapeAttr(q.label) + '</span>' + field + '</label>';
}
export function startSheetHtml(ctx){
  ctx = ctx || templateContext();
  var head = function(title){ return '<div class="review-head"><h4>' + title + '</h4><button type="button" class="icon-btn" data-sq-close aria-label="Close">✕</button></div>'; };
  var body;
  if(!startQ.key){
    body = head("What are you weighing?") +
      '<div class="sq-choices">' + TEMPLATES.map(function(t){
        var off = t.key === "payDown" && !(ctx.properties || []).some(function(p){ return (p.loans || []).length; });
        return '<button type="button" class="sq-choice" data-sq-pick="' + t.key + '"' + (off ? ' disabled title="There\'s no property loan to pay down yet"' : '') + '><b>' + escapeAttr(t.label) + '</b><small>' + escapeAttr(t.hint) + '</small></button>';
      }).join("") + '</div>' +
      '<button type="button" class="link-btn sq-blank" data-sq-blank>Or start from today, blank, and add changes yourself</button>';
  } else {
    var t = TEMPLATES.find(function(x){ return x.key === startQ.key; });
    body = head(escapeAttr(t.label)) + '<p class="ledger-note" style="margin:0 0 10px">' + escapeAttr(t.hint) + '. Everything here can be changed afterwards.</p>' +
      '<div class="sq-form">' + questionsFor(startQ.key, ctx).map(inputHtml).join("") + '</div>' +
      '<div class="txr-actions"><button type="button" class="btn btn-ghost" data-sq-back>Back</button><button type="button" class="btn btn-primary" data-sq-make>Make the scenario</button></div>';
  }
  return '<div class="review-backdrop" data-sq-backdrop><div class="review-panel sq-panel" role="dialog" aria-modal="true" aria-label="Add a scenario">' + body + '</div></div>';
}
