import { compareAll, COMPARE_YEARS } from "../calc/compare.js";
import { fmtCurrency0, fmtCompact } from "../lib/format.js";
import { cashLastsOdds } from "../calc/outcomes.js";
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
      // v3.186.0 (item 217): whether a lender would likely lend what it borrows.
      row("A lender would likely", function(r){ var l = r.lender; return cell(r, !l ? "—" : (l.ok ? "Lend <small>" + money(l.surplus) + " a month to spare</small>" : "Say no <small class=\"down\">" + money(-l.surplus) + " a month short</small>") + (l.livingSource === "floor" ? "<small class=\"cmp-floor\" title=\"Lenders take the higher of your living costs (" + money(l.livingDeclared) + " a month) and their own benchmark for a household like yours\">living costs at the lenders\u2019 floor, " + money(l.living) + "</small>" : ""), l && !l.ok ? "is-bad" : ""); }, "every loan at its rate + 3 points; living costs yours or lenders\u2019 floor, the higher") +
      row("Under stress", function(r){ return cell(r, money(r.monthUnderStress), r.monthUnderStress < 0 ? "is-bad" : ""); }, "rates +2%, a month vacant, rent −10%") +
      row("Lowest cash", function(r){ return cell(r, money(r.lowestCash), r.lowestCash < 0 ? "is-bad" : ""); }, "over the projection") +
      // v3.184.0 (item 215): the odds (filled in after the table draws — 60 runs each) and a bad start.
      row("Cash lasts", function(r){ return '<td data-odds="' + escapeAttr(r.scenario) + '"><small>working out…</small></td>'; }, "runs of 10, returns rising and falling") +
      row("After a bad first year", function(r){ var b = r.badStart; return cell(r, b ? fmtCompact(b.netWorth10) + delta(b.vsUsual) + (b.lowestCash < 0 ? '<small class="down">cash runs out</small>' : '') : "—", b && b.lowestCash < 0 ? "is-bad" : ""); }, "net worth in 10 years; shares −20%, property −10% in year 1") +
      COMPARE_YEARS.map(function(yr, i){
        return row("Net worth in " + yr + " years", function(r){ var nw = r.netWorth[i]; return cell(r, fmtCompact(nw.value) + (r.isBaseline ? "" : delta(nw.vsBase))); });
      }).join("") +
      row("Ahead of staying put", function(r){ return cell(r, r.isBaseline ? "—" : r.aheadFrom == null ? (r.aheadForAWhile != null ? "From year " + r.aheadForAWhile + ", behind again by year " + COMPARE_YEARS[COMPARE_YEARS.length - 1] : "Not within " + COMPARE_YEARS[COMPARE_YEARS.length - 1] + " years") : r.aheadFrom <= 1 ? "From the first year" : "From year " + r.aheadFrom); }) +
    '</tbody></table></div>' +
    '<ul class="cmp-verdicts">' + ordered.filter(function(r){ return !r.isBaseline; }).map(function(r){ return '<li><b>' + escapeAttr(r.scenario) + '</b> ' + escapeAttr(r.verdict) + '</li>'; }).join("") + '</ul></div>';
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
  try { el.innerHTML = compareHtml(); } catch(e){ el.innerHTML = ""; return; }
  var job = ++oddsJob, cells = Array.prototype.slice.call(el.querySelectorAll("[data-odds]"));
  var next = function(){
    if(job !== oddsJob || !cells.length) return;
    var td = cells.shift(), o;
    try { o = cashLastsOdds(td.getAttribute("data-odds"), 20); } catch(e){ o = null; }
    if(td.isConnected){ td.innerHTML = o ? oddsCellHtml(o) : "—"; if(o && o.ofTen < 8) td.classList.add("is-bad"); }
    setTimeout(next, 0);
  };
  setTimeout(next, 30);
}
