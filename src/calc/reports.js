import { state } from "../state.js";
import { selectedYearWindow } from "./ledger.js";
import { getTaxPeople, computePersonTax, currentTaxFy } from "./tax.js";
import { totalNetWorthValue, totalDebtsValue, toAudAmount } from "./engine.js";
import { ipProperties, propertyTaxResultBreakdown, propertiesTotalValue, propertiesTotalMortgageBalance, propertiesOffsetTotal, fyLabel } from "./property.js";
import { localDateStr } from "../lib/format.js";
import { netWorthOn, shiftDate } from "./nwhistory.js";

// ---------------- Reports (v3.62.0) ----------------
//
// Five statements over the period picked in the header, each the same shape so one renderer, one
// print layout and one CSV export serve them all:
//   { key, title, subtitle, columns: [{ key, label, num }], rows: [{ cells: {}, cls }], note }
// `cls` is "total" for a total row, "head" for a section heading. Numbers stay numbers in cells;
// the renderer formats them, the CSV keeps them raw.
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function r2(n){ return Math.round((Number(n) || 0) * 100) / 100; }
function monthsOf(win, today){
  var out = [], y = Number(win.start.slice(0, 4)), m = Number(win.start.slice(5, 7)) - 1;
  for(var i = 0; i < 12; i++){
    var ym = (y + Math.floor((m + i) / 12)) + "-" + String((m + i) % 12 + 1).padStart(2, "0");
    if(ym > today.slice(0, 7)) break;
    out.push(ym);
  }
  return out;
}
function ymLabel(ym){ return MONTHS[Number(ym.slice(5, 7)) - 1] + " " + ym.slice(2, 4); }

export var REPORTS = [
  { key: "cashflow", label: "Monthly cash flow" },
  { key: "categories", label: "Spending by category" },
  { key: "networth", label: "Net worth statement" },
  { key: "property", label: "Property P&L" },
  { key: "tax", label: "Tax summary" },
  { key: "month", label: "Month in detail" },
  { key: "yearend", label: "Year-end pack" }
];

export function cashflowReport(opts){
  opts = opts || {};
  var today = opts.today || localDateStr();
  var win = opts.win || selectedYearWindow(today);
  var months = monthsOf(win, today);
  var running = 0, tin = 0, tout = 0;
  var rows = months.map(function(ym){
    var inn = (state.incomeLog || []).filter(function(r){ return (r.date || "").slice(0, 7) === ym; }).reduce(function(s, r){ return s + (Number(r.amount) || 0); }, 0);
    var out = (state.transactions || []).filter(function(t){ return (t.date || "").slice(0, 7) === ym; }).reduce(function(s, t){ return s + (Number(t.amount) || 0); }, 0);
    running += inn - out; tin += inn; tout += out;
    return { ym: ym, cells: { month: ymLabel(ym), in: r2(inn), out: r2(out), net: r2(inn - out), running: r2(running) } };
  });
  rows.push({ cls: "total", cells: { month: "Total", in: r2(tin), out: r2(tout), net: r2(tin - tout), running: r2(running) } });
  return { key: "cashflow", title: "Monthly cash flow", subtitle: win.label + (today < win.end ? " so far" : ""),
    columns: [{ key: "month", label: "Month" }, { key: "in", label: "Money in", num: true }, { key: "out", label: "Money out", num: true }, { key: "net", label: "Net", num: true }, { key: "running", label: "Running", num: true }],
    rows: rows, note: "Money in is what's been logged as received; money out is logged spending. Transfers between your own accounts aren't in either." };
}

export function categoryReport(opts){
  opts = opts || {};
  var today = opts.today || localDateStr();
  var win = opts.win || selectedYearWindow(today);
  var categoryOf = opts.categoryOf || function(t){ return t.category || ""; };
  var months = monthsOf(win, today);
  var grid = {}, colTotals = {};
  (state.transactions || []).forEach(function(t){
    var ym = (t.date || "").slice(0, 7);
    if(months.indexOf(ym) === -1) return;
    var c = categoryOf(t) || "Uncategorised";
    grid[c] = grid[c] || {};
    grid[c][ym] = (grid[c][ym] || 0) + (Number(t.amount) || 0);
    colTotals[ym] = (colTotals[ym] || 0) + (Number(t.amount) || 0);
  });
  var cats = Object.keys(grid).map(function(c){
    var total = months.reduce(function(s, ym){ return s + (grid[c][ym] || 0); }, 0);
    return { c: c, total: total };
  }).sort(function(a, b){ return b.total - a.total; });
  var columns = [{ key: "cat", label: "Category" }].concat(months.map(function(ym){ return { key: ym, label: ymLabel(ym), num: true }; }))
    .concat([{ key: "total", label: "Total", num: true }, { key: "avg", label: "Per month", num: true }]);
  var rows = cats.map(function(x){
    var cells = { cat: x.c, total: r2(x.total), avg: r2(months.length ? x.total / months.length : 0) };
    months.forEach(function(ym){ cells[ym] = r2(grid[x.c][ym] || 0); });
    return { cells: cells };
  });
  var tot = { cat: "Total" }, all = 0;
  months.forEach(function(ym){ tot[ym] = r2(colTotals[ym] || 0); all += colTotals[ym] || 0; });
  tot.total = r2(all); tot.avg = r2(months.length ? all / months.length : 0);
  rows.push({ cls: "total", cells: tot });
  return { key: "categories", title: "Spending by category", subtitle: win.label + (today < win.end ? " so far" : ""), columns: columns, rows: rows, wide: true,
    note: "Logged spending, by the category of each transaction or of the budget line it was logged against." };
}

export function netWorthReport(opts){
  opts = opts || {};
  var today = opts.today || localDateStr();
  // v3.67.0: today beside a month and a year earlier, from recorded history (calc/nwhistory.js).
  var dates = [today, shiftDate(today, -1), shiftDate(today, -12)];
  var snaps = dates.map(function(d){ return netWorthOn(d, today); });
  var now = snaps[0];
  var cats = {};
  snaps.forEach(function(sn){ Object.keys(sn.parts.assets).forEach(function(c){ cats[c] = true; }); });
  var col = function(fn){ var cells = {}; ["now", "month", "year"].forEach(function(k, i){ cells[k] = fn(snaps[i]); }); return cells; };
  var rows = [{ cls: "head", cells: { item: "What you own" } }];
  Object.keys(cats).sort().forEach(function(c){
    rows.push({ cells: Object.assign({ item: c }, col(function(sn){ return sn.parts.assets[c] != null ? r2(sn.parts.assets[c]) : null; })) });
  });
  if(now.parts.property) rows.push({ cells: Object.assign({ item: "Property" }, col(function(sn){ return r2(sn.parts.property); })) });
  if(now.parts.offsets) rows.push({ cells: Object.assign({ item: "Offset accounts" }, col(function(sn){ return r2(sn.parts.offsets); })) });
  rows.push({ cls: "total", cells: Object.assign({ item: "Total owned" }, col(function(sn){
    return r2(Object.keys(sn.parts.assets).reduce(function(s, k){ return s + sn.parts.assets[k]; }, 0) + sn.parts.property + sn.parts.offsets); })) });
  rows.push({ cls: "head", cells: { item: "What you owe" } });
  if(now.parts.loans) rows.push({ cells: Object.assign({ item: "Property loans" }, col(function(sn){ return r2(-sn.parts.loans); })) });
  if(now.parts.debts) rows.push({ cells: Object.assign({ item: "Other debts" }, col(function(sn){ return r2(-sn.parts.debts); })) });
  rows.push({ cls: "total", cells: Object.assign({ item: "Total owed" }, col(function(sn){ return r2(-(sn.parts.loans + sn.parts.debts)); })) });
  var engineNow = totalNetWorthValue();
  var diff = r2(engineNow - now.total);
  if(Math.abs(diff) >= 1) rows.push({ cells: { item: "Adjustments (offsets beyond their loan, etc.)", now: diff } });
  // A total that leaves out something held today isn't comparable — blank rather than a fake "change".
  var cmp = function(sn){ return sn.partial.length ? null : sn.total; };
  var chg = function(sn){ return sn.partial.length ? null : r2(engineNow - sn.total); };
  rows.push({ cls: "total", cells: { item: "Net worth", now: r2(engineNow), month: cmp(snaps[1]), year: cmp(snaps[2]) } });
  rows.push({ cells: { item: "Change to today", now: null, month: chg(snaps[1]), year: chg(snaps[2]) } });
  var partial = snaps[2].partial.length ? snaps[2].partial : snaps[1].partial;
  return { key: "networth", title: "Net worth statement", subtitle: "as at " + today,
    columns: [{ key: "item", label: "" }, { key: "now", label: "Today", num: true }, { key: "month", label: "A month ago", num: true }, { key: "year", label: "A year ago", num: true }], rows: rows,
    note: "Earlier columns use the last value recorded on or before each date; loans use their recorded balance where there is one, otherwise today's." +
      (partial.length ? " Some of what you hold today wasn't recorded yet back then (" + partial.slice(0, 3).join(", ") + (partial.length > 3 ? " and " + (partial.length - 3) + " more" : "") + "), so those columns' totals are left blank rather than compared." : "") };
}

export function propertyReport(){
  var props = ipProperties();
  var keys = ["rent", "expenses", "interest", "depreciation", "borrowing", "claims"];
  var labels = { rent: "Rent", expenses: "Expenses", interest: "Loan interest", depreciation: "Depreciation", borrowing: "Borrowing costs", claims: "Claimed from the budget" };
  var cols = [{ key: "line", label: "" }].concat(props.map(function(p){ return { key: p.id, label: p.what || "Property", num: true }; })).concat(props.length > 1 ? [{ key: "all", label: "All", num: true }] : []);
  var bs = props.map(function(p){ return propertyTaxResultBreakdown(p); });
  var rows = keys.map(function(k){
    var cells = { line: labels[k] }, all = 0;
    props.forEach(function(p, i){ var a = bs[i].rows.find(function(r){ return r.key === k; }).amount; cells[p.id] = r2(a); all += a; });
    if(props.length > 1) cells.all = r2(all);
    return { cells: cells };
  });
  var tot = { line: "Net rental result" }, all = 0;
  props.forEach(function(p, i){ tot[p.id] = r2(bs[i].net); all += bs[i].net; });
  if(props.length > 1) tot.all = r2(all);
  rows.push({ cls: "total", cells: tot });
  return { key: "property", title: "Property P&L", subtitle: "a year at today's rates", columns: cols, rows: props.length ? rows : [],
    note: "The plan for a full year, as the tax estimate uses it. Depreciation and borrowing costs are deductions, not cash." };
}

export function taxReport(opts){
  opts = opts || {};
  var fy = opts.fy != null ? opts.fy : currentTaxFy();
  var people = getTaxPeople();
  var lines = [["gross", "Income"], ["deductions", "Deductions"], ["taxable", "Taxable income"], ["incomeTax", "Income tax"], ["medicare", "Medicare levy"],
    ["medicareSurcharge", "Medicare levy surcharge"], ["helpRepayment", "HELP repayment"], ["totalTax", "Total tax"], ["refund", "Refund (or bill if negative)"]];
  var results = people.map(function(p){ return computePersonTax(p, { fy: fy }); });
  var rows = lines.map(function(l){
    var cells = { line: l[1] };
    people.forEach(function(p, i){ var v = results[i][l[0]]; cells[p] = v == null ? null : r2(v); });
    return { cells: cells, cls: l[0] === "taxable" || l[0] === "totalTax" ? "total" : "" };
  }).filter(function(r){ return people.some(function(p){ return r.cells[p] != null && r.cells[p] !== 0; }) || r.cls; });
  return { key: "tax", title: "Tax summary", subtitle: fyLabel(fy), columns: [{ key: "line", label: "" }].concat(people.map(function(p){ return { key: p, label: p, num: true }; })), rows: people.length ? rows : [],
    note: "From Tax → Returns' documents where they're entered, the plan otherwise. A refund needs the income statements' tax withheld." };
}

export function buildReport(key, opts){
  if(key === "categories") return categoryReport(opts);
  if(key === "networth") return netWorthReport(opts);
  if(key === "property") return propertyReport(opts);
  if(key === "tax") return taxReport(opts);
  return cashflowReport(opts);
}
export function reportCsvRows(rep){
  return { headers: rep.columns.map(function(c){ return c.label || c.key; }),
    rows: rep.rows.map(function(r){ return rep.columns.map(function(c){ var v = r.cells[c.key]; return v == null ? "" : v; }); }) };
}
