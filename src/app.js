// v3.202.0 (item 233): first, so it is listening before any other module runs.
import { state, storageAvailable, persist, setStatus } from "./state.js";
import { localDateStr } from "./lib/format.js";
import { showToast } from "./lib/toast.js";
import { initHelp, setShowHelp, showHelpPreference } from "./lib/help.js";
import { initTableScrollShadows } from "./lib/scroll-shadow.js";
import { setDeductionPeopleProvider, setDeductionPropertiesProvider, setRentLinesProvider } from "./lib/ledger-table.js";
import { getTaxPeople, setDeductibleItemsProvider } from "./calc/tax.js";
import { currentScenario } from "./calc/engine.js";
import { setAccountOfProvider } from "./calc/accounts.js";
import { renderHealth } from "./components/health.js";
import { renderMonthReview } from "./components/monthreview.js";
import { RENT_EXPENSE_LINES, rentLineFor } from "./calc/taxyear.js";
import { budgetLineItems, transactionAccount } from "./components/expenses.js";
import { wireScenarioEditor } from "./components/scenariowiring.js";
import { netWorthOn } from "./calc/nwhistory.js";
import { backfillNetWorth } from "./calc/nwauto.js";
import { detailTarget } from "./components/detail.js";
import { showPage, parseRouteFromLocation, showAssetsSubpage, showDashboardSubpage, showExpensesSubpage, showAccountsSubpage, showTaxSubpage, showPlanSubpage, taxSubpage, setOverlayCleanup, PAGE_KEY } from "./components/nav.js";
import { wireLedgerEdits, wireRowEditors, wireMoreRowEditors, wireAddButtons } from "./components/rows.js";
import { wireSuggestions, renderGlobalMetrics, withUndo, renderAll } from "./components/redraw.js";
import { wirePhoneSheets, wireOverflowMenus } from "./components/overlays.js";
import { wireCalculators } from "./components/calcwiring.js";
import { wireProjections, wireProjectionCsv, wireWhatIfs, wireRetirement } from "./components/planwiring.js";
import { wireTax, renderPeopleTab } from "./components/taxwiring.js";
import { wireAssets, wireAssetPersonSheet, wireFxRate, wirePrices, wireMarket, wireTrades } from "./components/assetswiring.js";
import { wireProperties, wirePropertyExtras } from "./components/propertieswiring.js";
import { wireOverrides, wireCashflowSheets, wireBillsCalendar, wireForecast, wireAutoPay } from "./components/cashflowwiring.js";
import { wireSearch } from "./components/searchwiring.js";
import { wireSpending, wireTrips, wireReviewQueue, wireReceipts } from "./components/spendingwiring.js";
import { wireAccounts, wireGoals, renderGoalsTab } from "./components/accountswiring.js";
import { wirePayslip, wireImports } from "./components/importwiring.js";
import { wireSettings, wireActivity, wireErrorLog, renderSettingsTab } from "./components/settingswiring.js";
import { wireCards, wireMonthReview, wireBenchmarks, wireHomeArrange, wireHomeSummary } from "./components/homewiring.js";
import { wireData, wireFirstRun, buildDemoState } from "./components/datawiring.js";
import { wireNavigation, wireSubpages, wirePullToRefresh, wirePeriod, wireShortcuts } from "./components/chromewiring.js";
import { wireAdvice, wireBudgetHistory } from "./components/budgettoolswiring.js";
import { wireSafekeeping, keepNetWorthHistory } from "./components/safekeepingwiring.js";
import { wireReports } from "./components/reportswiring.js";
import { wireNotifications } from "./components/notifpanel.js";
import { wireUpdates } from "./components/updates.js";
import { registerApp, defineVar } from "./lib/appctx.js";

(function(){
  "use strict";
  // What the page modules reach in app.js, through `app` (lib/appctx.js) — before any listener can fire.
  registerApp({ applyTheme, getThemePref, pushActiveOverlay, requestCloseActiveOverlay });
  defineVar("THEME_KEY", function(){ return THEME_KEY; }, function(x){ THEME_KEY = x; });
  defineVar("THEME_MODES", function(){ return THEME_MODES; }, function(x){ THEME_MODES = x; });
  defineVar("activeOverlayClose", function(){ return activeOverlayClose; }, function(x){ activeOverlayClose = x; });
  defineVar("afterScenarioChange", function(){ return afterScenarioChange; }, function(x){ afterScenarioChange = x; });
  defineVar("openScenarioEditor", function(){ return openScenarioEditor; }, function(x){ openScenarioEditor = x; });
  defineVar("openStartSheet", function(){ return openStartSheet; }, function(x){ openStartSheet = x; });
  defineVar("pendingAssetsImport", function(){ return pendingAssetsImport; }, function(x){ pendingAssetsImport = x; });
  defineVar("pendingExpensesImport", function(){ return pendingExpensesImport; }, function(x){ pendingExpensesImport = x; });
  defineVar("pendingIncomeImport", function(){ return pendingIncomeImport; }, function(x){ pendingIncomeImport = x; });

  var THEME_KEY = "wealthPlanner.theme";
  var THEME_MODES = ["system", "light", "dark"];
  function applyTheme(mode){
    if(mode === "light" || mode === "dark") document.documentElement.setAttribute("data-theme", mode);
    else document.documentElement.removeAttribute("data-theme");
  }
  function getThemePref(){
    try{ return localStorage.getItem(THEME_KEY) || "system"; }catch(e){ return "system"; }
  }
  applyTheme(getThemePref());
  wireProjections();
  wireTax();
  wireCalculators();
  wireAssets();
  wireProperties();
  wireLedgerEdits();

  // Every Modern-mode row (Income, Expenses, Transactions, Assets, Properties, Scenarios) used to
  // expand its edit fields in place, accordion-style, within the scrolling list — closer to a web
  // form than how a mobile finance app actually handles data entry (tap +, a focused sheet takes
  // over with the cursor already in the first field). Since every one of these rows already
  // funnels through this one shared toggle mechanism, turning `.open` into a real modal (see
  // `.m-row.open` in ledger.css — position:fixed, centered, backed by the single shared
  // #mRowBackdrop) fixes all of them at once, without touching any page's own field-building or
  // state-mutation code — only where that same already-correct content visually renders.
  //
  // ---------------- Overlay history integration ----------------
  // Any full-page-feeling overlay in this app (a row's edit modal below, cross-page search,
  // expense review) pushes exactly one history entry for as long as it's open, and every one of
  // its on-screen close affordances (tap outside, an explicit X, Escape) routes through
  // requestCloseActiveOverlay() rather than tearing itself down immediately. That makes the same
  // single entry what a device/browser back-button press naturally pops too — the popstate
  // handler below is the one place that actually runs the close callback, whichever way it was
  // triggered. Without this, opening one of these silently occupied no space in the browser's
  // back-history, so pressing back while one was open fell through to whatever the *page*
  // underneath was doing there instead — another page, or leaving the app — rather than just
  // closing the thing in front of you.
  var activeOverlayClose = null; // the pure cleanup function for whichever overlay is open, if any
  function pushActiveOverlay(onClose, replace){
    activeOverlayClose = onClose;
    try{ history[replace ? "replaceState" : "pushState"]({ overlayOpen: true }, "", location.href); }catch(e){}
  }
  function requestCloseActiveOverlay(){
    if(!activeOverlayClose) return;
    history.back();
  }
  wirePhoneSheets();

  // Two providers registered once at startup, both for the same reason: calc/ and lib/ can't import
  // a component, but the data they need (which budget lines exist, who the tax people are) is
  // assembled by one. See setDeductibleItemsProvider's own comment for why this beats threading the
  // list through every caller of computePersonTax.
  // v3.131.0: the household's own budget — the current scenario's — whichever what-if is being looked
  // at. A tax estimate is about the year you're actually living; it moved with the scenario picker.
  setDeductibleItemsProvider(function(){ return budgetLineItems(currentScenario()); });
  // v3.135.0: net worth rolls each account forward by what's logged against it (a line's default
  // account counts, as on the Accounts page).
  setAccountOfProvider(transactionAccount);
  setDeductionPeopleProvider(getTaxPeople);
  setDeductionPropertiesProvider(function(){ return state.properties.filter(function(p){ return p.kind === "IP"; }).map(function(p){ return { id: p.id, what: p.what }; }); });
  setRentLinesProvider(function(){ return { lines: RENT_EXPENSE_LINES, lineFor: rentLineFor }; });
  setOverlayCleanup(function(){
    if(!activeOverlayClose) return;
    var closeOverlay = activeOverlayClose;
    activeOverlayClose = null;
    closeOverlay();
  });
  wireAssetPersonSheet();
  wireOverflowMenus();
  wireRowEditors();
  wireOverrides();
  wireCashflowSheets();
  wireSearch();
  wireSpending();
  wireAccounts();
  wirePayslip();
  wireSettings();
  wireMoreRowEditors();
  wireCards();
  wireAddButtons();

  // ---------------- Expenses: import from a spreadsheet ----------------
  // Parsed rows live here (not in expenses.js) between file-select and the confirm click — nothing
  // touches state.shared until expenseImportConfirmBtn, handled in the global click delegate below.
  var pendingExpensesImport = [];
  wireImports();

  // ---------------- Income: import from a spreadsheet ----------------
  var pendingIncomeImport = [];

  // ---------------- Assets: import from a spreadsheet ----------------
  var pendingAssetsImport = [];
  wireData();
  wireNavigation();
  wireMonthReview();
  wireSubpages();


  // A fresh load of a deep link (e.g. /wealth-planner/assets/shares) has no matching file
  // on GitHub Pages, so 404.html stashes the intended path and bounces here — restore it
  // before parsing the route, so a shared/bookmarked URL lands on the right page.
  try{
    var stashedPath = sessionStorage.getItem("wealthPlanner.redirectPath");
    if(stashedPath){
      sessionStorage.removeItem("wealthPlanner.redirectPath");
      history.replaceState(null, "", stashedPath);
    }
  }catch(e){}

  var routeFromUrl = parseRouteFromLocation();
  var initialPage = "dashboard";
  var initialAssetsSub = "summary";
  var initialExpensesSub = "budget";
  var initialTaxSub = null;
  var initialPlanSub = "scenarios";
  var initialSettingsSub = null;
  if(routeFromUrl){
    initialPage = routeFromUrl.page;
    if(routeFromUrl.detail){ detailTarget.kind = routeFromUrl.detail.kind; detailTarget.id = routeFromUrl.detail.id; }
    if(routeFromUrl.sub && routeFromUrl.page === "assets") initialAssetsSub = routeFromUrl.sub;
    if(routeFromUrl.sub && routeFromUrl.page === "expenses") initialExpensesSub = routeFromUrl.sub;
    if(routeFromUrl.sub && routeFromUrl.page === "tax") initialTaxSub = routeFromUrl.sub;
    if(routeFromUrl.sub && routeFromUrl.page === "plan") initialPlanSub = routeFromUrl.sub;
    if(routeFromUrl.page === "settings") initialSettingsSub = routeFromUrl.sub || "categories";
  } else {
    try{ initialPage = localStorage.getItem(PAGE_KEY) || "dashboard"; }catch(e){}
    // A page remembered from before v3.57.0 that is now a subpage.
    var legacyPage = { income: ["expenses", "income"], scenarios: ["plan", "scenarios"], projections: ["plan", "projections"] }[initialPage];
    if(legacyPage){
      initialPage = legacyPage[0];
      if(legacyPage[0] === "expenses") initialExpensesSub = legacyPage[1]; else initialPlanSub = legacyPage[1];
    }
    if(initialPage === "settings") initialSettingsSub = "categories";
  }

  window.addEventListener("popstate", function(e){
    // A back navigation while an overlay (row modal, search, expense review) was open pops the
    // history entry pushActiveOverlay() pushed for it — this is that entry landing, so just run
    // the overlay's own close callback and stop, rather than also running the page-nav logic
    // below: the URL/page never actually changed underneath it, so that logic would at best no-op
    // and at worst reset scroll position for no reason.
    if(activeOverlayClose && !(e.state && e.state.overlayOpen)){
      var closeOverlay = activeOverlayClose;
      activeOverlayClose = null;
      closeOverlay();
      return;
    }
    var route = parseRouteFromLocation() || { page: "dashboard", sub: null };
    if(route.page === "detail" && route.detail){ detailTarget.kind = route.detail.kind; detailTarget.id = route.detail.id; }
    showPage(route.page, { skipUrl: true });
    if(route.page === "assets") showAssetsSubpage(route.sub || "summary", { skipUrl: true });
    if(route.page === "expenses") showExpensesSubpage(route.sub || "budget", { skipUrl: true });
    if(route.page === "tax") showTaxSubpage(route.sub || taxSubpage(), { skipUrl: true });
    if(route.page === "plan") showPlanSubpage(route.sub || "scenarios", { skipUrl: true });
    if(route.page === "settings") showAccountsSubpage(route.sub || "categories", { skipUrl: true });
    if(route.page === "tax" && route.sub === "people") renderPeopleTab();
    if(route.page === "dashboard" && route.sub){ showDashboardSubpage(route.sub); if(route.sub === "review"){ renderMonthReview(); renderHealth(); } }
  });
  wireAdvice();

  if(!storageAvailable) setStatus(false, "Storage unavailable — export to keep changes");
  wireSuggestions();

  // Catch-all so the sticky header stays correct after ANY edit anywhere in the app,
  // not just the paths that happen to call renderTotals() already. Registered last, so
  // by the time this fires in the bubble phase every other handler for the same event
  // has already run and mutated state.
  document.addEventListener("input", renderGlobalMetrics);
  wireBenchmarks();
  wireBillsCalendar();
  wirePropertyExtras();
  wireProjectionCsv();
  wireFxRate();
  // v3.33.0: section explanations behind an ⓘ unless this device asks for them all.
  initHelp();
  var showHelpToggle = document.getElementById("showHelpToggle");
  if(showHelpToggle){
    showHelpToggle.checked = showHelpPreference();
    showHelpToggle.addEventListener("change", function(){ setShowHelp(showHelpToggle.checked); });
  }
  document.addEventListener("change", renderGlobalMetrics);
  wireSafekeeping();
  wireTrips();
  wirePrices();
  wirePullToRefresh();
  wireReviewQueue();
  // ---------------- Plan → Scenarios: changes, the question sheet, a scenario's page, Make it real ----------------
  // v3.200.0 (item 230): wired in components/scenariowiring.js, from here — the order listeners are added in is kept.
  var scenarioWiring = wireScenarioEditor({ pushActiveOverlay: pushActiveOverlay, requestCloseActiveOverlay: requestCloseActiveOverlay, withUndo: withUndo, renderAll: renderAll });
  var openStartSheet = scenarioWiring.openStartSheet, openScenarioEditor = scenarioWiring.openScenarioEditor, afterScenarioChange = scenarioWiring.afterScenarioChange;
  wireForecast();
  wireMarket();
  wireWhatIfs();
  wireActivity();
  wireReceipts();
  wireHomeArrange();
  wireFirstRun();
  wireBudgetHistory();
  wireTrades();
  wireRetirement();
  wireGoals();
  wireReports();
  wireAutoPay();
  wireErrorLog();
  wireHomeSummary();
  wirePeriod();

  // v3.139.0 (item 171): the weeks before the first automatic point, rebuilt once from what each
  // record already knows, then today's point.
  (function(){
    if(!Array.isArray(state.netWorthLog)) state.netWorthLog = [];
    var today = localDateStr();
    var added = backfillNetWorth(state.netWorthLog, function(d){ return netWorthOn(d, today); }, today, 104);
    if(keepNetWorthHistory() || added) persist();
  })();
  renderAll();
  initTableScrollShadows();
  showPage(initialPage, { replace: true, skipScroll: true });
  // v3.203.1 (item 234): the speed budget (scripts/journeys.mjs) times startup to here.
  try { performance.mark("wp:ready"); } catch(e){}
  document.documentElement.setAttribute("data-wp-ready", "");
  // The speed budget compares a step with a full redraw, in the same browser at the same speed — only with ?perf=1.
  if(/[?&]perf=1\b/.test(location.search)) window.__wpRenderAll = renderAll;
  if(initialPage === "assets") showAssetsSubpage(initialAssetsSub, { replace: true });
  // Always applied, not just when landing on Expenses: showExpensesSubpage seeds the module's
  // currentExpensesSub, which buildRoutePath needs to be correct the first time the user
  // navigates *to* Expenses from somewhere else.
  showExpensesSubpage(initialExpensesSub, { skipUrl: initialPage !== "expenses", replace: true });
  // Same seeding for Tax, whose default tab depends on the time of year (nav.js defaultTaxSub).
  showTaxSubpage(initialTaxSub || taxSubpage(), { skipUrl: initialPage !== "tax", replace: true });
  showPlanSubpage(initialPlanSub, { skipUrl: initialPage !== "plan", replace: true });
  if(initialSettingsSub){ showAccountsSubpage(initialSettingsSub, { replace: true }); renderSettingsTab(initialSettingsSub); }
  if(initialPage === "tax" && initialTaxSub === "people") renderPeopleTab();
  if(initialPage === "plan" && initialPlanSub === "goals") renderGoalsTab();
  if(initialPage === "dashboard" && routeFromUrl && routeFromUrl.sub){ showDashboardSubpage(routeFromUrl.sub); if(routeFromUrl.sub === "review"){ renderMonthReview(); renderHealth(); } }

  // onboarding.html's "Try it with sample data" link lands here with ?mock=1 — generate it
  // immediately (no confirm needed, unlike the header's own Sample data button: there's nothing
  // to lose landing here for the first time) and strip the query param via replaceState so a
  // later reload or bookmark of this URL doesn't keep re-rolling random data.
  if(new URLSearchParams(location.search).get("mock") === "1"){
    buildDemoState();
    renderAll();
    persist();
    showToast("Sample data generated");
    history.replaceState(history.state, "", location.pathname + location.hash);
  }
  wireShortcuts();

  // Matching #appLoading's inline styles in index.html — fades out only once the real UI above
  // has actually been built, not on a fixed timer, so a slow first load (cold cache, slow device)
  // keeps the loading screen up for exactly as long as it's needed and no longer.
  var appLoadingEl = document.getElementById("appLoading");
  if(appLoadingEl){
    appLoadingEl.classList.add("is-hidden");
    setTimeout(function(){ appLoadingEl.remove(); }, 300);
  }
})();

wireNotifications();
wireUpdates();
