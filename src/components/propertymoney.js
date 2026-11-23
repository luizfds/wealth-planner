// ---------------- Property money on screen (November 2026) — calc/propertymoney.js ----------------
//
// A transaction's "What it's for" (Budget line · A property · One-off), the property chip a row wears, a purchase's
// costs fed by the transactions that paid them, the settlement checklist, a property's money. Listeners:
// spendingwiring.js (a transaction), buyingwiring.js (a purchase), propertieswiring.js (a property).
import { state } from "../state.js";
import { propertyTargets, propertyOf, propertyCache, purchaseCostChoices, linkEffect, costTransactions, shortDate, settlementCheck, propertySuggestions } from "../calc/propertymoney.js";
import { costAmount } from "../calc/purchase.js";
import { fmtCurrency0, fmtCurrency2 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// Which "What it's for" a transaction's editor shows, by its index, this visit — before a property's been picked.
export var txForUi = { mode: {} };

export function txForMode(t, idx, st){
  st = st || state;
  if(txForUi.mode[idx]) return txForUi.mode[idx];
  if(t.forProperty) return "prop";
  var o = propertyOf(t, st);
  if(o && o.kind === "investment") return "prop";
  return t.linkedExpenseId ? "line" : "oneoff";
}

// A property's chip: purple for a home (or one being bought), blue for an investment.
export function propertyChipHtml(o){
  if(!o) return "";
  return '<span class="pm-chip' + (o.kind === "investment" ? " is-ip" : "") + '"><span aria-hidden="true">⌂ </span>' + escapeAttr(o.name) + '</span>';
}
// The words under a transaction's name when it's a property's: "⌂ 1 Example St · Deposit".
export function propertySubHtml(t, st, cache){
  var o = propertyOf(t, st || state, cache);
  if(!o) return "";
  return propertyChipHtml(o) + (o.what ? " " + escapeAttr(o.what) : "");
}

// The "What it's for" part of a transaction's editor. lineSelectHtml: the existing budget-line <select>.
export function txForHtml(t, idx, lineSelectHtml, st){
  st = st || state;
  var mode = txForMode(t, idx, st);
  var seg = function(key, label){ var on = mode === key; return '<button type="button" class="seg-option' + (on ? " active" : "") + '" aria-pressed="' + on + '" data-tx-for="' + key + '" data-tx-index="' + idx + '">' + label + '</button>'; };
  var targets = propertyTargets(st);
  var html = '<div class="m-edit-field span3 txfor"><span class="field-label" id="txfor-' + idx + '">What it\'s for</span>' +
    '<div class="seg-control txfor-seg" role="group" aria-labelledby="txfor-' + idx + '">' + seg("line", "Budget line") + (targets.length ? seg("prop", "A property") : "") + seg("oneoff", "One-off") + '</div>';
  var target = null;
  if(mode === "line"){
    html += '<div class="txfor-body"><label class="field-label" for="txline-' + idx + '">Budget line</label>' + lineSelectHtml.replace('<select ', '<select id="txline-' + idx + '" ') + '</div>';
    target = { type: "line", lineId: t.linkedExpenseId };
  } else if(mode === "prop"){
    var cache = propertyCache(st), o = propertyOf(t, st, cache);
    var current = o ? o.id : (txForUi.prop && txForUi.prop[idx]) || "";
    html += '<div class="txfor-body"><span class="field-label">Which property</span><div class="txfor-props">' + targets.map(function(x){
      var on = current === x.id;
      return '<button type="button" class="txfor-prop' + (on ? " is-on" : "") + (x.kind === "investment" ? " is-ip" : "") + '" aria-pressed="' + on + '" data-tx-prop="' + escapeAttr(x.id) + '" data-tx-index="' + idx + '">' +
        '<span class="txfor-prop-icon" aria-hidden="true">⌂</span><span class="txfor-prop-text"><b>' + escapeAttr(x.name) + '</b><small>' + escapeAttr(x.sub) + '</small></span></button>';
    }).join("") + '</div>';
    var x = targets.find(function(y){ return y.id === current; });
    if(x && x.kind === "purchase"){
      var p = x.purchase;
      html += '<span class="field-label">Which cost of the purchase</span><div class="bl-chips txfor-costs">' + purchaseCostChoices(p).concat([{ id: "new", what: "+ A new cost" }]).map(function(c){
        var on = t.forProperty === x.id && t.forCost === c.id;
        var paid = c.id === "new" ? "" : costNote(st, p, c.id);
        return '<button type="button" class="bl-chip' + (on ? " is-on" : "") + '" aria-pressed="' + on + '" data-tx-cost="' + escapeAttr(c.id) + '" data-tx-prop-for="' + escapeAttr(x.id) + '" data-tx-index="' + idx + '">' + escapeAttr(c.what) + (paid ? ' <span>' + escapeAttr(paid) + '</span>' : '') + '</button>';
      }).join("") + '</div>';
      if(t.forProperty === x.id && t.forCost) target = { type: "purchase", id: x.id, cost: t.forCost };
    } else if(x && x.kind === "investment"){
      html += '<span class="field-label">Which of its lines</span><div class="bl-chips txfor-costs">' + (x.property.expenses || []).filter(function(l){ return l && l.id; }).map(function(l){
        var on = t.linkedExpenseId === l.id;
        return '<button type="button" class="bl-chip' + (on ? " is-on" : "") + '" aria-pressed="' + on + '" data-tx-propline="' + escapeAttr(l.id) + '" data-tx-prop-for="' + escapeAttr(x.id) + '" data-tx-index="' + idx + '">' + escapeAttr(l.what || "A line") + '</button>';
      }).join("") + '<button type="button" class="bl-chip' + (t.forProperty === x.id && !t.linkedExpenseId ? " is-on" : "") + '" aria-pressed="' + (t.forProperty === x.id && !t.linkedExpenseId) + '" data-tx-propline="" data-tx-prop-for="' + escapeAttr(x.id) + '" data-tx-index="' + idx + '">Other cost <span>no line</span></button></div>';
      if(o && o.id === x.id) target = { type: "property", id: x.id, lineId: t.linkedExpenseId || "" };
    } else if(x && x.kind === "home"){
      html += '<p class="field-help">Your home\'s running costs are household spending: pick its budget line (rates, insurance) under Budget line — a line can say which home it\'s for.</p>';
    }
    html += '</div>';
  } else {
    target = { type: "oneoff" };
  }
  var eff = target ? linkEffect(st, t, target) : null;
  if(eff && eff.lines.length){
    html += '<div class="txfor-effect is-' + eff.tone + '" role="status"><b>' + (mode === "oneoff" ? "A one-off" : "What this does") + '</b>' +
      eff.lines.map(function(l){ return '<span><span aria-hidden="true">' + escapeAttr(l[0]) + '</span> ' + escapeAttr(l[1]) + '</span>'; }).join("") + '</div>';
  }
  return html + '</div>';
}
// "$60,000 · paid", "$28,000 · not paid", "added to the loan", "to come" beside a purchase's cost.
function costNote(st, p, costId){
  var txs = costTransactions(st, p.id, costId);
  var paidSum = txs.reduce(function(s, o){ return s + (Number(o.amount) || 0); }, 0);
  if(costId === "deposit") return txs.length ? fmtCurrency0.format(paidSum) + " · paid" : (Number(p.deposit) > 0 ? fmtCurrency0.format(Number(p.deposit)) : "");
  var c = (p.costs || []).find(function(x){ return x.id === costId; }) || {};
  if(txs.length) return fmtCurrency0.format(paidSum) + " · paid";
  if(c.kind === "loan" && c.financed) return "added to the loan";
  if(c.paid) return "ticked paid";
  if(c.tbc) return "to come";
  var amount = costAmount(p, c);
  return amount > 0 ? fmtCurrency0.format(amount) + " · not paid" : "not paid";
}

// A purchase's cost, opened: the transactions that paid it. → html (inside the cost's editor).
export function costTransactionsHtml(st, p, costId){
  var txs = costTransactions(st, p.id, costId);
  if(!txs.length) return '<p class="field-help buy-cost-tx-none">No transaction yet — link the one that paid it (open it in Transactions → What it\'s for → A property), or one that mentions it will be suggested in the Budget inbox.</p>';
  return '<ul class="buy-cost-txs" aria-label="Paid by">' + txs.map(function(t){
    return '<li><span>' + escapeAttr(t.what || "Transaction") + ' <small>· ' + escapeAttr(shortDate(t.date)) + (t.account ? ' · ' + escapeAttr(t.account) : '') + '</small></span><b>' + fmtCurrency2.format(Number(t.amount) || 0) + '</b>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-buy-unlink="' + st.transactions.indexOf(t) + '" aria-label="' + escapeAttr("Unlink " + (t.what || "this transaction")) + '">Unlink</button></li>';
  }).join("") + '</ul>';
}

// Under the Property chip: what the shown property money was for, by property — "$62,500 toward buying 1 Example St
// and $300 on 2 Sample Rd. None of it is spending." txs: the transactions shown.
export function propertyNoteHtml(txs, st){
  st = st || state;
  var cache = propertyCache(st), by = {}, order = [];
  (txs || []).forEach(function(t){
    var o = propertyOf(t, st, cache);
    if(!o || !o.capital) return;
    if(!by[o.id]){ by[o.id] = { o: o, sum: 0 }; order.push(o.id); }
    by[o.id].sum += Number(t.amount) || 0;
  });
  if(!order.length) return "";
  var parts = order.map(function(id){ var x = by[id]; return fmtCurrency0.format(x.sum) + (x.o.kind === "purchase" ? " toward buying " : " on ") + x.o.name; });
  var said = parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0];
  return '<p class="cf-prop-note">' + escapeAttr(said) + '. None of it is spending — it\'s the property\'s, so it stays out of your budget and Patterns. Open a property\'s page for all of its money.</p>';
}

// ---------------- Settlement: check these, then it's a property (board Q) ----------------
// rentLines: [{ ref, what, last }] — a rent line still running, to end at settlement (asked, never assumed).
export var settleUi = { open: null, endRent: {}, rentDate: {} };
export function settlementSheetHtml(p, st, rentLines, figures){
  st = st || state;
  var chk = settlementCheck(st, p);
  var price = Number(p.price) || 0;
  var rows = chk.rows.filter(function(r){ return r.amount != null || figures.costs.some(function(c){ return c.id === r.raw.id && c.amount > 0; }); });
  var costRows = rows.map(function(r){
    var fc = figures.costs.find(function(c){ return c.id === r.raw.id; }) || {};
    var amount = r.amount != null ? r.amount : fc.amount || 0;
    return { what: r.what, amount: amount, linked: r.amount != null, note: r.amount != null ? r.note : (r.raw.auto ? "worked out — check the settlement statement" : r.note) };
  });
  var base = price + costRows.reduce(function(s, r){ return s + r.amount; }, 0);
  var loanCosts = figures.costs.filter(function(c){ return c.kind === "loan" && c.amount > 0; });
  var row = function(k, v, sub, cls, linked){ return '<div class="settle-row' + (cls ? " " + cls : "") + '"><span>' + escapeAttr(k) + (sub ? '<small' + (linked ? ' class="is-tx"' : '') + '>' + escapeAttr(sub) + '</small>' : '') + '</span><b>' + v + '</b></div>'; };
  var when = p.settlementDate || "";
  var rent = (rentLines || []).map(function(r){
    var on = settleUi.endRent[r.ref] !== false, date = settleUi.rentDate[r.ref] || when;
    return '<div class="settle-rent"><label class="settle-check"><input type="checkbox" data-settle-endrent="' + escapeAttr(r.ref) + '"' + (on ? ' checked' : '') + '> <span><b>End ' + escapeAttr(r.what) + '</b>' +
      (r.last ? '<small>last paid ' + escapeAttr(shortDate(r.last)) + ' — change the date if your lease runs longer</small>' : '<small>change the date if your lease runs longer</small>') + '</span></label>' +
      '<label class="settle-date"><span class="field-label">Ends</span><input type="date" class="field-control" data-settle-rentdate="' + escapeAttr(r.ref) + '" value="' + escapeAttr(date) + '"></label></div>';
  }).join("");
  var loose = propertyLooseOnes(st, p);
  return '<div class="review-backdrop" data-settle-backdrop><div class="review-panel settle-panel" role="dialog" aria-modal="true" aria-labelledby="settleTitle">' +
    '<div class="review-head"><h4 id="settleTitle">' + escapeAttr(p.what || "The home") + ' has settled</h4><button type="button" class="icon-btn" data-settle-close aria-label="Close">✕</button></div>' +
    '<p class="settle-sub">' + (when ? escapeAttr(shortDate(when) + " " + when.slice(0, 4)) + " · " : "") + 'check these, then it becomes ' + (p.kind === "IP" ? "an investment" : "your home") + ' in the app.</p>' +
    '<div class="settle-sec"><div class="settle-k"><b>Cost base</b><small>what it cost you</small></div><div class="settle-box">' +
      row("Price", fmtCurrency0.format(price)) + costRows.map(function(r){ return row(r.what, fmtCurrency0.format(r.amount), r.note, "", r.linked); }).join("") +
      row("Cost base", fmtCurrency0.format(base), "", "is-total") + '</div></div>' +
    (figures.borrowed > 0 ? '<div class="settle-sec"><div class="settle-k"><b>The loan</b><small>' + (figures.lender ? "from the lender's letter" : "from the purchase") + '</small></div><div class="settle-box">' +
      row("Borrowed", fmtCurrency0.format(figures.borrowed)) + (loanCosts.length ? row("Borrowing costs", fmtCurrency0.format(loanCosts.reduce(function(s, c){ return s + c.amount; }, 0)), loanCosts.map(function(c){ return c.what; }).join(", ")) : '') + '</div></div>' : '') +
    '<div class="settle-sec"><b>What changes in the app</b><ul class="settle-list">' +
      (Number(p.deposit) > 0 ? '<li><span aria-hidden="true">✓</span><span>The deposit held (' + fmtCurrency0.format(Number(p.deposit)) + ') goes into the property' + (chk.txs.length ? '; the purchase\'s ' + chk.txs.length + ' transaction' + (chk.txs.length === 1 ? '' : 's') + ' stay linked to it' : '') + '.</span></li>' : '') +
      '<li><span aria-hidden="true">✓</span><span>' + (figures.borrowed > 0 ? 'The loan starts today, and its repayments with it.' : 'It joins your properties and net worth at its price.') + '</span></li>' +
      ((st.shared || []).some(function(l){ return l && l.propertyId === p.id; }) ? '<li><span aria-hidden="true">✓</span><span>Its budget lines (' + escapeAttr((st.shared || []).filter(function(l){ return l && l.propertyId === p.id; }).map(function(l){ return l.what; }).join(", ")) + ') say which property they\'re for.</span></li>' : '') +
    '</ul>' + rent +
    (loose.length ? '<p class="settle-loose"><span aria-hidden="true">◦</span> ' + loose.length + ' transaction' + (loose.length === 1 ? ' is' : 's are') + ' still a one-off that may belong here: “' + escapeAttr(loose[0].t.what || "A transaction") + '” ' + fmtCurrency0.format(Number(loose[0].t.amount) || 0) + ', ' + escapeAttr(shortDate(loose[0].t.date)) + '. <button type="button" class="link-btn" data-settle-link="' + loose[0].index + '" data-settle-link-cost="' + escapeAttr(loose[0].cost || "new") + '">Link it</button></p>' : '') +
    '</div>' +
    '<div class="txr-actions"><button type="button" class="btn btn-ghost" data-settle-close>Not yet</button><button type="button" class="btn btn-primary" data-settle-go>It\'s ours — settle it</button></div></div></div>';
}
function propertyLooseOnes(st, p){ return propertySuggestions(st, p.settlementDate || new Date().toISOString().slice(0, 10), st.tidyOk || {}).filter(function(x){ return x.to.id === p.id; }); }
