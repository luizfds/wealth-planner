// ---------------- Every subscription in one list (v3.179.0, item 205) ----------------
//
// The Subscriptions card on Cash flow → Bills, from calc/subscriptions.js. The person's cancel-by
// dates and "not a subscription" marks live in state.subscriptionNotes (synced, in the backup).

import { state } from "../state.js";
import { subscriptionList, subscriptionsYearly, homeLineIds } from "../calc/subscriptions.js";
import { fmtCurrency0, fmtCurrency2, localDateStr, fmtDate } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

export var subsUi = { showHidden: false };

export function subscriptionsHtml(today, st){
  st = st || state;
  today = today || localDateStr();
  var list = subscriptionList(st.transactions, today, st.subscriptionNotes || {}, { homeLines: homeLineIds(st) });
  var shown = list.filter(function(s){ return subsUi.showHidden || !s.ignored; });
  var hidden = list.length - list.filter(function(s){ return !s.ignored; }).length;
  if(!list.length) return '<p class="ledger-note" style="margin:0">Nothing charges on a steady rhythm in the spending logged yet. Once a payee has charged about the same amount three times on a regular beat, it shows here.</p>';
  var row = function(s){
    var name = s.name || s.label;
    var when = s.stopped ? '<span class="sub-stopped">Stopped — last charged ' + escapeAttr(fmtDate(s.last)) + '</span>'
      : 'Next ' + escapeAttr(fmtDate(s.next));
    var rise = s.lastRise ? '<small class="sub-rise">Up from ' + fmtCurrency2.format(s.lastRise.from) + ' on ' + escapeAttr(fmtDate(s.lastRise.date)) + '</small>' : '';
    return '<li class="sub-row' + (s.stopped ? " is-stopped" : "") + (s.ignored ? " is-ignored" : "") + '">' +
      '<span class="sub-name"><b>' + escapeAttr(name) + '</b><small>' + escapeAttr(String(s.freq).toLowerCase()) + ' · ' + fmtCurrency2.format(s.amount) + (s.line ? ' · on a budget line' : ' · not in the budget') + '</small>' + rise + '</span>' +
      '<span class="sub-year"><b>' + fmtCurrency0.format(s.yearly) + '</b><small>a year</small></span>' +
      '<span class="sub-when">' + when + '</span>' +
      '<span class="sub-cancel">' + (s.stopped ? '' : '<label><small>Cancel by</small><input type="date" data-sub-cancel="' + escapeAttr(s.key) + '" value="' + escapeAttr(s.cancelBy) + '" aria-label="Cancel ' + escapeAttr(name) + ' by"></label>') +
        '<button type="button" class="link-btn" data-sub-ignore="' + escapeAttr(s.key) + '">' + (s.ignored ? "It is one" : "Not a subscription") + '</button></span></li>';
  };
  return '<p class="sub-total">About <b>' + fmtCurrency0.format(subscriptionsYearly(list)) + '</b> a year on ' + list.filter(function(s){ return !s.stopped && !s.ignored; }).length + ' repeating charges, at what each charged last.</p>' +
    '<ul class="sub-list">' + shown.map(row).join("") + '</ul>' +
    (hidden ? '<button type="button" class="link-btn" data-sub-hidden>' + (subsUi.showHidden ? "Hide" : "Show") + ' the ' + hidden + ' marked not a subscription</button>' : '') +
    '<p class="ledger-note" style="margin:8px 0 0">Set a cancel-by date (the end of a free trial, before a yearly renewal) and a reminder comes a week before. One that stops charging shows as stopped for a year, then leaves the list.</p>';
}
export function renderSubscriptions(){
  var el = typeof document !== "undefined" && document.getElementById("subscriptionsBody");
  if(el) el.innerHTML = subscriptionsHtml();
}
