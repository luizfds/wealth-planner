// ---------------- Calculators (v3.189.0, item 220) ----------------
//
// A page of its own (avatar menu → Calculators): stamp duty, LMI, a loan's repayments and what a lender
// might lend (calc/calculators.js), and — when a scenario's page opens it — that scenario's purchase and
// invest calculators, working on its draft. The scenario's page then shows just what they come to.

import { state } from "../state.js";
import { isDraftKey, DRAFT_PREFIX, buyInvestChanged } from "../calc/scenariodraft.js";
import { stampDutyFigures, lmiFigures, repaymentFigures, borrowingPower } from "../calc/calculators.js";
import { recalcPurchase } from "../calc/property.js";
import { currentScenario } from "../calc/engine.js";
import { scenarioIncomeMonthly } from "../calc/tax.js";
import { scenarioSharedItems } from "../calc/scenariochanges.js";
import { sumField } from "../calc/ledger.js";
import { PURCHASE_STATE_CODES } from "../constants.js";
import { fmtCurrency0, fmtCurrency2, fmtPercent1 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

function money(n){ return n == null ? "—" : (n < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(Number(n) || 0)); }

// Which scenario (its draft key, and its name) the page is working on, if a scenario's page opened it.
export var calcFor = { key: null, name: null };
// Session only: what's typed into the standalone calculators.
export var calcQ = { sd: { state: "NSW", price: 750000, fhb: "no" }, lmi: { price: 750000, deposit: 10 },
  rep: { loan: 600000, rate: 6, term: 30, type: "PI" }, bp: { income: null, living: null, other: 0, rate: 6, term: 30 } };

function householdDefaults(){
  if(calcQ.bp.income != null) return;
  var cs = currentScenario();
  try { calcQ.bp.income = Math.round(scenarioIncomeMonthly({ scenario: cs })); } catch(e){ calcQ.bp.income = 0; }
  calcQ.bp.living = Math.round(sumField(scenarioSharedItems(cs).filter(function(l){ return !/\b(loan|mortgage)\b/i.test(String(l.what || "")); }), "monthly"));
}
function field(path, label, type, opts){
  opts = opts || {};
  var parts = path.split("."), v = calcQ[parts[0]][parts[1]];
  var input = type === "select"
    ? '<select data-cq="' + path + '">' + opts.options.map(function(o){ var val = Array.isArray(o) ? o[0] : o, lab = Array.isArray(o) ? o[1] : o; return '<option value="' + escapeAttr(val) + '"' + (String(val) === String(v) ? " selected" : "") + '>' + escapeAttr(lab) + '</option>'; }).join("") + '</select>'
    : '<input type="number" inputmode="decimal" step="' + (opts.step || "any") + '" data-cq="' + path + '" value="' + escapeAttr(v == null ? "" : v) + '">';
  return '<label class="cq-field"><span>' + label + '</span>' + input + '</label>';
}
export function calcOutHtml(tool){
  var q = calcQ[tool];
  if(tool === "sd"){
    var sd = stampDutyFigures(q.state, q.price, q.fhb === "yes");
    return sd.duty == null ? '<p>Not worked out for ' + escapeAttr(q.state) + ' — enter it by hand in a purchase.</p>'
      : '<p class="cq-big">' + money(sd.duty) + '</p>' + (sd.saving > 0 ? '<p class="cq-note">' + money(sd.saving) + ' less as a first home buyer.</p>' : '');
  }
  if(tool === "lmi"){
    var l = lmiFigures(q.price, q.deposit);
    return '<p class="cq-big">' + (l.lmi > 0 ? money(l.lmi) : "None") + '</p><p class="cq-note">Deposit ' + money(l.deposit) + ', loan ' + money(l.loan) + ' (' + fmtPercent1.format(l.lvr) + ' of the price).' +
      (l.depositFor80 > 0 ? ' ' + money(l.depositFor80) + ' more deposit avoids it.' : '') + '</p>';
  }
  if(tool === "rep"){
    var r = repaymentFigures(q.loan, q.rate, q.term, q.type);
    return '<p class="cq-big">' + fmtCurrency2.format(r.monthly) + ' <small>a month</small></p><p class="cq-note">' + fmtCurrency2.format(r.fortnightly) + ' a fortnight · ' + money(r.totalInterest) + ' of interest over the term.</p>';
  }
  if(tool === "bp"){
    var b = borrowingPower(q.income, q.living, q.other, q.rate, q.term);
    return '<p class="cq-big">' + money(b.maxLoan) + '</p><p class="cq-note">' + money(b.spare) + ' a month spare, assessed at ' + b.assessedRate + '% over ' + (Number(q.term) || 30) + ' years. Lenders differ — a broker can tell you what yours would do.</p>';
  }
  return "";
}
function card(tool, title, fields, help){
  return '<section class="cq-card"><h3>' + title + '</h3><div class="cq-fields">' + fields.join("") + '</div><div class="cq-out" data-cq-out="' + tool + '" aria-live="polite">' + calcOutHtml(tool) + '</div>' +
    (help ? '<p class="cq-help">' + help + '</p>' : '') + '</section>';
}
export function calcToolsHtml(){
  householdDefaults();
  return '<div class="cq-grid">' +
    card("sd", "Stamp duty", [field("sd.state", "State", "select", { options: PURCHASE_STATE_CODES }), field("sd.price", "Price", "number", { step: 1000 }), field("sd.fhb", "First home buyer", "select", { options: [["no", "No"], ["yes", "Yes"]] })],
      "The same figures a purchase in a scenario uses. Concessions have conditions — check your state's revenue office.") +
    card("lmi", "Lenders mortgage insurance", [field("lmi.price", "Price", "number", { step: 1000 }), field("lmi.deposit", "Deposit %", "number", { step: 1 })],
      "Typical premiums by how much of the price is borrowed; lenders and insurers differ.") +
    card("rep", "Loan repayments", [field("rep.loan", "Loan", "number", { step: 1000 }), field("rep.rate", "Interest %", "number", { step: 0.05 }), field("rep.term", "Years", "number", { step: 1 }),
      field("rep.type", "Type", "select", { options: [["PI", "Principal & interest"], ["IO", "Interest only"]] })]) +
    card("bp", "What a lender might lend", [field("bp.income", "Take-home a month", "number", { step: 100 }), field("bp.living", "Living costs a month", "number", { step: 100 }),
      field("bp.other", "Other repayments a month", "number", { step: 50 }), field("bp.rate", "Interest %", "number", { step: 0.05 }), field("bp.term", "Years", "number", { step: 1 })],
      "Starts from your household's take-home and budget (loan lines left out). Assessed at the rate plus 3 points, as lenders do; take rent out of living costs if buying would end it.") +
    '</div>';
}
// The scenario section at the top of the page, when a scenario opened it. Its panels are drawn by
// components/scenarios.js (renderHomeBody), which owns them.
export function calcScenarioHeadHtml(){
  if(!calcFor.key) return "";
  return '<div class="cq-for"><div><span class="cq-for-k">Working on</span> <b>' + escapeAttr(calcFor.name) + '</b> <small>— changes go to its draft; save them on its page</small></div>' +
    '<button type="button" class="btn btn-sm btn-primary" data-calc-done>Done — back to ' + escapeAttr(calcFor.name) + '</button></div>';
}

// What a scenario's buying or investing comes to, for its page (the calculators themselves are on the
// Calculators page).
export function buyInvestSummaryHtml(key){
  var cfg = state.purchase && state.purchase[key], inv = state.invest && state.invest[key];
  var buying = !!(cfg && cfg.enabled && !(inv && inv.enabled)), investing = !!(inv && inv.enabled);
  var line = function(k, v){ return '<span><small>' + k + '</small><b>' + v + '</b></span>'; };
  var body;
  if(buying){
    var o = recalcPurchase(key) || {};
    body = '<div class="bis-head"><b>Buying a home to live in</b></div><div class="bis-figs">' +
      line("Price", money(o.price != null ? o.price : cfg.price)) + line("Deposit", money(o.depositAmt) + ' (' + (Number(cfg.depositPct) || 0) + '%)') + line("Loan", money(o.loanBalance)) +
      line("Repayments", money(o.repaymentMonthly) + '/mo') + line("Stamp duty", money(o.stampDutyForTotal != null ? o.stampDutyForTotal : o.stampDuty)) + (o.lmi ? line("LMI", money(o.lmi)) : '') + line("At settlement", money(o.upfrontCash)) + '</div>';
  } else if(investing){
    body = '<div class="bis-head"><b>Investing instead</b></div><div class="bis-figs">' +
      line("Now", money(Number(inv.initialAmount) || 0)) + line("Each month", inv.contributionMode === "manual" ? money(Number(inv.monthlyContribution) || 0) : "what's left over") +
      line("Into", escapeAttr(inv.assetType || "Shares")) + line("Growth", (Number(inv.growthRatePct) || 0) + "% a year") + '</div>';
  } else body = '<div class="bis-head"><b>Not buying a home or investing a lump sum</b><small>Either is worked out in the calculators.</small></div>';
  // v3.191.0 (item 222): changed since it was opened, and back to as saved.
  var name = isDraftKey(key) ? key.slice(DRAFT_PREFIX.length) : null, changed = !!(name && buyInvestChanged(name));
  return '<div class="bis' + (changed ? ' is-changed' : '') + '">' + (changed ? '<span class="sc-badge">Changed</span>' : '') + body + '<div class="bis-actions"><button type="button" class="btn btn-sm" data-sc-calc>' + (buying || investing ? "Change in the calculator" : "Open the calculators") + ' →</button>' +
    (changed ? ' <button type="button" class="link-btn sc-undo" data-sc-reset-buy>Back to saved</button>' : '') + '</div></div>';
}

export function renderCalcTools(){
  var el = typeof document !== "undefined" && document.getElementById("calcTools");
  if(el) el.innerHTML = calcToolsHtml();
}
