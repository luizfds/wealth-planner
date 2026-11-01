import { state } from "../state.js";
import { selectedYearWindow } from "./ledger.js";
import { getTaxPeople, computePersonTax, currentTaxFy } from "./tax.js";
import { totalNetWorthValue, toAudAmount } from "./engine.js";
import { ipProperties, propertyTaxResultBreakdown, fyLabel } from "./property.js";
import { localDateStr, fmtDate } from "../lib/format.js";
import { netWorthOn, shiftDate } from "./nwhistory.js";
import { netWorthChecks } from "./nwcheck.js";
import { monthsIn, spendingByGroup, change } from "./reportframe.js";
import { incomeTargets } from "./received.js";
import { periodsOf } from "./ledger.js";
import { holdingReturns, distributionYears, cgtParcels } from "./investreports.js";
import { propertyReturns, debtSchedule } from "./assetreports.js";
import { superContributions } from "./investments.js";
import { valueOn } from "./history.js";
import { fyWindow, financialYearOf, loanRepaymentMonthly, loanBalance } from "./property.js";

// ---------------- Reports (v3.62.0) ----------------
//
// Five statements over the period picked in the header, each the same shape so one renderer, one
// print layout and one CSV export serve them all:
//   { key, title, subtitle, columns: [{ key, label, num }], rows: [{ cells: {}, cls }], note }
// `cls` is "total" for a total row, "head" for a section heading. Numbers stay numbers in cells;
// the renderer formats them, the CSV keeps them raw.
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function r2(n){ return Math.round((Number(n) || 0) * 100) / 100; }
// v3.118.0: any window the report frame picks (calc/reportframe.js), not only twelve months.
function monthsOf(win, today){ return monthsIn(win, today); }
function ymLabel(ym){ return MONTHS[Number(ym.slice(5, 7)) - 1] + " " + ym.slice(2, 4); }

// v3.124.0: in groups, so a picker of twenty reads as three short rows.
export var REPORT_GROUPS = [
  { key: "money", label: "Money in and out" },
  { key: "own", label: "What you own and owe" },
  { key: "year", label: "Tax and the year" }
];
export var REPORTS = [
  { key: "cashflow", label: "Monthly cash flow", group: "money" },
  { key: "categories", label: "Spending", group: "money" },
  { key: "income", label: "Income statement", group: "money" },
  { key: "flow", label: "Where the money goes", group: "money" },
  { key: "budget", label: "Budget vs actual", group: "money" },
  { key: "trends", label: "Year on year", group: "money" },
  { key: "month", label: "Month in detail", group: "money" },
  { key: "networth", label: "Net worth statement", group: "own" },
  { key: "nwcheck", label: "Net worth check", group: "own" },
  // `part` (v3.161.0, item 191): offered only while the household has that part — calc/parts.js.
  { key: "invest", label: "Investment returns", group: "own", part: "shares" },
  { key: "dividends", label: "Distributions", group: "own", part: "shares" },
  { key: "cgt", label: "Capital gains", group: "own", part: "shares" },
  { key: "propreturns", label: "Property returns", group: "own", part: "property" },
  { key: "property", label: "Property P&L", group: "own", part: "property" },
  { key: "debts", label: "Loans and debts", group: "own" },
  { key: "super", label: "Super", group: "own" },
  { key: "tax", label: "Tax summary", group: "year" },
  { key: "review", label: "Year in review", group: "year" },
  { key: "lender", label: "Lender pack", group: "year" },
  { key: "yearend", label: "Year-end pack", group: "year" }
];

export function cashflowReport(opts){
  opts = opts || {};
  var today = opts.today || localDateStr();
  var win = opts.win || selectedYearWindow(today);
  var months = monthsOf(win, today);
  var running = 0, tin = 0, tout = 0;
  /** @type {any[]} */
  var rows = months.map(function(ym){
    var inn = (state.incomeLog || []).filter(function(r){ return (r.date || "").slice(0, 7) === ym; }).reduce(function(s, r){ return s + (Number(r.amount) || 0); }, 0);
    var out = (state.transactions || []).filter(function(t){ return (t.date || "").slice(0, 7) === ym; }).reduce(function(s, t){ return s + (Number(t.amount) || 0); }, 0);
    running += inn - out; tin += inn; tout += out;
    return { ym: ym, cells: { month: ymLabel(ym), in: r2(inn), out: r2(out), net: r2(inn - out), running: r2(running) } };
  });
  rows.push({ cls: "total", cells: { month: "Total", in: r2(tin), out: r2(tout), net: r2(tin - tout), running: r2(running) } });
  // v3.118.0: the same totals over the comparison window, when the frame asks for one.
  if(opts.cmpWin){
    var cin = (state.incomeLog || []).filter(function(r){ return r.date >= opts.cmpWin.start && r.date <= opts.cmpWin.end; }).reduce(function(s, r){ return s + (Number(r.amount) || 0); }, 0);
    var cout = (state.transactions || []).filter(function(t){ return t.date >= opts.cmpWin.start && t.date <= opts.cmpWin.end; }).reduce(function(s, t){ return s + (Number(t.amount) || 0); }, 0);
    rows.push({ cls: "compare", cells: { month: "Compared: " + opts.cmpWin.label, in: r2(cin), out: r2(cout), net: r2(cin - cout), running: null } });
  }
  var chart = { type: "columns", series: ["Money in", "Money out"], items: rows.filter(function(r){ return r.ym; }).map(function(r){ return { label: r.cells.month, a: r.cells.in, b: r.cells.out, ym: r.ym }; }) };
  return { key: "cashflow", chart: chart, frame: { range: true, compare: true }, title: "Monthly cash flow", subtitle: win.label + (today < win.end ? " so far" : ""),
    columns: [{ key: "month", label: "Month" }, { key: "in", label: "Money in", num: true }, { key: "out", label: "Money out", num: true }, { key: "net", label: "Net", num: true }, { key: "running", label: "Running", num: true }],
    rows: rows, note: "Money in is what's been logged as received; money out is logged spending. Transfers between your own accounts aren't in either." };
}

export function categoryReport(opts){
  opts = opts || {};
  var today = opts.today || localDateStr();
  var win = opts.win || selectedYearWindow(today);
  // v3.118.0: grouped however the frame says (category by default), compared, charted, drillable.
  var categoryOf = opts.groupOf || opts.categoryOf || function(t){ return t.category || ""; };
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
  /** @type {any[]} */
  var rows = cats.map(function(x){
    var cells = { cat: x.c, total: r2(x.total), avg: r2(months.length ? x.total / months.length : 0) };
    months.forEach(function(ym){ cells[ym] = r2(grid[x.c][ym] || 0); });
    return { cells: cells };
  });
  var tot = { cat: "Total" }, all = 0;
  months.forEach(function(ym){ tot[ym] = r2(colTotals[ym] || 0); all += colTotals[ym] || 0; });
  tot.total = r2(all); tot.avg = r2(months.length ? all / months.length : 0);
  var cmp = opts.compareTotals || (opts.cmpWin ? spendingByGroup(state.transactions, opts.cmpWin, function(t){ return categoryOf(t) || "Uncategorised"; }) : null);
  if(cmp){
    columns.push({ key: "cmp", label: opts.compareLabel || "Compared", num: true }, { key: "chg", label: "Change", num: true });
    rows.forEach(function(r){ var v = cmp[r.cells.cat] || 0; r.cells.cmp = r2(v); r.cells.chg = change(r.cells.total, v).diff; });
    var cmpAll = Object.keys(cmp).reduce(function(s, k){ return s + cmp[k]; }, 0);
    tot.cmp = r2(cmpAll); tot.chg = change(tot.total, cmpAll).diff;
  }
  rows.forEach(function(r){ r.drill = r.cells.cat; });
  rows.push({ cls: "total", cells: tot });
  var chart = { type: "bars", compareLabel: cmp ? (opts.compareLabel || "Compared") : null,
    items: cats.slice(0, 12).map(function(x){ return { label: x.c, value: r2(x.total), compare: cmp ? r2(cmp[x.c] || 0) : null }; }) };
  return { key: "categories", chart: chart, frame: { range: true, compare: true, group: true }, title: "Spending" + (opts.groupLabel ? " by " + opts.groupLabel.toLowerCase() : " by category"),
    subtitle: win.label + (today < win.end ? " so far" : "") + (cmp ? " · compared with " + (opts.compareLabel || "") : ""), columns: columns, rows: rows, wide: true,
    note: "Logged spending. Open a row to see its transactions." };
}

export function netWorthReport(opts){
  opts = opts || {};
  // v3.118.0: as at the end of the frame's window, if that's already past.
  var today = opts.win && opts.win.end < (opts.today || localDateStr()) ? opts.win.end : (opts.today || localDateStr());
  // v3.67.0: today beside a month and a year earlier, from recorded history (calc/nwhistory.js).
  var dates = [today, shiftDate(today, -1), shiftDate(today, -12)];
  var snaps = dates.map(function(d){ return netWorthOn(d, today); });
  var now = snaps[0];
  var cats = {};
  snaps.forEach(function(sn){ Object.keys(sn.parts.assets).forEach(function(c){ cats[c] = true; }); });
  var col = function(fn){ var cells = {}; ["now", "month", "year"].forEach(function(k, i){ cells[k] = fn(snaps[i]); }); return cells; };
  // v3.105.0: a total for an earlier date that leaves out something held today isn't a total — blank,
  // like the net worth line below, rather than printed beside today's as if comparable.
  var totalCol = function(fn){ return col(function(sn){ return sn !== now && sn.partial.length ? null : fn(sn); }); };
  /** @type {any[]} */
  var rows = [{ cls: "head", cells: { item: "What you own" } }];
  Object.keys(cats).sort().forEach(function(c){
    rows.push({ cells: Object.assign({ item: c }, col(function(sn){ return sn.parts.assets[c] != null ? r2(sn.parts.assets[c]) : null; })) });
  });
  if(now.parts.property) rows.push({ cells: Object.assign({ item: "Property" }, col(function(sn){ return r2(sn.parts.property); })) });
  if(now.parts.offsets) rows.push({ cells: Object.assign({ item: "Offset accounts" }, col(function(sn){ return r2(sn.parts.offsets); })) });
  rows.push({ cls: "total", cells: Object.assign({ item: "Total owned" }, totalCol(function(sn){
    return r2(Object.keys(sn.parts.assets).reduce(function(s, k){ return s + sn.parts.assets[k]; }, 0) + sn.parts.property + sn.parts.offsets); })) });
  rows.push({ cls: "head", cells: { item: "What you owe" } });
  if(now.parts.loans) rows.push({ cells: Object.assign({ item: "Property loans" }, col(function(sn){ return r2(-sn.parts.loans); })) });
  if(now.parts.debts) rows.push({ cells: Object.assign({ item: "Other debts" }, col(function(sn){ return r2(-sn.parts.debts); })) });
  rows.push({ cls: "total", cells: Object.assign({ item: "Total owed" }, totalCol(function(sn){ return r2(-(sn.parts.loans + sn.parts.debts)); })) });
  var engineNow = totalNetWorthValue();
  var diff = r2(engineNow - now.total);
  if(Math.abs(diff) >= 1) rows.push({ cells: { item: "Adjustments (offsets beyond their loan, etc.)", now: diff } });
  // A total that leaves out something held today isn't comparable — blank rather than a fake "change".
  var cmp = function(sn){ return sn.partial.length ? null : sn.total; };
  var chg = function(sn){ return sn.partial.length ? null : r2(engineNow - sn.total); };
  rows.push({ cls: "total", cells: { item: "Net worth", now: r2(engineNow), month: cmp(snaps[1]), year: cmp(snaps[2]) } });
  rows.push({ cells: { item: "Change to today", now: null, month: chg(snaps[1]), year: chg(snaps[2]) } });
  var partial = snaps[2].partial.length ? snaps[2].partial : snaps[1].partial;
  return { key: "networth", frame: { range: true }, title: "Net worth statement", subtitle: "as at " + fmtDate(today, { year: true }),
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
  /** @type {any[]} */
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

// v3.82.0: each of the last 12 months — did what you kept explain how net worth moved?
export function netWorthCheckReport(opts){
  opts = opts || {};
  var today = opts.today || localDateStr();
  var checks = netWorthChecks(today.slice(0, 7), 12, { today: today });
  var rows = checks.map(function(c){
    return { ym: c.ym, cls: c.addsUp ? "" : "flag", cells: { month: ymLabel(c.ym) + (c.inProgress ? " (so far)" : ""), kept: c.kept, invest: c.invest, super: c.super, other: c.other,
      interest: -c.interest, expected: c.expectedChange, actual: c.actualChange, gap: c.gap } };
  });
  return { key: "nwcheck", title: "Net worth check", subtitle: "Last 12 months",
    // The answer first (kept, expected, actual, gap) so a phone sees it without scrolling sideways.
    columns: [{ key: "month", label: "Month" }, { key: "kept", label: "Kept", num: true }, { key: "expected", label: "Expected change", num: true },
      { key: "actual", label: "Actual change", num: true }, { key: "gap", label: "Gap", num: true }, { key: "invest", label: "Investments", num: true },
      { key: "super", label: "Super", num: true }, { key: "other", label: "Property & other", num: true }, { key: "interest", label: "Loan interest", num: true }],
    rows: rows, wide: true,
    note: "Kept is money in less money out. Investments, super, property and other assets are their recorded values moving; loan interest is worked out from what was owed less the offset. Expected is the sum; actual is how much net worth moved, counting only balances recorded at both ends of the month. A large gap usually means something wasn't logged, money moved to an account the app doesn't hold, or a balance was recorded late. Open a month for the detail." };
}
// ---------------- Income statement and where the money goes (v3.119.0) ----------------
// Money in by kind (pay, rent, other), spending by Needs / Wants / other, what was kept and the
// savings rate — month by month over the frame's window, with the plan for the same months beside
// it. opts.classOf(t) gives a transaction's Needs/Wants/Other; opts.budgetLines the plan's lines.
function inKind(target){ var k = String(target || "").split(":")[0]; return k === "net" || k === "oneoff" ? "pay" : k === "rent" ? "rent" : "other"; }
function classKey(c){ return c === "Needs" || c === "Wants" ? c : "Other"; }
export function incomeStatementReport(opts){
  opts = opts || {};
  var today = opts.today || localDateStr();
  var win = opts.win || selectedYearWindow(today);
  var months = monthsOf(win, today);
  var classOf = opts.classOf || function(){ return "Other"; };
  var grid = {};
  months.forEach(function(ym){ grid[ym] = { pay: 0, rent: 0, other: 0, Needs: 0, Wants: 0, Other: 0 }; });
  (state.incomeLog || []).forEach(function(r){ var g = grid[(r.date || "").slice(0, 7)]; if(g && r.date >= win.start && r.date <= win.end) g[inKind(r.target)] += Number(r.amount) || 0; });
  (state.transactions || []).forEach(function(t){ var g = grid[(t.date || "").slice(0, 7)]; if(g && t.date >= win.start && t.date <= win.end) g[classKey(classOf(t))] += Number(t.amount) || 0; });
  // The plan for the same number of months.
  var plan = { pay: 0, rent: 0, other: 0, Needs: 0, Wants: 0, Other: 0 };
  try { incomeTargets().forEach(function(t){ plan[inKind(t.key)] += (Number(t.monthly) || 0) * months.length; }); } catch(e){}
  (opts.budgetLines || []).forEach(function(l){ plan[classKey(l.classification)] += periodsOf(Number(l.amount) || 0, l.freq).monthly * months.length; });
  var lines = [
    ["pay", "Pay received"], ["rent", "Rent"], ["other", "Other money in"], ["in", "Total in", "total"],
    ["Needs", "Needs"], ["Wants", "Wants"], ["Other", "Other spending"], ["out", "Total out", "total"],
    ["kept", "Kept", "total"], ["rate", "Savings rate", "pct"]
  ];
  var calc = function(g){
    var tin = g.pay + g.rent + g.other, tout = g.Needs + g.Wants + g.Other;
    return Object.assign({ in: tin, out: tout, kept: tin - tout, rate: tin > 0 ? (tin - tout) / tin : null }, g);
  };
  var cols = months.map(function(ym){ return calc(grid[ym]); });
  var total = calc(months.reduce(function(acc, ym){ Object.keys(acc).forEach(function(k){ acc[k] += grid[ym][k]; }); return acc; }, { pay: 0, rent: 0, other: 0, Needs: 0, Wants: 0, Other: 0 }));
  var planned = calc(plan);
  var rows = lines.map(function(l){
    var cells = { line: l[1] };
    var val = function(c){ return l[0] === "rate" ? (c.rate == null ? null : Math.round(c.rate * 1000) / 10) : r2(c[l[0]]); };
    months.forEach(function(ym, i){ cells[ym] = val(cols[i]); });
    cells.total = val(total); cells.plan = val(planned);
    return { cls: l[2] === "total" ? "total" : l[2] === "pct" ? "pct" : "", cells: cells };
  });
  return { key: "income", frame: { range: true }, title: "Income statement", subtitle: win.label + (today < win.end ? " so far" : ""),
    columns: [{ key: "line", label: "" }].concat(months.map(function(ym){ return { key: ym, label: ymLabel(ym), num: true }; }))
      .concat([{ key: "total", label: "Total", num: true }, { key: "plan", label: "Plan", num: true }]),
    rows: rows, wide: true,
    chart: { type: "columns", series: ["Money in", "Money out"], items: months.map(function(ym, i){ return { label: ymLabel(ym), a: r2(cols[i].in), b: r2(cols[i].out), ym: ym }; }) },
    note: "Money in is what's been logged as received; spending is logged transactions, by their budget line's Needs or Wants. Savings rate is kept ÷ money in, in %. Plan is the budget and the expected income for the same number of months." };
}

// Pay (with the employer's super) into tax, super and take-home; take-home and other money in into
// Needs, Wants, other spending and what was kept. Tax and super come from the plan for the window's
// months, scaled to the pay actually received when some has been logged; spending as logged.
export function moneyFlowReport(opts){
  opts = opts || {};
  var today = opts.today || localDateStr();
  var win = opts.win || selectedYearWindow(today);
  var scale = monthsOf(win, today).length / 12;
  var classOf = opts.classOf || function(){ return "Other"; };
  var sg = 0, sac = 0, tax = 0, planTake = 0;
  getTaxPeople().forEach(function(p){
    try { var r = computePersonTax(p); sg += r.sg || 0; sac += r.sacrifice || 0; tax += (r.totalTax || 0) + (r.helpRepayment || 0); planTake += r.netTakeHome || 0; } catch(e){}
  });
  var recPay = 0, other = 0;
  (state.incomeLog || []).forEach(function(r){ if(r.date >= win.start && r.date <= win.end){ if(inKind(r.target) === "pay") recPay += Number(r.amount) || 0; else other += Number(r.amount) || 0; } });
  var takePlan = planTake * scale;
  var k = recPay > 0 && takePlan > 0 ? recPay / takePlan : 1;
  var take = recPay > 0 ? recPay : takePlan;
  var taxV = tax * scale * k, superV = (sg + sac) * scale * k, pay = take + taxV + superV;
  var spend = { Needs: 0, Wants: 0, Other: 0 };
  (state.transactions || []).forEach(function(t){ if(t.date >= win.start && t.date <= win.end) spend[classKey(classOf(t))] += Number(t.amount) || 0; });
  var available = take + other, spent = spend.Needs + spend.Wants + spend.Other;
  var kept = available - spent, drawn = kept < 0 ? -kept : 0;
  var nodes = [
    { id: "pay", label: "Pay, with super", col: 0, value: pay },
    { id: "tax", label: "Tax", col: 1, value: taxV }, { id: "super", label: "Super", col: 1, value: superV }, { id: "take", label: "Take-home", col: 1, value: take },
    { id: "other", label: "Other money in", col: 1, value: other }, { id: "drawn", label: "Drawn from savings", col: 1, value: drawn },
    { id: "Needs", label: "Needs", col: 2, value: spend.Needs }, { id: "Wants", label: "Wants", col: 2, value: spend.Wants },
    { id: "Other", label: "Other spending", col: 2, value: spend.Other }, { id: "kept", label: "Kept", col: 2, value: Math.max(0, kept) }
  ].filter(function(n){ return n.value > 0.5; });
  var links = [{ from: "pay", to: "tax", value: taxV }, { from: "pay", to: "super", value: superV }, { from: "pay", to: "take", value: take }];
  var uses = ["Needs", "Wants", "Other", "kept"].map(function(id){ return { id: id, value: id === "kept" ? Math.max(0, kept) : spend[id] }; }).filter(function(u){ return u.value > 0.5; });
  var useTotal = uses.reduce(function(s, u){ return s + u.value; }, 0);
  [["take", take], ["other", other], ["drawn", drawn]].forEach(function(src){
    var from = String(src[0]), amount = Number(src[1]);
    if(!(amount > 0.5) || !(useTotal > 0)) return;
    uses.forEach(function(u){ links.push({ from: from, to: u.id, value: amount * u.value / useTotal }); });
  });
  links = links.filter(function(l){ return l.value > 0.5; });
  var rows = nodes.map(function(n){ return { cls: n.id === "pay" || n.id === "take" || n.id === "kept" ? "total" : "", cells: { line: n.label, value: r2(n.value) } }; });
  return { key: "flow", frame: { range: true }, title: "Where the money goes", subtitle: win.label + (today < win.end ? " so far" : ""),
    chart: { type: "sankey", nodes: nodes, links: links }, columns: [{ key: "line", label: "" }, { key: "value", label: "Amount", num: true }], rows: rows,
    note: "Tax and super are the plan's for these months" + (recPay > 0 ? ", scaled to the pay actually received" : "") + "; take-home is " + (recPay > 0 ? "what was logged as received" : "the plan's") +
      "; spending is logged transactions by their line's Needs or Wants. Other money in is rent, distributions, refunds and the rest logged as received." };
}

// ---------------- Budget vs actual, and year on year (v3.120.0) ----------------
// Every budget line against its plan, month by month: each cell the month's variance, shaded by how far
// over or under (heat −3..3). A line planned less often than monthly, or marked "no fixed timing", is
// lumpy month to month, so its months show what was spent unshaded and only its total is judged.
function heatOf(diff, plan){ var base = Math.max(20, Math.abs(plan)); var x = diff / base; return x > 0.5 ? 3 : x > 0.2 ? 2 : x > 0.05 ? 1 : x < -0.5 ? -3 : x < -0.2 ? -2 : x < -0.05 ? -1 : 0; }
export function budgetActualReport(opts){
  opts = opts || {};
  var today = opts.today || localDateStr();
  var win = opts.win || selectedYearWindow(today);
  var months = monthsOf(win, today);
  var lines = (opts.budgetLines || []).filter(function(l){ return l.id && !l.computed; });
  var byLine = {};
  (state.transactions || []).forEach(function(t){
    if(!t.linkedExpenseId || !t.date || t.date < win.start || t.date > win.end) return;
    var ym = t.date.slice(0, 7);
    var g = byLine[t.linkedExpenseId] = byLine[t.linkedExpenseId] || {};
    g[ym] = (g[ym] || 0) + (Number(t.amount) || 0);
  });
  var rows = lines.map(function(l){
    var monthly = periodsOf(Number(l.amount) || 0, l.freq).monthly;
    var lumpy = !!l.irregular || ["Quarterly", "Half-yearly", "Yearly"].indexOf(l.freq) !== -1;
    var cells = { line: l.what || "Line" }, heat = {}, actual = 0;
    months.forEach(function(ym){
      var a = (byLine[l.id] || {})[ym] || 0; actual += a;
      if(lumpy){ cells[ym] = r2(a); return; }
      cells[ym] = r2(a - monthly); heat[ym] = heatOf(a - monthly, monthly);
    });
    var plan = monthly * months.length;
    cells.actual = r2(actual); cells.plan = r2(plan); cells.diff = r2(actual - plan); heat.diff = heatOf(actual - plan, plan);
    return { cells: cells, heat: heat, lumpy: lumpy, abs: Math.abs(actual - plan) };
  }).filter(function(r){ return r.cells.actual || r.cells.plan; }).sort(function(a, b){ return b.abs - a.abs; });
  var tot = { line: "Total" }, ta = 0, tp = 0;
  rows.forEach(function(r){ ta += r.cells.actual; tp += r.cells.plan; });
  tot.actual = r2(ta); tot.plan = r2(tp); tot.diff = r2(ta - tp);
  rows.push({ cls: "total", cells: tot });
  return { key: "budget", frame: { range: true }, title: "Budget vs actual", subtitle: win.label + (today < win.end ? " so far" : ""),
    columns: [{ key: "line", label: "Line" }].concat(months.map(function(ym){ return { key: ym, label: ymLabel(ym), num: true }; }))
      .concat([{ key: "actual", label: "Spent", num: true }, { key: "plan", label: "Planned", num: true }, { key: "diff", label: "Over (−under)", num: true }]),
    rows: rows, wide: true, heat: true,
    note: "Each month: spent less planned, red over and green under. Lines billed quarterly or yearly, or with no fixed timing, show what was spent each month unshaded and are judged on their total. Biggest differences first." };
}

// The last 12 months against the 12 before, by the frame's grouping, and the merchants that moved most.
export function trendsReport(opts){
  opts = opts || {};
  var today = opts.today || localDateStr();
  var groupOf = opts.groupOf || opts.categoryOf || function(t){ return t.category || "Uncategorised"; };
  var t0 = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1);
  var iso = function(d){ return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  var curStart = iso(new Date(t0.getFullYear(), t0.getMonth() - 11, 1));
  var prevStart = iso(new Date(t0.getFullYear(), t0.getMonth() - 23, 1)), prevEnd = iso(new Date(t0.getFullYear(), t0.getMonth() - 11, 0));
  var cur = spendingByGroup(state.transactions, { start: curStart, end: today }, groupOf);
  var prev = spendingByGroup(state.transactions, { start: prevStart, end: prevEnd }, groupOf);
  var keys = Object.keys(Object.assign({}, cur, prev));
  // A percentage against a year that was barely logged (the app started part-way through it) is noise.
  var logged = {};
  (state.transactions || []).forEach(function(t){ if(t && t.date && t.date >= prevStart && t.date <= prevEnd) logged[t.date.slice(0, 7)] = true; });
  var prevMonths = Object.keys(logged).length, full = prevMonths >= 10;
  var pctOf = function(c){ return !full || c.pct == null ? null : Math.round(c.pct * 1000) / 10; };
  /** @type {any[]} */
  var rows = keys.map(function(k){
    var c = change(cur[k] || 0, prev[k] || 0);
    return { drill: null, cells: { cat: k, cur: r2(cur[k] || 0), prev: r2(prev[k] || 0), chg: c.diff, pct: pctOf(c) } };
  }).sort(function(a, b){ return b.cells.cur - a.cells.cur; });
  var hasPrev = Object.keys(prev).length > 0;
  var tc = keys.reduce(function(s, k){ return s + (cur[k] || 0); }, 0), tp = keys.reduce(function(s, k){ return s + (prev[k] || 0); }, 0);
  var tch = change(tc, tp);
  rows.push({ cls: "total", cells: { cat: "Total", cur: r2(tc), prev: r2(tp), chg: tch.diff, pct: pctOf(tch) } });
  return { key: "trends", frame: { group: true }, title: "Year on year" + (opts.groupLabel ? " by " + opts.groupLabel.toLowerCase() : ""), subtitle: "The last 12 months against the 12 before",
    columns: [{ key: "cat", label: "" }, { key: "cur", label: "Last 12 months", num: true }, { key: "prev", label: "The 12 before", num: true }, { key: "chg", label: "Change", num: true }, { key: "pct", label: "Change %", num: true, pct: true }],
    rows: rows,
    chart: { type: "bars", compareLabel: hasPrev ? "the 12 before" : null, items: rows.filter(function(r){ return !r.cls; }).slice(0, 12).map(function(r){ return { label: r.cells.cat, value: r.cells.cur, compare: hasPrev ? r.cells.prev : null }; }) },
    note: !hasPrev ? "Nothing logged in the 12 months before these yet, so there's nothing to compare against."
      : full ? "Logged spending. A category that's new to the app reads as a rise."
      : "Only " + prevMonths + " of the 12 months before were logged, so the change is shown in dollars but not as a percentage — it would mostly measure when logging began." };
}

// ---------------- Investments: returns, distributions, capital gains (v3.121.0) ----------------
function pct1(r){ return r == null ? null : Math.round(r * 1000) / 10; }
export function investReturnsReport(opts){
  opts = opts || {};
  var today = opts.today || localDateStr();
  var h = holdingReturns(state.assets, { today: today, toAud: toAudAmount, benchmark: state.benchmark });
  var row = function(r, cls){ return { cls: cls, cells: { name: r.name + (r.currency && r.currency !== "AUD" ? " (" + r.currency + ")" : ""), cost: r.cost, value: r.value, gain: r.gain, income: r.income, realised: r.realised, total: r.total,
    annual: pct1(r.annual), price: pct1(r.priceOnly), bench: pct1(r.bench), ahead: r.priceOnly != null && r.bench != null ? pct1(r.priceOnly - r.bench) : null } }; };
  var rows = h.rows.map(function(r){ return row(r); });
  if(rows.length) rows.push(row(Object.assign({ name: "Total", priceOnly: null }, h.total), "total"));
  var benchName = h.total.benchKind === "fixed" ? "a fixed " + pct1(h.fixedRate) + "% a year" : h.total.benchKind;
  return { key: "invest", title: "Investment returns", subtitle: "Each holding, against " + benchName,
    columns: [{ key: "name", label: "Holding" }, { key: "cost", label: "Cost", num: true }, { key: "value", label: "Value", num: true }, { key: "gain", label: "Unrealised", num: true },
      { key: "income", label: "Income", num: true }, { key: "realised", label: "Realised", num: true }, { key: "total", label: "Total return", num: true },
      { key: "annual", label: "A year, with income %", num: true, pct: true }, { key: "price", label: "A year, price %", num: true, pct: true },
      { key: "bench", label: "Benchmark %", num: true, pct: true }, { key: "ahead", label: "Ahead by", num: true, pct: true }],
    rows: rows, wide: true,
    chart: rows.length ? { type: "bars", compareLabel: null, items: h.rows.slice(0, 12).map(function(r){ return { label: r.name, value: r.total }; }) } : null,
    note: "Cost is what's still held, at its purchase price with brokerage. Income is distributions with their franking credits; realised is sales less their cost base. " +
      "The yearly returns are money-weighted — the rate that turns every buy, sale and (for the first) cash distribution into today's value. The benchmark is the same dollars on the same dates " +
      (h.total.benchKind === "fixed" ? "compounded at the fixed rate set on Investments → Performance (load the index's prices there to compare with " + (h.symbol || "an index") + " instead)" : "put into " + h.total.benchKind + ", price only") +
      ", so \"Ahead by\" compares it with the price-only rate. Holdings without purchase lots have no dates to go on and show no yearly rate. US holdings are converted at today's rate." };
}
export function distributionsReport(opts){
  var years = distributionYears(state.assets, toAudAmount);
  var rows = [];
  years.forEach(function(y){
    rows.push({ cls: "head", cells: { name: y.label, cash: y.cash, credit: y.credit, total: y.total } });
    y.holdings.forEach(function(h){ rows.push({ cls: "sub", cells: { name: h.name, cash: h.cash, credit: h.credit, total: h.total } }); });
  });
  var chrono = years.slice().reverse();
  return { key: "dividends", title: "Distributions and franking", subtitle: years.length ? "By financial year" : "",
    columns: [{ key: "name", label: "" }, { key: "cash", label: "Cash", num: true }, { key: "credit", label: "Franking credits", num: true }, { key: "total", label: "Total", num: true }],
    rows: rows,
    chart: years.length > 1 ? { type: "columns", series: ["Cash", "Franking credits"], items: chrono.map(function(y){ return { label: y.label, a: y.cash, b: y.credit }; }) } : null,
    note: "Distributions logged on each holding, by the date paid. Franking credits are income for tax too — the total is what goes on the return before any foreign income or capital gains in the annual statement." };
}
export function cgtReport(opts){
  opts = opts || {};
  var today = opts.today || localDateStr();
  var c = cgtParcels(state.assets, { today: today, toAud: toAudAmount });
  var units = function(u){ return String(Math.round(u * 10000) / 10000); };
  var day = function(d){ return fmtDate(d, { year: true }); };
  // The discount only ever applies to a gain.
  var discCell = function(p){ return p.gain == null || p.gain <= 0 ? "—" : p.discount ? "Yes" : "No"; };
  var rows = [];
  c.realised.forEach(function(y){
    rows.push({ cls: "head", cells: { name: "Sold in " + y.label } });
    y.parcels.forEach(function(p){ rows.push({ cells: { name: p.name, acquired: day(p.acquired), when: day(p.sold), units: units(p.units), amount: p.proceeds, cost: p.cost, gain: p.gain, disc: discCell(p), taxable: p.taxable } }); });
    rows.push({ cls: "total", cells: { name: "Net capital gain, " + y.label, gain: r2(y.net.gains - y.net.losses), taxable: y.net.net } });
    if(y.net.carriedLoss) rows.push({ cells: { name: "Loss carried forward", taxable: -y.net.carriedLoss } });
  });
  if(c.unrealised.length){
    rows.push({ cls: "head", cells: { name: "Still held — if sold today" } });
    c.unrealised.forEach(function(p){ rows.push({ cells: { name: p.name, acquired: day(p.acquired), when: p.discount ? "Now" : day(p.discountFrom), units: units(p.units), amount: p.value, cost: p.cost, gain: p.gain, disc: discCell(p), taxable: p.taxable } }); });
    var t = c.unrealised.reduce(function(s, p){ s.v += p.value || 0; s.c += p.cost; s.g += p.gain || 0; s.t += p.taxable || 0; return s; }, { v: 0, c: 0, g: 0, t: 0 });
    rows.push({ cls: "total", cells: { name: "Unrealised", amount: r2(t.v), cost: r2(t.c), gain: r2(t.g), taxable: r2(t.t) } });
  }
  return { key: "cgt", title: "Capital gains", subtitle: "Parcel by parcel, with the 12-month discount",
    columns: [{ key: "name", label: "Holding" }, { key: "acquired", label: "Bought" }, { key: "when", label: "Sold / discount from" }, { key: "units", label: "Units" },
      { key: "amount", label: "Proceeds / value", num: true }, { key: "cost", label: "Cost base", num: true }, { key: "gain", label: "Gain", num: true },
      { key: "disc", label: "Discount" }, { key: "taxable", label: "Taxable", num: true }],
    rows: rows, wide: true,
    note: "Parcels sold first-in, first-out unless a sale records its own. A parcel held over 12 months has half its gain taxed (individuals); losses come off undiscounted gains first. " +
      "The net capital gain is before any loss carried in from earlier years and leaves out gains in managed funds' annual statements. Still-held parcels are sorted by when their discount starts — waiting past that date halves the tax on a gain." };
}

// ---------------- Property returns, loans and debts, super (v3.122.0) ----------------
// The owners' marginal rate on a property's result: each owner's share at their rate, or an even
// split across the household when no ownership is recorded.
function ownersMarginalRate(p){
  var people = getTaxPeople(), rates = {};
  people.forEach(function(n){ try { rates[n] = Number(computePersonTax(n).marginalRate) || 0; } catch(e){ rates[n] = 0; } });
  var map = p.ownership || {}, keys = Object.keys(map);
  if(!keys.length) return people.length ? people.reduce(function(s, n){ return s + rates[n]; }, 0) / people.length : 0;
  return keys.reduce(function(s, n){ return s + (Number(map[n]) || 0) / 100 * (rates[n] || 0); }, 0);
}
export function propertyReturnsReport(opts){
  opts = opts || {};
  var today = opts.today || localDateStr();
  var ps = propertyReturns(state.properties, { today: today, rateOf: ownersMarginalRate });
  var cols = [{ key: "line", label: "" }].concat(ps.map(function(p){ return { key: p.id, label: p.name, num: true }; }));
  var pctRow = function(label, k){ var c = { line: label }; ps.forEach(function(p){ c[p.id] = p[k] == null ? null : Math.round(p[k] * 1000) / 10; }); return { cls: "pct", cells: c }; };
  var row = function(label, k, cls){ var c = { line: label }; ps.forEach(function(p){ c[p.id] = p[k]; }); return { cls: cls, cells: c }; };
  var ips = ps.some(function(p){ return p.ip; });
  /** @type {any[]} */
  var rows = [row("Value", "value"), row("Paid, with costs", "cost"), row("Loans", "loans"), row("Equity (with offsets)", "equity"), pctRow("Loan to value %", "lvr")];
  if(ips) rows = rows.concat([{ cls: "head", cells: { line: "A year at today's rates" } }, row("Rent", "rent"), row("Expenses", "expenses"),
    pctRow("Gross yield %", "grossYield"), pctRow("Net yield %", "netYield"),
    row("Cash after interest", "beforeRepay"), row("Cash after repayments", "afterRepay"), row("Tax effect", "taxEffect"), row("Cash after repayments and tax", "afterTax", "total")]);
  rows = rows.concat([{ cls: "head", cells: { line: "The last 12 months" } }, row("Value growth", "growth"), row("Equity growth", "equityGrowth"),
    row("Total return (growth, cash after interest, tax)", "totalReturn", "total"), pctRow("Growth a year since purchase %", "growthPa")]);
  var fys = {};
  ps.forEach(function(p){ p.years.forEach(function(y){ fys[y.fy] = y.label; }); });
  var fyKeys = Object.keys(fys).map(Number).sort();
  if(fyKeys.length > 1){
    rows.push({ cls: "head", cells: { line: "Value at 30 June" } });
    fyKeys.forEach(function(fy){
      var c = { line: fys[fy] };
      ps.forEach(function(p){ var y = p.years.find(function(x){ return x.fy === fy; }); c[p.id] = y ? y.value : null; });
      rows.push({ cells: c });
    });
  }
  return { key: "propreturns", title: "Property returns", subtitle: fmtDate(today, { year: true }), columns: cols, rows: ps.length ? rows : [], wide: ps.length > 3,
    note: "The year's figures are the plan at today's rent, expenses and rates. Cash after interest leaves the principal out — paying it down is saving, not a cost. " +
      "The tax effect is the property's deductible result (with depreciation) at its owners' marginal rates: a loss is tax back. " +
      "Growth uses the values you've logged; the latest 30 June is the value now if this year isn't over." };
}
export function debtsReport(opts){
  opts = opts || {};
  var today = opts.today || localDateStr();
  var d = debtSchedule(state.properties, state.debts, { today: today });
  /** @type {any[]} */
  var rows = d.rows.map(function(x){
    return { cells: { name: x.name, balance: x.balance, then: x.then, rate: x.rate == null ? "" : (Math.round(x.rate * 100) / 100) + "%", monthly: x.monthly,
      thisYear: x.interestThisYear, lastYear: x.interestLastYear, deductible: x.deductibleLastYear,
      payoff: x.interestOnly ? "Interest only" : x.payoff ? fmtDate(x.payoff, { year: true }).replace(/^\d+ /, "") : x.kind === "debt" ? "" : "Not at this rate" } };
  });
  if(rows.length > 1){
    var sum = function(k){ return r2(d.rows.reduce(function(s, x){ return s + (x[k] || 0); }, 0)); };
    var anyThen = d.rows.some(function(x){ return x.then != null; });
    rows.push({ cls: "total", cells: { name: "Total", balance: sum("balance"), then: anyThen ? r2(d.rows.reduce(function(s, x){ return s + (x.then != null ? x.then : x.balance); }, 0)) : null,
      monthly: sum("monthly"), thisYear: sum("interestThisYear"), lastYear: sum("interestLastYear"), deductible: sum("deductibleLastYear") } });
  }
  return { key: "debts", title: "Loans and debts", subtitle: fmtDate(today, { year: true }),
    columns: [{ key: "name", label: "" }, { key: "balance", label: "Owed now", num: true }, { key: "then", label: "A year ago", num: true }, { key: "rate", label: "Rate" },
      { key: "monthly", label: "Repayment a month", num: true }, { key: "thisYear", label: "Interest " + d.thisLabel + " so far", num: true },
      { key: "lastYear", label: "Interest " + d.lastLabel, num: true }, { key: "deductible", label: "Deductible " + d.lastLabel, num: true }, { key: "payoff", label: "Paid off" }],
    rows: rows, wide: true,
    note: "Interest is worked out from today's balance and offset across the rates each loan has recorded, so an earlier year is an estimate. " +
      "Deductible is the investment share of an investment property's loan. Paid off is at today's repayment and offset. A year ago uses the balances you've logged; a debt without a logged balance then is counted at today's in the total." };
}
export function superReport(opts){
  opts = opts || {};
  var today = opts.today || localDateStr();
  var fy = financialYearOf(today);
  var people = getTaxPeople();
  var rows = [];
  people.forEach(function(person){
    var accounts = (state.assets || []).filter(function(a){ return a.category === "Super" && (a.person || "") === person; });
    rows.push({ cls: "head", cells: { fy: person } });
    var balAt = function(at){ return accounts.reduce(function(s, a){ var v = valueOn(a.history, at); return v == null ? s : (s == null ? 0 : s) + v; }, null); };
    var unused = 0, lastBal = null;
    for(var y = fy - 5; y <= fy; y++){
      var end = fyWindow(y).end, at = end < today ? end : today;
      var bal = y === fy ? (accounts.reduce(function(s, a){ return s + (Number(a.amount) || 0); }, 0) || balAt(at)) : balAt(at);
      // Before the last finished year, only years the super was being tracked in — earlier than that
      // the tax model would just be today's plan replayed.
      if(y < fy - 1 && bal == null) continue;
      var c = superContributions(y).find(function(x){ return x.person === person; });
      if(!c) continue;
      if(y < fy) unused += c.room; else lastBal = balAt(fyWindow(y - 1).end);
      rows.push({ cells: { fy: fyWindow(y).label + (y === fy ? " (planned)" : ""), sg: c.sg, other: c.other, total: c.total, cap: c.cap, room: c.over ? -c.over : c.room, balance: bal } });
    }
    rows.push({ cls: "total", cells: { fy: "Unused in the earlier years shown", room: lastBal != null && lastBal >= 500000 ? null : r2(unused) } });
  });
  return { key: "super", title: "Super", subtitle: "Concessional contributions against the cap, and balances", wide: true,
    columns: [{ key: "fy", label: "" }, { key: "sg", label: "Employer", num: true }, { key: "other", label: "Salary sacrifice and personal", num: true }, { key: "total", label: "Concessional", num: true },
      { key: "cap", label: "Cap", num: true }, { key: "room", label: "Room left (−over)", num: true }, { key: "balance", label: "Balance at 30 June", num: true }],
    rows: rows,
    note: "Contributions are the tax model's for each year: the plan with whatever pay was logged as received. Years before the last finished one show only while their balance was being tracked. " +
      "The cap includes any carry-forward set on the Tax page. Unused cap from the five years before can be carried forward while the total super balance was under $500,000 on the 30 June before — the last row adds up the unused room in the years shown (blank when the balance was over). " +
      "Balances are the last value logged on or before each 30 June; this year's is today's." };
}

// ---------------- Lender pack and year in review (v3.123.0) ----------------
// What a broker asks for before a refinance or a purchase, on one page: the last 12 months' income
// and spending, the commitments, and what's owned and owed today.
export function lenderPackReport(opts){
  opts = opts || {};
  var today = opts.today || localDateStr();
  var t = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1);
  var from = new Date(t.getFullYear(), t.getMonth() - 12, 1), to = new Date(t.getFullYear(), t.getMonth(), 0);
  var iso = function(d){ return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  var win = { start: iso(from), end: iso(to) }; // the last 12 whole months
  var classOf = opts.classOf || function(){ return "Other"; };
  var rows = [], row = function(item, year, month, cls){ rows.push({ cls: cls, cells: { item: item, year: year == null ? null : r2(year), month: month == null ? null : r2(month) } }); };
  rows.push({ cls: "head", cells: { item: "Income" } });
  getTaxPeople().forEach(function(person){
    var gross = (state.income || []).filter(function(i){ return i.incomeType === "Gross" && i.person === person && !i.computed; })
      .reduce(function(s, i){ return s + periodsOf(Number(i.amount) || 0, i.freq).yearly; }, 0);
    if(gross) row(person + " — salary before tax (plan)", gross, gross / 12);
  });
  var labels = {}, got = {};
  try { incomeTargets().forEach(function(x){ labels[x.key] = x.label; }); } catch(e){}
  (state.incomeLog || []).forEach(function(r){ if(r.date >= win.start && r.date <= win.end){ var k = r.target || "other"; got[k] = (got[k] || 0) + (Number(r.amount) || 0); } });
  var tin = 0;
  Object.keys(got).sort(function(a, b){ return got[b] - got[a]; }).forEach(function(k){ tin += got[k]; row((labels[k] || (inKind(k) === "rent" ? "Rent" : "Other income")) + " — received", got[k], got[k] / 12); });
  row("Received in the 12 months", tin, tin / 12, "total");
  rows.push({ cls: "head", cells: { item: "Spending" } });
  var sp = { Needs: 0, Wants: 0, Other: 0 };
  (state.transactions || []).forEach(function(x){ if(x.date >= win.start && x.date <= win.end) sp[classKey(classOf(x))] += Number(x.amount) || 0; });
  row("Essentials (needs)", sp.Needs, sp.Needs / 12); row("Discretionary (wants)", sp.Wants, sp.Wants / 12);
  if(sp.Other) row("Other spending", sp.Other, sp.Other / 12);
  var spent = sp.Needs + sp.Wants + sp.Other;
  row("Living expenses", spent, spent / 12, "total");
  rows.push({ cls: "head", cells: { item: "Commitments" } });
  var commit = 0;
  (state.properties || []).forEach(function(p){ (p.loans || []).forEach(function(l, i){ var m = loanRepaymentMonthly(l); if(!m) return; commit += m; row((p.what || "Property") + ((p.loans || []).length > 1 ? " — loan " + (i + 1) : "") + " repayment", m * 12, m); }); });
  row("Loan repayments", commit * 12, commit, "total");
  rows.push({ cls: "head", cells: { item: "Assets today" } });
  var assets = 0, owed = 0, byCat = {};
  (state.assets || []).forEach(function(a){ var c = a.category || "Other"; byCat[c] = (byCat[c] || 0) + toAudAmount(a, Number(a.amount) || 0); });
  Object.keys(byCat).sort().forEach(function(c){ if(!byCat[c]) return; assets += byCat[c]; row(c, byCat[c], null); });
  (state.properties || []).forEach(function(p){ assets += Number(p.value) || 0; row(p.what || "Property", Number(p.value) || 0, null); });
  var offsets = (state.properties || []).reduce(function(s, p){ return s + (p.loans || []).reduce(function(ss, l){ return ss + Math.min(Number(l.offsetBalance) || 0, loanBalance(l)); }, 0); }, 0);
  if(offsets){ assets += offsets; row("Offset accounts", offsets, null); }
  row("Total assets", assets, null, "total");
  rows.push({ cls: "head", cells: { item: "Liabilities today" } });
  (state.properties || []).forEach(function(p){ (p.loans || []).forEach(function(l, i){ var b = loanBalance(l); if(b){ owed += b; row((p.what || "Property") + ((p.loans || []).length > 1 ? " — loan " + (i + 1) : "") + " loan", b, null); } }); });
  (state.debts || []).forEach(function(d){ if(Number(d.balance)){ owed += Number(d.balance); row(d.what || "Debt", Number(d.balance), null); } });
  row("Total liabilities", owed, null, "total");
  row("Net position", assets - owed, null, "total");
  return { key: "lender", title: "Lender pack", subtitle: "12 months to " + fmtDate(win.end, { year: true }) + " · balances at " + fmtDate(today, { year: true }),
    columns: [{ key: "item", label: "" }, { key: "year", label: "12 months / balance", num: true }, { key: "month", label: "A month", num: true }], rows: rows,
    note: "Income received and spending are what's been logged in the last 12 whole months; salary before tax is the plan. Living expenses leave out loan repayments, which are listed as commitments. " +
      "Card limits aren't recorded here — a lender will ask for them. Balances are the latest you've logged." };
}

// The last finished financial year in a few sentences, and the figures behind them.
export function yearInReviewReport(opts){
  opts = opts || {};
  var today = opts.today || localDateStr();
  var fy = financialYearOf(today) - 1;
  var hw = opts.yearWin;
  if(hw && hw.end < today) fy = financialYearOf(hw.start);
  var w = fyWindow(fy), pw = fyWindow(fy - 1);
  var money = function(v){ return (v < 0 ? "−" : "") + "$" + Math.round(Math.abs(v)).toLocaleString("en-AU"); };
  var story = [], rows = [], row = function(item, v, prev, cls){ rows.push({ cls: cls, cells: { item: item, v: v == null ? null : r2(v), prev: prev == null ? null : r2(prev), chg: v == null || prev == null ? null : r2(v - prev) } }); };
  var dayBefore = function(iso){ var d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) - 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  var a = netWorthOn(dayBefore(w.start), today), b = netWorthOn(w.end, today);
  if(!a.partial.length && !b.partial.length){
    story.push("Net worth went from " + money(a.total) + " to " + money(b.total) + " — " + (b.total >= a.total ? "up " : "down ") + money(Math.abs(b.total - a.total)) + ".");
    row("Net worth at 30 June", b.total, a.total, "total");
  } else if(!b.partial.length) row("Net worth at 30 June", b.total, null, "total");
  var sumIn = function(win){ return (state.incomeLog || []).reduce(function(s, r){ return r.date >= win.start && r.date <= win.end ? s + (Number(r.amount) || 0) : s; }, 0); };
  var sumOut = function(win){ return (state.transactions || []).reduce(function(s, t){ return t.date >= win.start && t.date <= win.end ? s + (Number(t.amount) || 0) : s; }, 0); };
  var tin = sumIn(w), tout = sumOut(w), pin = sumIn(pw), pout = sumOut(pw);
  if(tin || tout){
    story.push(money(tin) + " came in and " + money(tout) + " was spent" + (tin > 0 ? ", so " + Math.round((tin - tout) / tin * 100) + "% of what came in was kept" : "") + ".");
    row("Money in", tin, pin || null); row("Spent", tout, pout || null); row("Kept", tin - tout, pin || pout ? pin - pout : null, "total");
  }
  var groupOf = opts.categoryOf || function(t){ return t.category || "Uncategorised"; };
  var cur = spendingByGroup(state.transactions, w, groupOf), prev = spendingByGroup(state.transactions, pw, groupOf);
  var top = Object.keys(cur).sort(function(x, y){ return cur[y] - cur[x]; }).slice(0, 3);
  var said = top.map(function(k){ return k.toLowerCase() + " (" + money(cur[k]) + ")"; });
  if(said.length) story.push("The most went on " + (said.length > 1 ? said.slice(0, -1).join(", ") + " and " + said[said.length - 1] : said[0]) + ".");
  var prevMonths = {};
  (state.transactions || []).forEach(function(t){ if(t.date >= pw.start && t.date <= pw.end) prevMonths[t.date.slice(0, 7)] = true; });
  if(Object.keys(prevMonths).length >= 10){
    var moves = Object.keys(cur).map(function(k){ return { k: k, d: cur[k] - (prev[k] || 0) }; }).filter(function(m){ return prev[m.k] > 0; }).sort(function(x, y){ return y.d - x.d; });
    if(moves.length && moves[0].d > 200) story.push("The biggest rise on the year before was " + moves[0].k.toLowerCase() + ", up " + money(moves[0].d) + (moves.length > 1 && moves[moves.length - 1].d < -200 ? "; the biggest fall " + moves[moves.length - 1].k.toLowerCase() + ", down " + money(-moves[moves.length - 1].d) : "") + ".");
  }
  var dist = distributionYears(state.assets, toAudAmount).find(function(y){ return y.fy === fy; });
  if(dist){ story.push("Investments paid " + money(dist.cash) + " in distributions" + (dist.credit ? " with " + money(dist.credit) + " of franking credits" : "") + "."); row("Distributions with franking", dist.total, null); }
  var cg = cgtParcels(state.assets, { today: today, toAud: toAudAmount }).realised.find(function(y){ return y.fy === fy; });
  if(cg){ story.push("Shares sold made a net capital gain of " + money(cg.net.net) + " after the discount."); row("Net capital gain", cg.net.net, null); }
  var sup = superContributions(fy).filter(function(c){ return c.total > 0; });
  if(sup.length){ story.push("Concessional super: " + sup.map(function(c){ return c.person + " " + money(c.total) + (c.room > 0 ? " (" + money(c.room) + " of the cap unused)" : c.over > 0 ? " (" + money(c.over) + " over the cap)" : "") ; }).join(", ") + "."); }
  (state.properties || []).forEach(function(p){
    var s = valueOn(p.history, dayBefore(w.start)), e = valueOn(p.history, w.end);
    if(s != null && e != null && s !== e){ story.push((p.what || "The property") + " was valued " + (e > s ? "up " : "down ") + money(Math.abs(e - s)) + " over the year, to " + money(e) + "."); row((p.what || "Property") + " value", e, s); }
    (p.loans || []).forEach(function(l){
      var ls = valueOn(l.balanceHistory, dayBefore(w.start)), le = valueOn(l.balanceHistory, w.end);
      if(ls != null && le != null && ls > le) story.push("Its loan came down " + money(ls - le) + ", to " + money(le) + ".");
    });
  });
  if(!story.length) story.push("Nothing was logged in " + w.label + " to look back on yet.");
  return { key: "review", title: "Year in review", subtitle: w.label + " · 1 July " + fy + " to 30 June " + (fy + 1), narrative: story,
    columns: [{ key: "item", label: "" }, { key: "v", label: w.label, num: true }, { key: "prev", label: pw.label, num: true }, { key: "chg", label: "Change", num: true }], rows: rows,
    note: "From what's been logged. The year before shows only where it was logged too. Pick a finished year in the header to look back on that one." };
}

export function buildReport(key, opts){
  if(key === "lender") return lenderPackReport(opts);
  if(key === "review") return yearInReviewReport(opts);
  if(key === "propreturns") return propertyReturnsReport(opts);
  if(key === "debts") return debtsReport(opts);
  if(key === "super") return superReport(opts);
  if(key === "invest") return investReturnsReport(opts);
  if(key === "dividends") return distributionsReport(opts);
  if(key === "cgt") return cgtReport(opts);
  if(key === "budget") return budgetActualReport(opts);
  if(key === "trends") return trendsReport(opts);
  if(key === "income") return incomeStatementReport(opts);
  if(key === "flow") return moneyFlowReport(opts);
  if(key === "nwcheck") return netWorthCheckReport(opts);
  if(key === "categories") return categoryReport(opts);
  if(key === "networth") return netWorthReport(opts);
  if(key === "property") return propertyReport();
  if(key === "tax") return taxReport(opts);
  return cashflowReport(opts);
}
export function reportCsvRows(rep){
  return { headers: rep.columns.map(function(c){ return c.label || c.key; }),
    rows: rep.rows.map(function(r){ return rep.columns.map(function(c){ var v = r.cells[c.key]; return v == null ? "" : v; }); }) };
}
