import { compareAll, COMPARE_YEARS } from "../calc/compare.js";
import { fmtCurrency0, fmtCompact } from "../lib/format.js";
import { cashLastsOdds } from "../calc/outcomes.js";
import { escapeAttr } from "../lib/html.js";
import { keepUi } from "../lib/keepui.js";

export var compareDisplay = { scenario: "", fullTable: false };

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
  var metrics = [];
  var cell = function(r, html, cls){ return { html: html, cls: cls || "" }; };
  var row = function(label, fn, help){
    var values = ordered.map(fn);
    metrics.push({label:label, help:help || '', values:values});
    return '<tr data-cmp-metric="' + escapeAttr(label) + '"><th scope="row">' + label + (help ? '<small>' + help + '</small>' : '') + '</th>' + values.map(function(v){ return '<td' + (v.cls ? ' class="' + v.cls + '"' : '') + '>' + v.html + '</td>'; }).join('') + '</tr>';
  };
  var head = '<thead><tr><th scope="col">Metric</th>' + ordered.map(function(r){ return '<th scope="col">' + escapeAttr(r.isBaseline ? r.scenario + " (as we are)" : r.scenario) + '</th>'; }).join("") + '</tr></thead>';
  var tables = '<div class="cmp-table-view"><div class="cmp-scroll" role="region" aria-label="Scenario comparison; scroll horizontally for more scenarios" tabindex="0"><table class="cmp-table">' + head + '<tbody>' +
      row("Funding status", function(r){ return cell(r, r.short > 0 ? '<b class="down">Funding incomplete</b><small>Projections are hypothetical until the gap is funded.</small>' : (r.isBaseline ? "Current household" : "Funded from cash and offsets")); }) +
      row("Cash at settlement", function(r){ return cell(r, r.upfront ? money(r.upfront) + (r.short ? '<small class="down">' + money(r.short) + ' short</small>' : '') : "—", r.short ? "is-bad" : ""); }, money(base.available) + " cash and offsets available; selling investments is not assumed") +
      row("Cash left after settlement", function(r){ return cell(r, money(r.reserveAfter != null ? r.reserveAfter : Math.max(0, r.available - r.upfront))); }, "before setting aside an emergency reserve") +
      row("A month, before tax", function(r){ return cell(r, money(r.monthBeforeTax), r.monthBeforeTax < 0 ? "is-bad" : ""); }) +
      row("A month, after tax", function(r){ return cell(r, money(r.monthAfterTax), r.monthAfterTax < 0 ? "is-bad" : ""); }, "with a property's tax effect") +
      // v3.186.0 (item 217): whether a lender would likely lend what it borrows.
      row("Indicative serviceability check", function(r){ var l = r.lender; return cell(r, !l ? "—" : (l.ok ? "Passes <small>" + money(l.surplus) + " a month to spare</small>" : "Does not pass <small class=\"down\">" + money(-l.surplus) + " a month short</small>") + (l.livingSource === "floor" ? "<small class=\"cmp-floor\" title=\"Lenders take the higher of your living costs (" + money(l.livingDeclared) + " a month) and their own benchmark for a household like yours\">living costs at the lenders\u2019 floor, " + money(l.living) + "</small>" : ""), l && !l.ok ? "is-bad" : ""); }, "every loan at its rate + 3 points; living costs yours or lenders\u2019 floor, the higher") +
      row("Under stress", function(r){ return cell(r, money(r.monthUnderStress), r.monthUnderStress < 0 ? "is-bad" : ""); }, "rates +2%, a month vacant, rent −10%") +
      '</tbody></table></div><details class="cmp-longterm"><summary>Long-term projections and simulation assumptions</summary><p class="ledger-note">Estimates in today’s or future dollars as selected in Projections. These assume the scenario can be funded; simulation results are model outcomes, not a forecast or lending approval.</p><div class="cmp-scroll" role="region" aria-label="Long-term scenario comparison" tabindex="0"><table class="cmp-table">' + head + '<tbody>' +
      row("Lowest cash", function(r){ return cell(r, money(r.lowestCash), r.lowestCash < 0 ? "is-bad" : ""); }, "over the projection") +
      // v3.184.0 (item 215): the odds (filled in after the table draws — 60 runs each) and a bad start.
      row("Cash lasts", function(r){ return cell(r, r.short > 0 ? 'Funding incomplete<small>Fund the gap before interpreting cash survival.</small>' : '<span data-odds="' + escapeAttr(r.scenario) + '"><small>working out…</small></span>'); }, "runs of 10, returns rising and falling") +
      row("After a bad first year", function(r){ var b = r.badStart; return cell(r, b ? fmtCompact(b.netWorth10) + delta(b.vsUsual) + (b.lowestCash < 0 ? '<small class="down">cash runs out</small>' : '') : "—", b && b.lowestCash < 0 ? "is-bad" : ""); }, "net worth in 10 years; shares −20%, property −10% in year 1") +
      COMPARE_YEARS.map(function(yr, i){
        return row("Net worth in " + yr + " years", function(r){ var nw = r.netWorth[i]; return cell(r, fmtCompact(nw.value) + (r.isBaseline ? "" : delta(nw.vsBase))); });
      }).join("") +
      row("Ahead of staying put", function(r){ return cell(r, r.isBaseline ? "—" : r.aheadFrom == null ? (r.aheadForAWhile != null ? "From year " + r.aheadForAWhile + ", behind again by year " + COMPARE_YEARS[COMPARE_YEARS.length - 1] : "Not within " + COMPARE_YEARS[COMPARE_YEARS.length - 1] + " years") : r.aheadFrom <= 1 ? "From the first year" : "From year " + r.aheadFrom); }) +
    '</tbody></table></div></details>' +
    '<ul class="cmp-verdicts">' + ordered.filter(function(r){ return !r.isBaseline; }).map(function(r){ return '<li><b>' + escapeAttr(r.scenario) + '</b> ' + escapeAttr(r.verdict) + '</li>'; }).join("") + '</ul></div>';
  var selected = ordered.find(function(r){ return r.scenario === compareDisplay.scenario; }) || base;
  var primary = ['Funding status','Cash left after settlement','A month, after tax','Under stress'];
  function fields(list, index){
    return '<dl class="cmp-summary-fields">' + list.map(function(m){
      var v = m.values[index];
      return '<div data-cmp-metric="' + escapeAttr(m.label) + '"><dt>' + escapeAttr(m.label) + (m.help ? '<small>' + m.help + '</small>' : '') + '</dt><dd' + (v.cls ? ' class="' + v.cls + '"' : '') + '>' + v.html + '</dd></div>';
    }).join('') + '</dl>';
  }
  var summaries = '<div class="cmp-mobile-summary"><label class="rp-entity"><span>Scenario</span><select class="field-control" data-cmp-scenario>' + ordered.map(function(r){ return '<option value="' + escapeAttr(r.scenario) + '"' + (r === selected ? ' selected' : '') + '>' + escapeAttr(r.scenario + (r.isBaseline ? ' (as we are)' : '')) + '</option>'; }).join('') + '</select></label>' +
    ordered.map(function(r, i){
      return '<section class="cmp-scenario" data-cmp-summary="' + escapeAttr(r.scenario) + '"' + (r === selected ? '' : ' hidden') + '><h3>' + escapeAttr(r.scenario) + '</h3>' +
        '<p class="ledger-note">' + escapeAttr(r.isBaseline ? 'Current household: the basis for comparison.' : 'Compared with ' + base.scenario + ' (as we are).') + '</p>' +
        fields(metrics.slice(0,7).filter(function(m){ return primary.includes(m.label); }), i) +
        '<details class="cmp-summary-details"><summary>Details</summary>' + fields(metrics.slice(0,7).filter(function(m){ return !primary.includes(m.label); }), i) + '</details>' +
        '<details class="cmp-longterm"><summary>Long-term projections and simulation assumptions</summary><p class="ledger-note">Estimates in today’s or future dollars as selected in Projections. These assume the scenario can be funded; simulation results are model outcomes, not a forecast or lending approval.</p>' + fields(metrics.slice(7), i) + '</details>' +
        '<p class="cmp-summary-verdict">' + escapeAttr(r.verdict) + '</p></section>';
    }).join('') + '</div>';
  return '<div class="cmp-card" data-cmp-full-table="' + compareDisplay.fullTable + '"><h2 class="section-title">Side by side</h2>' +
    '<p class="ledger-note" style="margin:0 0 10px">Each scenario against staying as you are, from the same figures as the cards and the projection.</p>' +
    '<label class="cmp-display-control"><input type="checkbox" data-cmp-full-table-toggle' + (compareDisplay.fullTable ? ' checked' : '') + '> Full table <span class="cmp-table-instruction">— scroll horizontally to compare scenarios</span></label>' + summaries + tables + '</div>';
}
// The odds take ~60 runs a scenario, so they're filled in one scenario a tick after the table draws; a
// newer draw cancels an older one's.
var oddsJob = 0;
export function oddsCellHtml(o){
  return '<b>' + o.ofTen + ' in 10</b>' + (o.ofTen < 8 ? '<small class="down">' + (10 - o.ofTen) + ' in 10 run out</small>' : '');
}
export function renderCompare(){
  var el = typeof document !== "undefined" && document.getElementById("scenarioCompare");
  if(!el) return;
  var job = ++oddsJob;
  try { keepUi(function(){ el.innerHTML = compareHtml(); }); } catch(e){ el.innerHTML = ""; return; }
  var picker = el.querySelector('[data-cmp-scenario]');
  compareDisplay.scenario = picker ? picker.value : '';
  // Each scenario has table and summary cells: calculate once and fill both together.
  var cells = Array.from(el.querySelectorAll('[data-odds]'));
  var names = Array.from(new Set(cells.map(function(td){ return td.getAttribute('data-odds'); })));
  var next = function(){
    if(job !== oddsJob || !names.length) return;
    var name = names.shift(), o;
    try { o = cashLastsOdds(name, 20); } catch(e){ o = null; }
    cells.filter(function(td){ return td.getAttribute('data-odds') === name && td.isConnected; }).forEach(function(td){
      td.innerHTML = o ? oddsCellHtml(o) : '—';
      td.classList.toggle('is-bad', !!o && o.ofTen < 8);
    });
    setTimeout(next, 0);
  };
  setTimeout(next, 30);
}
