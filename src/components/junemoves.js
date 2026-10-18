import { getTaxPeople } from "../calc/tax.js";
import { juneMoves, inJuneWindow } from "../calc/junemoves.js";
import { fyLabel } from "../calc/property.js";
import { fmtCurrency0, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Tax → This year → Before 30 June (v3.51.0) ----------------
// calc/junemoves.js works the moves out; this lists them per person, biggest saving first.
export function juneMovesHtml(today){
  today = today || localDateStr();
  var people = getTaxPeople();
  if(!people.length) return '<p class="ledger-note" style="margin:0">Add a Gross income row with a person to see what is worth doing before 30 June.</p>';
  var any = false;
  var body = people.map(function(person){
    var j = juneMoves(person, today);
    if(!j.moves.length) return '<div class="jm-person"><h4>' + escapeAttr(person) + '</h4><p class="ledger-note" style="margin:0">Nothing worth doing this year from what the app knows.</p></div>';
    any = true;
    return '<div class="jm-person"><h4>' + escapeAttr(person) + ' <small>marginal rate ' + Math.round(j.marginal * 1000) / 10 + '% incl. Medicare</small></h4>' +
      j.moves.map(function(m){
        return '<div class="jm-move jm-' + m.kind + '"><div class="jm-head"><b>' + escapeAttr(m.title) + '</b>' +
          (m.saves ? '<span class="jm-saves">about ' + fmtCurrency0.format(m.saves) + (m.kind === "prepay" || m.kind === "interest" ? ' sooner' : ' less tax') + '</span>' : '') + '</div>' +
          '<p>' + escapeAttr(m.detail) + '</p></div>';
      }).join("") + '</div>';
  }).join("");
  var j0 = juneMoves(people[0], today);
  return '<p class="jm-lead">' + (inJuneWindow(today) ? '<b>' + j0.daysLeft + ' day' + (j0.daysLeft === 1 ? '' : 's') + '</b> until ' + fyLabel(j0.fy) + ' ends. ' : '') +
    (any ? 'What could still change this year\'s tax, worked out from your plan — estimates, not advice.' : '') + '</p>' + body;
}
export function renderJuneMoves(){
  var el = typeof document !== "undefined" && document.getElementById("juneMovesBody");
  if(!el) return;
  el.innerHTML = juneMovesHtml();
  var ledger = document.getElementById("juneMovesLedger");
  if(ledger && !ledger.dataset.seasonSet){ ledger.open = inJuneWindow(localDateStr()); ledger.dataset.seasonSet = "1"; }
}
