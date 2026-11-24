// ---------------- Search and detail pages, wired (v3.206.1, item 237) ----------------
//
// Cross-page search and the links that open a detail page.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order.
import { openImportChooser } from "./importchooserwiring.js";
import { persist } from "../state.js";
import { detailTarget, detailView } from "./detail.js";
import { renderSharedGroups, renderBudgetGroupByToggle, revealBudgetLine } from "./expenses.js";
import { showPage, showAssetsSubpage, showExpensesSubpage, showAccountsSubpage, goBackInApp } from "./nav.js";
import { openSearch, closeSearch, setSearchQuery, getSearchResult, unavailableSearchResult } from "./search.js";
import { pushActiveOverlay, requestCloseActiveOverlay, forgetActiveOverlay } from "../lib/overlaystack.js";

// ---------------- Cross-page search ----------------
function openSearchOverlay(){
  openSearch();
  pushActiveOverlay(closeSearch);
}
// A place in the app: a page, a subtab, and a row to open and scroll to. Search results and a
// detail page's "Edit on …" both go through here.
function goToPlace(page, extra, opts){
  extra = extra || {};
  showPage(page, { replace: !!(opts && opts.replace) });
  // `sub` means different things per page: an Assets category, or one of the Expenses subtabs.
  // Routed by page rather than by guessing from the value, so "budget" can never be mistaken for
  // an asset category.
  if(extra.sub){
    if(page === "expenses") showExpensesSubpage(extra.sub, { replace: true });
    else if(page === "assets") showAssetsSubpage(extra.sub, { replace: true });
    else if(page === "settings") showAccountsSubpage(extra.sub, { replace: true });
  }
  // A budget line lives inside a group card that starts collapsed, so it has to be opened before
  // there is anything on screen to scroll to. Without this the search lands on the page at scroll
  // 0 with the row display:none — the result looks like it did nothing.
  if(extra.lineId && revealBudgetLine(extra.lineId)){
    renderSharedGroups();
    renderBudgetGroupByToggle();
    persist();
  }
  if(extra.scrollToId || extra.lineId){
    // Give showPage's own render + view-transition a moment to finish before scrolling —
    // scrolling to an element mid-transition can land at the wrong offset once it settles.
    setTimeout(function(){
      var el = extra.scrollToId
        ? document.getElementById(extra.scrollToId)
        : document.querySelector('#sharedGroups [data-line-id="' + (window.CSS && window.CSS.escape ? window.CSS.escape(extra.lineId) : extra.lineId) + '"]');
      // November 2026: Preferences' parts start folded — a setting found by search opens the fold it's in.
      for(var d = el && el.closest("details"); d; d = d.parentElement && d.parentElement.closest("details")) d.open = true;
      if(el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 200);
  }
}
// ---------------- Detail pages (v3.128.0) ----------------
function openDetail(kind, id, opts){
  detailTarget.kind = kind; detailTarget.id = id;
  showPage("detail", { replace: !!(opts && opts.replace) });
}

export function wireSearch(){  document.getElementById("searchBtn").addEventListener("click", openSearchOverlay);
  document.getElementById("searchRoot").addEventListener("click", function(e){
    if(e.target.closest("[data-search-close]") || e.target === e.target.closest("[data-search-backdrop]")){
      requestCloseActiveOverlay();
      return;
    }
    var resultBtn = e.target.closest("[data-search-result]");
    if(!resultBtn) return;
    var result = getSearchResult(Number(resultBtn.getAttribute("data-search-result")));
    if(!result){ unavailableSearchResult(); return; }
    closeSearch();
    // Not requestCloseActiveOverlay() — we're navigating to a specific destination right away, so
    // the search-open history entry gets replaced by that destination's own (via showPage's
    // {replace:true}) instead of popped: pressing back from there should land wherever the user
    // was *before* opening search, not resurrect an empty search overlay in between.
    forgetActiveOverlay();
    if(result.extra.importChooser){ openImportChooser(null, { replace: true }); return; }
    // v3.128.0: a thing with a page of its own lands there.
    if(result.extra.detail){ openDetail(result.extra.detail.kind, result.extra.detail.id, { replace: true }); return; }
    goToPlace(result.page, result.extra, { replace: true });
  });
  document.addEventListener("click", function(e){
    var link = e.target.closest("[data-detail]");
    if(link){ e.preventDefault(); e.stopPropagation(); openDetail(link.getAttribute("data-detail"), link.getAttribute("data-detail-id")); return; }
    // Never history.length: it counts the other sites earlier in the tab, and Back would leave the app.
    if(e.target.closest("[data-detail-back]")){ goBackInApp(); return; }
    if(e.target.closest("[data-detail-edit]")){
      var v = detailView(detailTarget.kind, detailTarget.id);
      if(v && v.edit) goToPlace(v.edit.to.page, v.edit.to);
    }
  }, true);
  document.getElementById("searchRoot").addEventListener("input", function(e){
    if(e.target.id === "searchInput") setSearchQuery(e.target.value);
  });
  document.getElementById("searchRoot").addEventListener("cancel", function(e){
    e.preventDefault(); requestCloseActiveOverlay();
  }, true);
  document.getElementById("searchRoot").addEventListener("keydown", function(e){
    if(e.key === "Tab"){
      var stops = Array.from(document.querySelectorAll(".search-dialog input, .search-dialog button"));
      var first = stops[0], last = stops[stops.length - 1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      return;
    }
    if(e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter") return;
    var buttons = Array.from(document.querySelectorAll("[data-search-result]"));
    if(!buttons.length) return;
    var index = buttons.indexOf(document.activeElement);
    if(e.key === "Enter"){
      if(e.target.id === "searchInput"){ e.preventDefault(); buttons[0].click(); }
      return;
    }
    if(index < 0 && e.target.id !== "searchInput") return;
    e.preventDefault();
    var next = index < 0 ? (e.key === "ArrowDown" ? 0 : buttons.length - 1)
      : (index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    if(document.querySelector("[data-search-backdrop]")) requestCloseActiveOverlay();
  });
}

export { openSearchOverlay };
