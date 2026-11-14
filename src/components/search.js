import { searchApp, resolveSearchResult } from "../lib/search.js";
import { escapeAttr } from "../lib/html.js";
import { emptyStateHtml } from "../lib/empty.js";

// A full-screen-modal (mirrors the Review-expenses flow's own .review-backdrop/.review-panel)
// rather than a small anchored dropdown like the notifications panel — search needs room for a
// comfortable input plus a scrollable results list, and doesn't need to visually anchor back to
// whichever of the two trigger buttons (mobile header vs. desktop topbar) opened it.
var visibleResults = [];

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
  visibleResults = searchApp(q);
  var status = document.getElementById("searchStatus");
  if(status) status.textContent = q ? visibleResults.length + " result" + (visibleResults.length === 1 ? "" : "s") : "";
  if(!q){
    el.innerHTML = emptyStateHtml('Search records by name, person, account or date, or find Reports, Calculators and Import rules.', { done: true, className: 'search-empty' });
    return;
  }
  var results = visibleResults;
  el.innerHTML = results.length
    ? '<div class="search-results">' + results.map(resultRowHtml).join("") + '</div>'
    : emptyStateHtml('No matches for "' + q + '". Try a shorter name, account or person.', { done: true, className: 'search-empty' });
}

export function openSearch(){
  var root = document.getElementById("searchRoot");
  if(!root) return;
  root.innerHTML =
    '<dialog class="search-dialog" aria-label="Search everything"><div class="review-backdrop" data-search-backdrop>' +
      '<div class="review-panel search-panel">' +
        '<div class="search-input-row">' +
          '<svg class="search-icon" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="9" r="6"/><path d="M17 17l-4-4"/></svg>' +
          '<input type="text" id="searchInput" class="field-control" placeholder="Search everything..." aria-label="Search" autocomplete="off">' +
          '<button type="button" class="icon-btn" data-search-close aria-label="Close search">✕</button>' +
        '</div>' +
        '<p id="searchStatus" class="search-empty" role="status"></p><div id="searchResultsList"></div>' +
      '</div>' +
    '</div></dialog>';
  root.querySelector('dialog').showModal();
  renderSearchResultsList("");
  var input = document.getElementById("searchInput");
  if(input) input.focus();
}
export function closeSearch(){
  var root = document.getElementById("searchRoot");
  if(root){
    var dialog = root.querySelector("dialog");
    if(dialog) dialog.close();
    root.innerHTML = "";
  }
  visibleResults = [];
}
export function setSearchQuery(query){
  var status = document.getElementById("searchStatus");
  if(status) status.textContent = "";
  renderSearchResultsList(query);
}
// Resolve the identity rendered on screen, even if rows were reordered or renamed meanwhile.
export function getSearchResult(index){
  var shown = visibleResults[index];
  return shown ? resolveSearchResult(shown.key) : null;
}
export function unavailableSearchResult(){
  var status = document.getElementById("searchStatus");
  if(status) status.textContent = "That record is no longer available. Search again to see current records.";
}
