import { state } from "../state.js";
import { retirementPlan } from "../calc/retirement.js";
import { superContributions } from "../calc/investments.js";
import { goalsOverview } from "../calc/savegoals.js";
import { currentTaxFy } from "../calc/tax.js";
import { scenarioTotals, currentScenario } from "../calc/engine.js";
import { fmtCurrency0, fmtPercent0, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { retirementOdds, ageForOdds, LIVE_TO } from "../calc/outcomes.js";
import { drawdownPlan, minDrawdownRate, AGE_PENSION_AGE, PENSION_RATES_FROM, TRANSFER_BALANCE_CAP } from "../calc/agepension.js";
import { getTaxPeople } from "../calc/tax.js";

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
  // v3.139.0 (item 173): lead with the age that holds up when returns rise and fall (9 runs in 10),
  // the steady-returns age beside it — the steady one alone promised years the odds didn't back.
  var safeAge = plan.earliest != null ? ageForOdds(inp, 0.9, { projection: state.projection }) : null;
  var inYears = function(age){ return age - inp.currentAge > 0 ? "in " + (age - inp.currentAge) + " years" : "now"; };
  var headline = plan.earliest == null
    ? '<div class="rt-head warn"><span>On these numbers, not before 75</span><b>—</b><small>Try the levers below — spending, saving or super.</small></div>'
    : safeAge != null
      ? '<div class="rt-head"><span>To be safe in 9 runs of 10, you could stop working at</span><b>' + safeAge + '</b><small>' + inYears(safeAge) + ' — spending ' + money(inp.annualExpenses) + ' a year in today\'s dollars' +
        (safeAge > plan.earliest ? '. With the same return every year it would be ' + plan.earliest + ' — markets rarely oblige.' : '.') + '</small></div>'
      : '<div class="rt-head mid"><span>With the same return every year you could stop at</span><b>' + plan.earliest + '</b><small>' + inYears(plan.earliest) + ' — but with returns that rise and fall, not 9 runs in 10 by 75. Try the levers below.</small></div>';
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
  // v3.125.0: the same plan with returns that rise and fall — how often it lasts, and the age that
  // makes it 9 in 10.
  var odds = run ? retirementOdds(plan.age, inp, { projection: state.projection }) : null;
  if(!odds) safeAge = null;
  var oddsHtml = odds ? '<div class="rt-odds ' + (odds.chance >= 0.9 ? "ok" : odds.chance >= 0.7 ? "mid" : "bad") + '"><span>With returns that rise and fall</span>' +
    '<b>' + Math.round(odds.chance * 100) + '%</b><small>of ' + odds.runs.toLocaleString("en-AU") + ' runs of stopping at ' + plan.age + ' last to ' + LIVE_TO +
    (odds.chance < 0.995 ? '; in the worst tenth the money runs out by ' + odds.worstTenthLastsTo : '') + '. ' +
    (safeAge != null ? (safeAge <= plan.age ? 'At ' + plan.age + ' the odds are already 9 in 10 or better.' : 'For 9 in 10, stop at ' + safeAge + '.') : 'Not 9 in 10 by 75 on these numbers.') + '</small></div>' : '';
  var dd = run ? drawdownHtml(plan, run) : '';
  var lev = '<div class="rt-levers"><div class="property-section-title">What changes it</div>' + plan.levers.map(function(l){
    return '<div class="rt-lever"><span>' + l.label + '</span><b>' + (l.age == null ? "—" : l.years > 0 ? l.years + " year" + (l.years === 1 ? "" : "s") + " sooner (" + l.age + ")" : "no change") + '</b></div>';
  }).join("") + '</div>';
  var sc = superContributions(currentTaxFy());
  var room = sc.reduce(function(s, r){ return s + r.room; }, 0);
  var go = goalsOverview(today, scenarioTotals(currentScenario()).netMonthly);
  var links = '<div class="rt-links">' +
    '<div><span>Super cap room this year</span><b>' + money(room) + '</b><small>' + (room > 0 ? "Concessional room left across " + sc.length + " " + (sc.length === 1 ? "person" : "people") + " — the “extra into super” lever, before tax." : "Caps are used.") + '</small><button type="button" class="link-btn" data-rt-go="super">Super →</button></div>' +
    '<div><span>Savings goals</span><b>' + go.goals.length + '</b><small>' + (go.neededMonthly ? money(go.neededMonthly) + "/mo going to goals comes out of what's saved for retirement." : "None taking from the monthly surplus.") + '</small><button type="button" class="link-btn" data-rt-go="goals">Goals →</button></div>' +
    '<div><span>Progress to the 4% number</span><b>' + (plan.progress != null ? fmtPercent0.format(Math.min(1, plan.progress)) : "—") + '</b><small>' + money(inp.split.accessible + inp.split.superValue) + ' of ' + money(plan.fiNumber) + ' (super and accessible money; your home doesn\'t count).</small></div></div>';
  return headline + sliders + check + oddsHtml + dd + lev + links + ages +
    '<p class="ledger-note" style="margin:8px 0 0">In today\'s dollars at a real return of ' + (Math.round(inp.realReturn * 1000) / 10) + '% (Plan → Projections sets the rates). A guide, not advice: the checks above assume a steady return, spending and the 4% rule; the odds draw each year\'s return around that rate, ' + (Number(state.projection.investVolatility != null ? state.projection.investVolatility : 12)) + '% up or down typically (Plan → Projections), and spend the same each year to ' + LIVE_TO + '.</p>';
}

// v3.127.0: the years after stopping — an account-based pension's minimums and the Age Pension.
export function drawdownInputs(plan, run){
  var inp = plan.inputs;
  return { retireAge: run.retireAge, preservationAge: inp.preservationAge, accessible: run.accessibleAtRetire, superBalance: run.superAtRetire,
    realReturn: inp.realReturn, annualExpenses: inp.annualExpenses, couple: getTaxPeople().length > 1,
    homeowner: (state.properties || []).some(function(p){ return p.kind === "PPOR"; }), otherAssets: inp.split.vehicleOther || 0, otherIncome: 0 };
}
function drawdownHtml(plan, run){
  var di = drawdownInputs(plan, run), d = drawdownPlan(di);
  var marks = [run.retireAge, di.preservationAge, AGE_PENSION_AGE, 70, 75, 80, 85, 90, 95].filter(function(a, i, arr){ return a >= run.retireAge && arr.indexOf(a) === i; }).sort(function(a, b){ return a - b; });
  var rows = d.rows.filter(function(r){ return marks.indexOf(r.age) !== -1; }).map(function(r){
    return '<tr' + (r.short ? ' class="rt-short"' : '') + '><th scope="row">' + r.age + '</th><td class="num">' + money(r.pot) + '</td><td class="num">' + (r.minimum ? money(r.minimum) + ' <small>(' + Math.round(minDrawdownRate(r.age) * 100) + '%)</small>' : '—') + '</td>' +
      '<td class="num">' + (r.pension ? money(r.pension) : '—') + '</td><td class="num">' + money(r.income) + (r.short ? ' <small>' + money(r.short) + ' short</small>' : '') + '</td></tr>';
  }).join("");
  var say = d.pensionFrom != null
    ? 'The Age Pension starts at ' + d.pensionFrom + ' and carries about ' + Math.round(d.pensionShare * 100) + '% of spending from ' + run.retireAge + ' to 95.'
    : 'On these numbers the assets test leaves no Age Pension — the money is enough on its own' + (d.lastsTo < 95 ? ' for a while' : '') + '.';
  var cap = run.superAtPreservation > TRANSFER_BALANCE_CAP * (di.couple ? 2 : 1)
    ? ' Super above the transfer balance cap (' + money(TRANSFER_BALANCE_CAP) + ' a person) has to stay in accumulation, where its earnings are taxed at 15%.' : '';
  return '<div class="rt-draw"><div class="property-section-title">After you stop</div>' +
    '<p class="rt-draw-say ' + (d.lastsTo >= 95 ? "ok" : "bad") + '">' + (d.lastsTo >= 95 ? 'Spending ' + money(di.annualExpenses) + ' a year lasts to 95. ' : 'The money runs short at ' + d.lastsTo + '. ') + say + '</p>' +
    '<div class="table-scroll"><table class="rp-table rt-draw-table"><thead><tr><th scope="col">Age</th><th class="num" scope="col">Super and savings</th><th class="num" scope="col">Super minimum</th><th class="num" scope="col">Age Pension</th><th class="num" scope="col">Income</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<p class="ledger-note" style="margin:6px 0 0">From ' + di.preservationAge + ' super is an account-based pension: earnings untaxed, payments tax-free, and at least the minimum paid out each year (what isn\'t needed is saved again outside super). ' +
    'The Age Pension is for ' + (di.couple ? 'a couple' : 'a single person') + (di.homeowner ? ' who own their home' : ' who rent') + ', from ' + AGE_PENSION_AGE + ', at the rates from ' + PENSION_RATES_FROM + ' held in today\'s dollars; the home isn\'t counted, everything else is, with financial assets deemed to earn the set rates.' + cap + '</p></div>';
}

// v3.129.0: Plan → Goals' line on financial independence — the 4% number and the earliest age, with
// the way to Retirement for the rest.
export function goalsFireHtml(){
  var plan = retirementPlan(retireLevers);
  if(plan.needsAge) return '<p class="ledger-note" style="margin:0">Type your age on Plan → Retirement to see when work could become optional.</p><button type="button" class="calc-hint-link" data-plan-sub-go="retirement">Retirement →</button>';
  var inp = plan.inputs;
  return '<div class="rt-links"><div><span>The 4% number</span><b>' + money(plan.fiNumber) + '</b><small>25 years of ' + money(inp.annualExpenses) + ' a year.</small></div>' +
    '<div><span>Progress</span><b>' + (plan.progress != null ? fmtPercent0.format(Math.min(1, plan.progress)) : "—") + '</b><small>Super and accessible money; your home doesn\'t count.</small></div>' +
    '<div><span>Earliest age</span><b>' + (plan.earliest != null ? plan.earliest : "—") + '</b><small>' + (plan.earliest != null ? "On these numbers." : "Not before 75 on these numbers.") + '</small><button type="button" class="calc-hint-link" data-plan-sub-go="retirement">Retirement →</button></div></div>';
}
