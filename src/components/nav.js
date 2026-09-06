import { renderDashboardStats } from "./dashboard.js";
import { closeScenarioOverridePanel } from "./expenses.js";

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

// Shareable URLs: /<page>[/<assets-subpage>], e.g. /assets/shares. GitHub Pages serves
// this project under a fixed /wealth-planner base; local dev (python http.server, etc.)
// serves it from root — no generic base-path detection needed for a single-repo app.
var BASE_PATH = location.hostname.indexOf("github.io") !== -1 ? "/wealth-planner" : "";
var ASSETS_SUB_TO_SLUG = { summary: "summary", Cash: "cash", Shares: "shares", Super: "super", Vehicle: "vehicle", Other: "other" };
var SLUG_TO_ASSETS_SUB = { summary: "summary", cash: "Cash", shares: "Shares", super: "Super", vehicle: "Vehicle", other: "Other" };
var currentAssetsSub = "summary";

function buildRoutePath(pageId, assetsSub){
  var parts = [pageId];
  if(pageId === "assets") parts.push(ASSETS_SUB_TO_SLUG[assetsSub] || "summary");
  return BASE_PATH + "/" + parts.join("/");
}
function syncUrl(pageId, replace){
  var path = buildRoutePath(pageId, currentAssetsSub);
  if(location.pathname === path) return;
  history[replace ? "replaceState" : "pushState"]({page: pageId, assetsSub: currentAssetsSub}, "", path + location.search);
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
  var sub = (page.id === "assets" && segs[1] && SLUG_TO_ASSETS_SUB[segs[1]]) ? SLUG_TO_ASSETS_SUB[segs[1]] : null;
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
  expenses: { label: "Add transaction", selector: "#addTransactionBtn" },
  properties: { label: "Add property", selector: "#addPropertyBtn" },
  accounts: { label: "Add account", selector: "#addAccountBtn" }
};
var QUICK_FAB_GROUPED_PAGES = ["income", "assets", "scenarios"];
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
  fab.hidden = !label;
  if(!label){
    fab.removeAttribute("data-fab-mode");
    fab.removeAttribute("data-fab-selector");
    return;
  }
  fab.title = label;
  fab.setAttribute("aria-label", label);
  if(mode) fab.setAttribute("data-fab-mode", mode); else fab.removeAttribute("data-fab-mode");
  if(selector) fab.setAttribute("data-fab-selector", selector); else fab.removeAttribute("data-fab-selector");
}
export function showPage(id, opts){
  opts = opts || {};
  if(!PAGES.some(function(p){ return p.id === id; })) id = "dashboard";

  function applyPageChange(){
    // The per-scenario expense override panel (Expenses page) is a fixed-position overlay
    // appended outside any .app-page section, so it would otherwise stay visible on top of
    // whatever page the user navigates to next.
    closeScenarioOverridePanel();
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

export function showAssetsSubpage(id, opts){
  opts = opts || {};
  currentAssetsSub = id;
  document.querySelectorAll(".assets-subpage").forEach(function(el){ el.hidden = el.id !== "assetsSub-" + id; });
  document.querySelectorAll("#assetsSubnav .subnav-item").forEach(function(btn){
    btn.classList.toggle("active", btn.getAttribute("data-assets-sub") === id);
  });
  updateQuickFab("assets");
  if(!opts.skipUrl) syncUrl("assets", !!opts.replace);
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
