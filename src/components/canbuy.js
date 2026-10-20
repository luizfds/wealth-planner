import { state } from "../state.js";
import { canBuyAll } from "../calc/canbuy.js";
import { scenarioTotals } from "../calc/engine.js";
import { fmtCurrency0 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Plan → Scenarios → Can we buy? (v3.88.0) — calc/canbuy.js ----------------
export function renderCanBuy(){
  var el = typeof document !== "undefined" && document.getElementById("canBuyBody");
  if(!el) return;
  el.innerHTML = canBuyHtml(canBuyAll());
}
function money(n){ return fmtCurrency0.format(Math.round(n)); }
export function canBuyHtml(list){
  if(!list.length) return '<p class="ledger-note" style="margin:0">Turn on the purchase calculator in a scenario below and this shows whether the cash is there, where it would come from, and what taking it costs.</p>';
  var now = (state.scenarios || []).filter(function(s){ return !(state.purchase[s] && state.purchase[s].enabled); })[0];
  var nowNet = now ? scenarioTotals(now).regularNetMonthly : null;
  var head = nowNet != null ? '<p class="ledger-note cb-now">' + escapeAttr(now) + ' today leaves <b>' + money(nowNet) + '/mo</b> in a normal month.</p>' : '';
  return head + '<div class="cb-grid">' + list.map(function(c){
    var ok = c.short <= 0;
    var drawn = c.draws.filter(function(d){ return d.take > 0; }).map(function(d){
      return '<li><span>' + escapeAttr(d.name) + (d.kind === "borrowed" ? ' <em>borrowed money</em>' : '') + '</span><b>' + money(d.take) + '</b></li>';
    }).join("");
    var interest = c.extraInterestYearly > 0
      ? '<div class="cb-row"><span>Investment loan interest goes up</span><b>' + money(c.extraInterestYearly) + '/yr</b></div>' +
        (c.taxBackYearly > 0 ? '<div class="cb-row cb-sub"><span>less tax back on the deductible part</span><b>−' + money(c.taxBackYearly) + '/yr</b></div>' : '') +
        (c.nonDeductibleExtra > 0 ? '<p class="cb-warn">' + money(c.nonDeductibleExtra) + '/yr of that is on money borrowed against the investment. Spent on your own home, that loan\'s interest stops being deductible — what the money is used for decides, not the property behind it. Worth asking your accountant before settlement.</p>' : '') +
        '<p class="ledger-note cb-note">Repayments don\'t change — the same payment just pays more interest and less off the loan.</p>'
      : '';
    var delta = c.regularNetMonthly - (nowNet != null ? nowNet : c.regularNetMonthly);
    return '<div class="cb-card' + (ok ? '' : ' short') + '">' +
      '<div class="cb-title"><b>' + escapeAttr(c.scenario) + '</b><span>' + money(c.price) + (c.state ? ' · ' + escapeAttr(c.state) : '') + '</span></div>' +
      '<div class="cb-verdict ' + (ok ? 'ok' : 'no') + '">' + (ok ? 'The cash is there — ' + money(c.left) + ' left after settlement' + (c.bufferMonths >= 0.5 ? ' (about ' + Math.round(c.bufferMonths) + ' month' + (Math.round(c.bufferMonths) === 1 ? '' : 's') + ' of costs)' : '') : money(c.short) + ' short of the cash needed') + '</div>' +
      '<div class="cb-row"><span>Cash needed at settlement</span><b>' + money(c.upfront) + '</b></div>' +
      '<div class="cb-row cb-sub"><span>deposit ' + money(c.deposit) + ' · stamp duty ' + (c.stampDuty == null ? 'entered by hand' : money(c.stampDuty)) + (c.lmi > 0 ? ' · LMI ' + money(c.lmi) + (c.lmiCapitalized ? ' (added to the loan)' : '') : '') + '</span></div>' +
      (drawn ? '<div class="cb-from">Taken from<ul>' + drawn + '</ul></div>' : '') +
      interest +
      '<div class="cb-row"><span>New home loan</span><b>' + money(c.loan) + ' · ' + money(c.repaymentMonthly) + '/mo</b></div>' +
      '<div class="cb-row"><span>A normal month then leaves</span><b class="' + (c.regularNetMonthly < 0 ? 'neg' : '') + '">' + money(c.regularNetMonthly) + '/mo</b></div>' +
      (nowNet != null ? '<div class="cb-row cb-sub"><span>' + (delta < 0 ? money(-delta) + '/mo less than' : money(delta) + '/mo more than') + ' ' + escapeAttr(now) + '</span></div>' : '') +
      (c.fhbButOwns ? '<p class="cb-warn">First home buyer is ticked, but owning a property (even an investment) usually rules out first-home concessions — stamp duty is likely higher than shown.</p>' : '') +
    '</div>';
  }).join("") + '</div>' +
  '<p class="ledger-note" style="margin:8px 0 0">Cash comes from cash accounts first, then offsets with your own savings (cheapest loan first), and money borrowed against the investment last. Stamp duty and LMI are estimates — confirm with your lender and the state revenue office.</p>';
}
