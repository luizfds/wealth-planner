// ---------------- Every subscription in one list (v3.179.0, item 205) ----------------
//
// The Subscriptions card on Cash flow → Bills, from calc/subscriptions.js. The person's cancel-by
// dates and "not a subscription" marks live in state.subscriptionNotes (synced, in the backup).

import { state } from "../state.js";
import { householdSubscriptions, subscriptionsYearly } from "../calc/subscriptions.js";
import { fmtCurrency0, fmtCurrency2, localDateStr, fmtDate } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { emptyStateHtml } from "../lib/empty.js";

export var subsUi = { showHidden: false };

export function subscriptionsHtml(today, st){
  st = st || state;
  today = today || localDateStr();
  var list = householdSubscriptions(st, today);
  var shown = list.filter(function(s){ return subsUi.showHidden || !s.ignored; });
  var hidden = list.length - list.filter(function(s){ return !s.ignored; }).length;
  if(!list.length) return emptyStateHtml("Nothing charges on a steady rhythm in the spending logged yet. Once a payee has charged about the same amount three times on a regular beat — or a budget line is in a Subscriptions category — it shows here.", { go: "expenses/spending", label: "Go to Transactions →" });
  // November 2026: one row each — name, when it next charges, what it costs a year. Its actions are behind a tap, not a
  // date picker open on every row.
  var row = function(s){
    var name = s.name || s.label;
    var when = s.stopped ? '<span class="sub-stopped">Stopped — last charged ' + escapeAttr(fmtDate(s.last)) + '</span>'
      : s.next ? 'Next ' + escapeAttr(fmtDate(s.next)) : 'Not charged yet';
    var sub = escapeAttr(String(s.freq).toLowerCase()) + ' · ' + fmtCurrency2.format(s.amount) + ' · ' + when + (s.cancelBy && !s.stopped ? ' · <span class="sub-remind">cancel by ' + escapeAttr(fmtDate(s.cancelBy)) + '</span>' : '');
    var rise = s.lastRise ? '<small class="sub-rise">Up from ' + fmtCurrency2.format(s.lastRise.from) + ' on ' + escapeAttr(fmtDate(s.lastRise.date)) + '</small>' : '';
    return '<li class="sub-row' + (s.stopped ? " is-stopped" : "") + (s.ignored ? " is-ignored" : "") + '"><details class="sub-fold"><summary>' +
      '<span class="sub-name"><b>' + escapeAttr(name) + '</b><small>' + sub + '</small>' + rise + '</span>' +
      '<span class="sub-year"><b>' + fmtCurrency0.format(s.yearly) + '</b><small>a year</small></span></summary>' +
      '<div class="sub-actions">' +
        (s.stopped ? '' : '<label class="sub-cancel"><span>Remind me to cancel by</span><input class="field-control" type="date" data-sub-cancel="' + escapeAttr(s.key) + '" value="' + escapeAttr(s.cancelBy) + '" aria-label="Cancel ' + escapeAttr(name) + ' by"></label>') +
        '<p class="ledger-note" style="margin:0">' + (s.line ? 'On a budget line.' : 'Not in the budget yet.') + (s.count ? ' Charged ' + s.count + ' time' + (s.count === 1 ? '' : 's') + (s.last ? ', last ' + escapeAttr(fmtDate(s.last)) : '') + '.' : '') + '</p>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-sub-ignore="' + escapeAttr(s.key) + '">' + (s.ignored ? "It is a subscription" : "Not a subscription") + '</button>' +
      '</div></details></li>';
  };
  var running = list.filter(function(s){ return !s.stopped && !s.ignored; });
  return '<p class="sub-total">About <b>' + fmtCurrency0.format(subscriptionsYearly(list)) + '</b> a year on ' + running.length + ' subscription' + (running.length === 1 ? '' : 's') + ', at what each charged last.</p>' +
    '<ul class="sub-list">' + shown.map(row).join("") + '</ul>' +
    (hidden ? '<button type="button" class="link-btn" data-sub-hidden>' + (subsUi.showHidden ? "Hide" : "Show") + ' the ' + hidden + ' marked not a subscription</button>' : '') +
    '<p class="ledger-note help" style="margin:8px 0 0">Things you sign up to and can cancel — a line in a Subscriptions category, or a charge that repeats at the same amount and isn\'t a bill. Rates, insurance, internet and phone are bills, on the list above. Tap one to set a cancel-by date (the end of a free trial, before a yearly renewal): a reminder comes a week before. One that stops charging shows as stopped for a year, then leaves.</p>';
}
// The card's own line when folded: how many, and what they cost a year.
export function subscriptionsLabel(st, today){
  var list = householdSubscriptions(st || state, today || localDateStr());
  var running = list.filter(function(s){ return !s.stopped && !s.ignored; });
  return running.length ? running.length + ' · ' + fmtCurrency0.format(subscriptionsYearly(list)) + ' a year' : '';
}
export function renderSubscriptions(){
  var el = typeof document !== "undefined" && document.getElementById("subscriptionsBody");
  if(el) el.innerHTML = subscriptionsHtml();
  var label = typeof document !== "undefined" && document.getElementById("subscriptionsLabel");
  if(label) label.textContent = subscriptionsLabel();
}
