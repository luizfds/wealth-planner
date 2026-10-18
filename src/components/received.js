import { incomeActuals, incomeTargets } from "../calc/received.js";
import { fmtCurrency0, fmtCurrency2, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Income → Received (v3.46.0) ----------------
//
// What arrived against each income line, beside what was planned — the income half of Expenses'
// "Actual vs. planned". Logged from the sheet below, the quick actions, or a bank import's money-in
// groups. calc/received.js holds the data and explains why it isn't in state.transactions.

var openRows = {};
export function renderReceived(){
  var el = typeof document !== "undefined" && document.getElementById("receivedBody");
  if(el) el.innerHTML = receivedPanelHtml();
}
export function toggleReceivedRow(key){ openRows[key] = !openRows[key]; }

export function receivedPanelHtml(monthStr){
  // A holding with no expected distribution and nothing logged this year is just noise in the list;
  // it stays one tap away in the sheet.
  var rows = incomeActuals(monthStr).filter(function(r){ return r.kind !== "payout" || r.planned > 0 || r.rows.length; });
  if(!rows.length) return '<p class="ledger-note" style="margin:0">Add an income row, a rental property or a holding and you can log what actually arrives against it.</p>';
  var anyLogged = rows.some(function(r){ return r.rows.length; });
  return (anyLogged ? "" : '<p class="ledger-note" style="margin:0 0 10px">Nothing logged yet. Each time pay, rent or a distribution lands, log it here — or assign the money-in rows of a bank import — and this shows it against the plan.</p>') +
    '<div class="rcv-list">' + rows.map(function(r){
      var pct = r.planned > 0 ? Math.min(100, r.received / r.planned * 100) : (r.received > 0 ? 100 : 0);
      var diff = r.received - r.planned;
      var status = !r.rows.length ? '<span class="rcv-status muted">nothing logged ' + escapeAttr(r.period) + '</span>'
        : (r.planned > 0 && Math.abs(diff) >= 1
          ? '<span class="rcv-status ' + (diff >= 0 ? "up" : "down") + '">' + (diff >= 0 ? "+" : "−") + fmtCurrency0.format(Math.abs(diff)) + (diff >= 0 ? " more" : " short") + '</span>'
          : '<span class="rcv-status up">as planned</span>');
      var open = !!openRows[r.key];
      return '<div class="rcv-row' + (open ? " open" : "") + '" data-rcv-key="' + escapeAttr(r.key) + '">' +
        '<button type="button" class="rcv-summary" data-rcv-toggle="' + escapeAttr(r.key) + '" aria-expanded="' + open + '">' +
          '<span class="rcv-name">' + escapeAttr(r.label) + '<small>' + escapeAttr(r.period) + '</small></span>' +
          '<span class="rcv-figs"><b>' + fmtCurrency0.format(r.received) + '</b> of ' + fmtCurrency0.format(r.planned) + '</span>' +
          '<span class="rcv-bar"><span style="width:' + pct.toFixed(1) + '%"></span></span>' + status +
        '</button>' +
        (open ? '<div class="rcv-detail">' + (r.rows.length
          ? r.rows.map(function(x){
              return '<div class="rcv-item"><span>' + escapeAttr(x.date) + (x.what ? ' · ' + escapeAttr(x.what) : '') + '</span><b>' + fmtCurrency2.format(x.amount) + '</b>' +
                '<button type="button" class="icon-btn icon-del" data-rcv-del="' + escapeAttr(x.id) + '" aria-label="Delete this record">✕</button></div>';
            }).join("")
          : '<p class="ledger-note" style="margin:0">Nothing logged ' + escapeAttr(r.period) + '.</p>') +
          '<button type="button" class="btn btn-sm btn-ghost" data-rcv-log="' + escapeAttr(r.key) + '">+ Log ' + escapeAttr(r.kind === "payout" ? "a distribution" : r.kind === "rent" ? "rent" : "pay") + '</button></div>' : '') +
      '</div>';
    }).join("") + '</div>';
}

// ---------------- The sheet ----------------
export var receivedSheet = null;
export function openReceivedSheet(target, date){
  var targets = incomeTargets();
  receivedSheet = { target: target || (targets[0] && targets[0].key) || "", date: date || "" };
}
export function closeReceivedSheet(){ receivedSheet = null; }
export function setReceivedTarget(key){ if(receivedSheet) receivedSheet.target = key; }

export function receivedSheetHtml(){
  if(!receivedSheet) return "";
  var targets = incomeTargets();
  var chips = targets.map(function(t){
    var on = receivedSheet.target === t.key;
    return '<button type="button" class="qlog-chip' + (on ? " is-selected" : "") + '" data-rcv-chip="' + escapeAttr(t.key) + '" aria-pressed="' + on + '">' + escapeAttr(t.label) + '</button>';
  }).join("");
  var cur = targets.find(function(t){ return t.key === receivedSheet.target; });
  return '<div class="review-backdrop" data-rcv-backdrop>' +
    '<div class="review-panel qlog-panel" role="dialog" aria-label="Log income received">' +
      '<div class="review-head"><h4>Log income received</h4><button type="button" class="icon-btn" data-rcv-close aria-label="Close">✕</button></div>' +
      '<div class="qlog-amount-row"><span class="qlog-currency" aria-hidden="true">+$</span>' +
        '<input type="number" step="0.01" inputmode="decimal" id="rcvAmount" class="qlog-amount" placeholder="' + (cur && cur.monthly > 0 && !cur.irregular ? cur.monthly.toFixed(2) : "0.00") + '" aria-label="Amount received"></div>' +
      '<div class="qlog-section-label">What was it?</div>' +
      (targets.length ? '<div class="qlog-chips">' + chips + '</div>' : '<p class="qlog-empty">Add an income row first.</p>') +
      (cur && cur.kind === "net" ? '<p class="qlog-context">The pay that landed in your account — after tax and super.</p>' : '') +
      (cur && cur.kind === "rent" ? '<p class="qlog-context">What the agent paid you, after their fees.</p>' : '') +
      (cur && cur.kind === "payout" ? '<p class="qlog-context">Recorded as a payment on this holding — it counts toward its return and the tax year.</p>' : '') +
      '<input type="text" id="rcvNote" class="qlog-note" placeholder="Note (optional)" aria-label="Note (optional)">' +
      '<div class="qlog-date-row"><label class="qlog-date-label" for="rcvDate">Date</label><input type="date" id="rcvDate" class="qlog-date" value="' + (receivedSheet.date || localDateStr()) + '"></div>' +
      '<button type="button" class="btn review-log-btn qlog-submit" data-rcv-submit' + (targets.length ? '' : ' disabled') + '>Log received</button>' +
    '</div></div>';
}
