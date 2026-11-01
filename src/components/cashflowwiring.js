// ---------------- Cash flow, wired (v3.206.1, item 237) ----------------
//
// Cash flow's sheets and panels: a scenario's override panel, bills to confirm, quick log, money received, the
// bills calendar, the balance forecast, subscriptions, the budget's grouping and automatic payments.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order.
import { renderNotifBadge } from "./notifpanel.js";
import { defineSection, defineRowAction } from "../lib/sections.js";
import { answerAutoPay, makeAutoPay } from "../calc/autopay.js";
import { transactionDisplayName } from "../calc/ledger.js";
import { logIncomeReceived, deleteIncomeReceived } from "../calc/received.js";
import { setTakeHomeAdjust } from "../calc/takehome.js";
import { takeHomeAdjust } from "../calc/tax.js";
import { fmtCurrency2, localDateStr, fmtDate, parseAmountInput } from "../lib/format.js";
import { showToast, showUndoToast } from "../lib/toast.js";
import { state, persist, commit, genId } from "../state.js";
import { renderAssets } from "./assets.js";
import { autoPayView } from "./autopay.js";
import { renderDetailPage } from "./detail.js";
import { closeScenarioOverridePanel, renderScenarioOverridePanel, setScenarioOverride, resetScenarioOverride, copyScenarioAmountToAll, openExpenseReview, closeExpenseReview, renderExpenseReviewPanel, confirmReviewBills, renderTransactions, renderActualVsPlannedPanel, loggableBudgetLineItems, renderBillsCalendar, openQuickLog, closeQuickLog, renderQuickLogSheet, setQuickLogLink, setQuickLogDateOpen, setQuickLogShowAllChips, setQuickLogChipFilter, setQuickLogSign, setQuickLogRefundOf, submitQuickLog, quickLogContextText, quickLog, renderAccounts, budgetLineItems } from "./expenses.js";
import { renderHomeSummary } from "./home.js";
import { renderTaxSuper } from "./income.js";
import { renderMonthReview } from "./monthreview.js";
import { renderReceived, toggleReceivedRow, receivedSheet, openReceivedSheet, closeReceivedSheet, setReceivedTarget, receivedSheetHtml } from "./received.js";
import { renderAll } from "./redraw.js";
import { addRow, refreshAfterLedgerChange, rerenderTableFor } from "./rows.js";
import { renderSubscriptions, subsUi } from "./subscriptions.js";
import { recalcComputedItems } from "../calc/engine.js";
import { appendHistorySnapshot } from "../calc/ledger.js";
import { fmtCurrency0 } from "../lib/format.js";
import { renderCards, renderDetail } from "./dashboard.js";
import { renderSharedGroups, modernSharedRowOpen, openScenarioOverridePanel } from "./expenses.js";
import { personBreakdownHtml, renderIncomeGroups, patchOpenRowBreakdowns, patchIncomeGroupTotals, patchSyntheticIncomeRows, patchIncomeAfterTax, patchIncomeSuperNotes, modernIncomeRowOpen } from "./income.js";
import { renderProjectionsWhenSeen } from "./projections.js";
import { renderTotals, updatePersonSuggestions } from "./redraw.js";
import { pushActiveOverlay, requestCloseActiveOverlay } from "../lib/overlaystack.js";

var reviewBtn, quickLogBtn;

// ---------------- Cash flow's lists, registered (v3.206.2, item 237b) ----------------
// Income and the Budget's lines, as the generic row code sees them (lib/sections.js).
defineSection("income", {
  rows: function(){ return state.income; },
  redraw: function(){ renderIncomeGroups(); },
  editor: { container: "incomeGroups", openState: modernIncomeRowOpen },
  noClassification: true,
  newRow: function(item, person){ item.id = genId("inc"); item.person = person != null ? person : ""; item.incomeType = "Net"; },
  freqRebuilds: true,
  taxes: true,
  // A single row's edit can shift the Maximum Super Contribution Base cap for every one of this person's
  // Gross rows (the cap is shared across all of them), so refresh every note, not just this row's.
  beforeRecalc: function(arg, e){
    if(e.target.classList.contains("f-amount") || e.target.classList.contains("f-freq") || e.target.classList.contains("f-superincluded")) patchIncomeSuperNotes();
  },
  afterEdit: function(arg, ctx){
    if(ctx.structural){ rerenderTableFor("income"); updatePersonSuggestions(); return; }
    patchSyntheticIncomeRows();
    // v3.152.0: each pay row's after-tax figure and the take-home line, from the recomputed tax.
    patchIncomeAfterTax();
    patchIncomeGroupTotals();
    patchOpenRowBreakdowns();
  }
});
defineSection("shared", {
  rows: function(){ return state.shared; },
  redraw: function(){ renderSharedGroups(); },
  inBudget: function(){ return true; },
  editor: { container: "sharedGroups", openState: modernSharedRowOpen }
});
// "sharedcat:<name>" is the same add as "shared:" but presets the category instead of the
// classification — what "+ Add expense" on a card means while the list is grouped by category.
defineSection("sharedcat", { add: function(category){ addRow("shared", null, category || ""); return true; } });
defineRowAction(".row-breakdown-toggle", function(breakdownBtn){
  var tr = breakdownBtn.closest("tr");
  var next = tr.nextElementSibling;
  if(next && next.classList.contains("row-breakdown-row")){
    next.remove();
    breakdownBtn.setAttribute("aria-expanded", "false");
    breakdownBtn.textContent = "▸ Breakdown";
  } else {
    var person = breakdownBtn.getAttribute("data-breakdown-person");
    var newRow = document.createElement("tr");
    newRow.className = "row-breakdown-row";
    newRow.setAttribute("data-breakdown-person", person);
    var td = document.createElement("td");
    td.colSpan = tr.children.length;
    td.innerHTML = personBreakdownHtml(person);
    newRow.appendChild(td);
    tr.parentNode.insertBefore(newRow, tr.nextSibling);
    breakdownBtn.setAttribute("aria-expanded", "true");
    breakdownBtn.textContent = "▾ Breakdown";
  }
});
defineRowAction("[data-vary-scenario]", function(varyBtn){
  openScenarioOverridePanel(varyBtn.getAttribute("data-vary-section") || "shared", Number(varyBtn.getAttribute("data-vary-scenario")));
});
// "Record a pay change" (Income). Distinct from [data-log] below, which snapshots whatever is
// already in the Amount field: this takes the new figure directly and *applies* it, which is
// what a pay rise actually is — the amount changes, as of a date.
defineRowAction("[data-pay-change]", function(payChangeBtn){
  var pIdx = Number(payChangeBtn.getAttribute("data-pay-change"));
  var pItem = state.income[pIdx];
  var pWrap = payChangeBtn.closest(".pay-change");
  var amountEl = pWrap && pWrap.querySelector(".pay-change-amount");
  var dateEl = pWrap && pWrap.querySelector(".pay-change-date");
  var newAmount = amountEl ? parseFloat(amountEl.value) : NaN;
  if(!pItem || isNaN(newAmount)){ showToast("Enter the new amount first."); return; }
  var effectiveFrom = (dateEl && dateEl.value) || undefined;
  var previousAmount = Number(pItem.amount) || 0;
  if(!Array.isArray(pItem.history)) pItem.history = [];
  // Seed the history with what it was *before* this change, so a first-ever recorded rise
  // still produces a comparison rather than a lone entry with nothing to be a change from.
  // Dated the day before, since the old amount applied right up until the new one started.
  if(!pItem.history.length && previousAmount && previousAmount !== newAmount){
    var dayBefore = new Date((effectiveFrom || localDateStr()) + "T00:00:00");
    dayBefore.setDate(dayBefore.getDate() - 1);
    pItem.history.push({ date: localDateStr(dayBefore), value: previousAmount });
  }
  pItem.amount = newAmount;
  var recordedOn = appendHistorySnapshot(pItem.history, newAmount, effectiveFrom);
  recalcComputedItems();
  rerenderTableFor("income");
  renderTaxSuper();
  renderCards(); renderDetail(); renderTotals();
  renderProjectionsWhenSeen();
  persist();
  var move = newAmount - previousAmount;
  showToast(move === 0
    ? pItem.what + " recorded at " + fmtCurrency0.format(newAmount) + " from " + fmtDate(recordedOn)
    : pItem.what + " " + (move > 0 ? "up" : "down") + " " + fmtCurrency0.format(Math.abs(move)) +
      " to " + fmtCurrency0.format(newAmount) + " from " + fmtDate(recordedOn));
});

// ---------------- Per-scenario override panel (shared expenses and income) ----------------
// The panel carries its own section now, because the same dialog serves state.shared and
// state.income. An income change has to go through refreshAfterLedgerChange("income"), which
// re-runs recalcComputedItems() — a Gross row's override changes that person's tax, and so the
// synthetic net row and every total derived from it.
function overrideBackdropTarget(e){
  var backdrop = e.target.closest("[data-override-backdrop]");
  if(!backdrop) return null;
  return { section: backdrop.getAttribute("data-override-section") || "shared", idx: Number(backdrop.getAttribute("data-override-idx")) };
}
// ---------------- Bills to confirm (v3.113.0) ----------------
function performReviewConfirm(){
  var values = [].map.call(document.querySelectorAll("#expenseReviewRoot [data-confirm-key]"), function(row){
    return { key: Number(row.getAttribute("data-confirm-key")), checked: row.querySelector(".bc-confirm-check").checked,
      amount: parseFloat(row.querySelector(".bc-confirm-amount").value), date: row.querySelector(".bc-confirm-date").value };
  });
  var n = confirmReviewBills(values);
  if(n) refreshAfterLedgerChange("shared");
  renderExpenseReviewPanel();
}
// ---------------- Quick log ----------------
// The everyday "I just spent money" path — the Expenses page's primary action and what the
// mobile quick-action fab points at there. Deliberately a thin controller: expenses.js owns the
// sheet's markup and session state, this owns the DOM events and the cross-cutting refresh.
function openQuickLogSheet(){
  openQuickLog();
  if(document.querySelector("[data-qlog-backdrop]")) pushActiveOverlay(closeQuickLog);
}
// Chip changes and expanding the date row re-render the sheet, which would otherwise discard
// whatever's already been typed into the amount/note. Read them out first, put them back after.
function rerenderQuickLogPreservingInput(apply){
  var amountEl = document.getElementById("quickLogAmount");
  var noteEl = document.getElementById("quickLogNote");
  var amount = amountEl ? amountEl.value : "";
  var note = noteEl ? noteEl.value : "";
  apply();
  var newAmount = document.getElementById("quickLogAmount");
  var newNote = document.getElementById("quickLogNote");
  if(newAmount) newAmount.value = amount;
  if(newNote) newNote.value = note;
}
function performQuickLog(){
  var amountEl = document.getElementById("quickLogAmount");
  var noteEl = document.getElementById("quickLogNote");
  var dateEl = document.getElementById("quickLogDate");
  var amount = amountEl ? (parseFloat(amountEl.value) || 0) : 0;
  // A zero/blank amount is the one thing this sheet genuinely can't infer, so it's the only
  // thing it refuses — everything else has a sensible default (today, One-off, no note).
  //
  // This used to reject `amount <= 0`, which quietly made refunds impossible to log: a refund
  // *is* a negative transaction here (see the Amount field's own note in transactionRowHtml),
  // and every path that could produce one — typing a minus, pasting one in — died on this line
  // with "Enter an amount first", which is not what was wrong. Magnitude is what has to be
  // non-zero; the sign comes from the Spend/Refund toggle.
  if(!amount){
    showToast("Enter an amount first.");
    if(amountEl) amountEl.focus();
    return;
  }
  var catEl = document.getElementById("quickLogCategory");
  var t = submitQuickLog(amount, noteEl ? noteEl.value : "", dateEl && dateEl.value ? dateEl.value : undefined, catEl ? catEl.value : "");
  if(!t) return;
  requestCloseActiveOverlay();
  refreshAfterLedgerChange("shared");
  renderTransactions();
  // The whole point of logging is watching this move — refreshAfterLedgerChange only covers the
  // planned-budget side, so the actual-vs-planned bars need their own refresh to include the
  // transaction that was just recorded.
  renderActualVsPlannedPanel();
  showToast(t.amount < 0
    ? "Logged a " + fmtCurrency2.format(Math.abs(t.amount)) + " refund against " + transactionDisplayName(t, budgetLineItems())
    : "Logged " + fmtCurrency2.format(t.amount) + " to " + transactionDisplayName(t, budgetLineItems()));
}
// ---------------- Income → Received (v3.46.0) ----------------
function renderReceivedSheet(){
  var root = document.getElementById("receivedRoot");
  if(root) root.innerHTML = receivedSheetHtml();
  var amt = document.getElementById("rcvAmount");
  if(amt) amt.focus();
}
function closeReceivedSheetDom(){
  closeReceivedSheet();
  var root = document.getElementById("receivedRoot");
  if(root) root.innerHTML = "";
}
function openReceivedSheetFor(target, date){
  openReceivedSheet(target, date);
  renderReceivedSheet();
  pushActiveOverlay(closeReceivedSheetDom);
}
// A logged distribution is a holding's payout too, which moves its return and the year's tax.
function afterReceivedChange(){
  renderReceived();
  renderTransactions();
  renderHomeSummary();
  renderMonthReview();
  renderAssets();
  renderTaxSuper();
  persist();
}
function submitReceived(){
  if(!receivedSheet) return;
  var amountEl = document.getElementById("rcvAmount");
  var amount = parseAmountInput(amountEl.value || amountEl.placeholder);
  if(!(amount > 0)){ amountEl.focus(); showToast("Type the amount that arrived"); return; }
  var rec = logIncomeReceived({ target: receivedSheet.target, amount: amount, date: document.getElementById("rcvDate").value, what: document.getElementById("rcvNote").value });
  if(!rec){ showToast("Pick what it was"); return; }
  requestCloseActiveOverlay();
  afterReceivedChange();
  showUndoToast("Logged " + fmtCurrency2.format(amount) + " received", function(){ deleteIncomeReceived(rec.id); afterReceivedChange(); });
}
// ---------------- Every subscription in one list (v3.179.0, item 205) ----------------
function subNote(key){ if(!state.subscriptionNotes) state.subscriptionNotes = {}; return (state.subscriptionNotes[key] = state.subscriptionNotes[key] || {}); }
function tidySubNote(key){ var n = state.subscriptionNotes[key]; if(n && !n.cancelBy && !n.ignored) delete state.subscriptionNotes[key]; }
// ---------------- Automatic payments (v3.196.0, item 231) ----------------
// Set up on an account's card; answered on Home. calc/autopay.js does the recording.
function afterAutoPay(){ commit(["autoPayments", "transfers"]); }
function answerAndUndo(id, date, answer, said){
  var r = answerAutoPay(state, id, date, answer, genId);
  if(!r) return;
  autoPayView.other = "";
  afterAutoPay();
  showUndoToast(said, function(){ answerAutoPay(state, id, date, { undo: true }); afterAutoPay(); });
}

export function wireOverrides(){  document.getElementById("scenarioOverrideRoot").addEventListener("click", function(e){
    if(e.target.closest("[data-override-close]") || e.target === e.target.closest("[data-override-backdrop]")){
      closeScenarioOverridePanel();
      return;
    }
    var target = overrideBackdropTarget(e);
    if(!target) return;
    var resetBtn = e.target.closest("[data-override-reset]");
    if(resetBtn){
      resetScenarioOverride(target.section, target.idx, resetBtn.getAttribute("data-override-reset"));
      refreshAfterLedgerChange(target.section);
      renderScenarioOverridePanel();
      return;
    }
    var useBtn = e.target.closest("[data-override-use-everywhere]");
    if(useBtn){
      copyScenarioAmountToAll(target.section, target.idx, useBtn.getAttribute("data-override-use-everywhere"));
      refreshAfterLedgerChange(target.section);
      renderScenarioOverridePanel();
      return;
    }
  });
  document.getElementById("scenarioOverrideRoot").addEventListener("change", function(e){
    var input = e.target.closest(".scen-override-input");
    if(!input) return;
    var target = overrideBackdropTarget(e);
    if(!target) return;
    var scenarioName = input.getAttribute("data-override-scenario");
    setScenarioOverride(target.section, target.idx, scenarioName, parseFloat(input.value) || 0);
    refreshAfterLedgerChange(target.section);
    // Deferred to the next tick: this handler runs synchronously inside the input's own
    // 'change' dispatch, and rebuilding #scenarioOverrideRoot's innerHTML (an ancestor of the
    // input that's still mid-event) right now throws "the node to be removed is no longer a
    // child of this node" in Chromium — the same class of reentrant-DOM-mutation issue as the
    // checkbox preventDefault gotcha elsewhere in this codebase, just triggered by innerHTML
    // replacement instead of a checked-state revert.
    setTimeout(renderScenarioOverridePanel, 0);
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    if(document.querySelector("[data-override-backdrop]")) closeScenarioOverridePanel();
  });
}

export function wireCashflowSheets(){  reviewBtn = document.getElementById("reviewExpensesBtn");
  if(reviewBtn) reviewBtn.addEventListener("click", function(){
    openExpenseReview();
    // openExpenseReview() can no-op (nothing due for review, or no expenses at all — see its own
    // early-return toasts), so check the panel actually rendered before claiming a history entry.
    if(document.querySelector("[data-review-backdrop]")) pushActiveOverlay(closeExpenseReview);
  });
  document.getElementById("expenseReviewRoot").addEventListener("click", function(e){
    if(e.target.closest("[data-review-close]") || e.target === e.target.closest("[data-review-backdrop]")){
      requestCloseActiveOverlay();
      return;
    }
    if(e.target.closest("[data-review-confirm]")){ performReviewConfirm(); return; }
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    if(document.querySelector("[data-review-backdrop]")) requestCloseActiveOverlay();
  });  // The Confirm button counts the ticked bills as they're ticked.
  document.getElementById("expenseReviewRoot").addEventListener("change", function(e){
    if(!e.target.classList.contains("bc-confirm-check")) return;
    var btn = document.querySelector("[data-review-confirm]");
    if(btn) btn.textContent = "Confirm " + document.querySelectorAll("#expenseReviewRoot .bc-confirm-check:checked").length;
  });
  quickLogBtn = document.getElementById("quickLogBtn");
  if(quickLogBtn) quickLogBtn.addEventListener("click", openQuickLogSheet);
  document.getElementById("quickLogRoot").addEventListener("click", function(e){
    if(e.target.closest("[data-qlog-close]") || e.target === e.target.closest("[data-qlog-backdrop]")){
      requestCloseActiveOverlay();
      return;
    }
    var chip = e.target.closest("[data-qlog-chip]");
    if(chip){
      // Patched in place rather than re-rendered: the whole point of picking the line after
      // typing the amount is that changing your mind costs nothing, and a re-render here would
      // drop the caret out of a field the user may still be editing.
      var wasOneOff = !quickLog.linkedId;
      setQuickLogLink(chip.getAttribute("data-qlog-chip"));
      var isOneOff = !quickLog.linkedId;
      // Crossing between linked and one-off adds or removes the Category field (a linked
      // transaction inherits its line's), which needs a re-render; staying on the same side of
      // that line only needs the selection and context patched, so the caret stays put.
      if(wasOneOff !== isOneOff){
        rerenderQuickLogPreservingInput(function(){ renderQuickLogSheet(); });
        return;
      }
      document.querySelectorAll("[data-qlog-chip]").forEach(function(el){
        var on = el.getAttribute("data-qlog-chip") === (quickLog.linkedId || "");
        el.classList.toggle("is-selected", on);
        el.setAttribute("aria-pressed", on ? "true" : "false");
      });
      var linked = quickLog.linkedId && budgetLineItems().find(function(i){ return i.id === quickLog.linkedId; });
      var ctx = document.querySelector(".qlog-context");
      if(ctx) ctx.textContent = quickLogContextText(linked);
      var noteEl = document.getElementById("quickLogNote");
      if(noteEl) noteEl.placeholder = linked ? "Note (optional)" : "What was it? (optional)";
      return;
    }
    var merchantChip = e.target.closest("[data-qlog-merchant]");
    if(merchantChip){
      // Fills the note rather than submitting: the chip answers "where", the amount is still to
      // type, and a chip that logged a transaction on one tap would be a very easy way to record
      // a $0 spend by accident. Focus goes back to the amount, which is always the next thing.
      var noteInput = document.getElementById("quickLogNote");
      if(noteInput){
        noteInput.value = merchantChip.getAttribute("data-qlog-merchant") || "";
        noteInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      var amountInput = document.getElementById("quickLogAmount");
      if(amountInput) amountInput.focus();
      return;
    }
    var refundChip = e.target.closest("[data-qlog-refund-of]");
    if(refundChip){
      var refundId = refundChip.getAttribute("data-qlog-refund-of");
      var refundTarget = state.transactions.find(function(x){ return x.id === refundId; });
      var wasSelected = quickLog.refundOf === refundId;
      rerenderQuickLogPreservingInput(function(){ setQuickLogRefundOf(refundId); renderQuickLogSheet(); });
      // Prefill the amount with what was actually paid — the whole point of picking a purchase —
      // unless the tap just deselected it, where leaving whatever is already typed alone is more
      // useful than clearing it back to blank.
      if(!wasSelected && refundTarget){
        var refundAmountInput = document.getElementById("quickLogAmount");
        if(refundAmountInput){
          refundAmountInput.value = Math.abs(Number(refundTarget.amount) || 0);
          refundAmountInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      return;
    }
    var signBtn = e.target.closest("[data-qlog-sign]");
    if(signBtn){
      rerenderQuickLogPreservingInput(function(){ setQuickLogSign(Number(signBtn.getAttribute("data-qlog-sign"))); });
      return;
    }
    if(e.target.closest("[data-qlog-more]")){
      rerenderQuickLogPreservingInput(function(){ setQuickLogShowAllChips(true); });
      return;
    }
    if(e.target.closest("[data-qlog-date-open]")){
      rerenderQuickLogPreservingInput(function(){ setQuickLogDateOpen(true); });
      return;
    }
    if(e.target.closest("[data-qlog-submit]")){ performQuickLog(); return; }
  });  // Typing in the sheet's search box narrows the chips. Patched, not re-rendered (see
  // setQuickLogChipFilter) — a re-render per keystroke would drop the caret out of the field
  // being typed into, the same reason picking a chip patches in place.
  document.getElementById("quickLogRoot").addEventListener("input", function(e){
    if(e.target.id === "quickLogSearch"){ setQuickLogChipFilter(e.target.value); return; }
    // A desktop keyboard has a minus key, so a negative amount typed straight into the field is
    // the natural thing to do there — and it must mean the same as tapping Refund, not quietly
    // disagree with a toggle still reading "Spend". The magnitude stays in the field and the
    // toggle carries the sign, which is the one rule this sheet has about the two of them.
    if(e.target.id !== "quickLogAmount") return;
    var typed = parseFloat(e.target.value);
    if(!(typed < 0)) return;
    e.target.value = String(Math.abs(typed));
    rerenderQuickLogPreservingInput(function(){ setQuickLogSign(-1); });
  });  // Enter anywhere in the sheet logs it — on a phone that's the keyboard's own "go" key, so the
  // whole flow can be amount, chip, go without ever reaching for the button. The one exception is
  // the search box, where Enter means "the thing I just searched for": it picks the top match, so
  // a keyboard user can type three letters, press Enter and be on the right line without leaving
  // the field to hunt for the chip.
  document.getElementById("quickLogRoot").addEventListener("keydown", function(e){
    if(e.key !== "Enter") return;
    e.preventDefault();
    if(e.target.id === "quickLogSearch"){
      var topMatch = document.querySelector(".qlog-chips [data-qlog-chip]");
      if(topMatch) topMatch.click();
      return;
    }
    performQuickLog();
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    if(document.querySelector("[data-qlog-backdrop]")) requestCloseActiveOverlay();
  });
  document.getElementById("logReceivedBtn").addEventListener("click", function(){ openReceivedSheetFor(); });
  document.getElementById("receivedBody").addEventListener("click", function(e){
    var del = e.target.closest("[data-rcv-del]");
    if(del){
      var restore = deleteIncomeReceived(del.getAttribute("data-rcv-del"));
      afterReceivedChange();
      if(restore) showUndoToast("Record deleted", function(){ restore(); afterReceivedChange(); });
      return;
    }
    var th = e.target.closest("[data-th-apply]");
    if(th){
      var who = th.getAttribute("data-th-apply"), before = takeHomeAdjust(who);
      setTakeHomeAdjust(who, Number(th.getAttribute("data-th-value")) || 0);
      renderAll(); persist();
      showUndoToast(Number(th.getAttribute("data-th-value")) ? who + "'s take-home planned at what lands" : who + "'s take-home back to the tax estimate", function(){ setTakeHomeAdjust(who, before); renderAll(); persist(); });
      return;
    }
    var log = e.target.closest("[data-rcv-log]");
    if(log){ openReceivedSheetFor(log.getAttribute("data-rcv-log")); return; }
    var tog = e.target.closest("[data-rcv-toggle]");
    if(tog){ toggleReceivedRow(tog.getAttribute("data-rcv-toggle")); renderReceived(); }
  });
  document.getElementById("receivedRoot").addEventListener("click", function(e){
    if(e.target.closest("[data-rcv-close]") || e.target === e.target.closest("[data-rcv-backdrop]")){ requestCloseActiveOverlay(); return; }
    var chip = e.target.closest("[data-rcv-chip]");
    if(chip){
      var amountEl = document.getElementById("rcvAmount"), noteEl = document.getElementById("rcvNote"), dateEl = document.getElementById("rcvDate");
      var keep = [amountEl ? amountEl.value : "", noteEl ? noteEl.value : "", dateEl ? dateEl.value : ""];
      setReceivedTarget(chip.getAttribute("data-rcv-chip"));
      renderReceivedSheet();
      document.getElementById("rcvAmount").value = keep[0];
      document.getElementById("rcvNote").value = keep[1];
      if(keep[2]) document.getElementById("rcvDate").value = keep[2];
      return;
    }
    if(e.target.closest("[data-rcv-submit]")) submitReceived();
  });
  document.getElementById("receivedRoot").addEventListener("keydown", function(e){
    if(e.key === "Enter" && (e.target.id === "rcvAmount" || e.target.id === "rcvNote")){ e.preventDefault(); submitReceived(); }
  });
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape" && document.querySelector("[data-rcv-backdrop]")) requestCloseActiveOverlay();
  });
}

export function wireBillsCalendar(){
  // v3.83.0: Bills calendar — a line is a bill or a spending budget (auto, or set here).
  document.addEventListener("change", function(e){
    if(!e.target.matches || !e.target.matches("[data-bc-kind]")) return;
    var id = e.target.getAttribute("data-bc-kind");
    var line = loggableBudgetLineItems().find(function(i){ return i.id === id; });
    if(!line) return;
    if(e.target.value === "bill" || e.target.value === "spending") line.billKind = e.target.value;
    else delete line.billKind;
    persist();
    renderBillsCalendar();
    var kinds = document.querySelector("#billsCalendar .bc-kinds");
    if(kinds) kinds.open = true;
  });  // v3.84.0: a bill that stopped being paid — end it at its last payment.
  document.addEventListener("click", function(e){
    var btn = e.target.closest && e.target.closest("[data-bc-end]");
    if(!btn) return;
    var id = btn.getAttribute("data-bc-end");
    var line = loggableBudgetLineItems().find(function(i){ return i.id === id; });
    if(!line) return;
    line.endDate = btn.getAttribute("data-bc-end-date");
    persist();
    renderBillsCalendar();
    showToast((line.what || "Line") + " ended " + line.endDate);
  });
}

export function wireForecast(){
  // ---------------- Balance forecast by the day (v3.180.0, item 206) ----------------
  document.addEventListener("change", function(e){
    var id = e.target.getAttribute && e.target.getAttribute("data-acct-buffer");
    if(id == null) return;
    var a = (state.accounts || []).find(function(x){ return x.id === id; });
    if(!a) return;
    var v = e.target.value.trim();
    if(v === "" || isNaN(Number(v))) delete a.buffer; else a.buffer = Math.max(0, Number(v));
    persist(); renderDetailPage(); renderHomeSummary();
  });
  document.addEventListener("change", function(e){
    var k = e.target.getAttribute && e.target.getAttribute("data-sub-cancel");
    if(k == null) return;
    if(e.target.value) subNote(k).cancelBy = e.target.value; else { subNote(k); delete state.subscriptionNotes[k].cancelBy; tidySubNote(k); }
    persist(); renderNotifBadge();
    showToast(e.target.value ? "A reminder comes a week before " + fmtDate(e.target.value) : "Cancel-by date cleared");
  });
  document.addEventListener("click", function(e){
    if(!e.target.closest) return;
    var ig = e.target.closest("[data-sub-ignore]");
    if(ig){
      var k = ig.getAttribute("data-sub-ignore"), n = subNote(k);
      if(n.ignored) delete n.ignored; else n.ignored = true;
      tidySubNote(k); persist(); renderSubscriptions(); renderNotifBadge();
      return;
    }
    if(e.target.closest("[data-sub-hidden]")){ subsUi.showHidden = !subsUi.showHidden; renderSubscriptions(); }
  });
}

export function wireAutoPay(){  document.addEventListener("click", function(e){
    var add = e.target.closest("[data-ap-add]");
    if(add){
      var name = add.getAttribute("data-ap-add");
      var acct = (state.accounts || []).find(function(x){ return x.name === name; }) || {};
      var owed = acct.type === "loan" || acct.type === "credit";
      if(!Array.isArray(state.autoPayments)) state.autoPayments = [];
      state.autoPayments.push(makeAutoPay({ from: owed ? "" : name, to: owed ? name : "", freq: "Monthly" }, localDateStr(), genId("ap")));
      commit(["autoPayments"]); renderAccounts();
      return;
    }
    var del = e.target.closest("[data-ap-del]");
    if(del){
      var di = (state.autoPayments || []).findIndex(function(x){ return x.id === del.getAttribute("data-ap-del"); });
      if(di === -1) return;
      var gone = state.autoPayments.splice(di, 1)[0];
      afterAutoPay();
      showUndoToast("Deleted the automatic payment — transfers it recorded stay", function(){ state.autoPayments.splice(di, 0, gone); afterAutoPay(); });
      return;
    }
    var b = e.target.closest("[data-ap-yes],[data-ap-skip],[data-ap-other],[data-ap-other-save],[data-ap-other-cancel]");
    if(!b) return;
    var id = b.getAttribute("data-ap-id"), date = b.getAttribute("data-ap-date");
    if(b.hasAttribute("data-ap-other-cancel")){ autoPayView.other = ""; renderHomeSummary(); return; }
    if(b.hasAttribute("data-ap-other")){
      autoPayView.other = id + "|" + date; renderHomeSummary();
      var inp = document.querySelector("#homeSummary .ap-other-amount"); if(inp){ inp.focus(); inp.select(); }
      return;
    }
    if(b.hasAttribute("data-ap-skip")){ answerAndUndo(id, date, { skipped: true }, "Marked as not gone through — nothing recorded"); return; }
    if(b.hasAttribute("data-ap-yes")){ answerAndUndo(id, date, { paid: true }, "Recorded as a transfer"); return; }
    var row = b.closest(".ap-due-row");
    var amt = Number((row.querySelector(".ap-other-amount") || {}).value);
    if(!(amt > 0)){ showToast("Type the amount that went out"); return; }
    var keep = !!(row.querySelector(".ap-other-keep") || {}).checked;
    answerAndUndo(id, date, { paid: true, amount: amt, keep: keep }, "Recorded " + fmtCurrency2.format(amt) + (keep ? " — and the amount from now on" : ""));
  });
  document.addEventListener("keydown", function(e){
    if(e.key === "Enter" && e.target.classList && e.target.classList.contains("ap-other-amount")){
      var save = e.target.closest(".ap-due-row").querySelector("[data-ap-other-save]"); if(save) save.click();
    }
  });
  document.addEventListener("change", function(e){
    var field = e.target.getAttribute && e.target.getAttribute("data-ap-field");
    if(!field) return;
    var ap = (state.autoPayments || []).find(function(x){ return x.id === e.target.getAttribute("data-ap-id"); });
    if(!ap) return;
    var v = e.target.value;
    if(field === "amount") ap.amount = Math.round((Number(v) || 0) * 100) / 100;
    else if(field === "line"){ if(v) ap.line = v; else delete ap.line; }
    else if(field === "what") ap.what = v.trim();
    else ap[field] = v;
    commit(["autoPayments"]);
    renderHomeSummary(); renderNotifBadge();
    // Rebuilt after the event: the note under it ("Next on …") follows the day and how often.
    if(field === "start" || field === "freq" || field === "line") setTimeout(renderAccounts, 0);
  });
}

export { afterReceivedChange, openQuickLogSheet, openReceivedSheetFor };
