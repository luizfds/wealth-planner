// ---------------- The app's frame, wired (v3.206.1, item 237) ----------------
//
// Navigation, the + button and its quick actions, the avatar menu, sub-tabs and swiping between them, pull to
// refresh, the period selector and keyboard shortcuts.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order. What it shares with app.js it reaches through `app` (lib/appctx.js).
import { runManualUpdateCheck } from "./updates.js";
import { cardPaymentsForMonth, usualCardSource } from "../calc/bills.js";
import { selectedYearWindow, yearStartOf, householdYearBasis, selectedMonth } from "../calc/ledger.js";
import { shiftMonth as mdShiftMonth } from "../calc/monthdetail.js";
import { app } from "../lib/appctx.js";
import { syncOn } from "../lib/foldersync.js";
import { localDateStr } from "../lib/format.js";
import { onHorizontalSwipe } from "../lib/swipe.js";
import { showToast } from "../lib/toast.js";
import { state, persist } from "../state.js";
import { readPriceSheetNow, readAutoPricesNow } from "./assetswiring.js";
import { autoPricesNeeded } from "./autoprices.js";
import { renderBenchmarks } from "./benchmarks.js";
import { transferForm } from "./cashflow.js";
import { openQuickLogSheet, openReceivedSheetFor } from "./cashflowwiring.js";
import { renderDetail, logNetWorthSnapshot } from "./dashboard.js";
import { renderSharedGroups, renderTransactions, setBudgetGroupBy, renderBudgetGroupByToggle, toggleBudgetGroup, setAllBudgetGroupsCollapsed, allBudgetGroupsCollapsed, setYearBasis } from "./expenses.js";
import { renderHealth } from "./health.js";
import { renderIncomeGroups, setIncomeShowAs } from "./income.js";
import { renderMonthReview } from "./monthreview.js";
import { showPage, closeNavMenu, showAssetsSubpage, showDashboardSubpage, showExpensesSubpage, showAccountsSubpage, QUICK_ACTIONS, quickActionsSheetHtml } from "./nav.js";
import { closeAllOverflowMenus } from "./overlays.js";
import { loadPeriod, applyPeriod, setPeriodRerender, renderPeriodMenu } from "./period.js";
import { priceSheetDue } from "./pricesheet.js";
import { renderTotals, renderAll } from "./redraw.js";
import { runSync, initialSync } from "./safekeepingwiring.js";
import { openSearchOverlay } from "./searchwiring.js";

var navMenuToggle, quickFabMore, topbar, compact, ASSETS_SUB_ORDER, EXPENSES_SUB_ORDER, periodBtn, periodMenu, GO_KEYS, goPending;

// ---------------- Quick actions menu (the fab's chevron) ----------------
function openQuickActions(){
  document.getElementById("quickFabRoot").innerHTML = quickActionsSheetHtml();
  app.pushActiveOverlay(closeQuickActions);
}
function closeQuickActions(){
  document.getElementById("quickFabRoot").innerHTML = "";
}
// Unlike the fab itself — which only ever clicks something already on screen — a quick action
// usually has to travel first: "Add shares" from the Dashboard means Assets, then the Shares
// subpage, and only then the add button. Same shape as the search-result handler above,
// including why the menu's own history entry is replaced rather than popped: we're navigating
// straight to a destination, so back should return to wherever you were before opening the
// menu, not resurrect the menu on the way.
function runQuickAction(action){
  closeQuickActions();
  app.activeOverlayClose = null;
  showPage(action.page, { replace: true });
  if(action.page === "assets" && action.sub) showAssetsSubpage(action.sub, { replace: true });
  if(action.page === "expenses" && action.sub) showExpensesSubpage(action.sub, { replace: true });
  if(action.mode === "networth"){ logNetWorthSnapshot(); return; }
  if(action.mode === "received"){ setTimeout(function(){ openReceivedSheetFor(); }, 240); return; }
  if(action.mode === "paycard"){ setTimeout(openPayCard, 240); return; }
  // Deferred for the same reason the search handler defers its scroll: showPage's render and
  // view transition have to settle before the target button exists in its final form.
  setTimeout(function(){
    var target = action.selector
      ? document.querySelector(action.selector)
      : firstVisibleAddButton(action.page);
    if(target) target.click();
  }, 240);
}
// v3.141.0 (item 180): the transfer form, filled in for the card's next repayment — the card (the
// first, if there are several), the account it's paid from (its direct debit, else an everyday
// account) and the payment the bills calendar expects, the soonest unpaid one from last month on.
function openPayCard(){
  var card = (state.accounts || []).find(function(a){ return a.type === "credit" && a.name; });
  // v3.144.0: the direct-debit account, else where its other repayments came from, else everyday.
  var from = (card && usualCardSource(card, state.accounts, state.transfers)) || ((state.accounts || []).find(function(a){ return a.type === "everyday" && a.name; }) || {}).name;
  var amount = 0, today = localDateStr();
  if(card){
    var ym = today.slice(0, 7), months = [mdShiftMonth(ym, -1), ym, mdShiftMonth(ym, 1)];
    for(var i = 0; i < months.length && !amount; i++){
      var due = cardPaymentsForMonth(state.accounts, state.transactions, state.transfers, months[i], today).find(function(p){ return p.card === card.name && (!p.paid || p.assumed) && p.amount > 0; });
      if(due) amount = due.amount;
    }
  }
  transferForm.open = true;
  transferForm.preset = { from: from || "", to: card ? card.name : "", amount: amount, what: card ? card.name + " repayment" : "" };
  renderTransactions();
  transferForm.preset = null;
  var f = document.querySelector('#transactionsTable [data-tf="amount"]');
  if(f){ f.scrollIntoView({ block: "center" }); f.focus(); }
  if(!card) showToast("No credit card yet — add one under Net worth → Accounts");
}
// Income and Assets name their add buttons after the group they belong to (a person, an asset
// category), so a quick action can't carry a fixed selector for them — it takes whichever one is
// on screen once we've navigated to the right page and subpage, exactly as updateQuickFab does.
function firstVisibleAddButton(pageId){
  var section = document.getElementById("page-" + pageId);
  if(!section) return null;
  return Array.prototype.find.call(section.querySelectorAll("[data-add]"), function(el){
    return el.offsetParent !== null;
  }) || null;
}
function stepAssetsSubpage(step){
  if(!window.matchMedia("(max-width: 880px)").matches) return;
  var activeBtn = document.querySelector("#assetsSubnav .subnav-item.active");
  var current = activeBtn ? activeBtn.getAttribute("data-assets-sub") : "summary";
  var nextIndex = ASSETS_SUB_ORDER.indexOf(current) + step;
  if(nextIndex < 0 || nextIndex >= ASSETS_SUB_ORDER.length) return;
  showAssetsSubpage(ASSETS_SUB_ORDER[nextIndex]);
}
function stepExpensesSubpage(step){
  if(!window.matchMedia("(max-width: 880px)").matches) return;
  var activeExpensesBtn = document.querySelector("#expensesSubnav .subnav-item.active");
  var currentExpensesTab = activeExpensesBtn ? activeExpensesBtn.getAttribute("data-expenses-sub") : "budget";
  var nextExpensesIndex = EXPENSES_SUB_ORDER.indexOf(currentExpensesTab) + step;
  if(nextExpensesIndex < 0 || nextExpensesIndex >= EXPENSES_SUB_ORDER.length) return;
  showExpensesSubpage(EXPENSES_SUB_ORDER[nextExpensesIndex]);
}
function setPeriodMenuOpen(open){
  periodMenu.hidden = !open;
  periodBtn.setAttribute("aria-expanded", open ? "true" : "false");
  if(open){
    renderPeriodMenu();
    periodMenu.style.top = window.innerWidth <= 600 ? Math.round(periodBtn.getBoundingClientRect().bottom + 8) + "px" : "";
    var first = periodMenu.querySelector(".period-chip.active, .seg-option.active");
    if(first) first.focus();
  }
}
function shortcutsDialog(){
  var d = document.getElementById("shortcutsDialog");
  if(d) return d;
  d = document.createElement("dialog");
  d.id = "shortcutsDialog";
  d.className = "shortcuts-dialog";
  d.setAttribute("aria-label", "Keyboard shortcuts");
  var row = function(k, what){ return '<li><span>' + k.map(function(x){ return "<kbd>" + x + "</kbd>"; }).join(" then ") + '</span>' + what + '</li>'; };
  d.innerHTML = '<h2>Keyboard shortcuts</h2><ul>' + row(["/"], "Search") + row(["n"], "Log a spend") +
    Object.keys(GO_KEYS).map(function(k){ return row(["g", k], "Go to " + GO_KEYS[k][1]); }).join("") + row(["?"], "This list") + row(["Esc"], "Close what's open") +
    '</ul><form method="dialog"><button class="btn btn-sm">Close</button></form>';
  document.body.appendChild(d);
  return d;
}

export function wireNavigation(){
  // ---------------- Page navigation ----------------
  document.getElementById("appNav").addEventListener("click", function(e){
    var btn = e.target.closest(".nav-item");
    if(!btn) return;
    showPage(btn.getAttribute("data-page"));
    closeNavMenu();
  });
  // Mobile-only dropdown: appNav is a vertical panel behind this toggle below 880px
  // (see styles.css), so a page's 7 tabs stay reachable without horizontal scroll-hunting.
  navMenuToggle = document.getElementById("navMenuToggle");
  navMenuToggle.addEventListener("click", function(e){
    e.stopPropagation();
    var willOpen = !document.querySelector(".app-sidebar").classList.contains("nav-open");
    document.querySelector(".app-sidebar").classList.toggle("nav-open", willOpen);
    navMenuToggle.setAttribute("aria-expanded", String(willOpen));
  });
  document.getElementById("appNav").addEventListener("click", function(e){ e.stopPropagation(); });
  document.addEventListener("click", closeNavMenu);
  document.addEventListener("keydown", function(e){ if(e.key === "Escape") closeNavMenu(); });
  // Mobile bottom tab bar — the primary nav on a mobile viewport (<880px). v3.140.0: Home, Cash flow,
  // Net worth, Tax and Plan; Reports and Settings are in the avatar's menu.
  document.getElementById("mobileTabbar").addEventListener("click", function(e){
    var pageBtn = e.target.closest(".mobile-tab[data-page]");
    if(pageBtn) showPage(pageBtn.getAttribute("data-page"));
  });
  // Quick-action button — one button, present on every page, retargeted per page/subpage by
  // nav.js's updateQuickFab() (data-fab-mode/data-fab-selector). "networth" is the one mode with
  // no button to click (Dashboard has no add-something UI at all); everything else scrolls the
  // page's own real +Add control into view and clicks it, so this never duplicates what that
  // button already does — it just saves the trip down the page to find it.
  document.getElementById("quickFab").addEventListener("click", function(e){
    var fab = e.currentTarget;
    var fabMode = fab.getAttribute("data-fab-mode");
    if(fabMode === "networth"){ logNetWorthSnapshot(); return; }
    if(fabMode === "menu"){ openQuickActions(); return; }
    var selector = fab.getAttribute("data-fab-selector");
    var target = selector && document.querySelector(selector);
    if(!target) return;
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(function(){ target.click(); }, 220);
  });
  quickFabMore = document.getElementById("quickFabMore");
  if(quickFabMore) quickFabMore.addEventListener("click", openQuickActions);
  document.getElementById("quickFabRoot").addEventListener("click", function(e){
    if(e.target.closest("[data-qfab-close]") || e.target === e.target.closest("[data-qfab-backdrop]")){
      app.requestCloseActiveOverlay();
      return;
    }
    var actionBtn = e.target.closest("[data-quick-action]");
    if(!actionBtn) return;
    var action = QUICK_ACTIONS[Number(actionBtn.getAttribute("data-quick-action"))];
    if(action) runQuickAction(action);
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    if(document.querySelector("[data-qfab-backdrop]")) app.requestCloseActiveOverlay();
  });
  // v3.140.0: the avatar menu — the version, its links into the app, and the dot that says a save failed.
  // On a phone the page title is the header: large at the top, slim once you scroll.
  topbar = document.querySelector(".app-topbar");
  compact = false;
  window.addEventListener("scroll", function(){
    var c = window.scrollY > 24;
    if(c !== compact){ compact = c; topbar.classList.toggle("is-compact", c); }
  }, { passive: true });
  document.getElementById("avatarVersion").textContent = document.querySelector(".app-version-num").textContent;
  document.querySelector(".avatar-menu").addEventListener("click", function(e){
    var go = e.target.closest("[data-avatar-go]");
    if(!go) return;
    var where = go.getAttribute("data-avatar-go");
    closeAllOverflowMenus(null);
    if(where === "updates"){ document.getElementById("checkUpdatesLink").click(); return; }
    if(where === "backup"){ showPage("settings"); showAccountsSubpage("preferences"); return; }
    showPage(where);
  });
  // The FIRE panel's two age inputs. Delegated from #firePanel rather than bound by id, because
  // renderDetail() replaces that panel's innerHTML on every dashboard refresh — a direct listener
  // would be attached to a node that no longer exists by the second render.
  //
  // Written on "change" (not "input"): re-rendering the panel mid-keystroke would pull the field
  // out from under the caret, and a half-typed "5" on the way to "52" would briefly report a plan
  // that fails. Blurring or pressing Enter commits it.
  document.getElementById("firePanel").addEventListener("change", function(e){
    var isCurrent = e.target.id === "fireCurrentAge";
    var isRetire = e.target.id === "fireRetireAge";
    if(!isCurrent && !isRetire) return;
    if(!state.fire) state.fire = {};
    var raw = e.target.value === "" ? null : Number(e.target.value);
    var value = raw == null || isNaN(raw) ? null : Math.max(16, Math.min(99, Math.round(raw)));
    state.fire[isCurrent ? "currentAge" : "retireAge"] = value;
    renderDetail();
    persist();
  });
  document.getElementById("checkUpdatesLink").addEventListener("click", runManualUpdateCheck);
  document.getElementById("assetsSubnav").addEventListener("click", function(e){
    var btn = e.target.closest("[data-assets-sub]");
    if(!btn) return;
    showAssetsSubpage(btn.getAttribute("data-assets-sub"));
  });
  // v3.138.0: Income → Show as — the same figures per year, month, fortnight, week, day or hour.
  document.getElementById("incomeGroups").addEventListener("click", function(e){
    var b = e.target.closest("[data-showas]");
    if(!b) return;
    setIncomeShowAs(b.getAttribute("data-showas"));
    renderIncomeGroups();
    renderTotals();
  });  // v3.138.0: the empty summary's "Add cash / shares / super" go to that tab.
  document.getElementById("assetsSummaryStats").addEventListener("click", function(e){
    var btn = e.target.closest("[data-empty-assets]");
    if(btn) showAssetsSubpage(btn.getAttribute("data-empty-assets"));
  });
  document.getElementById("dashboardSubnav").addEventListener("click", function(e){
    var btn = e.target.closest("[data-dashboard-sub]");
    if(!btn) return;
    showDashboardSubpage(btn.getAttribute("data-dashboard-sub"));
    if(btn.getAttribute("data-dashboard-sub") === "benchmarks") renderBenchmarks();
    if(btn.getAttribute("data-dashboard-sub") === "review"){ renderMonthReview(); renderHealth(); }
  });
}

export function wireSubpages(){
  // Swipe between Assets' Cash/Shares/Super/Vehicle/Other tabs on mobile — desktop already has
  // the subnav buttons within easy reach, so this only kicks in below the app's usual mobile
  // breakpoint. No wraparound (swiping past the last tab does nothing) — a jump from Other back
  // to Summary would be more disorienting than a swipe that simply stops.
  ASSETS_SUB_ORDER = ["summary", "Cash", "Shares", "Super", "Vehicle", "Other"];
  onHorizontalSwipe(document.getElementById("page-assets"), {
    onSwipeLeft: function(){ stepAssetsSubpage(1); },
    onSwipeRight: function(){ stepAssetsSubpage(-1); }
  });  // v3.164.0 (item 194): a flexible category rolls what it doesn't spend into next month, from this month on.
  document.addEventListener("change", function(e){
    var cb = e.target.closest && e.target.closest("[data-rollover]");
    if(!cb) return;
    if(!state.rollover) state.rollover = {};
    var cat = cb.getAttribute("data-rollover");
    if(cb.checked) state.rollover[cat] = selectedMonth(); else delete state.rollover[cat];
    renderSharedGroups(); persist();
  });
  document.getElementById("budgetGroupBy").addEventListener("click", function(e){
    var groupByBtn = e.target.closest("[data-budget-groupby]");
    if(groupByBtn){ setBudgetGroupBy(groupByBtn.getAttribute("data-budget-groupby")); return; }
    if(!e.target.closest("#budgetCollapseAllBtn")) return;
    setAllBudgetGroupsCollapsed(!allBudgetGroupsCollapsed());
    renderSharedGroups();
    renderBudgetGroupByToggle();
    persist();
  });  // One group card's head. Delegated off #sharedGroups because the whole list is rebuilt whenever
  // a budget line changes, so a listener bound to a head would be thrown away on the first edit.
  document.getElementById("sharedGroups").addEventListener("click", function(e){
    var head = e.target.closest("[data-budget-group-toggle]");
    if(!head) return;
    toggleBudgetGroup(head.getAttribute("data-budget-group-toggle"));
    renderSharedGroups();
    renderBudgetGroupByToggle();
    persist();
  });
  document.getElementById("sharedGroups").addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    var head = e.target.closest("[data-budget-group-toggle]");
    if(!head) return;
    e.preventDefault();
    toggleBudgetGroup(head.getAttribute("data-budget-group-toggle"));
    renderSharedGroups();
    renderBudgetGroupByToggle();
    persist();
  });  // The budget total's "See them below" link. Delegated off document because the pointer line is
  // re-rendered by renderPropertyExpensesSummary() whenever a loan changes, so a listener bound to
  // the element itself would be thrown away on the first edit.
  document.addEventListener("click", function(e){
    if(!e.target.closest("#budgetLoanPointerLink")) return;
    var loanCard = document.getElementById("propertyExpensesCard");
    if(!loanCard) return;
    if(loanCard.tagName === "DETAILS") loanCard.open = true;
    loanCard.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("expensesSubnav").addEventListener("click", function(e){
    var expensesSubBtn = e.target.closest("[data-expenses-sub]");
    if(!expensesSubBtn) return;
    showExpensesSubpage(expensesSubBtn.getAttribute("data-expenses-sub"));
  });  // Same swipe-between-tabs affordance as Assets above, and same mobile-only guard: two tabs, so
  // a swipe simply stops at either end rather than wrapping.
  EXPENSES_SUB_ORDER = ["budget", "income", "spending", "bills"];
  onHorizontalSwipe(document.getElementById("page-expenses"), {
    onSwipeLeft: function(){ stepExpensesSubpage(1); },
    onSwipeRight: function(){ stepExpensesSubpage(-1); }
  });
}

export function wirePullToRefresh(){
  // ---------------- Pull to refresh (v3.167.0, item 197) ----------------
  // On a phone, pulling the page down from the top runs what "refresh" means here: share prices,
  // when there are holdings to price, and sync, when it's on. Not while a sheet or the review is open.
  (function(){
    var phone = window.matchMedia("(max-width: 880px)"), ptr = document.createElement("div"), pull = null, busy = false;
    ptr.className = "ptr"; ptr.setAttribute("aria-hidden", "true"); ptr.innerHTML = "<span>↻</span>";
    document.body.appendChild(ptr);
    function place(dy){ var d = Math.min(dy, 90); ptr.style.transform = "translateY(" + (d - 60) + "px) rotate(" + (d * 3) + "deg)"; ptr.style.opacity = String(Math.min(1, d / 70)); }
    function hide(){ ptr.classList.remove("is-busy"); ptr.style.transition = "transform .2s ease, opacity .2s ease"; ptr.style.transform = ""; ptr.style.opacity = "0"; }
    document.addEventListener("touchstart", function(e){
      pull = null;
      if(!phone.matches || busy || e.touches.length !== 1 || window.scrollY > 0) return;
      if(e.target.closest(".review-backdrop, .m-row.open, input, select, textarea, .table-scroll, .subnav, .m-row.tx-row") || app.activeOverlayClose) return;
      pull = { y0: e.touches[0].clientY, dy: 0 };
    }, { passive: true });
    document.addEventListener("touchmove", function(e){
      if(!pull) return;
      pull.dy = (e.touches[0].clientY - pull.y0) * 0.5;
      if(pull.dy <= 0 || window.scrollY > 0){ pull.dy = 0; ptr.style.opacity = "0"; return; }
      ptr.style.transition = "none"; place(pull.dy);
    }, { passive: true });
    document.addEventListener("touchend", function(){
      if(!pull) return;
      var go = pull.dy >= 70; pull = null;
      if(!go){ hide(); return; }
      var hasShares = state.assets.some(function(a){ return a.category === "Shares" && a.symbol; });
      if(!hasShares && !syncOn()){ hide(); showToast("Nothing to refresh — prices and sync are for shares and a second device"); return; }
      busy = true; ptr.classList.add("is-busy"); place(70);
      (hasShares ? readAutoPricesNow(true) : Promise.resolve())
        .then(function(){ return syncOn() ? runSync({ manual: true }) : null; })
        .catch(function(){})
        .then(function(){ busy = false; hide(); });
    });
  })();
  setTimeout(function(){ (typeof initialSync !== "undefined" ? initialSync : Promise.resolve()).then(function(){
    var first = autoPricesNeeded() && state.assets.some(function(a){ return a.category === "Shares" && a.symbol; }) ? readAutoPricesNow(false) : Promise.resolve();
    first.then(function(){ if(priceSheetDue()) return readPriceSheetNow(false); });
  }); }, 800);
}

export function wirePeriod(){
  // ---------------- The period selector (v3.55.0) ----------------
  // One year (and optionally a month) beside the page title that every page reads — see
  // components/period.js. Choosing re-renders everything; the menu stays open so a year and then a
  // month can be picked in one go.
  loadPeriod();
  setPeriodRerender(function(){ renderAll(); renderPeriodMenu(); });
  periodBtn = document.getElementById("periodBtn");
  periodMenu = document.getElementById("periodMenu");
  periodBtn.addEventListener("click", function(){ setPeriodMenuOpen(periodMenu.hidden); });
  periodMenu.addEventListener("click", function(e){
    var b = e.target.closest("button");
    if(!b || b.disabled) return;
    if(b.hasAttribute("data-period-basis")){
      if(b.getAttribute("data-period-basis") === householdYearBasis()) return;
      setYearBasis(b.getAttribute("data-period-basis"));
      // A year number means a different twelve months on the other basis — start again from today.
      applyPeriod(null, "");
    } else if(b.hasAttribute("data-period-year")){
      applyPeriod(Number(b.getAttribute("data-period-year")), "");
    } else if(b.hasAttribute("data-period-month")){
      applyPeriod(yearStartOf(householdYearBasis(), selectedYearWindow().start), b.getAttribute("data-period-month"));
    } else if(b.hasAttribute("data-period-today")){
      applyPeriod(null, "");
      setPeriodMenuOpen(false);
      periodBtn.focus();
      return;
    }
    var again = periodMenu.querySelector(b.hasAttribute("data-period-month") ? '[data-period-month="' + b.getAttribute("data-period-month") + '"]' : ".period-chip.active");
    if(again) again.focus();
  });
  document.addEventListener("click", function(e){
    if(periodMenu.hidden) return;
    // A chip inside the menu is rebuilt by the re-render its own click causes, so by the time this
    // runs it's detached and .closest() finds nothing — that's still a click inside.
    if(!e.target.isConnected) return;
    if(!e.target.closest(".period-wrap")) setPeriodMenuOpen(false);
  });
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape" && !periodMenu.hidden){ setPeriodMenuOpen(false); periodBtn.focus(); }
  });
}

export function wireShortcuts(){
  // ---------------- Keyboard shortcuts (v3.138.0) ----------------
  // For a desktop: / search, n log a spend, g then a letter to go to a page, ? to list them. Never
  // while typing in a field, and never with a modifier held (those belong to the browser).
  GO_KEYS = { h: ["dashboard", "Home"], c: ["expenses", "Cash flow"], w: ["networth", "Net worth"], t: ["tax", "Tax"], p: ["plan", "Plan"], r: ["reports", "Reports"], s: ["settings", "Settings"] };
  goPending = 0;
  document.addEventListener("keydown", function(e){
    if(e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if(document.querySelector("dialog[open]") && e.key !== "?") return;
    if(goPending && Date.now() - goPending < 1200 && GO_KEYS[e.key]){
      goPending = 0; e.preventDefault();
      var nav = document.querySelector('.nav-item[data-page="' + GO_KEYS[e.key][0] + '"]');
      if(nav) nav.click();
      return;
    }
    goPending = 0;
    if(e.key === "g"){ goPending = Date.now(); return; }
    if(e.key === "/"){ e.preventDefault(); openSearchOverlay(); return; }
    if(e.key === "n"){ e.preventDefault(); openQuickLogSheet(); return; }
    if(e.key === "?"){ e.preventDefault(); var d = shortcutsDialog(); if(d.open) d.close(); else d.showModal(); }
  });
}
