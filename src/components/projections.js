import { state } from "../state.js";
import { computeNetWorthSeries, currentScenario } from "../calc/engine.js";
import { projectionBands, correlatedShockSeries, cashFlowStressSeries, combinedStressSeries } from "../calc/outcomes.js";
import { eventMarkers } from "../calc/lifeevents.js";
import { fireSettings } from "../calc/fire.js";
import { fmtCurrency0, fmtCompact, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { keepUi } from "../lib/keepui.js";

export var projectionDisplay = { scenario: "", fullTable: false };
import { renderLineChart } from "../lib/charts.js";
import { firstYearAtLeast, debtFreeYear, leadChanges, milestoneAmounts } from "../calc/milestones.js";
import { actualRatios, MIN_MONTHS } from "../calc/actuals.js";
import { fmtPercent1 } from "../lib/format.js";
import { whatIfMoved, previewSeries, whatIfName } from "../calc/whatif.js";
import { whatIfValues, whatIfStripHtml } from "./whatif.js";

// Plan or actuals (v3.52.0): the control and the sentence that says what "actuals" means right now.
export function projSourceHtml(a, source){
  var useActuals = source === "actuals" && a.available;
  var btn = function(v, label, disabled){
    var on = (v === "actuals") === useActuals;
    return '<button type="button" class="seg-option' + (on ? " active" : "") + '" data-proj-source="' + v + '" aria-pressed="' + on + '"' + (disabled ? ' disabled' : '') + ' aria-describedby="' + (v === "plan" ? "projPlanHelp" : "projActualsHelp") + '">' + label + '</button>';
  };
  var note;
  if(!a.available){
    note = "Actuals need " + MIN_MONTHS + " months of income received and spending logged" + (a.months ? " — " + a.months + " so far" : "") + ".";
  } else {
    var diff = a.incomeDeltaMonthly != null ? (a.incomeDeltaMonthly - a.spendDeltaMonthly)
      : (a.incomeReceivedMonthly - a.spendLoggedMonthly) - (a.incomePlannedMonthly - a.spendPlannedMonthly);
    // Keep the summary short; line counts live in the section’s help below.
    note = "Last " + a.months + " months: income " + fmtPercent1.format(a.incomeRatio) + " of plan, spending " + fmtPercent1.format(a.spendRatio) +
      " — " + fmtCurrency0.format(Math.abs(diff)) + "/mo " + (diff >= 0 ? "better" : "worse") + "." +
      (useActuals ? " Lines with nothing logged stay as planned." : "");
  }
  return '<div class="seg-control" role="group" aria-label="Based on">' +
      btn("plan", "Plan") +
      btn("actuals", "Actuals", !a.available) +
    '</div><span class="proj-basis-note">' + escapeAttr(note) + '</span>' +
    '<p class="ledger-note help"><span id="projPlanHelp">Plan: Every figure as planned under Cash flow.</span> <span id="projActualsHelp">Actuals: ' +
      "The plan, corrected by what's really been received and spent lately on the lines that have any logged" +
      escapeAttr(a.available ? " (" + a.incomeLines + " income and " + a.spendLines + " spending lines, plus one-offs)." : ".") + '</span></p>';
}

export var projectionStress = { enabled: false, investLossPct: 25, propertyLossPct: 12, duration: 2 };
export var cashStress = { enabled: false, lostIncomeMonthly: 0, vacancyCostMonthly: 0, maintenanceCost: 0, duration: 1 };
export function projectionStressHtml(){
  var v = projectionStress;
  return '<div class="proj-stress-controls" role="group" aria-label="Illustrative correlated downturn">' +
    '<label><input type="checkbox" data-proj-stress-enabled' + (v.enabled ? ' checked' : '') + '> Show correlated downturn</label> ' +
    '<label>Shares loss (%) <input class="field-control" type="number" min="0" max="99" step="1" data-proj-stress-invest value="' + v.investLossPct + '"></label> ' +
    '<label>Property loss (%) <input class="field-control" type="number" min="0" max="99" step="1" data-proj-stress-property value="' + v.propertyLossPct + '"></label> ' +
    '<label>Years <input class="field-control" type="number" min="1" max="10" step="1" data-proj-stress-years value="' + v.duration + '"></label>' +
    '<p class="ledger-note">Illustrative simultaneous losses, not a prediction. Monte Carlo bands assume independent annual returns.</p></div>' +
    '<div class="proj-stress-controls" role="group" aria-label="Illustrative cash flow shocks">' +
    '<label><input type="checkbox" data-proj-cash-enabled' + (cashStress.enabled ? ' checked' : '') + '> Show cash-flow shock</label> ' +
    '<label>Lost monthly income ($) <input class="field-control" type="number" min="0" step="100" data-proj-cash-income value="' + cashStress.lostIncomeMonthly + '"></label> ' +
    '<label>Monthly vacancy shortfall ($) <input class="field-control" type="number" min="0" step="100" data-proj-cash-vacancy value="' + cashStress.vacancyCostMonthly + '"></label> ' +
    '<label>One-off repairs ($) <input class="field-control" type="number" min="0" step="500" data-proj-cash-maintenance value="' + cashStress.maintenanceCost + '"></label> ' +
    '<label>Years <input class="field-control" type="number" min="1" max="10" step="1" data-proj-cash-years value="' + cashStress.duration + '"></label>' +
    '<p class="ledger-note">Estimated net cash impacts starting in year 1. Repairs are charged once; income loss and vacancy costs recur during selected years. Enable both stress scenarios to compare their combined impact. This is not a prediction or tax calculation.</p></div>' +
    '<details class="proj-stress-disclosure"><summary>How to interpret these estimates</summary>' +
    '<p class="ledger-note">These are illustrative estimates, not forecasts or guarantees. The shaded 10th–90th percentile range comes from 300 seeded simulations with independent annual investment and property returns; it does not include job loss, vacancy, repairs or correlated crashes. Stress lines are separate deterministic examples, not probabilities, and are excluded from the saved-plan ranking. Check your input dates, assumptions and cash-flow figures before relying on any comparison.</p></details>';
}
// Kept for the CSV button, which downloads exactly what's on screen.
export function scenarioComparisonSeries(series){
  return series.filter(function(s){ return !s.illustrativeStress; });
}
var lastSeries = [];
export function projectionSeriesShown(){ return lastSeries; }

function chartOpts(horizon, realTerms, band){
  return {
    height: 280,
    yFormat: function(v){ return fmtCurrency0.format(v); },
    // v3.126.0: ages, once the Retirement page knows yours.
    xFormat: function(v){ var a = fireSettings().currentAge; return a != null ? "Age " + (a + v) : "Yr " + v; },
    markers: eventMarkers(state.lifeEvents, Number(localDateStr().slice(0, 4)), horizon),
    ariaLabel: "Net worth projection by scenario, in " + (realTerms ? "today's" : "future") + " dollars",
    interactiveLegend: true,
    band: band,
    emptyMessage: "Add your income and expenses and this projects every scenario's net worth forward from what you've entered."
  };
}
function whatIfHeadline(series, horizon, realTerms){
  var plan = series[0].points[horizon] ? series[0].points[horizon].y : 0, wy = series[1].points[horizon] ? series[1].points[horizon].y : 0;
  return "In " + horizon + " " + (horizon === 1 ? "year" : "years") + ", the what-if reaches <b>" + fmtCurrency0.format(wy) + "</b>" + (realTerms ? " (today's dollars)" : " (future dollars)") + " — <b>" +
    fmtCurrency0.format(Math.abs(wy - plan)) + (wy >= plan ? " more" : " less") + "</b> than the saved plan.";
}
function whatIfSeries(w, horizon, realTerms, cache){
  var home = currentScenario(), homeIdx = Math.max(0, state.scenarios.indexOf(home));
  return [
    { label: home + " — saved plan", colorClass: "series-color-" + (homeIdx % 8), dashed: true, points: cache && cache.saved ? cache.saved : computeNetWorthSeries(home, horizon, { realTerms: realTerms, cache: cache && cache.yc }) },
    { label: "What if: " + whatIfName(w), colorClass: "series-color-" + ((homeIdx + 1) % 8), points: previewSeries(home, w, horizon, { realTerms: realTerms, cache: cache && cache.yc }) }
  ];
}
// v3.177.0 (item 204): while a slider is being dragged, only the chart and the headline redraw, and
// the saved plan and each year's income and costs (which no slider changes) are worked out once.
// The table and milestones catch up when the slider is let go (a full render).
var lastChartHost = null, dragCache = null;
export function renderWhatIfDrag(){
  var w = whatIfValues();
  if(!whatIfMoved(w) || !lastChartHost || !lastChartHost.isConnected) return renderProjectionOutputs();
  var horizon = Math.max(1, Number(state.projection.horizonYears) || 1), realTerms = state.projection.realTerms !== false;
  var key = horizon + "|" + realTerms;
  if(!dragCache || dragCache.key !== key) dragCache = { key: key, yc: {} };
  var series = whatIfSeries(w, horizon, realTerms, dragCache);
  dragCache.saved = series[0].points;
  renderLineChart(lastChartHost, series, chartOpts(horizon, realTerms, null));
  var headlineEl = document.getElementById("projHeadline");
  if(headlineEl) headlineEl.innerHTML = whatIfHeadline(series, horizon, realTerms);
}

// v3.180.1: the chart (and its range of outcomes, the slow part) only while Projections is on screen;
// otherwise it's marked stale and drawn when the page is next shown (components/nav.js).
var stale = false;
export function renderProjectionsWhenSeen(){
  var host = typeof document !== "undefined" && document.getElementById("projOutputs");
  if(!host) return;
  if(!host.offsetParent){ stale = true; return; }
  renderProjectionOutputs();
}
export function renderProjectionsIfStale(){ if(stale) renderProjectionOutputs(); }

export function renderProjectionOutputs(){
  return keepUi(renderProjectionContent);
}
function renderProjectionContent(){
  var container = document.getElementById("projOutputs");
  if(!container) return;
  stale = false;
  dragCache = null;
  var horizon = Math.max(1, Number(state.projection.horizonYears) || 1);
  var realTerms = state.projection.realTerms !== false;
  var strip = document.getElementById("whatIfStrip");
  if(strip && !strip.contains(document.activeElement)) strip.innerHTML = whatIfStripHtml();
  // v3.177.0 (item 204): with the what-if sliders moved, the chart is the household's saved plan
  // (dashed) against the what-if — and nothing else, so dragging stays quick.
  var w = whatIfValues(), whatIf = whatIfMoved(w);
  var series;
  if(whatIf) series = whatIfSeries(w, horizon, realTerms, null);
  else series = state.scenarios.map(function(scenario, idx){
    return {
      label: scenario,
      colorClass: "series-color-" + (idx % 8),
      points: computeNetWorthSeries(scenario, horizon, { realTerms: realTerms })
    };
  });

  if(!whatIf && projectionStress.enabled && state.scenarios.length){
    var active = state.scenarios.includes(state.activeScenario) ? state.activeScenario : currentScenario();
    var idx = state.scenarios.indexOf(active);
    var stressPts = correlatedShockSeries(active, horizon, {
      investLoss: -projectionStress.investLossPct / 100, propertyLoss: -projectionStress.propertyLossPct / 100,
      duration: projectionStress.duration, realTerms: realTerms
    });
    series.push({ label: active + " — correlated downturn (illustrative)", colorClass: "series-color-" + ((idx + 1) % 8), dashed: true, illustrativeStress: true, points: stressPts });
  }
  if(!whatIf && cashStress.enabled && state.scenarios.length){
    var chosen = state.scenarios.includes(state.activeScenario) ? state.activeScenario : currentScenario();
    var cashPoints = cashFlowStressSeries(chosen, horizon, {
      lostIncomeMonthly: cashStress.lostIncomeMonthly, vacancyCostMonthly: cashStress.vacancyCostMonthly,
      maintenanceCost: cashStress.maintenanceCost, duration: cashStress.duration, realTerms: realTerms
    });
    series.push({ label: chosen + " — cash-flow shock (illustrative)", colorClass: "series-color-" + ((state.scenarios.indexOf(chosen) + 2) % 8), dashed: true, illustrativeStress: true, points: cashPoints });
  }
  // Show the joint impact as well as each isolated stress, without modifying saved plans.
  if(!whatIf && projectionStress.enabled && cashStress.enabled && state.scenarios.length){
    var combinedScenario = state.scenarios.includes(state.activeScenario) ? state.activeScenario : currentScenario();
    series.push({
      label: combinedScenario + " — combined market and cash shock (illustrative)",
      colorClass: "series-color-" + ((state.scenarios.indexOf(combinedScenario) + 3) % 8),
      dashed: true,
      illustrativeStress: true,
      points: combinedStressSeries(combinedScenario, horizon, {
        investLoss: -projectionStress.investLossPct / 100,
        propertyLoss: -projectionStress.propertyLossPct / 100,
        marketDuration: projectionStress.duration,
        duration: cashStress.duration,
        lostIncomeMonthly: cashStress.lostIncomeMonthly,
        vacancyCostMonthly: cashStress.vacancyCostMonthly,
        maintenanceCost: cashStress.maintenanceCost,
        realTerms: realTerms
      })
    });
  }
  lastSeries = series;
  // v3.125.0: the range around one scenario — the one being looked at — from runs with uneven returns.
  var bandScenario = state.scenarios.indexOf(state.activeScenario) !== -1 ? state.activeScenario : currentScenario();
  var bandIdx = state.scenarios.indexOf(bandScenario);
  var bands = bandIdx !== -1 && !whatIf ? projectionBands(bandScenario, horizon, { realTerms: realTerms, projection: state.projection }) : null;
  var spread = bands && bands.hi[horizon] && bands.hi[horizon].y - bands.lo[horizon].y > 1 ? bands : null;
  // v3.158.0: the folded assumptions' summary — what the chart below is assuming, at a glance.
  var asm = document.getElementById("projAssumptionsLine");
  if(asm){
    var pr = state.projection, evs = (state.lifeEvents || []).length;
    asm.textContent = horizon + " years · " + (Number(pr.investReturnRate) || 0) + "% return · " + (Number(pr.propertyAppreciationRate) || 0) + "% property · " +
      (Number(pr.inflationRate) || 0) + "% inflation" + (Number(pr.rateShockPct) ? " · +" + pr.rateShockPct + "pp rates" : "") + (evs ? " · " + evs + " life event" + (evs === 1 ? "" : "s") : "");
  }
    var srcRow = document.getElementById("projSourceRow");
  if(srcRow) srcRow.innerHTML = projSourceHtml(actualRatios(), state.projection.source);
  var headlineEl = document.getElementById("projHeadline");
  if(headlineEl){
    // Downside overlays are not competing household plans.
    var finals = scenarioComparisonSeries(series).map(function(s){
      var pt = s.points.find(function(p){ return p.x === horizon; });
      return { label: s.label, value: pt ? pt.y : 0 };
    }).sort(function(a, b){ return b.value - a.value; });
    var yrWord = horizon === 1 ? "year" : "years";
    // Spelled out in the headline as well as on the control above it: this sentence is the one
    // line most people read, and "$6,379,600 at year 20" means two very different things
    // depending on which dollars it's in.
    var basisWord = realTerms ? " (today's dollars)" : " (future dollars)";
    if(whatIf && finals.length === 2) headlineEl.innerHTML = whatIfHeadline(series, horizon, realTerms);
    else if(finals.length > 1){
      var margin = finals[0].value - finals[1].value;
      // v3.158.0 (item 188): the same facts in fewer words.
      headlineEl.innerHTML = "In " + horizon + " " + yrWord + ", <b>" + escapeAttr(finals[0].label) + "</b> leads at <b>" +
        fmtCurrency0.format(finals[0].value) + "</b>" + basisWord + ", " + fmtCurrency0.format(margin) + " ahead of " + escapeAttr(finals[1].label) + ".";
    } else if(finals.length === 1){
      headlineEl.innerHTML = "In " + horizon + " " + yrWord + ", <b>" + escapeAttr(finals[0].label) + "</b> reaches <b>" + fmtCurrency0.format(finals[0].value) + "</b>" + basisWord + ".";
    } else {
      headlineEl.innerHTML = "";
    }
    if(spread){
      headlineEl.innerHTML += ' <span class="proj-range-line">8 in 10 runs end between <b>' +
        fmtCurrency0.format(spread.lo[horizon].y) + '</b> and <b>' + fmtCurrency0.format(spread.hi[horizon].y) + '</b> (shaded); half above ' + fmtCurrency0.format(spread.mid[horizon].y) + '.</span> <span class="help">' + spread.runs + ' runs of ' + escapeAttr(bandScenario) + ' with returns that rise and fall.</span>';
    }
  }

  // v3.34.0: the chart gets its own host. renderLineChart redraws itself when its container's width
  // changes — which it always does once, because the first render happens while the page is hidden —
  // and a redraw empties the container, so the milestone table appended beside it vanished.
  container.innerHTML = "";
  var stressPanel = document.createElement("div");
  stressPanel.innerHTML = projectionStressHtml();
  container.appendChild(stressPanel);
  var chartHost = document.createElement("div");
  container.appendChild(chartHost);
  lastChartHost = chartHost;
  renderLineChart(chartHost, series, chartOpts(horizon, realTerms, spread ? { lo: spread.lo, hi: spread.hi, colorClass: "series-color-" + (bandIdx % 8) } : null));

  var readings = document.createElement('div');
  readings.className = 'proj-readings';
  readings.innerHTML = projectionTablesHtml(series, horizon, realTerms);
  container.appendChild(readings);
  var picker = readings.querySelector('[data-proj-reading-scenario]');
  projectionDisplay.scenario = picker ? picker.value : '';

  var tools = document.createElement("div");
  tools.className = "proj-tools";
  tools.innerHTML = '<button type="button" class="btn btn-sm btn-ghost" id="projCsvBtn" aria-describedby="projCsvHelp">⇩ Download every year (CSV)</button><p class="ledger-note help" id="projCsvHelp">Every year of every scenario, with investments, property equity and loans owed — in the dollars shown above.</p>';
  container.appendChild(tools);
}

function loanWhenHtml(points){
  var free = debtFreeYear(points), horizon = points[points.length - 1].x;
  return points[0].debt > 1 ? (free == null ? '<i>after yr ' + horizon + '</i>' : 'yr ' + free) : '<i>none</i>';
}
function reachedWhenHtml(points, amount){
  var year = firstYearAtLeast(points, amount);
  return year == null ? '<i>—</i>' : year === 0 ? 'now' : 'yr ' + year;
}
export function projectionTablesHtml(series, horizon, realTerms){
  var shown = series.filter(function(s){ return s.points && s.points.length; });
  if(!shown.length) return '';
  var years = [0,5,10,15,20,horizon].filter(function(y,i,arr){ return y <= horizon && arr.indexOf(y) === i; }).sort(function(a,b){ return a-b; });
  var selected = shown.find(function(s){ return s.label === projectionDisplay.scenario; }) || shown.find(function(s){ return s.label === currentScenario(); }) || shown[0];
  var amounts = milestoneAmounts(shown.filter(function(s){ return s.points.length > 1; }));
  var yearLabel = function(year){ return year === 0 ? 'Today' : 'Year ' + year; };
  var value = function(s,year){ var point = s.points.find(function(p){ return p.x === year; }); return fmtCurrency0.format(point ? point.y : 0); };
  var fields = function(s, list){ return '<dl class="proj-reading-fields">' + list.map(function(year){ return '<div data-proj-reading-year="' + year + '"><dt>' + yearLabel(year) + '</dt><dd>' + value(s,year) + '</dd></div>'; }).join('') + '</dl>'; };
  var table = '<div class="table-scroll" role="region" aria-label="Projected net worth; scroll horizontally to compare years and scenarios" tabindex="0"><table class="milestone-table"><thead><tr><th scope="col">Scenario</th>' + years.map(function(y){ return '<th scope="col">' + yearLabel(y) + '</th>'; }).join('') + '</tr></thead><tbody>' + shown.map(function(s){
    return '<tr data-proj-table-scenario="' + escapeAttr(s.label) + '"><th scope="row"><span class="proj-swatch ' + escapeAttr(s.colorClass) + '"></span>' + escapeAttr(s.label) + (s.label === state.baselineScenario ? ' <span class="home-baseline-badge" title="Your current, real-life situation">Current situation</span>' : '') + '</th>' + years.map(function(y){ return '<td>' + value(s,y) + '</td>'; }).join('') + '</tr>';
  }).join('') + '</tbody></table></div>';
  var detailYears = years.filter(function(y){ return y !== 0 && y !== horizon; });
  var summary = '<div class="proj-mobile-reading"><label class="rp-entity"><span>Scenario</span><select class="field-control" data-proj-reading-scenario>' + shown.map(function(s){ return '<option value="' + escapeAttr(s.label) + '"' + (s === selected ? ' selected' : '') + '>' + escapeAttr(s.label) + '</option>'; }).join('') + '</select></label>' + shown.map(function(s){
    return '<section class="proj-reading-scenario" data-proj-reading="' + escapeAttr(s.label) + '"' + (s === selected ? '' : ' hidden') + '><h4>' + escapeAttr(s.label) + '</h4>' +
      (s.illustrativeStress ? '<p class="ledger-note">Illustrative stress scenario; excluded from the saved-plan ranking. See the assumptions above.</p>' : '') +
      fields(s, years.filter(function(y){ return y === 0 || y === horizon; })) + '<dl class="proj-reading-fields"><div><dt>Loans gone</dt><dd data-proj-reading-loans>' + loanWhenHtml(s.points) + '</dd></div></dl>' +
      (detailYears.length || amounts.length ? '<details class="proj-reading-details"><summary>Details and milestones</summary>' + fields(s, detailYears) +
      '<dl class="proj-reading-fields">' + amounts.map(function(amount){ return '<div data-proj-reading-target="' + amount + '"><dt>First reaches ' + fmtCompact(amount) + '</dt><dd>' + reachedWhenHtml(s.points, amount) + '</dd></div>'; }).join('') + '</dl></details>' : '') + '</section>';
  }).join('') + '</div>';
  // Milestones retains the original lead-change commentary and dollar basis in both modes.
  return '<section class="proj-table-reading" data-proj-reading-full="' + projectionDisplay.fullTable + '"><h3 class="proj-ms-title">Projected net worth <span>— ' + (realTerms ? "today's" : 'future') + ' dollars</span></h3>' +
    '<label class="proj-reading-control"><input type="checkbox" data-proj-reading-full-toggle' + (projectionDisplay.fullTable ? ' checked' : '') + '> Full table <span class="proj-reading-instruction">— scroll horizontally to compare years and scenarios</span></label>' + summary +
    '<div class="proj-full-tables">' + projectionMilestonesHtml(shown,realTerms,true) + table + '</div>' + projectionLeadChangesHtml(shown) + '</section>';
}
function projectionLeadChangesHtml(shown){
  var comparable = scenarioComparisonSeries(shown);
  var changes = leadChanges(comparable);
  var text = changes.length ? changes.map(function(c){ return '<b>' + escapeAttr(c.leader) + '</b> overtakes ' + escapeAttr(c.behind) + ' in year ' + c.year; }).join('; ') + '.'
    : (comparable.length > 1 ? 'No scenario overtakes another within the horizon — the one in front today stays in front.' : '');
  return text ? '<p class="ledger-note proj-lead-changes" style="margin:8px 0 0">' + text + '</p>' : '';
}
// What happens when, per scenario: the round numbers it reaches, when its loans are gone, and when
// one scenario overtakes another. Exported for the render-smoke test.
export function projectionMilestonesHtml(series, realTerms, omitCommentary){
  var shown = series.filter(function(s){ return s.points && s.points.length > 1; });
  if(!shown.length) return "";
  var amounts = milestoneAmounts(shown);
  var fmtShort = fmtCompact;
  var head = '<div class="proj-ms-row proj-ms-head"><span>Scenario</span>' +
    amounts.map(function(a){ return '<span>' + fmtShort(a) + '</span>'; }).join("") + '<span>Loans gone</span></div>';
  var rows = shown.map(function(s){
    return '<div class="proj-ms-row"><span class="proj-ms-name"><span class="proj-swatch ' + s.colorClass + '"></span>' + escapeAttr(s.label) + '</span>' +
      amounts.map(function(a){
        return '<span>' + reachedWhenHtml(s.points,a) + '</span>';
      }).join("") +
      '<span>' + loanWhenHtml(s.points) + '</span></div>';
  }).join("");
  return '<h3 class="proj-ms-title">Milestones <span>— first year net worth reaches each amount, ' + (realTerms ? "today's" : "future") + ' dollars</span></h3>' +
    '<div class="proj-ms-table" role="region" aria-label="Projection milestones; scroll horizontally to compare scenarios and targets" tabindex="0" style="--ms-cols:' + amounts.length + '">' + head + rows + '</div>' +
    (omitCommentary ? '' : projectionLeadChangesHtml(shown));
}

if(typeof document !== "undefined"){
  document.addEventListener("change", function(e){
    var el = e.target;
    if(!el || !el.matches || !el.matches("[data-proj-stress-enabled], [data-proj-stress-invest], [data-proj-stress-property], [data-proj-stress-years], [data-proj-cash-enabled], [data-proj-cash-income], [data-proj-cash-vacancy], [data-proj-cash-maintenance], [data-proj-cash-years]")) return;
    if(el.matches("[data-proj-stress-enabled]")) projectionStress.enabled = !!el.checked;
    else {
      var n = Number(el.value);
      if(!Number.isFinite(n)) return;
      if(el.matches("[data-proj-stress-invest]")) projectionStress.investLossPct = Math.min(99, Math.max(0, n));
      if(el.matches("[data-proj-stress-property]")) projectionStress.propertyLossPct = Math.min(99, Math.max(0, n));
      if(el.matches("[data-proj-stress-years]")) projectionStress.duration = Math.min(10, Math.max(1, Math.round(n)));
      if(el.matches("[data-proj-cash-income]")) cashStress.lostIncomeMonthly = Math.min(1e9, Math.max(0, n));
      if(el.matches("[data-proj-cash-vacancy]")) cashStress.vacancyCostMonthly = Math.min(1e9, Math.max(0, n));
      if(el.matches("[data-proj-cash-maintenance]")) cashStress.maintenanceCost = Math.min(1e9, Math.max(0, n));
      if(el.matches("[data-proj-cash-years]")) cashStress.duration = Math.min(10, Math.max(1, Math.round(n)));
    }
    renderProjectionOutputs();
  });
}
