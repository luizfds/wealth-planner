import { state } from "../state.js";
import { toReview, ruleOfferFor } from "../calc/reviewqueue.js";
import { transactionDisplayName } from "../calc/ledger.js";
import { fmtCurrency2, fmtDate } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { categoryIconHtml } from "../lib/caticons.js";
import { budgetLineOptgroupsHtml, sortedCategories, transactionCategory, budgetLineItems } from "./expenses.js";

// ---------------- The review queue (v3.163.0, item 193) — calc/reviewqueue.js decides ----------------
// One row at a time, oldest first. Keep it (→, or swipe right) or change where it goes (←, or swipe
// left); after a change, "Always do this for <shop>?" can teach the import a rule. Session-only UI
// state lives here; app.js wires the clicks, keys and swipes.
export var txReview = { open: false, mode: "card", choice: null, kept: 0 };

export function reviewCount(){ return toReview(state.transactions).length; }

function whereItGoes(t){
  var line = t.linkedExpenseId && budgetLineItems().find(function(i){ return i.id === t.linkedExpenseId; });
  if(line) return { text: line.what + (line.category ? " · " + line.category : ""), filed: true };
  var cat = transactionCategory(t);
  return cat ? { text: cat, filed: true } : { text: "Not filed yet", filed: false };
}

export function txReviewHtml(){
  var queue = toReview(state.transactions);
  var head = function(sub){
    return '<div class="review-head"><h4>Review new transactions' + (sub ? ' <span class="txr-left">' + sub + '</span>' : '') + '</h4>' +
      '<button type="button" class="icon-btn" data-txr-close aria-label="Close">✕</button></div>';
  };
  if(!queue.length){
    return '<div class="review-backdrop" data-txr-backdrop><div class="review-panel txr-panel" role="dialog" aria-modal="true" aria-label="Review new transactions">' + head("") +
      '<p class="txr-done">All reviewed' + (txReview.kept ? ' — ' + txReview.kept + ' looked at this time' : '') + '.</p>' +
      '<div class="txr-actions"><button type="button" class="btn btn-primary" data-txr-close>Done</button></div></div></div>';
  }
  var t = queue[0];
  var name = transactionDisplayName(t, state.shared) || t.what || "Transaction";
  var where = whereItGoes(t);
  var card = '<div class="txr-card" data-txr-card>' +
    '<div class="txr-top">' + categoryIconHtml(transactionCategory(t)) +
      '<div class="txr-name"><b>' + escapeAttr(name) + '</b>' + (t.what && t.what.trim() !== name ? '<small>' + escapeAttr(t.what) + '</small>' : '') + '</div>' +
      '<b class="txr-amt' + (Number(t.amount) < 0 ? ' in' : '') + '">' + (Number(t.amount) < 0 ? "+" : "") + fmtCurrency2.format(Math.abs(Number(t.amount) || 0)) + '</b></div>' +
    '<p class="txr-meta">' + escapeAttr(fmtDate(t.date)) + (t.account ? ' · ' + escapeAttr(t.account) : '') + '</p>' +
    '<p class="txr-where' + (where.filed ? '' : ' unfiled') + '"><span>Counts against</span> ' + escapeAttr(where.text) + '</p></div>';
  var body;
  if(txReview.mode === "change"){
    body = card + '<div class="txr-change">' +
      '<label class="fr-field"><span>A budget line</span><select data-txr-line><option value="">— None —</option>' + budgetLineOptgroupsHtml(t.linkedExpenseId) + '</select></label>' +
      '<label class="fr-field"><span>Or just a category</span><select data-txr-cat><option value="">— None —</option>' +
        sortedCategories().map(function(c){ return '<option' + (!t.linkedExpenseId && c === t.category ? " selected" : "") + '>' + escapeAttr(c) + '</option>'; }).join("") + '</select></label></div>' +
      '<div class="txr-actions"><button type="button" class="btn btn-ghost" data-txr-back>Back</button><button type="button" class="btn btn-primary" data-txr-save>Save</button></div>';
  } else if(txReview.mode === "rule" && txReview.choice){
    var shop = name;
    var to = txReview.choice.linkedExpenseId ? ((budgetLineItems().find(function(i){ return i.id === txReview.choice.linkedExpenseId; }) || {}).what || "that line") : txReview.choice.category;
    body = '<p class="txr-ask">Always file <b>' + escapeAttr(shop) + '</b> under <b>' + escapeAttr(to || "that") + '</b>?</p>' +
      '<p class="ledger-note" style="margin:0">Next statement it files itself, and anything else from it still waiting here goes the same way.</p>' +
      '<div class="txr-actions"><button type="button" class="btn" data-txr-rule="once">Just this once</button><button type="button" class="btn btn-primary" data-txr-rule="always">Always</button></div>';
  } else {
    body = card + '<div class="txr-actions txr-main">' +
      '<button type="button" class="btn" data-txr-change><span aria-hidden="true">← </span>Change</button>' +
      '<button type="button" class="btn btn-primary" data-txr-keep>Keep<span aria-hidden="true"> →</span></button></div>' +
      '<p class="txr-hint">Swipe right to keep, left to change' + (queue.length > 1 ? ' · <button type="button" class="link-btn" data-txr-keepall>Keep all ' + queue.length + '</button>' : '') + '</p>';
  }
  return '<div class="review-backdrop" data-txr-backdrop><div class="review-panel txr-panel" role="dialog" aria-modal="true" aria-label="Review new transactions">' +
    head(queue.length + " to go") + body + '</div></div>';
}

// The "N to review" line over Spending's list.
export function reviewBannerHtml(){
  var n = reviewCount();
  if(!n) return "";
  return '<div class="txr-banner"><span><b>' + n + '</b> new transaction' + (n === 1 ? "" : "s") + ' to review</span>' +
    '<button type="button" class="btn btn-sm btn-primary" data-txr-open>Review</button></div>';
}
export { ruleOfferFor };
