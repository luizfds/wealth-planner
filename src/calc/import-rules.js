// Turning a merchant string into a budget line, and remembering the answer.
//
// The first import is not what makes this feature worth building — the second one is. Categorising
// 200 rows by hand once is roughly as much work as logging them by hand, so unless the app learns
// from what you picked, an import just moves the tedium around. Every rule here is created as a
// side effect of a choice the user was already making in the review screen; there is no rule
// editor to visit and no setup step before the first import.
//
// Pure: no DOM, no state writes. The caller owns state.importRules[] and passes it in.
import { normaliseDescription } from "./bank-import.js";

// The part of a bank's description that identifies *who you paid*, with the noise dropped.
//
// "WOOLWORTHS 1234 SYDNEY NS" is one merchant wearing a store number and a suburb; matching on the
// whole string would make every store its own rule and the learning worthless. Tokens are taken
// from the start and stop at the first one containing a digit, because that is reliably where the
// merchant name ends and the reference/store/location noise begins. Three tokens is the cap: past
// that a string is describing the transaction, not naming the payee.
//
// Deliberately not a token *frequency* analysis across the file. That would handle a few more
// cases and would also silently regroup a merchant the moment you import a different month.
var TRAILING_NOISE = ["ref", "reference", "no", "num", "id", "inv", "invoice", "receipt", "au", "aus", "nsw", "vic", "qld", "wa", "sa", "tas", "nt", "act"];
var NOISE_LEADERS = ["eftpos", "visa", "mastercard", "debit", "credit", "card", "purchase", "payment", "pos", "direct", "dd", "osko", "payid", "bpay", "tfr", "transfer", "withdrawal", "value", "date",
  // v3.78.0: the rails some banks spell out ("BPAY Bill Payment - Receipt 100001 …", "Pay Anyone -
  // Receipt 100002 123 …"), which put every bill under one key and filed council rates with the card.
  "bill", "pay", "anyone", "internal", "deposit"];
export function merchantKey(description){
  var norm = normaliseDescription(description);
  if(!norm) return "";
  var tokens = norm.split(" ");
  // A leading "EFTPOS DEBIT WOOLWORTHS..." names the rail, not the shop. Dropped only from the
  // front, and never all of them: "DIRECT DEBIT" on its own is the best name that row has.
  var moved = true;
  while(moved){
    moved = false;
    while(tokens.length > 1 && NOISE_LEADERS.indexOf(tokens[0]) !== -1){ tokens.shift(); moved = true; }
    // "Receipt 100001" and a bare branch number are bookkeeping, not the payee.
    if(tokens.length > 2 && tokens[0] === "receipt" && /^\d+$/.test(tokens[1])){ tokens.splice(0, 2); moved = true; }
    while(tokens.length > 1 && /^\d+$/.test(tokens[0])){ tokens.shift(); moved = true; }
  }
  var out = [];
  for(var i = 0; i < tokens.length && out.length < 3; i++){
    if(/\d/.test(tokens[i])) break;
    out.push(tokens[i]);
  }
  // Trailing bookkeeping words, dropped from the end for the same reason the rails are dropped from
  // the front: "RENT PAYMENT REF 88213" should key on — and create a budget line called — "Rent
  // Payment", not "Rent Payment Ref". Never the last one standing.
  while(out.length > 1 && TRAILING_NOISE.indexOf(out[out.length - 1]) !== -1) out.pop();
  // Everything after the first token had a digit in it (a pure reference line) — fall back to the
  // first token so the row still has something to be keyed on.
  if(!out.length) out.push(tokens[0]);
  return out.join(" ");
}

// ---------------- Matching ----------------
// A rule matches when its key is a whole-word prefix-or-contained run of the description's
// normalised text. Longest match wins, so a specific rule ("woolworths petrol") beats the general
// one ("woolworths") that was learned first — which is the only way a second, more precise answer
// can ever override an earlier rough one without a rule editor.
export function matchRule(description, rules){
  var norm = normaliseDescription(description);
  if(!norm) return null;
  var best = null;
  (rules || []).forEach(function(rule){
    var key = (rule.match || "").trim();
    if(!key) return;
    if(!containsWholeWords(norm, key)) return;
    if(!best || key.length > (best.match || "").length) best = rule;
  });
  return best;
}
function containsWholeWords(haystack, needle){
  var i = haystack.indexOf(needle);
  while(i !== -1){
    var beforeOk = i === 0 || haystack[i - 1] === " ";
    var after = i + needle.length;
    var afterOk = after === haystack.length || haystack[after] === " ";
    if(beforeOk && afterOk) return true;
    i = haystack.indexOf(needle, i + 1);
  }
  return false;
}

// Before any rule exists, the budget lines themselves are a usable guess: somebody with a "Spotify"
// line almost certainly wants "SPOTIFY P2B3C4" on it. This is what makes the *first* import useful
// rather than a wall of uncategorised rows.
//
// Whole-word matching is what stops a short line name from swallowing unrelated merchants: a line
// called "Gas" must not claim GASTRONOMY, because a wrong suggestion accepted in bulk is worse than
// no suggestion at all. Whole words handle that on their own — "gas" isn't a word in "gastronomy
// bar sydney" but is one in "origin gas bill" — so the length floor is only here to block names so
// short they'd be noise as whole words too. Three, not four: "Gas", "Car" and "Pet" are real budget
// line names and genuinely identify their merchants.
var MIN_NAME_MATCH = 3;
export function matchBudgetLineByName(description, budgetLines){
  var norm = normaliseDescription(description);
  if(!norm) return null;
  var best = null, bestLen = 0;
  (budgetLines || []).forEach(function(line){
    var name = normaliseDescription(line.what);
    if(name.length < MIN_NAME_MATCH) return;
    if(!containsWholeWords(norm, name)) return;
    if(name.length > bestLen){ best = line; bestLen = name.length; }
  });
  return best;
}

// One row's best guess at where it belongs. `source` says how confident to look in the UI: a rule
// the user taught is shown as settled, a name match as a suggestion to glance at, and nothing at
// all is left blank rather than guessed — an import that quietly files things in the wrong place
// is worse than one that asks.
//
// v3.49.0: money in learns too. A rule can carry an `incomeTarget` (see calc/received.js) instead
// of a budget line, and the two kinds never cross: a credit only ever takes an income rule, a debit
// only a spending rule — a payroll credit from an employer that also has shops must not file the
// groceries as salary, or the other way round.
export function suggestFor(description, rules, budgetLines, direction){
  var credit = direction === "credit";
  // A transfer rule (v3.64.0) wins for its own direction: "TRANSFER TO SAVINGS" is never spending.
  var tRule = matchRule(description, (rules || []).filter(function(r){ return r.transferAccount && (r.transferDirection || "debit") === (credit ? "credit" : "debit"); }));
  if(tRule) return { source: "rule", linkedExpenseId: null, category: "", account: "", ruleId: tRule.id || null, transferAccount: tRule.transferAccount };
  var rule = matchRule(description, (rules || []).filter(function(r){ return !r.transferAccount && (credit ? !!r.incomeTarget : !r.incomeTarget); }));
  if(rule && credit){
    return { source: "rule", linkedExpenseId: null, category: "", account: rule.account || "", ruleId: rule.id || null, incomeTarget: rule.incomeTarget };
  }
  if(credit) return { source: null, linkedExpenseId: null, category: "", account: "", ruleId: null };
  if(rule){
    return {
      source: "rule",
      linkedExpenseId: rule.linkedExpenseId || null,
      category: rule.category || "",
      account: rule.account || "",
      ruleId: rule.id || null
    };
  }
  var line = matchBudgetLineByName(description, budgetLines);
  if(line){
    return { source: "name", linkedExpenseId: line.id || null, category: line.category || "", account: line.account || "", ruleId: null };
  }
  return { source: null, linkedExpenseId: null, category: "", account: "", ruleId: null };
}

// Annotates parsed rows in place-ish (returns new objects) with their suggestion, so the review
// screen renders from one pass rather than re-matching per row per render.
export function applySuggestions(rows, rules, budgetLines){
  return (rows || []).map(function(row){
    return Object.assign({}, row, { suggestion: suggestFor(row.description, rules, budgetLines, row.direction) });
  });
}

// ---------------- Learning ----------------
// Called once per row the user actually confirmed, with what they chose. Keyed on merchantKey, so
// confirming one Woolworths row teaches every Woolworths row — including next month's, which is
// the entire point.
//
// A choice always wins over the stored rule rather than being ignored as a duplicate: correcting
// last month's mistake has to be possible from the same screen that made it, since there is
// nowhere else to do it.
export function learnRule(rules, description, choice, idFactory){
  var key = merchantKey(description);
  if(!key) return rules;
  // Nothing to learn from a row the user left unassigned — and storing an empty rule would sit
  // there matching future rows and filing them nowhere, which looks like the app forgetting.
  if(choice && choice.transferAccount){
    var dir = choice.transferDirection || "debit";
    var t = (rules || []).find(function(r){ return r.match === key && r.transferAccount && (r.transferDirection || "debit") === dir; });
    if(t){ t.transferAccount = choice.transferAccount; t.hits = (t.hits || 0) + 1; return rules; }
    // A transfer answer replaces a spending/income rule for the same words and direction.
    for(var i = rules.length - 1; i >= 0; i--){
      var r0 = rules[i];
      if(r0.match === key && !r0.transferAccount && (!!r0.incomeTarget === (dir === "credit"))) rules.splice(i, 1);
    }
    rules.push({ id: idFactory ? idFactory() : "rule_x_" + key.replace(/\s+/g, "_"), match: key, transferAccount: choice.transferAccount, transferDirection: dir,
      linkedExpenseId: null, category: "", account: "", hits: 1 });
    return rules;
  }
  if(!choice || (!choice.linkedExpenseId && !(choice.category || "").trim() && !choice.incomeTarget)) return rules;
  var income = !!choice.incomeTarget;
  // Same merchant key, same direction: a credit and a debit from one name are two rules.
  var existing = (rules || []).find(function(r){ return r.match === key && !r.transferAccount && !!r.incomeTarget === income; });
  if(existing && income){
    existing.incomeTarget = choice.incomeTarget;
    if(choice.account) existing.account = choice.account;
    existing.hits = (existing.hits || 0) + 1;
    return rules;
  }
  if(income){
    rules.push({ id: idFactory ? idFactory() : "rule_in_" + key.replace(/\s+/g, "_"), match: key, incomeTarget: choice.incomeTarget,
      linkedExpenseId: null, category: "", account: choice.account || "", hits: 1 });
    return rules;
  }
  if(existing){
    existing.linkedExpenseId = choice.linkedExpenseId || null;
    existing.category = choice.category || "";
    if(choice.account) existing.account = choice.account;
    existing.hits = (existing.hits || 0) + 1;
    return rules;
  }
  rules.push({
    id: idFactory ? idFactory() : "rule_" + key.replace(/\s+/g, "_"),
    match: key,
    linkedExpenseId: choice.linkedExpenseId || null,
    category: choice.category || "",
    account: choice.account || "",
    hits: 1
  });
  return rules;
}

// Rules pointing at a budget line that no longer exists would silently file next month's spend
// against nothing. Called after a budget line is deleted; keeps a rule that only carried a
// category, since that part still works.
export function pruneRules(rules, budgetLines){
  var live = {};
  (budgetLines || []).forEach(function(l){ if(l.id) live[l.id] = true; });
  return (rules || []).filter(function(rule){
    // Income rules are checked against the income targets when they're applied (bank-import.js);
    // transfer rules name an account, which outlives any budget line.
    if(rule.incomeTarget || rule.transferAccount) return true;
    if(!rule.linkedExpenseId) return !!(rule.category || "").trim();
    if(live[rule.linkedExpenseId]) return true;
    rule.linkedExpenseId = null;
    return !!(rule.category || "").trim();
  });
}

// How much of an import the rules can place without being asked — the number that says whether
// this feature is earning its keep, and what the review screen leads with.
export function coverageOf(rows){
  var total = (rows || []).length;
  if(!total) return { total: 0, placed: 0, fraction: 0, byRule: 0, byName: 0 };
  var byRule = rows.filter(function(r){ return r.suggestion && r.suggestion.source === "rule"; }).length;
  var byName = rows.filter(function(r){ return r.suggestion && r.suggestion.source === "name"; }).length;
  return { total: total, placed: byRule + byName, fraction: (byRule + byName) / total, byRule: byRule, byName: byName };
}

// ---------------- Turning a merchant into a budget line ----------------
// The import already knows everything a budget line needs: who you paid, how often, and how much.
// Before this, an import into an app with no budget placed 0 of 11 rows — every merchant landed in
// "Needs you" with nothing in the dropdown to assign it to. Offering to create the line turns one
// statement into a working budget, which is the onboarding path this app never had.

// A merchant key is lowercase and stripped; a budget line is something you read in a list. Only
// the first letter of each word — not a smart-casing attempt, because "BP" becoming "Bp" is a worse
// failure than "Woolworths" being slightly over-formal, and the field is editable either way.
export function suggestedLineName(key){
  return (key || "").split(" ").filter(Boolean).map(function(word){
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(" ");
}

// What this merchant costs per month, derived from the rows themselves rather than guessed.
//
// The denominator is the number of distinct calendar months the *import* touches, not the months
// this merchant appears in: shopping at Woolworths in two of the three months you imported is still
// a three-month average, and dividing by two would overstate it by half. Floor of 1, so a
// single-month import returns that month's spend rather than dividing by zero.
//
// A part-month import understates the true monthly rate — 18 days of spending divided by one whole
// month. That's stated in the UI rather than corrected for here: inflating a real figure to cover
// days the file doesn't include would be inventing spending.
export function monthlyRateFrom(rows, allRows){
  var mine = rows || [];
  if(!mine.length) return { amount: 0, months: 0, total: 0, transactions: 0 };
  var total = mine.reduce(function(s, r){ return s + (Number(r.amount) || 0); }, 0);
  var months = distinctMonths(allRows && allRows.length ? allRows : mine);
  return {
    amount: Math.round((total / Math.max(1, months)) * 100) / 100,
    months: months,
    total: Math.round(total * 100) / 100,
    transactions: mine.length
  };
}
function distinctMonths(rows){
  var seen = {};
  (rows || []).forEach(function(r){
    if(r && typeof r.date === "string" && r.date.length >= 7) seen[r.date.slice(0, 7)] = true;
  });
  return Object.keys(seen).length;
}

// The whole proposal for one merchant group, ready to be shown and edited before anything is
// written. Deliberately not applied here: the review screen's promise is that nothing reaches
// state until Import is pressed, and a line created the moment you picked it from a dropdown would
// break that for anyone who then cancels.
export function proposedLineFor(group, allRows){
  var rate = monthlyRateFrom(group && group.rows, allRows);
  return {
    what: suggestedLineName(group && group.key),
    amount: rate.amount,
    freq: "Monthly",
    category: (group && group.choice && group.choice.category) || "",
    classification: "Needs",
    basis: rate
  };
}

// ---------------- Transfers between your own accounts (v3.64.0) ----------------
// A guess at which of the household's other accounts a statement line moved money to or from:
// another account named in the description ("TRANSFER TO BANK ONE SAVINGS"), else null. Words alone
// ("TRANSFER", "PAYMENT THANK YOU") say it's probably a transfer without saying where, which is
// `likely` — the review offers it as a transfer but leaves the account to the person.
var TRANSFER_WORDS = /\b(transfer|tfr|xfer|internal|payment.{0,15}thank ?you|payment received|card payment|repayment|osko|pay ?anyone|to savings|from savings)\b/;
// v3.78.0: paying a credit card, seen from either side. On the card's statement it's "PAYMENT -
// BPAY - THANK YOU"; on the bank's it's "BPAY Bill Payment Bank One Cards …". Neither names an
// account in the app, so these are matched by what they say, and the other account comes from the
// account types (the household's one card) or from where earlier payments to this card came from.
var CARD_PAID = /\b(payment.{0,15}thank ?you|payment received|autopay|direct debit payment|bpay payment|card payment)\b/;
var PAYING_A_CARD = /\b(cards?|credit card|amex|mastercard)\b/;
function usualPayer(card, transfers){
  var count = {};
  (transfers || []).forEach(function(t){ if(t && t.to === card && t.from) count[t.from] = (count[t.from] || 0) + 1; });
  return Object.keys(count).sort(function(a, b){ return count[b] - count[a]; })[0] || "";
}
// ctx (optional): { accounts: [{ name, type }], transfers: state.transfers }.
export function detectTransfer(description, accountNames, statementAccount, ctx){
  var norm = normaliseDescription(description);
  if(!norm) return null;
  var hit = null;
  (accountNames || []).forEach(function(n){
    if(!n || n === statementAccount) return;
    var k = normaliseDescription(n);
    if(k && (" " + norm + " ").indexOf(" " + k + " ") !== -1 && (!hit || k.length > normaliseDescription(hit).length)) hit = n;
  });
  if(hit) return { account: hit, likely: true };
  var accounts = (ctx && ctx.accounts) || [];
  var here = accounts.find(function(a){ return a.name === statementAccount; });
  if(here && here.type === "credit" && (CARD_PAID.test(norm) || TRANSFER_WORDS.test(norm))){
    return { account: usualPayer(statementAccount, ctx.transfers), likely: true, cardPayment: true };
  }
  if((!here || here.type !== "credit") && PAYING_A_CARD.test(norm) && /\b(bpay|payment|repay|pay)\b/.test(norm)){
    var cards = accounts.filter(function(a){ return a.type === "credit" && a.name !== statementAccount; });
    return { account: cards.length === 1 ? cards[0].name : "", likely: true, cardPayment: true };
  }
  return TRANSFER_WORDS.test(norm) ? { account: "", likely: true } : null;
}
// The balance the statement ends on: the running balance on its last row by date. Files run
// newest-first as often as oldest-first, so for a tie on the last date the row nearest that end of
// the file wins. Returns { date, balance } or null when the file has no balance column.
export function closingBalance(rows){
  var withBal = (rows || []).filter(function(r){ return r.balance != null && !isNaN(r.balance); });
  if(!withBal.length) return null;
  var newestFirst = withBal.length > 1 && withBal[0].date > withBal[withBal.length - 1].date;
  var best = null;
  withBal.forEach(function(r, i){
    if(!best || r.date > best.date || (r.date === best.date && !newestFirst && i > best.i)) best = { date: r.date, balance: r.balance, i: i };
  });
  return { date: best.date, balance: best.balance };
}
