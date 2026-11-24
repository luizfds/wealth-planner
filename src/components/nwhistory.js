// ---------------- Accounts → Net worth history (November 2026) ----------------
//
// Every day net worth was recorded, newest first, each one fixable: its figure changed or the day taken out. A day
// out of line with both its neighbours (calc/nwauto.js historyOutliers) is flagged — a balance counted twice for a day
// drew a spike in Today's line. Today's own reading follows the balances, so it's shown, not edited.
import { state } from "../state.js";
import { historyOutliers } from "../calc/nwauto.js";
import { fmtCurrency0, fmtDate, localDateStr } from "../lib/format.js";
import { formatMoney } from "../lib/field.js";
import { escapeAttr } from "../lib/html.js";
import { emptyStateHtml } from "../lib/empty.js";
import { keepUi } from "../lib/keepui.js";

export var NW_HISTORY_PAGE = 30;
// Session only: how many days are listed.
export var nwHistoryUi = { shown: NW_HISTORY_PAGE };

export function nwHistoryHtml(log, today, shown){
  today = today || localDateStr();
  var rows = (Array.isArray(log) ? log : []).filter(function(h){ return h && h.date; })
    .slice().sort(function(a, b){ return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  if(!rows.length) return emptyStateHtml("Nothing recorded yet — net worth is noted each day the app is opened, and the line on Today grows from it.", { done: true });
  var odd = historyOutliers(log);
  var oddCount = Object.keys(odd).length;
  var list = rows.slice(0, Math.max(NW_HISTORY_PAGE, shown || NW_HISTORY_PAGE));
  var body = list.map(function(h){
    var isToday = h.date === today, flagged = !!odd[h.date], id = "nwh-" + h.date;
    var label = fmtDate(h.date);
    return '<li class="nwh-row' + (flagged ? ' is-odd' : '') + '" data-nwh-date="' + escapeAttr(h.date) + '">' +
      '<span class="nwh-when"><b>' + escapeAttr(label) + '</b>' +
        (isToday ? '<small>today — follows your balances</small>' : flagged ? '<small class="nwh-flag">out of line with the days either side</small>' : h.edited ? '<small>changed by hand</small>' : '') + '</span>' +
      (isToday
        ? '<b class="nwh-amt">' + fmtCurrency0.format(Number(h.value) || 0) + '</b>'
        : '<label class="nwh-edit"><span class="visually-hidden">Net worth on ' + escapeAttr(label) + '</span><span aria-hidden="true">$</span>' +
            '<input type="text" inputmode="decimal" autocomplete="off" data-money class="field-control field-compact" id="' + escapeAttr(id) + '" data-nwh-value="' + escapeAttr(h.date) + '" value="' + escapeAttr(formatMoney(Math.round(Number(h.value) || 0))) + '"></label>' +
          '<button type="button" class="btn btn-sm btn-danger" data-nwh-remove="' + escapeAttr(h.date) + '">Remove<span class="visually-hidden"> ' + escapeAttr(label) + '</span></button>') +
    '</li>';
  }).join("");
  return (oddCount ? '<p class="nwh-note"><b>' + oddCount + ' day' + (oddCount === 1 ? '' : 's') + ' out of line</b> with the days either side — most often a balance counted twice for a day. Change its figure or remove it, and the line on Today and the charts follow.</p>'
      : '<p class="nwh-note">Each day net worth was recorded. Change a figure that was wrong, or remove the day.</p>') +
    '<ul class="nwh-list">' + body + '</ul>' +
    (rows.length > list.length ? '<button type="button" class="btn btn-sm btn-ghost" data-nwh-more>Show ' + Math.min(NW_HISTORY_PAGE, rows.length - list.length) + ' more of ' + rows.length + '</button>' : '');
}

export function renderNwHistory(){ return keepUi(drawNwHistory); }
function drawNwHistory(){
  var el = typeof document !== "undefined" && document.getElementById("nwHistoryBody");
  if(!el) return;
  el.innerHTML = nwHistoryHtml(state.netWorthLog, localDateStr(), nwHistoryUi.shown);
}
