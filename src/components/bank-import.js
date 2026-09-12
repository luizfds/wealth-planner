// The bank-import review screen: drop a statement in, check what it worked out, confirm.
//
// Its own file rather than more of components/expenses.js, which is already 1,767 lines and twice
// the size of the next biggest component. This is a self-contained flow — one entry point
// (startBankImport), one exit (commitBankImport), and session-only state that nothing else reads —
// so it splits cleanly, unlike the page-level render functions that genuinely belong together.
// DOM event *registration* still lives in app.js, same as every other component here.
import { state, persist } from "../state.js";
import { parseCsv } from "../lib/backup.js";
import { parseBankCsv, bankImportSummary } from "../calc/bank-import.js";
import { applySuggestions, learnRule, coverageOf, merchantKey } from "../calc/import-rules.js";
import { fmtCurrency0, fmtCurrency2 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { loggableBudgetLineItems } from "./expenses.js";

// Session-only. Nothing here is persisted until commitBankImport() — a half-reviewed import that
// survived a reload would be a pile of decisions the user has no memory of making.
export var bankImport = null;

function genId(prefix){ return prefix + "_" + Math.random().toString(36).slice(2, 10); }

// ---------------- Grouping ----------------
// The single decision that makes this usable on a phone: one row per *merchant*, not one per
// transaction. A month of spending is 40-odd transactions and about a dozen merchants, and being
// asked "where does WOOLWORTHS go" eight times is how a review screen gets abandoned halfway.
//
// Grouped across the whole file rather than per month, so a merchant you see weekly is answered
// once for the quarter.
function groupRows(rows){
  var byKey = {}, order = [];
  rows.forEach(function(row){
    var key = merchantKey(row.description) || "(no description)";
    if(!byKey[key]){
      byKey[key] = {
        key: key,
        // The longest raw description in the group, because that's the one most likely to carry
        // the merchant's actual name rather than an abbreviation.
        label: row.description || "(no description)",
        rows: [], total: 0,
        choice: { linkedExpenseId: row.suggestion.linkedExpenseId, category: row.suggestion.category, account: row.suggestion.account },
        source: row.suggestion.source
      };
      order.push(key);
    }
    var g = byKey[key];
    if((row.description || "").length > g.label.length) g.label = row.description;
    g.rows.push(row);
    g.total += row.amount;
  });
  // Biggest spend first: the merchant worth getting right is the one you spent the most at, and on
  // a phone the top of the list is the part that actually gets read.
  return order.map(function(k){ return byKey[k]; }).sort(function(a, b){ return b.total - a.total; });
}

// ---------------- Entry ----------------
export function startBankImport(text, fileName){
  var rows = parseCsv(text);
  var parsed = parseBankCsv(rows, { existing: state.transactions });
  // Held here rather than handed back in by the caller: reparseBankImportWith() depends on it, and
  // a caller that forgot the second call would leave the date-order control silently doing nothing.
  return rebuildBankImport(parsed, fileName, rows);
}
// Re-parses with an explicit date order — what the "read as DD/MM · change" control calls. Kept
// separate from startBankImport so the original file text has to be held onto, which it is: a
// misread date order is the one mistake worth being able to undo without finding the file again.
export function reparseBankImportWith(order){
  if(!bankImport) return null;
  var parsed = parseBankCsv(bankImport.rawRows, { existing: state.transactions, dateOrder: order });
  return rebuildBankImport(parsed, bankImport.fileName, bankImport.rawRows, bankImport.includePossibleDuplicates);
}
function rebuildBankImport(parsed, fileName, rawRows, includePossibleDuplicates){
  var lines = loggableBudgetLineItems();
  var suggested = applySuggestions(parsed.rows, state.importRules, lines);
  var includeMaybes = !!includePossibleDuplicates;
  var spend = suggested.filter(function(r){
    if(r.direction !== "debit" || r.duplicate) return false;
    return includeMaybes || !r.possibleDuplicate;
  });
  bankImport = {
    fileName: fileName || "",
    rawRows: rawRows || null,
    parsed: parsed,
    summary: bankImportSummary(parsed),
    coverage: coverageOf(spend),
    groups: groupRows(spend),
    duplicates: suggested.filter(function(r){ return r.duplicate; }),
    // Same date and amount as something already logged by hand, which carries no description to
    // compare against. Left out unless asked for — see the duplicate-detection comment in
    // calc/bank-import.js for why this is a separate, weaker class of evidence.
    possibleDuplicates: suggested.filter(function(r){ return r.possibleDuplicate; }),
    includePossibleDuplicates: includeMaybes,
    credits: suggested.filter(function(r){ return r.direction === "credit" && !r.duplicate && !r.possibleDuplicate; })
  };
  return bankImport;
}
// Re-buckets the same parse with the maybes folded in (or back out). Any group assignments made so
// far are deliberately preserved: re-deciding where WOOLWORTHS goes because you ticked a checkbox
// about something else would be its own small betrayal.
export function setIncludePossibleDuplicates(include){
  if(!bankImport) return null;
  var previous = {};
  bankImport.groups.forEach(function(g){ previous[g.key] = g.choice; });
  var rebuilt = rebuildBankImport(bankImport.parsed, bankImport.fileName, bankImport.rawRows, include);
  rebuilt.groups.forEach(function(g){
    if(previous[g.key]){ g.choice = previous[g.key]; g.source = "chosen"; }
  });
  rebuilt.coverage = coverageOfGroups(rebuilt.groups);
  return rebuilt;
}
export function clearBankImport(){
  bankImport = null;
  var panel = document.getElementById("bankImportPanel");
  if(panel){ panel.hidden = true; panel.innerHTML = ""; }
}

// ---------------- Editing a group ----------------
export function setBankImportGroupLine(key, expenseId){
  var g = bankImport && bankImport.groups.find(function(x){ return x.key === key; });
  if(!g) return;
  g.choice.linkedExpenseId = expenseId || null;
  // Taking the line's category too, so assigning a line answers both questions at once — the
  // category select below it is for the one-offs that have no line to inherit from.
  var line = expenseId && loggableBudgetLineItems().find(function(i){ return i.id === expenseId; });
  if(line) g.choice.category = line.category || "";
  g.source = "chosen";
  bankImport.coverage = coverageOfGroups(bankImport.groups);
}
export function setBankImportGroupCategory(key, category){
  var g = bankImport && bankImport.groups.find(function(x){ return x.key === key; });
  if(!g) return;
  g.choice.category = category || "";
  if(g.choice.linkedExpenseId || g.choice.category) g.source = "chosen";
  bankImport.coverage = coverageOfGroups(bankImport.groups);
}
// Coverage recomputed off the groups once the user starts editing — coverageOf() reads per-row
// suggestions, which stop being the truth the moment a group is reassigned.
function coverageOfGroups(groups){
  var total = 0, placed = 0;
  groups.forEach(function(g){
    total += g.rows.length;
    if(g.choice.linkedExpenseId || (g.choice.category || "").trim()) placed += g.rows.length;
  });
  return { total: total, placed: placed, fraction: total ? placed / total : 0 };
}

// ---------------- Render ----------------
export function renderBankImportPanel(){
  var panel = document.getElementById("bankImportPanel");
  if(!panel) return;
  if(!bankImport){ panel.hidden = true; panel.innerHTML = ""; return; }
  panel.hidden = false;
  var s = bankImport.summary;
  if(!bankImport.parsed.headerOk){
    panel.innerHTML =
      '<p class="ledger-note bank-import-problem">Couldn\'t find a date column and an amount column in that file. Most banks\' "export as CSV" gives you both — if yours exports Excel or PDF, look for a CSV option in the same menu.</p>' +
      bankImportActionsHtml(false);
    return;
  }
  if(!bankImport.groups.length && !bankImport.duplicates.length && !bankImport.credits.length && !bankImport.possibleDuplicates.length){
    panel.innerHTML = '<p class="ledger-note bank-import-problem">Nothing importable in that file' +
      (s.skipped ? " — " + s.skipped + " row" + (s.skipped === 1 ? "" : "s") + " couldn't be read." : ".") + '</p>' +
      bankImportActionsHtml(false);
    return;
  }
  panel.innerHTML =
    bankImportHeaderHtml(s) +
    bankImportGroupsHtml() +
    bankImportAsideHtml() +
    bankImportActionsHtml(true);
}

function bankImportHeaderHtml(s){
  var cov = bankImport.coverage;
  // Counted off the groups, not off summary.newSpend — the summary always excludes the possible
  // duplicates, so once they're opted in the two would disagree and the header would contradict
  // the button directly underneath it.
  var count = cov.total;
  var amount = bankImport.groups.reduce(function(sum, g){ return sum + g.total; }, 0);
  var range = s.firstDate && s.lastDate
    ? (s.firstDate === s.lastDate ? s.firstDate : s.firstDate + " → " + s.lastDate)
    : "";
  // The date order is stated and changeable rather than quietly assumed. It is the one decision in
  // this whole flow that can be wrong without looking wrong: 03/04 read the other way moves a third
  // of the file into the wrong months and every figure downstream moves with it.
  var orderLabel = s.dateOrder === "MDY" ? "MM/DD" : "DD/MM";
  var otherOrder = s.dateOrder === "MDY" ? "DMY" : "MDY";
  return '<div class="bank-import-head">' +
    '<p class="ledger-note" style="margin:0"><b>' + count + ' transaction' + (count === 1 ? "" : "s") + '</b> to import' +
      (amount > 0 ? ", " + fmtCurrency0.format(amount) + " in total" : "") + '.' +
      (s.duplicates ? " " + s.duplicates + " already logged." : "") +
      (s.skipped ? " " + s.skipped + " row" + (s.skipped === 1 ? "" : "s") + " couldn't be read." : "") +
    '</p>' +
    (range ? '<p class="ledger-note bank-import-meta">' + escapeAttr(range) + ' · dates read as <b>' + orderLabel + '</b> ' +
      '<button type="button" class="calc-hint-link" data-bank-date-order="' + otherOrder + '">read them the other way</button></p>' : "") +
    (s.hasFutureDates ? '<p class="tax-cap-note warn" style="margin:8px 0 0">Some of these dates are months in the future, which is what a back-to-front date order looks like. Worth checking before you import.</p>' : "") +
    (cov.total ? '<p class="ledger-note bank-import-meta" data-bank-coverage>' + cov.placed + ' of ' + cov.total + ' placed automatically' +
      (cov.placed < cov.total ? ' — the rest are at the top, waiting on you.' : '.') + '</p>' : "") +
  '</div>';
}

// Unplaced merchants first and in bold, because they're the only thing on this screen that needs a
// decision. Everything else is there to be skimmed and confirmed.
function bankImportGroupsHtml(){
  var lines = loggableBudgetLineItems();
  var unplaced = bankImport.groups.filter(function(g){ return !g.choice.linkedExpenseId && !(g.choice.category || "").trim(); });
  var placed = bankImport.groups.filter(function(g){ return g.choice.linkedExpenseId || (g.choice.category || "").trim(); });
  var html = "";
  // The counts carry a hook because rows don't move between these two sections when answered (see
  // patchBankImportPanel) — so without patching the numbers, "Needs you (7)" would still say 7
  // after you'd dealt with two of them, which is worse than not showing a count at all.
  if(unplaced.length){
    html += '<h4 class="bank-import-subhead">Needs you (<span data-bank-count="unplaced">' + unplaced.length + '</span>)</h4>' +
      '<div class="m-card"><div class="m-rows">' + unplaced.map(function(g){ return groupRowHtml(g, lines); }).join("") + '</div></div>';
  }
  if(placed.length){
    html += '<h4 class="bank-import-subhead">Ready (<span data-bank-count="placed">' + placed.length + '</span>)</h4>' +
      '<div class="m-card"><div class="m-rows">' + placed.map(function(g){ return groupRowHtml(g, lines); }).join("") + '</div></div>';
  }
  return html;
}

function groupRowHtml(g, lines){
  var badge = g.source === "rule"
    ? '<span class="bank-import-badge is-rule" title="From a rule you taught this app on an earlier import">learned</span>'
    : (g.source === "name" ? '<span class="bank-import-badge" title="Matched to a budget line by name — worth a glance">guessed</span>' : "");
  var countLabel = g.rows.length === 1 ? "1 transaction" : g.rows.length + " transactions";
  var placed = !!(g.choice.linkedExpenseId || (g.choice.category || "").trim());
  return '<div class="m-row bank-import-group' + (placed ? "" : " is-unplaced") + '" data-bank-group="' + escapeAttr(g.key) + '">' +
    '<div class="m-row-summary" style="cursor:default">' +
      '<div style="flex:1 1 auto; min-width:0">' +
        '<div class="m-row-name">' + escapeAttr(g.label) + badge + '</div>' +
        '<div class="m-row-sub">' + countLabel + ' · ' + fmtCurrency2.format(g.total) + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="bank-import-assign">' +
      '<label class="bank-import-field"><span>Budget line</span>' +
        '<select class="bank-group-line" data-bank-group="' + escapeAttr(g.key) + '">' +
          '<option value="">— not linked —</option>' +
          lines.map(function(l){
            return '<option value="' + escapeAttr(l.id) + '"' + (l.id === g.choice.linkedExpenseId ? " selected" : "") + '>' + escapeAttr(l.what) + '</option>';
          }).join("") +
        '</select>' +
      '</label>' +
      '<label class="bank-import-field"><span>Category</span>' +
        '<select class="bank-group-category" data-bank-group="' + escapeAttr(g.key) + '">' +
          '<option value="">— none —</option>' +
          state.categories.map(function(c){
            return '<option value="' + escapeAttr(c) + '"' + (c === g.choice.category ? " selected" : "") + '>' + escapeAttr(c) + '</option>';
          }).join("") +
        '</select>' +
      '</label>' +
    '</div>' +
  '</div>';
}

// Duplicates and credits are stated but not actionable: knowing 12 rows were already logged is
// what stops someone importing the same statement twice and then wondering why their spending
// doubled. Money in is named rather than silently dropped, because a refund landing in a spending
// import would otherwise look like the file lost rows.
function bankImportAsideHtml(){
  var maybes = bankImport.possibleDuplicates.length;
  // Above the fold, not tucked in the disclosure below: skipping rows the user actually spent is
  // as wrong as importing rows they didn't, and only they can tell which this is.
  var maybeNote = maybes
    ? '<p class="tax-cap-note' + (bankImport.includePossibleDuplicates ? "" : " warn") + '" style="margin:12px 0 0">' +
        maybes + ' row' + (maybes === 1 ? "" : "s") + ' match the date and amount of something you already logged by hand. ' +
        'Hand-logged entries carry no shop name, so there\'s no way to be sure they\'re the same purchases — ' +
        (bankImport.includePossibleDuplicates
          ? 'they\'re being imported. <button type="button" class="calc-hint-link" data-bank-maybes="0">Leave them out</button>'
          : 'they\'re being left out. <button type="button" class="calc-hint-link" data-bank-maybes="1">Import them anyway</button>') +
      '</p>'
    : "";
  var bits = [];
  if(bankImport.duplicates.length){
    bits.push(bankImport.duplicates.length + " row" + (bankImport.duplicates.length === 1 ? " was" : "s were") +
      " already logged and will be skipped");
  }
  if(bankImport.credits.length){
    bits.push(bankImport.credits.length + " money-in row" + (bankImport.credits.length === 1 ? "" : "s") +
      " (refunds, salary) won't be imported — this list is spending");
  }
  var errs = bankImport.parsed.errors;
  if(!bits.length && !errs.length) return maybeNote;
  return maybeNote + '<details class="tax-advanced bank-import-aside"><summary>What isn\'t being imported</summary>' +
    '<ul class="bank-import-aside-list">' +
      bits.map(function(b){ return "<li>" + escapeAttr(b) + "</li>"; }).join("") +
      errs.slice(0, 8).map(function(e){ return "<li>Row " + e.row + ": " + escapeAttr(e.reason) + "</li>"; }).join("") +
      (errs.length > 8 ? "<li>and " + (errs.length - 8) + " more</li>" : "") +
    '</ul></details>';
}

function bankImportActionsHtml(canImport){
  var n = canImport ? bankImport.coverage.total : 0;
  return '<div class="bank-import-actions">' +
    (canImport && n ? '<button type="button" class="btn btn-sm btn-primary" id="bankImportConfirmBtn">Import ' + n + ' transaction' + (n === 1 ? "" : "s") + '</button>' : "") +
    '<button type="button" class="btn btn-sm btn-ghost" id="bankImportCancelBtn">Cancel</button>' +
  '</div>';
}

// Updates one group's badge and the panel's counts after the user assigns it, without rebuilding
// the list. A full re-render would move that row out of "Needs you" and into "Ready" the instant it
// was answered — reordering the list under the finger that just answered it, which on a phone is
// how a long review gets abandoned. The row stays put; only what it says about itself changes.
export function patchBankImportPanel(groupKey){
  if(!bankImport) return;
  var panel = document.getElementById("bankImportPanel");
  if(!panel) return;
  var g = bankImport.groups.find(function(x){ return x.key === groupKey; });
  var row = panel.querySelector('.bank-import-group[data-bank-group="' + cssEscape(groupKey) + '"]');
  if(g && row){
    var nameEl = row.querySelector(".m-row-name");
    var badge = nameEl && nameEl.querySelector(".bank-import-badge");
    var placed = !!(g.choice.linkedExpenseId || (g.choice.category || "").trim());
    if(badge) badge.remove();
    if(placed){
      var span = document.createElement("span");
      span.className = "bank-import-badge is-rule";
      span.textContent = "set";
      span.title = "You set this one — it'll be remembered for next time";
      if(nameEl) nameEl.appendChild(span);
    }
    row.classList.toggle("is-unplaced", !placed);
  }
  var cov = bankImport.coverage;
  var covEl = panel.querySelector("[data-bank-coverage]");
  if(covEl) covEl.textContent = cov.placed + " of " + cov.total + " ready" + (cov.placed < cov.total ? " — the rest are waiting on you." : ".");
  // The two section counts, recomputed off the live choices rather than off which section a row
  // happens to be sitting in — rows stay put, so the section is no longer the source of truth.
  var stillUnplaced = bankImport.groups.filter(function(x){ return !x.choice.linkedExpenseId && !(x.choice.category || "").trim(); }).length;
  var unplacedEl = panel.querySelector('[data-bank-count="unplaced"]');
  if(unplacedEl) unplacedEl.textContent = stillUnplaced;
  var placedEl = panel.querySelector('[data-bank-count="placed"]');
  if(placedEl) placedEl.textContent = bankImport.groups.length - stillUnplaced;
  var confirmBtn = document.getElementById("bankImportConfirmBtn");
  if(confirmBtn) confirmBtn.textContent = "Import " + cov.total + " transaction" + (cov.total === 1 ? "" : "s");
}
// document.querySelector needs the merchant key escaped: it's derived from a bank's free text and
// can legitimately contain characters that mean something in a selector.
function cssEscape(s){
  if(window.CSS && window.CSS.escape) return window.CSS.escape(s);
  return String(s).replace(/["\\]/g, "\\$&");
}

// ---------------- Commit ----------------
// Returns the ids created, so app.js can offer an undo that removes exactly these and nothing else
// — the same shape the other bulk actions on this page use.
export function commitBankImport(){
  if(!bankImport) return { ids: [], learned: 0 };
  var created = [];
  var learned = 0;
  bankImport.groups.forEach(function(g){
    g.rows.forEach(function(row){
      var t = {
        id: genId("t"),
        date: row.date,
        amount: row.amount,
        // The bank's own description is kept as the transaction's `what`. A linked transaction
        // normally leaves this blank and shows its budget line's name, but here it's the only
        // record of which of eight Woolworths trips this row was — and it's what makes a re-import
        // recognise this row as a duplicate.
        what: row.description || "",
        linkedExpenseId: g.choice.linkedExpenseId || null,
        account: g.choice.account || "",
        category: g.choice.linkedExpenseId ? "" : (g.choice.category || "")
      };
      state.transactions.push(t);
      created.push(t.id);
    });
    // Confirming the import is confirming the suggestion, so a group the user never touched still
    // teaches its rule — which turns next month's "guessed" into "learned" and makes the coverage
    // number climb with use rather than staying wherever the line names happened to land it.
    var before = state.importRules.length;
    learnRule(state.importRules, g.label, g.choice, function(){ return genId("rule"); });
    if(state.importRules.length > before) learned++;
  });
  persist();
  return { ids: created, learned: learned, groups: bankImport.groups.length };
}

// Undo: drop exactly the transactions this import created. Rules it taught are deliberately left
// alone — they're a preference the user expressed, not part of the data being undone, and
// re-importing the same file is the normal reason to undo.
export function undoBankImport(ids){
  var kill = {};
  (ids || []).forEach(function(id){ kill[id] = true; });
  state.transactions = state.transactions.filter(function(t){ return !kill[t.id]; });
  persist();
}
