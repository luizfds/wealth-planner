import { isSimple } from "../lib/mode.js";
import { canShareCsv } from "../lib/backup.js";
import { state } from "../state.js";
import { planningReadiness, reportDisclosure, reportDisclosureRows } from "../calc/planningreadiness.js";
import { partOn } from "../calc/parts.js";
import { REPORTS, REPORT_GROUPS, buildReport, reportCsvRows } from "../calc/reports.js";
import { getTaxPeople } from "../calc/tax.js";
import { transactionCategory, transactionAccount, budgetLineItems } from "./expenses.js";
import { RANGES, COMPARES, GROUPS, rangeWindow, compareWindow, monthsIn } from "../calc/reportframe.js";
import { selectedYearWindow, periodsOf, transactionDisplayName } from "../calc/ledger.js";
import { reportChartHtml, fitReportCharts } from "../lib/reportcharts.js";
import { fmtCurrency2, fmtDate, localDateStr } from "../lib/format.js";
import { yearEndHtml } from "./yearend.js";
import { monthDetailHtml } from "./monthdetail.js";
import { fmtCurrency0 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { keepUi } from "../lib/keepui.js";
import { emptyStateHtml } from "../lib/empty.js";
import { nextYearPlanHtml } from "./nextyearplan.js";

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
function frameControlsHtml(rep, opts){
  var fr = rep.frame || {};
  if(!fr.range) return "";
  var sel = function(attr, list, value){ return '<select class="field-control" data-rf="' + attr + '">' + list.map(function(x){ return '<option value="' + x.key + '"' + (x.key === value ? " selected" : "") + '>' + escapeAttr(x.label) + '</option>'; }).join("") + '</select>'; };
  return '<div class="rf-bar">' +
    '<label class="cf-filter"><span>Report dates</span>' + sel("range", RANGES.map(function(r){ return r.key === 'period' ? {key:r.key, label:'Selected year · ' + (opts.yearWin || selectedYearWindow(opts.today)).label} : r; }), reportFrame.range) + '</label>' +
    (reportFrame.range === "custom" ? '<label class="cf-filter"><span>From</span><input class="field-control" type="date" data-rf="from" value="' + escapeAttr(reportFrame.from) + '"></label><label class="cf-filter"><span>To</span><input class="field-control" type="date" data-rf="to" value="' + escapeAttr(reportFrame.to) + '"></label>' : '') +
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
      (reportFrame.group === "category" ? '<button type="button" class="btn btn-ghost btn-sm" data-sv data-sv-direction="out" data-sv-category="' + escapeAttr(k) + '" data-sv-from="' + escapeAttr(opts.win.start) + '" data-sv-to="' + escapeAttr(opts.win.end) + '">Show in Transactions</button>' : '') +
      '<button type="button" class="btn btn-ghost btn-sm" data-rf-drill="' + escapeAttr(k) + '">Close</button></div>' +
      '<table class="rp-table rp-drill-table"><tbody>' + tx.slice(0, 60).map(function(t){
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
// Phone priorities refer to builder column keys, keeping calculation and export data unchanged.
var SUMMARY_KEYS = {
  cashflow: ['in','out','net'], categories: ['total','cmp','chg','avg'], income: ['total','plan'],
  flow: ['value'], budget: ['actual','plan','diff'], trends: ['cur','prev','chg'],
  networth: ['now','month','year'], nwcheck: ['expected','actual','gap'],
  invest: ['value','total','annual'], dividends: ['cash','credit','total'], cgt: ['gain','taxable'],
  debts: ['balance','monthly','payoff'], super: ['total','room','balance'],
  taxpack: ['value','source'], review: ['v','prev','chg'], lender: ['year','month']
};
export var reportDisplay = { fullTable: false, entity: {} };
function reportValue(r, c){
  var v = r.cells[c.key];
  return (r.cls === 'pct' || c.pct) && c.num ? pctCell(v) : cell(v, c.num);
}
function reportRowName(r, c){
  var name = reportValue(r, c);
  return r.ym ? '<button type="button" class="rp-month-link" data-md-open="' + escapeAttr(r.ym) + '">' + name + '</button>'
    : r.drill ? '<button type="button" class="rp-month-link" data-rf-drill="' + escapeAttr(r.drill) + '" aria-expanded="' + !!reportFrame.open[r.drill] + '">' + name + '</button>' : name;
}
function summaryFields(r, columns){
  return '<dl class="rp-summary-fields">' + columns.map(function(c){
    var v = r.cells[c.key];
    return '<div data-report-field="' + escapeAttr(c.key) + '"><dt>' + escapeAttr(c.label || 'Item') + '</dt><dd' + (c.num ? ' class="rp-figure' + (typeof v === 'number' && v < 0 ? ' neg' : '') + '"' : '') + '>' + (reportValue(r, c) || '—') + '</dd></div>';
  }).join('') + '</dl>';
}
export function reportSummaryHtml(rep){
  if(!rep.rows.length) return '<p class="ledger-note">Nothing to report yet for this one.</p>';
  var entities = ['property','propreturns','tax'].includes(rep.key) ? rep.columns.slice(1) : null;
  var selected = entities && (entities.find(function(c){ return c.key === reportDisplay.entity[rep.key]; }) || entities[0]);
  var priorities = SUMMARY_KEYS[rep.key] || [];
  var primary = selected ? [selected] : priorities.map(function(key){ return rep.columns.find(function(c){ return c.key === key; }); }).filter(Boolean).slice(0, 3);
  var remaining = selected ? [] : rep.columns.slice(1).filter(function(c){ return !primary.includes(c); });
  var selector = entities ? '<label class="rp-entity"><span>' + (rep.key === 'tax' ? 'Person' : 'Property') + '</span><select class="field-control" data-report-entity>' + entities.map(function(c){ return '<option value="' + escapeAttr(c.key) + '"' + (selected && selected.key === c.key ? ' selected' : '') + '>' + escapeAttr(c.label) + '</option>'; }).join('') + '</select></label>' : '';
  return '<div data-report-summary="' + escapeAttr(rep.key) + '">' + selector + '<div class="rp-summary-rows">' + rep.rows.map(function(r, index){
    var title = reportRowName(r, rep.columns[0]);
    var headingOnly = r.cls === 'head' && rep.columns.slice(1).every(function(c){ return r.cells[c.key] == null || r.cells[c.key] === ''; });
    return '<section data-report-summary-row="' + escapeAttr(String(r.cells[rep.columns[0].key]) + '/' + index) + '" class="rp-summary-row' + (r.cls === 'total' ? ' rp-summary-total' : '') + '"><h3>' + title + '</h3>' + (headingOnly ? '' : summaryFields(r, primary) +
      (remaining.length ? '<details class="rp-row-details"><summary>Details<span class="visually-hidden"> for ' + reportValue(r, rep.columns[0]) + '</span></summary>' + summaryFields(r, remaining) + '</details>' : '')) + '</section>';
  }).join('') + '</div></div>';
}
export function reportPresentationHtml(rep){
  if(!rep.rows.length) return reportTableHtml(rep);
  return '<div class="rp-presentation" data-full-table="' + reportDisplay.fullTable + '"><label class="rp-display-control"><input type="checkbox" data-report-full-table' + (reportDisplay.fullTable ? ' checked' : '') + '> Full table <span class="rp-table-instruction">— scroll horizontally to compare columns</span></label>' +
    '<div class="rp-mobile-summary">' + reportSummaryHtml(rep) + '</div><div class="rp-comparison-table">' + reportTableHtml(rep) + '</div></div>';
}
export function reportTableHtml(rep){
  if(!rep.rows.length) return '<p class="ledger-note" style="margin:0">Nothing to report yet for this one.</p>';
  return '<div class="rp-scroll" role="region" aria-label="' + escapeAttr((rep.title || 'Report') + '; scroll horizontally for more columns') + '" tabindex="0"><table class="rp-table' + (rep.wide ? " rp-wide" : "") + '"><thead><tr>' + rep.columns.map(function(c){ return '<th' + (c.num ? ' class="num"' : '') + ' scope="col">' + escapeAttr(c.label || 'Item') + '</th>'; }).join("") + '</tr></thead><tbody>' +
    rep.rows.map(function(r){
      return '<tr' + (r.cls ? ' class="' + r.cls + '"' : '') + '>' + rep.columns.map(function(c, i){
        var v = r.cells[c.key];
        // v3.81.0: a month row opens Month in detail; v3.118.0: a group row opens its transactions.
        var inner = i === 0 ? reportRowName(r, c) : reportValue(r, c);
        // v3.120.0: a heat-map cell (Budget vs actual) carries its shade.
        var heat = r.heat && r.heat[c.key] ? " heat" + (r.heat[c.key] > 0 ? "-p" : "-n") + Math.abs(r.heat[c.key]) : "";
        return (i === 0 ? '<th scope="row">' : '<td' + (c.num ? ' class="num' + (typeof v === "number" && v < 0 ? " neg" : "") + heat + '"' : '') + '>') + inner + (i === 0 ? '</th>' : '</td>');
      }).join("") + '</tr>';
    }).join("") + '</tbody></table></div>';
}
// #396: the guided Year in review — one section per question, its verdict and where it's acted on (calc/yearreview.js).
// A section without enough data is an empty state that says what fills it. In print, no buttons.
var TONE = { good: "On track", warn: "Worth acting on", info: "Worth a look" };
// extra: markup after the last section (#399's next year's plan, on screen only).
export function yearReviewSectionsHtml(sections, print, extra){
  return '<div class="yr-sections">' + sections.map(function(x){
    var body;
    if(x.tone === "empty") body = print ? '<p>' + escapeAttr(x.empty) + '</p>' : emptyStateHtml(x.empty, { go: x.go, label: x.label, className: "yr-empty" });
    else body = '<p class="yr-verdict">' + escapeAttr(x.verdict) + '</p>' + (x.detail ? '<p class="yr-detail">' + escapeAttr(x.detail) + '</p>' : '') +
      reconcileHtml(x.reconcile, print) +
      offsetCompareHtml(x.offsetCompare, print) +
      (x.links ? '<ul class="yr-links">' + x.links.map(function(l){ return '<li><a href="' + escapeAttr(l.url) + '" target="_blank" rel="noopener noreferrer">' + escapeAttr(l.label) + '</a> — ' + escapeAttr(l.detail) + '</li>'; }).join("") + '</ul>' : '') +
      (!print && x.go ? '<button type="button" class="link-btn yr-go" data-go="' + escapeAttr(x.go) + '">' + escapeAttr(x.label) + '</button>' : '');
    return '<section class="yr-section yr-' + escapeAttr(x.tone) + '" data-yr-section="' + escapeAttr(x.key) + '" aria-labelledby="yr-' + escapeAttr(x.key) + '">' +
      '<h3 id="yr-' + escapeAttr(x.key) + '">' + escapeAttr(x.title) + (TONE[x.tone] ? ' <span class="yr-tone">' + TONE[x.tone] + '</span>' : '') + '</h3>' + body + '</section>';
  }).join("") + (extra || "") + '</div>';
}
// #397: how the year adds up — money in, spending, kept, and where the kept money went (calc/reconcile.js). Folded in
// the money section on screen; open in print.
function signed(v){ return (v < 0 ? "−" : v > 0 ? "+" : "") + fmtCurrency0.format(Math.abs(v)); }
export function reconcileHtml(r, print){
  if(!r) return "";
  var line = function(label, v, cls){ return '<div' + (cls ? ' class="' + cls + '"' : '') + '><dt>' + escapeAttr(label) + '</dt><dd>' + escapeAttr(v) + '</dd></div>'; };
  var spendBits = [["Needs", r.spending.needs], ["Wants", r.spending.wants], ["Other", r.spending.other]].filter(function(x){ return x[1]; })
    .map(function(x){ return x[0] + " " + fmtCurrency0.format(x[1]); }).join(" · ");
  var gap = r.unaccounted, big = Math.abs(gap) >= Math.max(500, Math.abs(r.kept) * 0.05);
  var body = '<dl class="yr-recon-lines">' +
      line("Money in", fmtCurrency0.format(r.moneyIn)) +
      line("Spending" + (spendBits ? " (" + spendBits + ")" : ""), "−" + fmtCurrency0.format(r.spending.total)) +
      (r.interest && r.interest.total ? line("Loan interest and fees" + (r.interest.charged && r.interest.modelled ? " (charged, and worked out where no statement was imported)" : r.interest.charged ? " (as the bank charged)" : " (worked out from the loans)"), "−" + fmtCurrency0.format(r.interest.total)) : "") +
      line("Kept", signed(r.kept), "yr-recon-total") +
    '</dl><p class="yr-recon-sub">Where the kept money went, from balances at each end of the year:</p><dl class="yr-recon-lines">' +
      r.moves.map(function(m){ return line(m.label, signed(m.amount)); }).join("") +
      line("Unaccounted", signed(gap), "yr-recon-total" + (big ? " yr-recon-gap" : "")) +
    '</dl>' +
    '<p class="yr-detail">' + (big ? "Unaccounted is money the recorded balances don't show — usually a balance not recorded near the start or end of the year, a car or property bought, or spending that wasn't logged." : "The recorded balances account for what was kept, within rounding.") +
      (r.interest && r.interest.repaymentsAsSpending ? " Loan repayments are logged as spending here, so their interest is already in Spending and isn't taken off again." : "") +
      " Moving money between your own accounts changes none of these totals, so nothing is counted twice. Super (paid before tax), a car's or property's value, and share prices moving aren't money in or out, and are left out.</p>" +
    (r.complete ? '<p class="yr-detail">Every month has something logged, and every balance was recorded near both ends of the year.</p>'
      : '<div class="yr-missing"><p class="yr-recon-sub">Missing, so the figures above are incomplete:</p><ul>' +
          r.missing.balances.map(function(t){ return "<li>" + escapeAttr(t) + "</li>"; }).join("") +
          (r.missing.months.length ? "<li>Nothing logged in " + escapeAttr(r.missing.months.map(function(m){ return m.label; }).join(", ")) + "</li>" : "") +
        "</ul></div>");
  return print ? '<div class="yr-recon"><p class="yr-recon-sub"><b>How it adds up</b></p>' + body + '</div>'
    : '<details class="yr-recon"><summary>How it adds up</summary>' + body + '</details>';
}
// #398: savings account vs offset, under the emergency fund (calc/savingsoffset.js).
function pct(n){ return (Math.round(n * 100) / 100) + "%"; }
export function offsetCompareHtml(c, print){
  if(!c || !c.best) return "";
  var b = c.best, out = '<div class="yr-offset"><p class="yr-recon-sub"><b>Savings account or offset?</b></p>';
  out += '<p class="yr-detail">' + escapeAttr("Cash in " + b.name + "'s offset saves " + pct(b.effective) + " a year" +
    (b.deductible ? " after tax — " + b.name + " is an investment loan, so its interest would have been claimed back (" + pct(b.rate) + " before tax)." : " — the loan's full rate, since home loan interest isn't deductible.")) + '</p>';
  if(c.lines.length) out += '<ul class="yr-links">' + c.lines.map(function(l){
    var acc = c.accounts.find(function(a){ return a.name === l.name; }) || {};
    return '<li>' + escapeAttr(l.name + " (" + fmtCurrency0.format(l.balance) + ") earns " + pct(acc.rate) + ", " + pct(acc.afterTax) + " after " + (acc.holder ? acc.holder + "'s" : "the household's") + " tax: about " +
      fmtCurrency0.format(l.savingsYearly) + " a year. In the offset it would save about " + fmtCurrency0.format(l.offsetYearly) + " — " +
      (Math.abs(l.gain) < 1 ? "about the same." : fmtCurrency0.format(Math.abs(l.gain)) + " a year " + (l.gain > 0 ? "more" : "less") + ".")) + '</li>';
  }).join("") + '</ul>';
  if(c.missing.length){
    var text = "No interest rate on " + c.missing.join(", ") + ", so " + (c.missing.length === 1 ? "it isn't" : "they aren't") + " compared. Add it on Investments → Cash.";
    out += print ? '<p class="yr-detail">' + escapeAttr(text) + '</p>' : emptyStateHtml(text, { go: "assets/Cash", label: "Go to Cash →", className: "yr-empty" });
  }
  return out + '<p class="yr-detail">Estimates. Access, bonus-rate conditions and fees differ by account, and money in an offset is only as reachable as the account allows. Redraw isn\'t counted as cash. Nothing here is looked up — the rates are the ones you entered.</p></div>';
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
export var reportRecent = [];
export function rememberReport(key){ reportRecent = [key].concat(reportRecent.filter(function(k){ return k !== key; })).slice(0, 4); }
export var REPORT_DESCRIPTIONS = {
  cashflow: "Logged money in, spending and the running balance by month.",
  categories: "Spending by category, person, account or merchant, with comparisons.",
  income: "Income and expenses over the selected period.",
  flow: "Where received income goes, including saving and transfers.",
  budget: "Planned amounts against actual spending.",
  trends: "The last twelve months compared with the twelve before.",
  month: "One month’s spending, income and transactions in detail.",
  networth: "Assets and debts that make up today’s net worth.",
  nwcheck: "How saved net-worth balances changed over the last year.",
  invest: "Each holding’s return compared with a benchmark.",
  dividends: "Distributions and franking credits by financial year.",
  cgt: "Capital gains by purchase parcel, including the twelve-month discount.",
  propreturns: "Property growth, equity and returns on your investment.",
  property: "A year of rent, costs and cash flow at today’s rates.",
  debts: "Loan balances, repayments and payoff schedules.",
  super: "Fund balances and concessional contributions against each person’s cap.",
  tax: "Each person’s estimated tax for the financial year.",
  taxpack: "Rental tax schedules with the source of each figure.",
  review: "A financial-year recap of income, spending and net worth.",
  lender: "Income, spending, assets and debts gathered for a lender.",
  yearend: "A checklist and documents for finishing the financial year."
};
function availableReports(){ return REPORTS.filter(function(r){ return !r.part || partOn(r.part, state); }); }
function pinsHtml(limit, query){
  var text = (query || '').trim().toLowerCase();
  var pins = (state.savedReports || []).filter(function(r){ return !text || r.name.toLowerCase().includes(text); });
  if(limit) pins = pins.slice(0, limit);
  return pins.length ? '<div class="rp-group rp-pins"><span class="rp-group-label">Pinned</span><div class="rp-chips">' + pins.map(function(r){
      return '<span class="rp-pin"><button type="button" class="period-chip" data-report-saved="' + escapeAttr(r.id) + '">' + escapeAttr(r.name) + '</button>' +
        '<button type="button" class="rp-unpin" data-report-unpin="' + escapeAttr(r.id) + '" aria-label="Unpin ' + escapeAttr(r.name) + '" title="Unpin">×</button></span>';
    }).join("") + '</div></div>' : '';
}
function pickerHtml(){
  var current = REPORTS.find(function(r){ return r.key === reportShown.key; }) || REPORTS[0];
  return '<div class="rp-selection" data-current-report="' + escapeAttr(current.key) + '"><strong>' + escapeAttr(current.label) + '</strong>' +
    '<button type="button" class="btn btn-sm" data-report-choose aria-haspopup="dialog">Choose report</button></div>' + pinsHtml(3) +
    ((state.savedReports || []).length > 3 ? '<button type="button" class="btn btn-sm btn-ghost" data-report-choose>All pinned reports</button>' : '');
}
// #414: Simple mode's reports — the ones read month to month. The chooser offers these first, with "Show all reports";
// searching finds every one, and a report opened from anywhere else opens as ever.
export var SIMPLE_REPORTS = ["cashflow", "month", "categories", "budget", "networth"];
export var reportChooserAll = { on: false };
export function reportChooserResultsHtml(query){
  var text = (query || '').trim().toLowerCase();
  var available = availableReports();
  var everyday = isSimple() && !text && !reportChooserAll.on;
  var matches = available.filter(function(r){
    var group = REPORT_GROUPS.find(function(g){ return g.key === r.group; });
    if(everyday && SIMPLE_REPORTS.indexOf(r.key) === -1 && r.key !== reportShown.key) return false;
    return !text || (r.label + ' ' + group.label + ' ' + (r.part || '') + ' ' + REPORT_DESCRIPTIONS[r.key]).toLowerCase().includes(text);
  });
  var more = everyday && available.length > matches.length ? '<button type="button" class="btn btn-sm btn-ghost rp-show-all" data-report-show-all>Show all ' + available.length + ' reports</button>' : '';
  var recent = !text ? reportRecent.filter(function(key){ return key !== reportShown.key && available.some(function(r){ return r.key === key; }); }) : [];
  var recentHtml = recent.length ? '<div class="rp-recent" role="group" aria-label="Recently viewed"><h3>Recently viewed</h3>' + recent.map(function(key){
    var r = available.find(function(r){ return r.key === key; });
    return '<button type="button" class="btn btn-sm btn-ghost" data-report-recent="' + escapeAttr(key) + '">' + escapeAttr(r.label) + '</button>';
  }).join('') + '</div>' : '';
  var catalogue = REPORT_GROUPS.map(function(g){
    var reports = matches.filter(function(r){ return r.group === g.key; });
    if(!reports.length) return '';
    var gid = "rp-group-" + g.key;
    return '<section class="rp-choice-group" aria-labelledby="' + gid + '"><h3 id="' + gid + '">' + escapeAttr(g.label) + '</h3>' + reports.map(function(r){
      var on = r.key === reportShown.key;
      return '<button type="button" class="rp-choice' + (on ? ' active' : '') + '"' + (on ? ' aria-current="true"' : '') + ' data-report="' + escapeAttr(r.key) + '"><strong>' + escapeAttr(r.label) +
        (on ? ' <span class="rp-current">Current</span>' : '') + '</strong><span>' + escapeAttr(REPORT_DESCRIPTIONS[r.key]) + '</span></button>';
    }).join('') + '</section>';
  }).join('');
  var pins = pinsHtml(null, query);
  return pins + recentHtml + catalogue + more +
    (!matches.length && !pins ? '<p>No reports match “' + escapeAttr(query || '') + '”.</p><button type="button" class="btn btn-sm" data-report-search-clear>Clear search</button>' : '');
}
// v3.124.0: what a printout opens with — whose it is, what it is, for when, and when it was printed.
function householdName(){ var p = getTaxPeople(); return p.length ? p.slice(0, -1).join(", ") + (p.length > 1 ? " and " : "") + p[p.length - 1] : "Household"; }
function reportSubtitle(rep, opts){
  var subtitle = rep.subtitle || '';
  if(!rep.frame || !rep.frame.range) return subtitle;
  var dates = fmtDate(opts.win.start, {year:true}) + ' – ' + fmtDate(opts.win.end, {year:true});
  return subtitle.indexOf(dates) !== -1 ? subtitle : subtitle + (subtitle ? ' · ' : '') + dates;
}
function printTitleHtml(rep, opts){
  var v = typeof document !== "undefined" && document.querySelector(".app-version-num");
  return '<header class="pr-title"><p class="pr-who">' + escapeAttr(householdName()) + '</p><h1>' + escapeAttr(rep.title) + '</h1>' +
    '<p>' + escapeAttr(reportSubtitle(rep, opts) || "") + '</p><p class="pr-when">Printed ' + escapeAttr(fmtDate(localDateStr(), { year: true })) + (v ? ' · Wealth Planner ' + escapeAttr(v.textContent) : '') + '</p></header>';
}
export function planningReadinessHtml(s, today){
  var r = planningReadiness(s, today);
  var missing = r.steps.filter(function(x){ return !x.done; });
  return '<section class="ledger-note" role="region" aria-label="Planning setup progress"><details><summary>Planning setup · ' + r.done + ' of ' + r.total + ' sections entered</summary>' +
    '<p>These are entry indicators, not proof of financial completeness. Loans and goals are optional; a missing loan entry does not imply you have no debt.</p>' +
    '<ul>' + r.steps.map(function(x){
      return '<li>' + (x.done ? 'Entered: ' : 'Not entered: ') + escapeAttr(x.label) + (x.optional ? ' (optional)' : '') + ' <button type="button" class="btn btn-sm" data-setup-go="' + escapeAttr(x.page) + '"' + (x.sub ? ' data-setup-sub="' + escapeAttr(x.sub) + '"' : '') + '>Review ' + escapeAttr(x.label) + '</button></li>';
    }).join('') + '</ul>' +
    (r.stale ? '<p>Some saved inputs may be stale (last saved more than 90 days ago).</p>' : '') +
    (missing.length ? '<p>Continue setup from the Income, Budget, Net worth and Goals areas. You can still use reports with a partial profile.</p>' : '<p>All tracked setup sections have entries. Review values periodically.</p>') +
    '</details></section>';
}
export function reportDisclosureHtml(info, expanded){
  return '<section class="ledger-note" role="note" aria-label="Report assumptions and data quality">' +
    '<details' + (expanded ? ' open' : '') + '><summary>As of ' + escapeAttr(fmtDate(info.asOf, { year: true })) + ' · Assumptions and data quality</summary>' +
    '<p>Profile sections entered: ' + escapeAttr(info.progress) + ' · Last saved: ' + escapeAttr(fmtDate(info.lastSaved, { year: true })) + '</p>' +
    '<ul>' + info.warnings.concat(info.assumptions).map(function(x){ return '<li>' + escapeAttr(x) + '</li>'; }).join('') + '</ul></details></section>';
}
// #255 step 3 (pages.md §4): a report with nothing to show says what it needs and where that's entered, instead of a
// table of $0 — "Nothing to report yet" said neither. Empty: no rows, or every figure in them nothing.
var REPORT_NEEDS = {
  cashflow: ["Monthly cash flow needs money in and out logged for the period — pay received and spending.", "expenses/spending", "Go to Transactions →"],
  categories: ["Spending by category needs spending logged for the period.", "expenses/spending", "Go to Transactions →"],
  income: ["The income statement needs pay or other money in, and spending, logged for the period.", "expenses/income", "Go to Income →"],
  flow: ["Where the money goes needs income and spending logged for the period.", "expenses/spending", "Go to Transactions →"],
  budget: ["Budget vs actual needs budget lines, and spending logged against them.", "expenses/budget", "Go to Budget →"],
  trends: ["Year on year needs spending logged in the last twelve months.", "expenses/spending", "Go to Transactions →"],
  networth: ["The net worth statement needs what you own and owe — accounts, investments, property and loans.", "accounts", "Go to Accounts →"],
  nwcheck: ["The net worth check needs balances recorded over the months, and the money in and out between them.", "accounts", "Go to Accounts →"],
  invest: ["Investment returns need holdings and what was paid for them.", "assets/Shares", "Go to Shares →"],
  dividends: ["Distributions need holdings, and what they paid.", "assets/Shares", "Go to Shares →"],
  cgt: ["Capital gains need a holding sold.", "assets/Shares", "Go to Shares →"],
  propreturns: ["Property returns need a property with its value, and its rent and costs if it's let.", "properties", "Go to Property →"],
  property: ["Property P&L needs a property with its rent and costs.", "properties", "Go to Property →"],
  debts: ["Loans and debts needs a loan, a card or another debt with its balance.", "accounts", "Go to Accounts →"],
  "super": ["Super needs a super fund, or pay with super, for someone in the household.", "assets/Super", "Go to Super →"],
  tax: ["The tax summary needs a Gross income row with a Person.", "expenses/income", "Go to Income →"],
  taxpack: ["The rental tax pack needs an investment property.", "properties", "Go to Property →"],
  review: ["The year in review needs a year with money in and out, or balances, recorded.", "expenses/spending", "Go to Transactions →"],
  lender: ["The lender pack needs money in, spending and balances over the last twelve months.", "expenses/spending", "Go to Transactions →"]
};
export function reportIsEmpty(rep){
  if(!rep || !rep.rows || !rep.rows.length) return true;
  var nums = rep.columns.filter(function(c){ return c.num; });
  if(!nums.length) return false;
  return rep.rows.every(function(r){ return nums.every(function(c){ var v = r.cells[c.key]; return v == null || v === "" || v === 0 || (typeof v === "number" && Math.abs(v) < 0.005); }); });
}
export function reportEmptyHtml(rep){
  var need = REPORT_NEEDS[rep.key];
  return need ? emptyStateHtml(need[0], { go: need[1], label: need[2], className: "rp-empty" })
    : emptyStateHtml("Nothing to report yet for this one.", { done: true, className: "rp-empty" });
}
export function reportsPageHtml(opts){
  var picker = pickerHtml();
  // v3.68.0: the year-end pack is a checklist with hand-off buttons, not a table.
  if(reportShown.key === "yearend") return picker + yearEndHtml();
  if(reportShown.key === "month") return picker + monthDetailHtml();
  var rep = buildReport(reportShown.key, opts);
  return picker + frameControlsHtml(rep, opts) +
    '<section class="rp-sheet" id="reportSheet"><div class="rp-head"><div><h2>' + escapeAttr(rep.title) + '</h2><span>' + escapeAttr(reportSubtitle(rep, opts)) + '</span></div>' +
      '<div class="rp-actions"><button type="button" class="btn btn-sm btn-ghost" data-report-pin title="Keep this report with its settings above the list">Pin</button><button type="button" class="btn btn-sm btn-ghost" data-report-print>Print / PDF</button><button type="button" class="btn btn-sm btn-ghost" data-report-csv>Download CSV</button>' + (canShareCsv() ? '<button type="button" class="btn btn-sm btn-ghost" data-report-share>Share CSV</button>' : '') + '</div></div>' +
      (rep.sections ? yearReviewSectionsHtml(rep.sections, false, nextYearPlanHtml(opts)) + (reportIsEmpty(rep) ? '' : '<details class="yr-figures"><summary>The year in figures</summary>' + storyHtml(rep) + reportPresentationHtml(rep) + '</details>')
        : reportIsEmpty(rep) ? reportEmptyHtml(rep) : storyHtml(rep) + reportChartHtml(rep.chart) + reportPresentationHtml(rep) + drillHtml(rep, opts)) + reportDisclosureHtml(reportDisclosure(state, localDateStr(), reportIsEmpty(rep) ? Object.assign({}, rep, { note: null }) : rep)) + (rep.note && !reportIsEmpty(rep) ? '<p class="ledger-note rp-note">' + escapeAttr(rep.note) + '</p>' : '') + '</section>' + planningReadinessHtml(state, localDateStr());
}
export function renderReports(){
  var el = typeof document !== "undefined" && document.getElementById("reportsBody");
  // #262: through keepUi, so choosing a report or changing its period leaves focus on the control that replaced the one
  // used, not on the page body.
  if(el) keepUi(function(){ el.innerHTML = reportsPageHtml(reportOpts()); });
  if(el) fitReportCharts(el);
  var strip = el && el.querySelector(".md-strip");
  // The selected month ends the strip: keep its button visible after navigation and redraws.
  if(strip) strip.scrollLeft = strip.scrollWidth;
}
// The static copy printed on its own (the same #printRoot the tax worksheet uses).
export function reportPrintHtml(){
  var opts = reportOpts();
  var rep = buildReport(reportShown.key, opts);
  return '<div class="pr-page pr-report">' + printTitleHtml(rep, opts) + (rep.sections ? yearReviewSectionsHtml(rep.sections, true) : "") + storyHtml(rep) + reportChartHtml(rep.chart) + reportTableHtml(rep) + drillHtml(rep, opts) + reportDisclosureHtml(reportDisclosure(state, localDateStr(), rep), true) + (rep.note ? '<p>' + escapeAttr(rep.note) + '</p>' : '') + '</div>';
}
export function reportCsv(){
  var rep = buildReport(reportShown.key, reportOpts());
  var c = reportCsvRows(rep);
  return { filename: "wealth-planner-" + rep.key + "-" + rep.subtitle.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() + ".csv", headers: c.headers, rows: c.rows.concat(reportDisclosureRows(reportDisclosure(state, localDateStr(), rep)).map(function(row){ return row.concat(Array(Math.max(0, c.headers.length - row.length)).fill("")); })) };
}
