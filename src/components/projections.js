import { state } from "../state.js";
import { computeNetWorthSeries, currentScenario } from "../calc/engine.js";
import { projectionBands } from "../calc/outcomes.js";
import { eventMarkers } from "../calc/lifeevents.js";
import { fireSettings } from "../calc/fire.js";
import { fmtCurrency0, fmtCompact, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { renderLineChart } from "../lib/charts.js";
import { firstYearAtLeast, debtFreeYear, leadChanges, milestoneAmounts } from "../calc/milestones.js";
import { actualRatios, MIN_MONTHS } from "../calc/actuals.js";
import { fmtPercent1 } from "../lib/format.js";
import { whatIfMoved, previewSeries, whatIfName } from "../calc/whatif.js";
import { whatIfValues, whatIfStripHtml } from "./whatif.js";

// Plan or actuals (v3.52.0): the control and the sentence that says what "actuals" means right now.
export function projSourceHtml(a, source){
  var useActuals = source === "actuals" && a.available;
  var btn = function(v, label, title, disabled){
    var on = (v === "actuals") === useActuals;
    return '<button type="button" class="seg-option' + (on ? " active" : "") + '" data-proj-source="' + v + '" aria-pressed="' + on + '"' + (disabled ? ' disabled' : '') + ' title="' + escapeAttr(title) + '">' + label + '</button>';
  };
  var note;
  if(!a.available){
    note = "Actuals need " + MIN_MONTHS + " months of income received and spending logged" + (a.months ? " — " + a.months + " so far" : "") + ".";
  } else {
    var diff = a.incomeDeltaMonthly != null ? (a.incomeDeltaMonthly - a.spendDeltaMonthly)
      : (a.incomeReceivedMonthly - a.spendLoggedMonthly) - (a.incomePlannedMonthly - a.spendPlannedMonthly);
    // v3.158.0 (item 188): shorter; the line counts moved to the Actuals button's tooltip.
    note = "Last " + a.months + " months: income " + fmtPercent1.format(a.incomeRatio) + " of plan, spending " + fmtPercent1.format(a.spendRatio) +
      " — " + fmtCurrency0.format(Math.abs(diff)) + "/mo " + (diff >= 0 ? "better" : "worse") + "." +
      (useActuals ? " Lines with nothing logged stay as planned." : "");
  }
  return '<div class="seg-control" role="group" aria-label="Based on">' +
      btn("plan", "Plan", "Every figure as planned under Cash flow.") +
      btn("actuals", "Actuals", "The plan, corrected by what's really been received and spent lately on the lines that have any logged" + (a.available ? " (" + a.incomeLines + " income and " + a.spendLines + " spending lines, plus one-offs)." : "."), !a.available) +
    '</div><span class="proj-basis-note">' + escapeAttr(note) + '</span>';
}

// Kept for the CSV button, which downloads exactly what's on screen.
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

export function renderProjectionOutputs(){
  var container = document.getElementById("projOutputs");
  if(!container) return;
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
    var finals = series.map(function(s){
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
      headlineEl.innerHTML += ' <span class="proj-range-line" title="' + spread.runs + ' runs of ' + escapeAttr(bandScenario) + ' with returns that rise and fall">8 in 10 runs end between <b>' +
        fmtCurrency0.format(spread.lo[horizon].y) + '</b> and <b>' + fmtCurrency0.format(spread.hi[horizon].y) + '</b> (shaded); half above ' + fmtCurrency0.format(spread.mid[horizon].y) + '.</span>';
    }
  }

  // v3.34.0: the chart gets its own host. renderLineChart redraws itself when its container's width
  // changes — which it always does once, because the first render happens while the page is hidden —
  // and a redraw empties the container, so the milestone table appended beside it vanished.
  container.innerHTML = "";
  var chartHost = document.createElement("div");
  container.appendChild(chartHost);
  lastChartHost = chartHost;
  renderLineChart(chartHost, series, chartOpts(horizon, realTerms, spread ? { lo: spread.lo, hi: spread.hi, colorClass: "series-color-" + (bandIdx % 8) } : null));

  var milestones = [0, 5, 10, 15, 20, horizon].filter(function(y, i, arr){ return y <= horizon && arr.indexOf(y) === i; }).sort(function(a,b){return a-b;});
  var table = document.createElement("table");
  table.className = "milestone-table";
  var headRow = "<tr><th>Scenario</th>" + milestones.map(function(y){ return "<th>" + (y === 0 ? "Today" : "Year " + y) + "</th>"; }).join("") + "</tr>";
  var bodyRows = series.map(function(s){
    var cells = milestones.map(function(y){
      var pt = s.points.find(function(p){ return p.x === y; });
      return "<td>" + fmtCurrency0.format(pt ? pt.y : 0) + "</td>";
    }).join("");
    var isBaseline = s.label === state.baselineScenario;
    return "<tr><td><span class=\"proj-swatch " + s.colorClass + "\"></span>" + escapeAttr(s.label) +
      (isBaseline ? ' <span class="home-baseline-badge" title="Your current, real-life situation">Current situation</span>' : "") +
      "</td>" + cells + "</tr>";
  }).join("");
  table.innerHTML = "<thead>" + headRow + "</thead><tbody>" + bodyRows + "</tbody>";
  // Every other wide table in the app (Loans, ledger tables, Assets' worth-table) gets wrapped in
  // .table-scroll for a bounded horizontal scroll, a mobile edge-fade + sticky first column, and
  // a scroll-position-aware fade on wider viewports (see lib/scroll-shadow.js) — this table was
  // appended bare with none of that, so on mobile its later milestone columns (Year 15, Year 20 —
  // exactly the numbers this whole page exists to show) were clipped with no indication there was
  // more to scroll to, or in some cases forced the whole page to scroll sideways instead.
  var scrollWrap = document.createElement("div");
  scrollWrap.className = "table-scroll";
  scrollWrap.style.marginTop = "16px";
  scrollWrap.appendChild(table);
  container.appendChild(scrollWrap);

  var ms = document.createElement("div");
  ms.className = "proj-milestones";
  ms.innerHTML = projectionMilestonesHtml(series, realTerms);
  container.insertBefore(ms, scrollWrap);

  var tools = document.createElement("div");
  tools.className = "proj-tools";
  tools.innerHTML = '<button type="button" class="btn btn-sm btn-ghost" id="projCsvBtn" title="Every year of every scenario, with investments, property equity and loans owed — in the dollars shown above">⇩ Download every year (CSV)</button>';
  container.appendChild(tools);
}

// What happens when, per scenario: the round numbers it reaches, when its loans are gone, and when
// one scenario overtakes another. Exported for the render-smoke test.
export function projectionMilestonesHtml(series, realTerms){
  var shown = series.filter(function(s){ return s.points && s.points.length > 1; });
  if(!shown.length) return "";
  var amounts = milestoneAmounts(shown);
  var fmtShort = fmtCompact;
  var head = '<div class="proj-ms-row proj-ms-head"><span>Scenario</span>' +
    amounts.map(function(a){ return '<span>' + fmtShort(a) + '</span>'; }).join("") + '<span>Loans gone</span></div>';
  var rows = shown.map(function(s){
    var debtFree = debtFreeYear(s.points);
    var hasDebt = s.points[0].debt > 1;
    return '<div class="proj-ms-row"><span class="proj-ms-name"><span class="proj-swatch ' + s.colorClass + '"></span>' + escapeAttr(s.label) + '</span>' +
      amounts.map(function(a){
        var y = firstYearAtLeast(s.points, a);
        return '<span>' + (y == null ? '<i>—</i>' : (y === 0 ? "now" : "yr " + y)) + '</span>';
      }).join("") +
      '<span>' + (!hasDebt ? '<i>none</i>' : (debtFree == null ? '<i>after yr ' + s.points[s.points.length - 1].x + '</i>' : "yr " + debtFree)) + '</span></div>';
  }).join("");
  var changes = leadChanges(shown);
  var changeText = changes.length
    ? changes.map(function(c){ return '<b>' + escapeAttr(c.leader) + '</b> overtakes ' + escapeAttr(c.behind) + ' in year ' + c.year; }).join("; ") + "."
    : (shown.length > 1 ? "No scenario overtakes another within the horizon — the one in front today stays in front." : "");
  return '<h3 class="proj-ms-title">Milestones <span>— first year net worth reaches each amount, ' + (realTerms ? "today's" : "future") + ' dollars</span></h3>' +
    '<div class="proj-ms-table" style="--ms-cols:' + amounts.length + '">' + head + rows + '</div>' +
    (changeText ? '<p class="ledger-note" style="margin:8px 0 0">' + changeText + '</p>' : '');
}
