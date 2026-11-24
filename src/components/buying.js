// ---------------- Buying a home (November 2026) — calc/purchase.js ----------------
//
// The owner, part-way through buying a home to live in: the app had nowhere for a purchase that hasn't settled, and
// "+ Add property" made a blank investment property that said it was negatively geared at $0. Now "+ Add property"
// asks what it is (a home or an investment) and whether it's owned or being bought; one being bought gets a Buying
// card here — Today's hero style: the price and the days to settlement, what's paid so far, what's still to find,
// the cash needed at settlement against the cash on hand, and its costs ticked off as they're paid — until "Settled"
// makes it an ordinary property. Listeners: buyingwiring.js.
import { state } from "../state.js";
import { purchaseFigures, commonCostsToAdd, payingAccounts, LENDER_SOURCES, loanHoldsFees } from "../calc/purchase.js";
import { propertiesOffsetTotal } from "../calc/property.js";
import { toAudAmount } from "../calc/engine.js";
import { fmtCurrency0, fmtCompact, fmtDate, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { fieldHtml, pillsHtml, switchHtml } from "../lib/field.js";
import { stackBarHtml } from "../lib/bars.js";
import { keepUi } from "../lib/keepui.js";
import { purchaseFromTransactions, propertySuggestions, costTransactions, shortDate } from "../calc/propertymoney.js";
import { costTransactionsHtml } from "./propertymoney.js";

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
function costRowHtml(p, c, fc, autoFigure, accounts){
  var base = "buy-" + p.id + "-" + c.id, fa = function(k){ return { "data-cost-field": k }; };
  var kind = fc.kind, financed = fc.financed, withheld = fc.withheld && !financed;
  var chips = [];
  // November 2026: paid by a transaction — its date and account say so (calc/propertymoney.js).
  var txs = costTransactions(state, p.id, c.id), last = txs[txs.length - 1];
  if(autoFigure) chips.push('<span class="bc-chip">Worked out</span>');
  if(financed) chips.push('<span class="bc-chip in">Added to the loan</span>');
  else if(withheld) chips.push('<span class="bc-chip in">Taken from the loan</span>');
  else if(txs.length) chips.push('<span class="bc-chip good">Paid · ' + (txs.length > 1 ? txs.length + ' transactions' : escapeAttr(shortDate(last.date)) + (last.account ? ', ' + escapeAttr(last.account) : '')) + '</span>');
  else if(c.paid) chips.push('<span class="bc-chip good">Paid · no transaction</span>');
  if(c.tbc) chips.push('<span class="bc-chip warn">Amount to come</span>');
  if(fc.unclassified) chips.push('<span class="bc-chip warn">Purchase or loan?</span>');
  var shown = c.tbc && !(fc.amount > 0) ? "To come" : money(fc.amount);
  var amount = autoFigure ? "" : (Number(c.amount) || "");
  // #452: how it's paid — in cash (yours), taken by the lender out of the money it releases, or (a loan's fee) added to
  // the loan and taken straight back. Paid in cash, it can come from an account, off whose balance it goes.
  var paidWith = financed ? "loan" : withheld ? "withheld" : "cash";
  var withOpts = [{ value: "cash", label: "Cash" }, { value: "withheld", label: "Taken from the loan money" }].concat(kind === "loan" ? [{ value: "loan", label: "Added to the loan" }] : []);
  var withHelp = financed ? "Borrowed, then taken back by the lender — in the loan once, not cash you need." + (Number(p.grossLoan) > 0 ? "" : " If the loan amount above already includes it, type that figure in “Lender's approved loan” instead.") :
    withheld ? "The lender keeps it out of the money it releases — not cash you bring." : "Paid by you, at or before settlement.";
  var known = accounts.some(function(a){ return a.id === c.paidFrom; });
  var acctOpts = [{ value: "", label: "Not from an account" }].concat(accounts.map(function(a){ return { value: a.id, label: a.name + (a.balance != null ? " · " + money(a.balance) : "") }; }),
    c.paidFrom && !known ? [{ value: c.paidFrom, label: "An account (deleted)" }] : []);
  return '<li><details class="buy-cost' + (c.paid && !fc.withheld ? ' is-paid' : '') + '" data-buy-cost="' + escapeAttr(c.id) + '"' + (buyUi.open[c.id] ? ' open' : '') + '>' +
    '<summary><span class="bc-name">' + escapeAttr(c.what || "A cost") + (chips.length ? '<small>' + chips.join("") + '</small>' : '') + '</span><b class="bc-amt">' + shown + '</b></summary>' +
    '<div class="bc-edit">' +
      fieldHtml({ id: base + "-what", label: "What it is", box: true, value: c.what || "", attrs: fa("what") }) +
      fieldHtml({ id: base + "-amount", label: "Amount", type: "money", value: amount, placeholder: autoFigure ? String(Math.round(fc.amount)) : "", attrs: fa("amount"),
        help: autoFigure ? "Worked out from the price and state — type an amount to use your own." : "" }) +
      switchHtml({ id: base + "-tbc", label: "Amount still to come", sub: "Charged at cost — fill it in when the bill comes", checked: !!c.tbc, attrs: fa("tbc") }) +
      pillsHtml({ id: base + "-kind", label: "It's for", name: base + "-kind", value: fc.unclassified ? "" : kind, attrs: fa("kind"), options: [{ value: "purchase", label: "The purchase" }, { value: "loan", label: "The loan" }],
        help: fc.unclassified ? "Its name doesn't say — choose, so it goes to the right place at settlement." : "" }) +
      pillsHtml({ id: base + "-with", label: "Paid with", name: base + "-with", value: paidWith, attrs: fa("paidWith"), options: withOpts, help: withHelp }) +
      (fc.withheld ? "" : txs.length ? costTransactionsHtml(state, p, c.id) : costTransactionsHtml(state, p, c.id) + (accounts.length ? fieldHtml({ id: base + "-from", label: "Paid from", type: "select", box: true, value: c.paidFrom || "", options: acctOpts, attrs: fa("paidFrom"),
          help: "Ticked Paid, it comes off this account's balance; unticked, it goes back." }) : "") +
        switchHtml({ id: base + "-paid", label: "Paid another way", sub: c.paid ? (c.paidTaken ? money(c.paidTaken) + " taken off the account" : "Counted in what's paid so far — no transaction of yours") : "Not yet — counted in cash at settlement. Paid by the lender or from someone else's account? Tick it.", checked: !!c.paid, attrs: fa("paid") })) +
      '<button type="button" class="btn btn-danger btn-sm" data-buy-cost-del aria-label="' + escapeAttr("Remove " + (c.what || "cost")) + '">Remove</button>' +
    '</div></details></li>';
}

// #452: settlement, line by line — the price, less the deposit, less what the lender releases (its gross less what it
// keeps for fees), plus the costs still to pay yourself: the cash to bring. Then the lender's own figure against the
// purchase's, when it's been typed.
function reconHtml(p, f){
  var row = function(k, v, sub, cls){ return '<div class="recon-row' + (cls ? " " + cls : "") + '"><dt>' + k + (sub ? '<small>' + escapeAttr(sub) + '</small>' : '') + '</dt><dd>' + v + '</dd></div>'; };
  var src = f.lender ? (LENDER_SOURCES.find(function(x){ return x.value === f.lender.source; }) || { label: "letter" }).label.toLowerCase() : "";
  var lenderLine = !f.lender ? '<p class="recon-note">Type the loan amount on the lender\'s letter (under The purchase) to check these against it.</p>'
    : Math.abs(f.lender.variance) < 1 ? '<p class="recon-note is-good">Matches the lender\'s ' + escapeAttr(src) + ': ' + money(f.lender.gross) + '.</p>'
    : '<p class="recon-note is-warn">The lender\'s ' + escapeAttr(src) + ' says <b>' + money(f.lender.gross) + '</b>; the loan and the fees added to it make ' + money(f.lender.own) + ' — ' +
      money(Math.abs(f.lender.variance)) + (f.lender.variance > 0 ? ' more' : ' less') + ' from the lender. Check the loan amount, and which fees are added to it.</p>';
  var spare = f.released > Math.max(0, f.price - f.deposit) ? '<p class="recon-note">The lender releases ' + money(f.released - Math.max(0, f.price - f.deposit)) + ' more than the balance of the price — it goes toward the costs.</p>' : "";
  return '<div class="buy-recon"><div class="fsec">Settlement, line by line</div><dl class="recon">' +
    row("Price", money(f.price)) +
    row("− Deposit paid", money(f.deposit)) +
    row("− What the lender releases", money(f.released), "the loan " + money(f.borrowed) + (f.withheld > 0 ? " less " + money(f.withheld) + " it keeps for fees" : "")) +
    row("+ Costs you still pay", money(f.costsToPay)) +
    row("= Cash you bring", money(f.cashNeeded), "", "is-total") +
  '</dl>' + lenderLine + spare +
  (f.unclassified ? '<p class="recon-note is-warn">' + f.unclassified + ' cost' + (f.unclassified === 1 ? " doesn't" : "s don't") + ' say if it\'s for the purchase or the loan — open it to choose.</p>' : '') + '</div>';
}

// One purchase's card. `cash` is the cash on hand (cashOnHand()); `today` an ISO date.
export function purchaseCardHtml(p, cash, today){
  // November 2026: the costs as the transactions that paid them say (calc/propertymoney.js) — recorded once.
  var fed = purchaseFromTransactions(state, p);
  var stored = p;
  p = fed.purchase;
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
    '<div class="buy-tile"><span>Paid so far</span><b>' + money(f.paidSoFar) + '</b><small>' + (fed.count ? 'from ' + fed.count + ' of your transactions' : 'deposit ' + money(f.deposit) + ' · costs ' + money(f.costsPaid)) + '</small></div>' +
    '<div class="buy-tile ' + (f.short == null ? '' : covered ? 'is-good' : 'is-short') + '"><span>Cash at settlement</span><b>' + money(f.cashNeeded) + '</b>' +
      '<small>' + (f.short == null ? 'the balance and costs still to pay' : covered ? 'covered by ' + money(f.cashOnHand) + ' in cash and offsets' : money(f.short) + ' more than the ' + money(f.cashOnHand) + ' in cash and offsets') + '</small></div>' +
  '</div>';
  var id = function(k){ return "buy-" + p.id + "-" + k; };
  var fa = function(k){ return { "data-buy-field": k }; };
  var holds = loanHoldsFees(p);
  // Open while something it needs is missing; its heading says what's inside, so a folded one reads as a way in.
  var fields = '<details class="buy-fold"' + (f.price > 0 && p.settlementDate ? '' : ' open') + '><summary><span>The purchase<small>Name, price, deposit, loan, dates, state</small></span><span class="buy-fold-edit" aria-hidden="true">Edit</span></summary><div class="buy-fields">' +
    fieldHtml({ id: id("what"), label: "Name or address", box: true, wide: true, value: p.what || "", attrs: fa("what") }) +
    fieldHtml({ id: id("kind"), label: "It's", type: "select", box: true, wide: true, value: p.kind === "IP" ? "IP" : "PPOR", options: [{ value: "PPOR", label: "A home to live in" }, { value: "IP", label: "An investment" }], attrs: fa("kind") }) +
    fieldHtml({ id: id("price"), label: "Contract price", type: "money", wide: true, value: p.price, attrs: fa("price") }) +
    fieldHtml({ id: id("deposit"), label: "Deposit paid", type: "money", value: p.deposit, attrs: fa("deposit") }) +
    fieldHtml({ id: id("loanAmount"), label: "Loan amount", type: "money", value: p.loanAmount, attrs: fa("loanAmount") }) +
    '<p class="field-help span2">The deposit is held until settlement, so it counts in net worth. The loan amount is before any fee added to it — add those as costs below.</p>' +
    (holds ? '<p class="field-help span2 buy-loan-warn">This loan amount looks like it already includes ' + escapeAttr(holds.fees.join(", ")) + ' (' + money(holds.amount) + '), also added to the loan below — so it\'s borrowed twice. If it\'s the lender\'s figure, put it in “Lender\'s approved loan” and ' + money(holds.base) + ' here.</p>' : '') +
    fieldHtml({ id: id("grossLoan"), label: "Lender's approved loan", type: "money", value: p.grossLoan || "", attrs: fa("grossLoan"),
      help: "The total on its letter, fees added to the loan included. Optional — it checks the figures below." }) +
    fieldHtml({ id: id("lenderSource"), label: "From its", type: "select", box: true, value: p.lenderSource || "", attrs: fa("lenderSource"),
      options: [{ value: "", label: "Not said" }].concat(LENDER_SOURCES) }) +
    fieldHtml({ id: id("rate"), label: "Loan rate", type: "number", box: true, value: p.rate, unit: "%", attrs: Object.assign({ min: "0", max: "25", step: "0.01", inputmode: "decimal" }, fa("rate")) }) +
    fieldHtml({ id: id("contractDate"), label: "Contract signed", type: "date", box: true, value: p.contractDate || "", attrs: fa("contractDate") }) +
    fieldHtml({ id: id("settlementDate"), label: "Settlement date", type: "date", box: true, value: p.settlementDate || "", attrs: fa("settlementDate") }) +
    fieldHtml({ id: id("stateCode"), label: "State", type: "select", box: true, value: p.stateCode || "", options: [{ value: "", label: "Not set" }].concat(STATES.map(function(s){ return { value: s, label: s }; })), help: "For stamp duty.", attrs: fa("stateCode") }) +
    fieldHtml({ id: id("firstHome"), label: "First home buyer", type: "select", box: true, value: p.firstHome ? "yes" : "no", options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }], attrs: fa("firstHome") }) +
  '</div></details>';
  var autoOn = f.stampDuty != null, accounts = payingAccounts(state);
  var group = function(kind, title){
    var rows = (p.costs || []).filter(function(c){ return (byId[c.id] || {}).kind === kind; });
    if(!rows.length) return "";
    var total = rows.reduce(function(t, c){ return t + ((byId[c.id] || {}).amount || 0); }, 0);
    return '<div class="bc-group"><div class="fsec">' + title + ' <small class="bc-total">' + money(total) + '</small></div><ul class="buy-cost-list">' +
      rows.map(function(c){ return costRowHtml(p, c, byId[c.id], !!c.auto && !(Number(c.amount) > 0) && autoOn, accounts); }).join("") + '</ul></div>';
  };
  // November 2026 (the Property, Tax and Settings review): paid and still to pay as the bar and the tiles say them — the
  // deposit counts as paid, and still to pay is the cash at settlement (the price's balance with the costs). It said
  // "$509 paid" under a deposit marked Paid and a bar reading "Paid so far $65.5k".
  var said = [money(f.paidSoFar) + ' paid', money(f.cashNeeded) + ' still to pay' + (f.balanceAtSettlement > 0.5 && f.costsToPay > 0.5 ? ' (' + money(f.costsToPay) + ' of it costs)' : '')].concat(f.financed ? [money(f.financed) + ' added to the loan'] : [])
    .concat(f.withheld - f.financed > 0.5 ? [money(f.withheld - f.financed) + ' taken from the loan'] : []).concat(f.toConfirm ? [f.toConfirm + ' to confirm'] : []);
  var depTx = costTransactions(state, p.id, "deposit");
  var depositRow = '<div class="bc-group"><div class="fsec">The deposit <small class="bc-total">' + money(f.deposit) + '</small></div><ul class="buy-cost-list"><li><details class="buy-cost' + (depTx.length ? ' is-paid' : '') + '" data-buy-cost="deposit"' + (buyUi.open.deposit ? ' open' : '') + '>' +
    '<summary><span class="bc-name">Deposit<small>' + (depTx.length ? '<span class="bc-chip good">Paid · ' + depTx.length + ' transaction' + (depTx.length === 1 ? '' : 's') + '</span>' : '<span class="bc-chip">Typed under The purchase</span>') + '</small></span><b class="bc-amt">' + money(f.deposit) + '</b></summary>' +
    '<div class="bc-edit">' + costTransactionsHtml(state, p, "deposit") + '<p class="field-help">Held by the agent or a solicitor until settlement — counted in your net worth as “Deposit held”. Its amount is the one under The purchase.</p></div></details></li></ul></div>';
  var costs = '<div class="buy-costs"><h4 class="buy-sub">Deposit and costs <small>' + said.join(" · ") + '</small></h4>' +
    depositRow + group("purchase", "For the purchase") + group("loan", "For the loan") +
    '<div class="bc-add"><span class="bc-add-k">Add</span>' + commonCostsToAdd(p).map(function(q){
      return '<button type="button" class="bc-quick" data-buy-cost-quick="' + escapeAttr(q.what) + '">+ ' + escapeAttr(q.what) + '</button>';
    }).join("") + '<button type="button" class="bc-quick" data-buy-cost-add>+ Another</button></div></div>';
  var actions = '<div class="buy-actions">' +
    '<button type="button" class="btn btn-primary" data-buy-settled>Settled — make it a property</button>' +
    '<button type="button" class="btn btn-danger btn-sm" data-buy-remove>Remove</button></div>';
  return '<section class="buy-card" data-purchase="' + escapeAttr(p.id) + '" data-part="property" aria-label="' + escapeAttr("Buying " + name) + '">' + hero +
    '<div class="buy-body">' + bar + borrowedLine + tiles + suggestBannerHtml(stored, today) + fields + costs + reconHtml(p, f) + actions + '</div></section>';
}

// The purchase's figures as its transactions say — for the settlement sheet.
export function purchaseCardFigures(p){ return purchaseFigures(purchaseFromTransactions(state, p).purchase, localDateStr(), cashOnHand()); }
// November 2026: a transaction that looks like this purchase's and isn't linked yet — the first, with one tap to link it.
function suggestBannerHtml(p, today){
  var list = propertySuggestions(state, today || localDateStr(), state.tidyOk || {}).filter(function(x){ return x.to.id === p.id; });
  if(!list.length) return "";
  var x = list[0], t = x.t;
  var label = x.cost ? "Link to " + (x.costName || "the cost") : "Link as a new cost";
  return '<div class="buy-suggest" role="group" aria-label="' + escapeAttr(list.length + " transaction" + (list.length === 1 ? " looks" : "s look") + " like this purchase") + '">' +
    '<b>' + list.length + ' transaction' + (list.length === 1 ? ' looks' : 's look') + ' like this purchase</b>' +
    '<span>“' + escapeAttr(t.what || "A transaction") + '” ' + money(t.amount) + ' on ' + escapeAttr(shortDate(t.date)) + (x.costName ? ' — the ' + escapeAttr(x.costName.toLowerCase()) + '?' : '') + '</span>' +
    '<span class="buy-suggest-actions"><button type="button" class="btn btn-sm btn-primary" data-buy-suggest="' + x.index + '" data-buy-suggest-cost="' + escapeAttr(x.cost || "new") + '">' + escapeAttr(label) + '</button>' +
    '<button type="button" class="btn btn-sm btn-ghost" data-buy-suggest-no="' + escapeAttr(x.id) + '">Not this purchase</button></span></div>';
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

