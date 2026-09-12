import { state, persist } from "../state.js";
import { sumField, sumByClassification, sumByAccount, safeDiv, resolveSharedAmount, nextDueDate, daysUntil, appendHistorySnapshot, lastTransactionDateFor } from "../calc/ledger.js";
import { ipExpenseItemsForClassification } from "../calc/property.js";
import { scenarioIncomeMonthly } from "../calc/tax.js";
import { scenarioTotals, computeNetWorthSeries, totalNetWorthValue, runwayMonths, actualAssetGrowthLastMonth, staleAssets, toAudAmount } from "../calc/engine.js";
import { monthlyCashFlowForecast } from "../calc/cashflow.js";
import { fireSettings, fireWealthSplit, simulateRetirementAt, earliestWorkableRetirementAge } from "../calc/fire.js";
import { MONTH_NAMES } from "../constants.js";
import { monthKeysBack, monthKeyLabel } from "../calc/trends.js";
import { observationDates, categorySeries, trimUntracked, contributionsVsGrowth, monthlyCashFlow, spendCoverage } from "../calc/history.js";
import { fmtCurrency0, fmtPercent1, fmtRunway, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { showToast, showUndoToast } from "../lib/toast.js";
import { renderLineChart } from "../lib/charts.js";
import { staleAssetNamesList } from "../lib/notifications.js";

export function renderCards(){
  var el = document.getElementById("cards");
  var allRates = state.scenarios.map(function(s){ return scenarioTotals(s).rate; });
  var maxAbsRate = Math.max.apply(null, allRates.map(Math.abs).concat([0.01]));
  var canDelete = state.scenarios.length > 1;

  var html = state.scenarios.map(function(scenario){
    var t = scenarioTotals(scenario);
    var isActive = state.activeScenario === scenario;
    var isBaseline = state.baselineScenario === scenario;
    return (
      '<div class="card-select" role="radio" tabindex="0" aria-checked="' + (isActive ? "true" : "false") + '" data-scenario="' + escapeAttr(scenario) + '">' +
        '<div class="card' + (isActive ? " is-active" : "") + '">' +
          '<div class="card-top">' +
            '<span class="card-name"><span class="card-name-text">' + escapeAttr(scenario) + '</span>' + (isBaseline ? '<span class="home-baseline-badge" title="Your current, real-life situation">Current situation</span>' : "") + '</span>' +
            '<span class="card-controls">' +
              '<button type="button" class="icon-btn" data-rename="' + escapeAttr(scenario) + '" aria-label="Rename ' + escapeAttr(scenario) + '" title="Rename">✎</button>' +
              (canDelete && !isBaseline ? '<button type="button" class="icon-btn icon-del" data-delete="' + escapeAttr(scenario) + '" aria-label="Delete ' + escapeAttr(scenario) + '" title="Delete">✕</button>' : "") +
              '<span class="card-radio"></span>' +
            '</span>' +
          '</div>' +
          '<div>' +
            '<div class="card-savings' + (t.netMonthly < 0 ? " neg" : "") + '">' + fmtCurrency0.format(t.netMonthly) + '<span style="font-size:13px;font-weight:400;color:var(--ink-soft)"> /mo</span></div>' +
            '<div class="card-sub">' + fmtCurrency0.format(t.netYearly) + ' / year net savings</div>' +
          '</div>' +
          '<div class="card-bar-track"><div class="card-bar-fill' + (t.rate < 0 ? " neg" : "") + '" style="width:' + Math.min(100, Math.abs(t.rate) / maxAbsRate * 100) + '%"></div></div>' +
          '<div class="card-stats"><span>Savings rate</span><b>' + fmtPercent1.format(t.rate) + '</b></div>' +
          '<div class="card-stats"><span>Home cost / mo</span><b>' + fmtCurrency0.format(t.homeMonthly) + '</b></div>' +
          '<button type="button" class="card-edit-link" data-edit-scenario="' + escapeAttr(scenario) + '">Edit rent/home loan, purchase &amp; invest options →</button>' +
        '</div>' +
      '</div>'
    );
  }).join("") +
  '<button type="button" class="add-card" id="addScenarioBtn"><span class="add-plus">+</span><span class="add-label">Add scenario</span></button>';

  el.innerHTML = html;
  renderDashboardStats();
}

export function renderDashboardStats(){
  var el = document.getElementById("dashboardStats");
  if(!el || el.closest(".app-page").hidden) return;
  var isComparing = state.scenarios.length > 1;
  var introEl = document.getElementById("dashboardIntro");
  if(introEl) introEl.textContent = isComparing
    ? 'Compare renting against buying, scenario by scenario — keep any investment property in the mix across every option. Nothing here is pre-filled; add your own numbers or click "Sample data" above to try it out first.'
    : 'Your household finances at a glance. Nothing here is pre-filled; add your own numbers or click "Sample data" above to try it out first — or add another scenario on the Scenarios tab if you want to compare renting against buying.';
  var totalNetWorth = totalNetWorthValue();
  var itemCount = state.assets.length + state.properties.length;
  var active = state.activeScenario;
  var t = scenarioTotals(active);
  var horizon = Math.max(1, Number(state.projection.horizonYears) || 1);
  var series = computeNetWorthSeries(active, horizon);
  var projected = series[series.length - 1].y;
  var lastTile = isComparing
    ? '<div class="stat-tile"><span>Scenarios compared</span><b>' + state.scenarios.length + '</b><small>' + state.scenarios.map(escapeAttr).join(", ") + '</small></div>'
    : '<div class="stat-tile"><span>Scenario</span><b>' + escapeAttr(active) + '</b><small>add another on the Scenarios tab to compare options</small></div>';
  var runway = runwayMonths(t.expensesMonthly);
  var runwayTile = '<div class="stat-tile" title="Liquid assets (cash + shares + property offset) ÷ ' + escapeAttr(active) + '\'s monthly expenses — how long you could cover costs with zero income. A common rule of thumb targets 3-6 months."><span>Runway</span><b>' +
    (runway == null ? "—" : fmtRunway.format(runway) + " mo") + '</b><small>liquid assets ÷ monthly expenses</small></div>';
  el.innerHTML =
    '<div class="stat-tile"><span>Total net worth today</span><b>' + fmtCurrency0.format(totalNetWorth) + '</b><small>across ' + itemCount + ' item' + (itemCount === 1 ? "" : "s") + '</small></div>' +
    '<div class="stat-tile"><span>' + escapeAttr(active) + ' — net savings</span><b' + (t.netMonthly < 0 ? ' style="color:var(--bad)"' : '') + '>' + fmtCurrency0.format(t.netMonthly) + '/mo</b><small>' + fmtPercent1.format(t.rate) + ' savings rate</small></div>' +
    '<div class="stat-tile"><span>Projected net worth</span><b>' + fmtCurrency0.format(projected) + '</b><small>in ' + horizon + ' years, ' + escapeAttr(active) + ', ' + (state.projection.realTerms !== false ? "today's" : "future") + ' dollars</small></div>' +
    runwayTile +
    lastTile;
  renderStaleAssetsBanner();
  renderActualVsExpectedPanel(active, t);
  renderUpcomingBillsPanel();
  renderCashFlowForecastPanel();
  renderProjectionAccuracyPanel();
  renderMonthlyCashFlow();
  renderContributionsGrowth();
}

// Every other total on this page (scenarioTotals, the cards above) smooths every item — Weekly
// through Yearly alike — into one flat monthly-equivalent average. That hides real shape: a
// Yearly bonus or house-insurance bill doesn't actually land evenly across the year, it lands
// once, in one month. This instead places every less-than-monthly item (Quarterly, Half-yearly,
// Yearly) in the actual month it's due
// (calc/cashflow.js) so a month that's genuinely going to run tight — or genuinely has room to
// save more — shows up as such, rather than being averaged away.
function renderCashFlowForecastPanel(){
  var panel = document.getElementById("cashFlowForecastPanel");
  if(!panel) return;
  if(!state.income.length && !state.shared.length){
    panel.innerHTML = '<h3>12-month cash flow forecast</h3><p class="fire-note">Add some income and expenses to see a month-by-month forecast here.</p>';
    return;
  }
  var forecast = monthlyCashFlowForecast(12);
  var rows = forecast.months.map(function(m){
    var label = MONTH_NAMES[m.month - 1] + " " + m.year;
    var note = m.items.length
      ? m.items.map(function(it){ return escapeAttr(it.what) + " " + (it.side === "income" ? "+" : "−") + fmtCurrency0.format(it.amount); }).join(", ")
      : "steady month — no one-off items";
    var color = m.net < -0.5 ? "var(--bad)" : (m.net > 0.5 ? "var(--good)" : "");
    return '<div class="acct-row"><span class="acct-name">' + escapeAttr(label) + '</span>' +
      '<span style="font-size:11px;color:var(--ink-soft)">' + note + '</span>' +
      '<span class="acct-amt"' + (color ? ' style="color:' + color + '"' : '') + '>' + (m.net >= 0 ? "+" : "−") + fmtCurrency0.format(Math.abs(m.net)) + '</span></div>';
  }).join("");
  var reserveNote = (forecast.reserveIncome || forecast.reserveExpense)
    ? '<p class="fire-note">Includes ' + fmtCurrency0.format(Math.max(0, forecast.reserveExpense - forecast.reserveIncome)) + '/mo set aside for items marked "no fixed timing" (e.g. Extras, property maintenance) — spread evenly rather than expected on a specific date.</p>'
    : '';
  panel.innerHTML = '<h3>12-month cash flow forecast <span style="font-weight:400;color:var(--ink-soft)">— ' + escapeAttr(state.activeScenario) + '</span></h3>' +
    '<p class="fire-note" style="margin-bottom:10px">Steady baseline ' + fmtCurrency0.format(forecast.baselineNet) + '/mo, adjusted below for annual/quarterly items landing in their actual month.</p>' +
    rows + reserveNote;
}

// Shared expenses with at least one logged transaction, projected forward via nextDueDate() from
// the most recent one and sorted soonest-first — same-scenario expenses only (state.shared, not
// state.home[scenario]). Sourced from state.transactions[] (via lastTransactionDateFor()), not a
// manual field on the expense itself — see expenses.js's logExpenseTransaction()/isDueForReview().
function renderUpcomingBillsPanel(){
  var panel = document.getElementById("upcomingBillsPanel");
  if(!panel) return;
  var upcoming = state.shared
    .map(function(i){ return { what: i.what, due: nextDueDate(lastTransactionDateFor(state.transactions, i.id), i.freq), amount: i.amount, freq: i.freq }; })
    .filter(function(i){ return i.due; })
    .sort(function(a, b){ return a.due < b.due ? -1 : (a.due > b.due ? 1 : 0); });
  if(!upcoming.length){
    panel.innerHTML =
      '<h3>Upcoming bills</h3>' +
      '<p class="fire-note">Log a transaction against a shared expense (Expenses tab) to see it projected here.</p>';
    return;
  }
  var rows = upcoming.slice(0, 8).map(function(i){
    var days = daysUntil(i.due);
    var label = days < 0 ? ("overdue " + Math.abs(days) + "d") : (days === 0 ? "today" : "in " + days + "d");
    var cls = days < 0 ? "due-overdue" : (days <= 7 ? "due-soon" : "");
    return '<div class="fire-stat-row"><span>' + escapeAttr(i.what) + ' <span class="due-note ' + cls + '" style="display:inline">(' + label + ')</span></span><b>' + fmtCurrency0.format(i.amount) + '</b></div>';
  }).join("");
  panel.innerHTML = '<h3>Upcoming bills</h3>' + rows;
}

// A nudge, not an error — this app has no backend, so there's no way to push a notification
// when it's closed. This only ever surfaces on load/whenever the Dashboard re-renders.
function renderStaleAssetsBanner(){
  var el = document.getElementById("staleAssetsBanner");
  if(!el) return;
  var stale = staleAssets();
  if(!stale.length){ el.innerHTML = ""; return; }
  el.innerHTML =
    '<div class="stale-assets-note" title="Log a fresh value for each (Assets tab → Log) to keep net worth history and the Actual vs. expected panel accurate.">' +
      '<span>⏱</span> ' + escapeAttr(stale.length + " asset" + (stale.length === 1 ? "" : "s") + " haven't been logged in 30+ days — " + staleAssetNamesList(stale)) +
    '</div>';
}

// Compares real month-over-month asset growth (from logged history snapshots) against what the
// active scenario's own cash flow says should have been saved — a reality check on whether the
// plan's assumptions are holding up, not just a forward projection.
function renderActualVsExpectedPanel(scenario, t){
  var panel = document.getElementById("actualVsExpectedPanel");
  if(!panel) return;
  var expected = t.netMonthly;
  var actual = actualAssetGrowthLastMonth();
  if(!actual.hasData){
    panel.innerHTML =
      '<h3>Actual vs. expected <span style="font-weight:400;color:var(--ink-soft)">— last 30 days</span></h3>' +
      '<p class="fire-note">Log a value for at least one asset (Assets tab → Log) on two occasions ~a month apart to compare real growth against ' + escapeAttr(scenario) + '\'s expected monthly surplus.</p>';
    return;
  }
  var gap = actual.deltaSum - expected;
  var gapWord = gap >= 0 ? "ahead of" : "behind";
  panel.innerHTML =
    '<h3>Actual vs. expected <span style="font-weight:400;color:var(--ink-soft)">— last 30 days</span></h3>' +
    '<div class="fire-stat-row"><span>Actual asset growth</span><b' + (actual.deltaSum < 0 ? ' style="color:var(--bad)"' : '') + '>' + fmtCurrency0.format(actual.deltaSum) + '</b></div>' +
    '<div class="fire-stat-row"><span>' + escapeAttr(scenario) + ' expected surplus</span><b>' + fmtCurrency0.format(expected) + '/mo</b></div>' +
    '<div class="fire-stat-row"><span>Gap</span><b' + (gap < 0 ? ' style="color:var(--bad)"' : ' style="color:var(--good)"') + '>' + fmtCurrency0.format(Math.abs(gap)) + " " + gapWord + " plan</b></div>" +
    '<p class="fire-note">Based on ' + actual.trackedCount + ' asset' + (actual.trackedCount === 1 ? "" : "s") + ' with a logged value from ~30 days ago and a current one. Doesn\'t include properties (no monthly re-valuation) or assets without an old-enough snapshot — log values regularly for a fuller picture.</p>';
}

// ---------------- Rendering: 50/30/20 + accounts ----------------
export function renderDetail(){
  document.getElementById("activeLabel").textContent = state.activeScenario;
  var scenario = state.activeScenario;
  // state.shared items may carry a per-scenario override (see scenarioOverrides) — resolve
  // each to its effective amount for the active scenario before this breakdown sums them, so
  // the 50/30/20 bar and accounts list agree with what scenarioTotals()/computeNetWorthSeries()
  // actually use for this scenario.
  var sharedForScenario = state.shared.map(function(item){
    return item.scenarioOverrides && item.scenarioOverrides[scenario] != null
      ? Object.assign({}, item, { amount: resolveSharedAmount(item, scenario) })
      : item;
  });
  var combined = ipExpenseItemsForClassification().concat(sharedForScenario).concat(state.home[scenario]);
  // Scenario-resolved for the same reason the shared rows above are: this breakdown has to agree
  // with scenarioTotals()/computeNetWorthSeries() for the scenario being shown, and income can now
  // differ between them.
  var incomeMonthly = scenarioIncomeMonthly({ scenario: scenario });
  var needs = sumByClassification(combined, "Needs", "monthly");
  var wants = sumByClassification(combined, "Wants", "monthly");
  var t = scenarioTotals(scenario);
  var savings = t.netMonthly;

  var total = Math.max(incomeMonthly, needs + wants + Math.max(savings, 0), 1);
  var needsPct = needs / total, wantsPct = wants / total, savingsPct = Math.max(savings, 0) / total;

  var bar = document.getElementById("ruleBar");
  bar.innerHTML =
    '<div class="rule-seg needs" style="width:' + (needsPct*100) + '%">' + (needsPct > 0.1 ? fmtPercent1.format(safeDiv(needs,incomeMonthly)) : "") + '</div>' +
    '<div class="rule-seg wants" style="width:' + (wantsPct*100) + '%">' + (wantsPct > 0.1 ? fmtPercent1.format(safeDiv(wants,incomeMonthly)) : "") + '</div>' +
    '<div class="rule-seg savings" style="width:' + (savingsPct*100) + '%">' + (savingsPct > 0.1 ? fmtPercent1.format(safeDiv(savings,incomeMonthly)) : "") + '</div>' +
    '<div class="rule-target" style="left:50%"></div>' +
    '<div class="rule-target" style="left:80%"></div>';

  document.getElementById("ruleLegend").innerHTML =
    '<div class="rule-legend-item"><span class="rule-swatch needs"></span>Needs <b>' + fmtCurrency0.format(needs) + '</b> · target 50%</div>' +
    '<div class="rule-legend-item"><span class="rule-swatch wants"></span>Wants <b>' + fmtCurrency0.format(wants) + '</b> · target 30%</div>' +
    '<div class="rule-legend-item"><span class="rule-swatch savings"></span>Savings <b>' + fmtCurrency0.format(savings) + '</b> · target 20%</div>';

  var acctMap = sumByAccount(combined, "monthly");
  var entries = Object.keys(acctMap).map(function(k){ return [k, acctMap[k]]; }).sort(function(a,b){ return b[1]-a[1]; });
  var maxAcct = Math.max.apply(null, entries.map(function(e){ return e[1]; }).concat([1]));
  var acctList = document.getElementById("acctList");
  acctList.innerHTML = entries.length ? entries.map(function(e, i){
    return '<div class="acct-row"><span class="acct-name" title="' + e[0] + '">' + e[0] + '</span>' +
      '<span class="acct-track"><span class="acct-fill series-color-' + (i % 8) + '" style="width:' + (e[1]/maxAcct*100) + '%"></span></span>' +
      '<span class="acct-amt">' + fmtCurrency0.format(e[1]) + '</span></div>';
  }).join("") : '<p style="color:var(--ink-soft);font-size:12.5px;margin:0">No expenses yet.</p>';

  renderFireProgress(scenario, t);
}

// Financial independence, as two questions rather than one — see calc/fire.js for why.
//
// The old version of this panel reported a single "progress %" of total net worth against a 4%
// target. On real data that counted $179,806 of super (32% of the figure) and a car, and would
// have counted the family home the moment a Buy scenario was active. It answered "will the pot be
// big enough?" while staying silent on "can you reach 60 on what isn't super?", which is the
// question that actually decides whether an early retirement is possible.
function fireAgeInputsHtml(settings){
  return '<div class="fire-ages">' +
    '<label class="fire-age-field">I\'m<input type="number" min="16" max="99" step="1" id="fireCurrentAge" ' +
      'value="' + (settings.currentAge == null ? "" : settings.currentAge) + '" placeholder="--" aria-label="My age now"></label>' +
    '<label class="fire-age-field">and want to stop working at<input type="number" min="16" max="99" step="1" id="fireRetireAge" ' +
      'value="' + (settings.retireAge == null ? "" : settings.retireAge) + '" placeholder="--" aria-label="Target retirement age"></label>' +
  '</div>';
}

// A timeline, not a progress bar: the point is *when* each pot becomes usable, which a percentage
// can't show. Accumulation up to the retirement age, then the bridge years that have to come from
// non-super money, then the wall at preservation age where super unlocks.
function fireBridgeHtml(settings, run){
  var span = Math.max(1, settings.preservationAge - settings.currentAge);
  var workPct = Math.max(0, Math.min(100, ((run.retireAge - settings.currentAge) / span) * 100));
  var bridgePct = Math.max(0, 100 - workPct);
  var bridgeClass = run.bridgeSurvives ? "ok" : "short";
  return '<div class="fire-timeline">' +
      '<div class="fire-seg work" style="flex:' + workPct + ' 1 0%"><span>' + (run.retireAge - settings.currentAge) + 'y saving</span></div>' +
      (bridgePct > 0 ? '<div class="fire-seg bridge ' + bridgeClass + '" style="flex:' + bridgePct + ' 1 0%"><span>' + run.bridgeYears + 'y bridge</span></div>' : "") +
    '</div>' +
    '<div class="fire-timeline-axis">' +
      '<span>now · ' + settings.currentAge + '</span>' +
      '<span>stop · ' + run.retireAge + '</span>' +
      '<span>super unlocks · ' + settings.preservationAge + '</span>' +
    '</div>';
}

function renderFireProgress(scenario, t){
  var panel = document.getElementById("firePanel");
  if(!panel) return;
  var settings = fireSettings();
  var split = fireWealthSplit();
  var annualExpenses = (t.sharedMonthly + t.homeMonthly) * 12;
  var targetFI = annualExpenses * 25;
  var head = '<h3>Financial independence <span style="font-weight:400;color:var(--ink-soft)">— 4% rule, in today\'s dollars</span></h3>';

  // What the money can and can't do, which is true whether or not any age has been entered yet.
  var excluded = split.pporEquity + split.vehicleOther;
  var splitHtml =
    '<div class="fire-stat-row"><span>Could fund an early retirement</span><b>' + fmtCurrency0.format(split.accessible) + '</b></div>' +
    '<div class="fire-stat-row"><span>Super — locked until ' + settings.preservationAge + '</span><b>' + fmtCurrency0.format(split.superValue) + '</b></div>' +
    (excluded > 0 ? '<div class="fire-stat-row"><span>Excluded (home, vehicles)</span><b>' + fmtCurrency0.format(excluded) + '</b></div>' : "") +
    '<div class="fire-stat-row"><span>Target to sustain ' + fmtCurrency0.format(annualExpenses) + '/yr</span><b>' + fmtCurrency0.format(targetFI) + '</b></div>';

  if(settings.currentAge == null || settings.retireAge == null){
    panel.innerHTML = head + splitHtml + fireAgeInputsHtml(settings) +
      '<p class="fire-note">Add both ages to see whether you can actually reach ' + settings.preservationAge +
      ' on the money that isn\'t super. Until then this only answers whether the pot could ever be big enough — not whether you could get there.</p>';
    return;
  }

  var run = simulateRetirementAt(settings.retireAge);
  if(!run){ panel.innerHTML = head + splitHtml + fireAgeInputsHtml(settings); return; }
  var earliest = earliestWorkableRetirementAge();

  var verdict, verdictClass;
  if(run.passes){
    verdict = "Retiring at " + run.retireAge + " works on these numbers.";
    verdictClass = "ok";
  } else if(!run.bridgeSurvives){
    verdict = "Retiring at " + run.retireAge + " runs out before super unlocks.";
    verdictClass = "short";
  } else {
    verdict = "You'd reach " + settings.preservationAge + ", but the pot wouldn't sustain " + fmtCurrency0.format(annualExpenses) + "/yr.";
    verdictClass = "short";
  }
  var earliestNote = run.passes
    ? (earliest != null && earliest < run.retireAge ? " You could stop as early as " + earliest + "." : "")
    : (earliest != null ? " The earliest that works is " + earliest + "." : " No age up to 75 works on these numbers.");

  panel.innerHTML = head +
    '<p class="fire-verdict ' + verdictClass + '">' + escapeAttr(verdict) + escapeAttr(earliestNote) + '</p>' +
    fireBridgeHtml(settings, run) +
    '<div class="fire-stat-row"><span>Accessible at ' + run.retireAge + '</span><b>' + fmtCurrency0.format(run.accessibleAtRetire) + '</b></div>' +
    (run.bridgeYears > 0
      ? '<div class="fire-stat-row"><span>Needed to cover the ' + run.bridgeYears + '-year bridge</span><b>' + fmtCurrency0.format(run.bridgeNeeded) + '</b></div>'
      : "") +
    '<div class="fire-stat-row"><span>Pot at ' + settings.preservationAge + ' (accessible + super)</span><b>' + fmtCurrency0.format(run.potAtPreservation) + '</b></div>' +
    '<div class="fire-stat-row"><span>Target at 4%</span><b>' + fmtCurrency0.format(run.targetFI) + '</b></div>' +
    splitHtml +
    fireAgeInputsHtml(settings) +
    '<p class="fire-note">Today\'s dollars throughout — returns are net of inflation, so these figures compare directly with the expenses you entered. Super keeps growing through the bridge but is never drawn on before ' + settings.preservationAge + '. Excludes the home you live in: selling it means buying or renting another.</p>';
}

// Freezes today's projection for the active scenario as a fixed line to grade real net worth
// against later (see renderProjectionAccuracyPanel()). Deliberately never re-run automatically —
// comparing against a projection re-computed with today's assumptions would make every check
// trivially "on track", since a fresh projection always starts from wherever you actually are.
// Re-clicking this (labelled "Reset" once a reference exists) intentionally throws the old one
// away, undoable via the toast — use it when you've knowingly changed the plan (new job,
// refinance), not as routine maintenance, since resetting erases whatever drift you'd otherwise
// be trying to see.
export function setProjectionReference(){
  var old = state.projectionReference;
  var scenario = state.activeScenario;
  var horizon = Math.max(1, Number(state.projection.horizonYears) || 1);
  state.projectionReference = {
    date: localDateStr(),
    scenario: scenario,
    horizonYears: horizon,
    // Pinned nominal: this reference is graded against state.netWorthLog, which records real
    // logged dollars. Deflating one side and not the other would make every check drift.
    series: computeNetWorthSeries(scenario, horizon, { realTerms: false })
  };
  renderDashboardStats();
  persist();
  showUndoToast((old ? "Reference projection reset" : "Reference projection set") + " to today's " + scenario + " projection", function(){
    state.projectionReference = old;
    renderDashboardStats();
    persist();
  });
}

// A manual, roughly-monthly data point — deliberately not derived from assets/properties/debts
// history, since those get logged whenever the user happens to update each item, not necessarily
// together or on any particular cadence.
export function logNetWorthSnapshot(){
  var value = totalNetWorthValue();
  var dateStr = appendHistorySnapshot(state.netWorthLog, value);
  renderDashboardStats();
  persist();
  showToast("Logged net worth " + fmtCurrency0.format(value) + " (" + dateStr + ")");
}

function yearsSinceDate(dateStr, refDateStr){
  var ms = new Date(dateStr + "T00:00:00").getTime() - new Date(refDateStr + "T00:00:00").getTime();
  return ms / (365.25 * 24 * 60 * 60 * 1000);
}

// The reference projection's own points already sit on a whole-year grid (x: 0..horizonYears,
// from computeNetWorthSeries()); actual log entries are irregularly-dated real-world snapshots,
// converted to the same "years since reference" x-axis so the two overlay on one chart.
function renderProjectionAccuracyPanel(){
  var panel = document.getElementById("projectionAccuracyPanel");
  if(!panel) return;
  var ref = state.projectionReference;
  var setBtnHtml = '<button type="button" class="btn btn-sm btn-ghost" data-set-projection-reference>' + (ref ? "Reset reference projection" : "Set reference projection") + '</button>';
  if(!ref){
    panel.innerHTML =
      '<h3>Projection accuracy</h3>' +
      '<p class="fire-note">Set a reference projection to start tracking how ' + escapeAttr(state.activeScenario) + '\'s projection holds up against reality over time. Once set, log your net worth roughly monthly ("Log net worth now" below) to build up the comparison.</p>' +
      '<div class="fire-stat-row" style="justify-content:flex-start;gap:8px">' + setBtnHtml + '</div>';
    return;
  }
  var logBtnHtml = '<button type="button" class="btn btn-sm btn-ghost" data-log-networth>Log net worth now</button>';
  var actualPoints = state.netWorthLog
    .filter(function(h){ return h.date >= ref.date; })
    .map(function(h){ return { x: yearsSinceDate(h.date, ref.date), y: h.value }; });
  var series = [
    { label: "Reference — " + ref.scenario + " (set " + ref.date + ")", colorClass: "series-color-0", points: ref.series },
    // Stepped: these are snapshots, and joining two of them with a diagonal would draw growth
    // between the months nobody logged. The reference line above it is a model, so it slopes.
    { label: "Actual net worth (logged)", colorClass: "series-color-2", points: actualPoints, stepped: true }
  ];
  panel.innerHTML =
    '<h3>Projection accuracy</h3>' +
    '<p class="fire-note">Grading against the ' + escapeAttr(ref.scenario) + ' projection frozen on ' + escapeAttr(ref.date) + '. Log your net worth roughly monthly to fill in the actual line.</p>' +
    '<div id="projAccuracyChartHost"></div>' +
    '<div class="fire-stat-row" style="justify-content:flex-start;gap:8px">' + logBtnHtml + setBtnHtml + '</div>';
  renderLineChart(document.getElementById("projAccuracyChartHost"), series, {
    height: 220,
    yFormat: function(v){ return fmtCurrency0.format(v); },
    xFormat: function(v){ return "Yr " + (Math.round(v * 10) / 10); },
    ariaLabel: "Projection accuracy: reference projection vs actual logged net worth",
    alwaysLegend: true,
    emptyMessage: "Log your net worth at least once to see it plotted against the reference projection."
  });
}

// ---------------- Income vs spending vs saved, by month ----------------
// Everything else on this page compares one month against a plan. This compares months against
// each other, which is the only view that shows whether the plan is being kept.
//
// One axis, three series, all dollars — never a second y-scale. Spending comes from logged
// transactions, so a month nobody logged reads as a month of heroic saving; `logged` is what lets
// this panel refuse to draw that rather than flatter the user with their own missing data.
export function renderMonthlyCashFlow(){
  var panel = document.getElementById("monthlyCashFlowPanel");
  if(!panel) return;
  var months = monthKeysBack(6);
  var income = scenarioIncomeMonthly({ scenario: state.activeScenario });
  var rows = monthlyCashFlow(state.transactions, months, income);
  var loggedRows = rows.filter(function(r){ return r.logged; });
  if(loggedRows.length < 2){
    panel.innerHTML = '<h3>Income vs spending</h3>' +
      '<p class="fire-note">Once two different months have spending logged, this shows what came in, what went out and what was left — month by month rather than one month against a plan.</p>';
    return;
  }
  // Only months that were actually logged are drawn. A gap in the middle is left as a gap rather
  // than joined through, because a straight line across an unlogged month asserts a level of
  // spending nobody recorded.
  var maxV = loggedRows.reduce(function(m, r){ return Math.max(m, r.income, r.spent); }, 1);
  var barsHtml = rows.map(function(r){
    if(!r.logged){
      return '<div class="cf-col cf-col-empty" title="' + escapeAttr(monthKeyLabel(r.month, months[months.length - 1])) + ' — nothing logged">' +
        '<div class="cf-stack"><div class="cf-nolog">·</div></div>' +
        '<span class="cf-label">' + escapeAttr(monthKeyLabel(r.month, months[months.length - 1])) + '</span></div>';
    }
    var h = function(v){ return Math.max(2, (Math.max(0, v) / maxV) * 100); };
    return '<div class="cf-col" title="' + escapeAttr(monthKeyLabel(r.month, months[months.length - 1])) + ': in ' +
        fmtCurrency0.format(r.income) + ', out ' + fmtCurrency0.format(r.spent) + ', left ' + fmtCurrency0.format(r.saved) + '">' +
      '<div class="cf-stack">' +
        '<div class="cf-bar cf-in series-color-2" style="height:' + h(r.income) + '%"></div>' +
        '<div class="cf-bar cf-out series-color-1" style="height:' + h(r.spent) + '%"></div>' +
      '</div>' +
      '<span class="cf-label">' + escapeAttr(monthKeyLabel(r.month, months[months.length - 1])) + '</span></div>';
  }).join("");
  var avgLogged = loggedRows.reduce(function(sm, r){ return sm + r.spent; }, 0) / loggedRows.length;
  var unlogged = rows.length - loggedRows.length;
  // Logged spending is not total spending, and the gap is not small: on the reference data it was
  // $777/mo logged against a $14,613/mo budget. Subtracting the logged figure from income and
  // calling the remainder savings announced that this household kept $21,713/mo when it keeps
  // $8,339 — a confident claim, wrong by $13,000 a month. So the savings line is earned rather
  // than assumed: it appears only once logging actually covers the budget.
  var coverage = spendCoverage(avgLogged, budgetedMonthlySpend());
  var verdict = coverage.enough
    ? 'Kept <b>' + fmtCurrency0.format(income - avgLogged) + '/mo</b> on average across the ' +
      loggedRows.length + ' month' + (loggedRows.length === 1 ? "" : "s") + ' you logged.'
    : 'These are the transactions you <b>logged</b>, not everything you spent — ' +
      fmtCurrency0.format(avgLogged) + '/mo against a budget of ' + fmtCurrency0.format(coverage.budgeted) +
      '/mo (' + fmtPercent1.format(coverage.fraction) + ' of it). The month-to-month shape is real; ' +
      'the gap to income is not savings. Import a bank statement on the Expenses tab and this becomes ' +
      'a savings figure.';
  panel.innerHTML = '<h3>Income vs spending <span style="font-weight:400;color:var(--ink-soft)">— last 6 months</span></h3>' +
    '<div class="cf-chart">' + barsHtml + '</div>' +
    '<div class="rule-legend cf-legend">' +
      '<div class="rule-legend-item"><span class="rule-swatch series-color-2"></span>In <b>' + fmtCurrency0.format(income) + '/mo</b></div>' +
      '<div class="rule-legend-item"><span class="rule-swatch series-color-1"></span>Logged out <b>' + fmtCurrency0.format(avgLogged) + '/mo avg</b></div>' +
    '</div>' +
    '<p class="fire-note">' + verdict +
      (unlogged ? " " + unlogged + " month" + (unlogged === 1 ? " is" : "s are") + " left blank rather than counted as zero spending." : "") + '</p>';
}

// What the household actually plans to spend each month — the denominator the logged transactions
// are measured against. Reuses the same combined list the 50/30/20 panel builds, so "your budget"
// means one thing on this page.
function budgetedMonthlySpend(){
  var scenario = state.activeScenario;
  var sharedForScenario = state.shared.map(function(item){
    return item.scenarioOverrides && item.scenarioOverrides[scenario] != null
      ? Object.assign({}, item, { amount: resolveSharedAmount(item, scenario) })
      : item;
  });
  var combined = ipExpenseItemsForClassification().concat(sharedForScenario).concat(state.home[scenario] || []);
  return sumByClassification(combined, "Needs", "monthly") + sumByClassification(combined, "Wants", "monthly");
}

// ---------------- Contributions vs growth ----------------
// The question a net-worth line can't answer: did this rise because you saved, or because what you
// own went up? Usually the two differ by an order of magnitude, so even a loose split is worth
// having — but the split is an *inference*, not a measurement, and this panel says so rather than
// presenting it as a fact the app measured.
export function renderContributionsGrowth(){
  var panel = document.getElementById("contributionsGrowthPanel");
  if(!panel) return;
  var histories = state.assets.map(function(a){ return a.history; })
    .concat(state.properties.map(function(p){ return p.history; }))
    .concat((state.debts || []).map(function(d){ return d.history; }));
  var logged = observationDates(histories, []);
  if(logged.length < 2){
    panel.innerHTML = '<h3>Saved vs grown</h3>' +
      '<p class="fire-note">Log your assets on two different dates and this splits the change in your net worth into the part you saved and the part your assets did on their own.</p>';
    return;
  }
  var today = localDateStr();
  var records = state.assets.map(function(a){
    // In AUD, snapshots included — same reason as the allocation chart: this panel's "net worth
    // now" has to be the same number as the one in the page header, and the header converts.
    return {
      history: (a.history || []).map(function(h){ return { date: h.date, value: toAudAmount(a, h.value) }; }),
      current: toAudAmount(a, a.amount)
    };
  })
    .concat(state.properties.map(function(p){
      var loanNet = (p.loans || []).reduce(function(sum, l){
        return sum + Math.max(0, (Number(l.balance) || 0) - (Number(l.offsetBalance) || 0));
      }, 0);
      return {
        history: (p.history || []).map(function(h){ return { date: h.date, value: Math.max(0, (Number(h.value) || 0) - loanNet) }; }),
        current: Math.max(0, (Number(p.value) || 0) - loanNet)
      };
    }))
    // Debts enter as negative records, so the series this panel calls "net worth" actually is one.
    // Without them it read $17,000 above the header on the reference data, and a panel that
    // disagrees with the number directly above it teaches you to trust neither.
    .concat((state.debts || []).map(function(d){
      return {
        history: (d.history || []).map(function(h){ return { date: h.date, value: -(Number(h.value) || 0) }; }),
        current: -(Number(d.balance) || 0)
      };
    }));
  var points = trimUntracked(categorySeries(records, observationDates(histories, [today]), { today: today }));
  var split = contributionsVsGrowth(points, scenarioTotals(state.activeScenario).netMonthly);
  if(!split){
    panel.innerHTML = '<h3>Saved vs grown</h3><p class="fire-note">Not enough logged history yet.</p>';
    return;
  }
  // The window only opens once every asset you track now was already being tracked — see
  // fullCoverageFrom(). Until there are two such dates there is nothing honest to say, and saying
  // it anyway is how "I added my house to the app" gets reported as "my assets grew $360,000".
  if(split.tooShort){
    panel.innerHTML = '<h3>Saved vs grown</h3>' +
      '<p class="fire-note">You started logging some assets on ' + escapeAttr(split.coverageFrom || "a later date") +
      ', later than others (' + escapeAttr(split.earliest) + '). Comparing across that point would report ' +
      'the assets you <em>added to the app</em> as growth. Log everything once more and this splits your ' +
      'net-worth change into the part you saved and the part your assets did on their own.</p>';
    return;
  }
  var total = Math.abs(split.contributed) + Math.abs(split.growth);
  var pct = function(v){ return total > 0 ? (Math.abs(v) / total) * 100 : 0; };
  var growthNeg = split.growth < 0;
  // "Markets took $91,361" was, on the reference data, the household revaluing its own house from
  // $900k to $812k — over 0.4 months. The arithmetic was right and the word was wrong: this half
  // of the split is every price change in the portfolio, and for most people the largest of those
  // is a property valuation they typed in themselves, not a market that moved. "Revalued" names
  // what the app can actually see. The tooltip and the note below say the rest.
  var growthLabel = growthNeg ? "Assets revalued down" : "Assets grew";
  panel.innerHTML = '<h3>Saved vs grown <span style="font-weight:400;color:var(--ink-soft)">— since ' + escapeAttr(split.from) + '</span></h3>' +
    '<div class="fire-stat-row"><span>Net worth then</span><b>' + fmtCurrency0.format(split.start) + '</b></div>' +
    '<div class="fire-stat-row"><span>Net worth now</span><b>' + fmtCurrency0.format(split.end) + '</b></div>' +
    '<div class="fire-stat-row"><span>Change</span><b' + (split.totalChange < 0 ? ' style="color:var(--bad)"' : '') + '>' +
      (split.totalChange >= 0 ? "+" : "") + fmtCurrency0.format(split.totalChange) + '</b></div>' +
    '<div class="rule-bar" style="margin-top:10px">' +
      '<div class="rule-seg series-color-0" style="width:' + pct(split.contributed) + '%" title="Money you added: ' + fmtCurrency0.format(split.contributed) + '"></div>' +
      '<div class="rule-seg series-color-3" style="width:' + pct(split.growth) + '%" title="' + (growthNeg ? "Fall in what your assets are worth, your own revaluations included: " : "Rise in what your assets are worth: ") + fmtCurrency0.format(Math.abs(split.growth)) + '"></div>' +
    '</div>' +
    '<div class="rule-legend">' +
      '<div class="rule-legend-item"><span class="rule-swatch series-color-0"></span>You saved <b>' + fmtCurrency0.format(split.contributed) + '</b></div>' +
      '<div class="rule-legend-item"><span class="rule-swatch series-color-3"></span>' + growthLabel + ' <b>' + fmtCurrency0.format(Math.abs(split.growth)) + '</b></div>' +
    '</div>' +
    '<p class="fire-note">' +
      (split.droppedPoints
        ? 'Measured from ' + escapeAttr(split.from) + ', not ' + escapeAttr(split.earliest) +
          ': that is when everything you track now was already being tracked. Comparing across the ' +
          'earlier gap would count assets you added to the app as growth. '
        : "") +
      'Over ' + split.months.toFixed(1) + ' months. The saved half is this scenario\'s net savings rate — ' +
      fmtCurrency0.format(scenarioTotals(state.activeScenario).netMonthly) + '/mo — times the elapsed time; whatever the change doesn\'t account for is attributed to growth. ' +
      'That makes it a <b>remainder, not a measurement</b>: a month you underspent your budget lands in it, ' +
      'and so does any valuation you revised yourself — re-entering what your house is worth shows up here as ' +
      'the assets moving. Treat the direction as solid and the exact split as rough.</p>';
}
