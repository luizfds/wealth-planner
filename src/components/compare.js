import { state } from "../state.js";
import { compareAll, COMPARE_YEARS } from "../calc/compare.js";
import { fmtCurrency0, fmtCompact } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Side by side (v3.175.0, item 210) — calc/compare.js works it out ----------------
// Under the scenario cards on Plan → Scenarios: a column per scenario, "stay as we are" first, a row
// per figure, and each scenario's one-line verdict.
function money(n){ return (n < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(n)); }
function delta(n){ return Math.abs(n) < 1 ? "" : ' <small class="' + (n > 0 ? "up" : "down") + '">' + (n > 0 ? "+" : "−") + fmtCompact(Math.abs(n)) + '</small>'; }

export function compareHtml(rows){
  rows = rows || compareAll();
  if(rows.length < 2) return "";
  var base = rows.find(function(r){ return r.isBaseline; }) || rows[0];
  var ordered = [base].concat(rows.filter(function(r){ return r !== base; }));
  var cell = function(r, html, cls){ return '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + html + '</td>'; };
  var row = function(label, fn, help){ return '<tr><th scope="row">' + label + (help ? '<small>' + help + '</small>' : '') + '</th>' + ordered.map(fn).join("") + '</tr>'; };
  return '<div class="cmp-card"><h2 class="section-title">Side by side</h2>' +
    '<p class="ledger-note" style="margin:0 0 10px">Each scenario against staying as you are, from the same figures as the cards and the projection.</p>' +
    '<div class="cmp-scroll"><table class="cmp-table"><thead><tr><th scope="col"></th>' + ordered.map(function(r){ return '<th scope="col">' + escapeAttr(r.isBaseline ? r.scenario + " (as we are)" : r.scenario) + '</th>'; }).join("") + '</tr></thead><tbody>' +
      row("Cash at settlement", function(r){ return cell(r, r.upfront ? money(r.upfront) + (r.short ? '<small class="down">' + money(r.short) + ' short</small>' : '') : "—", r.short ? "is-bad" : ""); }, money(base.available) + " available") +
      row("A month, before tax", function(r){ return cell(r, money(r.monthBeforeTax), r.monthBeforeTax < 0 ? "is-bad" : ""); }) +
      row("A month, after tax", function(r){ return cell(r, money(r.monthAfterTax), r.monthAfterTax < 0 ? "is-bad" : ""); }, "with a property's tax effect") +
      row("Under stress", function(r){ return cell(r, money(r.monthUnderStress), r.monthUnderStress < 0 ? "is-bad" : ""); }, "rates +2%, a month vacant, rent −10%") +
      row("Lowest cash", function(r){ return cell(r, money(r.lowestCash), r.lowestCash < 0 ? "is-bad" : ""); }, "over the projection") +
      COMPARE_YEARS.map(function(yr, i){
        return row("Net worth in " + yr + " years", function(r){ var nw = r.netWorth[i]; return cell(r, fmtCompact(nw.value) + (r.isBaseline ? "" : delta(nw.vsBase))); });
      }).join("") +
      row("Ahead of staying put", function(r){ return cell(r, r.isBaseline ? "—" : r.aheadFrom == null ? (r.aheadForAWhile != null ? "From year " + r.aheadForAWhile + ", behind again by year " + COMPARE_YEARS[COMPARE_YEARS.length - 1] : "Not within " + COMPARE_YEARS[COMPARE_YEARS.length - 1] + " years") : r.aheadFrom <= 1 ? "From the first year" : "From year " + r.aheadFrom); }) +
    '</tbody></table></div>' +
    '<ul class="cmp-verdicts">' + ordered.filter(function(r){ return !r.isBaseline; }).map(function(r){ return '<li><b>' + escapeAttr(r.scenario) + '</b> ' + escapeAttr(r.verdict) + '</li>'; }).join("") + '</ul></div>';
}
export function renderCompare(){
  var el = typeof document !== "undefined" && document.getElementById("scenarioCompare");
  if(!el) return;
  try { el.innerHTML = compareHtml(); } catch(e){ el.innerHTML = ""; }
}
