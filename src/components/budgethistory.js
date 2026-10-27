import { escapeAttr } from "../lib/html.js";
import { fmtCurrency0, fmtCurrency2 } from "../lib/format.js";

// ---------------- Budget → Build from what you've spent (v3.115.0) ----------------
// calc/budgetfromhistory.js proposes the lines; this lists them, ticked, to add in one go.
// Session-only: which proposals have been unticked.
export var historyBudgetUi = { off: {} };

var KIND = { steady: "repeats", category: "everyday spending", merchant: "adds up" };
export function budgetFromHistoryHtml(r){
  if(!r || !r.ready || !r.proposals.length) return '<p class="ledger-note section-empty" style="margin:0">Nothing to propose yet.</p>';
  var on = r.proposals.filter(function(p){ return !historyBudgetUi.off[p.key]; });
  var yearly = on.reduce(function(s, p){ return s + p.yearly; }, 0);
  return '<p class="ledger-note" style="margin:0 0 10px">' + r.proposals.length + ' line' + (r.proposals.length === 1 ? '' : 's') + ' would cover the spending of the last ' + r.months +
    ' months that isn\'t on any budget line. Each is linked to the transactions it came from, so Actual vs. planned works straight away.</p>' +
    '<div class="bh-list">' + r.proposals.map(function(p){
      return '<label class="bh-row"><input type="checkbox" data-bh-key="' + escapeAttr(p.key) + '"' + (historyBudgetUi.off[p.key] ? '' : ' checked') + '>' +
        '<span class="bh-name">' + escapeAttr(p.what) + '<small>' + KIND[p.kind] + ' · ' + p.count + ' transaction' + (p.count === 1 ? '' : 's') + (p.category && p.kind !== "category" ? ' · ' + escapeAttr(p.category) : '') + ' · ' + p.classification + '</small></span>' +
        '<span class="bh-amt">' + fmtCurrency2.format(p.amount) + '<small>' + escapeAttr(p.freq.toLowerCase()) + '</small></span></label>';
    }).join('') + '</div>' +
    (r.leftover.count ? '<p class="ledger-note" style="margin:8px 0 0">Left out: ' + r.leftover.count + ' smaller one-off' + (r.leftover.count === 1 ? '' : 's') + ' (about ' + fmtCurrency0.format(r.leftover.yearly) + ' a year).</p>' : '') +
    '<div class="bh-actions"><button type="button" class="btn btn-primary btn-sm" data-bh-apply' + (on.length ? '' : ' disabled') + '>Add ' + on.length + ' line' + (on.length === 1 ? '' : 's') + '</button>' +
    '<span class="ledger-note">' + fmtCurrency0.format(yearly) + ' a year</span></div>';
}
