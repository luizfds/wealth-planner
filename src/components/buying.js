// ---------------- Buying a home (November 2026) — calc/purchase.js ----------------
//
// The owner, part-way through buying a home to live in: the app had nowhere for a purchase that hasn't settled, and
// "+ Add property" made a blank investment property that said it was negatively geared at $0. Now "+ Add property"
// asks what it is (a home or an investment) and whether it's owned or being bought; one being bought gets a Buying
// card here — Today's hero style: the price and the days to settlement, what's paid so far, what's still to find,
// the cash needed at settlement against the cash on hand, and its costs ticked off as they're paid — until "Settled"
// makes it an ordinary property. Listeners: buyingwiring.js.
import { state } from "../state.js";
import { purchaseFigures, purchasePlans, commonCostsToAdd } from "../calc/purchase.js";
import { propertiesOffsetTotal } from "../calc/property.js";
import { toAudAmount } from "../calc/engine.js";
import { fmtCurrency0, fmtCompact, fmtDate, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { fieldHtml, pillsHtml, switchHtml } from "../lib/field.js";
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

// Which cost rows are open (this visit): a cost just added opens, ready to type its amount.
export var buyUi = { open: {} };

// A cost: one line — what it is, a word on where it stands, its amount — that opens to edit it (November 2026, the
// floating-label style). What it's for decides where it goes at settlement; a loan's cost can be added to the loan
// (the owner's low-deposit fee) instead of paid in cash; an amount can be still to come ("at cost").
function costRowHtml(p, c, fc, autoFigure){
  var base = "buy-" + p.id + "-" + c.id, fa = function(k){ return { "data-cost-field": k }; };
  var kind = fc.kind, financed = fc.financed;
  var chips = [];
  if(autoFigure) chips.push('<span class="bc-chip">Worked out</span>');
  if(financed) chips.push('<span class="bc-chip in">Added to the loan</span>');
  else if(c.paid) chips.push('<span class="bc-chip good">Paid</span>');
  if(c.tbc) chips.push('<span class="bc-chip warn">Amount to come</span>');
  var shown = c.tbc && !(fc.amount > 0) ? "To come" : money(fc.amount);
  var amount = autoFigure ? "" : (Number(c.amount) || "");
  return '<li><details class="buy-cost' + (c.paid && !financed ? ' is-paid' : '') + '" data-buy-cost="' + escapeAttr(c.id) + '"' + (buyUi.open[c.id] ? ' open' : '') + '>' +
    '<summary><span class="bc-name">' + escapeAttr(c.what || "A cost") + (chips.length ? '<small>' + chips.join("") + '</small>' : '') + '</span><b class="bc-amt">' + shown + '</b></summary>' +
    '<div class="bc-edit">' +
      fieldHtml({ id: base + "-what", label: "What it is", box: true, value: c.what || "", attrs: fa("what") }) +
      fieldHtml({ id: base + "-amount", label: "Amount", type: "money", value: amount, placeholder: autoFigure ? String(Math.round(fc.amount)) : "", attrs: fa("amount"),
        help: autoFigure ? "Worked out from the price and state — type an amount to use your own." : "" }) +
      switchHtml({ id: base + "-tbc", label: "Amount still to come", sub: "Charged at cost — fill it in when the bill comes", checked: !!c.tbc, attrs: fa("tbc") }) +
      pillsHtml({ id: base + "-kind", label: "It's for", name: base + "-kind", value: kind, attrs: fa("kind"), options: [{ value: "purchase", label: "The purchase" }, { value: "loan", label: "The loan" }] }) +
      (kind === "loan" ? pillsHtml({ id: base + "-fin", label: "Paid with", name: base + "-fin", value: financed ? "loan" : "cash", attrs: fa("financed"),
        options: [{ value: "cash", label: "Cash" }, { value: "loan", label: "Added to the loan" }],
        help: financed ? "Borrowed at settlement — not cash you need. It's in the loan's balance from day one." : "A lender's fee you pay yourself, at or before settlement." }) : "") +
      (financed ? "" : switchHtml({ id: base + "-paid", label: "Paid", sub: c.paid ? "Counted in what's paid so far" : "Not yet — counted in cash at settlement", checked: !!c.paid, attrs: fa("paid") })) +
      '<button type="button" class="btn btn-danger btn-sm" data-buy-cost-del aria-label="' + escapeAttr("Remove " + (c.what || "cost")) + '">Remove</button>' +
    '</div></details></li>';
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
    { label: "The loan", value: f.borrowed, tone: "in" },
    { label: "Still to pay", value: f.cashNeeded, tone: "warn" }
  ], { label: "The whole cost, " + money(f.totalCost), keep: ["Paid so far", "The loan", "Still to pay"] }) : '';
  var covered = f.short === 0;
  // What's borrowed when a cost is added to the loan: the loan, what's added, and the two together.
  var borrowedLine = f.financed > 0 ? '<p class="buy-borrowed">Loan ' + money(f.loan) + ' + ' + money(f.financed) + ' added = <b>' + money(f.borrowed) + '</b> borrowed' + (f.lvr != null ? ' · ' + Math.round(f.lvr * 1000) / 10 + '% of the price' : '') + '</p>' : '';
  var tiles = '<div class="buy-tiles">' +
    '<div class="buy-tile"><span>Paid so far</span><b>' + money(f.paidSoFar) + '</b><small>deposit ' + money(f.deposit) + ' · costs ' + money(f.costsPaid) + '</small></div>' +
    '<div class="buy-tile ' + (f.short == null ? '' : covered ? 'is-good' : 'is-short') + '"><span>Cash at settlement</span><b>' + money(f.cashNeeded) + '</b>' +
      '<small>' + (f.short == null ? 'the balance and costs still to pay' : covered ? 'covered by ' + money(f.cashOnHand) + ' in cash and offsets' : money(f.short) + ' more than the ' + money(f.cashOnHand) + ' in cash and offsets') + '</small></div>' +
  '</div>';
  var id = function(k){ return "buy-" + p.id + "-" + k; };
  var fa = function(k){ return { "data-buy-field": k }; };
  // Open while something it needs is missing; its heading says what's inside, so a folded one reads as a way in.
  var fields = '<details class="buy-fold"' + (f.price > 0 && p.settlementDate ? '' : ' open') + '><summary><span>The purchase<small>Name, price, deposit, loan, dates, state</small></span><span class="buy-fold-edit" aria-hidden="true">Edit</span></summary><div class="buy-fields">' +
    fieldHtml({ id: id("what"), label: "Name or address", box: true, wide: true, value: p.what || "", attrs: fa("what") }) +
    fieldHtml({ id: id("kind"), label: "It's", type: "select", box: true, wide: true, value: p.kind === "IP" ? "IP" : "PPOR", options: [{ value: "PPOR", label: "A home to live in" }, { value: "IP", label: "An investment" }], attrs: fa("kind") }) +
    fieldHtml({ id: id("price"), label: "Contract price", type: "money", wide: true, value: p.price, attrs: fa("price") }) +
    fieldHtml({ id: id("deposit"), label: "Deposit paid", type: "money", value: p.deposit, attrs: fa("deposit") }) +
    fieldHtml({ id: id("loanAmount"), label: "Loan amount", type: "money", value: p.loanAmount, attrs: fa("loanAmount") }) +
    '<p class="field-help span2">The deposit is held until settlement, so it counts in net worth. The loan amount is before any fee added to it — add those as costs below.</p>' +
    fieldHtml({ id: id("rate"), label: "Loan rate", type: "number", box: true, value: p.rate, unit: "%", attrs: Object.assign({ min: "0", max: "25", step: "0.01", inputmode: "decimal" }, fa("rate")) }) +
    fieldHtml({ id: id("contractDate"), label: "Contract signed", type: "date", box: true, value: p.contractDate || "", attrs: fa("contractDate") }) +
    fieldHtml({ id: id("settlementDate"), label: "Settlement date", type: "date", box: true, value: p.settlementDate || "", attrs: fa("settlementDate") }) +
    fieldHtml({ id: id("stateCode"), label: "State", type: "select", box: true, value: p.stateCode || "", options: [{ value: "", label: "Not set" }].concat(STATES.map(function(s){ return { value: s, label: s }; })), help: "For stamp duty.", attrs: fa("stateCode") }) +
    fieldHtml({ id: id("firstHome"), label: "First home buyer", type: "select", box: true, value: p.firstHome ? "yes" : "no", options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }], attrs: fa("firstHome") }) +
  '</div></details>';
  var autoOn = f.stampDuty != null;
  var group = function(kind, title){
    var rows = (p.costs || []).filter(function(c){ return (byId[c.id] || {}).kind === kind; });
    if(!rows.length) return "";
    var total = rows.reduce(function(t, c){ return t + ((byId[c.id] || {}).amount || 0); }, 0);
    return '<div class="bc-group"><div class="fsec">' + title + ' <small class="bc-total">' + money(total) + '</small></div><ul class="buy-cost-list">' +
      rows.map(function(c){ return costRowHtml(p, c, byId[c.id], !!c.auto && !(Number(c.amount) > 0) && autoOn); }).join("") + '</ul></div>';
  };
  var said = [money(f.costsPaid) + ' paid', money(f.costsToPay) + ' to pay'].concat(f.financed ? [money(f.financed) + ' added to the loan'] : []).concat(f.toConfirm ? [f.toConfirm + ' to confirm'] : []);
  var costs = '<div class="buy-costs"><h4 class="buy-sub">Costs <small>' + said.join(" · ") + '</small></h4>' +
    group("purchase", "For the purchase") + group("loan", "For the loan") +
    '<div class="bc-add"><span class="bc-add-k">Add</span>' + commonCostsToAdd(p).map(function(q){
      return '<button type="button" class="bc-quick" data-buy-cost-quick="' + escapeAttr(q.what) + '">+ ' + escapeAttr(q.what) + '</button>';
    }).join("") + '<button type="button" class="bc-quick" data-buy-cost-add>+ Another</button></div></div>';
  var actions = '<div class="buy-actions">' +
    '<button type="button" class="btn btn-primary" data-buy-settled>Settled — make it a property</button>' +
    '<button type="button" class="btn btn-danger btn-sm" data-buy-remove>Remove</button></div>';
  return '<section class="buy-card" data-purchase="' + escapeAttr(p.id) + '" data-part="property" aria-label="' + escapeAttr("Buying " + name) + '">' + hero +
    '<div class="buy-body">' + bar + borrowedLine + tiles + fields + costs + actions + '</div></section>';
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
