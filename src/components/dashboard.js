import { state } from "../state.js";
import { sumField, sumByClassification, sumByAccount, safeDiv, resolveSharedAmount } from "../calc/ledger.js";
import { ipExpenseItemsForClassification } from "../calc/property.js";
import { effectiveIncomeItems } from "../calc/tax.js";
import { scenarioTotals, computeNetWorthSeries, totalNetWorthValue } from "../calc/engine.js";
import { fmtCurrency0, fmtPercent1 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

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
          '<button type="button" class="card-edit-link" data-edit-scenario="' + escapeAttr(scenario) + '">Edit rent/home loan &amp; purchase calculator →</button>' +
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
  el.innerHTML =
    '<div class="stat-tile"><span>Total net worth today</span><b>' + fmtCurrency0.format(totalNetWorth) + '</b><small>across ' + itemCount + ' item' + (itemCount === 1 ? "" : "s") + '</small></div>' +
    '<div class="stat-tile"><span>' + escapeAttr(active) + ' — net savings</span><b' + (t.netMonthly < 0 ? ' style="color:var(--bad)"' : '') + '>' + fmtCurrency0.format(t.netMonthly) + '/mo</b><small>' + fmtPercent1.format(t.rate) + ' savings rate</small></div>' +
    '<div class="stat-tile"><span>Projected net worth</span><b>' + fmtCurrency0.format(projected) + '</b><small>in ' + horizon + ' years, ' + escapeAttr(active) + '</small></div>' +
    lastTile;
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
  acctList.innerHTML = entries.length ? entries.map(function(e){
    return '<div class="acct-row"><span class="acct-name" title="' + e[0] + '">' + e[0] + '</span>' +
      '<span class="acct-track"><span class="acct-fill" style="width:' + (e[1]/maxAcct*100) + '%"></span></span>' +
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
