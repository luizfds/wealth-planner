import { renderDashboardStats } from "./dashboard.js";
import { closeScenarioOverridePanel } from "./expenses.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Page navigation ----------------
var PAGES = [
  { id: "dashboard", label: "Dashboard" },
  { id: "income", label: "Income & Tax" },
  { id: "expenses", label: "Expenses" },
  { id: "accounts", label: "Accounts" },
  { id: "assets", label: "Assets" },
  { id: "properties", label: "Properties" },
  { id: "scenarios", label: "Scenarios" },
  { id: "projections", label: "Projections" }
];
export var PAGE_KEY = "wealthPlanner.page";

// Shareable URLs: /<page>[/<subpage>], e.g. /assets/shares or /expenses/spending. GitHub Pages
// serves this project under a fixed /wealth-planner base; local dev (python http.server, etc.)
// serves it from root — no generic base-path detection needed for a single-repo app.
var BASE_PATH = location.hostname.indexOf("github.io") !== -1 ? "/wealth-planner" : "";
var ASSETS_SUB_TO_SLUG = { summary: "summary", Cash: "cash", Shares: "shares", Super: "super", Vehicle: "vehicle", Other: "other" };
var SLUG_TO_ASSETS_SUB = { summary: "summary", cash: "Cash", shares: "Shares", super: "Super", vehicle: "Vehicle", other: "Other" };
var currentAssetsSub = "summary";
// Expenses' own two halves — the planned budget and the real spend logged against it. Unlike
// Assets' categories (whose ids are the user-facing category names and so need a slug map), these
// are already lowercase route slugs, so they double as their own DOM ids and URL segments.
var EXPENSES_SUBS = ["budget", "spending"];
var currentExpensesSub = "budget";

function buildRoutePath(pageId){
  var parts = [pageId];
  if(pageId === "assets") parts.push(ASSETS_SUB_TO_SLUG[currentAssetsSub] || "summary");
  if(pageId === "expenses") parts.push(currentExpensesSub);
  return BASE_PATH + "/" + parts.join("/");
}
function syncUrl(pageId, replace){
  var path = buildRoutePath(pageId);
  if(location.pathname === path) return;
  history[replace ? "replaceState" : "pushState"]({page: pageId, assetsSub: currentAssetsSub, expensesSub: currentExpensesSub}, "", path + location.search);
}
export function parseRouteFromLocation(){
  var path = location.pathname;
  if(BASE_PATH && path.indexOf(BASE_PATH) === 0) path = path.slice(BASE_PATH.length);
  var segs = path.split("/").filter(Boolean).map(function(s){
    try{ return decodeURIComponent(s).toLowerCase(); }catch(e){ return s.toLowerCase(); }
  });
  if(!segs.length) return null;
  var page = PAGES.find(function(p){ return p.id === segs[0]; });
  if(!page) return null;
  var sub = null;
  if(page.id === "assets" && segs[1] && SLUG_TO_ASSETS_SUB[segs[1]]) sub = SLUG_TO_ASSETS_SUB[segs[1]];
  else if(page.id === "expenses" && segs[1] && EXPENSES_SUBS.indexOf(segs[1]) !== -1) sub = segs[1];
  return { page: page.id, sub: sub };
}

// Pages reachable directly from the mobile bottom tab bar; the rest live behind its "More"
// tab. Scenarios/Projections are occasional "what-if" pages, unlike the four data-entry
// pages above them, so the More tab's own active state also lights up for those two.
var MOBILE_MORE_PAGES = ["accounts", "scenarios", "projections"];

// Plain-button pages: the page's own single, unambiguous "add" entry point. Income/Assets/
// Scenarios are handled separately below (grouped by person/category/scenario, so there's no one
// global button — the first currently-visible [data-add] element stands in for "the" action on
// whichever group/subpage is showing). Dashboard has no add button at all — logging net worth is
// a direct function call, dispatched by app.js's click handler via data-fab-mode="networth"
// rather than a selector, since there's nothing in the DOM to click. Projections has no natural
// "add" action and simply isn't listed, so the fab hides there.
var QUICK_FAB_BUTTON_PAGES = {
  // Log spend on both of Expenses' halves, not just Spending. Budget briefly had its own "Add
  // expense" action, but that made the page's most frequent job — logging what you just spent —
  // cost an extra tap whenever you arrived on Expenses, which opens on Budget. Adding a budget
  // line is well served without the fab (the ledger footer and every classification card carry
  // their own "+ Add expense"), and it's a set-up-day action, not a daily one. #quickLogBtn lives
  // on the Spending subpage, but a hidden button still clicks fine and the sheet covers the page
  // either way — so logging from Budget lands you back on Budget with the bars already updated.
  expenses: { label: "Log spend", selector: "#quickLogBtn" },
  properties: { label: "Add property", selector: "#addPropertyBtn" }
};
// Accounts' fab follows its visible half, the same way Expenses' used to — resolved per subpage
// rather than per page, so it can't sit in the map above.
function accountsFabAction(){
  return document.getElementById("accountsSub-categories") && !document.getElementById("accountsSub-categories").hidden
    ? { label: "Add category", selector: "#addCategoryBtn" }
    : { label: "Add account", selector: "#addAccountBtn" };
}
var QUICK_FAB_GROUPED_PAGES = ["income", "assets", "scenarios"];
// Every "add or log something" the app can do, in one list, reachable from any page via the fab's
// chevron. The point is the cross-page case: the fab itself can only trigger what's already on
// screen, so adding a share from the Dashboard meant navigating to Assets, switching to the Shares
// subpage and only then tapping the fab. These carry their own destination, so one tap gets there.
//
// Ordered by how often a household actually does them, not by how the app is organised — logging
// spend is a daily act, adding a property is a once-every-few-years one.
export var QUICK_ACTIONS = [
  { label: "Log spend",     hint: "A real transaction against a budget line", page: "expenses",   sub: "spending", selector: "#quickLogBtn" },
  { label: "Add expense",   hint: "A new planned budget line",                page: "expenses",   sub: "budget",   selector: '[data-add="shared"]' },
  // No selector on these three: Income and Assets build their add buttons per person/category
  // (data-add="income:<person>", "assets:Cash", "holding"), so the value isn't knowable from here.
  // They resolve to the first visible [data-add] on the destination page instead — the same way
  // updateQuickFab already targets those pages, and robust to the row markup changing.
  { label: "Add income",    hint: "A salary, rent or other income row",       page: "income" },
  { label: "Add shares",    hint: "A holding in the Shares list",             page: "assets",     sub: "Shares" },
  { label: "Add cash",      hint: "A savings or offset balance",              page: "assets",     sub: "Cash" },
  { label: "Add property",  hint: "A home or investment property",            page: "properties", selector: "#addPropertyBtn" },
  { label: "Add account",   hint: "A bank or credit card account",            page: "accounts",   selector: "#addAccountBtn" },
  { label: "Log net worth", hint: "Snapshot today's total",                   page: "dashboard",  mode: "networth" }
];
// Reuses the .review-backdrop/.review-panel sheet shell every other overlay in this app uses (see
// ledger.css), so this inherits the bottom-anchored-on-mobile treatment and the shared backdrop
// behaviour for free rather than inventing a third overlay shape.
export function quickActionsSheetHtml(){
  var rows = QUICK_ACTIONS.map(function(action, i){
    return '<button type="button" class="qfab-action" data-quick-action="' + i + '">' +
      '<span class="qfab-action-label">' + escapeAttr(action.label) + '</span>' +
      '<span class="qfab-action-hint">' + escapeAttr(action.hint) + '</span>' +
    '</button>';
  }).join("");
  return '<div class="review-backdrop" data-qfab-backdrop>' +
    '<div class="review-panel qfab-panel" role="dialog" aria-label="Quick actions">' +
      '<div class="review-head"><h4>Quick actions</h4><button type="button" class="icon-btn" data-qfab-close aria-label="Close">✕</button></div>' +
      '<div class="qfab-actions">' + rows + '</div>' +
    '</div></div>';
}

// Re-targets the quick-action button for whichever page/subpage is now visible — called after
// every page switch and Assets subpage switch (see applyPageChange/showAssetsSubpage below), so
// tapping it always performs the single most useful "add/log something" action for wherever the
// user currently is, without them having to scroll to that page's own +Add button first.
export function updateQuickFab(pageId){
  var fab = document.getElementById("quickFab");
  if(!fab) return;
  var label = null, mode = null, selector = null;
  if(pageId === "dashboard"){
    label = "Log net worth now";
    mode = "networth";
  } else if(pageId === "accounts"){
    var accountsAction = accountsFabAction();
    label = accountsAction.label;
    selector = accountsAction.selector;
  } else if(QUICK_FAB_BUTTON_PAGES[pageId]){
    label = QUICK_FAB_BUTTON_PAGES[pageId].label;
    selector = QUICK_FAB_BUTTON_PAGES[pageId].selector;
  } else if(QUICK_FAB_GROUPED_PAGES.indexOf(pageId) !== -1){
    var section = document.getElementById("page-" + pageId);
    var candidates = section ? section.querySelectorAll("[data-add]") : [];
    var target = Array.prototype.find.call(candidates, function(el){ return el.offsetParent !== null; });
    if(target){
      label = (target.textContent || "").replace(/^\+\s*/, "").trim() || "Add";
      // Re-found by this same attribute at click time (see app.js), not stored as an element
      // reference — a re-render can replace the actual node before the button is tapped, but the
      // data-add value itself stays stable for the same logical group.
      selector = '[data-add="' + CSS.escape(target.getAttribute("data-add")) + '"]';
    }
  }
  var more = document.getElementById("quickFabMore");
  // No single obvious action for this page (Projections): the big circle opens the quick-actions
  // menu instead of hiding, and the chevron stands down rather than duplicating it.
  fab.hidden = false;
  if(more) more.hidden = !label;
  if(!label){
    fab.setAttribute("data-fab-mode", "menu");
    fab.removeAttribute("data-fab-selector");
    fab.title = "Quick actions";
    fab.setAttribute("aria-label", "Quick actions");
    return;
  }
  fab.title = label;
  fab.setAttribute("aria-label", label);
  if(mode) fab.setAttribute("data-fab-mode", mode); else fab.removeAttribute("data-fab-mode");
  if(selector) fab.setAttribute("data-fab-selector", selector); else fab.removeAttribute("data-fab-selector");
}
// Overlays that live *outside* any .app-page section (the row-edit modal and its backdrop, the
// search sheet, the quick-log sheet, the expense review) have to be torn down when the page
// changes, or they hang over whatever you navigated to — and worse, the history entry
// pushActiveOverlay() left behind gets stranded under the page entry syncUrl() pushes next, so
// the overlay's own close path stops working entirely.
//
// app.js owns those primitives and can't be imported from here without a cycle, so it registers
// its cleanup once at startup. Pure DOM/state cleanup only, no history: showPage is about to write
// the history entry itself.
var overlayCleanup = null;
export function setOverlayCleanup(fn){ overlayCleanup = fn; }
export function showPage(id, opts){
  opts = opts || {};
  if(!PAGES.some(function(p){ return p.id === id; })) id = "dashboard";

  function applyPageChange(){
    // The per-scenario expense override panel (Expenses page) is a fixed-position overlay
    // appended outside any .app-page section, so it would otherwise stay visible on top of
    // whatever page the user navigates to next.
    closeScenarioOverridePanel();
    if(overlayCleanup) overlayCleanup();
    PAGES.forEach(function(p){
      var section = document.getElementById("page-" + p.id);
      if(section) section.hidden = (p.id !== id);
      document.querySelectorAll('.nav-item[data-page="' + p.id + '"], .mobile-tab[data-page="' + p.id + '"], .mobile-more-item[data-page="' + p.id + '"]').forEach(function(navBtn){
        navBtn.classList.toggle("active", p.id === id);
        if(p.id === id) navBtn.setAttribute("aria-current", "page"); else navBtn.removeAttribute("aria-current");
      });
    });
    var moreTab = document.getElementById("mobileTabMore");
    if(moreTab) moreTab.classList.toggle("active", MOBILE_MORE_PAGES.indexOf(id) !== -1);
    var page = PAGES.find(function(p){ return p.id === id; });
    document.getElementById("pageTitle").textContent = page ? page.label : "Dashboard";
    var navLabel = document.getElementById("navMenuCurrentLabel");
    if(navLabel) navLabel.textContent = page ? page.label : "Dashboard";
    try{ localStorage.setItem(PAGE_KEY, id); }catch(e){}
    if(id === "dashboard") renderDashboardStats();
    updateQuickFab(id);
    if(!opts.skipScroll) window.scrollTo(0, 0);
    if(!opts.skipUrl) syncUrl(id, !!opts.replace);
    closeMobileMore();
  }

  // A plain hidden-toggle instant swap is the single biggest "this is a website, not an app" tell
  // in the whole nav. The View Transitions API cross-fades old/new page content automatically —
  // no manual before/after class choreography — and simply isn't called at all on browsers
  // without support (Firefox, older Safari) or when the user prefers reduced motion, so this is
  // pure enhancement with no fallback path to maintain.
  var prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(document.startViewTransition && !prefersReducedMotion){
    document.startViewTransition(applyPageChange);
  } else {
    applyPageChange();
  }
}

// Now that a subnav scrolls instead of wrapping, the active tab can be off-screen when a page is
// entered rather than tapped — a deep link to /assets/other, or restoring the last subpage on
// load. Both leave the rail showing "Summary … Shares" with no sign that the visible content is
// Other. Nothing needs doing when the tab is already in view, which scrollIntoView with
// "nearest" handles by itself.
function scrollActiveSubnavIntoView(railId){
  var rail = document.getElementById(railId);
  var active = rail && rail.querySelector(".subnav-item.active");
  if(!active || !active.scrollIntoView) return;
  // inline:"nearest" scrolls the rail horizontally; block:"nearest" is what stops it dragging the
  // whole *page* down to the rail as a side effect.
  try{ active.scrollIntoView({ inline: "nearest", block: "nearest" }); }catch(e){}
}
export function showAssetsSubpage(id, opts){
  opts = opts || {};
  currentAssetsSub = id;
  document.querySelectorAll(".assets-subpage").forEach(function(el){ el.hidden = el.id !== "assetsSub-" + id; });
  document.querySelectorAll("#assetsSubnav .subnav-item").forEach(function(btn){
    btn.classList.toggle("active", btn.getAttribute("data-assets-sub") === id);
  });
  updateQuickFab("assets");
  scrollActiveSubnavIntoView("assetsSubnav");
  if(!opts.skipUrl) syncUrl("assets", !!opts.replace);
}

// Accounts vs. Categories — the two registries this app asks you to maintain. Session-only, like
// the Dashboard's own split and unlike Assets/Expenses: there's no reason to deep-link a settings
// registry, and keeping it out of the URL keeps buildRoutePath to the two subpages worth sharing.
export function showAccountsSubpage(id){
  if(id !== "categories") id = "accounts";
  document.querySelectorAll(".accounts-subpage").forEach(function(el){ el.hidden = el.id !== "accountsSub-" + id; });
  document.querySelectorAll("#accountsSubnav .subnav-item").forEach(function(btn){
    btn.classList.toggle("active", btn.getAttribute("data-accounts-sub") === id);
  });
  scrollActiveSubnavIntoView("accountsSubnav");
  updateQuickFab("accounts");
}

// Budget (what you plan to spend) vs. Spending (what you actually spent, logged against it) —
// same pill-subnav + URL-sync pattern as showAssetsSubpage above, and deep-linkable for the same
// reason: "open my spending for the month" is a thing worth bookmarking on a phone. The split
// exists because the two halves are used on completely different rhythms — the budget is set up
// once and revisited occasionally, spending is logged constantly — and stacking all four ledgers
// on one page made the everyday half the one you had to scroll past the other to reach.
export function showExpensesSubpage(id, opts){
  opts = opts || {};
  if(EXPENSES_SUBS.indexOf(id) === -1) id = "budget";
  currentExpensesSub = id;
  document.querySelectorAll(".expenses-subpage").forEach(function(el){ el.hidden = el.id !== "expensesSub-" + id; });
  document.querySelectorAll("#expensesSubnav .subnav-item").forEach(function(btn){
    btn.classList.toggle("active", btn.getAttribute("data-expenses-sub") === id);
  });
  scrollActiveSubnavIntoView("expensesSubnav");
  updateQuickFab("expenses");
  if(!opts.skipUrl) syncUrl("expenses", !!opts.replace);
}

// Overview (top stats + scenario cards) vs. Insights (50/30/20, FI progress, actual vs. expected,
// upcoming bills, projection accuracy) — same pill-subnav pattern as showAssetsSubpage above, so a
// daily glance at Dashboard only pays for the six Insights cards' scroll length when actually
// wanted. No URL sync or persisted default (unlike Assets' subpage, which is deep-linkable) —
// this stays a lighter, session-only split; navigating away and back to Dashboard keeps whichever
// tab was last open rather than resetting, since the two subpage <div>s are never destroyed.
export function showDashboardSubpage(id){
  document.querySelectorAll(".dashboard-subpage").forEach(function(el){ el.hidden = el.id !== "dashboardSub-" + id; });
  document.querySelectorAll("#dashboardSubnav .subnav-item").forEach(function(btn){
    btn.classList.toggle("active", btn.getAttribute("data-dashboard-sub") === id);
  });
  scrollActiveSubnavIntoView("dashboardSubnav");
}

// Mobile-only dropdown: appNav is a vertical panel behind this toggle below 880px
// (see styles.css), so a page's 7 tabs stay reachable without horizontal scroll-hunting.
export function closeNavMenu(){
  document.querySelector(".app-sidebar").classList.remove("nav-open");
  document.getElementById("navMenuToggle").setAttribute("aria-expanded", "false");
}

export function closeMobileMore(){
  document.getElementById("mobileMorePanel").hidden = true;
  document.getElementById("mobileTabMore").setAttribute("aria-expanded", "false");
}
