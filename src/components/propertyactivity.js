// ---------------- A property's Activity (item 244) ----------------
//
// Everything logged about an investment property this financial year, by date, from the one property ledger
// (calc/propertyactuals.js propertyLedger): statements, rent received, bills against its lines, household lines claimed
// against it, its loans' interest and fees. Each record says the return line its money goes on; a payment can be moved
// to another of the property's cost lines, any record removed, and a loan interest charge typed in for a bank with no
// statement to import. The wiring is in propertieswiring.js.
import { state } from "../state.js";
import { propertyLedger, actualFyFor } from "../calc/propertyactuals.js";
import { fyWindow, fyLabel } from "../calc/property.js";
import { RENT_LINES } from "../calc/taxyear.js";
import { claimItems } from "../calc/claims.js";
import { householdYearWindow } from "../calc/ledger.js";
import { fmtCurrency0, fmtCurrency2, localDateStr, fmtDate } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

var LINE_LABEL = {};
RENT_LINES.forEach(function(l){ LINE_LABEL[l.key] = l.label; });
export function rentLineLabel(key){ return LINE_LABEL[key] || "Other expenses"; }

var SOURCE_LABEL = {
  statement: "Property manager statement", received: "Rent received", payment: "Paid", claimed: "Household line claimed",
  statementBill: "Paid from the rent", interest: "Interest charged", loanFee: "Loan fee"
};

// The records behind the ledger, in date order, newest first: { ref, date, what, source, entries, net }.
export function activityRecords(entries){
  var byRef = {}, order = [];
  entries.forEach(function(e){
    var k = e.ref.kind + ":" + e.ref.id;
    if(!byRef[k]){ byRef[k] = { key: k, ref: e.ref, date: e.date, what: e.what, source: e.source, entries: [], net: 0, lineId: e.lineId || null }; order.push(byRef[k]); }
    byRef[k].entries.push(e);
    byRef[k].net += e.side === "income" ? e.amount : -e.amount;
  });
  order.forEach(function(r){ r.net = Math.round(r.net * 100) / 100; if(r.ref.kind === "statement") r.what = "Property manager statement"; });
  return order.sort(function(a, b){ return a.date > b.date ? -1 : a.date < b.date ? 1 : 0; });
}

function recordHtml(p, r){
  var lines = r.entries.map(function(e){
    return escapeAttr(rentLineLabel(e.line)) + ' ' + fmtCurrency2.format(e.amount) + (e.share < 1 ? ' <small>(' + Math.round(e.share * 100) + '% of ' + fmtCurrency2.format(e.gross) + ')</small>' : '');
  }).join(' · ');
  var src = SOURCE_LABEL[r.source] || "";
  if(r.ref.kind === "charge") src += " · " + escapeAttr(r.ref.loan);
  // A payment can go on another of the property's own cost lines (its return line follows).
  var move = "";
  if(r.ref.kind === "tx" && r.source !== "claimed" && (p.expenses || []).length){
    move = '<select class="pa-line" data-pa-line="' + escapeAttr(r.ref.id) + '" aria-label="Which of the property\'s cost lines this payment is for">' +
      (r.lineId ? '' : '<option value="">— no line —</option>') +
      (p.expenses || []).filter(function(x){ return x && x.id; }).map(function(x){
        return '<option value="' + escapeAttr(x.id) + '"' + (x.id === r.lineId ? ' selected' : '') + '>' + escapeAttr(x.what || "Cost") + '</option>';
      }).join("") + '</select>';
  }
  var del = '<button type="button" class="btn btn-danger btn-sm" data-pa-del="' + escapeAttr(r.ref.kind + ":" + r.ref.id + (r.ref.loanId ? ":" + r.ref.loanId : "")) + '" aria-label="Remove ' + escapeAttr(r.what) + ' of ' + escapeAttr(r.date) + '">Remove</button>';
  return '<div class="pa-row" data-pa-record="' + escapeAttr(r.key) + '">' +
    '<span class="pa-date">' + escapeAttr(fmtDate(r.date)) + '</span>' +
    '<div class="pa-main"><div class="pa-what">' + escapeAttr(r.what) + '</div><div class="pa-sub">' + src + ' — ' + lines + '</div>' +
      (move || r.ref.statementId ? '<div class="pa-tools">' + move + (r.ref.statementId ? '<small>from a statement</small>' : '') + '</div>' : '') + '</div>' +
    '<div class="pa-end"><b class="pa-amt' + (r.net < 0 ? ' is-out' : ' is-in') + '">' + (r.net < 0 ? '−' : '+') + fmtCurrency2.format(Math.abs(r.net)) + '</b>' + del + '</div>' +
  '</div>';
}

export function propertyActivityHtml(p, today){
  today = today || localDateStr();
  var fy = actualFyFor(householdYearWindow().end, today), win = fyWindow(fy), end = today < win.end ? today : win.end;
  var entries = today < win.start ? [] : propertyLedger(p, win.start, end, state, claimItems());
  var recs = activityRecords(entries);
  var inc = 0, out = 0;
  entries.forEach(function(e){ if(e.side === "income") inc += e.amount; else out += e.amount; });
  var loans = (p.loans || []).filter(function(l){ return l && l.id; });
  var addCharge = loans.length ? '<details class="pa-add"><summary>+ Type a loan interest charge</summary>' +
    '<p class="ledger-note">For a bank whose statement you can\'t import: the interest it charged, as the statement shows it.</p>' +
    '<div class="pa-add-row">' +
      (loans.length > 1 ? '<select data-pa-charge-loan aria-label="Which loan">' + loans.map(function(l){ return '<option value="' + escapeAttr(l.id) + '">' + escapeAttr(l.what || "Loan") + '</option>'; }).join("") + '</select>'
        : '<input type="hidden" data-pa-charge-loan value="' + escapeAttr(loans[0].id) + '">') +
      '<input type="date" data-pa-charge-date value="' + escapeAttr(end) + '" aria-label="Date charged">' +
      '<input type="number" step="0.01" min="0" data-pa-charge-amount placeholder="Interest $" aria-label="Interest charged">' +
      '<button type="button" class="btn btn-sm" data-pa-charge-add="' + escapeAttr(p.id) + '">Add</button>' +
    '</div></details>' : '';
  return '<div class="pa" data-pa="' + escapeAttr(p.id) + '">' +
    '<div class="property-section-title">' + escapeAttr(fyLabel(fy)) + (end === win.end ? '' : ' so far') + ' — what\'s logged</div>' +
    (recs.length
      ? '<p class="ledger-note pa-sum">' + recs.length + ' record' + (recs.length === 1 ? '' : 's') + ' · in ' + fmtCurrency0.format(inc) + ' · out ' + fmtCurrency0.format(out) +
        '. These are what the Tax tab\'s year so far and Tax → Returns\' logged figures add up.</p><div class="pa-list">' + recs.map(function(r){ return recordHtml(p, r); }).join("") + '</div>'
      : '<p class="ledger-note">Nothing logged for this property yet this year. Log its property manager statements (Overview → Log a statement), rent as it arrives, payments against its cost lines, and import its loans\' statements, and each one shows here.</p>') +
    addCharge +
  '</div>';
}
