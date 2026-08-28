import { state, persist } from "../state.js";
import { sumField, sumByClassification, sumByAccount, safeDiv, resolveSharedAmount, nextDueDate, daysUntil, appendHistorySnapshot } from "../calc/ledger.js";
import { ipExpenseItemsForClassification } from "../calc/property.js";
import { effectiveIncomeItems } from "../calc/tax.js";
import { scenarioTotals, computeNetWorthSeries, totalNetWorthValue, runwayMonths, actualAssetGrowthLastMonth, staleAssets } from "../calc/engine.js";
import { fmtCurrency0, fmtPercent1, fmtRunway } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { showToast, showUndoToast } from "../lib/toast.js";
import { renderLineChart } from "../lib/charts.js";

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
            '<span class="card-name">' + escapeAttr(scenario) + (isBaseline ? ' <span class="home-baseline-badge" title="Your current, real-life situation">Current situation</span>' : "") + '</span>' +
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
    '<div class="stat-tile"><span>Projected net worth</span><b>' + fmtCurrency0.format(projected) + '</b><small>in ' + horizon + ' years, ' + escapeAttr(active) + '</small></div>' +
    runwayTile +
    lastTile;
  renderStaleAssetsBanner();
  renderActualVsExpectedPanel(active, t);
  renderUpcomingBillsPanel();
  renderProjectionAccuracyPanel();
}

// Shared expenses with a tracked "last paid" date, projected forward via nextDueDate() and
// sorted soonest-first — same-scenario expenses only (state.shared, not state.home[scenario]),
// matching where the "Last paid" field was actually added.
function renderUpcomingBillsPanel(){
  var panel = document.getElementById("upcomingBillsPanel");
  if(!panel) return;
  var upcoming = state.shared
    .filter(function(i){ return i.lastIncurredDate; })
    .map(function(i){ return { what: i.what, due: nextDueDate(i.lastIncurredDate, i.freq), amount: i.amount, freq: i.freq }; })
    .filter(function(i){ return i.due; })
    .sort(function(a, b){ return a.due < b.due ? -1 : (a.due > b.due ? 1 : 0); });
  if(!upcoming.length){
    panel.innerHTML =
      '<h3>Upcoming bills</h3>' +
      '<p class="fire-note">Set a "Last paid" date on a shared expense (Expenses tab) to see it projected here.</p>';
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
  var names = stale.map(function(s){
    return escapeAttr(s.what) + (s.days == null ? " (never logged)" : " (" + s.days + "d ago)");
  }).join(", ");
  el.innerHTML =
    '<div class="stale-assets-note" title="Log a fresh value for each (Assets tab → Log) to keep net worth history and the Actual vs. expected panel accurate.">' +
      '<span>⏱</span> ' + stale.length + " asset" + (stale.length === 1 ? "" : "s") + " haven't been logged in 30+ days — " + names +
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
  var incomeMonthly = sumField(effectiveIncomeItems(), "monthly");
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

// Financial independence progress via the standard 4% safe-withdrawal rule: a target
// number 25x annual living costs (shared + home, excluding investment property — that's
// a separate business-like expense, usually funded by its own rent) that, if reached,
// could sustain 4%/yr withdrawals indefinitely. Reuses the same projection series as the
// main chart to estimate which year (if any) crosses that number under current assumptions.
function renderFireProgress(scenario, t){
  var panel = document.getElementById("firePanel");
  if(!panel) return;
  var annualLivingExpenses = (t.sharedMonthly + t.homeMonthly) * 12;
  var targetFI = annualLivingExpenses * 25;
  var netWorth = totalNetWorthValue();
  var progressPct = targetFI > 0 ? Math.min(100, (netWorth / targetFI) * 100) : 0;

  var horizon = Math.max(1, Number(state.projection.horizonYears) || 1);
  var series = computeNetWorthSeries(scenario, horizon);
  var hitYear = null;
  if(targetFI > 0){
    for(var i = 0; i < series.length; i++){
      if(series[i].y >= targetFI){ hitYear = series[i].x; break; }
    }
  }

  var etaText;
  if(netWorth >= targetFI && targetFI > 0) etaText = "You've already reached this number.";
  else if(hitYear != null) etaText = "Projected to reach it around Year " + hitYear + " under " + escapeAttr(scenario) + "'s current assumptions.";
  else etaText = "Not projected within " + horizon + " years under current assumptions — try adjusting the projection inputs.";

  panel.innerHTML =
    '<h3>Financial independence <span style="font-weight:400;color:var(--ink-soft)">— 4% rule</span></h3>' +
    '<div class="fire-bar-track"><div class="fire-bar-fill" style="width:' + progressPct + '%"></div></div>' +
    '<div class="fire-stat-row"><span>Progress</span><b>' + fmtPercent1.format(progressPct / 100) + '</b></div>' +
    '<div class="fire-stat-row"><span>Net worth today</span><b>' + fmtCurrency0.format(netWorth) + '</b></div>' +
    '<div class="fire-stat-row"><span>Target FI number</span><b>' + fmtCurrency0.format(targetFI) + '</b></div>' +
    '<p class="fire-note">Target = ' + escapeAttr(scenario) + '’s annual living costs (' + fmtCurrency0.format(annualLivingExpenses) + '/yr, excluding investment property) × 25 — what a 4%/yr withdrawal could sustain indefinitely. ' + etaText + '</p>';
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
    date: new Date().toISOString().slice(0, 10),
    scenario: scenario,
    horizonYears: horizon,
    series: computeNetWorthSeries(scenario, horizon)
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
    { label: "Actual net worth (logged)", colorClass: "series-color-2", points: actualPoints }
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
