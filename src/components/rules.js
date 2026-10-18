import { state } from "../state.js";
import { matchRule } from "../calc/import-rules.js";
import { normaliseDescription } from "../calc/bank-import.js";
import { incomeTargets } from "../calc/received.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Settings → Import rules (v3.60.0) ----------------
// The bank import learns a rule every time a row is confirmed ("FERN CAFE" → Coffee), and until
// now there was nowhere to see them, fix a wrong one or write one ahead of an import — a bad guess
// accepted once kept filing the same merchant to the wrong line forever. This lists every rule
// with what it does, lets each part be changed, and tests a description against the set.
export var ruleTest = { text: "" };

function optionList(values, current, blank){
  return '<option value="">' + escapeAttr(blank) + '</option>' + values.map(function(v){
    return '<option value="' + escapeAttr(v.value) + '"' + (v.value === current ? " selected" : "") + '>' + escapeAttr(v.label) + '</option>';
  }).join("") + (current && !values.some(function(v){ return v.value === current; }) ? '<option value="' + escapeAttr(current) + '" selected>' + escapeAttr(current) + ' (gone)</option>' : '');
}

export function rulesPageHtml(lines){
  var rules = state.importRules || [];
  var lineOpts = (lines || []).filter(function(l){ return l.id && !l.computed; }).map(function(l){ return { value: l.id, label: l.what || "Budget line" }; })
    .sort(function(a, b){ return a.label.localeCompare(b.label); });
  var incomeOpts = incomeTargets().map(function(t){ return { value: t.key, label: t.label }; });
  var catOpts = (state.categories || []).map(function(c){ return { value: c, label: c }; });
  var acctOpts = (state.accounts || []).map(function(a){ return { value: a.name, label: a.name }; });
  var test = ruleTest.text.trim();
  var hit = test ? matchRule(test, rules) : null;
  var testHtml = '<div class="rl-test"><label class="cf-filter"><span>Test a bank description</span><input type="text" data-rl-test value="' + escapeAttr(ruleTest.text) + '" placeholder="e.g. FERN CAFE 1234 SYDNEY"></label>' +
    '<p class="rl-test-out">' + (!test ? "Type a line from a statement to see which rule would file it."
      : hit ? 'Matched by <b>“' + escapeAttr(hit.match) + '”</b> → ' + escapeAttr(hit.transferAccount ? "transfer with " + hit.transferAccount : hit.incomeTarget ? (incomeOpts.find(function(o){ return o.value === hit.incomeTarget; }) || { label: hit.incomeTarget }).label
        : hit.linkedExpenseId ? (lineOpts.find(function(o){ return o.value === hit.linkedExpenseId; }) || { label: "a deleted line" }).label : (hit.category || "nothing")) + '.'
      : 'No rule matches “' + escapeAttr(normaliseDescription(test)) + '” — the import would fall back to matching budget line names.') + '</p></div>';
  var addHtml = '<div class="rl-add"><b>Add a rule</b><div class="rl-add-grid">' +
    '<label class="cf-filter"><span>When the description has</span><input type="text" data-rl-new="match" placeholder="e.g. fern cafe"></label>' +
    '<label class="cf-filter"><span>File under line</span><select data-rl-new="line">' + optionList(lineOpts, "", "— pick a line —") + '</select></label>' +
    '<button type="button" class="btn btn-sm btn-primary" data-rl-add>Add rule</button></div></div>';
  if(!rules.length){
    return testHtml + '<p class="ledger-note" style="margin:0 0 10px">No rules yet. Every row you confirm in a bank import teaches one, or add one here before your first import.</p>' + addHtml;
  }
  var rows = rules.map(function(r, i){
    var income = !!r.incomeTarget;
    var transfer = !!r.transferAccount;
    return '<div class="rl-row' + (hit === r ? " is-hit" : "") + '">' +
      '<label class="cf-filter rl-match"><span>When the description has</span><input type="text" data-rl-index="' + i + '" data-rl-key="match" value="' + escapeAttr(r.match) + '" aria-label="Words to match"></label>' +
      (transfer
        ? '<label class="cf-filter"><span>Transfer ' + ((r.transferDirection || "debit") === "credit" ? "from" : "to") + '</span><select data-rl-index="' + i + '" data-rl-key="transferAccount">' + optionList(acctOpts, r.transferAccount, "—") + '</select></label><span></span>'
        : income
        ? '<label class="cf-filter"><span>Money in, for</span><select data-rl-index="' + i + '" data-rl-key="incomeTarget">' + optionList(incomeOpts, r.incomeTarget, "—") + '</select></label>'
        : '<label class="cf-filter"><span>File under line</span><select data-rl-index="' + i + '" data-rl-key="linkedExpenseId">' + optionList(lineOpts, r.linkedExpenseId || "", "— no line —") + '</select></label>' +
          '<label class="cf-filter"><span>or category</span><select data-rl-index="' + i + '" data-rl-key="category"' + (r.linkedExpenseId ? " disabled" : "") + '>' + optionList(catOpts, r.category || "", "—") + '</select></label>') +
      '<label class="cf-filter"><span>Account</span><select data-rl-index="' + i + '" data-rl-key="account">' + optionList(acctOpts, r.account || "", "— any —") + '</select></label>' +
      '<span class="rl-hits" title="Times this rule has been confirmed">' + (r.hits || 0) + '×</span>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-rl-del="' + i + '" aria-label="Delete rule ' + escapeAttr(r.match) + '">✕</button></div>';
  }).join("");
  return testHtml + '<div class="rl-list">' + rows + '</div>' + addHtml;
}

// Applies one edited field. A match is stored the way descriptions are compared (lower case, no
// punctuation); a line and a category are alternatives, so setting a line clears the category.
export function setRuleField(i, key, value){
  var r = (state.importRules || [])[i];
  if(!r) return false;
  if(key === "match"){ var m = normaliseDescription(value); if(!m) return false; r.match = m; return true; }
  if(key === "linkedExpenseId"){ r.linkedExpenseId = value || null; if(value) r.category = ""; return true; }
  if(key === "category" || key === "account" || key === "incomeTarget" || key === "transferAccount"){ r[key] = value || ""; return true; }
  return false;
}
// A rule with nothing to do (no line, category or income target) is dropped on the next load by
// migrateState — say so rather than let it vanish.
export function ruleIsEmpty(r){ return !r.linkedExpenseId && !(r.category || "").trim() && !r.incomeTarget && !r.transferAccount; }
