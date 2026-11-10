// ---------------- The RBA cash rate, in the app (item 249) ----------------
//
// Reads rates/cash-rate.json from this site once a day (the job that writes it: scripts/cashrate/fetch.mjs), keeps it
// in state.cashRate, moves any scenario rate that follows it, and — when it has moved and the move isn't answered —
// offers a dialog to record the move on the household's loans, or let it be (a To do opens it).
import { state, commit, freshForBackground } from "../state.js";
import { cashRateMove, loansForMove, takeCashRateFile } from "../calc/cashrate.js";
import { siteJson } from "./autoprices.js";
import { localDateStr, fmtDate } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { pushActiveOverlay } from "../lib/overlaystack.js";

export function cashRateDue(){ return !(state.cashRate && state.cashRate.readOn === localDateStr()); }
// Resolves with true when anything changed. Never rejects: no file (not published yet, offline) changes nothing.
export function readCashRateNow(){
  var today = localDateStr();
  return siteJson("rates/cash-rate.json").then(function(file){
    // #269: from the saved copy, not one another tab has since replaced; not at all while this tab is mid-edit.
    if(!freshForBackground()) return false;
    var r = takeCashRateFile(state, file, today);
    if(r.moved) commit(["cashRate", "purchase", "scenarioChanges"], { background: true });
    else if(r.changed) commit(["cashRate"], { background: true });
    return r.news;
  }, function(){ return false; });
}

function pct(n){ return String(Number((Number(n) || 0).toFixed(2))) + "%"; }
export function cashRateLine(c){
  if(!c || !(c.rate >= 0)) return "";
  return "RBA cash rate " + pct(c.rate) + (c.change ? " — " + (c.change > 0 ? "up " : "down ") + pct(Math.abs(c.change)) + " from " + fmtDate(c.effective) : "");
}
// #305 (step 4): an unanswered move is a To do — in the bell and on Property's one line — and its form opens in a
// dialog. It used to be a 319px banner with the form in it, above Property's first tile. The page keeps the one
// quiet line saying what the rate is.
export function cashRatePanelHtml(st){
  var c = st.cashRate;
  // While a move is unanswered the page's line of notices says it; the same words twice would be a stack again.
  return c && !cashRateMove(st) ? '<p class="cr-line">' + escapeAttr(cashRateLine(c)) + '</p>' : "";
}
// The form: which loans the move applies to, and from when. "" when there is no move to answer.
export function cashRateFormHtml(st, today){
  var move = st.cashRate && cashRateMove(st);
  if(!move) return "";
  var date = move.effective > today ? move.effective : today;
  var loans = loansForMove(st, move.change, date);
  var up = move.change > 0;
  return '<div class="cr-panel" data-cr-panel>' +
    '<p class="cr-head"><b>The RBA ' + (up ? "raised" : "cut") + ' the cash rate ' + pct(Math.abs(move.change)) + ' to ' + pct(move.rate) + '</b> <span>from ' + escapeAttr(fmtDate(move.effective)) + '</span></p>' +
    (loans.length
      ? '<p class="cr-note">Variable loans usually follow within a few weeks — your lender says when. Tick the ones that change (not a fixed rate) and the date it starts, and each gets the change in its rate history.</p>' +
        '<div class="cr-loans">' + loans.map(function(l){
          var key = l.propertyId + ":" + l.loanIndex;
          return '<label class="cr-loan"><input type="checkbox" data-cr-loan="' + escapeAttr(key) + '" checked> <span>' + escapeAttr(l.what) + '</span> <b>' + pct(l.from) + ' → ' + pct(l.to) + '</b></label>';
        }).join("") + '</div>' +
        '<div class="cr-actions"><label class="cr-date">From <input type="date" data-cr-date value="' + escapeAttr(date) + '"></label>' +
        '<button type="button" class="btn btn-sm btn-primary" data-cr-record>Record on the loans ticked</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-cr-dismiss>Not now</button></div>'
      : '<p class="cr-note">There are no loans to record it on.</p><div class="cr-actions"><button type="button" class="btn btn-sm btn-primary" data-cr-dismiss>OK</button></div>') +
  '</div>';
}
export function renderCashRatePanel(){
  var el = typeof document !== "undefined" && document.getElementById("cashRatePanel");
  if(!el) return;
  var html = cashRatePanelHtml(state);
  el.hidden = !html;
  el.innerHTML = html;
}
// The dialog, in the sheet every other overlay here uses (bottom-anchored on a phone, Escape and Back close it).
var opener = null;
export function openCashRateDialog(){
  var root = document.getElementById("cashRateRoot"), form = cashRateFormHtml(state, localDateStr());
  if(!root || !form) return false;
  opener = document.activeElement;
  root.innerHTML = '<div class="review-backdrop" data-cr-backdrop>' +
    '<div class="review-panel cr-dialog" role="dialog" aria-modal="true" aria-label="Record the cash rate change">' +
      '<div class="review-head"><h4>Cash rate change</h4><button type="button" class="icon-btn" data-cr-close aria-label="Close">✕</button></div>' + form +
    '</div></div>';
  pushActiveOverlay(closeCashRateDialog);
  var first = root.querySelector("[data-cr-loan], [data-cr-dismiss]");
  if(first) first.focus();
  return true;
}
function closeCashRateDialog(){
  var root = document.getElementById("cashRateRoot");
  if(root) root.innerHTML = "";
  if(opener && opener.isConnected && typeof opener.focus === "function") opener.focus();
  opener = null;
}
