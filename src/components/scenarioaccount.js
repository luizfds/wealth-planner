// ---------------- Try a scenario on an account (v3.185.0, item 216) ----------------
// On the scenario's own page: pick an everyday account and a settlement day, and its next 90 days are
// drawn as they are and with the scenario laid over them (calc/scenarioaccount.js).

import { state } from "../state.js";
import { scenarioOnAccount } from "../calc/scenarioaccount.js";
import { scenarioLegContext } from "../calc/engine.js";
import { transactionAccount } from "./expenses.js";
import { fmtCurrency0, localDateStr, fmtDate } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { renderLineChart, dateAxisFormat } from "../lib/charts.js";

export var tryQ = { accountId: null, settleOn: null, settlementHere: false };
function money(n){ return (n < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(Number(n) || 0)); }
function addDays(iso, n){ var d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return localDateStr(d); }
function everyday(){ return (state.accounts || []).filter(function(a){ return a && a.type === "everyday"; }); }

function result(key, today){
  var accts = everyday();
  var a = accts.find(function(x){ return x.id === tryQ.accountId; }) || accts[0];
  if(!a) return null;
  var settle = tryQ.settleOn && tryQ.settleOn > today ? tryQ.settleOn : addDays(today, 42);
  var ctx = scenarioLegContext(key);
  var r = scenarioOnAccount(state, key, a, today, settle, { accountOf: transactionAccount, taxEffect: ctx.taxEffectFor, settlementHere: tryQ.settlementHere });
  return r ? { account: a, accounts: accts, r: r, settle: settle } : { account: a, accounts: accts, r: null, settle: settle };
}
export function scenarioAccountHtml(key, today){
  today = today || localDateStr();
  var x = result(key, today);
  if(!x) return "";
  var pick = '<label class="sca-field"><span>Account</span><select data-try-account>' + x.accounts.map(function(a){ return '<option value="' + escapeAttr(a.id) + '"' + (a === x.account ? " selected" : "") + '>' + escapeAttr(a.name) + '</option>'; }).join("") + '</select></label>' +
    '<label class="sca-field"><span>Settles on</span><input type="date" data-try-settle value="' + escapeAttr(x.settle) + '" min="' + escapeAttr(addDays(today, 1)) + '"></label>' +
    (x.r && x.r.settlement ? '<label class="sca-check"><input type="checkbox" data-try-settlement' + (tryQ.settlementHere ? ' checked' : '') + '> Pay the ' + money(x.r.settlement) + ' at settlement from this account</label>' : '');
  var body;
  if(!x.r) body = '<p class="ledger-note">Record ' + escapeAttr(x.account.name) + '\'s balance once (on Accounts) to see its days.</p>';
  else {
    var s = x.r.scenario, t = x.r.today, buf = x.account.buffer != null && x.account.buffer !== "" ? Number(x.account.buffer) : null;
    body = (s.below ? '<p class="fc-warn">With this scenario ' + escapeAttr(x.account.name) + ' goes under ' + (buf != null ? 'your ' + money(buf) + ' buffer' : 'zero') + ' on <b>' + escapeAttr(fmtDate(s.below.date)) + '</b> — lowest <b>' + money(s.lowest.balance) + '</b> on ' + escapeAttr(fmtDate(s.lowest.date)) + '.</p>'
        : '<p class="fc-line">Lowest in 90 days with this scenario: <b>' + money(s.lowest.balance) + '</b> on ' + escapeAttr(fmtDate(s.lowest.date)) + ' (today\'s plan: ' + money(t.lowest.balance) + '). In 90 days: ' + money(s.end) + '.</p>') +
      (x.r.settlement && !tryQ.settlementHere ? '<p class="ledger-note" style="margin:0 0 6px">The ' + money(x.r.settlement) + ' needed at settlement isn\'t taken from this account — it usually comes from savings (Side by side shows whether there\'s enough).</p>' : '') +
      '<div class="dt-chart" id="scAcctChart"></div>';
  }
  return '<div class="sca"><div class="home-recurring-label">Try it on an account</div><div class="sca-pick">' + pick + '</div>' + body +
    '<p class="ledger-note" style="margin:6px 0 0">The account\'s next 90 days as they are (dashed) and with this scenario from the day it settles: a new rent or cost on its rhythm, a property\'s rent each week and its loan and costs each month, and today\'s home bills stopping if it moves' + (tryQ.settlementHere ? ', with the settlement on the day' : '') + '. Changes from a later year, an age or a cash target wait.</p></div>';
}
export function renderScenarioAccountChart(key, today){
  var host = typeof document !== "undefined" && document.getElementById("scAcctChart");
  if(!host) return;
  var x = result(key, today || localDateStr());
  if(!x || !x.r) return;
  var pts = function(f){ return f.points.map(function(p){ return { x: Date.parse(p.date + "T00:00:00"), y: p.balance }; }); };
  var a = pts(x.r.today), b = pts(x.r.scenario);
  var series = [{ label: "As it is", colorClass: "series-color-0", dashed: true, points: a }, { label: "With this scenario", colorClass: "series-color-1", points: b }];
  if(x.account.buffer != null && x.account.buffer !== "") series.push({ label: "Buffer", colorClass: "series-color-3", dashed: true, points: [{ x: a[0].x, y: Number(x.account.buffer) }, { x: a[a.length - 1].x, y: Number(x.account.buffer) }] });
  renderLineChart(host, series, { height: 200, stepped: true, baseline: "auto", yFormat: function(v){ return fmtCurrency0.format(v); }, xFormat: dateAxisFormat(a), ariaLabel: x.account.name + "'s next 90 days, with and without this scenario", alwaysLegend: true });
}
