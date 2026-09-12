// The bank-import review screen: drop a statement in, check what it worked out, confirm.
//
// Its own file rather than more of components/expenses.js, which is already 1,767 lines and twice
// the size of the next biggest component. This is a self-contained flow — one entry point
// (startBankImport), one exit (commitBankImport), and session-only state that nothing else reads —
// so it splits cleanly, unlike the page-level render functions that genuinely belong together.
// DOM event *registration* still lives in app.js, same as every other component here.
import { state, persist } from "../state.js";
import { parseCsv } from "../lib/backup.js";
import { parseBankCsv, bankImportSummary, parseDiagnosis } from "../calc/bank-import.js";
import { applySuggestions, learnRule, coverageOf, merchantKey, proposedLineFor, suggestedLineName, pruneRules } from "../calc/import-rules.js";
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
    // Money in, grouped the same way spending is so it can be reviewed rather than merely counted.
    // Every one of these starts unassigned and stays out of the import unless the user puts it
    // somewhere: the app cannot tell a $220 refund from a $220 salary instalment from a transfer
    // between your own accounts, and importing salary as negative spending would wreck every
    // figure on the page. Assigning one to a budget line is the user saying "this is a refund".
    creditGroups: groupRows(suggested.filter(function(r){ return r.direction === "credit" && !r.duplicate && !r.possibleDuplicate; }))
      .map(function(g){ return Object.assign(g, { choice: { linkedExpenseId: null, category: "", account: "" }, source: null, isCredit: true }); }),
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
// The sentinel the "+ New budget line" option carries. A staged line, not a created one: the review
// screen's promise is that nothing reaches state until Import is pressed, and a budget line written
// the moment you picked it from a dropdown would strand a row in the app for anyone who then
// cancels. commitBankImport() creates it for real.
export var NEW_LINE_VALUE = "__new_budget_line__";
// Spending and money-in groups share every control, so every lookup searches both. Keys can't
// collide between them in practice, and a wrong hit would only mis-assign within one import.
function findGroup(key){
  if(!bankImport) return null;
  return bankImport.groups.find(function(x){ return x.key === key; }) ||
    bankImport.creditGroups.find(function(x){ return x.key === key; }) || null;
}
export function setBankImportGroupLine(key, expenseId){
  var g = findGroup(key);
  if(!g) return;
  if(expenseId === NEW_LINE_VALUE && !g.isCredit){
    g.choice.newLine = proposedLineFor(g, bankImport.parsed.rows);
    g.choice.linkedExpenseId = null;
    g.choice.category = g.choice.newLine.category;
    g.source = "chosen";
    bankImport.coverage = coverageOfGroups(bankImport.groups);
    return;
  }
  g.choice.newLine = null;
  g.choice.linkedExpenseId = expenseId || null;
  // Taking the line's category too, so assigning a line answers both questions at once — the
  // category select below it is for the one-offs that have no line to inherit from.
  var line = expenseId && loggableBudgetLineItems().find(function(i){ return i.id === expenseId; });
  if(line) g.choice.category = line.category || "";
  g.source = "chosen";
  bankImport.coverage = coverageOfGroups(bankImport.groups);
}
export function setBankImportGroupCategory(key, category){
  var g = findGroup(key);
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
    if(groupIsPlaced(g)) placed += g.rows.length;
  });
  return { total: total, placed: placed, fraction: total ? placed / total : 0 };
}
// One definition, used by the coverage count, the section split, the row's own marker and the
// in-place patch. They disagreed the moment a fourth way to place a group (a pending new line) was
// added, so there is only one of these now.
function groupIsPlaced(g){
  return !!(g.choice.linkedExpenseId || (g.choice.category || "").trim() || g.choice.newLine);
}

// ---------------- Render ----------------
export function renderBankImportPanel(){
  var panel = document.getElementById("bankImportPanel");
  if(!panel) return;
  if(!bankImport){ panel.hidden = true; panel.innerHTML = ""; return; }
  panel.hidden = false;
  var s = bankImport.summary;
  if(!bankImport.parsed.headerOk){
    panel.innerHTML = bankImportFailureHtml() + bankImportActionsHtml(false);
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

// The help sits in the card from load, before any file is picked. Rendered rather than written
// into index.html so the copy lives next to the parser it describes — the two drift apart the
// moment a new header alias is added and nobody remembers the help text exists.
export function renderBankImportHelp(){
  var el = document.getElementById("bankImportHelp");
  if(el) el.innerHTML = bankImportHelpHtml();
}

// Why that file couldn't be read, named rather than guessed.
//
// The old copy said "couldn't find a date column and an amount column" whatever was wrong, which is
// misleading for the common case: a file with Merchant/Spend/Notes has a perfectly good amount
// column and no date, and being told both are missing sends the reader looking for the wrong thing.
// Showing the row the app actually read is the fastest way to see the mismatch — faster than any
// rule about columns, because the reader recognises their own file.
function bankImportFailureHtml(){
  var d = parseDiagnosis(bankImport.parsed.columns);
  var first = bankImport.parsed.firstRow || [];
  var article = function(word){ return /^[aeiou]/i.test(word) ? "an " : "a "; };
  var missing = d.missing.length === 2
    ? "a date column or an amount column"
    : article(d.missing[0]) + d.missing[0] + " column";
  var found = !d.found.length ? ""
    : d.found.length === 1
      ? " It did find " + article(d.found[0]) + d.found[0] + " column."
      : " It did find " + d.found.slice(0, -1).join(", ") + " and " + d.found[d.found.length - 1] + " columns.";
  return '<p class="ledger-note bank-import-problem"><b>Couldn\'t find ' + missing + ' in that file.</b>' + found +
      ' Most banks\' "export as CSV" includes a date and an amount — if yours exports Excel or PDF, look for a CSV option in the same menu.</p>' +
    (first.length
      ? '<p class="ledger-note bank-import-meta">The first row it read was: <code>' +
        first.map(function(c){ return escapeAttr(String(c).slice(0, 22)); }).join(" · ") + '</code></p>'
      : "") +
    bankImportHelpHtml();
}

// What this actually accepts. Always available, not only after something goes wrong — the panel
// otherwise says "export a CSV and drop it in here" and leaves the reader to find out by failing.
// A <details> so it costs nothing when it isn't wanted.
export function bankImportHelpHtml(){
  return '<details class="bank-import-help">' +
    '<summary>What this reads — no template needed</summary>' +
    '<p>Drop in whatever your bank exports. There is no template to fill in: unlike the CSV imports on the other pages, this one works out your bank\'s own layout.</p>' +
    '<ul>' +
      '<li><b>Columns</b> — it matches the wording banks use: <i>date, transaction date, processed date</i> · <i>description, transaction details, narrative, particulars, merchant, payee</i> · <i>amount, value</i>, or separate <i>debit/credit</i> (<i>withdrawal, money out</i> / <i>deposit, money in</i>).</li>' +
      '<li><b>No header row?</b> Fine — several banks export none. It works the columns out from the data instead.</li>' +
      '<li><b>Dates</b> are read as DD/MM unless the file proves otherwise. The next screen says which way it read them and lets you flip it.</li>' +
      '<li><b>Amounts</b> can be <code>$1,234.56</code>, <code>(1,234.56)</code> or <code>-1234.56</code>.</li>' +
      '<li><b>Re-importing</b> an overlapping range is expected — anything already logged is detected and skipped.</li>' +
    '</ul>' +
  '</details>';
}

// The reasons rows were skipped. parseBankCsv has always collected these — row number and what
// went wrong — and the panel has always thrown them away and shown a bare count. "3 rows couldn't
// be read" is not something anyone can act on; "row 14: couldn't read \"Pending\" as a date" is.
// Capped at three, because a file whose every row fails does not need forty copies of one sentence.
function skippedReasonsHtml(){
  var errs = (bankImport.parsed.errors || []);
  if(!errs.length) return "";
  var shown = errs.slice(0, 3).map(function(e){
    return '<li>Row ' + e.row + ': ' + escapeAttr(e.reason) + '</li>';
  }).join("");
  var more = errs.length > 3 ? '<li>…and ' + (errs.length - 3) + ' more</li>' : "";
  return '<details class="bank-import-help bank-import-skipped">' +
    '<summary>Why ' + errs.length + ' row' + (errs.length === 1 ? " was" : "s were") + ' skipped</summary>' +
    '<ul>' + shown + more + '</ul>' +
    '<p>Skipped rows are usually a statement\'s own headings, a pending line with no date, or a total at the bottom — normally nothing you need.</p>' +
  '</details>';
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
    skippedReasonsHtml() +
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
  var unplaced = bankImport.groups.filter(function(g){ return !groupIsPlaced(g); });
  var placed = bankImport.groups.filter(groupIsPlaced);
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
  if(bankImport.creditGroups.length){
    html += '<h4 class="bank-import-subhead">Money in (' + bankImport.creditGroups.length + ')</h4>' +
      '<p class="ledger-note" style="margin:0 0 8px">Left out unless you say otherwise — this app can\'t tell a refund from salary or a transfer. ' +
      'Put one on a budget line and it imports as a refund, reducing what you spent on that line.</p>' +
      '<div class="m-card"><div class="m-rows">' + bankImport.creditGroups.map(function(g){ return groupRowHtml(g, lines); }).join("") + '</div></div>';
  }
  return html;
}

function groupRowHtml(g, lines){
  var badge = g.source === "rule"
    ? '<span class="bank-import-badge is-rule" title="From a rule you taught this app on an earlier import">learned</span>'
    : (g.source === "name" ? '<span class="bank-import-badge" title="Matched to a budget line by name — worth a glance">guessed</span>' : "");
  if(g.isCredit) badge = '<span class="bank-import-badge is-credit" title="Money in. Assign it to a budget line to import it as a refund against that line.">money in</span>';
  var countLabel = g.rows.length === 1 ? "1 transaction" : g.rows.length + " transactions";
  var placed = groupIsPlaced(g);
  return '<div class="m-row bank-import-group' + (placed ? "" : " is-unplaced") + '" data-bank-group="' + escapeAttr(g.key) + '">' +
    '<div class="m-row-summary" style="cursor:default">' +
      '<div style="flex:1 1 auto; min-width:0">' +
        '<div class="m-row-name">' + escapeAttr(g.label) + badge + '</div>' +
        '<div class="m-row-sub">' + countLabel + ' · ' + (g.isCredit ? "+" : "") + fmtCurrency2.format(g.total) + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="bank-import-assign">' +
      '<label class="bank-import-field"><span>Budget line</span>' +
        '<select class="bank-group-line" data-bank-group="' + escapeAttr(g.key) + '">' +
          '<option value="">' + (g.isCredit ? "— don\'t import —" : "— not linked —") + '</option>' +
          (g.isCredit ? "" : '<option value="' + NEW_LINE_VALUE + '"' + (g.choice.newLine ? " selected" : "") + '>+ New line "' + escapeAttr(suggestedLineName(g.key)) + '"</option>') +
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
      newLineNoteHtml(g) +
    '</div>' +
  '</div>';
}

// The amount on a created line is derived, not typed, so the screen shows its working — the user is
// about to plan against this figure, and "$138.70/mo" with no provenance is a number to distrust.
// A part-month import is called out rather than corrected for: inflating a real total to cover days
// the file doesn't contain would be inventing spending.
function newLineNoteHtml(g){
  if(!g.choice.newLine) return "";
  var b = g.choice.newLine.basis;
  return '<p class="ledger-note bank-import-newline" data-bank-newline="' + escapeAttr(g.key) + '">Creates a budget line <b>' +
    escapeAttr(g.choice.newLine.what) + '</b> at <b>' + fmtCurrency2.format(g.choice.newLine.amount) + '/mo</b> — ' +
    b.transactions + ' transaction' + (b.transactions === 1 ? "" : "s") + ' totalling ' + fmtCurrency2.format(b.total) +
    ' over ' + b.months + ' month' + (b.months === 1 ? "" : "s") + ' of statement. Edit it on the Budget tab afterwards.</p>';
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

  var errs = bankImport.parsed.errors;
  if(!bits.length && !errs.length) return maybeNote;
  return maybeNote + '<details class="tax-advanced bank-import-aside"><summary>What isn\'t being imported</summary>' +
    '<ul class="bank-import-aside-list">' +
      bits.map(function(b){ return "<li>" + escapeAttr(b) + "</li>"; }).join("") +
      errs.slice(0, 8).map(function(e){ return "<li>Row " + e.row + ": " + escapeAttr(e.reason) + "</li>"; }).join("") +
      (errs.length > 8 ? "<li>and " + (errs.length - 8) + " more</li>" : "") +
    '</ul></details>';
}

// What the Import button will actually create: every spending row, plus the rows from any money-in
// group the user has assigned. Counting only the spending groups meant a statement whose only new
// rows were refunds offered no button at all — the second import of a file, where the spending is
// all duplicates and the refund is the one thing left to do.
export function importableCount(){
  if(!bankImport) return 0;
  return bankImport.coverage.total + assignedCreditRowCount();
}
function assignedCreditRowCount(){
  return bankImport.creditGroups.reduce(function(n, g){
    return n + ((g.choice.linkedExpenseId || (g.choice.category || "").trim()) ? g.rows.length : 0);
  }, 0);
}
function bankImportActionsHtml(canImport){
  var n = canImport ? importableCount() : 0;
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
  var g = findGroup(groupKey);
  var row = panel.querySelector('.bank-import-group[data-bank-group="' + cssEscape(groupKey) + '"]');
  if(g && row){
    var nameEl = row.querySelector(".m-row-name");
    var badge = nameEl && nameEl.querySelector(".bank-import-badge");
    var placed = groupIsPlaced(g);
    if(badge) badge.remove();
    if(placed){
      var span = document.createElement("span");
      span.className = "bank-import-badge is-rule";
      span.textContent = "set";
      span.title = "You set this one — it'll be remembered for next time";
      if(nameEl) nameEl.appendChild(span);
    }
    row.classList.toggle("is-unplaced", !placed);
    // The created-line note lives in groupRowHtml, which only runs on a full render — so without
    // patching it here, picking "+ New line" showed no sign of what it was about to create. The
    // amount on that line is derived rather than typed; showing its working is the point.
    var existingNote = row.querySelector("[data-bank-newline]");
    if(existingNote) existingNote.remove();
    var noteHtml = newLineNoteHtml(g);
    var assign = row.querySelector(".bank-import-assign");
    if(noteHtml && assign) assign.insertAdjacentHTML("beforeend", noteHtml);
  }
  var cov = bankImport.coverage;
  var covEl = panel.querySelector("[data-bank-coverage]");
  if(covEl) covEl.textContent = cov.placed + " of " + cov.total + " ready" + (cov.placed < cov.total ? " — the rest are waiting on you." : ".");
  // The two section counts, recomputed off the live choices rather than off which section a row
  // happens to be sitting in — rows stay put, so the section is no longer the source of truth.
  var stillUnplaced = bankImport.groups.filter(function(x){ return !groupIsPlaced(x); }).length;
  var unplacedEl = panel.querySelector('[data-bank-count="unplaced"]');
  if(unplacedEl) unplacedEl.textContent = stillUnplaced;
  var placedEl = panel.querySelector('[data-bank-count="placed"]');
  if(placedEl) placedEl.textContent = bankImport.groups.length - stillUnplaced;
  // Rebuilt rather than relabelled: assigning the first money-in group can take the count from 0,
  // where no button was rendered at all, to 1.
  var actions = panel.querySelector(".bank-import-actions");
  if(actions) actions.outerHTML = bankImportActionsHtml(true);
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
  if(!bankImport) return { ids: [], learned: 0, lineIds: [], linesCreated: 0 };
  var created = [];
  var createdLineIds = [];
  var learned = 0;
  // Money-in groups the user assigned to a budget line are refunds, and import as negative
  // transactions against it. An unassigned one is skipped, which is the default and the safe
  // reading — importing salary as negative spending would wreck every figure on the page.
  var refundGroups = bankImport.creditGroups.filter(function(g){ return !!g.choice.linkedExpenseId || !!(g.choice.category || "").trim(); });
  refundGroups.forEach(function(g){ g.isRefund = true; });
  bankImport.groups.concat(refundGroups).forEach(function(g){
    // Staged budget lines become real here and nowhere earlier — see NEW_LINE_VALUE. Created
    // before the transactions below so they have an id to link to, and pushed onto state.shared
    // with an explicit id rather than waiting for migrateState to backfill one on the next load,
    // which would be far too late for the rows about to reference it.
    if(g.choice.newLine){
      var line = {
        id: genId("exp"),
        what: g.choice.newLine.what,
        classification: g.choice.newLine.classification || "Needs",
        category: g.choice.newLine.category || "",
        account: g.choice.account || "",
        amount: g.choice.newLine.amount,
        freq: g.choice.newLine.freq || "Monthly",
        irregular: false,
        dueMonth: null
      };
      state.shared.push(line);
      createdLineIds.push(line.id);
      g.choice.linkedExpenseId = line.id;
      g.choice.newLine = null;
    }
    g.rows.forEach(function(row){
      var t = {
        id: genId("t"),
        date: row.date,
        // Negative for a refund: money coming back reduces what this budget line cost you.
        amount: g.isRefund ? -row.amount : row.amount,
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
  return { ids: created, learned: learned, groups: bankImport.groups.length,
           lineIds: createdLineIds, linesCreated: createdLineIds.length,
           refunds: refundGroups.reduce(function(n, g){ return n + g.rows.length; }, 0) };
}

// Undo: drop exactly the transactions this import created. Rules it taught are deliberately left
// alone — they're a preference the user expressed, not part of the data being undone, and
// re-importing the same file is the normal reason to undo.
export function undoBankImport(ids, lineIds){
  var kill = {};
  (ids || []).forEach(function(id){ kill[id] = true; });
  state.transactions = state.transactions.filter(function(t){ return !kill[t.id]; });
  // Budget lines the import created go back too. They only exist because of this import, so
  // leaving them behind would turn "undo" into "undo the transactions and keep the clutter" — and
  // unlike a rule, a stray budget line shows up in every total on the Budget tab.
  if(lineIds && lineIds.length){
    var killLines = {};
    lineIds.forEach(function(id){ killLines[id] = true; });
    state.shared = state.shared.filter(function(i){ return !killLines[i.id]; });
    // Rules that pointed at them would otherwise file next month's spend against nothing — the
    // same failure pruneRules() exists for.
    state.importRules = pruneRules(state.importRules, loggableBudgetLineItems());
  }
  persist();
}
