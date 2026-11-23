// ---------------- Money → Budget → Adjust the plan (November 2026) — calc/adjustplan.js ----------------
//
// Each line beside what's typically spent, "Use $X" per line, and what the picks would do to the plan and to a normal
// month's left over — before anything is saved. Nothing changes until Save; Save is one commit with an undo.
import { state } from "../state.js";
import { adjustRows, adjustEffect } from "../calc/adjustplan.js";
import { periodsOf, resolveSharedAmount } from "../calc/ledger.js";
import { currentScenario, scenarioTotals } from "../calc/engine.js";
import { classWord } from "../constants.js";
import { loggableBudgetLineItems } from "./expenses.js";
import { fmtCurrency0, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { emptyStateHtml } from "../lib/empty.js";

// This device's session: which rows are picked, and Far from typical or All.
export var adjustUi = { picked: {}, filter: "far" };
function money(n){ return (n < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(Math.round(Number(n) || 0))); }

export function adjustModel(today){
  var scen = currentScenario();
  var rows = adjustRows(loggableBudgetLineItems(), state.transactions, today || localDateStr(), { monthlyOf: function(l){ return periodsOf(resolveSharedAmount(l, scen), l.freq).monthly; } });
  var totals = null;
  try { totals = scenarioTotals(scen); } catch(e){ totals = null; }
  var left = totals ? (totals.regularNetMonthly != null ? totals.regularNetMonthly : totals.netMonthly) : null;
  return { rows: rows, left: left };
}

export function renderAdjust(){
  var el = typeof document !== "undefined" && document.getElementById("adjustBody");
  if(!el) return;
  var m = adjustModel();
  // A picked line whose figures moved since (edited, spent on) keeps its pick only while it's still a change.
  Object.keys(adjustUi.picked).forEach(function(id){ var r = m.rows.find(function(x){ return x.id === id; }); if(!r || Math.abs(r.typical - r.planMonthly) < 1) delete adjustUi.picked[id]; });
  el.innerHTML = adjustHtml(m);
  var cnt = document.getElementById("adjustCount");
  if(cnt){ var far = m.rows.filter(function(r){ return r.far; }).length; cnt.textContent = far ? far + " far from typical" : ""; }
}

export function adjustHtml(m){
  var far = m.rows.filter(function(r){ return r.far; });
  var shown = adjustUi.filter === "far" ? far : m.rows.filter(function(r){ return r.months > 0; });
  var eff = adjustEffect(m.rows, adjustUi.picked);
  var chip = function(key, label, n){ return '<button type="button" class="bl-chip' + (adjustUi.filter === key ? " is-on" : "") + '" data-adjust-filter="' + key + '" aria-pressed="' + (adjustUi.filter === key) + '">' + label + ' <span>' + n + '</span></button>'; };
  var html = '<p class="ledger-note help" style="margin-left:0">Each line beside what you\'ve typically spent a month over the last 12 full months. A plan far from it makes every month, and every scenario on Plan, look better or worse than it is.</p>' +
    '<div class="bl-chips" role="group" aria-label="Show">' + chip("far", "Far from typical", far.length) + chip("all", "All", m.rows.filter(function(r){ return r.months > 0; }).length) + '</div>';
  if(!shown.length) html += emptyStateHtml("Every line is close to what you typically spend.", { done: true });
  else html += '<ul class="ap-rows">' + shown.map(function(r){
    var on = !!adjustUi.picked[r.id], same = Math.abs(r.typical - r.planMonthly) < 1;
    return '<li class="ap-row"><span class="ap-name">' + escapeAttr(r.what) + ' <small>· ' + escapeAttr(classWord(r.classification)) + (r.irregular ? ' · set aside' : '') + '</small></span>' +
      (same ? '<span class="ap-same">on plan</span>' : '<button type="button" class="btn btn-sm' + (on ? ' btn-ghost' : '') + '" data-adjust-pick="' + escapeAttr(r.id) + '" aria-pressed="' + on + '">' + (on ? 'Undo' : (r.typical === 0 ? 'Make it $0' : 'Use ' + money(r.typical) + '/mo')) + '</button>') +
      '<small class="ap-sub">Plan <b class="' + (on ? 'ap-new' : '') + '">' + money(on ? r.typical : r.planMonthly) + '/mo</b> · typical <b>' + money(r.typical) + '/mo</b> · ' + escapeAttr(r.note) + '</small></li>';
  }).join("") + '</ul>';
  var leftNow = m.left;
  html += '<div class="ap-foot"><div><span>Changes the plan by</span><b>' + (eff.count ? (eff.delta >= 0 ? "+" : "−") + money(Math.abs(eff.delta)) + '/mo' : '—') + '</b></div>' +
    (leftNow != null ? '<div><span>Left over in a normal month</span><b>' + money(leftNow) + (eff.count ? ' → ' + money(leftNow - eff.delta) : '') + '</b></div>' : '') +
    '<button type="button" class="btn btn-primary" data-adjust-save' + (eff.count ? '' : ' disabled') + '>' + (eff.count ? 'Save ' + eff.count + ' change' + (eff.count === 1 ? '' : 's') : 'Pick a line to change') + '</button></div>';
  return html;
}
