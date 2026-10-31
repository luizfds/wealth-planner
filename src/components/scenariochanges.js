import { state } from "../state.js";
import { changesFor } from "../calc/scenariochanges.js";
import { CHANGE_KINDS, ipFigures, legsMonthly, changeSummary } from "../calc/scenariolegs.js";
import { scenarioLegContext, computeNetWorthSeries, isCashTriggered } from "../calc/engine.js";
import { getTaxPeople } from "../calc/tax.js";
import { PURCHASE_STATE_CODES } from "../constants.js";
import { periodsOf } from "../calc/ledger.js";
import { fmtCurrency0, fmtCurrency2 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- A scenario's own changes, on Plan → Scenarios (v3.172.0, item 207) ----------------
// What a scenario does differently from the household, listed in the scenario itself — the per-line
// "Vary" that used to live on Budget and Income rows is here now. calc/scenariochanges.js keeps them.

function rowById(id){
  var r = (state.shared || []).find(function(l){ return l && l.id === id; });
  if(r) return { row: r, where: "Budget" };
  r = (state.income || []).find(function(l){ return l && l.id === id && !l.computed; });
  return r ? { row: r, where: "Income" } : null;
}
// The rows a change can be about: budget lines and income the household typed in (not computed ones).
function rowOptionsHtml(){
  var opt = function(r){ return '<option value="' + escapeAttr(r.id) + '">' + escapeAttr(r.what || "A line") + ' — ' + fmtCurrency2.format(Number(r.amount) || 0) + ' ' + escapeAttr(String(r.freq || "").toLowerCase()) + '</option>'; };
  var lines = (state.shared || []).filter(function(r){ return r && r.id; });
  var inc = (state.income || []).filter(function(r){ return r && r.id && !r.computed; });
  return '<option value="">Choose a line…</option>' +
    (lines.length ? '<optgroup label="Budget">' + lines.map(opt).join("") + '</optgroup>' : '') +
    (inc.length ? '<optgroup label="Income">' + inc.map(opt).join("") + '</optgroup>' : '');
}
// v3.173.0 (item 208): which change forms are open (session only).
export var changeOpen = {};
var FREQS = ["Weekly", "Fortnightly", "Monthly", "Quarterly", "Yearly"];
function field(c, scenario, key, label, type, extra){
  var v = c[key] == null ? "" : c[key];
  var attrs = ' data-scf="' + key + '" data-scf-id="' + escapeAttr(c.id) + '" data-scf-scenario="' + escapeAttr(scenario) + '"';
  var input;
  if(type === "select") input = '<select' + attrs + '>' + extra.map(function(o){ var val = Array.isArray(o) ? o[0] : o, lab = Array.isArray(o) ? o[1] : o; return '<option value="' + escapeAttr(val) + '"' + (String(val) === String(v) ? " selected" : "") + '>' + escapeAttr(lab) + '</option>'; }).join("") + '</select>';
  else input = '<input type="' + type + '"' + (type === "number" ? ' step="any"' : '') + attrs + ' value="' + escapeAttr(v) + '"' + (extra || "") + '>';
  return '<label class="scf"><span>' + label + '</span>' + input + '</label>';
}
// v3.183.0 (item 214): when a change starts — in a year, at an age, or when cash reaches an amount.
function whenFields(c, scenario, label){
  var kinds = [["year", "In a year"], ["age", "At an age"]].concat(c.kind === "sell" ? [] : [["cash", "When cash reaches"]]);
  var w = c.when === "age" || (c.when === "cash" && c.kind !== "sell") ? c.when : "year";
  var picker = field(Object.assign({}, c, { when: w }), scenario, "when", label, "select", kinds);
  if(w === "age") return [picker, field(c, scenario, "whenAge", "Age", "number", ' min="0" max="100" inputmode="numeric"')];
  if(w === "cash") return [picker, field(c, scenario, "whenCash", "Cash of", "number", ' min="0" step="1000" inputmode="decimal"')];
  return [picker, field(c, scenario, "fromYear", "Year", "select", yearOptions())];
}
function yearOptions(){ var o = [["0", "Now"]]; for(var y = 1; y <= 15; y++) o.push([String(y), "In " + y + " year" + (y === 1 ? "" : "s")]); return o; }
function changeFormHtml(c, scenario, ctx){
  var f = [];
  if(c.kind === "rent" || c.kind === "cost"){
    f.push(field(c, scenario, "what", "What", "text"), field(c, scenario, "amount", "Amount", "number"), field(c, scenario, "freq", "How often", "select", FREQS));
    f = f.concat(whenFields(c, scenario, "From"));
  } else if(c.kind === "ip"){
    var people = getTaxPeople();
    f.push(field(c, scenario, "what", "Name", "text"), field(c, scenario, "price", "Price", "number"), field(c, scenario, "depositPct", "Deposit %", "number"),
      field(c, scenario, "rate", "Interest %", "number"), field(c, scenario, "repaymentType", "Loan", "select", [["IO", "Interest only"], ["PI", "Principal & interest"]]),
      field(c, scenario, "termYears", "Term (years)", "number"), field(c, scenario, "state", "State", "select", PURCHASE_STATE_CODES),
      field(c, scenario, "rentWeekly", "Rent a week", "number"), field(c, scenario, "vacancyWeeks", "Weeks vacant a year", "number"), field(c, scenario, "mgmtPct", "Management %", "number"),
      field(c, scenario, "costsYearly", "Costs a year", "number", ' title="Rates, insurance, strata, water, repairs"'), field(c, scenario, "depreciationYearly", "Depreciation a year", "number"),
      field(c, scenario, "growthPct", "Growth % a year", "number", ' placeholder="Projection\'s rate"'),
      field(c, scenario, "owner", "Owner", "select", [["", people.length > 1 ? "Shared evenly" : "The household"]].concat(people.map(function(p){ return [p, p]; }))),
      whenFields(c, scenario, "Bought")[0], whenFields(c, scenario, "Bought")[1]);
    var fig = ipFigures(c, { marginalRate: ctx.marginalRateFor(c.owner), taxEffect: ctx.taxEffectFor ? function(tx){ return ctx.taxEffectFor(c.owner, tx); } : null });
    f.push('<p class="scf-figs"><span>Rent less costs and loan: <b>' + signed(fig.cashBeforeTaxMonthly) + '/mo</b></span><span>Tax effect: <b>' + signed(fig.taxEffectYearly / 12) + '/mo</b> (' + Math.round(fig.taxRate * 100) + '% on a ' + (fig.taxableYearly < 0 ? 'loss' : 'profit') + ' of ' + fmtCurrency0.format(Math.abs(fig.taxableYearly)) + ' a year)</span>' +
      '<span>After tax: <b>' + signed(fig.cashAfterTaxMonthly) + '/mo</b></span><span>Cash at settlement: <b>' + fmtCurrency0.format(fig.upfront) + '</b> (deposit ' + fmtCurrency0.format(fig.deposit) + ', stamp duty ' + fmtCurrency0.format(fig.stampDuty) + (fig.lmi ? ', LMI ' + fmtCurrency0.format(fig.lmi) : '') + ', other costs)</span></p>');
  } else if(c.kind === "extra"){
    var loaned = (state.properties || []).filter(function(p){ return (p.loans || []).length; }).map(function(p){ return [p.id, p.what || "A property"]; });
    f.push(field(c, scenario, "propertyId", "Loan on", "select", loaned.length ? loaned : [["", "No property loans yet"]]), field(c, scenario, "amount", "Extra", "number"),
      field(c, scenario, "freq", "How often", "select", FREQS), field(c, scenario, "rate", "Its interest %", "number"));
    f = f.concat(whenFields(c, scenario, "From"));
  } else if(c.kind === "sell"){
    var props = (state.properties || []).map(function(p){ return [p.id, p.what || "A property"]; });
    f.push(field(c, scenario, "propertyId", "Property", "select", props.length ? props : [["", "No properties yet"]]), whenFields(c, scenario, "Sold")[0], whenFields(c, scenario, "Sold")[1],
      field(c, scenario, "sellingCostsPct", "Selling costs %", "number"));
  }
  return '<div class="scf-grid">' + f.join("") + '</div>';
}
function signed(n){ return (n < 0 ? "−" : "+") + fmtCurrency0.format(Math.abs(n)); }
function amountChangeHtml(c, scenario){
  var hit = rowById(c.rowId);
  if(!hit) return '<div class="sc-change is-gone"><span class="sc-what">A line that has since been deleted</span>' +
    '<button type="button" class="btn btn-danger btn-sm" data-sc-del="' + escapeAttr(c.id) + '" data-sc-scenario="' + escapeAttr(scenario) + '" aria-label="Remove this change">✕</button></div>';
  var r = hit.row, today = Number(r.amount) || 0;
  var monthlyDiff = periodsOf(Number(c.amount) || 0, r.freq).monthly - periodsOf(today, r.freq).monthly;
  return '<div class="sc-change"><span class="sc-what"><b>' + escapeAttr(r.what || "A line") + '</b><small>' + hit.where + ' · today ' + fmtCurrency2.format(today) + ' ' + escapeAttr(String(r.freq || "").toLowerCase()) +
      (Math.abs(monthlyDiff) >= 0.5 ? ' · ' + (monthlyDiff > 0 ? "+" : "−") + fmtCurrency0.format(Math.abs(monthlyDiff)) + '/mo' : '') + '</small></span>' +
    '<label class="sc-amt"><span class="visually-hidden">Amount in ' + escapeAttr(scenario) + '</span><input type="number" step="0.01" min="0" value="' + (Number(c.amount) || 0) + '" data-sc-amount="' + escapeAttr(c.id) + '" data-sc-scenario="' + escapeAttr(scenario) + '" aria-label="' + escapeAttr((r.what || "Line") + " in " + scenario + ", " + String(r.freq || "").toLowerCase()) + '"><small>' + escapeAttr(String(r.freq || "").toLowerCase()) + '</small></label>' +
    '<button type="button" class="btn btn-danger btn-sm" data-sc-del="' + escapeAttr(c.id) + '" data-sc-scenario="' + escapeAttr(scenario) + '" aria-label="' + escapeAttr("Remove the change to " + (r.what || "this line")) + '">✕</button></div>';
}
export function scenarioChangesHtml(scenario){
  var all = changesFor(scenario);
  var ctx = scenarioLegContext(scenario);
  var propName = function(id){ var p = (state.properties || []).find(function(x){ return x.id === id; }); return p ? p.what : null; };
  // v3.183.0: when a change waiting on cash starts, from the projection.
  var triggers = all.some(isCashTriggered) ? (computeNetWorthSeries(scenario, 30).triggers || {}) : {};
  var startsText = function(c){
    if(!isCashTriggered(c)) return "";
    var y = triggers[c.id];
    return y == null ? ' <span class="sc-when warn">— cash doesn\'t reach it in 30 years</span>' : ' <span class="sc-when">— year ' + y + (y === 1 ? ", the coming year" : "") + '</span>';
  };
  var rows = all.map(function(c){
    if(c.kind === "amount") return amountChangeHtml(c, scenario);
    if(c.kind === "home") return '<div class="sc-change"><span class="sc-what"><b>Lives somewhere else</b><small>Its home costs are listed under Recurring costs below; today\'s home lines are left out.</small></span></div>';
    // v3.177.0 (item 204): kept from a what-if on Projections — they change the projection, not the month.
    if(c.kind === "assume" || c.kind === "retire") return '<div class="sc-change"><span class="sc-what"><b>' + escapeAttr(changeSummary(c)) + '</b><small>' +
        (c.kind === "retire" ? "In the projection, living costs come out of savings from then" : "Used for this scenario's projection instead of the household's") + '</small></span>' +
      '<button type="button" class="btn btn-danger btn-sm" data-sc-del="' + escapeAttr(c.id) + '" data-sc-scenario="' + escapeAttr(scenario) + '" aria-label="' + escapeAttr("Remove: " + changeSummary(c)) + '">✕</button></div>';
    var m = legsMonthly([c], ctx), effect = m.incomeMonthly - m.expensesMonthly;
    var open = !!changeOpen[c.id];
    return '<div class="sc-change sc-leg' + (open ? " is-open" : "") + '"><button type="button" class="sc-what sc-leg-head" data-sc-toggle="' + escapeAttr(c.id) + '" aria-expanded="' + open + '"><b>' + escapeAttr(changeSummary(c, { money: function(n){ return fmtCurrency0.format(n); }, propertyName: propName })) + startsText(c) + '</b>' +
        (c.kind === "sell" ? '<small>Its equity becomes cash that year, and its rent, costs and loan stop</small>'
          : c.kind === "extra" ? '<small>' + signed(effect) + '/mo from savings, into the loan — kept as equity</small>'
          : '<small>' + signed(effect) + '/mo' + (c.kind === "ip" ? ' after tax · ' + fmtCurrency0.format(m.upfront) + ' at settlement' : '') + '</small>') + '</button>' +
      '<button type="button" class="btn btn-danger btn-sm" data-sc-del="' + escapeAttr(c.id) + '" data-sc-scenario="' + escapeAttr(scenario) + '" aria-label="' + escapeAttr("Remove: " + changeSummary(c, { propertyName: propName })) + '">✕</button>' +
      (open ? changeFormHtml(c, scenario, ctx) : '') + '</div>';
  }).join("");
  var hasLoan = (state.properties || []).some(function(p){ return (p.loans || []).length; });
  var adders = CHANGE_KINDS.filter(function(k){ return k.key !== "amount" && (k.key !== "sell" || (state.properties || []).length) && (k.key !== "extra" || hasLoan); }).map(function(k){
    return '<button type="button" class="btn btn-sm" data-sc-new="' + k.key + '" data-sc-scenario="' + escapeAttr(scenario) + '" title="' + escapeAttr(k.hint) + '">+ ' + escapeAttr(k.label) + '</button>';
  }).join("");
  return '<div class="sc-changes"><div class="home-recurring-label">Changes from today</div>' +
    (rows || '<p class="ledger-note" style="margin:0 0 8px">Nothing differs from today yet. Add what this scenario changes — renting somewhere new, an investment property, a cost — and it\'s worked out against the household as it is.</p>') +
    '<div class="sc-adders">' + adders + '</div>' +
    '<div class="sc-add"><select data-sc-row="' + escapeAttr(scenario) + '" aria-label="A line that would be different in ' + escapeAttr(scenario) + '">' + rowOptionsHtml() + '</select>' +
      '<input type="number" step="0.01" min="0" data-sc-new-amount="' + escapeAttr(scenario) + '" placeholder="Amount, same frequency" aria-label="Its amount in ' + escapeAttr(scenario) + '">' +
      '<button type="button" class="btn btn-sm" data-sc-add="' + escapeAttr(scenario) + '">A line costs a different amount</button></div></div>';
}
// The baseline's block: today's home is in Budget now, so this says where, and what it adds up to.
export function todaysHomeHtml(){
  var lines = (state.shared || []).filter(function(l){ return l && l.homeCost; });
  var total = lines.reduce(function(s, l){ return s + periodsOf(Number(l.amount) || 0, l.freq).monthly; }, 0);
  return '<div class="sc-today"><p>This is your household as it is — every other scenario is measured against it, and nothing here is a what-if.</p>' +
    (lines.length
      ? '<p class="sc-today-lines">Where you live today: ' + lines.map(function(l){ return escapeAttr(l.what) + ' ' + fmtCurrency0.format(periodsOf(Number(l.amount) || 0, l.freq).monthly) + '/mo'; }).join(" · ") + ' — <b>' + fmtCurrency0.format(total) + '/mo</b>.</p>'
      : '<p class="sc-today-lines">No home costs in Budget yet. Add rent or the home loan there, marked as Housing.</p>') +
    '<button type="button" class="btn btn-sm" data-adv-go="expenses" data-adv-sub="budget">Edit them in Budget</button></div>';
}
export function todaysHomeMonthly(){
  return (state.shared || []).filter(function(l){ return l && l.homeCost; }).reduce(function(s, l){ return s + periodsOf(Number(l.amount) || 0, l.freq).monthly; }, 0);
}
