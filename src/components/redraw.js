// ---------------- Drawing the app (v3.206.1, item 237) ----------------
//
// The full redraw (renderAll, the views it's made of — lib/views.js), the header's figures, the badges, the
// suggestion lists and Undo's snapshot.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order. What it shares with app.js it reaches through `app` (lib/appctx.js).
import { renderNotifBadge } from "./notifpanel.js";
import { recalcComputedItems, scenarioTotals, currentScenario, totalNetWorthValue } from "../calc/engine.js";
import { dataHealthChecks } from "../calc/health.js";
import { sumField, sumFieldForScenario } from "../calc/ledger.js";
import { effectiveIncomeItems, getTaxPeople } from "../calc/tax.js";
import { syncOn } from "../lib/foldersync.js";
import { fmtCurrency0 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { showUndoToast } from "../lib/toast.js";
import { defineView, drawViews, redrawTouched } from "../lib/views.js";
import { state, setState, persist, onCommit } from "../state.js";
import { renderSavingsGoals } from "./accountswiring.js";
import { renderActivity } from "./activity.js";
import { renderAdvice } from "./advice.js";
import { renderAssets } from "./assets.js";
import { renderBankImportHelp } from "./bank-import.js";
import { renderBenchmarks } from "./benchmarks.js";
import { renderBudgetFromHistory, renderRecurring } from "./budgettoolswiring.js";
import { renderCompare } from "./compare.js";
import { renderCards, renderDetail } from "./dashboard.js";
import { renderSharedGroups, renderTransactions, renderActualVsPlannedPanel, renderBillsCalendar, renderAccounts, renderCategories, renderBudgetGroupByToggle, budgetLineItems, renderYearBasisPreference } from "./expenses.js";
import { renderHealth } from "./health.js";
import { renderHomeSummary } from "./home.js";
import { renderIncomeGroups, renderTaxSuper, incomeHeaderTotal } from "./income.js";
import { renderMonthReview } from "./monthreview.js";
import { applyParts, renderPartsSettings } from "./parts.js";
import { renderPeriodButton } from "./period.js";
import { renderLifeEvents, syncProjBasisControl, renderRetirement } from "./planwiring.js";
import { renderProperties } from "./properties.js";
import { renderReceived } from "./received.js";
import { renderReports } from "./reports.js";
import { goalsFireHtml } from "./retirement.js";
import { renderSafekeeping } from "./safekeeping.js";
import { selectScenario, renderHomeBody } from "./scenarios.js";
import { renderTrips, renderTxReviewBanner } from "./spendingwiring.js";
import { renderPeopleTab } from "./taxwiring.js";
import { renderTaxYear } from "./taxyear.js";
import { renderTrim } from "./trim.js";

// v3.205.0 (item 236a): a full redraw draws the page on screen and what's on every page; every other page is
// marked stale and drawn when it's opened (lib/views.js — nav.js calls drawStale before showing a page). The
// data work (applying parts, recalculating derived rows) still happens here, every time, whatever's showing.
// Each view's pages were measured: its writes, run under a MutationObserver, landed in those pages.
var viewsDefined = false;
var datalist, personDatalist;

// v3.140.0: the avatar is the household's first person's initial (a dot until there is one), and its
// menu says whether backup & sync is on.
function updateAvatar(){
  var first = getTaxPeople()[0] || "";
  var el = document.getElementById("avatarInitial");
  if(el) el.textContent = first ? first.trim().charAt(0).toUpperCase() : "·";
  var sync = document.getElementById("avatarSyncState");
  if(sync) sync.textContent = syncOn() ? "on" : "off";
}
function renderTotals(){
  updateAvatar();
  // v3.138.0: in the period Income is shown in (Show as).
  var incTotal = incomeHeaderTotal(sumField(effectiveIncomeItems(), "monthly"));
  document.getElementById("totalIncomeMonthly").textContent = incTotal.value;
  document.getElementById("totalIncomeLabel").textContent = incTotal.label;
  // Totals what the list actually shows — shared plus the active scenario's housing — not just
  // state.shared, or the header disagrees with the cards beneath it by the size of your rent.
  // Scenario-resolved, matching the cards below it and every other total in the app.
  document.getElementById("totalSharedMonthly").textContent = fmtCurrency0.format(sumFieldForScenario(budgetLineItems(), currentScenario(), "monthly"));
  renderGlobalMetrics();
}
// Selecting a scenario re-renders the pages that follow it; the header follows the Current situation
// (v3.102.0), but its tooltip names the selected what-if, so it's redrawn too.
function chooseScenario(name){ selectScenario(name); renderGlobalMetrics(); }
// Sticky header figures — always visible regardless of which tab is open, so a change
// made three tabs deep is immediately reflected in the two numbers that matter most.
function renderGlobalMetrics(){
  var netWorthEl = document.getElementById("globalNetWorth");
  var cashFlowEl = document.getElementById("globalCashFlow");
  if(!netWorthEl || !cashFlowEl) return;
  netWorthEl.textContent = fmtCurrency0.format(totalNetWorthValue());
  // v3.102.0: the household as it is (Current situation), not the scenario selected for a look —
  // picking a Buy scenario on Plan used to turn this headline, on every page, into a what-if.
  var cur = currentScenario();
  var t = scenarioTotals(cur);
  // v3.80.0: what a normal month leaves — bonuses arrive in their own month, not a twelfth a month.
  var m = t.regularNetMonthly != null ? t.regularNetMonthly : t.netMonthly;
  cashFlowEl.textContent = (m >= 0 ? "+" : "") + fmtCurrency0.format(m) + "/mo";
  cashFlowEl.classList.toggle("pos", m >= 0);
  cashFlowEl.classList.toggle("neg", m < 0);
  var tip = "What a normal month leaves in " + cur + ".";
  if(t.oneOffYearly > 0.5) tip += " Plus " + fmtCurrency0.format(t.oneOffYearly) + " a year in bonuses, which land in their own month.";
  cashFlowEl.title = tip;
}
// v3.138.0: a delete that used to ask "are you sure?" first now just happens, with Undo on the
// toast — the whole state as it was, put back. `change` returns false when it did nothing.
function withUndo(message, change){
  var before = JSON.stringify(state);
  if(change() === false) return;
  persist();
  showUndoToast(message, function(){ setState(JSON.parse(before)); persist(); renderAll(); });
}
function defineViews(){
  if(viewsDefined) return;
  viewsDefined = true;
  // v3.206.0 (item 236b): every commit redraws the views that read what it touched (lib/views.js).
  onCommit(redrawTouched);
  defineView("partsSettings", ["settings"], renderPartsSettings, ["parts", "properties", "assets"]);
  defineView("txReviewBanner", null, renderTxReviewBanner, ["transactions"]);
  defineView("projectionInputs", ["plan"], function(){
    document.getElementById("projHorizon").value = state.projection.horizonYears;
    document.getElementById("projInvestRate").value = state.projection.investReturnRate;
    document.getElementById("projInvestRateRange").value = state.projection.investReturnRate;
    document.getElementById("projPropertyRate").value = state.projection.propertyAppreciationRate;
    document.getElementById("projPropertyRateRange").value = state.projection.propertyAppreciationRate;
    document.getElementById("projInflationRate").value = state.projection.inflationRate;
    document.getElementById("projInflationRateRange").value = state.projection.inflationRate;
    document.getElementById("projIncomeGrowth").value = state.projection.incomeGrowthRate;
    document.getElementById("projIncomeGrowthRange").value = state.projection.incomeGrowthRate;
    document.getElementById("projRateShock").value = state.projection.rateShockPct;
    document.getElementById("projRateShockRange").value = state.projection.rateShockPct;
    renderLifeEvents();
    document.getElementById("projInvestVol").value = state.projection.investVolatility;
    document.getElementById("projInvestVolRange").value = state.projection.investVolatility;
    document.getElementById("projPropertyVol").value = state.projection.propertyVolatility;
    document.getElementById("projPropertyVolRange").value = state.projection.propertyVolatility;
    syncProjBasisControl();
  }, ["projection", "lifeEvents"]);
  // Static copy, but rendered from the component that owns the parser it describes — see renderBankImportHelp.
  defineView("bankImportHelp", ["expenses"], renderBankImportHelp, []);
  defineView("incomeGroups", ["expenses"], renderIncomeGroups, ["income", "incomeLog", "tax", "properties", "people", "accounts"]);
  defineView("properties", ["properties", "expenses"], renderProperties, ["properties", "balances", "shared", "transactions", "accounts", "income", "tax"]);
  defineView("sharedGroups", ["expenses"], renderSharedGroups, ["shared", "transactions", "home", "categories", "categoryLooks", "properties", "accounts", "budgetGroupBy", "budgetGroupsCollapsed", "rollover", "yearBasis", "autoPayments"]);
  defineView("accounts", ["accounts"], renderAccounts, ["accounts", "balances", "assets", "debts", "properties", "transactions", "transfers", "incomeLog", "autoPayments", "savingsGoals"]);
  defineView("categories", ["settings"], renderCategories, ["categories", "categoryLooks", "shared", "transactions", "home", "properties"]);
  defineView("budgetGroupBy", ["expenses"], renderBudgetGroupByToggle, ["budgetGroupBy"]);
  defineView("yearBasis", ["settings"], renderYearBasisPreference, ["yearBasis"]);
  defineView("transactions", ["expenses"], renderTransactions, ["transactions", "transfers", "incomeLog", "shared", "home", "properties", "accounts", "txViews", "trips", "categories", "categoryLooks", "income"]);
  defineView("actualVsPlanned", ["expenses"], renderActualVsPlannedPanel, ["transactions", "shared", "home", "properties", "accounts", "income", "incomeLog", "categories"]);
  // The bills calendar is drawn by the panel above too; a transfer or an automatic payment touches only it.
  defineView("billsCalendar", ["expenses"], renderBillsCalendar, ["transfers", "autoPayments"]);
  defineView("homeBody", ["plan", "scenario", "calc"], renderHomeBody, ["scenarioChanges", "scenarios", "purchase", "invest", "home", "shared", "properties", "scenarioNotes", "income"]);
  defineView("cards", ["plan", "dashboard"], renderCards, ["*"]);
  defineView("detail", ["dashboard"], renderDetail, ["*"]);
  defineView("benchmarks", ["dashboard"], renderBenchmarks, ["*"]);
  defineView("totals", null, renderTotals, ["*"]);
  defineView("assets", ["assets", "plan"], renderAssets, ["*"]);
  defineView("personSuggestions", null, updatePersonSuggestions, ["income", "assets"]);
  defineView("accountSuggestions", null, updateAccountSuggestions, ["accounts"]);
  defineView("taxSuper", ["tax"], renderTaxSuper, ["*"]);
  defineView("taxYear", ["tax"], renderTaxYear, ["*"]);
  defineView("people", ["tax"], renderPeopleTab, ["*"]);
  defineView("received", ["expenses"], renderReceived, ["incomeLog", "income", "properties", "accounts"]);
  defineView("health", ["dashboard"], renderHealth, ["*"]);
  defineView("monthReview", ["dashboard"], renderMonthReview, ["*"]);
  defineView("notifBadge", null, renderNotifBadge, ["*"], { later: true });
  defineView("periodButton", null, renderPeriodButton, ["yearBasis"]);
  defineView("homeSummary", ["dashboard"], renderHomeSummary, ["*"]);
  defineView("reports", ["reports"], renderReports, ["*"]);
  defineView("checksBadge", null, renderChecksBadge, ["*"], { later: true });
  defineView("safekeeping", ["settings"], renderSafekeeping, ["*"]);
  defineView("activity", ["settings"], renderActivity, ["*"]);
  defineView("compare", ["plan"], renderCompare, ["*"]);
  defineView("savingsGoals", ["plan"], renderSavingsGoals, ["*"]);
  defineView("goalsFire", ["plan"], function(){ var goalsFire = document.getElementById("goalsFireBody"); if(goalsFire) goalsFire.innerHTML = goalsFireHtml(); }, ["*"]);
  defineView("advice", ["dashboard", "plan", "expenses", "tax"], renderAdvice, ["*"]);
  defineView("trim", ["expenses"], renderTrim, ["shared", "transactions", "home", "scenarioChanges", "scenarios"]);
  defineView("recurring", ["expenses"], renderRecurring, ["transactions", "shared"]);
  defineView("budgetFromHistory", ["expenses"], renderBudgetFromHistory, ["transactions", "shared"]);
  defineView("trips", ["expenses"], renderTrips, ["trips", "transactions", "shared"]);
  defineView("retirement", ["plan"], renderRetirement, ["*"]);
}
function renderAll(){
  defineViews();
  // v3.161.0 (item 191): which parts show, before anything that lists them renders.
  applyParts();
  // recalcComputedItems() rewrites the derived rows — a vehicle's declining-balance value, the
  // synthetic net-income rows — against *today*. It has always run here and the result has never
  // been persisted, so localStorage kept whatever those rows were when something was last edited:
  // on a test household's data the Income page showed $9,415.20/mo while storage still held
  // $9,612.75 for the same row, and a vehicle a few days stale. The screen was right and the
  // stored copy was behind it. Harmless day to day (it self-corrects on the next edit) but it
  // means an exported backup and the browser's own copy could disagree, which is a bad property
  // for the one file standing between this app and losing everything.
  var beforeRecalc = JSON.stringify(state.income) + JSON.stringify(state.assets);
  recalcComputedItems();
  // Only when it actually changed something: persist() on every render would write to
  // localStorage on every page switch for no reason.
  if(JSON.stringify(state.income) + JSON.stringify(state.assets) !== beforeRecalc) persist();
  drawViews();
}
// Settings carries the number of Checks that need fixing (v3.63.0), so they're seen without
// opening the tab — on the sidebar, the More tab and its Settings item.
function renderChecksBadge(){
  var n = 0;
  try { n = dataHealthChecks({}).filter(function(c){ return c.severity !== "info"; }).length; } catch(e){ n = 0; }
  document.querySelectorAll("[data-checks-badge]").forEach(function(el){
    el.hidden = !n;
    el.textContent = el.classList.contains("nav-badge-dot") ? "" : String(n);
    el.setAttribute("aria-label", n + " check" + (n === 1 ? "" : "s") + " to fix");
  });
}
// A few generic starting points, plus whatever the user has actually named in the Accounts
// card (Expenses page) — real names first since they're the ones actually meaningful to
// autocomplete against.
function updateAccountSuggestions(){
  var defaults = ["Everyday Account", "Savings Account", "Offset Account", "Credit Card"];
  var names = state.accounts.map(function(a){ return a.name; }).filter(Boolean);
  defaults.forEach(function(n){ if(names.indexOf(n) === -1) names.push(n); });
  datalist.innerHTML = names.map(function(n){ return '<option value="' + escapeAttr(n) + '">'; }).join("");
}
function updatePersonSuggestions(){
  var names = {};
  state.income.forEach(function(i){ if(i.person) names[i.person] = true; });
  state.assets.forEach(function(a){ if(a.person) names[a.person] = true; });
  personDatalist.innerHTML = Object.keys(names).map(function(n){ return '<option value="' + escapeAttr(n) + '">'; }).join("");
}

export function wireSuggestions(){
  datalist = document.createElement("datalist");
  datalist.id = "acctSuggestions";
  document.body.appendChild(datalist);
  updateAccountSuggestions();
  personDatalist = document.createElement("datalist");
  personDatalist.id = "personSuggestions";
  document.body.appendChild(personDatalist);
}

export { chooseScenario, renderAll, renderChecksBadge, renderGlobalMetrics, renderTotals, updateAccountSuggestions, updatePersonSuggestions, withUndo };
