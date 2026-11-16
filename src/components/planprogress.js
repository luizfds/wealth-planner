// ---------------- Monthly progress against next year's plan (#400) ----------------
//
// The month review's "Is the plan on track?" part (calc/planprogress.js), and the setting that turns it on. Opt-in:
// with state.planCheckIn off, neither the part nor the bell's item shows.
import { monthLabel } from "../calc/monthreview.js";
import { state } from "../state.js";
import { escapeAttr } from "../lib/html.js";
import { fmtCurrency0, fmtDate } from "../lib/format.js";
import { emptyStateHtml } from "../lib/empty.js";
import { keepUi } from "../lib/keepui.js";

function money(v){ return (v < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(Number(v) || 0)); }
// A balance as the goal reads it: what's owed on a card or loan is negative — said as owed.
function bal(v){ return v < 0 ? money(-v) + " owed" : money(v); }
function day(iso){ return fmtDate(iso, { year: true }); }
var LABEL = { "on-track": "On track", ahead: "Ahead", behind: "Behind", done: "Reached", early: "Too soon to tell", "no-data": "Can't tell yet" };

export function planCheckInOn(){ return state.planCheckIn === true; }
// The month review shows its part only when the check-in is on and there's a planned goal.
export function planStepWanted(){ return planCheckInOn() && (state.savingsGoals || []).some(function(g){ return g && g.plannedMonthly != null && g.planYear; }); }

function goalHtml(p){
  var lines = [];
  if(p.status === "no-data") lines.push(p.problem);
  else if(p.status === "done") lines.push("At " + bal(p.actual) + " — the target is reached.");
  else {
    lines.push("By the plan it should be " + bal(p.expected) + " by now — it's " + bal(p.actual) +
      (Math.abs(p.gap) < 1 ? "." : ", " + money(Math.abs(p.gap)) + (p.gap < 0 ? " short." : " ahead.")) +
      " Measured from " + (p.fromYearStart ? "the plan year's start, " + day(p.from) : "when the plan was saved, " + day(p.from)) + ", at " + money(p.planned) + " a month.");
    if(p.status === "early") lines.push("Under a month in — the pace isn't clear yet.");
    else if(p.forecast != null && p.yearEnd) lines.push("At the pace so far (" + money(p.pace) + " a month) it ends " + p.planYear + " at " + bal(p.forecast) + "; the plan has " + bal(p.planAtYearEnd) + ".");
    if(p.adjust){
      var a = p.adjust, bits = [];
      if(a.monthly != null) bits.push("put " + money(a.monthly) + " a month toward it from now" + (a.extra > 0 ? " (" + money(a.extra) + " more than planned)" : "") + " to land on " + day(p.by));
      bits.push(a.reach ? "at the pace so far it gets there around " + monthLabel(a.reach) : "at the pace so far it doesn't get there");
      lines.push("To catch up: " + bits.join(" — or ") + ".");
    }
  }
  if(p.stale.length && p.status !== "done") lines.push("The balance of " + p.stale.join(", ") + " hasn't been updated in over six weeks, so this may be out of date.");
  var tone = p.status === "behind" || p.status === "no-data" ? "warn" : p.status === "on-track" || p.status === "ahead" || p.status === "done" ? "good" : "";
  return '<li class="pp-goal pp-' + escapeAttr(p.status) + '"><div class="pp-head"><b>' + escapeAttr(p.name) + '</b><span class="pp-badge' + (tone ? " pp-" + tone : "") + '">' + escapeAttr(LABEL[p.status] || "") + '</span></div>' +
    lines.map(function(t){ return '<p class="pp-line">' + escapeAttr(t) + '</p>'; }).join("") + '</li>';
}
// The part's body. pr: planProgress(today).
export function planProgressHtml(pr){
  if(!pr.goals.length) return emptyStateHtml("No goals from next year's plan yet — make one at the end of Reports → Year in review, and its progress shows here each month.", { go: "plan/goals", label: "Go to Goals →", className: "pp-empty" });
  var lede = pr.behind ? (pr.goals.length === 1 ? "The planned goal is behind." : pr.behind + " of " + pr.goals.length + " planned goals " + (pr.behind === 1 ? "is" : "are") + " behind.")
    : pr.noData ? "Some goals can't be measured yet — what's missing is below."
    : "Every planned goal is where the plan has it, or ahead.";
  return '<p class="mr-lede">' + escapeAttr(lede) + '</p><ul class="pp-goals">' + pr.goals.map(goalHtml).join("") + '</ul>' +
    (pr.stale ? '<button type="button" class="btn btn-sm btn-ghost" data-mr-go="accounts">Update balances on Accounts</button>' : '') +
    '<p class="ledger-note pp-note">Balances as recorded on Accounts. Nothing is changed until you change a goal on Goals.</p>';
}

// Settings → Preferences: the check-in, off by default.
export function planCheckInPrefHtml(){
  return '<label class="pref-check"><input type="checkbox" data-plan-checkin' + (planCheckInOn() ? " checked" : "") + '> Check next year\'s plan each month</label>' +
    '<p class="ledger-note help pp-pref-help">Adds a step to the monthly review with each planned goal against the plan, and a notice in the bell when one falls behind or its balance is out of date. Only in the app, when it\'s opened — nothing is sent anywhere.</p>';
}
export function renderPlanCheckInPref(){
  var el = typeof document !== "undefined" && document.getElementById("planCheckInPref");
  if(!el) return;
  keepUi(function(){ el.innerHTML = planCheckInPrefHtml(); });
}
