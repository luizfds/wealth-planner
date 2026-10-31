// ---------------- Balance forecast by the day (v3.180.0, item 206) ----------------
//
// An everyday account's next 90 days (calc/dailyforecast.js): on its detail page, the line, the
// lowest point, the buffer the person sets, and what lands when; on Home, a card when an account is
// heading under its buffer.

import { state } from "../state.js";
import { accountForecast, forecastWarnings } from "../calc/dailyforecast.js";
import { transactionAccount } from "./expenses.js";
import { fmtCurrency0, localDateStr, fmtDate } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { renderLineChart, dateAxisFormat } from "../lib/charts.js";

function money(n){ return (n < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(Number(n) || 0)); }
var opts = { accountOf: transactionAccount };

export function balanceForecastHtml(account, today){
  today = today || localDateStr();
  var f = accountForecast(state, account, today, 90, opts);
  if(!f) return '<p class="ledger-note">Record this account\'s balance once (on Accounts) and its next 90 days are worked out from there.</p>';
  var buf = account.buffer != null && account.buffer !== "" ? Number(account.buffer) : null;
  var head = f.below
    ? '<p class="fc-warn">' + (f.below.date === today ? 'Under your ' + money(buf) + ' buffer <b>now</b>' : 'Heading under your ' + money(buf) + ' buffer on <b>' + escapeAttr(fmtDate(f.below.date)) + '</b>') + ' — lowest <b>' + money(f.lowest.balance) + '</b> on ' + escapeAttr(fmtDate(f.lowest.date)) + '.</p>'
    : '<p class="fc-line">Lowest in the next 90 days: <b>' + money(f.lowest.balance) + '</b> on ' + escapeAttr(fmtDate(f.lowest.date)) + (buf != null ? ', above your ' + money(buf) + ' buffer' : '') + '. In 90 days: ' + money(f.end) + '.</p>';
  var upcoming = [];
  f.points.forEach(function(p){ p.events.forEach(function(e){ upcoming.push({ date: p.date, what: e.what, amount: e.amount, kind: e.kind }); }); });
  var list = upcoming.slice(0, 12).map(function(e){
    return '<li><span>' + escapeAttr(fmtDate(e.date)) + '</span><span class="fc-what">' + escapeAttr(e.kind === "pay" ? (e.what && !/^net:/.test(e.what) ? (/^pay\b/i.test(e.what) ? e.what : "Pay — " + e.what) : "Pay") : e.what) + '</span><b class="' + (e.amount >= 0 ? "up" : "") + '">' + (e.amount >= 0 ? "+" : "") + money(e.amount) + '</b></li>';
  }).join("");
  return head + '<div class="dt-chart" id="acctForecastChart"></div>' +
    '<label class="fc-buffer">Warn me below <input type="number" min="0" step="50" inputmode="decimal" data-acct-buffer="' + escapeAttr(account.id) + '" value="' + escapeAttr(buf == null ? "" : buf) + '" placeholder="a buffer, e.g. 500"></label>' +
    (list ? '<ul class="fc-list">' + list + '</ul>' : '') +
    '<p class="ledger-note" style="margin:6px 0 0">From today\'s balance: pay on the rhythm it has landed here before' + (f.payFound ? '' : ' (none logged into this account yet, so none is counted)') +
    ', ' + (f.billCount ? 'the bills paid from this account and card repayments it makes, on their days' : 'bills on their days (none paid from this account are on the calendar)') +
    ', and day-to-day spending of about ' + money(f.spendDaily) + ' a day — its last 90 days, bills left out.</p>';
}
export function renderBalanceForecastChart(account, today){
  var host = typeof document !== "undefined" && document.getElementById("acctForecastChart");
  if(!host) return;
  var f = accountForecast(state, account, today || localDateStr(), 90, opts);
  if(!f) return;
  var pts = f.points.map(function(p){ return { x: Date.parse(p.date + "T00:00:00"), y: p.balance }; });
  var series = [{ label: "Balance", colorClass: "series-color-0", points: pts }];
  if(f.buffer != null) series.push({ label: "Buffer", colorClass: "series-color-3", dashed: true, points: [{ x: pts[0].x, y: f.buffer }, { x: pts[pts.length - 1].x, y: f.buffer }] });
  renderLineChart(host, series, { height: 200, stepped: true, baseline: "auto", yFormat: function(x){ return fmtCurrency0.format(x); }, xFormat: dateAxisFormat(pts), ariaLabel: "Balance over the next 90 days" });
}

// Home: only when an account is heading under its buffer.
export function lowBalanceCardHtml(today){
  today = today || localDateStr();
  var w;
  try { w = forecastWarnings(state, today, opts); } catch(e){ w = []; }
  if(!w.length) return "";
  return '<div class="home-lowbal" data-home-card="lowbal" role="status"><span class="home-k">Balance ahead</span><ul class="home-list">' + w.map(function(x){
    var f = x.forecast;
    return '<li><button type="button" class="home-todo-btn warn" data-detail="account" data-detail-id="' + escapeAttr(x.account.id) + '">' + escapeAttr(x.account.name) + (f.below.date === today ? ' is under ' + money(Number(x.account.buffer)) + ' now' : ' dips under ' + money(Number(x.account.buffer)) + ' on ' + escapeAttr(fmtDate(f.below.date))) +
      ' — lowest ' + money(f.lowest.balance) + ' on ' + escapeAttr(fmtDate(f.lowest.date)) + ' <span aria-hidden="true">›</span></button></li>';
  }).join("") + '</ul></div>';
}
