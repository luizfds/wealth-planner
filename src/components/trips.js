import { eventItemsHtml } from "./eventitems.js";
import { eventBudgetsHeadingHtml, eventEditorHtml, paymentEstimateHtml } from "./furnishing.js";
import { projectSpent } from "../calc/projects.js";
import { state } from "../state.js";
import { escapeAttr } from "../lib/html.js";
import { fmtCurrency0, fmtCurrency2, fmtDate, localDateStr } from "../lib/format.js";
import { keepUi } from "../lib/keepui.js";
import { periodsOf, householdYearWindow } from "../calc/ledger.js";
import { tripRefilePlan, tripSpend, tripStatus, tripLeft, tripPending, tripLineSplit } from "../calc/trips.js";
import { budgetLineItems } from "./expenses.js";

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
var STATUS = { planning: "Planning", coming: "Coming up", away: "In progress", past: "Done" };
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
          '<button type="button" class="btn btn-sm" data-trip-yes="' + escapeAttr(t.id) + '" data-trip-tx="' + escapeAttr(x.id) + '">Yes, this event</button>' +
          '<button type="button" class="btn btn-sm btn-ghost" data-trip-no="' + escapeAttr(t.id) + '" data-trip-tx="' + escapeAttr(x.id) + '">No</button>' +
        '</span></li>';
    }).join("") + '</ul>' +
    '<div class="trip-actions"><button type="button" class="btn btn-sm" data-trip-all="' + escapeAttr(t.id) + '">All ' + pending.length + ' belong here</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-trip-confirm="' + escapeAttr(t.id) + '">Done</button></div>' +
  '</div>';
}

function eventMoney(amount){
  return (Number.isInteger(amount) ? fmtCurrency0 : fmtCurrency2).format(amount);
}

function eventFiguresHtml(spent, left){
  var figure = '<div class="trip-figures"><b class="trip-spent">' + eventMoney(spent) + '</b>';
  if(!left.budget) return figure + '<span>spent · no budget set</span></div>';
  var pct = Math.max(0, Math.min(100, Math.round(spent / left.budget * 100)));
  return figure + '<span>of ' + eventMoney(left.budget) + '</span></div>' +
    '<div class="trip-bar' + (left.over ? ' is-over' : '') + '" role="img" aria-label="' + escapeAttr(eventMoney(spent) + ' of ' + eventMoney(left.budget)) + '"><span style="width:' + pct + '%"></span></div>' +
    '<p class="trip-left' + (left.over ? " is-over" : "") + '">' + eventMoney(Math.abs(left.left)) + (left.over ? ' over' : ' left') +
    (left.perDay != null ? ' · ' + eventMoney(left.perDay) + ' a day for ' + left.daysLeft + ' day' + (left.daysLeft === 1 ? '' : 's') : '') + '</p>';
}

function eventCardHtml(event, today, lineName, fromSavings){
  var status = tripStatus(event, today);
  var spent = fromSavings ? Math.round(projectSpent(event, state.transactions) * 100) / 100 : tripSpend(event, state.transactions);
  var left = tripLeft(event, spent, today);
  if(fromSavings) left.perDay = null;
  var funding = fromSavings ? "savings" : lineName[event.lineId] || "a missing budget line";
  var timing = event.from || !fromSavings ? whenText(event, today) : "";
  var metadata = ['Paid from ' + funding, timing, event.propertyName].filter(Boolean).join(' · ');
  var pending = !fromSavings && status !== "planning" ? tripToConfirm(event) : [];
  var open = !fromSavings && tripsUi.confirming === event.id;
  var id = escapeAttr(event.id), name = escapeAttr(event.name);
  var timingSpend = !fromSavings && event.from
    ? '<p class="trip-note">Before event · ' + fmtCurrency0.format(tripSpend(event, state.transactions.filter(function(tx){ return tx.date < event.from; }))) +
      ' · During event · ' + fmtCurrency0.format(tripSpend(event, state.transactions.filter(function(tx){ return tx.date >= event.from && tx.date <= (event.to || event.from); }))) + '</p>'
    : '';
  return '<li class="trip-row is-' + status + '" data-event-id="' + id + '"' + (fromSavings ? '' : ' data-trip-id="' + id + '"') + '>' +
    '<div class="trip-head"><div class="trip-main"><h3 class="section-title">' + name + '</h3><span>' + escapeAttr(metadata) + '</span></div>' +
    '<span class="trip-status is-' + status + '">' + STATUS[status] + '</span></div>' +
    eventFiguresHtml(spent, left) + timingSpend +
    (pending.length ? '<button type="button" class="btn btn-sm trip-confirm-btn" data-trip-confirm="' + id + '" aria-expanded="' + open + '">' + pending.length + ' purchase' + (pending.length === 1 ? '' : 's') + ' on these days to confirm</button>' : '') +
    (open ? confirmListHtml(event, pending, lineName) : '') +
    (fromSavings ? paymentEstimateHtml(event) : '') +
    eventItemsHtml(event) + eventEditorHtml(event) +
    '<div class="trip-actions">' +
      '<button type="button" class="btn btn-sm" data-book-trip="' + id + '">Log purchase</button><button type="button" class="btn btn-sm btn-ghost" data-sv data-sv-trip="' + id + '">Its transactions</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-project-edit="' + id + '">Edit budget<span class="visually-hidden"> for ' + name + '</span></button>' +
      (fromSavings ? '' : '<button type="button" class="btn btn-sm btn-danger" data-trip-del="' + id + '">Remove<span class="visually-hidden"> ' + name + '</span></button>') +
    '</div></li>';
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
    '<p class="ledger-note">' + (s.trips.length ? 'Split across ' + s.trips.length + ' event' + (s.trips.length === 1 ? '' : 's') + ': ' + fmtCurrency0.format(s.given) + ' · ' : '') +
      (s.unallocated >= 0 ? '<b>' + fmtCurrency0.format(s.unallocated) + ' available for other events</b>' : '<b class="is-over">' + fmtCurrency0.format(-s.unallocated) + ' more than the line has</b> — raise it on Budget, or trim a trip') + '</p>' +
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
  var projects = state.projects || [];
  return eventBudgetsHeadingHtml() + (!now.length && !past.length && !projects.length ? '<p class="ledger-note">Add a budget for an event you’re saving or spending for.</p>' : '') +
    '<ul class="trip-list">' + projects.map(function(event){ return eventCardHtml(event, today, lineName, true); }).join("") +
    now.map(function(event){ return eventCardHtml(event, today, lineName, false); }).join("") + '</ul>' +
    (past.length ? '<details class="trip-past"><summary><b>Past events</b><span>' + past.length + ' · ' + fmtCurrency0.format(pastSpent) + ' spent' + (pastBudget ? ' of ' + fmtCurrency0.format(pastBudget) : '') + '</span></summary><ul class="trip-list">' + past.map(function(t){ return eventCardHtml(t,today,lineName,false); }).join("") + '</ul></details>' : '') +
    (trips.length ? lines.map(function(l){ return splitHtml(l,today,lineName); }).join("") : "");

}

export function renderTrips(){ return keepUi(drawTrips); }
function drawTrips(){
  var el = typeof document !== "undefined" && document.getElementById("tripsBody");
  if(!el) return;
  el.innerHTML = tripsCardHtml();

}
