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
var NOISE_LEADERS = ["eftpos", "visa", "mastercard", "debit", "credit", "card", "purchase", "payment", "pos", "direct", "dd", "osko", "payid", "bpay", "tfr", "transfer", "withdrawal", "value", "date"];
export function merchantKey(description){
  var norm = normaliseDescription(description);
  if(!norm) return "";
  var tokens = norm.split(" ");
  // A leading "EFTPOS DEBIT WOOLWORTHS..." names the rail, not the shop. Dropped only from the
  // front, and never all of them: "DIRECT DEBIT" on its own is the best name that row has.
  while(tokens.length > 1 && NOISE_LEADERS.indexOf(tokens[0]) !== -1) tokens.shift();
  var out = [];
  for(var i = 0; i < tokens.length && out.length < 3; i++){
    if(/\d/.test(tokens[i])) break;
    out.push(tokens[i]);
  }
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
export function suggestFor(description, rules, budgetLines){
  var rule = matchRule(description, rules);
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
    return Object.assign({}, row, { suggestion: suggestFor(row.description, rules, budgetLines) });
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
  if(!choice || (!choice.linkedExpenseId && !(choice.category || "").trim())) return rules;
  var existing = (rules || []).find(function(r){ return r.match === key; });
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
