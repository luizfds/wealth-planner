import { state } from "../state.js";
import { computeNetWorthSeries } from "../calc/engine.js";
import { fmtCurrency0 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { renderLineChart } from "../lib/charts.js";

export function renderProjectionOutputs(){
  var container = document.getElementById("projOutputs");
  if(!container) return;
  var horizon = Math.max(1, Number(state.projection.horizonYears) || 1);
  var series = state.scenarios.map(function(scenario, idx){
    return {
      label: scenario,
      colorClass: "series-color-" + (idx % 8),
      points: computeNetWorthSeries(scenario, horizon)
    };
  });

  var headlineEl = document.getElementById("projHeadline");
  if(headlineEl){
    var finals = series.map(function(s){
      var pt = s.points.find(function(p){ return p.x === horizon; });
      return { label: s.label, value: pt ? pt.y : 0 };
    }).sort(function(a, b){ return b.value - a.value; });
    var yrWord = horizon === 1 ? "year" : "years";
    if(finals.length > 1){
      var margin = finals[0].value - finals[1].value;
      headlineEl.innerHTML = "In " + horizon + " " + yrWord + ", <b>" + escapeAttr(finals[0].label) + "</b> comes out ahead at <b>" +
        fmtCurrency0.format(finals[0].value) + "</b> — " + fmtCurrency0.format(margin) + " more than " + escapeAttr(finals[1].label) + ".";
    } else if(finals.length === 1){
      headlineEl.innerHTML = "In " + horizon + " " + yrWord + ", <b>" + escapeAttr(finals[0].label) + "</b> reaches <b>" + fmtCurrency0.format(finals[0].value) + "</b>.";
    } else {
      headlineEl.innerHTML = "";
    }
  }

  renderLineChart(container, series, {
    height: 280,
    yFormat: function(v){ return fmtCurrency0.format(v); },
    xFormat: function(v){ return "Yr " + v; },
    ariaLabel: "Net worth projection by scenario",
    interactiveLegend: true
  });

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
}
