import { REPORTS, buildReport, reportCsvRows } from "../calc/reports.js";
import { transactionCategory } from "./expenses.js";
import { yearEndHtml } from "./yearend.js";
import { monthDetailHtml } from "./monthdetail.js";
import { fmtCurrency0 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Reports (v3.62.0) ----------------
// One page, five statements (calc/reports.js), each following the header's period, printable
// (the page prints just the report) and downloadable as CSV.
export var reportShown = { key: "cashflow" };
function cell(v, num){
  if(v == null || v === "") return "";
  if(!num) return escapeAttr(v);
  return (v < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(v));
}
export function reportTableHtml(rep){
  if(!rep.rows.length) return '<p class="ledger-note" style="margin:0">Nothing to report yet for this one.</p>';
  return '<div class="rp-scroll"><table class="rp-table' + (rep.wide ? " rp-wide" : "") + '"><thead><tr>' + rep.columns.map(function(c){ return '<th' + (c.num ? ' class="num"' : '') + ' scope="col">' + escapeAttr(c.label) + '</th>'; }).join("") + '</tr></thead><tbody>' +
    rep.rows.map(function(r){
      return '<tr' + (r.cls ? ' class="' + r.cls + '"' : '') + '>' + rep.columns.map(function(c, i){
        var v = r.cells[c.key];
        // v3.81.0: a month row opens Month in detail.
        var inner = i === 0 && r.ym ? '<button type="button" class="rp-month-link" data-md-open="' + r.ym + '" title="See this month in detail">' + cell(v, c.num) + '</button>' : cell(v, c.num);
        return (i === 0 ? '<th scope="row">' : '<td' + (c.num ? ' class="num' + (typeof v === "number" && v < 0 ? " neg" : "") + '"' : '') + '>') + inner + (i === 0 ? '</th>' : '</td>');
      }).join("") + '</tr>';
    }).join("") + '</tbody></table></div>';
}
export function reportsPageHtml(opts){
  var picker = '<div class="rp-picker" role="tablist" aria-label="Reports">' + REPORTS.map(function(r){
      var on = r.key === reportShown.key;
      return '<button type="button" class="period-chip' + (on ? " active" : "") + '" role="tab" aria-selected="' + on + '" data-report="' + r.key + '">' + r.label + '</button>';
    }).join("") + '</div>';
  // v3.68.0: the year-end pack is a checklist with hand-off buttons, not a table.
  if(reportShown.key === "yearend") return picker + yearEndHtml();
  if(reportShown.key === "month") return picker + monthDetailHtml();
  var rep = buildReport(reportShown.key, opts);
  return '<div class="rp-picker" role="tablist" aria-label="Reports">' + REPORTS.map(function(r){
      var on = r.key === reportShown.key;
      return '<button type="button" class="period-chip' + (on ? " active" : "") + '" role="tab" aria-selected="' + on + '" data-report="' + r.key + '">' + r.label + '</button>';
    }).join("") + '</div>' +
    '<section class="rp-sheet" id="reportSheet"><div class="rp-head"><div><h2>' + escapeAttr(rep.title) + '</h2><span>' + escapeAttr(rep.subtitle) + '</span></div>' +
      '<div class="rp-actions"><button type="button" class="btn btn-sm btn-ghost" data-report-print>Print / PDF</button><button type="button" class="btn btn-sm btn-ghost" data-report-csv>Download CSV</button></div></div>' +
      reportTableHtml(rep) + (rep.note ? '<p class="ledger-note rp-note">' + escapeAttr(rep.note) + '</p>' : '') + '</section>';
}
export function renderReports(){
  var el = typeof document !== "undefined" && document.getElementById("reportsBody");
  if(el) el.innerHTML = reportsPageHtml({ categoryOf: transactionCategory });
}
// The static copy printed on its own (the same #printRoot the tax worksheet uses).
export function reportPrintHtml(){
  var rep = buildReport(reportShown.key, { categoryOf: transactionCategory });
  return '<div class="pr-page"><h2>' + escapeAttr(rep.title) + '</h2><p>' + escapeAttr(rep.subtitle) + '</p>' + reportTableHtml(rep) + (rep.note ? '<p>' + escapeAttr(rep.note) + '</p>' : '') + '</div>';
}
export function reportCsv(){
  var rep = buildReport(reportShown.key, { categoryOf: transactionCategory });
  var c = reportCsvRows(rep);
  return { filename: "wealth-planner-" + rep.key + "-" + rep.subtitle.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() + ".csv", headers: c.headers, rows: c.rows };
}
