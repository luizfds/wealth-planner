import { state } from "../state.js";
import { selectedYearWindow } from "./ledger.js";
import { getTaxPeople, computePersonTax, currentTaxFy } from "./tax.js";
import { totalNetWorthValue, totalDebtsValue, toAudAmount } from "./engine.js";
import { ipProperties, propertyTaxResultBreakdown, propertiesTotalValue, propertiesTotalMortgageBalance, propertiesOffsetTotal, fyLabel } from "./property.js";
import { localDateStr, fmtDate } from "../lib/format.js";
import { netWorthOn, shiftDate } from "./nwhistory.js";
import { netWorthChecks } from "./nwcheck.js";
import { monthsIn, spendingByGroup, change } from "./reportframe.js";
import { incomeTargets } from "./received.js";
import { periodsOf } from "./ledger.js";

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

export var REPORTS = [
  { key: "cashflow", label: "Monthly cash flow" },
  { key: "categories", label: "Spending" },
  { key: "income", label: "Income statement" },
  { key: "flow", label: "Where the money goes" },
  { key: "networth", label: "Net worth statement" },
  { key: "property", label: "Property P&L" },
  { key: "tax", label: "Tax summary" },
  { key: "month", label: "Month in detail" },
  { key: "nwcheck", label: "Net worth check" },
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
  var gross = 0, sg = 0, sac = 0, tax = 0, planTake = 0;
  getTaxPeople().forEach(function(p){
    try { var r = computePersonTax(p); gross += r.gross || 0; sg += r.sg || 0; sac += r.sacrifice || 0; tax += (r.totalTax || 0) + (r.helpRepayment || 0); planTake += r.netTakeHome || 0; } catch(e){}
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
    if(!(src[1] > 0.5) || !(useTotal > 0)) return;
    uses.forEach(function(u){ links.push({ from: src[0], to: u.id, value: src[1] * u.value / useTotal }); });
  });
  links = links.filter(function(l){ return l.value > 0.5; });
  var rows = nodes.map(function(n){ return { cls: n.id === "pay" || n.id === "take" || n.id === "kept" ? "total" : "", cells: { line: n.label, value: r2(n.value) } }; });
  return { key: "flow", frame: { range: true }, title: "Where the money goes", subtitle: win.label + (today < win.end ? " so far" : ""),
    chart: { type: "sankey", nodes: nodes, links: links }, columns: [{ key: "line", label: "" }, { key: "value", label: "Amount", num: true }], rows: rows,
    note: "Tax and super are the plan's for these months" + (recPay > 0 ? ", scaled to the pay actually received" : "") + "; take-home is " + (recPay > 0 ? "what was logged as received" : "the plan's") +
      "; spending is logged transactions by their line's Needs or Wants. Other money in is rent, distributions, refunds and the rest logged as received." };
}

export function buildReport(key, opts){
  if(key === "income") return incomeStatementReport(opts);
  if(key === "flow") return moneyFlowReport(opts);
  if(key === "nwcheck") return netWorthCheckReport(opts);
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
