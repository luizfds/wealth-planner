import { searchApp } from "../lib/search.js";
import { escapeAttr } from "../lib/html.js";

// A full-screen-modal (mirrors the Review-expenses flow's own .review-backdrop/.review-panel)
// rather than a small anchored dropdown like the notifications panel — search needs room for a
// comfortable input plus a scrollable results list, and doesn't need to visually anchor back to
// whichever of the two trigger buttons (mobile header vs. desktop topbar) opened it.
function resultRowHtml(r, idx){
  return '<button type="button" class="search-result" data-search-result="' + idx + '">' +
    '<span class="search-result-type">' + escapeAttr(r.type) + '</span>' +
    '<span class="search-result-body">' +
      '<span class="search-result-label">' + escapeAttr(r.label) + '</span>' +
      (r.sublabel ? '<span class="search-result-sub">' + escapeAttr(r.sublabel) + '</span>' : '') +
    '</span>' +
  '</button>';
}

// Only this inner list re-renders on every keystroke — the <input> itself is built once in
// openSearch() and left alone, so typing never loses focus/cursor position the way rebuilding
// the whole panel on each keystroke would.
function renderSearchResultsList(query){
  var el = document.getElementById("searchResultsList");
  if(!el) return;
  var q = (query || "").trim();
  if(!q){
    el.innerHTML = '<p class="search-empty">Search expenses, transactions, income, assets, properties, debts and accounts by name.</p>';
    return;
  }
  var results = searchApp(q);
  el.innerHTML = results.length
    ? '<div class="search-results">' + results.map(resultRowHtml).join("") + '</div>'
    : '<p class="search-empty">No matches for "' + escapeAttr(q) + '".</p>';
}

export function openSearch(){
  var root = document.getElementById("searchRoot");
  if(!root) return;
  root.innerHTML =
    '<div class="review-backdrop" data-search-backdrop>' +
      '<div class="review-panel search-panel">' +
        '<div class="search-input-row">' +
          '<svg class="search-icon" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="9" r="6"/><path d="M17 17l-4-4"/></svg>' +
          '<input type="text" id="searchInput" placeholder="Search everything..." aria-label="Search" autocomplete="off">' +
          '<button type="button" class="icon-btn" data-search-close aria-label="Close search">✕</button>' +
        '</div>' +
        '<div id="searchResultsList"></div>' +
      '</div>' +
    '</div>';
  renderSearchResultsList("");
  var input = document.getElementById("searchInput");
  if(input) input.focus();
}
export function closeSearch(){
  var root = document.getElementById("searchRoot");
  if(root) root.innerHTML = "";
}
export function setSearchQuery(query){
  renderSearchResultsList(query);
}
// Re-derives the exact same list the visible results were built from, so app.js's click handler
// can resolve which record a data-search-result index points at without a separate cache to keep
// in sync — searchApp() is cheap and deterministic at this app's data sizes.
export function getSearchResults(query){
  return searchApp(query);
}
