// ---------------- A review queue for new transactions (v3.163.0, item 193) ----------------
//
// An imported row was looked at once, on the import screen, and whatever was waved through there
// was never looked at again. Now every imported row (a statement chosen by hand or from the
// Statements folder) lands with `reviewed: false`, and Home and Spending say how many are waiting.
// The queue goes one at a time: keep it where it was filed, or change where it goes — and a change
// can teach the import a rule, so next month's statement files that shop the new way by itself.
// Rows saved before this (no `reviewed` field) count as reviewed. Pure: takes and returns plain
// data, writes nothing it isn't handed; components/reviewqueue.js draws it.

import { learnRule, merchantKey } from "./import-rules.js";

// The rows waiting, oldest first — the order they happened in.
export function toReview(transactions){
  return (transactions || []).filter(function(t){ return t && t.reviewed === false; })
    .slice().sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
}

// Keep it as filed.
export function keepTransaction(t){ if(t) t.reviewed = true; return t; }

// File it somewhere else: a budget line (`linkedExpenseId`) or, failing one, a category. A line
// carries its own category, so filing to a line clears the row's own.
export function refileTransaction(t, choice){
  if(!t || !choice) return t;
  t.linkedExpenseId = choice.linkedExpenseId || null;
  t.category = choice.linkedExpenseId ? "" : (choice.category || "");
  t.reviewed = true;
  return t;
}

// "Always do this for <shop>?" — the shop as the rule will match it, or null when the bank's words
// give nothing to match on.
export function ruleOfferFor(t){
  var key = t && merchantKey(t.what || "");
  return key ? { key: key } : null;
}
// Yes: the rule is learnt (or updated) the same way a confirmed import teaches one, and every other
// row still waiting from the same shop is filed the same way and done too — the answer applies to
// all of them, not just the next import.
export function applyRuleFromReview(rules, transactions, t, choice, idFactory){
  learnRule(rules, t.what || "", choice, idFactory);
  var key = merchantKey(t.what || "");
  var also = 0;
  toReview(transactions).forEach(function(o){
    if(o === t || merchantKey(o.what || "") !== key) return;
    refileTransaction(o, choice);
    also++;
  });
  return also;
}

// Everything left, kept as filed — "these all look right".
export function keepAll(transactions){
  var n = 0;
  toReview(transactions).forEach(function(t){ t.reviewed = true; n++; });
  return n;
}
