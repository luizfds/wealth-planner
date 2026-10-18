import { state } from "../state.js";
import { selectedYearWindow } from "./ledger.js";
import { getTaxPeople, computePersonTax, currentTaxFy } from "./tax.js";
import { totalNetWorthValue, totalDebtsValue, toAudAmount } from "./engine.js";
import { ipProperties, propertyTaxResultBreakdown, propertiesTotalValue, propertiesTotalMortgageBalance, propertiesOffsetTotal, fyLabel } from "./property.js";
import { localDateStr } from "../lib/format.js";

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
  { key: "tax", label: "Tax summary" }
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
    return { cells: { month: ymLabel(ym), in: r2(inn), out: r2(out), net: r2(inn - out), running: r2(running) } };
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
  var byCat = {};
  (state.assets || []).forEach(function(a){ var c = a.category || "Other"; byCat[c] = (byCat[c] || 0) + toAudAmount(a, a.amount); });
  var rows = [{ cls: "head", cells: { item: "What you own" } }];
  var own = 0;
  Object.keys(byCat).sort().forEach(function(c){ own += byCat[c]; rows.push({ cells: { item: c, amount: r2(byCat[c]) } }); });
  var pv = propertiesTotalValue(), off = propertiesOffsetTotal();
  if(pv) { own += pv; rows.push({ cells: { item: "Property", amount: r2(pv) } }); }
  if(off){ own += off; rows.push({ cells: { item: "Offset accounts", amount: r2(off) } }); }
  rows.push({ cls: "total", cells: { item: "Total owned", amount: r2(own) } });
  rows.push({ cls: "head", cells: { item: "What you owe" } });
  var owe = 0, loans = propertiesTotalMortgageBalance(), debts = totalDebtsValue();
  if(loans){ owe += loans; rows.push({ cells: { item: "Property loans", amount: r2(-loans) } }); }
  (state.debts || []).forEach(function(d){ if(Number(d.balance)) rows.push({ cells: { item: d.what || "Debt", amount: r2(-Number(d.balance)) } }); });
  owe += debts;
  rows.push({ cls: "total", cells: { item: "Total owed", amount: r2(-owe) } });
  var net = totalNetWorthValue();
  // Anything the engine counts differently from this list (an offset capped at its loan, say).
  var diff = r2(net - (own - owe));
  if(Math.abs(diff) >= 1) rows.push({ cells: { item: "Adjustments (offsets beyond their loan, etc.)", amount: diff } });
  rows.push({ cls: "total", cells: { item: "Net worth", amount: r2(net) } });
  return { key: "networth", title: "Net worth statement", subtitle: "as at " + today, columns: [{ key: "item", label: "" }, { key: "amount", label: "Amount", num: true }], rows: rows,
    note: "Balances as last recorded on Accounts, Investments and Property." };
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
