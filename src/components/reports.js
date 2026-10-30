import { state } from "../state.js";
import { partOn } from "../calc/parts.js";
import { REPORTS, REPORT_GROUPS, buildReport, reportCsvRows } from "../calc/reports.js";
import { getTaxPeople } from "../calc/tax.js";
import { transactionCategory, transactionAccount, budgetLineItems } from "./expenses.js";
import { RANGES, COMPARES, GROUPS, rangeWindow, compareWindow, monthsIn } from "../calc/reportframe.js";
import { selectedYearWindow, periodsOf, transactionDisplayName } from "../calc/ledger.js";
import { reportChartHtml } from "../lib/reportcharts.js";
import { fmtCurrency2, fmtDate, localDateStr } from "../lib/format.js";
import { yearEndHtml } from "./yearend.js";
import { monthDetailHtml } from "./monthdetail.js";
import { fmtCurrency0 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Reports (v3.62.0) ----------------
// One page, five statements (calc/reports.js), each following the header's period, printable
// (the page prints just the report) and downloadable as CSV.
export var reportShown = { key: "cashflow" };
// v3.118.0: the frame every report reads — which dates, compared with what, grouped how. Session-only.
export var reportFrame = { range: "period", from: "", to: "", compare: "none", group: "category", open: {} };

function lineById(){ var m = {}; budgetLineItems().forEach(function(l){ if(l.id) m[l.id] = l; }); return m; }
// A transaction's group under the frame's grouping.
function groupFn(group){
  var lines = lineById();
  var line = function(t){ return t.linkedExpenseId ? lines[t.linkedExpenseId] : null; };
  if(group === "class") return function(t){ var l = line(t); return (l && l.classification && l.classification !== "N/A") ? l.classification : "Other"; };
  if(group === "line") return function(t){ var l = line(t); return l ? (l.what || "Line") : "One-off"; };
  if(group === "merchant") return function(t){ return transactionDisplayName(t, budgetLineItems()); };
  if(group === "account") return function(t){ return transactionAccount(t) || "No account"; };
  if(group === "person") return function(t){ var l = line(t); return (t.person || (l && l.person) || "Household"); };
  return function(t){ return transactionCategory(t) || "Uncategorised"; };
}
// What the budget planned for the window, by the same grouping; null where a budget has no such
// grouping (merchant, person).
function budgetByGroup(group, win, today){
  if(group === "merchant" || group === "person") return null;
  var months = monthsIn(win, today).length || 1;
  var out = {};
  budgetLineItems().forEach(function(l){
    var k = group === "class" ? (l.classification && l.classification !== "N/A" ? l.classification : "Other")
      : group === "line" ? (l.what || "Line") : group === "account" ? (l.account || "No account") : ((l.category || "").trim() || "Uncategorised");
    out[k] = (out[k] || 0) + periodsOf(Number(l.amount) || 0, l.freq).monthly * months;
  });
  return out;
}
// The options every report gets from the frame.
export function reportOpts(today){
  today = today || localDateStr();
  var f = reportFrame;
  var win = rangeWindow(f.range, today, { yearWin: selectedYearWindow(today), from: f.from, to: f.to });
  var groupOf = groupFn(f.group);
  var o = { today: today, win: win, categoryOf: transactionCategory, groupOf: groupOf, groupLabel: (GROUPS.find(function(g){ return g.key === f.group; }) || {}).label,
    classOf: groupFn("class"), budgetLines: budgetLineItems(), yearWin: selectedYearWindow(today) };
  if(f.compare === "budget"){
    var b = budgetByGroup(f.group, win, today);
    if(b){ o.compareTotals = b; o.compareLabel = "budget"; }
  } else if(f.compare !== "none"){
    o.cmpWin = compareWindow(win, f.compare);
    o.compareLabel = o.cmpWin.label;
  }
  return o;
}
function frameControlsHtml(rep){
  var fr = rep.frame || {};
  if(!fr.range) return "";
  var sel = function(attr, list, value){ return '<select data-rf="' + attr + '">' + list.map(function(x){ return '<option value="' + x.key + '"' + (x.key === value ? " selected" : "") + '>' + escapeAttr(x.label) + '</option>'; }).join("") + '</select>'; };
  return '<div class="rf-bar">' +
    '<label class="cf-filter"><span>Period</span>' + sel("range", RANGES, reportFrame.range) + '</label>' +
    (reportFrame.range === "custom" ? '<label class="cf-filter"><span>From</span><input type="date" data-rf="from" value="' + escapeAttr(reportFrame.from) + '"></label><label class="cf-filter"><span>To</span><input type="date" data-rf="to" value="' + escapeAttr(reportFrame.to) + '"></label>' : '') +
    (fr.compare ? '<label class="cf-filter"><span>Compare with</span>' + sel("compare", rep.key === "cashflow" ? COMPARES.filter(function(c){ return c.key !== "budget"; }) : COMPARES, reportFrame.compare) + '</label>' : '') +
    (fr.group ? '<label class="cf-filter"><span>Group by</span>' + sel("group", GROUPS, reportFrame.group) + '</label>' : '') +
  '</div>' + (reportFrame.compare === "budget" && fr.group && (reportFrame.group === "merchant" || reportFrame.group === "person") ? '<p class="ledger-note">The budget isn\'t set by ' + reportFrame.group + ', so there\'s nothing to compare against for this grouping.</p>' : '');
}
// Under the table: the transactions behind each opened row.
function drillHtml(rep, opts){
  if(rep.key !== "categories") return "";
  var keys = Object.keys(reportFrame.open).filter(function(k){ return reportFrame.open[k]; });
  return keys.map(function(k){
    var tx = (state.transactions || []).filter(function(t){ return t.date >= opts.win.start && t.date <= opts.win.end && opts.groupOf(t) === k; })
      .sort(function(a, b){ return a.date < b.date ? 1 : -1; });
    if(!tx.length) return "";
    return '<div class="rp-drill"><div class="rp-drill-head"><b>' + escapeAttr(k) + '</b> — ' + tx.length + ' transaction' + (tx.length === 1 ? '' : 's') +
      // v3.168.0: by category, the same rows in Spending — a filter there, and a view to keep.
      (reportFrame.group === "category" ? '<button type="button" class="btn btn-ghost btn-sm" data-sv data-sv-direction="out" data-sv-category="' + escapeAttr(k) + '" data-sv-from="' + escapeAttr(opts.win.start) + '" data-sv-to="' + escapeAttr(opts.win.end) + '">Show in Spending</button>' : '') +
      '<button type="button" class="btn btn-ghost btn-sm" data-rf-drill="' + escapeAttr(k) + '">Close</button></div>' +
      '<table class="rp-table"><tbody>' + tx.slice(0, 60).map(function(t){
        return '<tr><td>' + escapeAttr(fmtDate(t.date)) + '</td><td>' + escapeAttr(transactionDisplayName(t, budgetLineItems())) + '</td><td class="num">' + fmtCurrency2.format(Number(t.amount) || 0) + '</td></tr>';
      }).join("") + '</tbody></table>' + (tx.length > 60 ? '<p class="ledger-note">The 60 most recent of ' + tx.length + '.</p>' : '') + '</div>';
  }).join("");
}
function cell(v, num){
  if(v == null || v === "") return "";
  if(!num) return escapeAttr(v);
  return (v < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(v));
}
function pctCell(v){ return v == null || v === "" ? "" : (Math.round(v * 10) / 10) + "%"; }
export function reportTableHtml(rep){
  if(!rep.rows.length) return '<p class="ledger-note" style="margin:0">Nothing to report yet for this one.</p>';
  return '<div class="rp-scroll"><table class="rp-table' + (rep.wide ? " rp-wide" : "") + '"><thead><tr>' + rep.columns.map(function(c){ return '<th' + (c.num ? ' class="num"' : '') + ' scope="col">' + escapeAttr(c.label) + '</th>'; }).join("") + '</tr></thead><tbody>' +
    rep.rows.map(function(r){
      return '<tr' + (r.cls ? ' class="' + r.cls + '"' : '') + '>' + rep.columns.map(function(c, i){
        var v = r.cells[c.key];
        // v3.81.0: a month row opens Month in detail; v3.118.0: a group row opens its transactions.
        var inner = i === 0 && r.ym ? '<button type="button" class="rp-month-link" data-md-open="' + r.ym + '" title="See this month in detail">' + cell(v, c.num) + '</button>'
          : i === 0 && r.drill ? '<button type="button" class="rp-month-link" data-rf-drill="' + escapeAttr(r.drill) + '" aria-expanded="' + !!reportFrame.open[r.drill] + '" title="See the transactions">' + cell(v, c.num) + '</button>' : ((r.cls === "pct" || c.pct) && c.num ? pctCell(v) : cell(v, c.num));
        // v3.120.0: a heat-map cell (Budget vs actual) carries its shade.
        var heat = r.heat && r.heat[c.key] ? " heat" + (r.heat[c.key] > 0 ? "-p" : "-n") + Math.abs(r.heat[c.key]) : "";
        return (i === 0 ? '<th scope="row">' : '<td' + (c.num ? ' class="num' + (typeof v === "number" && v < 0 ? " neg" : "") + heat + '"' : '') + '>') + inner + (i === 0 ? '</th>' : '</td>');
      }).join("") + '</tr>';
    }).join("") + '</tbody></table></div>';
}
// v3.123.0: a report told in sentences (Year in review) leads with them.
function storyHtml(rep){ return rep.narrative && rep.narrative.length ? '<ul class="rp-story">' + rep.narrative.map(function(s){ return '<li>' + escapeAttr(s) + '</li>'; }).join("") + '</ul>' : ""; }
// ---------------- Pinned reports (v3.124.0) ----------------
// A report kept with its frame, named for what it shows: "Spending · Last 12 months · by merchant".
function labelOf(list, key){ var x = list.find(function(i){ return i.key === key; }); return x ? x.label : key; }
export function savedReportName(rep, frame){
  var fr = rep.frame || {}, parts = [rep.title.replace(/ by .*$/, "")];
  if(fr.range) parts.push(frame.range === "custom" ? rangeWindow("custom", localDateStr(), { from: frame.from, to: frame.to }).label : labelOf(RANGES, frame.range));
  if(fr.group) parts.push("by " + labelOf(GROUPS, frame.group).toLowerCase());
  if(fr.compare && frame.compare !== "none") parts.push("against " + labelOf(COMPARES, frame.compare).toLowerCase());
  return parts.join(" · ");
}
export function pinReport(){
  var rep = buildReport(reportShown.key, reportOpts());
  var frame = { range: reportFrame.range, from: reportFrame.from, to: reportFrame.to, compare: reportFrame.compare, group: reportFrame.group };
  var name = savedReportName(rep, frame);
  if(state.savedReports.some(function(r){ return r.name === name && r.key === reportShown.key; })) return null;
  var saved = { id: "rp" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name, key: reportShown.key, frame: frame };
  state.savedReports.push(saved);
  return saved;
}
export function openSavedReport(id){
  var r = state.savedReports.find(function(x){ return x.id === id; });
  if(!r) return false;
  reportShown.key = r.key;
  Object.assign(reportFrame, { range: "period", from: "", to: "", compare: "none", group: "category" }, r.frame || {}, { open: {} });
  return true;
}
export function unpinReport(id){ state.savedReports = state.savedReports.filter(function(x){ return x.id !== id; }); }
function pickerHtml(){
  var pins = (state.savedReports || []).length ? '<div class="rp-group rp-pins"><span class="rp-group-label">Pinned</span><div class="rp-chips">' + state.savedReports.map(function(r){
      return '<span class="rp-pin"><button type="button" class="period-chip" data-report-saved="' + escapeAttr(r.id) + '">' + escapeAttr(r.name) + '</button>' +
        '<button type="button" class="rp-unpin" data-report-unpin="' + escapeAttr(r.id) + '" aria-label="Unpin ' + escapeAttr(r.name) + '" title="Unpin">×</button></span>';
    }).join("") + '</div></div>' : '';
  return pins + '<div class="rp-picker" role="tablist" aria-label="Reports">' + REPORT_GROUPS.map(function(g){
    return '<div class="rp-group"><span class="rp-group-label">' + escapeAttr(g.label) + '</span><div class="rp-chips">' + REPORTS.filter(function(r){ return r.group === g.key && (!r.part || partOn(r.part, state)); }).map(function(r){
      var on = r.key === reportShown.key;
      return '<button type="button" class="period-chip' + (on ? " active" : "") + '" role="tab" aria-selected="' + on + '" data-report="' + r.key + '">' + r.label + '</button>';
    }).join("") + '</div></div>';
  }).join("") + '</div>';
}
// v3.124.0: what a printout opens with — whose it is, what it is, for when, and when it was printed.
function householdName(){ var p = getTaxPeople(); return p.length ? p.slice(0, -1).join(", ") + (p.length > 1 ? " and " : "") + p[p.length - 1] : "Household"; }
function printTitleHtml(rep){
  var v = typeof document !== "undefined" && document.querySelector(".app-version-num");
  return '<header class="pr-title"><p class="pr-who">' + escapeAttr(householdName()) + '</p><h1>' + escapeAttr(rep.title) + '</h1>' +
    '<p>' + escapeAttr(rep.subtitle || "") + '</p><p class="pr-when">Printed ' + escapeAttr(fmtDate(localDateStr(), { year: true })) + (v ? ' · Wealth Planner ' + escapeAttr(v.textContent) : '') + '</p></header>';
}
export function reportsPageHtml(opts){
  var picker = pickerHtml();
  // v3.68.0: the year-end pack is a checklist with hand-off buttons, not a table.
  if(reportShown.key === "yearend") return picker + yearEndHtml();
  if(reportShown.key === "month") return picker + monthDetailHtml();
  var rep = buildReport(reportShown.key, opts);
  return picker + frameControlsHtml(rep) +
    '<section class="rp-sheet" id="reportSheet"><div class="rp-head"><div><h2>' + escapeAttr(rep.title) + '</h2><span>' + escapeAttr(rep.subtitle) + '</span></div>' +
      '<div class="rp-actions"><button type="button" class="btn btn-sm btn-ghost" data-report-pin title="Keep this report with its settings above the list">Pin</button><button type="button" class="btn btn-sm btn-ghost" data-report-print>Print / PDF</button><button type="button" class="btn btn-sm btn-ghost" data-report-csv>Download CSV</button></div></div>' +
      storyHtml(rep) + reportChartHtml(rep.chart) + reportTableHtml(rep) + drillHtml(rep, opts) + (rep.note ? '<p class="ledger-note rp-note">' + escapeAttr(rep.note) + '</p>' : '') + '</section>';
}
export function renderReports(){
  var el = typeof document !== "undefined" && document.getElementById("reportsBody");
  if(el) el.innerHTML = reportsPageHtml(reportOpts());
}
// The static copy printed on its own (the same #printRoot the tax worksheet uses).
export function reportPrintHtml(){
  var opts = reportOpts();
  var rep = buildReport(reportShown.key, opts);
  return '<div class="pr-page pr-report">' + printTitleHtml(rep) + storyHtml(rep) + reportChartHtml(rep.chart) + reportTableHtml(rep) + drillHtml(rep, opts) + (rep.note ? '<p>' + escapeAttr(rep.note) + '</p>' : '') + '</div>';
}
export function reportCsv(){
  var rep = buildReport(reportShown.key, reportOpts());
  var c = reportCsvRows(rep);
  return { filename: "wealth-planner-" + rep.key + "-" + rep.subtitle.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() + ".csv", headers: c.headers, rows: c.rows };
}
