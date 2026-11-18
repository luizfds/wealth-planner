// ---------------- Simple and Advanced (#414, docs/design/simpler-navigation.md step 5) ----------------
//
// One rendering, some of it hidden. A part that most households use now and then carries data-level="advanced"; in
// Simple mode one rule (styles/utilities.css) hides it. No component draws itself differently by mode — the
// Classic/Modern split was removed because two renderings of one page drifted apart, and this must not bring it back.
// Calculations are untouched: every total still counts everything.
//
// What's marked is an entry point or a secondary section (a tab, a link, a fold), never a view itself, so a notice, a
// link or search that goes to an advanced view still opens it.
//
// Kept per device, like the tour (localStorage, not state): a partner on another device can choose differently, and
// syncing a household doesn't change how it looks here.
export var MODE_KEY = "wealthPlanner.mode";

function storage(){ try { return window.localStorage; } catch(e){ return null; } }
export function storedMode(store){
  var s = store || storage();
  try { var v = s && s.getItem(MODE_KEY); return v === "simple" || v === "advanced" ? v : null; } catch(e){ return null; }
}
// The first time this version opens: a household that already has something in it keeps everything it had on screen
// (Advanced); a new one starts Simple. Decided once and remembered.
export function initialMode(householdHasData, store){
  var known = storedMode(store);
  if(known) return known;
  var mode = householdHasData ? "advanced" : "simple";
  setStoredMode(mode, store);
  return mode;
}
export function setStoredMode(mode, store){
  var s = store || storage();
  try { if(s) s.setItem(MODE_KEY, mode); } catch(e){}
}
export function isSimple(){
  return typeof document !== "undefined" && !!document.documentElement && document.documentElement.getAttribute("data-mode") === "simple";
}
export function applyMode(mode){
  if(typeof document === "undefined" || !document.documentElement) return;
  document.documentElement.setAttribute("data-mode", mode === "simple" ? "simple" : "advanced");
  hideShownAgain();
}
// "Show more on this page": this page's advanced parts, for this visit. Leaving the page folds them away again.
export function advancedOnPage(page){
  if(!page) return [];
  return Array.prototype.filter.call(page.querySelectorAll('[data-level="advanced"]:not([data-shown])'), function(el){
    return !el.parentElement || !el.parentElement.closest("[hidden]");
  });
}
export function showAdvancedOnPage(page){
  advancedOnPage(page).forEach(function(el){ el.setAttribute("data-shown", ""); });
}
export function hideShownAgain(){
  if(typeof document === "undefined" || !document.querySelectorAll) return;
  document.querySelectorAll('[data-level="advanced"][data-shown]').forEach(function(el){ el.removeAttribute("data-shown"); });
}
