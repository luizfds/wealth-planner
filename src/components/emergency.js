import { state } from "../state.js";
import { emergencyFund, EMERGENCY_MONTHS } from "../calc/emergency.js";
import { fmtCurrency0 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Accounts → Emergency fund (v3.94.0) — calc/emergency.js ----------------
export function renderEmergencyFund(){
  var el = typeof document !== "undefined" && document.getElementById("emergencyBody");
  if(el) el.innerHTML = emergencyHtml(emergencyFund());
}
function money(n){ return fmtCurrency0.format(Math.round(n)); }
function monthsText(m){ return m >= 24 ? Math.round(m / 12) + " years" : (Math.round(m * 10) / 10) + " month" + (Math.round(m * 10) / 10 === 1 ? "" : "s"); }
export function existingEmergencyGoal(){
  return (state.savingsGoals || []).find(function(g){ return /emergency/i.test(g.name || ""); }) || null;
}

export function emergencyHtml(f){
  if(!(f.monthly > 0)) return '<p class="ledger-note" style="margin:0">Mark the budget lines you couldn\'t stop paying as <b>Needs</b> on Cash flow → Budget — rent, utilities, groceries, insurance — and this works out how much to keep aside.</p>';
  var seg = '<div class="seg-control ef-seg" role="group" aria-label="Months to cover">' + EMERGENCY_MONTHS.map(function(m){
    return '<button type="button" class="seg-option' + (m === f.months ? ' active' : '') + '" data-ef-months="' + m + '" aria-pressed="' + (m === f.months) + '">' + m + ' months</button>';
  }).join("") + '</div>';
  var pct = f.target > 0 ? Math.min(100, f.available / f.target * 100) : 0;
  var enough = f.available >= f.target;
  var status = enough
    ? 'Your cash and offsets (' + money(f.available) + ') cover it — about ' + monthsText(f.coveredMonths) + ' of essentials.'
    : 'Your cash and offsets hold ' + money(f.available) + ' — ' + money(f.target - f.available) + ' short, about ' + monthsText(f.coveredMonths) + ' of essentials.';
  var groups = f.groups.slice(0, 8).map(function(g){
    return '<li><span>' + escapeAttr(g.category) + '</span><b>' + money(g.monthly) + '/mo</b></li>';
  }).join("");
  var lines = f.lines.map(function(l){
    return '<li><span>' + escapeAttr(l.what) + (l.actual != null && l.actual > l.planned + 0.5 ? ' <small>spent ' + money(l.actual) + ', above the ' + money(l.planned) + ' planned</small>' : '') + '</span><b>' + money(l.counted) + '</b></li>';
  }).join("");
  var people = f.perPerson.length ? '<div class="ef-people"><div class="ef-sub">If one income stopped</div><ul>' + f.perPerson.map(function(p){
    var others = f.perPerson.filter(function(x){ return x !== p; }).map(function(x){ return x.person; }).join(" and ");
    return '<li>' + (p.drawMonthly > 0
      ? '<b>' + escapeAttr(p.person) + '\'s pay:</b> ' + escapeAttr(others) + '\'s take-home (' + money(p.othersMonthly) + '/mo) leaves ' + money(p.drawMonthly) + '/mo to find — ' + money(p.target) + ' for ' + f.months + ' months' + (p.lastsMonths != null ? ', and what you hold lasts about ' + monthsText(p.lastsMonths) : '') + '.'
      : '<b>' + escapeAttr(p.person) + '\'s pay:</b> ' + escapeAttr(others) + '\'s take-home (' + money(p.othersMonthly) + '/mo) covers the essentials on its own.') + '</li>';
  }).join("") + '</ul></div>' : '';
  var goal = existingEmergencyGoal();
  var goalBtn = goal
    ? (Math.round(Number(goal.target) || 0) !== f.target ? '<button type="button" class="btn btn-sm" data-ef-goal>Set the “' + escapeAttr(goal.name) + '” goal to ' + money(f.target) + '</button>' : '<span class="ledger-note">Tracked as the “' + escapeAttr(goal.name) + '” savings goal.</span>')
    : '<button type="button" class="btn btn-sm" data-ef-goal>Track it as a savings goal</button>';
  return seg +
    '<div class="ef-head"><div><span class="ef-label">Keep aside</span><b class="ef-target">' + money(f.target) + '</b><small>' + f.months + ' × ' + money(f.monthly) + ' a month of essentials</small></div>' +
      '<div class="ef-alts">' + f.targets.filter(function(t){ return t.months !== f.months; }).map(function(t){ return '<span>' + t.months + ' months: <b>' + money(t.target) + '</b></span>'; }).join("") + '</div></div>' +
    '<div class="ef-bar" aria-hidden="true"><i class="' + (enough ? 'ok' : '') + '" style="width:' + pct.toFixed(1) + '%"></i></div>' +
    '<p class="ef-status ' + (enough ? 'ok' : 'short') + '">' + status + '</p>' +
    people +
    '<div class="ef-sub">What counts as essential</div><ul class="ef-groups">' + groups + '</ul>' +
    '<details class="ef-lines"><summary>Every line (' + f.lines.length + ')</summary><ul>' + lines + '</ul>' +
      '<p class="ledger-note">The budget lines marked <b>Needs</b>, your home costs and what the investment property costs beyond its rent. Wants — trips, eating out, subscriptions — stop in an emergency, so they\'re left out. ' +
      (f.usedActual ? 'A line counts at what you\'ve actually spent over the last year when that\'s more than its plan. ' : '') +
      'Change a line between Needs and Wants on Cash flow → Budget.</p></details>' +
    '<p class="ledger-note ef-note">Measured against cash and offset balances — money you can spend tomorrow. Shares aren\'t counted: the point is not having to sell in a bad week.</p>' +
    '<div class="ef-actions">' + goalBtn + '</div>';
}
