import { state } from "../state.js";
import { DEDUCTION_LABELS } from "../constants.js";
import { getTaxPeople, computePersonTax, currentTaxFy, taxTablesFor } from "../calc/tax.js";
import { fyLabel, ipProperties, propertyOwnershipPct } from "../calc/property.js";
import { taxYearRecord, personYear, rentalSchedules, RENT_LINES } from "../calc/taxyear.js";
import { fmtCurrency0, fmtCurrency2 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

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
var selectedFy = null;
export function taxYearSelected(){
  if(selectedFy == null) selectedFy = currentTaxFy() - 1;
  return selectedFy;
}
export function setTaxYearSelected(fy){ selectedFy = Number(fy); }

function money(n){ return fmtCurrency2.format(Number(n) || 0); }
function num(v){ return v == null || v === "" ? "" : Number(v); }

function rowsEditorHtml(kind, person, rows, cols, addLabel){
  var body = rows.map(function(r, i){
    return '<div class="ty-row ty-row-' + kind + '">' + cols.map(function(c){
      if(c.type === "label"){
        return '<select class="ty-in" data-ty-kind="' + kind + '" data-ty-person="' + escapeAttr(person) + '" data-ty-index="' + i + '" data-ty-key="label" aria-label="Return label">' +
          DEDUCTION_LABELS.map(function(d){ return '<option value="' + d.code + '"' + ((r.label || "D5") === d.code ? " selected" : "") + '>' + d.code + '</option>'; }).join("") + '</select>';
      }
      var v = c.type === "text" ? escapeAttr(r[c.key] || "") : num(r[c.key]);
      return '<input class="ty-in" type="' + (c.type === "text" ? "text" : "number") + '"' + (c.type === "text" ? "" : ' step="0.01"') +
        ' data-ty-kind="' + kind + '" data-ty-person="' + escapeAttr(person) + '" data-ty-index="' + i + '" data-ty-key="' + c.key + '"' +
        ' value="' + v + '" placeholder="' + escapeAttr(c.placeholder || "") + '" aria-label="' + escapeAttr(c.label) + '">';
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
  if(Number(state.tax.phiPremiums) > 0) add("phi", "Private health insurance tax statement");
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
        { key: "gross", label: "Gross", placeholder: "0" },
        { key: "allowances", label: "Allowances", placeholder: "0" },
        { key: "withheld", label: "Withheld", placeholder: "0" }], "+ Add income statement") +
    '</details>' +
    '<details class="row-more-options"' + (py.interest.length ? " open" : "") + '><summary>Interest</summary>' +
      rowsEditorHtml("int", person, py.interest, [
        { key: "account", label: "Account", type: "text", placeholder: "Bank" },
        { key: "gross", label: "Gross", placeholder: "0" },
        { key: "sharePct", label: "Your %", placeholder: "100" }], "+ Add account") +
    '</details>' +
    '<details class="row-more-options"' + (py.deductions.length ? " open" : "") + '><summary>Deductions</summary>' +
      '<p class="ledger-note" style="margin-left:0">' + (py.deductions.length
        ? "These replace the budget-line deductions for " + fyLabel(fy) + ". Working-from-home hours still add to D5."
        : "Blank uses the budget lines flagged deductible for " + fyLabel(fy) + ". Enter the year's actual claims here to replace them.") + '</p>' +
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

function rentHtml(fy){
  var schedules = rentalSchedules(fy);
  if(!schedules.length) return "";
  return schedules.map(function(x){
    var p = x.property, sch = x.schedule;
    var people = getTaxPeople();
    var shares = people.map(function(person){ return person + " " + propertyOwnershipPct(p, person, people) + "%"; }).join(" · ");
    var rows = sch.lines.map(function(l){
      return '<div class="ty-rent-row' + (l.actual != null ? " has-actual" : "") + '"><span>' + l.label + '</span>' +
        '<input class="ty-rent-in" type="number" step="0.01" data-ty-rent="' + escapeAttr(p.id) + '" data-ty-key="' + l.key + '" value="' + (l.actual != null ? l.actual : "") + '" placeholder="' + l.model.toFixed(2) + '" aria-label="' + escapeAttr(l.label) + ' for ' + fyLabel(fy) + '" title="Blank uses the estimate shown. Type the figure from the year\'s documents to replace it."></div>';
    }).join("");
    return '<details class="row-more-options ty-rent"' + (sch.actualCount ? " open" : "") + '><summary>' + escapeAttr(p.what || "Property") + ' — rental schedule</summary>' +
      '<p class="ledger-note" style="margin-left:0">Whole-property totals for ' + fyLabel(fy) + ' (' + shares + '). Grey figures are estimates from the property\'s rows, loans and depreciation; type the agent\'s summary, loan statement and bills over them. ' + sch.actualCount + ' of ' + RENT_LINES.length + ' lines from documents.</p>' +
      '<div class="ty-rent-grid">' + rows + '</div>' +
      '<div class="ty-ws">' + wsLine("Gross rent", money(sch.income)) + wsLine("Expenses", money(sch.expenses)) + wsLine("Net rent", money(sch.net), { strong: true }) + '</div>' +
    '</details>';
  }).join("");
}

export function renderTaxYear(){
  var el = document.getElementById("taxYearBody");
  if(!el) return;
  // Keep any open/closed sections as the user left them across the re-render.
  var openState = Array.prototype.map.call(el.querySelectorAll("details"), function(d){ return d.open; });
  el.innerHTML = taxYearHtml();
  if(openState.length){
    Array.prototype.forEach.call(el.querySelectorAll("details"), function(d, i){ if(i < openState.length) d.open = openState[i]; });
  }
}
export function taxYearHtml(){
  var people = getTaxPeople();
  if(!people.length) return '<p class="tax-empty">Add a Gross income row with a Person to start a worksheet.</p>';
  var fy = taxYearSelected();
  var thisFy = currentTaxFy();
  var options = [];
  for(var y = thisFy - 4; y <= thisFy; y++) options.push('<option value="' + y + '"' + (y === fy ? " selected" : "") + '>' + fyLabel(y) + (y === thisFy ? " (this year)" : "") + '</option>');
  var rec = taxYearRecord(fy, false);
  var ev = evidenceItems(fy);
  var ticked = ev.filter(function(i){ return rec && rec.evidence[i.key]; }).length;
  return '<div class="ty-top"><label for="taxYearSelect">Financial year</label><select id="taxYearSelect">' + options.join("") + '</select>' +
      (taxTablesFor(fy).assumed ? '<span class="ledger-note warn" style="margin:0">' + fyLabel(fy) + ' rates are partly assumed.</span>' : '') + '</div>' +
    rentHtml(fy) +
    people.map(function(person){ return personCardHtml(person, fy); }).join("") +
    '<details class="row-more-options ty-evidence"><summary>Documents to keep (' + ticked + ' of ' + ev.length + ')</summary>' +
      ev.map(function(i){ return '<label class="m-checkbox-field ty-ev"><input type="checkbox" data-ty-evidence="' + escapeAttr(i.key) + '"' + (rec && rec.evidence[i.key] ? " checked" : "") + '> ' + escapeAttr(i.text) + '</label>'; }).join("") +
      '<p class="ledger-note" style="margin-left:0">Keep these for five years after lodging; purchase records for anything you still own until five years after you sell it.</p>' +
    '</details>';
}

// ---------------- Edits ----------------
var ROW_DEFAULTS = {
  is: function(){ return { payer: "", gross: 0, allowances: 0, withheld: 0 }; },
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
  row[key] = (key === "payer" || key === "account" || key === "what" || key === "label") ? value : (parseFloat(value) || 0);
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
