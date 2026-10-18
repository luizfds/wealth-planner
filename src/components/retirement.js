import { state } from "../state.js";
import { retirementPlan } from "../calc/retirement.js";
import { superContributions } from "../calc/investments.js";
import { goalsOverview } from "../calc/savegoals.js";
import { currentTaxFy } from "../calc/tax.js";
import { scenarioTotals } from "../calc/engine.js";
import { fmtCurrency0, fmtPercent0, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Plan → Retirement (v3.73.0) ----------------
// One page for "when can we stop working, and what changes it": the answer up top, the levers as
// sliders, what each lever is worth in years, and the two things already in the app that feed it —
// super cap room and savings goals.
export var retireLevers = { retireAge: null, annualExpenses: null, extraSavingsMonthly: 0, extraSuperYearly: 0 };
function money(n){ return fmtCurrency0.format(Math.round(n || 0)); }

function slider(key, label, min, max, step, value, fmt){
  return '<label class="rt-slider"><span>' + label + ' <b data-rt-out="' + key + '">' + fmt(value) + '</b></span>' +
    '<input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '" data-rt="' + key + '" aria-label="' + escapeAttr(label) + '"></label>';
}

export function retirementHtml(today){
  today = today || localDateStr();
  var plan = retirementPlan(retireLevers);
  var f = state.fire || {};
  var ages = '<div class="rt-ages"><label class="cf-filter"><span>Your age now</span><input type="number" min="16" max="90" data-rt-fire="currentAge" value="' + (f.currentAge != null ? f.currentAge : "") + '"></label>' +
    '<label class="cf-filter"><span>Super opens at</span><input type="number" min="55" max="70" data-rt-fire="preservationAge" value="' + (f.preservationAge != null ? f.preservationAge : 60) + '"></label></div>';
  if(plan.needsAge) return '<p class="ledger-note" style="margin:0 0 10px">Type your age to see when you could stop working. Everything else comes from the plan already in the app.</p>' + ages;
  var run = plan.run, inp = plan.inputs;
  var headline = plan.earliest != null
    ? '<div class="rt-head"><span>On these numbers you could stop working at</span><b>' + plan.earliest + '</b><small>' + (plan.earliest - inp.currentAge > 0 ? "in " + (plan.earliest - inp.currentAge) + " years" : "now") + ' — spending ' + money(inp.annualExpenses) + ' a year in today\'s dollars</small></div>'
    : '<div class="rt-head warn"><span>On these numbers, not before 75</span><b>—</b><small>Try the levers below — spending, saving or super.</small></div>';
  var expenses = retireLevers.annualExpenses != null ? retireLevers.annualExpenses : Math.round(inp.annualExpenses / 1000) * 1000;
  var sliders = '<div class="rt-sliders">' +
    slider("retireAge", "Stop working at", Math.max(inp.currentAge + 1, 35), 75, 1, plan.age, function(v){ return v; }) +
    slider("annualExpenses", "Spending a year in retirement", 20000, Math.max(200000, expenses * 2), 1000, expenses, money) +
    slider("extraSavingsMonthly", "Extra saved a month", 0, 5000, 100, retireLevers.extraSavingsMonthly || 0, money) +
    slider("extraSuperYearly", "Extra into super a year", 0, 30000, 1000, retireLevers.extraSuperYearly || 0, money) + '</div>';
  var check = run ? '<div class="rt-check">' +
    '<div class="' + (run.bridgeSurvives ? "ok" : "bad") + '"><span>' + (run.bridgeYears ? "Bridge to " + inp.preservationAge + " — " + run.bridgeYears + " years on money outside super" : "No bridge needed — super is open by then") + '</span>' +
      '<b>' + (run.bridgeYears ? money(run.accessibleAtRetire) + " of " + money(run.bridgeNeeded) + " needed" : "✓") + '</b></div>' +
    '<div class="' + (run.potSustains ? "ok" : "bad") + '"><span>From ' + inp.preservationAge + ': everything has to sustain a 4% draw</span><b>' + money(run.potAtPreservation) + ' of ' + money(run.targetFI) + '</b></div>' +
    '<p class="rt-verdict ' + (run.passes ? "ok" : "bad") + '">' + (run.passes ? "Stopping at " + run.retireAge + " works on these numbers." : "Stopping at " + run.retireAge + " doesn't work yet" + (run.bridgeSurvives ? " — the pot at " + inp.preservationAge + " falls short." : " — the money outside super runs out before " + inp.preservationAge + ".")) + '</p></div>' : '';
  var lev = '<div class="rt-levers"><div class="property-section-title">What changes it</div>' + plan.levers.map(function(l){
    return '<div class="rt-lever"><span>' + l.label + '</span><b>' + (l.age == null ? "—" : l.years > 0 ? l.years + " year" + (l.years === 1 ? "" : "s") + " sooner (" + l.age + ")" : "no change") + '</b></div>';
  }).join("") + '</div>';
  var sc = superContributions(currentTaxFy());
  var room = sc.reduce(function(s, r){ return s + r.room; }, 0);
  var go = goalsOverview(today, scenarioTotals(state.activeScenario).netMonthly);
  var links = '<div class="rt-links">' +
    '<div><span>Super cap room this year</span><b>' + money(room) + '</b><small>' + (room > 0 ? "Concessional room left across " + sc.length + " " + (sc.length === 1 ? "person" : "people") + " — the “extra into super” lever, before tax." : "Caps are used.") + '</small><button type="button" class="link-btn" data-rt-go="super">Super →</button></div>' +
    '<div><span>Savings goals</span><b>' + go.goals.length + '</b><small>' + (go.neededMonthly ? money(go.neededMonthly) + "/mo going to goals comes out of what's saved for retirement." : "None taking from the monthly surplus.") + '</small><button type="button" class="link-btn" data-rt-go="goals">Goals →</button></div>' +
    '<div><span>Progress to the 4% number</span><b>' + (plan.progress != null ? fmtPercent0.format(Math.min(1, plan.progress)) : "—") + '</b><small>' + money(inp.split.accessible + inp.split.superValue) + ' of ' + money(plan.fiNumber) + ' (super and accessible money; your home doesn\'t count).</small></div></div>';
  return headline + sliders + check + lev + links + ages +
    '<p class="ledger-note" style="margin:8px 0 0">In today\'s dollars at a real return of ' + (Math.round(inp.realReturn * 1000) / 10) + '% (Plan → Projections sets the rates). A guide, not advice: it assumes a steady return and spending, and the 4% rule.</p>';
}
