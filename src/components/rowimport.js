// ---------------- Spreadsheet row imports: read, review, confirm, result (#265) ----------------
//
// Budget, Income and Assets each take rows from their own CSV template. The three used to share a shape
// copied three times; they now share this one, the same Select → Review → Confirm → Result contract as the
// bank and broker imports (docs/design/imports.md):
//
//   - Reading says so, with Cancel. A read that finishes after Cancel or a newer choice is dropped.
//   - The review names where each row goes and leaves out rows that look like ones the household already
//     has (or that repeat an earlier row in the file) unless "Include them" is ticked — the owner's choice,
//     so importing a template twice doesn't double a budget.
//   - Confirm rechecks: a property deleted since the review sends the review back with what changed said,
//     and a household replaced since (restore, reset, another tab's save) is reviewed again against the one
//     now open. Nothing is ever sent somewhere the person didn't see.
//   - Success is reported only once the save is observed. A save that doesn't happen takes the rows back
//     out and keeps the review, so nothing claims to be imported that isn't.
//   - Undo takes exactly the imported rows out (calc/rowimport.js), and refuses when one was edited or
//     removed since, or the household was replaced.
import { recalcComputedItems } from "../calc/engine.js";
import { markRowImportDuplicates, rowImportLostDestinations, rowImportTouched, applyRowImport, snapshotRowImport, undoRowImport } from "../calc/rowimport.js";
import { fmtCurrency0, fmtCurrency2, fmtDate, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { showToast, showUndoToast } from "../lib/toast.js";
import { redrawTouched } from "../lib/views.js";
import { state, commit, onSaved, onStateReplaced } from "../state.js";
import { parseAssetsImportCsv } from "./assets.js";
import { parseExpensesImportCsv } from "./expenses.js";
import { parseIncomeImportCsv } from "./income.js";

var KINDS = {
  expenses: { file: "expenseImportFile", pick: "expenseImportBtn", panel: "expenseImportPreview", parse: parseExpensesImportCsv, one: "expense", many: "expenses", needs: '"What" and "Amount"' },
  income: { file: "incomeImportFile", pick: "incomeImportBtn", panel: "incomeImportPreview", parse: parseIncomeImportCsv, one: "income row", many: "income rows", needs: '"What" and "Amount"' },
  assets: { file: "assetsImportFile", pick: "assetsImportBtn", panel: "assetsImportPreview", parse: parseAssetsImportCsv, one: "asset", many: "assets", needs: '"What" and "Category"' }
};
var SHOWN = 8;

// One read or review per kind: { token, name, file, household, status: reading|error|review|unsaved, text,
// parsed, includeDups, note }. Session only; nothing here is saved.
var reviews = {};
var nextToken = 0;
var saves = 0;
onSaved(function(){ saves++; });

function plural(n, one, many){ return n + " " + (n === 1 ? one : many); }

// Where a parsed row will go, in the words the pages use.
export function rowImportDestination(kind, item){
  if(kind === "expenses") return item.source === "Housing" ? "Home costs" : item.propertyId ? item.source : "Budget";
  if(kind === "income") return item.person ? "Income · " + item.person : "Income · shared";
  return "Investments → " + item.category;
}
function assetDetail(item){
  if(item.category === "Shares") return item.symbol + " · " + item.quantity + " @ " + fmtCurrency2.format(item.price) + (item.market ? " (" + item.market + ")" : "");
  if(item.category === "Vehicle") return fmtCurrency0.format(item.purchasePrice) + " purchase price, " + item.depreciationRate + "%/yr" + (item.purchaseDate ? " from " + fmtDate(item.purchaseDate, { year: true }) : "");
  return fmtCurrency2.format(item.amount);
}
function tableHtml(kind, items){
  var head, row;
  if(kind === "expenses"){
    head = '<th scope="col">What</th><th scope="col" class="num">Amount</th><th scope="col">Frequency</th><th scope="col">Goes to</th><th scope="col">Account</th>';
    row = function(i){ return "<td>" + escapeAttr(i.what) + '</td><td class="num">' + fmtCurrency2.format(i.amount) + "</td><td>" + escapeAttr(i.freq) + "</td><td>" + escapeAttr(rowImportDestination(kind, i)) + "</td><td>" + escapeAttr(i.account) + "</td>"; };
  } else if(kind === "income"){
    head = '<th scope="col">What</th><th scope="col">Goes to</th><th scope="col">Type</th><th scope="col" class="num">Amount</th><th scope="col">Frequency</th>';
    row = function(i){ return "<td>" + escapeAttr(i.what) + "</td><td>" + escapeAttr(rowImportDestination(kind, i)) + "</td><td>" + escapeAttr(i.incomeType) + '</td><td class="num">' + fmtCurrency2.format(i.amount) + "</td><td>" + escapeAttr(i.freq) + "</td>"; };
  } else {
    head = '<th scope="col">What</th><th scope="col">Goes to</th><th scope="col">Detail</th>';
    row = function(i){ return "<td>" + escapeAttr(i.what) + "</td><td>" + escapeAttr(rowImportDestination(kind, i)) + "</td><td>" + escapeAttr(assetDetail(i)) + "</td>"; };
  }
  return '<div class="table-scroll row-import-table" role="region" aria-label="Rows to import; scroll sideways for every column" tabindex="0"><table class="import-preview-table"><thead><tr>' + head + "</tr></thead><tbody>" +
    items.slice(0, SHOWN).map(function(i){ return "<tr>" + row(i) + "</tr>"; }).join("") + "</tbody></table></div>" +
    (items.length > SHOWN ? '<p class="ledger-note row-import-more">and ' + (items.length - SHOWN) + " more</p>" : "");
}
function chosenRows(r){ return r.parsed.valid.filter(function(i){ return r.includeDups || !i.duplicate; }); }
function actions(buttons){ return '<div class="row-import-actions">' + buttons + "</div>"; }
var CANCEL = '<button type="button" class="btn btn-sm btn-ghost" data-rowimport-cancel>Cancel</button>';
var DISMISS = '<button type="button" class="btn btn-sm btn-ghost" data-rowimport-cancel>Dismiss</button>';
function status(text, warn){ return '<p class="ledger-note row-import-status' + (warn ? " is-warn" : "") + '" role="status" tabindex="-1" data-rowimport-status>' + text + "</p>"; }

// The panel for one kind's read or review (r). Pure: it reads only r and the kind.
export function rowImportPanelHtml(kind, r){
  var k = KINDS[kind], from = escapeAttr(r.name || "the file");
  if(r.status === "reading") return status("Reading <b>" + from + "</b>… Nothing is added until you confirm the review.") + actions(CANCEL);
  if(r.status === "error") return status("Couldn't read <b>" + from + "</b>. Retry, or choose another file.", true) +
    actions('<button type="button" class="btn btn-sm" data-rowimport-retry>Retry</button>' + CANCEL);
  var p = r.parsed;
  if(!p.headerOk) return status("Couldn't find " + k.needs + " columns in <b>" + from + "</b>. Download the import template from this page's ⋯ menu, or check your header row matches it.", true) + actions(DISMISS);
  if(!p.valid.length && !p.errors.length) return status("No rows found in <b>" + from + "</b>.", true) + actions(DISMISS);
  var chosen = chosenRows(r), dups = p.valid.filter(function(i){ return i.duplicate; });
  var lead = r.status === "unsaved"
    ? status("<b>Not saved — nothing was imported from " + from + ".</b> This browser couldn't save the household just now (the status in the header says why), so the rows were taken back out. The review is kept: try again once saving works, or cancel.", true)
    : status("<b>" + plural(chosen.length, k.one, k.many) + " ready to import</b> from " + from +
        (p.errors.length ? " · " + p.errors.length + " skipped" : "") +
        (dups.length && !r.includeDups ? " · " + dups.length + " left out" : ""));
  var note = r.note ? '<p class="ledger-note row-import-note">' + escapeAttr(r.note) + "</p>" : "";
  var errors = p.errors.length
    ? '<ul class="row-import-errors">' + p.errors.slice(0, 10).map(function(e){ return "<li>Row " + e.row + ": " + escapeAttr(e.reason) + "</li>"; }).join("") +
        (p.errors.length > 10 ? "<li>and " + (p.errors.length - 10) + " more</li>" : "") + "</ul>"
    : "";
  var dupHtml = "";
  if(dups.length){
    var existing = dups.filter(function(i){ return i.duplicate === "existing"; }).length;
    dupHtml = '<div class="row-import-dups"><p class="ledger-note"><b>' + plural(dups.length, "row looks", "rows look") + " like " + (dups.length === 1 ? "one" : "ones") + " you already have</b>" +
      " — " + (existing ? existing + " already in the household" : "") + (existing && existing < dups.length ? ", " : "") + (existing < dups.length ? (dups.length - existing) + " repeating an earlier row in this file" : "") +
      ". Same name, amount, frequency and destination. Left out unless you include them.</p>" +
      '<ul class="row-import-errors">' + dups.slice(0, SHOWN).map(function(i){ return "<li>" + escapeAttr(i.what) + " · " + escapeAttr(rowImportDestination(kind, i)) + "</li>"; }).join("") +
        (dups.length > SHOWN ? "<li>and " + (dups.length - SHOWN) + " more</li>" : "") + "</ul>" +
      '<label class="bank-import-balance"><input type="checkbox" data-rowimport-dups' + (r.includeDups ? " checked" : "") + "><span>Include " + (dups.length === 1 ? "it" : "them") + "</span></label></div>";
  }
  return lead + note + errors + (chosen.length ? tableHtml(kind, chosen) : "") + dupHtml +
    actions((chosen.length ? '<button type="button" class="btn btn-sm btn-primary" data-rowimport-confirm>' + (r.status === "unsaved" ? "Try again" : "Import " + plural(chosen.length, k.one, k.many)) + "</button>" : "") + CANCEL);
}

function panelOf(kind){ return document.getElementById(KINDS[kind].panel); }
function render(kind, focus){
  var panel = panelOf(kind), r = reviews[kind];
  if(!panel) return;
  if(!r){ panel.hidden = true; panel.innerHTML = ""; return; }
  panel.hidden = false;
  panel.innerHTML = rowImportPanelHtml(kind, r);
  if(focus){ var s = panel.querySelector("[data-rowimport-status]"); if(s) s.focus({ preventScroll: false }); }
}
// The page's own ⋯ button: the Import CSV item that started this lives inside its closed menu.
function focusOpener(kind){
  var pick = document.getElementById(KINDS[kind].pick), wrap = pick && pick.closest(".page-overflow");
  var toggle = wrap && wrap.querySelector("[data-overflow-toggle]");
  if(toggle && toggle.getClientRects().length) toggle.focus();
}
function review(kind, r, note){
  r.parsed = KINDS[kind].parse(r.text);
  markRowImportDuplicates(kind, r.parsed.valid, state);
  r.household = state;
  r.status = "review";
  r.note = note || "";
}
function read(kind, r){
  var reader = new FileReader();
  reader.onload = function(){
    if(reviews[kind] !== r) return; // cancelled, or a newer file chosen
    r.text = String(reader.result);
    review(kind, r);
    render(kind, true);
  };
  reader.onerror = function(){
    if(reviews[kind] !== r) return;
    r.status = "error";
    render(kind, true);
  };
  reader.readAsText(r.file);
}
function start(kind, file){
  var r = { token: ++nextToken, name: file.name, file: file, household: state, status: "reading", includeDups: false };
  reviews[kind] = r;
  render(kind, true);
  read(kind, r);
}
function cancel(kind){ delete reviews[kind]; render(kind); focusOpener(kind); }

function confirm(kind){
  var r = reviews[kind];
  if(!r || (r.status !== "review" && r.status !== "unsaved")) return;
  if(r.household !== state){ review(kind, r, "The household changed since this review, so it was reviewed again against the one open now."); render(kind, true); return; }
  var items = chosenRows(r);
  var lost = rowImportLostDestinations(kind, items, state);
  if(lost.length){
    var names = lost.map(function(i){ return i.source; }).filter(function(n, i, a){ return a.indexOf(n) === i; });
    review(kind, r, names.join(", ") + (names.length === 1 ? " is" : " are") + " no longer one of your investment properties, so " + (lost.length === 1 ? "its row now goes" : "those rows now go") + " to the budget instead. Check where each row goes before importing.");
    render(kind, true);
    return;
  }
  if(!items.length) return;
  var touched = rowImportTouched(kind);
  var before = saves;
  var record = applyRowImport(kind, items, state, localDateStr());
  recalcComputedItems();
  commit(touched);
  if(saves === before){
    // Not saved: take the rows back out and say so, rather than leave rows on screen that a reload loses.
    undoRowImport(record, state);
    recalcComputedItems();
    redrawTouched(touched);
    r.status = "unsaved";
    render(kind, true);
    return;
  }
  snapshotRowImport(record);
  delete reviews[kind];
  render(kind);
  focusOpener(kind);
  var k = KINDS[kind], left = r.parsed.valid.length - items.length;
  var toProperties = kind === "expenses" ? items.filter(function(i){ return i.propertyId; }).length : 0;
  showUndoToast(plural(items.length, k.one, k.many) + " imported" +
      (toProperties ? " · " + toProperties + " to " + (toProperties === 1 ? "a property" : "properties") : "") +
      (left ? " · " + left + " left out" : ""),
    function(){
      var undone = undoRowImport(record, state);
      if(!undone.ok){
        showToast(undone.reason === "replaced" ? "Can't undo — the household has been replaced since the import"
          : "Can't undo — " + plural(undone.changed, "imported row was", "imported rows were") + " changed or removed since. Edit them in the list instead.");
        return;
      }
      recalcComputedItems();
      commit(touched);
    });
}

export function wireRowImports(){
  // A household replaced while a review is open (restore, reset, another tab's save adopted): the review was
  // drawn against the old one, so it is drawn again against this one, saying why. A read in progress just
  // goes on — it's reviewed against whichever household is open when it finishes.
  onStateReplaced(function(){
    Object.keys(reviews).forEach(function(kind){
      var r = reviews[kind];
      if(r.status === "review" || r.status === "unsaved"){
        r.includeDups = false;
        review(kind, r, "The household changed since this review, so it was reviewed again against the one open now.");
        render(kind);
      }
    });
  });
  Object.keys(KINDS).forEach(function(kind){
    var k = KINDS[kind];
    document.getElementById(k.pick).addEventListener("click", function(){ document.getElementById(k.file).click(); });
    document.getElementById(k.file).addEventListener("change", function(e){
      var file = e.target.files[0];
      e.target.value = "";
      if(file) start(kind, file);
    });
    var panel = panelOf(kind);
    panel.addEventListener("click", function(e){
      if(e.target.closest("[data-rowimport-cancel]")){ cancel(kind); return; }
      if(e.target.closest("[data-rowimport-confirm]")){ confirm(kind); return; }
      if(e.target.closest("[data-rowimport-retry]")){
        var r = reviews[kind];
        if(r && r.status === "error"){ r.status = "reading"; render(kind, true); read(kind, r); }
      }
    });
    panel.addEventListener("change", function(e){
      if(!e.target.matches("[data-rowimport-dups]")) return;
      var r = reviews[kind];
      if(!r || !r.parsed) return;
      r.includeDups = e.target.checked;
      render(kind);
      var box = panel.querySelector("[data-rowimport-dups]");
      if(box) box.focus();
    });
  });
}

// For tests: the kinds and their element ids.
export { KINDS as ROW_IMPORT_KINDS };
