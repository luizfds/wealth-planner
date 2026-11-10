// ---------------- The RBA cash rate, in the app (item 249) ----------------
//
// Reads rates/cash-rate.json from this site once a day (the job that writes it: scripts/cashrate/fetch.mjs), keeps it
// in state.cashRate, moves any scenario rate that follows it, and — when it has moved and the move isn't answered —
// shows Net worth → Property a panel to record the move on the household's loans, or let it be.
import { state, commit, freshForBackground } from "../state.js";
import { cashRateMove, loansForMove, takeCashRateFile } from "../calc/cashrate.js";
import { siteJson } from "./autoprices.js";
import { localDateStr, fmtDate } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

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
// The panel: the rate, and an unanswered move with the loans it could apply to.
export function cashRatePanelHtml(st, today){
  var c = st.cashRate;
  if(!c) return "";
  var move = cashRateMove(st);
  if(!move) return '<p class="cr-line">' + escapeAttr(cashRateLine(c)) + '</p>';
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
        '<button type="button" class="btn btn-sm" data-cr-record>Record on the loans ticked</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-cr-dismiss>Not now</button></div>'
      : '<div class="cr-actions"><button type="button" class="btn btn-sm btn-ghost" data-cr-dismiss>OK</button></div>') +
  '</div>';
}
export function renderCashRatePanel(){
  var el = typeof document !== "undefined" && document.getElementById("cashRatePanel");
  if(!el) return;
  var html = cashRatePanelHtml(state, localDateStr());
  el.hidden = !html;
  el.innerHTML = html;
}
