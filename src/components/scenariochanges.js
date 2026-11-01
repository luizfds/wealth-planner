import { state } from "../state.js";
import { changesFor } from "../calc/scenariochanges.js";
import { isDraftKey, DRAFT_PREFIX, changeStatus, changedFields } from "../calc/scenariodraft.js";
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
// v3.191.0 (item 222): the fields of the change being drawn that differ from the saved scenario's.
var fieldMarks = {};
// v3.193.0 (item 224): a plain hint under a harder field, and a flag (not a refusal) on a value outside the usual.
function n(v){ var x = Number(v); return isFinite(x) ? x : 0; }
var HINTS = {
  depositPct: function(c){ return c.kind === "ip" && n(c.price) > 0 ? fmtCurrency0.format(n(c.price) * n(c.depositPct) / 100) + " — under 20% adds LMI" : ""; },
  rentWeekly: function(c){ return n(c.price) > 0 && n(c.rentWeekly) > 0 ? (n(c.rentWeekly) * 52 / n(c.price) * 100).toFixed(1) + "% of the price a year (gross yield)" : "what similar places rent for"; },
  vacancyWeeks: function(){ return "2–3 weeks is typical"; },
  mgmtPct: function(){ return "a property manager's fee, usually 5–8% of rent"; },
  costsYearly: function(){ return "rates, insurance, strata, water, repairs"; },
  depreciationYearly: function(){ return "from a quantity surveyor's report — often $3,000–8,000 for a newer place, little for an older one"; },
  growthPct: function(){ return "blank uses the projection's rate"; },
  whenCash: function(){ return "cash, shares and offsets — never super"; },
  sellingCostsPct: function(){ return "agent's fees and marketing, usually 2–3%"; }
};
var ODD = {
  depositPct: function(c){ return n(c.depositPct) < 5 || n(c.depositPct) > 100; },
  rate: function(c){ return n(c.rate) < 1 || n(c.rate) > 15; },
  rentWeekly: function(c){ var y = n(c.price) > 0 ? n(c.rentWeekly) * 52 / n(c.price) : 0.04; return n(c.rentWeekly) > 0 && (y < 0.015 || y > 0.1); },
  mgmtPct: function(c){ return n(c.mgmtPct) > 15; },
  vacancyWeeks: function(c){ return n(c.vacancyWeeks) > 12; },
  termYears: function(c){ return n(c.termYears) > 40; },
  sellingCostsPct: function(c){ return n(c.sellingCostsPct) > 8; }
};
function field(c, scenario, key, label, type, extra){
  var v = c[key] == null ? "" : c[key];
  var marked = !!(fieldMarks[key] || (key === "fromYear" && (fieldMarks.when || fieldMarks.whenAge || fieldMarks.whenCash)));
  var attrs = ' data-scf="' + key + '" data-scf-id="' + escapeAttr(c.id) + '" data-scf-scenario="' + escapeAttr(scenario) + '"';
  var input;
  if(type === "select") input = '<select' + attrs + '>' + extra.map(function(o){ var val = Array.isArray(o) ? o[0] : o, lab = Array.isArray(o) ? o[1] : o; return '<option value="' + escapeAttr(val) + '"' + (String(val) === String(v) ? " selected" : "") + '>' + escapeAttr(lab) + '</option>'; }).join("") + '</select>';
  else input = '<input type="' + type + '"' + (type === "number" ? ' step="any"' : '') + attrs + ' value="' + escapeAttr(v) + '"' + (extra || "") + '>';
  var hint = HINTS[key] ? HINTS[key](c) : "", odd = ODD[key] ? ODD[key](c) : false;
  return '<label class="scf' + (marked ? ' is-changed' : '') + (odd ? ' is-odd' : '') + '"><span>' + label + (marked ? ' <i class="scf-dot" title="Changed since you opened it" aria-label="changed"></i>' : '') + '</span>' + input +
    (odd ? '<small class="scf-odd">unusual — check it</small>' : hint ? '<small class="scf-hint">' + escapeAttr(hint) + '</small>' : '') + '</label>';
}
// A labelled group of fields (v3.193.0).
function group(title, fields, folded){
  return folded ? '<details class="scf-group scf-more"><summary>' + title + '</summary><div class="scf-grid">' + fields.join("") + '</div></details>'
    : '<fieldset class="scf-group"><legend>' + title + '</legend><div class="scf-grid">' + fields.join("") + '</div></fieldset>';
}
// v3.183.0 (item 214): when a change starts — in a year, at an age, or when cash reaches an amount.
function whenFields(c, scenario, label){
  var kinds = [["year", "In a set year"], ["age", "At an age"]].concat(c.kind === "sell" ? [] : [["cash", "When cash reaches…"]]);
  var w = c.when === "age" || (c.when === "cash" && c.kind !== "sell") ? c.when : "year";
  var picker = field(Object.assign({}, c, { when: w }), scenario, "when", label, "select", kinds);
  if(w === "age") return [picker, field(c, scenario, "whenAge", "Age", "number", ' min="0" max="100" inputmode="numeric"')];
  if(w === "cash") return [picker, field(c, scenario, "whenCash", "Cash of", "number", ' min="0" step="1000" inputmode="decimal"')];
  return [picker, field(c, scenario, "fromYear", "Which year", "select", yearOptions())];
}
function yearOptions(){ var o = [["0", "Now"]]; for(var y = 1; y <= 15; y++) o.push([String(y), "In " + y + " year" + (y === 1 ? "" : "s")]); return o; }
function changeFormHtml(c, scenario, ctx){
  var f = [];
  if(c.kind === "rent" || c.kind === "cost"){
    f.push(field(c, scenario, "what", "What", "text"), field(c, scenario, "amount", "Amount", "number"), field(c, scenario, "freq", "How often", "select", FREQS));
    f = f.concat(whenFields(c, scenario, "From"));
  } else if(c.kind === "ip"){
    var people = getTaxPeople();
    var fig = ipFigures(c, { marginalRate: ctx.marginalRateFor(c.owner), taxEffect: ctx.taxEffectFor ? function(tx){ return ctx.taxEffectFor(c.owner, tx); } : null });
    // v3.193.0 (item 224): its figures first, then the fields in groups, the rarer ones folded.
    f.push('<p class="scf-figs"><span>Rent less costs and loan: <b>' + signed(fig.cashBeforeTaxMonthly) + '/mo</b></span><span>Tax effect: <b>' + signed(fig.taxEffectYearly / 12) + '/mo</b> (on a ' + (fig.taxableYearly < 0 ? 'loss' : 'profit') + ' of ' + fmtCurrency0.format(Math.abs(fig.taxableYearly)) + ' a year)</span>' +
      '<span>After tax: <b>' + signed(fig.cashAfterTaxMonthly) + '/mo</b></span><span>Cash at settlement: <b>' + fmtCurrency0.format(fig.upfront) + '</b> (deposit ' + fmtCurrency0.format(fig.deposit) + ', stamp duty ' + fmtCurrency0.format(fig.stampDuty) + (fig.lmi ? ', LMI ' + fmtCurrency0.format(fig.lmi) : '') + ', other costs)</span></p>');
    var when = whenFields(c, scenario, "Bought");
    return f.join("") +
      group("Price and loan", [field(c, scenario, "what", "Name", "text"), field(c, scenario, "price", "Price", "number"), field(c, scenario, "state", "State", "select", PURCHASE_STATE_CODES),
        field(c, scenario, "depositPct", "Deposit %", "number"), field(c, scenario, "rate", "Interest %", "number"), field(c, scenario, "repaymentType", "Loan", "select", [["IO", "Interest only"], ["PI", "Principal & interest"]]),
        field(c, scenario, "termYears", "Term (years)", "number")]) +
      group("Rent", [field(c, scenario, "rentWeekly", "Rent a week", "number"), field(c, scenario, "vacancyWeeks", "Weeks vacant a year", "number"), field(c, scenario, "mgmtPct", "Management %", "number")]) +
      group("Costs and tax", [field(c, scenario, "costsYearly", "Costs a year", "number"), field(c, scenario, "depreciationYearly", "Depreciation a year", "number")]) +
      group("More — growth, owner, when it's bought", [field(c, scenario, "growthPct", "Growth % a year", "number", ' placeholder="Projection\'s rate"'),
        field(c, scenario, "owner", "Owner", "select", [["", people.length > 1 ? "Shared evenly" : "The household"]].concat(people.map(function(p){ return [p, p]; }))), when[0], when[1]], !(fieldMarks.growthPct || fieldMarks.owner || fieldMarks.when || fieldMarks.whenCash || fieldMarks.whenAge || fieldMarks.fromYear) && !c.when && !Number(c.fromYear));
  } else if(c.kind === "extra"){
    var loaned = (state.properties || []).filter(function(p){ return (p.loans || []).length; }).map(function(p){ return [p.id, p.what || "A property"]; });
    f.push(field(c, scenario, "propertyId", "Loan on", "select", loaned.length ? loaned : [["", "No property loans yet"]]), field(c, scenario, "amount", "Extra", "number"),
      field(c, scenario, "freq", "How often", "select", FREQS), field(c, scenario, "rate", "Its interest %", "number"));
    f = f.concat(whenFields(c, scenario, "From"));
  } else if(c.kind === "sell"){
    var props = (state.properties || []).map(function(p){ return [p.id, p.what || "A property"]; });
    f.push(field(c, scenario, "propertyId", "Property", "select", props.length ? props : [["", "No properties yet"]]), whenFields(c, scenario, "Sold")[0], whenFields(c, scenario, "Sold")[1],
      field(c, scenario, "sellingCostsPct", "Selling costs %", "number"),
      // v3.186.0 (item 217): how it was used decides the capital gains tax.
      field(c, scenario, "use", "Lived in it", "select", [["", "As its kind says"], ["never", "Never"], ["home", "Our home throughout"], ["former", "Our home, then rented out"]]));
    if(c.use === "former") f.push(field(c, scenario, "movedOut", "Moved out", "date"));
    f.push('<p class="scf-figs"><span>Capital gains tax: half the gain after a year, at the owners\' tax; none on the home you live in, and none on a former home sold within six years of moving out (past that, the share of time beyond the six years). An estimate — the cost base resetting to market value when first rented isn\'t applied.</span></p>');
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
  var draftName = isDraftKey(scenario) ? scenario.slice(DRAFT_PREFIX.length) : null;
  var rows = all.map(function(c){
    if(c.kind === "amount") return amountChangeHtml(c, scenario);
    // v3.194.0 (item 225): said in the scenario's header, with what it costs, when it's being edited.
    if(c.kind === "home") return draftName ? '' : '<div class="sc-change"><span class="sc-what"><b>Lives somewhere else</b><small>Its home costs are listed under Recurring costs below; today\'s home lines are left out.</small></span></div>';
    // v3.177.0 (item 204): kept from a what-if on Projections — they change the projection, not the month.
    if(c.kind === "assume" || c.kind === "retire") return '<div class="sc-change"><span class="sc-what"><b>' + escapeAttr(changeSummary(c)) + '</b><small>' +
        (c.kind === "retire" ? "In the projection, living costs come out of savings from then" : "Used for this scenario's projection instead of the household's") + '</small></span>' +
      '<button type="button" class="btn btn-danger btn-sm" data-sc-del="' + escapeAttr(c.id) + '" data-sc-scenario="' + escapeAttr(scenario) + '" aria-label="' + escapeAttr("Remove: " + changeSummary(c)) + '">✕</button></div>';
    var m = legsMonthly([c], ctx), effect = m.incomeMonthly - m.expensesMonthly;
    var open = !!changeOpen[c.id];
    // v3.191.0 (item 222): against the saved scenario, while editing its draft.
    var status = draftName ? changeStatus(draftName, c.id) : "same";
    fieldMarks = draftName && status === "changed" ? changedFields(draftName, c.id) : {};
    var badge = status === "same" ? "" : '<span class="sc-badge">' + (status === "new" ? "New" : "Changed") + '</span>';
    var undo = status === "same" ? "" : '<button type="button" class="link-btn sc-undo" data-sc-reset="' + escapeAttr(c.id) + '" data-sc-scenario="' + escapeAttr(scenario) + '">' + (status === "new" ? "Take out" : "Back to saved") + '</button>';
    return '<div class="sc-change sc-leg' + (open ? " is-open" : "") + '"><button type="button" class="sc-what sc-leg-head" data-sc-toggle="' + escapeAttr(c.id) + '" aria-expanded="' + open + '"><b>' + escapeAttr(changeSummary(c, { money: function(n){ return fmtCurrency0.format(n); }, propertyName: propName })) + startsText(c) + badge + '</b>' +
        (c.kind === "sell" ? '<small>Its equity becomes cash that year, and its rent, costs and loan stop</small>'
          : c.kind === "extra" ? '<small>' + signed(effect) + '/mo from savings, into the loan — kept as equity</small>'
          : '<small>' + signed(effect) + '/mo' + (c.kind === "ip" ? ' after tax · ' + fmtCurrency0.format(m.upfront) + ' at settlement' : '') + '</small>') + '</button>' +
      '<button type="button" class="btn btn-danger btn-sm" data-sc-del="' + escapeAttr(c.id) + '" data-sc-scenario="' + escapeAttr(scenario) + '" aria-label="' + escapeAttr("Remove: " + changeSummary(c, { propertyName: propName })) + '">✕</button>' +
      undo + (open ? changeFormHtml(c, scenario, ctx) : '') + '</div>';
  }).join("");
  // v3.190.0 (item 221): one "+ Add a change" (a sheet of the kinds); a scenario with none offers three to start from.
  var real = all.filter(function(c){ return c && c.kind !== "home"; });
  var starter = function(kind, label){ return '<button type="button" class="sc-starter" data-sc-new="' + kind + '" data-sc-scenario="' + escapeAttr(scenario) + '">' + label + '</button>'; };
  return '<div class="sc-changes"><div class="home-recurring-label">Changes from today</div>' + rows +
    (real.length ? '' : '<div class="sc-empty"><p>Nothing differs from today yet. Start with one of these, or add anything else:</p><div class="sc-starters">' +
      starter("rent", "<b>Rent somewhere new</b><small>a bigger place, a cheaper one</small>") + starter("ip", "<b>Buy an investment property</b><small>its rent, costs, loan and tax</small>") +
      starter("cost", "<b>A new cost or saving</b><small>childcare, a car, a gym you'd stop</small>") + '</div></div>') +
    '<div class="sc-adders"><button type="button" class="btn btn-sm" data-sc-addsheet="' + escapeAttr(scenario) + '">+ Add a change</button></div>' +
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

// The kinds of change, each with what it's for (v3.190.0, item 221).
export var addSheet = { open: false, scenario: null };
export function addChangeSheetHtml(){
  if(!addSheet.open) return "";
  var scenario = addSheet.scenario;
  var hasLoan = (state.properties || []).some(function(p){ return (p.loans || []).length; });
  var items = CHANGE_KINDS.filter(function(k){ return k.key !== "amount"; }).map(function(k){
    var off = (k.key === "sell" && !(state.properties || []).length) ? "There's no property to sell yet" : (k.key === "extra" && !hasLoan) ? "There's no property loan yet" : "";
    return '<button type="button" class="sq-choice" data-sc-new="' + k.key + '" data-sc-scenario="' + escapeAttr(scenario) + '"' + (off ? ' disabled title="' + escapeAttr(off) + '"' : '') + '><b>' + escapeAttr(k.label) + '</b><small>' + escapeAttr(off || k.hint) + '</small></button>';
  }).join("");
  return '<div class="review-backdrop" data-acs-backdrop><div class="review-panel sq-panel" role="dialog" aria-modal="true" aria-label="Add a change">' +
    '<div class="review-head"><h4>Add a change</h4><button type="button" class="icon-btn" data-acs-close aria-label="Close">✕</button></div>' +
    '<div class="sq-choices">' + items + '</div>' +
    '<p class="ledger-note" style="margin:10px 0 0">A line in your budget or pay that would cost (or pay) a different amount: choose it under the changes, beside "A line costs a different amount".</p></div></div>';
}
