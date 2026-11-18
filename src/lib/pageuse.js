// ---------------- Which screens get opened, on this device only (#426) ----------------
//
// A count per screen ("expenses/spending", "tax/returns", "detail/asset") of how often it was opened here. It lives in
// localStorage like the tour and the mode — never in `state`, so it is never synced, exported in a backup or sent
// anywhere. Settings → Preferences shows the screens rarely opened, and Clear (or Reset) forgets it all.
//
// Pure apart from the store, which a test passes in.

export var USE_KEY = "wealthPlanner.pageUse";
var MAX_KEYS = 200;

function storage(){ try { return window.localStorage; } catch(e){ return null; } }
export function readUse(store){
  var s = store || storage();
  try {
    var v = JSON.parse((s && s.getItem(USE_KEY)) || "null");
    return v && typeof v === "object" && v.views && typeof v.views === "object" ? v : { since: null, views: {} };
  } catch(e){ return { since: null, views: {} }; }
}
export function recordView(key, today, store){
  if(!key) return;
  var s = store || storage();
  if(!s) return;
  var use = readUse(s);
  if(!use.since) use.since = today || null;
  if(!(key in use.views) && Object.keys(use.views).length >= MAX_KEYS) return;
  use.views[key] = (Number(use.views[key]) || 0) + 1;
  try { s.setItem(USE_KEY, JSON.stringify(use)); } catch(e){}
}
export function clearUse(store){
  var s = store || storage();
  try { if(s) s.removeItem(USE_KEY); } catch(e){}
}
// The screens of `known` opened at most `atMost` times, once `minTotal` opens have been counted — before that, every
// screen is "rarely opened" and saying so would mean nothing.
export function rarelyOpened(known, use, opts){
  opts = opts || {};
  var views = (use && use.views) || {};
  var total = Object.keys(views).reduce(function(n, k){ return n + (Number(views[k]) || 0); }, 0);
  if(total < (opts.minTotal || 50)) return null;
  var atMost = opts.atMost || 0;
  return known.filter(function(k){ return opened(views, k.key) <= atMost; });
}
// A screen's opens, its own and its children's: "reports" counts every report, "tax/returns" only itself.
function opened(views, key){
  return Object.keys(views).reduce(function(n, k){ return n + (k === key || k.indexOf(key + "/") === 0 ? Number(views[k]) || 0 : 0); }, 0);
}
