// ---------------- Spending, wired (v3.206.1, item 237) ----------------
//
// Cash flow → Spending: the list's filters, money in, transfers, splits, bulk edit, the transaction table, trips,
// the review queue for new transactions and receipts.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order. What it shares with app.js it reaches through `app` (lib/appctx.js).
import { setAccountBalance, accountBalance } from "../calc/accounts.js";
import { addTransfer, deleteTransfer, splitTransaction, unsplit, bulkEditTransactions, bulkDeleteTransactions } from "../calc/cashflowlist.js";
import { transactionDisplayName } from "../calc/ledger.js";
import { attachReceipt, detachReceipt } from "../calc/receipts.js";
import { deleteIncomeReceived } from "../calc/received.js";
import { toReview, keepTransaction, refileTransaction, applyRuleFromReview, keepAll, ruleOfferFor } from "../calc/reviewqueue.js";
import { normaliseTrip, applyTripRefile } from "../calc/trips.js";
import { saveView, deleteView, applyView, FILTER_FIELDS } from "../calc/txviews.js";
import { app } from "../lib/appctx.js";
import { fmtCurrency0, fmtCurrency2, localDateStr, parseAmountInput } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { saveReceiptFile, openReceipt, pruneReceipts } from "../lib/receipts.js";
import { onHorizontalSwipe } from "../lib/swipe.js";
import { showToast, showUndoToast } from "../lib/toast.js";
import { state, persist, commit, genId } from "../state.js";
import { txFilters, txSelect, transferForm, splitEditing, resetTxFilters, setTxGrid, txFilterPanel, transferHint, txViewForm } from "./cashflow.js";
import { afterReceivedChange } from "./cashflowwiring.js";
import { renderTransactions, addTransaction, deleteTransaction, renderActualVsPlannedPanel, setTransactionsShowAll, setTransactionsRange, modernTransactionRowOpen, budgetRowTxnsOpen, transactionSummaryText, visibleSpendingIndices, budgetLineItems } from "./expenses.js";
import { firstRun, firstRunHtml } from "./firstrun.js";
import { renderHomeSummary } from "./home.js";
import { showPage, showExpensesSubpage } from "./nav.js";
import { receiptHolder } from "./receipts.js";
import { withUndo } from "./redraw.js";
import { txReview, txReviewHtml, reviewBannerHtml } from "./reviewqueue.js";
import { rerenderTableFor, closeActiveModernRow, wireModernRowToggle, openNewRowModal } from "./rows.js";
import { renderTaxYear } from "./taxyear.js";
import { tripsCardHtml, tripPlan, tripProtectedLineIds } from "./trips.js";

var txTable, cfSearchTimer, txGridWide, txGridTimer, firstRunRoot, txReviewRoot, receiptInput, receiptFor;

// ---------------- Cash flow → Spending: filters, money in, transfers, splits, bulk edit (v3.59.0) ----------------
// v3.206.0 (item 236b): the commit redraws what reads them (lib/views.js) — on screen now, the rest when opened.
function afterTransactionsChange(){ commit(["transactions", "transfers", "incomeLog"]); }
function saveTxView(){
  var el = document.querySelector("#transactionsTable [data-cf-view-name]");
  var name = el ? el.value.trim() : "";
  if(!name){ if(el) el.focus(); showToast("Give the view a name"); return; }
  var v = saveView(state.txViews, name, txFilters, function(){ return genId("view"); });
  txViewForm.open = false;
  commit(["txViews"]); renderTransactions();
  if(v) showToast('Saved "' + v.name + '" — it\'s a chip above the list');
}
function pickedIndices(){
  return Object.keys(txSelect.picked).filter(function(k){ return txSelect.picked[k]; }).map(Number).filter(function(i){ return state.transactions[i]; });
}
function onCashflowListClick(e){
  var b = e.target.closest("button");
  if(!b || b.disabled) return;
  if(b.hasAttribute("data-cf-dir")){ txFilters.direction = b.getAttribute("data-cf-dir"); setTransactionsShowAll(false); renderTransactions(); return; }
  if(b.hasAttribute("data-cf-clear")){ resetTxFilters(); renderTransactions(); return; }
  // v3.168.0: saved views — pick one, name the filters as one, or delete the one you're on.
  if(b.hasAttribute("data-cf-view")){
    var view = (state.txViews || []).find(function(v){ return v.id === b.getAttribute("data-cf-view"); });
    if(view){ Object.assign(txFilters, applyView(view)); txFilterPanel.open = false; setTransactionsShowAll(false); renderTransactions(); }
    return;
  }
  if(b.hasAttribute("data-cf-view-save")){ txViewForm.open = true; renderTransactions(); var nm = document.querySelector("#transactionsTable [data-cf-view-name]"); if(nm) nm.focus(); return; }
  if(b.hasAttribute("data-cf-view-cancel")){ txViewForm.open = false; renderTransactions(); return; }
  if(b.hasAttribute("data-cf-view-confirm")){ saveTxView(); return; }
  if(b.hasAttribute("data-cf-view-del")){
    var gone = deleteView(state.txViews, b.getAttribute("data-cf-view-del"));
    if(gone){
      commit(["txViews"]); renderTransactions();
      showUndoToast('Deleted the view "' + gone.name + '"', function(){ state.txViews.push(gone); commit(["txViews"]); renderTransactions(); });
    }
    return;
  }
  if(b.hasAttribute("data-cf-panel")){ txFilterPanel.open = !txFilterPanel.open; renderTransactions(); var first = txFilterPanel.open && document.querySelector('#transactionsTable #cfFilterRow select'); if(first) first.focus(); return; }
  if(b.hasAttribute("data-cf-chip-clear")){ txFilters[b.getAttribute("data-cf-chip-clear")] = ""; setTransactionsShowAll(false); renderTransactions(); var fb = document.querySelector('#transactionsTable [data-cf-panel]'); if(fb) fb.focus(); return; }
  if(b.hasAttribute("data-cf-select")){ txSelect.on = !txSelect.on; txSelect.picked = {}; renderTransactions(); return; }
  if(b.hasAttribute("data-cf-transfer")){ transferForm.open = true; renderTransactions(); var f = document.querySelector('#transactionsTable [data-tf="amount"]'); if(f) f.focus(); return; }
  if(b.hasAttribute("data-tf-cancel")){ transferForm.open = false; renderTransactions(); return; }
  if(b.hasAttribute("data-tf-save")){
    var get = function(k){ var el = document.querySelector('#transactionsTable [data-tf="' + k + '"]'); return el ? (el.type === "checkbox" ? el.checked : el.value) : ""; };
    var amt = Number(get("amount"));
    if(!(amt > 0)){ showToast("Enter the amount moved"); return; }
    if(!get("from") || get("from") === get("to")){ showToast("Pick two different accounts"); return; }
    transferForm.open = false;
    saveTransfer({ date: get("date") || localDateStr(), amount: amt, from: get("from"), to: get("to"), what: get("what") }, get("balances"), "Transfer saved");
    return;
  }
  if(b.hasAttribute("data-cf-del-transfer")){
    var goneTransfer = deleteTransfer(b.getAttribute("data-cf-del-transfer"));
    renderTransactions(); commit(["transfers"]);
    if(goneTransfer) showUndoToast("Transfer deleted (balances unchanged)", function(){ state.transfers.splice(goneTransfer.index, 0, goneTransfer.record); renderTransactions(); commit(["transfers"]); });
    return;
  }
  if(b.hasAttribute("data-cf-del-in")){
    var restore = deleteIncomeReceived(b.getAttribute("data-cf-del-in"));
    afterReceivedChange();
    if(restore) showUndoToast("Record deleted", function(){ restore(); afterReceivedChange(); });
    return;
  }
  if(b.hasAttribute("data-cf-pick-all")){ visibleSpendingIndices().forEach(function(i){ txSelect.picked[i] = true; }); renderTransactions(); return; }
  if(b.hasAttribute("data-cf-bulk-apply")){
    var idxs = pickedIndices();
    var lineSel = document.querySelector('#transactionsTable [data-cf-bulk="line"]').value;
    var acctSel = document.querySelector('#transactionsTable [data-cf-bulk="account"]').value;
    var changes = {};
    if(lineSel !== "__keep") changes.linkedExpenseId = lineSel;
    if(acctSel !== "__keep") changes.account = acctSel;
    if(!Object.keys(changes).length){ showToast("Choose a line or an account to set"); return; }
    var before = idxs.map(function(i){ return { i: i, t: Object.assign({}, state.transactions[i]) }; });
    var n = bulkEditTransactions(idxs, changes);
    txSelect.picked = {};
    afterTransactionsChange();
    showUndoToast("Updated " + n + " transaction" + (n === 1 ? "" : "s"), function(){ before.forEach(function(x){ state.transactions[x.i] = x.t; }); afterTransactionsChange(); });
    return;
  }
  if(b.hasAttribute("data-cf-bulk-delete")){
    var del = pickedIndices();
    if(!del.length) return;
    var removed = bulkDeleteTransactions(del);
    txSelect.picked = {};
    afterTransactionsChange();
    showUndoToast("Deleted " + removed.length + " transaction" + (removed.length === 1 ? "" : "s"), function(){ removed.forEach(function(x){ state.transactions.splice(x.index, 0, x.t); }); afterTransactionsChange(); });
    return;
  }
  if(b.hasAttribute("data-cf-split-add")){ splitEditing.parts.push({ linkedExpenseId: null, amount: "" }); renderTransactions(); return; }
  if(b.hasAttribute("data-cf-split-del")){ splitEditing.parts.splice(Number(b.getAttribute("data-cf-split-del")), 1); renderTransactions(); return; }
  if(b.hasAttribute("data-cf-split-cancel")){ splitEditing.idx = null; splitEditing.parts = []; renderTransactions(); return; }
  if(b.hasAttribute("data-cf-split-save")){
    var made = splitTransaction(splitEditing.idx, splitEditing.parts);
    splitEditing.idx = null; splitEditing.parts = [];
    if(made){ afterTransactionsChange(); showToast("Split into " + made.length + " transactions"); }
    return;
  }
}
// The collapsed row's title/subline (built once, at render time, from t.what and
// transactionSummaryText()) is also what's visible in an *open* row's sticky header — but
// editing tx-what/tx-link/tx-account only ever mutated state.transactions directly, with
// nothing re-deriving that header text afterward. The edit was always saved correctly; the
// header just silently went stale until something else (navigating away and back, etc.)
// happened to trigger a full renderTransactions(). tx-date doesn't need this: it already forces
// a full re-render itself (see below) since a date edit can also re-sort the row's position.
function patchTransactionRowHeader(row, t){
  var nameEl = row.querySelector(".m-row-name");
  if(nameEl) nameEl.textContent = transactionDisplayName(t, budgetLineItems());
  var subEl = row.querySelector(".m-row-sub");
  if(subEl) subEl.innerHTML = transactionSummaryText(t);
}
// A transfer saved, and with `moveBalances` both accounts' balances moved by it (where each has
// one) — the transfer form and Checks' "Save repayment" (v3.146.0). Undo puts both back (v3.144.0).
// What a transfer touches (v3.206.0, item 236b: its commit redraws what reads them): the transfers, and —
// when it moved both balances — "balances": the money in the accounts and the records that hold it (a Cash
// asset, a debt, a property's loan or offset). Not "accounts" — nothing about an account but its balance
// changed, and every Cash flow list reads accounts for their names.
function transferTouched(balancesMoved){ return balancesMoved ? ["transfers", "balances"] : ["transfers"]; }
function saveTransfer(t, moveBalances, message){
  var rec = addTransfer(t);
  var moved = [], before = [];
  if(moveBalances){
    [[rec.from, -1], [rec.to, 1]].forEach(function(pair){
      var acct = state.accounts.find(function(a){ return a.name === pair[0]; });
      if(!acct) return;
      var bal = accountBalance(acct);
      if(bal.balance == null) return;
      before.push([acct, bal.balance]);
      // Money into a card or loan lowers what's owed; out of one raises it.
      var delta = (bal.owed ? -pair[1] : pair[1]) * rec.amount;
      setAccountBalance(acct, bal.balance + delta, rec.date);
      moved.push(acct.name);
    });
  }
  commit(transferTouched(moved.length > 0));
  showUndoToast(message + (moved.length ? " — " + moved.join(" and ") + " updated" : ""), function(){
    deleteTransfer(rec.id);
    before.forEach(function(b){ setAccountBalance(b[0], b[1], rec.date); });
    commit(transferTouched(before.length > 0));
  });
  return rec;
}
// ---------------- Cash flow → Spending → Trips (v3.78.0) ----------------
function renderTrips(){
  var el = document.getElementById("tripsBody");
  if(el) el.innerHTML = tripsCardHtml();
}
function renderFirstRun(){ firstRunRoot.innerHTML = firstRun.open ? firstRunHtml() : ""; }
function renderTxReviewBanner(){ var b = document.getElementById("txReviewBanner"); if(b) b.innerHTML = reviewBannerHtml(); }
function renderTxReview(){
  txReviewRoot.innerHTML = txReview.open ? txReviewHtml() : "";
  var card = txReviewRoot.querySelector("[data-txr-card]");
  if(card) onHorizontalSwipe(card, { onSwipeRight: function(){ txrKeep(); }, onSwipeLeft: function(){ txrChange(); } });
  var f = txReviewRoot.querySelector("[data-txr-keep], [data-txr-save], [data-txr-rule='always'], [data-txr-close]");
  if(f) f.focus({ preventScroll: true });
}
function openTxReview(){
  txReview.open = true; txReview.mode = "card"; txReview.choice = null; txReview.kept = 0;
  renderTxReview(); app.pushActiveOverlay(closeTxReviewUi);
}
function closeTxReviewUi(){
  txReview.open = false; renderTxReview();
  renderTransactions(); renderActualVsPlannedPanel(); renderTxReviewBanner(); renderHomeSummary();
}
function txrCurrent(){ return toReview(state.transactions)[0]; }
function txrKeep(){ var t = txrCurrent(); if(!t || txReview.mode !== "card") return; keepTransaction(t); txReview.kept++; persist(); renderTxReview(); }
function txrChange(){ if(!txrCurrent() || txReview.mode !== "card") return; txReview.mode = "change"; renderTxReview(); }
function afterReceiptChange(){ persist(); renderTransactions(); rerenderTableFor("shared"); renderTaxYear(); }

export function wireSpending(){
  // ---------------- Transactions: real dated spend, separate from the planned budget ----------------
  // The Transactions time-range picker. Delegated off the card because renderTransactions()
  // rebuilds the control itself on every change.
  // v3.144.0: the transfer form's word about a card repayment's From, as the accounts are picked.
  document.getElementById("transactionsTable").addEventListener("change", function(e){
    var k = e.target.getAttribute && e.target.getAttribute("data-tf");
    if(k !== "from" && k !== "to") return;
    var q = function(x){ var el = document.querySelector('#transactionsTable [data-tf="' + x + '"]'); return el ? el.value : ""; };
    var hintEl = document.querySelector("#transactionsTable [data-tf-hint]");
    if(!hintEl) return;
    var text = transferHint(q("from"), q("to"), state.accounts, state.transfers);
    hintEl.textContent = text; hintEl.hidden = !text;
  });
  document.getElementById("transactionsTable").addEventListener("click", function(e){
    var rangeBtn = e.target.closest("[data-tx-range]");
    if(rangeBtn){ setTransactionsRange(rangeBtn.getAttribute("data-tx-range")); return; }
    onCashflowListClick(e);
  });  // "Show me in Spending" from anywhere: a button with data-sv and a data-sv-<filter> per filter to set
  // (data-sv-category, data-sv-line, data-sv-from …) opens Spending filtered to exactly that.
  document.addEventListener("click", function(e){
    var b = e.target.closest && e.target.closest("[data-sv]");
    if(!b) return;
    e.preventDefault();
    resetTxFilters();
    FILTER_FIELDS.forEach(function(k){ var v = b.getAttribute("data-sv-" + k); if(v != null) txFilters[k] = v; });
    txFilterPanel.open = false;
    setTransactionsShowAll(false);
    showPage("expenses");
    showExpensesSubpage("spending", { replace: true });
    renderTransactions();
    setTimeout(function(){ var t = document.getElementById("transactionsTable"); if(t) t.scrollIntoView({ behavior: "smooth", block: "start" }); }, 350);
  });  // Split / Merge live inside a transaction's edit area, which on a phone opens as a sheet — so these
  // are delegated from the document rather than the list.
  document.addEventListener("click", function(e){
    var sp = e.target.closest("[data-tx-split]");
    if(sp){
      var idx = Number(sp.getAttribute("data-tx-split")), t = state.transactions[idx];
      if(!t) return;
      var half = Math.round((Number(t.amount) || 0) / 2 * 100) / 100;
      splitEditing.idx = idx;
      splitEditing.parts = [{ linkedExpenseId: t.linkedExpenseId || null, amount: half }, { linkedExpenseId: null, amount: Math.round(((Number(t.amount) || 0) - half) * 100) / 100 }];
      closeActiveModernRow();
      renderTransactions();
      var ed = document.querySelector("#transactionsTable .cf-split");
      if(ed) ed.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    var un = e.target.closest("[data-tx-unsplit]");
    if(un){
      var merged = unsplit(un.getAttribute("data-tx-unsplit"));
      closeActiveModernRow();
      if(merged){ afterTransactionsChange(); showToast("Merged back into one transaction — link it to a line"); }
    }
  });
  txTable = document.getElementById("transactionsTable");  // v3.167.0 (item 197): on a phone, swipe a transaction left for Edit, Split and Delete (with the
  // usual undo); swipe it back, or tap anywhere else, to put them away. The tray's buttons carry the
  // same data-tx-* attributes as the editor's, so the document's handlers do the work.
  (function(){
    var phone = window.matchMedia("(max-width: 880px)"), sw = null, shown = null, TRAY = 216;
    function trayHtml(idx){
      var t = state.transactions[idx] || {};
      return '<div class="row-swipe-tray">' +
        '<button type="button" class="btn btn-sm" data-swipe-edit>Edit</button>' +
        (t.splitGroup ? '<button type="button" class="btn btn-sm" data-tx-unsplit="' + escapeAttr(t.splitGroup) + '">Merge</button>'
          : '<button type="button" class="btn btn-sm" data-tx-split="' + idx + '">Split</button>') +
        '<button type="button" class="btn btn-sm btn-danger" data-tx-del="' + idx + '">Delete</button></div>';
    }
    function putAway(){
      if(!shown) return;
      var row = shown; shown = null;
      row.classList.remove("swiped");
      setTimeout(function(){ if(!row.classList.contains("swiped")){ var t = row.querySelector(":scope > .row-swipe-tray"); if(t) t.remove(); } }, 200);
    }
    txTable.addEventListener("touchstart", function(e){
      sw = null;
      if(!phone.matches || e.touches.length !== 1 || e.target.closest(".row-swipe-tray")) return;
      var row = e.target.closest(".m-row.tx-row:not(.open)");
      if(!row) return;
      sw = { row: row, x0: e.touches[0].clientX, y0: e.touches[0].clientY, dx: 0, horiz: null, base: row === shown ? -TRAY : 0 };
    }, { passive: true });
    txTable.addEventListener("touchmove", function(e){
      if(!sw) return;
      var dx = e.touches[0].clientX - sw.x0, dy = e.touches[0].clientY - sw.y0;
      if(sw.horiz === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) sw.horiz = Math.abs(dx) > Math.abs(dy) * 1.5;
      if(!sw.horiz) return;
      if(sw.row !== shown) putAway();
      if(!sw.row.querySelector(":scope > .row-swipe-tray")) sw.row.insertAdjacentHTML("beforeend", trayHtml(Number(sw.row.getAttribute("data-index"))));
      sw.dx = dx;
      var s = sw.row.querySelector(":scope > .m-row-summary");
      s.style.transition = "none";
      s.style.transform = "translateX(" + Math.max(-TRAY, Math.min(0, sw.base + dx)) + "px)";
    }, { passive: true });
    txTable.addEventListener("touchend", function(){
      if(!sw || !sw.horiz){ sw = null; return; }
      var row = sw.row, at = sw.base + sw.dx, s = row.querySelector(":scope > .m-row-summary");
      sw = null;
      s.style.transition = s.style.transform = "";
      if(at < -TRAY / 3){ row.classList.add("swiped"); shown = row; }
      else { shown = row; putAway(); }
    });
    // A tap outside the open tray puts it away; Edit opens the row's editor.
    document.addEventListener("click", function(e){
      if(!shown) return;
      var edit = e.target.closest("[data-swipe-edit]");
      if(edit){ var row = shown; putAway(); var s = row.querySelector(":scope > .m-row-summary"); if(s) s.click(); return; }
      if(!e.target.closest(".row-swipe-tray")) putAway();
    }, true);
  })();
  txTable.addEventListener("keydown", function(e){
    if(e.key === "Enter" && e.target.hasAttribute && e.target.hasAttribute("data-cf-view-name")){ e.preventDefault(); saveTxView(); }
    if(e.key === "Escape" && e.target.hasAttribute && e.target.hasAttribute("data-cf-view-name")){ txViewForm.open = false; renderTransactions(); }
  });
  txTable.addEventListener("change", function(e){
    var t = e.target;
    if(t.hasAttribute("data-cf-filter") && t.getAttribute("data-cf-filter") !== "text"){ txFilters[t.getAttribute("data-cf-filter")] = t.value; setTransactionsShowAll(false); renderTransactions(); return; }
    if(t.hasAttribute("data-cf-pick")){ txSelect.picked[t.getAttribute("data-cf-pick")] = t.checked; renderTransactions(); return; }
    if(t.hasAttribute("data-cf-split-line")){ splitEditing.parts[Number(t.getAttribute("data-cf-split-line"))].linkedExpenseId = t.value || null; return; }
  });
  cfSearchTimer = null;
  txTable.addEventListener("input", function(e){
    var t = e.target;
    if(t.getAttribute("data-cf-filter") === "text"){
      txFilters.text = t.value;
      clearTimeout(cfSearchTimer);
      cfSearchTimer = setTimeout(function(){
        var pos = t.selectionStart;
        renderTransactions();
        var again = document.querySelector('#transactionsTable [data-cf-filter="text"]');
        if(again){ again.focus(); try{ again.setSelectionRange(pos, pos); }catch(err){} }
      }, 200);
      return;
    }
    if(t.hasAttribute("data-cf-split-amt")){
      splitEditing.parts[Number(t.getAttribute("data-cf-split-amt"))].amount = t.value;
      var tx = state.transactions[splitEditing.idx];
      var placed = splitEditing.parts.reduce(function(s2, p){ return s2 + (Number(p.amount) || 0); }, 0);
      var left = Math.round(((Number(tx && tx.amount) || 0) - placed) * 100) / 100;
      var leftEl = document.querySelector("#transactionsTable .cf-split-left"), saveEl = document.querySelector("#transactionsTable [data-cf-split-save]");
      if(leftEl){ leftEl.textContent = Math.abs(left) < 0.01 ? "All placed" : fmtCurrency2.format(Math.abs(left)) + (left > 0 ? " left to place" : " too much"); leftEl.classList.toggle("warn", Math.abs(left) >= 0.01); }
      if(saveEl) saveEl.disabled = Math.abs(left) >= 0.01;
    }
  });
  document.getElementById("addTransactionBtn").addEventListener("click", function(){
    addTransaction();
    var newTx = state.transactions[state.transactions.length - 1];
    openNewRowModal("transactionsTable", "tx", state.transactions.length - 1, modernTransactionRowOpen, newTx);
  });
  wireModernRowToggle("transactionsTable", modernTransactionRowOpen);
  document.addEventListener("click", function(e){
    var delTxBtn = e.target.closest("[data-tx-del]");
    if(delTxBtn){ deleteTransaction(Number(delTxBtn.getAttribute("data-tx-del"))); return; }
    var txShowAllBtn = e.target.closest("[data-tx-show-all-toggle]");
    if(txShowAllBtn){ setTransactionsShowAll(txShowAllBtn.getAttribute("data-tx-show-all-toggle") === "1"); return; }
    // Flip spend/refund on an existing transaction. Patched in place rather than re-rendered, for
    // the same reason every other field in this row is: a re-render would collapse the row the
    // user is still editing. The button's own label has to move with it, since it says what the
    // *next* press will do.
    var txSignBtn = e.target.closest("[data-tx-sign]");
    if(txSignBtn){
      var signIdx = Number(txSignBtn.getAttribute("data-tx-sign"));
      var signT = state.transactions[signIdx];
      if(!signT) return;
      signT.amount = -(Number(signT.amount) || 0);
      var signRow = txSignBtn.closest(".m-row");
      var signField = signRow && signRow.querySelector(".tx-amount");
      if(signField) signField.value = signT.amount;
      var negative = signT.amount < 0;
      txSignBtn.textContent = negative ? "+" : "\u2212";
      txSignBtn.setAttribute("aria-label", negative ? "Currently a refund — make it a spend" : "Make this a refund");
      var signAmountEl = signRow && signRow.querySelector(".m-row-amt");
      if(signAmountEl) signAmountEl.textContent = fmtCurrency2.format(signT.amount);
      var signTotalEl = document.getElementById("totalTransactionsAmount");
      if(signTotalEl) signTotalEl.textContent = fmtCurrency0.format(state.transactions.reduce(function(s, x){ return s + (Number(x.amount) || 0); }, 0));
      persist();
      renderActualVsPlannedPanel();
      return;
    }
  });  // Pasting an amount.
  //
  // An <input type="number"> silently reads back "" for anything that isn't a bare number literal
  // — "-$24.99", "−24.99" (the Unicode minus a bank app or phone keyboard copies), "1,299.00",
  // a stray trailing space \u2014 with no error and no badInput flag to test. The field looks right
  // and `parseFloat(value) || 0` stores zero. Sanitising the clipboard text before it lands is
  // the only place this is catchable, so that is what this does; anything already valid is left
  // to the browser, caret behaviour and all.
  document.addEventListener("paste", function(e){
    var el = e.target;
    if(!el || (el.id !== "quickLogAmount" && !(el.classList && el.classList.contains("tx-amount")))) return;
    var text = (e.clipboardData && e.clipboardData.getData("text")) || "";
    if(String(Number(text.trim())) === text.trim()) return;
    var n = parseAmountInput(text);
    if(n === null) return;
    e.preventDefault();
    el.value = String(n);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  // Actual vs. planned: click a budget row (that has at least one transaction logged against it
  // this month) to expand it in place and see exactly which transactions make up its "actual"
  // figure — no need to separately scroll the Transactions list below to find them.
  document.getElementById("actualVsPlannedPanel").addEventListener("click", function(e){
    if(e.target.closest("[data-tx-del]")) return; // let the delete handler above own this click
    var toggleRow = e.target.closest("[data-budget-row-toggle]");
    if(!toggleRow) return;
    var key = toggleRow.getAttribute("data-budget-row-toggle");
    budgetRowTxnsOpen[key] = !budgetRowTxnsOpen[key];
    renderActualVsPlannedPanel();
  });
  document.getElementById("actualVsPlannedPanel").addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    var toggleRow = e.target.closest("[data-budget-row-toggle]");
    if(!toggleRow) return;
    e.preventDefault();
    toggleRow.click();
  });
  document.addEventListener("input", function(e){
    if(!e.target.closest("#transactionsTable")) return;
    var idx = Number(e.target.getAttribute("data-tx-index"));
    var t = state.transactions[idx];
    if(!t) return;
    var txRow = e.target.closest(".m-row");
    if(e.target.classList.contains("tx-what")){
      t.what = e.target.value;
      if(txRow) patchTransactionRowHeader(txRow, t);
    }
    else if(e.target.classList.contains("tx-amount")){
      t.amount = parseFloat(e.target.value) || 0;
      var totalEl = document.getElementById("totalTransactionsAmount");
      if(totalEl) totalEl.textContent = fmtCurrency0.format(state.transactions.reduce(function(s, x){ return s + (Number(x.amount) || 0); }, 0));
      // The −/+ button says what the next press will do, so typing a minus by hand (or pasting
      // one) has to move it too, or the row offers to "make this a refund" when it already is.
      var signToggle = txRow && txRow.querySelector("[data-tx-sign]");
      if(signToggle){
        var isRefund = t.amount < 0;
        signToggle.textContent = isRefund ? "+" : "\u2212";
        signToggle.setAttribute("aria-label", isRefund ? "Currently a refund — make it a spend" : "Make this a refund");
      }
      // The collapsed row's own figure, which patchTransactionRowHeader doesn't cover (it owns the
      // name and sub-line). Without this the header keeps the pre-edit amount until something
      // else forces a full re-render — most visible when flipping a spend to a refund, where the
      // sign in the header would disagree with the field right above it.
      var amtEl = txRow && txRow.querySelector(".m-row-amt");
      if(amtEl) amtEl.textContent = fmtCurrency2.format(t.amount);
    }
    else if(e.target.classList.contains("tx-link")){
      var linkedId = e.target.value || null;
      t.linkedExpenseId = linkedId;
      // Picking a budget line to log against does most of the work for you, the same way an
      // existing expense row's own "Log a transaction" control already does — but only fills in
      // fields the user hasn't touched yet (still zero), never overwriting something they've
      // already typed. Description is deliberately *not* auto-filled: it's optional, and a blank
      // one already displays as the linked line's name (transactionDisplayName), so copying the
      // text in would only create a duplicate that goes stale when the line is renamed. The
      // placeholder is repointed instead, so the field still shows what it'll be listed as.
      if(linkedId){
        var linkedItem = budgetLineItems().find(function(i){ return i.id === linkedId; });
        if(linkedItem && txRow){
          var whatField = txRow.querySelector(".tx-what");
          if(whatField) whatField.placeholder = linkedItem.what || "Optional note";
          var amtField = txRow.querySelector(".tx-amount");
          if(amtField && (parseFloat(amtField.value) || 0) === 0){
            amtField.value = linkedItem.amount;
            t.amount = Number(linkedItem.amount) || 0;
            var totalEl2 = document.getElementById("totalTransactionsAmount");
            if(totalEl2) totalEl2.textContent = fmtCurrency0.format(state.transactions.reduce(function(s, x){ return s + (Number(x.amount) || 0); }, 0));
          }
        }
      } else if(txRow){
        var whatFieldOff = txRow.querySelector(".tx-what");
        if(whatFieldOff) whatFieldOff.placeholder = "Optional note";
      }
      if(txRow) patchTransactionRowHeader(txRow, t);
    }
    else if(e.target.classList.contains("tx-account")){
      t.account = e.target.value || "";
      if(txRow) patchTransactionRowHeader(txRow, t);
      renderActualVsPlannedPanel();
      persist();
      return;
    }
    else if(e.target.classList.contains("tx-date")){
      t.date = e.target.value;
      renderActualVsPlannedPanel();
      persist();
      // Deferred to the next tick: re-sorting the list (a date edit can move this row) means
      // rebuilding #transactionsTable's innerHTML — an ancestor of the input still mid-event
      // right now — which throws in Chromium, the same reentrant-DOM-mutation issue already
      // hit by the scenario-override panel's own date-adjacent edit.
      setTimeout(renderTransactions, 0);
      return;
    }
    else return;
    renderActualVsPlannedPanel();
    persist();
  });
  // ---------------- The transaction table (v3.117.0) ----------------
  document.addEventListener("click", function(e){
    var v = e.target.closest("[data-tx-view]");
    if(!v) return;
    setTxGrid(v.getAttribute("data-tx-view") === "table");
    renderTransactions();
  });  // Narrowed past a phone's width (or widened back), the table and the list swap.
  txGridWide = window.innerWidth > 720;
  txGridTimer = null;
  window.addEventListener("resize", function(){
    clearTimeout(txGridTimer);
    txGridTimer = setTimeout(function(){ var w = window.innerWidth > 720; if(w !== txGridWide){ txGridWide = w; renderTransactions(); } }, 200);
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Enter" || !e.target.closest || !e.target.closest(".tx-grid")) return;
    var newRow = e.target.closest(".txg-new");
    if(newRow){
      e.preventDefault();
      var val = function(c){ var el = newRow.querySelector(c); return el ? el.value : ""; };
      var link = val(".txg-new-link") || null;
      var line = link && budgetLineItems().find(function(i){ return i.id === link; });
      var amount = parseFloat(val(".txg-new-amount"));
      if(!(amount || 0) && line) amount = Number(line.amount) || 0;
      if(!(amount || 0) && !val(".txg-new-what").trim()){ showToast("Type an amount, or pick a line"); return; }
      state.transactions.push({ id: genId("t"), date: val(".txg-new-date") || localDateStr(), what: val(".txg-new-what").trim(), linkedExpenseId: link,
        account: val(".txg-new-account") || (line && line.account) || "", amount: amount || 0 });
      persist(); renderTransactions(); renderActualVsPlannedPanel();
      var again = document.querySelector("#transactionsTable .txg-new-what");
      if(again) again.focus();
      return;
    }
    // Enter in a cell moves down the column, the way a spreadsheet does.
    var cell = e.target.closest("td"), row = e.target.closest("tr");
    if(!cell || !row || !row.nextElementSibling) return;
    e.preventDefault();
    var next = row.nextElementSibling.children[cell.cellIndex];
    var input = next && next.querySelector("input, select");
    if(input) input.focus();
  });
}

export function wireTrips(){  document.getElementById("tripsBody").addEventListener("click", function(e){
    if(e.target.closest("[data-trip-add]")){
      var q = function(sel){ var x = document.querySelector(sel); return x ? x.value : ""; };
      var from = q("[data-trip-from]"), to = q("[data-trip-to]") || from, lineId = q("[data-trip-line]");
      if(!from){ showToast("Pick the first day of the trip"); return; }
      if(!lineId){ showToast("Pick the line its spending goes to"); return; }
      var trip = normaliseTrip({ name: q("[data-trip-name]"), from: from, to: to, lineId: lineId }, function(){ return genId("trip"); });
      state.trips.push(trip);
      persist(); renderTrips();
      var n = tripPlan(trip).length;
      showToast("Trip added" + (n ? " — " + n + " transaction" + (n === 1 ? "" : "s") + " in those dates can be moved to it" : ""));
      return;
    }
    var mv = e.target.closest("[data-trip-move]");
    if(mv){
      var t = state.trips.find(function(x){ return x.id === mv.getAttribute("data-trip-move"); });
      if(!t) return;
      var plan = tripPlan(t);
      if(!plan.length) return;
      if(!confirm("Move " + plan.length + " transaction" + (plan.length === 1 ? "" : "s") + " between " + t.from + " and " + t.to + " to this trip's line? Regular bills, rent and property costs stay where they are.")) return;
      var moved = applyTripRefile(t, state.transactions, budgetLineItems(), tripProtectedLineIds());
      persist(); afterTransactionsChange(); renderTrips();
      showToast(moved + " moved to " + t.name);
      return;
    }
    var del = e.target.closest("[data-trip-del]");
    if(del){
      var id = del.getAttribute("data-trip-del");
      var trip2 = state.trips.find(function(x){ return x.id === id; });
      if(!trip2) return;
      withUndo("Removed the trip \u201c" + trip2.name + "\u201d — transactions moved to its line stay there", function(){ state.trips = state.trips.filter(function(x){ return x.id !== id; }); renderTrips(); });
    }
  });
  renderTrips();
}

export function wireReviewQueue(){
  // ---------------- First-run setup (v3.74.0) ----------------
  // Offered once to an empty app; also from Home's setup card ("Guided setup"). Answers are held in
  // components/firstrun.js until Finish, so closing half-way writes nothing.
  firstRunRoot = document.getElementById("firstRunRoot");
  // ---------------- The review queue for new transactions (v3.163.0, item 193) ----------------
  txReviewRoot = document.getElementById("txReviewRoot");
  txReviewRoot.addEventListener("click", function(e){
    if(e.target.closest("[data-txr-close]") || e.target === e.target.closest("[data-txr-backdrop]")){ app.requestCloseActiveOverlay(); return; }
    if(e.target.closest("[data-txr-keep]")){ txrKeep(); return; }
    if(e.target.closest("[data-txr-change]")){ txrChange(); return; }
    if(e.target.closest("[data-txr-back]")){ txReview.mode = "card"; renderTxReview(); return; }
    if(e.target.closest("[data-txr-keepall]")){ var n = keepAll(state.transactions); txReview.kept += n; persist(); renderTxReview(); showToast("Kept " + n + " as filed"); return; }
    if(e.target.closest("[data-txr-save]")){
      var line = txReviewRoot.querySelector("[data-txr-line]").value, cat = txReviewRoot.querySelector("[data-txr-cat]").value;
      txReview.choice = { linkedExpenseId: line || null, category: line ? "" : cat };
      // Something to file it to, and a shop to learn: ask whether it's always so. Otherwise just file it.
      var t = txrCurrent();
      if((line || cat) && ruleOfferFor(t)){ txReview.mode = "rule"; renderTxReview(); return; }
      refileTransaction(t, txReview.choice); txReview.kept++; txReview.mode = "card"; persist(); renderTxReview(); return;
    }
    var rule = e.target.closest("[data-txr-rule]");
    if(rule){
      var cur = txrCurrent();
      refileTransaction(cur, txReview.choice); txReview.kept++;
      if(rule.getAttribute("data-txr-rule") === "always"){
        var also = applyRuleFromReview(state.importRules, state.transactions, cur, txReview.choice, function(){ return genId("rule"); });
        txReview.kept += also;
        showToast("Rule saved" + (also ? " · " + also + " more filed the same way" : ""));
      }
      txReview.mode = "card"; txReview.choice = null; persist(); renderTxReview();
    }
  });
  document.addEventListener("keydown", function(e){
    if(!txReview.open || txReview.mode !== "card" || /input|select|textarea/i.test((e.target && e.target.tagName) || "")) return;
    if(e.key === "ArrowRight" || e.key === "k"){ e.preventDefault(); txrKeep(); }
    else if(e.key === "ArrowLeft" || e.key === "c"){ e.preventDefault(); txrChange(); }
  });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape" && txReview.open) app.requestCloseActiveOverlay(); });
  document.addEventListener("click", function(e){ if(e.target.closest("[data-txr-open]")) openTxReview(); });
}

export function wireReceipts(){
  // ---------------- Receipts (v3.170.0, item 201) ----------------
  // Attach: a hidden file input, told whose receipt it's for. The file goes to IndexedDB (shrunk if
  // it's a photo) and the row gets its reference. Remove takes the reference (with undo); the file
  // goes at the next start once nothing refers to it.
  receiptInput = document.getElementById("receiptFile");
  receiptFor = null;
  document.addEventListener("click", function(e){
    if(!e.target.closest) return;
    var add = e.target.closest("[data-rc-add]");
    if(add){ receiptFor = add.getAttribute("data-rc-add"); receiptInput.value = ""; receiptInput.click(); return; }
    var op = e.target.closest("[data-rc-open]");
    if(op){ openReceipt(op.getAttribute("data-rc-open")).then(function(ok){ if(!ok) showToast("That receipt's file isn't on this device yet — it arrives with the next sync or backup"); }); return; }
    var del = e.target.closest("[data-rc-del]");
    if(del){
      var owner = del.getAttribute("data-rc-owner"), holder = receiptHolder(owner, false);
      var gone = holder && detachReceipt(holder, del.getAttribute("data-rc-del"));
      if(!gone) return;
      afterReceiptChange();
      showUndoToast('Removed "' + gone.name + '"', function(){ var h = receiptHolder(owner, true); if(h){ attachReceipt(h, gone); afterReceiptChange(); } });
    }
  });
  receiptInput.addEventListener("change", function(){
    var file = receiptInput.files && receiptInput.files[0], owner = receiptFor;
    receiptFor = null;
    if(!file || !owner) return;
    saveReceiptFile(file, localDateStr()).then(function(ref){
      var holder = receiptHolder(owner, true);
      if(!holder){ showToast("That row has gone — the receipt wasn't attached"); return; }
      // A transaction without an id gets one, so the receipt follows it through sync.
      if(/^txi:/.test(owner) && !holder.id) holder.id = genId("t");
      attachReceipt(holder, ref);
      afterReceiptChange();
      showToast("Receipt attached — " + ref.name);
    }, function(err){ showToast((err && err.reason) || "Couldn't keep that file on this device"); });
  });
  setTimeout(function(){ pruneReceipts(state).catch(function(){}); }, 4000);
}

export { firstRunRoot, openTxReview, renderFirstRun, renderTrips, renderTxReviewBanner, saveTransfer };
