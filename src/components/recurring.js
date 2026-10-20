import { fmtCurrency0, fmtCurrency2 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Cash flow → Budget → Recurring payments (v3.66.0) ----------------
export var recurringDismissed = { keys: {} };
// v3.95.0: which rows have their transactions showing (session-only; closed by default).
export var recurringOpen = { keys: {} };
var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// The transactions behind a row, newest first, in a collapsed list.
export function recurringTxHtml(key, indices, transactions){
  var rows = (indices || []).map(function(i){ return transactions && transactions[i]; }).filter(Boolean)
    .sort(function(a, b){ return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  if(!rows.length) return "";
  var LIMIT = 24;
  var open = !!recurringOpen.keys[key];
  var total = rows.reduce(function(s, t){ return s + (Number(t.amount) || 0); }, 0);
  return '<details class="rc-tx" data-rc-tx="' + escapeAttr(key) + '"' + (open ? ' open' : '') + '><summary>' + (open ? 'Hide' : 'Show') + ' ' + rows.length + ' transaction' + (rows.length === 1 ? '' : 's') + '</summary>' +
    (open ? '<ul>' + rows.slice(0, LIMIT).map(function(t){
      var d = String(t.date || "");
      return '<li><span class="rc-tx-date">' + Number(d.slice(8, 10)) + ' ' + MON[Number(d.slice(5, 7)) - 1] + ' ' + d.slice(2, 4) + '</span>' +
        '<span class="rc-tx-what">' + escapeAttr(t.what || "—") + (t.account ? '<small>' + escapeAttr(t.account) + '</small>' : '') + '</span>' +
        '<b>' + fmtCurrency2.format(Number(t.amount) || 0) + '</b></li>';
    }).join("") + '</ul>' + (rows.length > LIMIT ? '<p class="rc-tx-more">and ' + (rows.length - LIMIT) + ' earlier · ' + fmtCurrency0.format(total) + ' in all</p>' : '<p class="rc-tx-more">' + fmtCurrency0.format(total) + ' in all</p>') : '') +
  '</details>';
}
export function recurringHtml(unbudgeted, rising, catchAll, transactions){
  var u = unbudgeted.filter(function(x){ return !recurringDismissed.keys["u:" + x.key]; });
  var r = rising.filter(function(x){ return !recurringDismissed.keys["r:" + x.id + ":" + x.recent]; });
  var c = (catchAll || []).filter(function(x){ return !recurringDismissed.keys["c:" + x.id]; });
  if(!u.length && !r.length && !c.length) return '<p class="ledger-note" style="margin:0">Nothing to flag. Repeating charges with no budget line, and lines charging more than they\'re budgeted at, show up here as transactions are logged or imported.</p>';
  var html = "";
  if(u.length){
    html += '<div class="rc-sec">Repeating, with no budget line (' + u.length + ')</div>' + u.map(function(x){
      return '<div class="rc-row"><div class="rc-main"><b>' + escapeAttr(x.name) + '</b><small>' + x.count + ' charges, ' + escapeAttr(x.freq.toLowerCase()) + ' · last ' + escapeAttr(x.last) + '</small></div>' +
        '<span class="rc-amt">' + fmtCurrency2.format(x.amount) + '<small>' + fmtCurrency0.format(x.monthly) + '/mo</small></span>' +
        '<div class="rc-actions"><button type="button" class="btn btn-sm" data-rc-add="' + escapeAttr(x.key) + '">Add to budget</button><button type="button" class="btn btn-sm btn-ghost" data-rc-dismiss="u:' + escapeAttr(x.key) + '">Not now</button></div>' + recurringTxHtml("u:" + x.key, x.indices, transactions) + '</div>';
    }).join("");
  }
  if(r.length){
    html += '<div class="rc-sec">Charging more than budgeted (' + r.length + ')</div>' + r.map(function(x){
      return '<div class="rc-row"><div class="rc-main"><b>' + escapeAttr(x.what) + '</b><small>budgeted ' + fmtCurrency2.format(x.planned) + ' ' + escapeAttr((x.freq || "").toLowerCase()) + ', lately ' + fmtCurrency2.format(x.recent) + (x.earlier != null ? ' (was ' + fmtCurrency2.format(x.earlier) + ')' : '') + '</small></div>' +
        '<span class="rc-amt up">+' + fmtCurrency0.format(x.extraMonthly) + '<small>/mo</small></span>' +
        '<div class="rc-actions"><button type="button" class="btn btn-sm" data-rc-update="' + escapeAttr(x.id) + '" data-rc-to="' + x.recent + '">Update to ' + fmtCurrency2.format(x.recent) + '</button><button type="button" class="btn btn-sm btn-ghost" data-rc-dismiss="r:' + escapeAttr(x.id) + ':' + x.recent + '">Not now</button></div>' + recurringTxHtml("r:" + x.id, x.indices, transactions) + '</div>';
    }).join("");
  }
  if(c.length){
    // v3.90.0: payees that keep turning up inside a catch-all line.
    html += '<div class="rc-sec">Hiding in a catch-all line (' + c.length + ')</div>' + c.map(function(x){
      var who = x.keys.length > 1 ? x.keys.length + ' shops' : '';
      return '<div class="rc-row"><div class="rc-main"><b>' + escapeAttr(x.name) + '</b><small>' + x.count + ' purchases in ' + escapeAttr(x.lineWhat) + (who ? ' from ' + who : '') + ' over the last year</small></div>' +
        '<span class="rc-amt">' + fmtCurrency0.format(x.total) + '<small>' + fmtCurrency0.format(x.monthly) + '/mo</small></span>' +
        '<div class="rc-actions"><button type="button" class="btn btn-sm" data-rc-split="' + escapeAttr(x.id) + '">' + (x.existingLineId ? 'Move to ' + escapeAttr(x.existingWhat) : 'Make it a line') + '</button><button type="button" class="btn btn-sm btn-ghost" data-rc-dismiss="c:' + escapeAttr(x.id) + '">Not now</button></div>' + recurringTxHtml("c:" + x.id, x.indices, transactions) + '</div>';
    }).join("");
  }
  return html;
}
// The c-section's count, for the header — same filter as above.
export function catchAllShown(catchAll){ return (catchAll || []).filter(function(x){ return !recurringDismissed.keys["c:" + x.id]; }).length; }
