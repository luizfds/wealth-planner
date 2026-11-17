// ---------------- Pages drawn when seen (v3.205.0, item 236a) ----------------
//
// A full redraw used to draw every page into its hidden section — the household's Home, Cash flow, Net worth,
// Tax, Plan, Reports and Settings — whichever one was on screen: about 0.9s on a phone with a real household,
// at startup and after every edit that asked for it. Now each part of a full redraw is a *view* that says which
// pages it draws into. drawViews() draws the views on the page that's showing and those on every page (the
// header, the badges); the rest are marked stale and drawn when their page is opened (drawStale, called by
// nav.js just before a page is shown). Which pages each view draws into was measured, not guessed: each one
// run under a MutationObserver, the pages its writes landed in recorded.
//
// pages: an array of page ids ("expenses", "plan"…) or null for a view on every page.
import { keepUi } from "./keepui.js";
var views = [];
var stale = {};

// v3.206.0 (item 236b): reads — the top-level keys of `state` it draws from (["*"]: anything), plus "balances"
// for a view showing what's in an account, a loan or an offset (a transfer moves those without touching
// anything else about the records); opts.later — drawn
// just after the edit's frame rather than inside it (the bell's count, which reads everything and is slow).
// opts.tabs — on a page with tabs, the tabs' elements the view draws into ({ expenses: ["expensesSub-bills"] }): on
// another tab of that page it is left stale like a page not showing, and drawn when one of them is shown (nav.js
// calls drawStale on a tab change). Saving a transfer on Spending redrew the hidden Bills calendar and, for one
// block on Budget, the whole Property page.
export function defineView(name, pages, draw, reads, opts){
  views.push({ name: name, pages: pages, draw: draw, reads: reads || ["*"], later: !!(opts && opts.later), tabs: (opts && opts.tabs) || null });
}
function shows(view, page){
  if(!view.pages) return true;
  if(!page || view.pages.indexOf(page) === -1) return false;
  var tabs = view.tabs && view.tabs[page];
  if(!tabs || typeof document === "undefined") return true;
  return tabs.some(function(id){ var el = document.getElementById(id); return !!el && !el.hidden; });
}
var laterQueued = {};
function run(view, now){
  if(view.later && !now){
    if(laterQueued[view.name]) return;
    laterQueued[view.name] = true;
    delete stale[view.name];
    setTimeout(function(){ delete laterQueued[view.name]; run(view, true); }, 0);
    return;
  }
  delete stale[view.name];
  // keepUi: the focused control and any open section survive the view's markup being replaced (lib/keepui.js).
  try { keepUi(view.draw); }
  catch(e){ setTimeout(function(){ throw e; }, 0); } // reported (lib/errorlog.js), without stopping the others
}
// The page on screen: what nav.js last showed.
export function currentPageId(){
  return typeof document !== "undefined" && document.body ? document.body.getAttribute("data-current-page") || "" : "";
}
// A full redraw: the page on screen and every page's own bits now, the rest when opened. opts.all draws every
// view whatever's showing (printing, a test).
export function drawViews(opts){
  var page = currentPageId();
  views.forEach(function(v){
    if((opts && opts.all) || shows(v, page)) run(v);
    else stale[v.name] = true;
  });
}
// Just before a page is shown, and when one of its tabs is: anything stale that draws into what's showing.
export function drawStale(page){
  views.forEach(function(v){ if(stale[v.name] && v.pages && shows(v, page)) run(v); });
}
export function staleViews(){ return Object.keys(stale); }
// Some views, by name: drawn now if they show on the page on screen, else left stale for when it's opened. What
// an edit's own redraw uses, so it draws only what's on screen too.
export function redraw(names){
  var page = currentPageId();
  names.forEach(function(n){
    var v = views.find(function(x){ return x.name === n; });
    if(!v) return;
    if(shows(v, page)) run(v); else stale[v.name] = true;
  });
}

// v3.206.0 (item 236b): after an edit (state.js commit, via onCommit): the views that read what it touched —
// drawn if they're on the page on screen, else left stale for when it's opened. Nothing else is drawn.
export function viewsReading(touched){
  var all = touched.indexOf("*") !== -1;
  return views.filter(function(v){ return all || v.reads.indexOf("*") !== -1 || v.reads.some(function(r){ return touched.indexOf(r) !== -1; }); })
    .map(function(v){ return v.name; });
}
export function redrawTouched(touched){ redraw(viewsReading(touched)); }
