// ---------------- Buying a home (November 2026) — calc/purchase.js ----------------
//
// The owner, part-way through buying a home to live in: the app had nowhere for a purchase that hasn't settled, and
// "+ Add property" made a blank investment property that said it was negatively geared at $0. Now "+ Add property"
// asks what it is (a home or an investment) and whether it's owned or being bought; one being bought gets a Buying
// card here — Today's hero style: the price and the days to settlement, what's paid so far, what's still to find,
// the cash needed at settlement against the cash on hand, and its costs ticked off as they're paid — until "Settled"
// makes it an ordinary property. Listeners: buyingwiring.js.
import { state } from "../state.js";
import { purchaseFigures, purchasePlans } from "../calc/purchase.js";
import { propertiesOffsetTotal } from "../calc/property.js";
import { toAudAmount } from "../calc/engine.js";
import { fmtCurrency0, fmtCompact, fmtDate, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { fieldHtml } from "../lib/field.js";
import { stackBarHtml } from "../lib/bars.js";
import { keepUi } from "../lib/keepui.js";

var STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "ACT", "NT"];
function money(n){ return fmtCurrency0.format(Math.round(Number(n) || 0)); }

// What's on hand to settle with: cash accounts and offsets (the emergency fund's measure).
export function cashOnHand(){
  return (state.assets || []).filter(function(a){ return a.category === "Cash"; })
    .reduce(function(s, a){ return s + toAudAmount(a, Number(a.amount) || 0); }, 0) + propertiesOffsetTotal();
}

function settleText(f, p, today){
  if(f.days == null) return "Add the settlement date";
  if(f.days < 0) return "Settlement was " + fmtDate(p.settlementDate) + " — mark it settled";
  if(f.days === 0) return "Settles today";
  return "Settles in " + f.days + " day" + (f.days === 1 ? "" : "s") + " · " + fmtDate(p.settlementDate, today && String(p.settlementDate).slice(0, 4) !== String(today).slice(0, 4) ? { year: true } : undefined);
}

function costRowHtml(p, c, figure){
  var base = "buy-" + p.id + "-" + c.id;
  var amount = c.auto && figure.auto ? "" : (Number(c.amount) || "");
  return '<li class="buy-cost' + (c.paid ? ' is-paid' : '') + '" data-buy-cost="' + escapeAttr(c.id) + '">' +
    '<label class="buy-cost-paid"><input type="checkbox" data-cost-field="paid"' + (c.paid ? ' checked' : '') + ' aria-label="' + escapeAttr((c.what || "Cost") + " paid") + '"><span aria-hidden="true">Paid</span></label>' +
    '<input type="text" class="field-control field-compact" id="' + escapeAttr(base + "-what") + '" data-cost-field="what" value="' + escapeAttr(c.what || "") + '" aria-label="What it is" placeholder="What it is">' +
    '<input type="number" inputmode="decimal" min="0" step="1" class="field-control field-compact buy-cost-amount" id="' + escapeAttr(base + "-amount") + '" data-cost-field="amount" value="' + escapeAttr(String(amount)) + '"' +
      ' aria-label="' + escapeAttr((c.what || "Cost") + " amount") + '" placeholder="' + escapeAttr(c.auto && figure.auto ? money(figure.amount) : "$") + '">' +
    '<button type="button" class="btn btn-danger btn-sm" data-buy-cost-del aria-label="' + escapeAttr("Remove " + (c.what || "cost")) + '">✕</button>' +
    (c.auto && figure.auto ? '<small class="buy-cost-note">Worked out from the price and state — type an amount to use your own.</small>' : '') +
  '</li>';
}

// One purchase's card. `cash` is the cash on hand (cashOnHand()); `today` an ISO date.
export function purchaseCardHtml(p, cash, today){
  var f = purchaseFigures(p, today, cash);
  var byId = {};
  f.costs.forEach(function(c){ byId[c.id] = c; });
  var name = p.what || "A home";
  // The owner couldn't see how to change the name or the settlement date: the settlement chip opens them at the date,
  // and Edit at the name (both in "The purchase", below).
  var heroSub = '<button type="button" class="buy-settle-btn" data-buy-edit="settlementDate">' + escapeAttr(settleText(f, p, today)) + (f.days == null ? ' <span aria-hidden="true">+</span>' : '') + '</button>';
  var hero = '<div class="buy-hero">' +
    '<div class="buy-hero-top"><span class="buy-k">Buying · ' + (p.kind === "IP" ? "an investment" : "a home") + '</span>' +
      '<button type="button" class="buy-edit-btn" data-buy-edit="what" aria-label="' + escapeAttr("Edit " + name) + '"><svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M13.5 3.5l3 3L7 16H4v-3z"/></svg>Edit</button></div>' +
    '<h3 class="buy-name">' + escapeAttr(name) + '</h3>' +
    '<b class="buy-price">' + (f.price > 0 ? fmtCompact(f.price) : "Price —") + '</b>' + heroSub + '</div>';
  // Where the whole cost comes from: what's paid, what the loan brings, what's still to find.
  var bar = f.totalCost > 0 ? stackBarHtml([
    { label: "Paid so far", value: f.paidSoFar, tone: "good" },
    { label: "The loan", value: f.loan, tone: "in" },
    { label: "Still to pay", value: f.cashNeeded, tone: "warn" }
  ], { label: "The whole cost, " + money(f.totalCost), keep: ["Paid so far", "The loan", "Still to pay"] }) : '';
  var covered = f.short === 0;
  var tiles = '<div class="buy-tiles">' +
    '<div class="buy-tile"><span>Paid so far</span><b>' + money(f.paidSoFar) + '</b><small>deposit ' + money(f.deposit) + ' · costs ' + money(f.costsPaid) + '</small></div>' +
    '<div class="buy-tile ' + (f.short == null ? '' : covered ? 'is-good' : 'is-short') + '"><span>Cash at settlement</span><b>' + money(f.cashNeeded) + '</b>' +
      '<small>' + (f.short == null ? 'the balance and costs still to pay' : covered ? 'covered by ' + money(f.cashOnHand) + ' in cash and offsets' : money(f.short) + ' more than the ' + money(f.cashOnHand) + ' in cash and offsets') + '</small></div>' +
  '</div>';
  var id = function(k){ return "buy-" + p.id + "-" + k; };
  var fa = function(k){ return { "data-buy-field": k }; };
  // Open while something it needs is missing; its heading says what's inside, so a folded one reads as a way in.
  var fields = '<details class="buy-fold"' + (f.price > 0 && p.settlementDate ? '' : ' open') + '><summary><span>The purchase<small>Name, price, deposit, loan, dates, state</small></span><span class="buy-fold-edit" aria-hidden="true">Edit</span></summary><div class="buy-fields">' +
    fieldHtml({ id: id("what"), label: "Name or address", value: p.what || "", attrs: fa("what") }) +
    fieldHtml({ id: id("kind"), label: "It's", type: "select", value: p.kind === "IP" ? "IP" : "PPOR", options: [{ value: "PPOR", label: "A home to live in" }, { value: "IP", label: "An investment" }], attrs: fa("kind") }) +
    fieldHtml({ id: id("price"), label: "Contract price", type: "number", value: p.price, unit: "$", attrs: Object.assign({ min: "0", step: "1000", inputmode: "decimal" }, fa("price")) }) +
    fieldHtml({ id: id("deposit"), label: "Deposit paid", type: "number", value: p.deposit, unit: "$", help: "Held until settlement, so it counts in net worth as “Deposit held”.", attrs: Object.assign({ min: "0", step: "1000", inputmode: "decimal" }, fa("deposit")) }) +
    fieldHtml({ id: id("loanAmount"), label: "Loan amount", type: "number", value: p.loanAmount, unit: "$", attrs: Object.assign({ min: "0", step: "1000", inputmode: "decimal" }, fa("loanAmount")) }) +
    fieldHtml({ id: id("rate"), label: "Loan rate", type: "number", value: p.rate, unit: "%", attrs: Object.assign({ min: "0", max: "25", step: "0.01", inputmode: "decimal" }, fa("rate")) }) +
    fieldHtml({ id: id("contractDate"), label: "Contract signed", type: "date", value: p.contractDate || "", attrs: fa("contractDate") }) +
    fieldHtml({ id: id("settlementDate"), label: "Settlement date", type: "date", value: p.settlementDate || "", attrs: fa("settlementDate") }) +
    fieldHtml({ id: id("stateCode"), label: "State", type: "select", value: p.stateCode || "", options: [{ value: "", label: "Not set" }].concat(STATES.map(function(s){ return { value: s, label: s }; })), help: "For stamp duty.", attrs: fa("stateCode") }) +
    fieldHtml({ id: id("firstHome"), label: "First home buyer", type: "select", value: p.firstHome ? "yes" : "no", options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }], attrs: fa("firstHome") }) +
  '</div></details>';
  var costs = '<div class="buy-costs"><h4 class="buy-sub">Costs <small>' + money(f.costsPaid) + ' paid · ' + money(f.costsToPay) + ' to pay</small></h4>' +
    '<ul class="buy-cost-list">' + (p.costs || []).map(function(c){
      var fc = byId[c.id] || { amount: 0 };
      return costRowHtml(p, c, { auto: !!c.auto && !(Number(c.amount) > 0) && f.stampDuty != null, amount: fc.amount });
    }).join("") + '</ul>' +
    '<button type="button" class="btn btn-sm" data-buy-cost-add>+ Add cost</button></div>';
  var actions = '<div class="buy-actions">' +
    '<button type="button" class="btn btn-primary" data-buy-settled>Settled — make it a property</button>' +
    '<button type="button" class="btn btn-danger btn-sm" data-buy-remove>Remove</button></div>';
  return '<section class="buy-card" data-purchase="' + escapeAttr(p.id) + '" data-part="property" aria-label="' + escapeAttr("Buying " + name) + '">' + hero +
    '<div class="buy-body">' + bar + tiles + fields + costs + actions + '</div></section>';
}

export function buyingHtml(purchases, cash, today){
  return (purchases || []).map(function(p){ return purchaseCardHtml(p, cash, today); }).join("");
}

// Replacing the card takes away the field being typed in, and a browser sends that field's own change as it goes —
// which saves, and asks for this redraw again while it's still being drawn. That one waits until this is done.
var drawing = false, again = false;
export function renderBuying(){
  if(drawing){ again = true; return; }
  drawing = true;
  try { keepUi(drawBuying); } finally { drawing = false; }
  if(again){ again = false; renderBuying(); }
}
function drawBuying(){
  var el = typeof document !== "undefined" && document.getElementById("buyingBody");
  if(!el) return;
  var list = state.purchases || [];
  el.hidden = !list.length;
  el.innerHTML = list.length ? buyingHtml(list, cashOnHand(), localDateStr()) : "";
}

// "+ Add property": what it is, and whether it's owned or being bought — and, being bought, a scenario's plan to
// start from when there is one.
export function addPropertyDialogHtml(plans){
  plans = plans || purchasePlans(state);
  var opt = function(name, value, title, sub, checked){
    return '<label class="pick-card"><input type="radio" name="' + name + '" value="' + value + '"' + (checked ? ' checked' : '') + '><span><b>' + title + '</b><small>' + sub + '</small></span></label>';
  };
  return '<form method="dialog" class="add-prop-form">' +
    '<h2>Add a property</h2>' +
    '<fieldset class="pick-group"><legend>It\'s</legend>' +
      opt("addPropKind", "PPOR", "A home to live in", "Its value, loan and costs", true) +
      opt("addPropKind", "IP", "An investment", "Rent, costs, tax and gearing too", false) + '</fieldset>' +
    '<fieldset class="pick-group"><legend>Is it</legend>' +
      opt("addPropStage", "own", "Already ours", "Settled — enter what it's worth and its loan", true) +
      opt("addPropStage", "buying", "Being bought", "Contract signed or about to be — track the deposit and costs to settlement", false) + '</fieldset>' +
    fieldHtml({ id: "addPropName", label: "Name or address", placeholder: "e.g. 1 Example St" }) +
    (plans.length ? '<div class="add-prop-plan" hidden>' + fieldHtml({ id: "addPropPlan", label: "Start from a plan", type: "select", value: "",
      options: [{ value: "", label: "No — start blank" }].concat(plans.map(function(x){ return { value: x.name, label: x.name + " · " + fmtCompact(Number(x.plan.price) || 0) }; })),
      help: "Its price, deposit, rate and cost estimates, from the scenario's purchase." }) + '</div>' : '') +
    '<div class="add-prop-actions"><button class="btn btn-sm btn-ghost" value="cancel" formnovalidate>Cancel</button><button class="btn btn-sm btn-primary" value="ok" data-add-prop-ok>+ Add property</button></div>' +
  '</form>';
}
