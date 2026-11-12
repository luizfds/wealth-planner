import { scenarioBudgetComposition } from "../calc/engine.js";
import { fmtCurrency0, fmtPercent1 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

var SEGMENTS = [["needs","Needs"],["wants","Wants"],["other","Other spending / allocations"],["buffer","Left over"]];
function money(n){ return (n < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(n)); }
function share(amount,income){ return income > 0 ? fmtPercent1.format(amount / income) + ' of income' : 'No positive income'; }
function chartHtml(title,data){
  var positive = SEGMENTS.reduce(function(n,s){ return n + Math.max(0,data[s[0]]); },0), offset = 0;
  var slices = SEGMENTS.map(function(s){
    var size = positive ? Math.max(0,data[s[0]]) / positive * 100 : 0;
    var circle = '<circle class="budget-slice budget-' + s[0] + '" cx="20" cy="20" r="15.9155" fill="none" stroke-width="7" stroke-dasharray="' + size + ' ' + (100-size) + '" stroke-dashoffset="' + (-offset) + '"></circle>';
    offset += size; return circle;
  }).join('');
  return '<section class="budget-chart"><h4>' + escapeAttr(title) + '</h4><p>After-tax income <b>' + money(data.income) + '/mo</b></p>' +
    '<svg class="budget-pie" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="15.9155" fill="none" stroke="var(--border)" stroke-width="7"></circle>' + slices + '</svg>' +
    '<dl>' + SEGMENTS.map(function(s){ return '<div><dt><i class="budget-dot budget-' + s[0] + '" aria-hidden="true"></i>' + s[1] + '</dt><dd><b>' + money(data[s[0]]) + '</b><small>' + share(data[s[0]],data.income) + '</small></dd></div>'; }).join('') + '</dl>' +
    '<p>Across the year, including annual income/tax adjustments: <b>' + money(data.annualAverage) + '/mo left over</b>.</p></section>';
}
export function budgetComparisonHtml(baseline,scenario,name){
  var a = scenarioBudgetComposition(baseline), b = scenarioBudgetComposition(scenario);
  return '<section class="budget-comparison" aria-label="Needs and Wants comparison"><h3>Where the monthly income goes</h3><div class="budget-charts">' + chartHtml('Current / baseline',a) + chartHtml(name,b) + '</div>' +
    '<dl class="budget-deltas">' + SEGMENTS.map(function(s){
      var delta = b[s[0]] - a[s[0]], pp = a.income > 0 && b.income > 0 ? (b[s[0]]/b.income-a[s[0]]/a.income)*100 : null;
      return '<div><dt>' + s[1] + ' change</dt><dd>' + (delta >= 0 ? '+' : '−') + fmtCurrency0.format(Math.abs(delta)) + '/mo' + (pp == null ? '' : ' · ' + (pp >= 0 ? '+' : '−') + Math.abs(pp).toFixed(1) + ' percentage points') + '</dd></div>';
    }).join('') + '</dl><details><summary>What is included?</summary><p>Needs and Wants follow budget classifications. Home and investment loan repayments count as Needs, including principal. Other includes savings allocations, unclassified costs and changes. The categories plus leftover reconcile to after-tax income. Bonuses and annual tax adjustments are excluded from a normal month. Loan principal is not added again as an expense.</p><p>Rings show positive amounts only; negative credits and a shortfall remain in the figures. When there is a shortfall, slices represent the share of positive outgoings, while labels always show the share of income. This is the ongoing month once the scenario’s changes have happened; it is not a dated forecast.</p></details></section>';
}
