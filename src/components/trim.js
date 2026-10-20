import { state } from "../state.js";
import { trimReport, leanLevel, leanEffect } from "../calc/trim.js";
import { canBuy } from "../calc/canbuy.js";
import { fmtCurrency0, fmtCurrency2, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Cash flow → Budget → Trim (v3.100.0) — calc/trim.js ----------------
export var trimUi = { scenario: "", markOpen: false };
function money(n){ return fmtCurrency0.format(Math.round(n)); }
function leaves(n){ return n < 0 ? money(-n) + " short" : money(n); }
export function trimScenario(){
  var list = state.scenarios || [];
  if(trimUi.scenario && list.indexOf(trimUi.scenario) !== -1) return trimUi.scenario;
  var buy = list.find(function(s){ return state.purchase && state.purchase[s] && state.purchase[s].enabled; });
  return buy || state.activeScenario || list[0] || "";
}
export function renderTrim(){
  var el = typeof document !== "undefined" && document.getElementById("trimBody");
  if(!el) return;
  var today = localDateStr();
  var r = trimReport({ today: today });
  el.innerHTML = trimHtml(r, trimScenario(), today);
  var cnt = document.getElementById("trimCount");
  if(cnt) cnt.textContent = r.overYearly > 0 ? money(r.overYearly) + "/yr budgeted, not spent" : "";
}
export function trimHtml(r, scenario, today){
  var html = "";
  // 1. Budgeted above what's spent.
  if(r.over.length){
    html += '<div class="rc-sec">Budgeted above what you spend — ' + money(r.overYearly) + ' a year</div>' +
      '<p class="ledger-note tr-note">Every scenario plans with these amounts, so they make each one look worse than it is. Lowering a line to what you actually spend changes nothing about real money — only the plan.</p>' +
      r.over.map(function(x){
        return '<div class="rc-row"><div class="rc-main"><b>' + escapeAttr(x.what) + '</b><small>budgeted ' + money(x.planned) + '/yr · spent ' + money(x.actual) + ' in the last ' + Math.round(r.months) + ' months</small></div>' +
          '<span class="rc-amt">' + money(x.gap) + '<small>/yr over</small></span>' +
          '<div class="rc-actions"><button type="button" class="btn btn-sm" data-trim-set="' + escapeAttr(x.id) + '" data-trim-to="' + x.suggested + '">Set to ' + fmtCurrency2.format(x.suggested) + ' ' + escapeAttr(String(x.freq || "").toLowerCase()) + '</button></div></div>';
      }).join("") +
      (r.over.length > 1 ? '<div class="tr-all"><button type="button" class="btn btn-sm btn-ghost" data-trim-set-all>Set all ' + r.over.length + ' to what you spend</button></div>' : '');
  }
  // 2. A lean version of a scenario.
  var scen = state.scenarios || [];
  var eff = scenario ? leanEffect(scenario, { today: today }) : null;
  var buy = null; try { buy = scenario ? canBuy(scenario) : null; } catch(e){}
  var byId = {};
  (state.shared || []).forEach(function(l){ if(l.id) byId[l.id] = l; });
  html += '<div class="rc-sec">Run a scenario lean</div>' +
    '<p class="ledger-note tr-note">Keep, halve or pause each flexible line in one scenario only — the budget itself stays as it is.</p>' +
    '<label class="tr-scen"><span>Scenario</span><select data-trim-scenario aria-label="Scenario to run lean">' + scen.map(function(s){ return '<option' + (s === scenario ? ' selected' : '') + '>' + escapeAttr(s) + '</option>'; }).join("") + '</select></label>' +
    (r.flexible.length ? '<ul class="tr-flex">' + r.flexible.map(function(f){
      var lvl = leanLevel(byId[f.id], scenario);
      var opt = function(v, label){ return '<button type="button" class="seg-option' + (lvl === v ? ' active' : '') + '" data-trim-level="' + v + '" data-trim-line="' + escapeAttr(f.id) + '" aria-pressed="' + (lvl === v) + '">' + label + '</button>'; };
      return '<li><span class="tr-flex-name">' + escapeAttr(f.what) + '<small>' + money(f.yearly) + '/yr · half frees ' + money(f.monthly / 2) + '/mo</small></span>' +
        '<span class="seg-control tr-seg" role="group" aria-label="' + escapeAttr(f.what) + ' in ' + escapeAttr(scenario) + '">' + opt("keep", "Keep") + opt("half", "Half") + opt("pause", "Pause") + '</span></li>';
    }).join("") + '</ul>' : '<p class="ledger-note">No flexible lines yet — mark some below.</p>') +
    (eff ? '<div class="tr-effect"><div><span>A normal month in ' + escapeAttr(scenario) + '</span><b>' + leaves(eff.fullMonthly) + (eff.freedMonthly ? ' → ' + leaves(eff.leanMonthly) : '') + '</b></div>' +
      (eff.freedMonthly ? '<small>' + money(eff.freedMonthly) + '/mo (' + money(eff.freedYearly) + '/yr) freed by ' + eff.changed.length + ' line' + (eff.changed.length === 1 ? '' : 's') + '</small> <button type="button" class="link-btn" data-trim-clear>Back to the full budget</button>' : '<small>Nothing trimmed yet.</small>') +
      (buy ? '<small class="tr-buy">' + (buy.short > 0 ? money(buy.short) + ' short of the cash at settlement' : money(buy.left) + ' left after settlement') + ' · new loan ' + money(buy.repaymentMonthly) + '/mo</small>' : '') + '</div>' : '');
  // 3. Similar subscriptions.
  if(r.duplicates.length){
    html += '<div class="rc-sec">Similar subscriptions</div><ul class="tr-dupes">' + r.duplicates.map(function(d){
      return '<li><b>' + escapeAttr(d.family) + ':</b> ' + d.lines.map(function(l){ return escapeAttr(l.what) + ' (' + money(l.yearly) + '/yr)'; }).join(", ") + '</li>';
    }).join("") + '</ul>';
  }
  // 4. Which lines are flexible.
  html += '<details class="tr-mark"' + (trimUi.markOpen ? ' open' : '') + ' data-trim-mark><summary>Which lines are flexible?</summary>' +
    '<p class="ledger-note">Flexible means it could be paused or cut if it had to be. Until you set one, Wants lines that are spent unevenly count as flexible.</p><ul>' +
    r.wants.map(function(w){
      return '<li><label><input type="checkbox" data-trim-flex="' + escapeAttr(w.id) + '"' + (w.flexible ? ' checked' : '') + '> ' + escapeAttr(w.what) + '</label><small>' + money(w.yearly) + '/yr' + (w.inferred ? '' : ' · set by you') + '</small></li>';
    }).join("") + '</ul></details>';
  return html;
}
