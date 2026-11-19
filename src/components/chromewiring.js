// ---------------- The app's frame, wired (v3.206.1, item 237) ----------------
//
// Navigation, the + button and its quick actions, the avatar menu, sub-tabs and swiping between them, pull to
// refresh, the period selector and keyboard shortcuts.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order.
import { runManualUpdateCheck } from "./updates.js";
import { cardPaymentsForMonth, usualCardSource } from "../calc/bills.js";
import { selectedYearWindow, yearStartOf, householdYearBasis, selectedMonth } from "../calc/ledger.js";
import { shiftMonth as mdShiftMonth } from "../calc/monthdetail.js";
import { syncOn } from "../lib/foldersync.js";
import { localDateStr } from "../lib/format.js";
import { onHorizontalSwipe } from "../lib/swipe.js";
import { showToast } from "../lib/toast.js";
import { state, persist } from "../state.js";
import { readPriceSheetNow, readAutoPricesNow } from "./assetswiring.js";
import { autoPricesNeeded } from "./autoprices.js";
import { cashRateDue, readCashRateNow } from "./cashrate.js";
import { renderNotifBadge } from "./notifpanel.js";
import { transferForm } from "./cashflow.js";
import { openQuickLogSheet, openReceivedSheetFor } from "./cashflowwiring.js";
import { renderDetail, logNetWorthSnapshot } from "./dashboard.js";
import { setNetWorthFilter } from "./networth.js";
import { renderSharedGroups, renderTransactions, setBudgetGroupBy, renderBudgetGroupByToggle, toggleBudgetGroup, setAllBudgetGroupsCollapsed, allBudgetGroupsCollapsed, setYearBasis } from "./expenses.js";
import { renderIncomeGroups, setIncomeShowAs } from "./income.js";
import { showPage, closeNavMenu, showAssetsSubpage, showDashboardSubpage, showExpensesSubpage, showAccountsSubpage, showTaxSubpage, showPlanSubpage, QUICK_ACTIONS, quickActionsSheetHtml, goBackInApp, goCrumb, currentPageAction, currentPageId, dashboardSubpage, planSubpage } from "./nav.js";
import { isSimple, setStoredMode, applyMode, endSimpleOffer } from "../lib/mode.js";
import { renderShowMore, showMoreHere, renderSimpleOffer } from "./showmore.js";
import { closeAllOverflowMenus } from "./overlays.js";
import { loadPeriod, applyPeriod, setPeriodRerender, renderPeriodMenu } from "./period.js";
import { priceSheetDue } from "./pricesheet.js";
import { renderTotals, renderAll } from "./redraw.js";
import { runSync, initialSync } from "./safekeepingwiring.js";
import { openSearchOverlay } from "./searchwiring.js";
import { pushActiveOverlay, requestCloseActiveOverlay, overlayOpen, forgetActiveOverlay } from "../lib/overlaystack.js";
import { openImportChooser } from "./importchooserwiring.js";
import { chooseOne } from "../lib/chooser.js";
import { clearUse } from "../lib/pageuse.js";
import { renderPageUse } from "./pageuse.js";
import { chooseInvestmentProperty, openStatementForm } from "./rentstatement.js";
import { readInput } from "../lib/validate.js";
import { initSectionPickers } from "../lib/sectionpicker.js";

var navMenuToggle, topbar, compact, EXPENSES_SUB_ORDER, periodBtn, periodMenu, GO_KEYS, goPending;

// ---------------- Quick actions menu (#304: opened from the avatar menu, or by the button on a page with no action of its own) ----------------
function openQuickActions(){
  document.getElementById("quickFabRoot").innerHTML = quickActionsSheetHtml();
  pushActiveOverlay(closeQuickActions);
}
function closeQuickActions(){
  document.getElementById("quickFabRoot").innerHTML = "";
}
function visiblePlusButton(){
  return [document.getElementById("headerAddBtn"), document.getElementById("quickFab")].find(function(b){ return b && b.getClientRects().length; }) || null;
}
// This page's own add or log action (nav.js currentPageAction): the sheet's first row, and an empty state's next step
// with no target of its own. A page with none opens the sheet.
export function runPageAction(){
  var a = currentPageAction();
  if(!a){ openQuickActions(); return; }
  if(a.mode === "spending"){ runQuickAction(QUICK_ACTIONS[0]); return; }
  if(a.mode === "networth"){ logNetWorthSnapshot(); return; }
  var target = a.selector && document.querySelector(a.selector);
  if(!target) return;
  target.scrollIntoView({ block: "center", behavior: "smooth" });
  setTimeout(function(){ target.click(); }, 220);
}
// Unlike the fab itself — which only ever clicks something already on screen — a quick action
// usually has to travel first: "Add shares" from the Dashboard means Assets, then the Shares
// subpage, and only then the add button. Same shape as the search-result handler above,
// including why the menu's own history entry is replaced rather than popped: we're navigating
// straight to a destination, so back should return to wherever you were before opening the
// menu, not resurrect the menu on the way.
// #426: "Update a balance" — the accounts whose balance can be updated now (an offset waits for its loan), then that
// account's own Update form on Accounts, the one its card opens.
function chooseBalanceToUpdate(){
  var open = function(id){ var b = document.querySelector('#accountsTable [data-acct-bal="' + CSS.escape(id) + '"]'); if(b && !b.disabled) b.click(); };
  var ready = Array.prototype.filter.call(document.querySelectorAll("#accountsTable [data-acct-bal]"), function(b){ return !b.disabled; })
    .map(function(b){ return b.getAttribute("data-acct-bal"); });
  var accounts = ready.map(function(id){ return (state.accounts || []).find(function(a){ return a.id === id; }); }).filter(Boolean);
  if(!accounts.length){ showToast("Add a bank account first — then its balance can be updated here"); return; }
  if(accounts.length === 1){ open(accounts[0].id); return; }
  chooseOne({ title: "Update which balance?", attr: "bal-choice", items: accounts.map(function(a){
      return { id: a.id, label: a.name || "Account", hint: a.type ? a.type.charAt(0).toUpperCase() + a.type.slice(1) : "" };
    }),
    valid: function(id){ return (state.accounts || []).some(function(a){ return a.id === id; }); },
    gone: "That account is no longer there.", then: open });
}
function runQuickAction(action){
  closeQuickActions();
  forgetActiveOverlay();
  showPage(action.page, { replace: true });
  if(action.page === "assets" && action.sub) showAssetsSubpage(action.sub, { replace: true });
  if(action.page === "expenses" && action.sub) showExpensesSubpage(action.sub, { replace: true });
  if(action.mode === "networth"){ logNetWorthSnapshot(); return; }
  if(action.mode === "received"){ setTimeout(function(){ openReceivedSheetFor(); }, 240); return; }
  if(action.mode === "paycard"){ setTimeout(openPayCard, 240); return; }
  if(action.mode === "balance"){ setTimeout(chooseBalanceToUpdate, 240); return; }
  if(action.mode === "rentstatement"){ setTimeout(function(){ chooseInvestmentProperty("Log a statement for…", function(p){ openStatementForm(p); }); }, 240); return; }
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
  if(!card) showToast("No credit card yet — add one under Accounts → Bank accounts");
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

// After a smooth scroll to `el`: once the page has moved (or 20 frames passed — it may already have been in place) and
// then stood still for 8 frames (at most ~2s in all), if `el` starts under the page header or its section's sticky
// header, scroll it just clear.
function settleBelowHeaders(el){
  var start = window.scrollY, last = start, still = 0, frames = 0;
  (function check(){
    if(++frames > 120) return;
    if(window.scrollY === last) still++; else { still = 0; last = window.scrollY; }
    if(still < 8 || (last === start && frames < 20)) return requestAnimationFrame(check);
    if(!el.isConnected) return;
    var bar = document.querySelector(".app-topbar"), section = el.closest("details.ledger"), summary = section && section.querySelector(":scope > summary");
    var below = Math.max(bar ? bar.getBoundingClientRect().bottom : 0, summary && getComputedStyle(summary).position === "sticky" ? summary.getBoundingClientRect().bottom : 0);
    var short = below + 12 - el.getBoundingClientRect().top;
    if(short > 1) window.scrollBy({ top: -short, behavior: "instant" });
  })();
}
export function wireNavigation(){
  initSectionPickers(document.body);
  // Simpler navigation step 1: the header's way back from an inner page (nav.js renderBackLink names it).
  var pageBack = document.getElementById("pageBack");
  if(pageBack) pageBack.addEventListener("click", function(){ goBackInApp(); });
  // #425: a desktop's breadcrumb — each part opens that screen.
  var crumbs = document.getElementById("pageCrumbs");
  if(crumbs) crumbs.addEventListener("click", function(e){ var c = e.target.closest("[data-crumb]"); if(c) goCrumb(c.getAttribute("data-crumb")); });
  // #255 step 3: an empty state's next step (lib/empty.js) — to another page and its tab, or the page's own add.
  document.addEventListener("click", function(e){
    var add = e.target.closest && e.target.closest("[data-empty-add]");
    if(add){ var target = add.getAttribute("data-empty-add"); if(!target){ runPageAction(); return; } var btn = document.querySelector(target); if(btn) btn.click(); return; }
    var to = e.target.closest && e.target.closest("[data-empty-scroll]");
    if(to){
      var where = document.querySelector(to.getAttribute("data-empty-scroll"));
      if(where){
        // Leave the destination below both sticky headers, including while the phone header shrinks.
        var section = where.closest("details.ledger"), summary = section && section.querySelector(":scope > summary");
        var sectionHeight = summary && getComputedStyle(summary).position === "sticky" ? summary.getBoundingClientRect().height : 0;
        where.style.setProperty("--empty-scroll-section-h", sectionHeight + "px");
        where.classList.add("empty-state-scroll-target");
        where.scrollIntoView({ behavior: "smooth", block: "start" });
        // The margin is worked out at the click. If anything above it changes size while the page moves (on CI the list
        // ended 48px under its section's sticky header), it lands short — so once the page stands still, it's checked
        // against both headers as they are then, and moved up just far enough.
        settleBelowHeaders(where);
      }
      return;
    }
    var go = e.target.closest && e.target.closest("[data-go]");
    if(!go) return;
    var parts = go.getAttribute("data-go").split("/"), page = parts[0], sub = parts[1];
    showPage(page);
    if(!sub) return;
    if(page === "expenses") showExpensesSubpage(sub, { replace: true });
    else if(page === "tax") showTaxSubpage(sub, { replace: true });
    else if(page === "plan") showPlanSubpage(sub, { replace: true });
    else if(page === "assets") showAssetsSubpage(sub, { replace: true });
    else if(page === "settings") showAccountsSubpage(sub, { replace: true });
    else if(page === "dashboard") showDashboardSubpage(sub, { replace: true });
  });
  // ---------------- Page navigation ----------------
  document.getElementById("appNav").addEventListener("click", function(e){
    var btn = e.target.closest(".nav-item");
    if(!btn) return;
    if(btn.hasAttribute("data-more-go")) goMore(btn); else goPage(btn.getAttribute("data-page"));
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
  // Mobile bottom tab bar — the primary nav on a mobile viewport (<880px). #412: Today, Cash flow, Net worth, Plan
  // and More (Tax, Reports, Calculators, Settings, Backup).
  document.getElementById("mobileTabbar").addEventListener("click", function(e){
    var pageBtn = e.target.closest(".mobile-tab[data-page]");
    if(pageBtn) goPage(pageBtn.getAttribute("data-page"));
  });
  // #411: the + button — the round one on a phone, the header's on a desktop — always opens one sheet: this page's own
  // action first (nav.js updateQuickFab finds it), then logging, importing and adding.
  document.getElementById("quickFab").addEventListener("click", openQuickActions);
  // #304: the header's button (desktop) is the same action; the menu of the others opens from the avatar menu.
  document.getElementById("headerAddBtn").addEventListener("click", openQuickActions);
  document.getElementById("avatarQuickActions").addEventListener("click", openQuickActions);
  document.getElementById("quickFabRoot").addEventListener("click", function(e){
    if(e.target.closest("[data-qfab-close]") || e.target === e.target.closest("[data-qfab-backdrop]")){
      requestCloseActiveOverlay();
      return;
    }
    // This page's own action runs here, once the sheet's history entry is gone (it may open its own sheet).
    if(e.target.closest("[data-quick-page]")){ requestCloseActiveOverlay().then(function(closed){ if(closed) runPageAction(); }); return; }
    // The import chooser takes the sheet's place, history entry and all, so Back doesn't reopen the sheet.
    if(e.target.closest("[data-quick-import]")){ closeQuickActions(); forgetActiveOverlay(); openImportChooser(null, { opener: visiblePlusButton(), replace: true }); return; }
    var actionBtn = e.target.closest("[data-quick-action]");
    if(!actionBtn) return;
    var action = QUICK_ACTIONS[Number(actionBtn.getAttribute("data-quick-action"))];
    if(action) runQuickAction(action);
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    if(document.querySelector("[data-qfab-backdrop]")) requestCloseActiveOverlay();
  });
  // v3.140.0: the avatar menu — the version, its links into the app, and the dot that says a save failed.
  // On a phone the page title is the header: large at the top, slim once you scroll.
  topbar = document.querySelector(".app-topbar");
  compact = false;
  // Going slim takes ~50px off the header, and the browser keeps what you're looking at in place by moving the
  // scroll position up as much — which, with one threshold, put it back under the line, the header grew, the
  // position went back down, and the header flickered between the two many times a second. So it goes slim only
  // past more than it loses, and comes back only at the top: neither change can undo itself.
  var shrinkBy = 56;
  window.addEventListener("scroll", function(){
    var y = window.scrollY;
    var c = compact ? y > 4 : y > shrinkBy + 24;
    if(c === compact) return;
    var before = topbar.offsetHeight;
    compact = c; topbar.classList.toggle("is-compact", c);
    // Measured from the transition's end state, not mid-way: the larger of what it's lost before.
    if(c) requestAnimationFrame(function(){ setTimeout(function(){ shrinkBy = Math.max(shrinkBy, before - topbar.offsetHeight); }, 200); });
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
    // #263: blank is "not set"; an age outside 16–99 is said, not quietly made 16 or 99.
    var age = readInput(e.target, { min: 16, max: 99, whole: true, range: "Enter an age from 16 to 99, in whole years." });
    if(!age) return;
    state.fire[isCurrent ? "currentAge" : "retireAge"] = age.value;
    renderDetail();
    persist();
  });
  document.getElementById("checkUpdatesLink").addEventListener("click", runManualUpdateCheck);
  // v3.138.0: Income → Show as — the same figures per year, month, fortnight, week, day or hour.
  document.getElementById("incomeGroups").addEventListener("click", function(e){
    var b = e.target.closest("[data-showas]");
    if(!b) return;
    setIncomeShowAs(b.getAttribute("data-showas"));
    renderIncomeGroups();
    renderTotals();
  });
  // #412: Today's other views open from its links (no tab rail); each has the header's way back.
  document.querySelector(".today-more").addEventListener("click", function(e){
    var btn = e.target.closest("[data-dashboard-sub]");
    if(btn) openTodayView(btn.getAttribute("data-dashboard-sub"));
  });
  // #414: Simple or Advanced (Settings → Preferences and More), and a page's "Show more on this page".
  document.addEventListener("change", function(e){
    var box = e.target.closest && e.target.closest("[data-mode-toggle]");
    if(!box) return;
    var mode = box.checked ? "advanced" : "simple";
    setStoredMode(mode); endSimpleOffer(); applyMode(mode); renderShowMore(); renderSimpleOffer();
    showToast(mode === "simple" ? "Simple: the tools used now and then are put away. Show more on a page brings them back." : "Showing everything.");
  });
  document.addEventListener("click", function(e){
    if(e.target.closest && e.target.closest("[data-show-more]")) showMoreHere();
  });
  // #426: Preferences → Screens you rarely open — forgetting the device's count.
  document.getElementById("pageUseClear").addEventListener("click", function(){ clearUse(); renderPageUse(); showToast("Forgotten"); });
  // #426: Today's one-time offer of Simple (drawn by app.js once the mode is decided).
  document.getElementById("modeOffer").addEventListener("click", function(e){
    var choice = e.target.closest("[data-mode-offer]");
    if(!choice) return;
    endSimpleOffer();
    if(choice.getAttribute("data-mode-offer") === "simple"){
      setStoredMode("simple"); applyMode("simple"); renderShowMore();
      showToast("Simple: the tools used now and then are put away. Switch back any time in More.");
    }
    renderSimpleOffer();
  });
  // #413: Net worth's list by kind.
  document.getElementById("netWorthBody").addEventListener("click", function(e){
    var chip = e.target.closest("[data-nw-filter]");
    if(chip){ setNetWorthFilter(chip.getAttribute("data-nw-filter")); var again = document.querySelector('#netWorthBody [data-nw-filter="' + chip.getAttribute("data-nw-filter") + '"]'); if(again) again.focus(); }
  });
  // #412: More's rows, a phone's way to Tax, Reports, Calculators, Settings and Backup.
  document.getElementById("moreList").addEventListener("click", function(e){
    var btn = e.target.closest(".more-item");
    if(btn) goMore(btn);
  });
}

function openTodayView(sub){ showDashboardSubpage(sub); }   // which draws the view
// A row of More (or the sidebar's same five): its page, or Backup & sync — Settings → Preferences.
function goMore(btn){
  if(btn.getAttribute("data-more-go") === "backup"){ showPage("settings"); showAccountsSubpage("preferences"); return; }
  showPage(btn.getAttribute("data-page"));
}
// Today's tab (the sidebar's or the bar's), chosen while on Insights or the review, goes back to Today itself.
function goPage(pageId){
  if(pageId === "dashboard" && currentPageId() === "dashboard" && dashboardSubpage() !== "overview"){ showDashboardSubpage("overview"); return; }
  // #414: in Simple mode Plan's Scenarios, Projections and Retirement tabs are put away, so its tab opens on Goals.
  if(pageId === "plan" && isSimple() && planSubpage() !== "goals"){ showPage("plan"); showPlanSubpage("goals", { replace: true }); return; }
  showPage(pageId);
}
export function wireSubpages(){
  // No swipe between Investments' sections now: each is its own page, opened from its group on Accounts.  // v3.164.0 (item 194): a flexible category rolls what it doesn't spend into next month, from this month on.
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
      if(e.target.closest(".review-backdrop, .m-row.open, .page-overflow-menu, input, select, textarea, .table-scroll, .subnav, .m-row.tx-row") || overlayOpen()) return;
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
  // data-wp-settled (beside data-wp-ready): the startup reads below have all finished, whether or not they found
  // anything. Until then a price or the cash rate can still land and save. The journeys wait for it (#267) —
  // "no network for half a second" turned out not to mean the same thing, and sometimes never came.
  var settled = function(){ document.documentElement.setAttribute("data-wp-settled", ""); };
  setTimeout(function(){ (typeof initialSync !== "undefined" ? initialSync : Promise.resolve()).then(function(){
    var first = autoPricesNeeded() && state.assets.some(function(a){ return a.category === "Shares" && a.symbol; }) ? readAutoPricesNow(false) : Promise.resolve();
    return first.then(function(){ if(priceSheetDue()) return readPriceSheetNow(false); })
      // Item 249: the RBA cash rate, once a day, from this site's file.
      .then(function(){ if(cashRateDue()) return readCashRateNow().then(function(news){ if(news) renderNotifBadge(); }); });
  }).catch(function(){}).then(settled); }, 800);
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
  GO_KEYS = { h: ["dashboard", "Home"], c: ["expenses", "Money"], w: ["networth", "Accounts"], t: ["tax", "Tax"], p: ["plan", "Plan"], r: ["reports", "Reports"], s: ["settings", "Settings"] };
  goPending = 0;
  document.addEventListener("keydown", function(e){
    if(e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if(document.querySelector('.m-row.open[role="dialog"]')) return;
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
