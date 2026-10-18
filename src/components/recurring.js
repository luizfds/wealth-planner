import { fmtCurrency0, fmtCurrency2 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Cash flow → Budget → Recurring payments (v3.66.0) ----------------
export var recurringDismissed = { keys: {} };
export function recurringHtml(unbudgeted, rising){
  var u = unbudgeted.filter(function(x){ return !recurringDismissed.keys["u:" + x.key]; });
  var r = rising.filter(function(x){ return !recurringDismissed.keys["r:" + x.id + ":" + x.recent]; });
  if(!u.length && !r.length) return '<p class="ledger-note" style="margin:0">Nothing to flag. Repeating charges with no budget line, and lines charging more than they\'re budgeted at, show up here as transactions are logged or imported.</p>';
  var html = "";
  if(u.length){
    html += '<div class="rc-sec">Repeating, with no budget line (' + u.length + ')</div>' + u.map(function(x){
      return '<div class="rc-row"><div class="rc-main"><b>' + escapeAttr(x.name) + '</b><small>' + x.count + ' charges, ' + escapeAttr(x.freq.toLowerCase()) + ' · last ' + escapeAttr(x.last) + '</small></div>' +
        '<span class="rc-amt">' + fmtCurrency2.format(x.amount) + '<small>' + fmtCurrency0.format(x.monthly) + '/mo</small></span>' +
        '<div class="rc-actions"><button type="button" class="btn btn-sm" data-rc-add="' + escapeAttr(x.key) + '">Add to budget</button><button type="button" class="btn btn-sm btn-ghost" data-rc-dismiss="u:' + escapeAttr(x.key) + '">Not now</button></div></div>';
    }).join("");
  }
  if(r.length){
    html += '<div class="rc-sec">Charging more than budgeted (' + r.length + ')</div>' + r.map(function(x){
      return '<div class="rc-row"><div class="rc-main"><b>' + escapeAttr(x.what) + '</b><small>budgeted ' + fmtCurrency2.format(x.planned) + ' ' + escapeAttr((x.freq || "").toLowerCase()) + ', lately ' + fmtCurrency2.format(x.recent) + (x.earlier != null ? ' (was ' + fmtCurrency2.format(x.earlier) + ')' : '') + '</small></div>' +
        '<span class="rc-amt up">+' + fmtCurrency0.format(x.extraMonthly) + '<small>/mo</small></span>' +
        '<div class="rc-actions"><button type="button" class="btn btn-sm" data-rc-update="' + escapeAttr(x.id) + '" data-rc-to="' + x.recent + '">Update to ' + fmtCurrency2.format(x.recent) + '</button><button type="button" class="btn btn-sm btn-ghost" data-rc-dismiss="r:' + escapeAttr(x.id) + ':' + x.recent + '">Not now</button></div></div>';
    }).join("");
  }
  return html;
}
