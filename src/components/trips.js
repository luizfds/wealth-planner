import { furnishingHtml, projectBudgetBarHtml } from "./furnishing.js";
import { state } from "../state.js";
import { escapeAttr } from "../lib/html.js";
import { fmtCurrency0, fmtCurrency2, fmtDate, localDateStr } from "../lib/format.js";
import { fieldHtml } from "../lib/field.js";
import { emptyStateHtml } from "../lib/empty.js";
import { keepUi } from "../lib/keepui.js";
import { periodsOf, householdYearWindow } from "../calc/ledger.js";
import { tripRefilePlan, tripSpend, tripStatus, tripLeft, tripPending, tripLineSplit } from "../calc/trips.js";
import { budgetLineItems, budgetLineOptgroupsHtml } from "./expenses.js";

// ---------------- Money → Trips (November 2026; a fold under Transactions since v3.78.0) ----------------
//
// Each trip with its own budget, carved out of the line it's paid from; every purchase on its days asked about
// (calc/trips.js). The page: the line's year shared between its trips, the trips still to come (away first), past
// trips folded, and a form to plan one. A trip's purchases to confirm open in place under it.

// Lines a trip never takes over: housing (every scenario's home block) and a property's costs —
// paid wherever you are, and never what a trip cost.
export function tripProtectedLineIds(){
  var ids = {};
  Object.keys(state.home || {}).forEach(function(k){ (state.home[k] || []).forEach(function(r){ if(r.id) ids[r.id] = true; }); });
  (state.properties || []).forEach(function(p){ (p.expenses || []).forEach(function(e){ if(e.id) ids[e.id] = true; }); });
  return ids;
}
export function tripPlan(trip){ return tripRefilePlan(trip, state.transactions, budgetLineItems(), tripProtectedLineIds()); }
// The purchases on a trip's days still to answer.
export function tripToConfirm(trip){ return tripPending(trip, state.transactions, budgetLineItems(), tripProtectedLineIds()); }

// Session only: which trip is being edited ("new" for the plan form's own), and whose purchases are open to confirm.
export var tripsUi = { editing: "", confirming: "" };

var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function whenText(t, today){
  if(!t.from) return t.month ? MONTHS[Number(t.month.slice(5, 7)) - 1] + " " + t.month.slice(0, 4) + " · dates to set" : "Dates to set";
  var range = t.from === (t.to || t.from) ? fmtDate(t.from) : fmtDate(t.from) + " – " + fmtDate(t.to);
  var st = tripStatus(t, today);
  if(st === "coming"){
    var days = Math.round((Date.parse(t.from) - Date.parse(today)) / 86400000);
    return range + " · in " + days + " day" + (days === 1 ? "" : "s");
  }
  if(st === "away"){
    var day = Math.round((Date.parse(today) - Date.parse(t.from)) / 86400000) + 1, of = Math.round((Date.parse(t.to || t.from) - Date.parse(t.from)) / 86400000) + 1;
    return range + " · day " + day + " of " + of;
  }
  return range;
}
var STATUS = { planning: "Planning", coming: "Coming up", away: "Away now", past: "Done" };
export function defaultTripLine(){
  var l = budgetLineItems().find(function(x){ return /^trips?$|travel|holiday/i.test(x.what || ""); });
  return l ? l.id : "";
}


function confirmListHtml(t, pending, lineName){
  if(!pending.length) return '<p class="ledger-note">Every purchase on these days is answered.</p>';
  return '<div class="trip-confirm" data-trip-confirm-list="' + escapeAttr(t.id) + '">' +
    '<p class="ledger-note">Part of ' + escapeAttr(t.name) + '? "Yes" files it to ' + escapeAttr(lineName[t.lineId] || "the trip's line") + ' and counts it to the trip; "No" leaves it where it is. Bills, rent and property costs aren\'t asked about.</p>' +
    '<ul class="trip-confirm-list">' + pending.map(function(x){
      var label = x.what || lineName[x.linkedExpenseId] || x.category || "A purchase";
      return '<li class="trip-confirm-row"><span class="trip-confirm-what"><b>' + escapeAttr(label) + '</b><small>' + escapeAttr(fmtDate(x.date)) + ' · ' + escapeAttr(lineName[x.linkedExpenseId] || x.category || "no line") + '</small></span>' +
        '<b class="trip-confirm-amt">' + fmtCurrency2.format(Number(x.amount) || 0) + '</b>' +
        '<span class="trip-confirm-acts" role="group" aria-label="' + escapeAttr("Part of " + t.name + ": " + label) + '">' +
          '<button type="button" class="btn btn-sm" data-trip-yes="' + escapeAttr(t.id) + '" data-trip-tx="' + escapeAttr(x.id) + '">Yes, the trip</button>' +
          '<button type="button" class="btn btn-sm btn-ghost" data-trip-no="' + escapeAttr(t.id) + '" data-trip-tx="' + escapeAttr(x.id) + '">No</button>' +
        '</span></li>';
    }).join("") + '</ul>' +
    '<div class="trip-actions"><button type="button" class="btn btn-sm" data-trip-all="' + escapeAttr(t.id) + '">All ' + pending.length + ' are the trip</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-trip-confirm="' + escapeAttr(t.id) + '">Done</button></div>' +
  '</div>';
}

function tripCardHtml(t, today, lineName){
  var st = tripStatus(t, today);
  var spent = tripSpend(t, state.transactions);
  var left = tripLeft(t, spent, today);
  var pending = st === "planning" ? [] : tripToConfirm(t);
  var open = tripsUi.confirming === t.id;
  var figure = t.budget > 0
    ? '<div class="trip-figures"><b class="trip-spent">' + fmtCurrency0.format(spent) + '</b><span>of ' + fmtCurrency0.format(t.budget) + '</span></div>' + projectBudgetBarHtml(spent, t.budget) +
      '<p class="trip-left' + (left.over ? " is-over" : "") + '">' + (left.over ? fmtCurrency0.format(-left.left) + ' over' : fmtCurrency0.format(left.left) + ' left') +
        (left.perDay != null ? ' · ' + fmtCurrency0.format(left.perDay) + ' a day for ' + left.daysLeft + ' day' + (left.daysLeft === 1 ? '' : 's') : '') + '</p>'
    : '<div class="trip-figures"><b class="trip-spent">' + fmtCurrency0.format(spent) + '</b><span>spent · no budget set</span></div>';
  return '<li class="trip-row is-' + st + '" data-trip-id="' + escapeAttr(t.id) + '">' +
    '<div class="trip-head"><span class="trip-main"><b>' + escapeAttr(t.name) + '</b><span>' + escapeAttr(whenText(t, today)) + ' · ' + escapeAttr(lineName[t.lineId] || "no line") + '</span></span>' +
      '<span class="trip-status is-' + st + '">' + STATUS[st] + '</span></div>' +
    figure + (t.from ? '<p>Booked ahead · ' + fmtCurrency0.format(tripSpend(t, state.transactions.filter(function(tx){ return tx.date < t.from; }))) + ' · On the trip · ' + fmtCurrency0.format(tripSpend(t, state.transactions.filter(function(tx){ return tx.date >= t.from && tx.date <= (t.to || t.from); }))) + '</p>' : '') +
    (pending.length ? '<button type="button" class="btn btn-sm trip-confirm-btn" data-trip-confirm="' + escapeAttr(t.id) + '" aria-expanded="' + open + '">' + pending.length + ' purchase' + (pending.length === 1 ? '' : 's') + ' on these days to confirm</button>' : '') +
    (open ? confirmListHtml(t, pending, lineName) : '') +
    (tripsUi.editing === t.id ? formHtml(t) : '') +
    '<div class="trip-actions">' +
      '<button type="button" class="btn btn-sm" data-book-trip="' + escapeAttr(t.id) + '">Log a booking</button><button type="button" class="btn btn-sm btn-ghost" data-sv data-sv-trip="' + escapeAttr(t.id) + '">Its transactions</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-trip-edit="' + escapeAttr(t.id) + '">Edit<span class="visually-hidden"> ' + escapeAttr(t.name) + '</span></button>' +
      '<button type="button" class="btn btn-sm btn-danger" data-trip-del="' + escapeAttr(t.id) + '">Remove<span class="visually-hidden"> ' + escapeAttr(t.name) + '</span></button>' +
    '</div>' +
  '</li>';
}

// The plan form, for a new trip (t null) or one being edited.
function formHtml(t){
  var key = t ? t.id : "new", id = function(n){ return "trip-" + n + "-" + key; };
  var lineId = t ? t.lineId : defaultTripLine();
  return '<div class="trip-form" data-trip-form="' + escapeAttr(key) + '">' +
    (t ? '' : '<h2 class="trip-form-title" id="tripPlanTitle">Plan a trip</h2>') +
    '<div class="trip-form-grid">' +
      fieldHtml({ id: id("name"), label: "Name", value: t ? t.name : "", placeholder: "e.g. Beach week", box: true, wide: true, attrs: { "data-trip-name": "" } }) +
      fieldHtml({ id: id("from"), label: "From", type: "date", value: t ? t.from : "", box: true, attrs: { "data-trip-from": "" } }) +
      fieldHtml({ id: id("to"), label: "To", type: "date", value: t ? t.to : "", box: true, attrs: { "data-trip-to": "" } }) +
      fieldHtml({ id: id("month"), label: "Or a month, dates later", type: "month", value: t && !t.from ? t.month || "" : "", box: true, attrs: { "data-trip-month": "" } }) +
      fieldHtml({ id: id("budget"), label: "Budget", type: "money", value: t && t.budget ? t.budget : "", box: true, attrs: { "data-trip-budget": "" } }) +
      '<div class="field field-box span2"><div class="fbox"><label class="field-label fbox-label" for="' + escapeAttr(id("line")) + '">Paid from the line</label>' +
        '<select class="field-control fbox-control" id="' + escapeAttr(id("line")) + '" data-trip-line><option value="">Pick a line…</option>' + budgetLineOptgroupsHtml(lineId) + '</select></div></div>' +
    '</div>' +
    '<div class="trip-actions"><button type="button" class="btn btn-sm btn-primary" data-trip-save="' + escapeAttr(key) + '">' + (t ? 'Save' : '+ Plan this trip') + '</button>' +
      (t ? '<button type="button" class="btn btn-sm btn-ghost" data-trip-cancel>Cancel</button>' : '') + '</div>' +
  '</div>';
}

// The line's year shared between its trips: one bar, a segment a trip, and what no trip has yet.
function splitHtml(lineId, today, lineName){
  var line = budgetLineItems().find(function(l){ return l.id === lineId; });
  if(!line) return "";
  var yearly = periodsOf(Number(line.amount) || 0, line.freq).yearly;
  var win = householdYearWindow();
  var s = tripLineSplit(state.trips, lineId, yearly, win.start, win.end);
  if(!s.trips.length && !(yearly > 0)) return "";
  var segs = s.trips.filter(function(t){ return t.budget > 0; }).map(function(t, i){
    return '<span class="trip-split-seg tone-' + (i % 4) + '" style="flex:' + t.budget + '" title="' + escapeAttr(t.name + " · " + fmtCurrency0.format(t.budget)) + '"></span>';
  }).join("") + (s.unallocated > 0 ? '<span class="trip-split-seg is-free" style="flex:' + s.unallocated + '"></span>' : "");
  return '<div class="trip-split">' +
    '<div class="trip-split-head"><b>' + escapeAttr(lineName[lineId] || "Trips") + '</b><span>' + fmtCurrency0.format(s.yearly) + ' a year · ' + escapeAttr(win.label || "") + '</span></div>' +
    (segs ? '<div class="trip-split-bar" role="img" aria-label="' + escapeAttr(fmtCurrency0.format(s.given) + " given to " + s.trips.length + " trips of " + fmtCurrency0.format(s.yearly)) + '">' + segs + '</div>' : '') +
    '<p class="ledger-note">' + (s.trips.length ? 'Split across ' + s.trips.length + ' trip' + (s.trips.length === 1 ? '' : 's') + ': ' + fmtCurrency0.format(s.given) + ' · ' : '') +
      (s.unallocated >= 0 ? '<b>' + fmtCurrency0.format(s.unallocated) + ' not given to a trip yet</b>' : '<b class="is-over">' + fmtCurrency0.format(-s.unallocated) + ' more than the line has</b> — raise it on Budget, or trim a trip') + '</p>' +
  '</div>';
}

export function tripsCardHtml(today){
  today = today || localDateStr();
  var lineName = {};
  budgetLineItems().forEach(function(l){ lineName[l.id] = l.what; });
  var trips = (state.trips || []).slice();
  var order = { away: 0, coming: 1, planning: 2, past: 3 };
  trips.sort(function(a, b){
    var sa = tripStatus(a, today), sb = tripStatus(b, today);
    if(sa !== sb) return order[sa] - order[sb];
    var da = a.from || (a.month ? a.month + "-01" : "9999"), db = b.from || (b.month ? b.month + "-01" : "9999");
    return sa === "past" ? (da < db ? 1 : -1) : (da < db ? -1 : da > db ? 1 : 0);
  });
  var now = trips.filter(function(t){ return tripStatus(t, today) !== "past"; });
  var past = trips.filter(function(t){ return tripStatus(t, today) === "past"; });
  var lines = [];
  trips.forEach(function(t){ if(t.lineId && lines.indexOf(t.lineId) === -1) lines.push(t.lineId); });
  if(!lines.length && defaultTripLine()) lines.push(defaultTripLine());
  var pastSpent = past.reduce(function(s, t){ return s + tripSpend(t, state.transactions); }, 0);
  var pastBudget = past.reduce(function(s, t){ return s + (Number(t.budget) || 0); }, 0);
  return lines.map(function(l){ return splitHtml(l, today, lineName); }).join("") +
    (now.length ? '<ul class="trip-list">' + now.map(function(t){ return tripCardHtml(t, today, lineName); }).join("") + '</ul>'
      : emptyStateHtml(past.length ? "No trips coming up — plan the next one below, with its own budget." : "No trips yet — plan one below: a name, its dates (or just a month), a budget and the line it comes out of.", { scroll: "#tripNewSummary", label: "Plan a trip ↓" })) +
    (past.length ? '<details class="trip-past"><summary><b>Past trips</b><span>' + past.length + ' · ' + fmtCurrency0.format(pastSpent) + ' spent' + (pastBudget ? ' of ' + fmtCurrency0.format(pastBudget) : '') + '</span></summary>' +
      '<ul class="trip-list">' + past.map(function(t){ return tripCardHtml(t, today, lineName); }).join("") + '</ul></details>' : '') +
    '<details class="trip-new"><summary id="tripNewSummary">+ Add trip</summary>' + formHtml(null) + "</details>";
}

export function renderTrips(){ return keepUi(drawTrips); }
function drawTrips(){
  var el = typeof document !== "undefined" && document.getElementById("tripsBody");
  if(!el) return;
  el.innerHTML = furnishingHtml() + tripsCardHtml();

}
