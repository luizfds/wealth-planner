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
var views = [];
var stale = {};

// v3.206.0 (item 236b): reads — the top-level keys of `state` it draws from (["*"]: anything), plus "balances"
// for a view showing what's in an account, a loan or an offset (a transfer moves those without touching
// anything else about the records); opts.later — drawn
// just after the edit's frame rather than inside it (the bell's count, which reads everything and is slow).
export function defineView(name, pages, draw, reads, opts){
  views.push({ name: name, pages: pages, draw: draw, reads: reads || ["*"], later: !!(opts && opts.later) });
}
function shows(view, page){ return !view.pages || (page && view.pages.indexOf(page) !== -1); }
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
  try { view.draw(); }
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
// Just before a page is shown: anything stale that draws into it.
export function drawStale(page){
  views.forEach(function(v){ if(stale[v.name] && v.pages && v.pages.indexOf(page) !== -1) run(v); });
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
