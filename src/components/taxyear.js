import { state } from "../state.js";
import { DEDUCTION_LABELS } from "../constants.js";
import { getTaxPeople, computePersonTax, currentTaxFy, todayTaxFy, taxTablesFor, phiPremiumsAnnual, deductionRows } from "../calc/tax.js";
import { claimItems } from "../calc/claims.js";
import { rentalComparison, budgetComparison, householdBudgetLines } from "../calc/closeyear.js";
import { localDateStr } from "../lib/format.js";
import { fyLabel, ipProperties, propertyOwnershipPct } from "../calc/property.js";
import { taxYearRecord, personYear, rentalSchedules, RENT_LINES, usesBudgetLines, budgetLineDeductions, expectedGrossForYear } from "../calc/taxyear.js";
import { fmtCurrency0, fmtCurrency2 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { applyTaxYear } from "./period.js";
import { receiptsFieldHtml, deductionReceiptsHtml } from "./receipts.js";
import { rentalLogged } from "../calc/propertyactuals.js";

// ---------------- The tax return worksheet (v3.26.0) ----------------
//
// One financial year, laid out the way myTax asks for it, per person: income statements, interest,
// managed funds, rent, capital gains, deductions by label, offsets — then the estimate, with the
// withholding, and what comes back. Inputs are the year's documents (calc/taxyear.js); everything
// not typed falls back to what the rest of the app already models, and says so, so it's useful the
// first time it's opened and exact once the documents are in.
//
// The year shown is session-only and defaults to the last complete financial year — the one being
// lodged between July and October.
//
// Since v3.55.0 the year is the header's period, not a dropdown of its own: Returns, Documents and
// every other page agree on which year they are showing.
export function taxYearSelected(){ return currentTaxFy(); }
export function setTaxYearSelected(fy){ if(Number(fy) !== currentTaxFy()) applyTaxYear(fy); }

function money(n){ return fmtCurrency2.format(Number(n) || 0); }
function num(v){ return v == null || v === "" ? "" : Number(v); }

function rowsEditorHtml(kind, person, rows, cols, addLabel){
  var body = rows.map(function(r, i){
    return '<div class="ty-row ty-row-' + kind + '">' + cols.map(function(c){
      if(c.type === "label"){
        return '<select class="ty-in" data-ty-kind="' + kind + '" data-ty-person="' + escapeAttr(person) + '" data-ty-index="' + i + '" data-ty-key="label" aria-label="Return label">' +
          DEDUCTION_LABELS.map(function(d){ return '<option value="' + d.code + '"' + ((r.label || "D5") === d.code ? " selected" : "") + '>' + d.code + '</option>'; }).join("") + '</select>';
      }
      if(c.type === "incomeRow"){
        return '<select class="ty-in" data-ty-kind="' + kind + '" data-ty-person="' + escapeAttr(person) + '" data-ty-index="' + i + '" data-ty-key="incomeId" aria-label="Income row this statement is for">' +
          '<option value="">—</option>' + c.rows.map(function(row){ return '<option value="' + escapeAttr(row.id) + '"' + (r.incomeId === row.id ? " selected" : "") + '>' + escapeAttr(row.what || "Income") + '</option>'; }).join("") + '</select>';
      }
      var v = c.type === "text" ? escapeAttr(r[c.key] || "") : num(r[c.key]);
      return '<input class="ty-in" type="' + (c.type === "text" ? "text" : "number") + '"' + (c.type === "text" ? "" : ' step="0.01"') +
        ' data-ty-kind="' + kind + '" data-ty-person="' + escapeAttr(person) + '" data-ty-index="' + i + '" data-ty-key="' + c.key + '"' +
        ' value="' + v + '" placeholder="' + escapeAttr(c.placeholder || "") + '" aria-label="' + escapeAttr(c.aria || c.label) + '">';
    }).join("") +
    '<button type="button" class="icon-btn" data-ty-del="' + kind + '" data-ty-person="' + escapeAttr(person) + '" data-ty-index="' + i + '" aria-label="Delete">✕</button></div>';
  }).join("");
  var head = '<div class="ty-row ty-row-' + kind + ' ty-head-row" aria-hidden="true">' + cols.map(function(c){ return '<span>' + c.label + '</span>'; }).join("") + '<span></span></div>';
  return (rows.length ? head + body : "") +
    '<button type="button" class="btn btn-sm btn-ghost" data-ty-add="' + kind + '" data-ty-person="' + escapeAttr(person) + '">' + addLabel + '</button>';
}

function wsLine(label, value, opts){
  opts = opts || {};
  return '<div class="ty-ws-line' + (opts.strong ? " strong" : "") + (opts.sub ? " sub" : "") + '"><span>' + label + '</span><b>' + value + '</b></div>';
}

// What the worksheet says, line by line, in myTax's order — the same lines the copy button emits.
export function worksheetLines(person, fy){
  var r = computePersonTax(person, { fy: fy });
  var py = personYear(fy, person, false);
  var out = [];
  var push = function(section, label, value){ out.push({ section: section, label: label, value: value }); };
  if(r.incomeStatements){
    (py.incomeStatements || []).forEach(function(s){
      push("Income statements", (s.payer || "Employer") + " — gross", (Number(s.gross) || 0) + (Number(s.allowances) || 0));
      push("Income statements", (s.payer || "Employer") + " — tax withheld", Number(s.withheld) || 0);
    });
  } else {
    push("Income statements", "Salary and wages (estimated from income rows)", r.gross);
  }
  if(r.interestIncome) push("Interest", "Gross interest, your share", r.interestIncome);
  var f = r.funds;
  if(f && f.funds.length){
    push("Managed funds", "13U Non-primary production income", f.nonPrimary);
    push("Managed funds", "13C Franked distributions", f.franked);
    push("Managed funds", "13Q Franking credits", f.credit);
    push("Managed funds", "20M Other net foreign income", f.foreign);
    push("Managed funds", "20O Foreign income tax offset", f.fito);
  }
  if(r.dividendGrossedUp) push("Dividends", "Dividends grossed up (estimate)", r.dividendGrossedUp);
  ipProperties().forEach(function(p){
    var pct = propertyOwnershipPct(p, person, getTaxPeople());
    if(!pct) return;
    var sch = rentalSchedules(fy).find(function(x){ return x.property.id === p.id; }).schedule;
    push("Rent", (p.what || "Property") + " — net rent, your " + pct + "%", Math.round(sch.net * pct) / 100);
  });
  if(r.capitalGainsTotal || r.capitalLossCarriedForward){
    push("Capital gains", "Total current year capital gains (18H)", r.capitalGainsTotal);
    push("Capital gains", "Net capital gain (18A)", r.capitalGains);
    if(r.capitalLossCarriedForward) push("Capital gains", "Net capital losses carried forward", r.capitalLossCarriedForward);
  }
  Object.keys(r.deductionsByLabel || {}).sort(function(a, b){ return Number(a.slice(1)) - Number(b.slice(1)); }).forEach(function(k){
    if(r.deductionsByLabel[k]) push("Deductions", k + (k === "D5" && r.wfh && r.wfh.amount ? " (incl. working from home " + money(r.wfh.amount) + ")" : ""), r.deductionsByLabel[k]);
  });
  if(r.phiAdjustment) push("Private health", "Rebate adjustment (owed back if positive)", r.phiAdjustment);
  push("Estimate", "Taxable income", r.taxable);
  push("Estimate", "Income tax + Medicare levy" + (r.medicareSurcharge ? " + surcharge" : ""), r.incomeTax + r.medicare + r.medicareSurcharge);
  if(r.helpRepayment) push("Estimate", "HELP compulsory repayment", r.helpRepayment);
  if(r.refund != null) push("Estimate", r.refund >= 0 ? "Refund" : "Amount owing", Math.abs(r.refund));
  return { lines: out, result: r };
}

// The documents a return like this one needs, generated from what's in it — an income statement
// per employer, a statement per fund, the agent's summary per property, and so on. Ticks persist
// per year so the list doubles as "what am I still waiting for" in August.
export function evidenceItems(fy){
  var items = [];
  var add = function(key, text){ items.push({ key: key, text: text }); };
  getTaxPeople().forEach(function(person){
    var py = personYear(fy, person, false);
    (py ? py.incomeStatements : []).forEach(function(s, i){ add(person + ":is:" + i, person + ": income statement — " + (s.payer || "employer")); });
    (py ? py.interest : []).forEach(function(s, i){ add(person + ":int:" + i, person + ": interest — " + (s.account || "bank")); });
    if(py && py.deductions.length) add(person + ":ded", person + ": receipts for each deduction claimed");
    var hrs = state.tax.settings && state.tax.settings[person] && state.tax.settings[person].wfhHours;
    if(hrs && Number(hrs[fy]) > 0) add(person + ":wfh", person + ": working-from-home hours record, plus one bill each for energy, internet and phone");
  });
  state.assets.forEach(function(a){
    if(a.category !== "Shares") return;
    (a.taxStatements || []).forEach(function(st){ if(Number(st.fy) === fy) add("stmt:" + a.what, "Annual tax statement — " + a.what); });
    (a.sales || []).forEach(function(sale){
      if(sale.date >= fy + "-07-01" && sale.date <= (fy + 1) + "-06-30") add("sale:" + a.what + ":" + sale.date, "Buy and sell confirmations — " + a.what + " sold " + sale.date);
    });
  });
  ipProperties().forEach(function(p){
    var n = p.what || "property";
    add("prop:" + p.id + ":agent", n + ": property manager's annual summary");
    add("prop:" + p.id + ":loan", n + ": loan statements for the year (interest, fees)");
    add("prop:" + p.id + ":bills", n + ": council rates, water and insurance paid directly");
    add("prop:" + p.id + ":qs", n + ": depreciation schedule");
    if((p.loans || []).some(function(l){ return Number(l.borrowingCosts) > 0; })) add("prop:" + p.id + ":borrow", n + ": loan settlement papers (borrowing costs)");
  });
  if(phiPremiumsAnnual(fy) > 0) add("phi", "Private health insurance tax statement");
  return items;
}

// Year-over-year: what moved between last year's lodged figures and this year's estimate.
var COMPARE_KEYS = [
  ["salary", "Salary and wages"], ["rent", "Net rent (your share)"], ["capitalGains", "Net capital gain"],
  ["deductions", "Deductions"], ["taxable", "Taxable income"], ["withheld", "Tax withheld"], ["refund", "Refund (owing if negative)"]
];
export function lodgedSnapshot(r){
  return {
    salary: Math.round(r.gross), rent: Math.round(r.ipShareForYear || 0), capitalGains: Math.round(r.capitalGains),
    deductions: Math.round(r.deductions), taxable: Math.round(r.taxable),
    withheld: r.incomeStatements ? Math.round(r.incomeStatements.withheld) : null,
    refund: r.refund == null ? null : Math.round(r.refund)
  };
}
function compareHtml(person, fy, r){
  var prev = taxYearRecord(fy - 1, false);
  var last = prev && prev.lodged && prev.lodged[person];
  if(!last) return '<p class="ledger-note" style="margin-left:0">Mark a year as lodged and next year\'s worksheet will show what moved — the "why is my refund smaller" question, answered line by line.</p>';
  var now = lodgedSnapshot(r);
  var rows = COMPARE_KEYS.filter(function(k){ return last[k[0]] != null && now[k[0]] != null; }).map(function(k){
    var d = now[k[0]] - last[k[0]];
    return '<div class="ty-cmp-row"><span>' + k[1] + '</span><span>' + fmtCurrency0.format(last[k[0]]) + '</span><span>' + fmtCurrency0.format(now[k[0]]) + '</span><b class="' + (d === 0 ? "" : d > 0 ? "up" : "down") + '">' + (d > 0 ? "+" : "") + fmtCurrency0.format(d) + '</b></div>';
  }).join("");
  return '<div class="ty-cmp"><div class="ty-cmp-row ty-head-row"><span></span><span>' + fyLabel(fy - 1) + '</span><span>' + fyLabel(fy) + '</span><span>Change</span></div>' + rows + '</div>';
}

function personCardHtml(person, fy){
  var py = personYear(fy, person, false) || { incomeStatements: [], interest: [], deductions: [] };
  var grossRows = (state.income || []).filter(function(i){ return i.person === person && i.incomeType === "Gross" && i.id; });
  var lineDeds = budgetLineDeductions(fy, person, deductionRows(claimItems(), person));
  var ws = worksheetLines(person, fy);
  var r = ws.result;
  var lodged = taxYearRecord(fy, false);
  var isLodged = !!(lodged && lodged.lodged && lodged.lodged[person]);
  var refundHtml = r.refund == null
    ? '<div class="ty-refund muted">Add income statements to see the refund</div>'
    : '<div class="ty-refund ' + (r.refund >= 0 ? "up" : "down") + '"><span>' + (r.refund >= 0 ? "Estimated refund" : "Estimated to pay") + '</span><b>' + money(Math.abs(r.refund)) + '</b></div>';
  var sections = [];
  var lastSection = null;
  ws.lines.forEach(function(l){
    if(l.section !== lastSection){ sections.push('<div class="ty-ws-section">' + l.section + '</div>'); lastSection = l.section; }
    sections.push(wsLine(escapeAttr(l.label), money(l.value), { strong: l.section === "Estimate" }));
  });
  return '<div class="ty-person" data-ty-card="' + escapeAttr(person) + '">' +
    '<div class="ty-person-head"><h3>' + escapeAttr(person) + '</h3>' + refundHtml + '</div>' +
    '<details class="row-more-options" open><summary>Income statements</summary>' +
      rowsEditorHtml("is", person, py.incomeStatements, [
        { key: "payer", label: "Payer", type: "text", placeholder: "Employer" },
        { key: "incomeId", label: "Row", type: "incomeRow", rows: grossRows },
        { key: "gross", label: "Gross", placeholder: "0" },
        { key: "allowances", label: "Allow.", aria: "Allowances", placeholder: "0" },
        { key: "withheld", label: "Withheld", placeholder: "0" },
        { key: "resc", label: "RESC", placeholder: "0" },
        { key: "rfba", label: "RFBA", placeholder: "0" }], "+ Add income statement") +
      statementChecksHtml(py, grossRows, fy) +
      (!py.incomeStatements.length && grossRows.length ? '<button type="button" class="btn btn-sm btn-ghost" data-ty-fill="' + escapeAttr(person) + '" title="One statement per Gross income row, with the gross its pay history says it paid this year — type the withholding from the real statement">Fill from income rows</button>' : '') +
      '<p class="ledger-note help" style="margin-left:0">RESC is reportable employer super (salary sacrifice), RFBA reportable fringe benefits — both on the income statement. Neither is taxed as income, but both count toward the surcharge, rebate and HELP income tests.</p>' +
    '</details>' +
    '<details class="row-more-options"' + (py.interest.length ? " open" : "") + '><summary>Interest</summary>' +
      rowsEditorHtml("int", person, py.interest, [
        { key: "account", label: "Account", type: "text", placeholder: "Bank" },
        { key: "gross", label: "Gross", placeholder: "0" },
        { key: "sharePct", label: "Your %", placeholder: "100" }], "+ Add account") +
    '</details>' +
    '<details class="row-more-options"' + (py.deductions.length || lineDeds.length ? " open" : "") + '><summary>Deductions</summary>' +
      budgetLinesDeductionHtml(person, fy, py, lineDeds) +
      '<div class="ty-sub-label">' + (lineDeds.length ? "Other claims for " : "Claims for ") + fyLabel(fy) + '</div>' +
      rowsEditorHtml("ded", person, py.deductions, [
        { key: "label", label: "Label", type: "label" },
        { key: "what", label: "What", type: "text", placeholder: "Description" },
        { key: "amount", label: "Amount", placeholder: "0" }], "+ Add deduction") +
    '</details>' +
    '<div class="ty-ws">' + sections.join("") + '</div>' +
    '<details class="row-more-options"><summary>Compared with ' + fyLabel(fy - 1) + '</summary>' + compareHtml(person, fy, r) + '</details>' +
    '<div class="m-edit-actions">' +
      '<button type="button" class="btn btn-sm btn-ghost" data-ty-copy="' + escapeAttr(person) + '">Copy worksheet</button>' +
      '<button type="button" class="btn btn-sm ' + (isLodged ? "btn-ghost" : "btn-primary") + '" data-ty-lodge="' + escapeAttr(person) + '">' + (isLodged ? "Lodged ✓ — update" : "Mark as lodged") + '</button>' +
    '</div>' +
  '</div>';
}

// Under the statements: for each one linked to an income row, what the row's pay history says it
// should have paid (v3.47.0). A gap is usually a pay change not recorded on the row — or a typo.
function statementChecksHtml(py, grossRows, fy){
  var sg = Number(state.tax && state.tax.sgRate) || 0;
  var notes = (py.incomeStatements || []).filter(function(st){ return st.incomeId; }).map(function(st){
    var row = grossRows.find(function(r){ return r.id === st.incomeId; });
    if(!row) return '<li>' + escapeAttr(st.payer || "Statement") + ': its income row has gone</li>';
    var exp = expectedGrossForYear(row, fy, sg);
    var got = (Number(st.gross) || 0) + (Number(st.allowances) || 0);
    var d = got - exp;
    return '<li>' + escapeAttr(st.payer || row.what) + ': the plan expected <b>' + fmtCurrency0.format(exp) + '</b> from ' + escapeAttr(row.what || "its row") +
      (Math.abs(d) < Math.max(50, exp * 0.01) ? ' — matches' : ' — statement is ' + fmtCurrency0.format(Math.abs(d)) + (d > 0 ? ' higher' : ' lower')) + '</li>';
  });
  return notes.length ? '<ul class="ty-checks">' + notes.join("") + '</ul>' : '';
}
// The budget lines flagged deductible for this person, listed for the year with a tick each
// (v3.47.0) — leave one out and the rest still count; typed claims below add to them.
function budgetLinesDeductionHtml(person, fy, py, lines){
  if(!lines.length) return '<p class="ledger-note" style="margin-left:0">No budget lines are flagged deductible for ' + escapeAttr(person) + ' — tick <b>Tax deduction</b> on a line (Cash flow → Budget) and it shows here. Working-from-home hours add to D5.</p>';
  var on = usesBudgetLines(personYear(fy, person, false));
  return '<label class="m-checkbox-field ty-uselines"><input type="checkbox" data-ty-uselines="' + escapeAttr(person) + '"' + (on ? " checked" : "") + '> Use the budget lines flagged deductible</label>' +
    '<div class="ty-lines' + (on ? "" : " is-off") + '">' + lines.map(function(l){
      return '<label class="ty-line"><input type="checkbox" data-ty-line="' + escapeAttr(l.id) + '" data-ty-person="' + escapeAttr(person) + '"' + (l.excluded ? "" : " checked") + (on ? "" : " disabled") + '>' +
        '<span>' + escapeAttr(l.what) + ' <small>' + escapeAttr(l.label) + '</small></span><b>' + money(l.amount) + '</b></label>';
    }).join("") + '</div>' +
    (on ? '' : '<p class="ledger-note" style="margin-left:0">Left out — this year uses only the claims typed below.</p>');
}

function rentHtml(fy){
  var schedules = rentalSchedules(fy);
  if(!schedules.length) return "";
  return schedules.map(function(x){
    var p = x.property, sch = x.schedule;
    // v3.210.0 (item 242): what's logged for the year, by return line, beside each one.
    var logged = rentalLogged(p, fy, localDateStr(), state, claimItems());
    var people = getTaxPeople();
    var shares = people.map(function(person){ return person + " " + propertyOwnershipPct(p, person, people) + "%"; }).join(" · ");
    var rows = sch.lines.map(function(l){
      var lg = logged.has[l.key] ? '<small class="ty-logged">Logged ' + money(logged.lines[l.key]) + (logged.wholeYear ? '' : ' so far') + '</small>' : '';
      return '<div class="ty-rent-row' + (l.actual != null ? " has-actual" : "") + '"><span>' + l.label + lg + '</span>' +
        '<input class="ty-rent-in" type="number" step="0.01" data-ty-rent="' + escapeAttr(p.id) + '" data-ty-key="' + l.key + '" value="' + (l.actual != null ? l.actual : "") + '" placeholder="' + l.model.toFixed(2) + '" aria-label="' + escapeAttr(l.label) + ' for ' + fyLabel(fy) + '" title="Blank uses the estimate shown. Type the figure from the year\'s documents to replace it."></div>';
    }).join("");
    return '<details class="row-more-options ty-rent"' + (sch.actualCount ? " open" : "") + '><summary>' + escapeAttr(p.what || "Property") + ' — rental schedule</summary>' +
      '<p class="ledger-note" style="margin-left:0">Whole-property totals for ' + fyLabel(fy) + ' (' + shares + '). Grey figures are estimates from the property\'s rows, loans and depreciation; type the agent\'s summary, loan statement and bills over them. ' + sch.actualCount + ' of ' + RENT_LINES.length + ' lines from documents.</p>' +
      (logged.count
        ? '<div class="ty-logged-bar"><span>' + logged.count + (logged.count === 1 ? ' entry' : ' entries') + ' logged for ' + fyLabel(fy) + (logged.wholeYear ? '' : ' so far') + '.</span>' +
            '<button type="button" class="btn btn-sm" data-ty-uselogged="' + escapeAttr(p.id) + '">Use logged figures</button></div>'
        : '<p class="ledger-note" style="margin-left:0">Nothing logged for this property in ' + fyLabel(fy) + ' yet — log its statements, rent and bills (against its cost lines) and they appear here line by line.</p>') +
      '<div class="ty-rent-grid">' + rows + '</div>' +
      '<div class="ty-ws">' + wsLine("Gross rent", money(sch.income)) + wsLine("Expenses", money(sch.expenses)) + wsLine("Net rent", money(sch.net), { strong: true }) + '</div>' +
    '</details>';
  }).join("");
}

export function renderTaxYear(){
  // Returns and Documents share the selected year; both are rendered together so switching tab
  // never shows a stale year (v3.43.0).
  var el = document.getElementById("taxYearBody");
  if(el){
    // Keep any open/closed sections as the user left them across the re-render.
    var openState = Array.prototype.map.call(el.querySelectorAll("details"), function(d){ return d.open; });
    el.innerHTML = taxYearHtml();
    if(openState.length){
      Array.prototype.forEach.call(el.querySelectorAll("details"), function(d, i){ if(i < openState.length) d.open = openState[i]; });
    }
  }
  var docs = document.getElementById("taxDocsBody");
  if(docs) docs.innerHTML = taxDocumentsHtml();
}
// Which year this is, and — while it's still running — a one-tap way to the year being lodged.
function yearSelectHtml(id, fy, today){
  var nowFy = todayTaxFy(today);
  var running = fy >= nowFy;
  return '<div class="ty-yearnote" id="' + id + '"><b>' + fyLabel(fy) + '</b>' +
    (running ? '<span class="ledger-note" style="margin:0">still running — figures so far, an estimate.</span>' +
        '<button type="button" class="btn btn-sm btn-primary" data-ty-year="' + (nowFy - 1) + '">Open ' + fyLabel(nowFy - 1) + '</button>'
      : '<span class="ledger-note" style="margin:0">change the year with the period beside the page title.</span>') + '</div>';
}
export function taxYearHtml(){
  var people = getTaxPeople();
  if(!people.length) return '<p class="tax-empty">Add a Gross income row with a Person to start a worksheet.</p>';
  var fy = taxYearSelected();
  return '<div class="ty-top">' + yearSelectHtml("taxYearSelect", fy) +
      (taxTablesFor(fy).assumed ? '<span class="ledger-note warn" style="margin:0">' + fyLabel(fy) + ' rates are partly assumed.</span>' : '') +
      '<button type="button" class="btn btn-sm btn-ghost" data-ty-print style="margin-left:auto">Print / save as PDF</button></div>' +
    rentHtml(fy) +
    people.map(function(person){ return personCardHtml(person, fy); }).join("") +
    closeYearHtml(fy);
}
// Close the year (v3.48.0) — calc/closeyear.js. Only for a year that's over: the plan for next year
// starts from what happened. Lines that moved noticeably come pre-ticked.
export function closeYearHtml(fy, today){
  today = today || localDateStr();
  if(fy >= todayTaxFy(today)) return "";
  var money0 = function(n){ return fmtCurrency0.format(Number(n) || 0); };
  var diffCell = function(d){ return '<span class="cy-diff ' + (Math.abs(d) < 1 ? "" : d > 0 ? "up" : "down") + '">' + (d > 0 ? "+" : d < 0 ? "−" : "") + money0(Math.abs(d)) + '</span>'; };
  var sections = [];
  ipProperties().forEach(function(p){
    var rows = rentalComparison(p, fy);
    if(!rows.length) return;
    sections.push('<div class="cy-head">' + escapeAttr(p.what || "Property") + ' — rental schedule</div>' + rows.map(function(r){
      var tick = r.action && Math.abs(r.diff) >= Math.max(50, Math.abs(r.planned) * 0.05);
      return '<label class="cy-row' + (r.action ? "" : " is-fixed") + '">' +
        (r.action ? '<input type="checkbox" data-cy-rent="' + escapeAttr(p.id) + '" data-cy-key="' + r.key + '"' + (tick ? " checked" : "") + '>' : '<span class="cy-nobox" title="Comes from the loans or the depreciation schedule, not a row you set">—</span>') +
        '<span class="cy-name">' + escapeAttr(r.label) + (r.action === "add" ? ' <small>new row</small>' : '') + '</span>' +
        '<span class="cy-num">' + money0(r.planned) + '</span><span class="cy-num">' + money0(r.actual) + '</span>' + diffCell(r.diff) + '</label>';
    }).join(""));
  });
  var b = budgetComparison(householdBudgetLines(claimItems(), state.properties), state.transactions || [], fy, today);
  if(b.rows.length){
    sections.push('<div class="cy-head">Budget lines <small>' + (b.months < 12 ? 'logged over ' + b.months + ' month' + (b.months === 1 ? '' : 's') + ', scaled to a year' : 'a full year logged') + '</small></div>' +
      b.rows.map(function(r){
        var tick = r.off >= 0.15 && Math.abs(r.diff) >= 100;
        return '<label class="cy-row"><input type="checkbox" data-cy-line="' + escapeAttr(r.id) + '"' + (tick ? " checked" : "") + '>' +
          '<span class="cy-name">' + escapeAttr(r.what) + '</span><span class="cy-num">' + money0(r.planned) + '</span><span class="cy-num">' + money0(r.actual) + '</span>' + diffCell(r.diff) + '</label>';
      }).join(""));
  }
  if(!sections.length) return '<details class="row-more-options ty-close"><summary>Close ' + fyLabel(fy) + '</summary><p class="ledger-note" style="margin-left:0">Type the year\'s rental figures above, or log transactions against the budget, and this compares them with the plan.</p></details>';
  return '<details class="row-more-options ty-close"><summary>Close ' + fyLabel(fy) + ' — the plan against what happened</summary>' +
    '<p class="ledger-note" style="margin-left:0">Ticked lines become next year\'s plan: each row is set to what the year actually came to (the old amount stays in its history). Rows a line\'s figure comes from are scaled together.</p>' +
    '<div class="cy-cols" aria-hidden="true"><span></span><span></span><span>Planned</span><span>Actual</span><span>Change</span></div>' +
    sections.join("") +
    '<button type="button" class="btn btn-sm btn-primary" data-cy-apply="' + fy + '">Use the ticked lines as the plan</button></details>';
}
// Documents (v3.43.0): the papers a year's return is built from, and the one-step import of a
// whole year's figures — the checklist used to sit under the last person's card on the worksheet.
export function taxDocumentsHtml(){
  var people = getTaxPeople();
  if(!people.length) return '<p class="tax-empty">Add a Gross income row with a Person to start a return.</p>';
  var fy = taxYearSelected();
  var rec = taxYearRecord(fy, false);
  var ev = evidenceItems(fy);
  var ticked = ev.filter(function(i){ return rec && rec.evidence[i.key]; }).length;
  return '<div class="ty-top">' + yearSelectHtml("taxDocsYearSelect", fy) +
      '<button type="button" class="btn btn-sm btn-ghost" data-ty-import style="margin-left:auto" title="Merge a tax year file — one year\'s income statements, interest, deductions, rental schedule and fund statements — into this plan, leaving everything else as it is">Import a year</button></div>' +
    '<h3 class="ty-docs-head">To keep for ' + fyLabel(fy) + ' <span class="ty-docs-count">' + ticked + ' of ' + ev.length + '</span></h3>' +
    (ev.length
      ? '<div class="ty-evidence">' + ev.map(function(i){
          // v3.170.0: the document itself can be kept with its tick.
          var files = rec && rec.evidenceReceipts && rec.evidenceReceipts[i.key];
          return '<div class="ty-ev-row"><label class="m-checkbox-field ty-ev"><input type="checkbox" data-ty-evidence="' + escapeAttr(i.key) + '"' + (rec && rec.evidence[i.key] ? " checked" : "") + '> ' + escapeAttr(i.text) + '</label>' +
            receiptsFieldHtml("ev:" + fy + ":" + i.key, files, { label: "Attach" }) + '</div>';
        }).join("") + '</div>'
      : '<p class="ledger-note" style="margin-left:0">Nothing yet — the list grows from the year\'s income statements, holdings, sales and properties.</p>') +
    deductionReceiptsHtml(fy, claimItems()) +
    '<p class="ledger-note" style="margin-left:0">Keep these for five years after lodging; purchase records for anything you still own until five years after you sell it. Receipts attached here stay on this device and travel in your backup and sync.</p>' +
    '<p class="ledger-note" style="margin-left:0"><b>Import a year</b> takes a tax year file — one year\'s income statements, interest, deductions, rental schedule and fund statements — and merges it in without touching anything else.</p>';
}

// ---------------- Edits ----------------
var ROW_DEFAULTS = {
  is: function(){ return { payer: "", gross: 0, allowances: 0, withheld: 0, resc: 0, rfba: 0 }; },
  int: function(){ return { account: "", gross: 0, sharePct: 100 }; },
  ded: function(){ return { label: "D5", what: "", amount: 0 }; }
};
var KIND_ARRAY = { is: "incomeStatements", int: "interest", ded: "deductions" };
export function taxYearAddRow(kind, person){
  personYear(taxYearSelected(), person, true)[KIND_ARRAY[kind]].push(ROW_DEFAULTS[kind]());
}
export function taxYearDeleteRow(kind, person, index){
  var p = personYear(taxYearSelected(), person, false);
  if(p) return p[KIND_ARRAY[kind]].splice(index, 1)[0];
}
export function taxYearRestoreRow(kind, person, index, row){
  var p = personYear(taxYearSelected(), person, true);
  p[KIND_ARRAY[kind]].splice(Math.min(index, p[KIND_ARRAY[kind]].length), 0, row);
}
export function taxYearSetField(kind, person, index, key, value){
  var p = personYear(taxYearSelected(), person, true);
  var row = p[KIND_ARRAY[kind]][index];
  if(!row) return;
  row[key] = (key === "payer" || key === "account" || key === "what" || key === "label" || key === "incomeId") ? value : (parseFloat(value) || 0);
}
// One statement per Gross income row, gross from its pay history; withholding left for the real
// statement (v3.47.0).
export function taxYearFillStatements(person){
  var fy = taxYearSelected();
  var py = personYear(fy, person, true);
  var sg = Number(state.tax && state.tax.sgRate) || 0;
  (state.income || []).filter(function(i){ return i.person === person && i.incomeType === "Gross" && i.id; }).forEach(function(row){
    py.incomeStatements.push({ payer: row.what || "", incomeId: row.id, gross: Math.round(expectedGrossForYear(row, fy, sg)), allowances: 0, withheld: 0, resc: 0, rfba: 0 });
  });
}
export function taxYearToggleEvidence(key, on){
  var rec = taxYearRecord(taxYearSelected(), true);
  if(on) rec.evidence[key] = true; else delete rec.evidence[key];
}
export function taxYearMarkLodged(person){
  var fy = taxYearSelected();
  taxYearRecord(fy, true).lodged[person] = lodgedSnapshot(computePersonTax(person, { fy: fy }));
}
export function worksheetText(person){
  var fy = taxYearSelected();
  var ws = worksheetLines(person, fy);
  var out = [person + " — " + fyLabel(fy) + " tax return worksheet"];
  var last = null;
  ws.lines.forEach(function(l){
    if(l.section !== last){ out.push(""); out.push(l.section.toUpperCase()); last = l.section; }
    out.push(l.label + ": " + money(l.value));
  });
  return out.join("\n");
}

// ---------------- Printing (v3.31.0) ----------------
//
// A static copy rather than the live form: inputs print as boxes with half-visible numbers and the
// app's chrome (nav, header, FAB) would ride along. This builds plain tables from the same
// worksheetLines/rentalSchedules the screen uses — one person per page, then the rental schedules
// and the document checklist — and the print stylesheet shows only it (styles/income.css).
function esc(t){ return escapeAttr(String(t == null ? "" : t)); }
export function taxYearPrintHtml(){
  var fy = taxYearSelected();
  var people = getTaxPeople();
  var rec = taxYearRecord(fy, false);
  var pages = people.map(function(person){
    var ws = worksheetLines(person, fy);
    var py = personYear(fy, person, false) || { incomeStatements: [], interest: [], deductions: [] };
    var rows = [], last = null;
    ws.lines.forEach(function(l){
      if(l.section !== last){ rows.push('<tr class="pr-sec"><th colspan="2">' + esc(l.section) + '</th></tr>'); last = l.section; }
      rows.push('<tr' + (l.section === "Estimate" ? ' class="pr-strong"' : '') + '><td>' + esc(l.label) + '</td><td class="pr-num">' + money(l.value) + '</td></tr>');
    });
    var ded = py.deductions.length
      ? '<h3>Deductions entered</h3><table class="pr-table"><tr><th>Label</th><th>What</th><th class="pr-num">Amount</th></tr>' +
        py.deductions.map(function(d){ return '<tr><td>' + esc(d.label || "D5") + '</td><td>' + esc(d.what) + '</td><td class="pr-num">' + money(d.amount) + '</td></tr>'; }).join("") + '</table>'
      : "";
    return '<section class="pr-page"><h2>' + esc(person) + ' — ' + fyLabel(fy) + ' tax return worksheet</h2>' +
      (ws.result.refund != null ? '<p class="pr-refund">' + (ws.result.refund >= 0 ? "Estimated refund " : "Estimated to pay ") + '<b>' + money(Math.abs(ws.result.refund)) + '</b></p>' : '') +
      '<table class="pr-table">' + rows.join("") + '</table>' + ded + '</section>';
  }).join("");
  var rent = rentalSchedules(fy).map(function(x){
    var sch = x.schedule;
    return '<h3>' + esc(x.property.what || "Property") + ' — rental schedule (whole property)</h3><table class="pr-table">' +
      sch.lines.filter(function(l){ return l.value; }).map(function(l){
        return '<tr><td>' + esc(l.label) + (l.actual == null ? ' <i>(estimate)</i>' : '') + '</td><td class="pr-num">' + money(l.value) + '</td></tr>';
      }).join("") +
      '<tr class="pr-strong"><td>Net rent</td><td class="pr-num">' + money(sch.net) + '</td></tr></table>';
  }).join("");
  var ev = evidenceItems(fy).map(function(i){
    return '<li>' + (rec && rec.evidence[i.key] ? "☑ " : "☐ ") + esc(i.text) + '</li>';
  }).join("");
  return pages +
    '<section class="pr-page">' + (rent ? '<h2>Rental schedules — ' + fyLabel(fy) + '</h2>' + rent : '') +
      '<h2>Documents to keep</h2><ul class="pr-ev">' + ev + '</ul>' +
      '<p class="pr-foot">Prepared with Wealth Planner. Estimates where marked; check every figure against its document before lodging.</p></section>';
}
