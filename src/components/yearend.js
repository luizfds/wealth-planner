import { state } from "../state.js";
import { currentTaxFy, todayTaxFy, getTaxPeople } from "../calc/tax.js";
import { taxYearRecord } from "../calc/taxyear.js";
import { fyLabel } from "../calc/property.js";
import { buildReport } from "../calc/reports.js";
import { evidenceItems } from "./taxyear.js";
import { reportTableHtml } from "./reports.js";
import { transactionCategory } from "./expenses.js";
import { localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Reports → Year-end pack (v3.68.0) ----------------
// Everything 30 June asks for, in one place, for the financial year the period is in: what's done
// and what isn't (closed, lodged, documents kept, months reviewed), and the three things to hand an
// accountant — the statements printed together, the year's transactions, and the documents list.
function fyMonths(fy){ var out = []; for(var i = 0; i < 12; i++){ var m = (6 + i) % 12, y = fy + (6 + i >= 12 ? 1 : 0); out.push(y + "-" + String(m + 1).padStart(2, "0")); } return out; }

export function yearEndStatus(fy, today){
  today = today || localDateStr();
  var rec = taxYearRecord(fy, false) || {};
  var people = getTaxPeople();
  var lodged = people.filter(function(p){ return rec.lodged && rec.lodged[p]; });
  var ev = evidenceItems(fy);
  var kept = ev.filter(function(i){ return rec.evidence && rec.evidence[i.key]; }).length;
  var start = fy + "-07-01", end = (fy + 1) + "-06-30";
  var months = fyMonths(fy).filter(function(m){ return m + "-01" <= today; });
  var reviewed = months.filter(function(m){ return state.monthReviews && state.monthReviews[m] && state.monthReviews[m].done; }).length;
  var tx = (state.transactions || []).filter(function(t){ return t.date >= start && t.date <= end; }).length;
  var rcv = (state.incomeLog || []).filter(function(r){ return r.date >= start && r.date <= end; }).length;
  return { fy: fy, label: fyLabel(fy), over: todayTaxFy(today) > fy, people: people.length, lodged: lodged.length, lodgedNames: lodged,
    documents: ev.length, kept: kept, months: months.length, reviewed: reviewed, transactions: tx, received: rcv, documentList: ev, evidence: rec.evidence || {} };
}

function step(done, title, detail, action){
  return '<li class="ye-step' + (done ? " done" : "") + '"><span class="ye-tick" aria-hidden="true">' + (done ? "✓" : "") + '</span><div><b>' + title + '</b><small>' + detail + '</small></div>' + (action || '') + '</li>';
}
export function yearEndHtml(today){
  var fy = currentTaxFy();
  var s = yearEndStatus(fy, today);
  var steps = '<ol class="ye-steps">' +
    step(s.over, s.over ? s.label + " is over" : s.label + " is still running", s.over ? "Everything below is about a finished year." : "The pack can be put together now, but the figures will move until 30 June.", "") +
    step(s.reviewed >= s.months && s.months > 0, "Months reviewed", s.reviewed + " of " + s.months + " months marked reviewed.", '<button type="button" class="btn btn-sm btn-ghost" data-ye-go="review">Review</button>') +
    step(false, "Close the year", "Bring the year's actual costs into next year's plan — budget lines and rental lines that moved.", '<button type="button" class="btn btn-sm btn-ghost" data-ye-go="close">Open</button>') +
    step(s.documents > 0 && s.kept >= s.documents, "Documents kept", s.kept + " of " + s.documents + " on the checklist ticked.", '<button type="button" class="btn btn-sm btn-ghost" data-ye-go="documents">Checklist</button>') +
    step(s.people > 0 && s.lodged >= s.people, "Returns lodged", s.people ? s.lodged + " of " + s.people + (s.lodgedNames.length ? " (" + escapeAttr(s.lodgedNames.join(", ")) + ")" : "") : "No one with a Gross income row yet.", '<button type="button" class="btn btn-sm btn-ghost" data-ye-go="returns">Returns</button>') +
  '</ol>';
  var handoff = '<div class="ye-handoff"><b>For your accountant</b>' +
    '<div class="ye-actions"><button type="button" class="btn btn-sm btn-primary" data-ye-print>Print the pack</button>' +
    '<button type="button" class="btn btn-sm btn-ghost" data-ye-tx>Transactions (CSV) · ' + s.transactions + '</button>' +
    '<button type="button" class="btn btn-sm btn-ghost" data-ye-docs>Documents list (CSV)</button></div>' +
    '<p class="ledger-note" style="margin:6px 0 0">The pack is the tax summary, property P&L, monthly cash flow, spending by category and net worth statement for ' + escapeAttr(s.label) + ', one per page.</p></div>';
  return '<section class="rp-sheet ye"><div class="rp-head"><div><h2>Year-end pack</h2><span>' + escapeAttr(s.label) + ' — change the year with the period beside the page title</span></div></div>' + steps + handoff + '</section>';
}

export function yearEndPrintHtml(){
  var opts = { categoryOf: transactionCategory };
  var fy = currentTaxFy();
  return ["tax", "property", "cashflow", "categories", "networth"].map(function(k){
    var rep = buildReport(k, opts);
    return '<div class="pr-page"><p>' + escapeAttr(fyLabel(fy)) + ' year-end pack</p><h2>' + escapeAttr(rep.title) + '</h2><p>' + escapeAttr(rep.subtitle) + '</p>' + reportTableHtml(rep) + (rep.note ? '<p>' + escapeAttr(rep.note) + '</p>' : '') + '</div>';
  }).join("");
}
export function yearEndDocumentsCsv(){
  var fy = currentTaxFy();
  var s = yearEndStatus(fy);
  return { filename: "documents-" + s.label.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase() + ".csv", headers: ["Document", "Kept"],
    rows: s.documentList.map(function(d){ return [d.text, s.evidence[d.key] ? "Yes" : ""]; }) };
}
