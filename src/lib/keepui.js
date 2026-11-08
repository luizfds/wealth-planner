// ---------------- Keeping your place through a redraw ----------------
//
// A view redraws by replacing its markup. Anything the person was on goes with it: the focused control (focus falls
// to the page body, so a keyboard user is sent back to the top) and any section they'd opened (a row editor's
// "More options" closes again). The redraw might not even be theirs: the app's own price and cash-rate refresh,
// a moment after it opens, redraws whatever is on screen. (Found by the keyboard and validation journeys, #274.)
//
// keepUi(draw) runs draw() and then puts those back on the elements that replaced them. It finds a replacement by
// a key: the element's tag, data-* attributes and first class, and its ancestors' up to the nearest id. It does
// almost nothing unless the draw removed the focused element or an open section, so a redraw costs what it did. It
// never takes focus from where something else deliberately put it: only when focus fell to the page body.

function uiKey(el){
  var parts = [];
  for(var n = el, depth = 0; n && n.nodeType === 1 && n !== document.body && depth < 8; n = n.parentElement, depth++){
    var seg = n.tagName.toLowerCase();
    if(n.id){ parts.push(seg + "#" + n.id); break; }
    var data = [];
    for(var i = 0; i < n.attributes.length; i++){
      var a = n.attributes[i];
      if(a.name.indexOf("data-") === 0) data.push([a.name, a.value].join("\u0001")); // a lookup key, never markup
    }
    if(n.classList && n.classList.length) seg += "." + n.classList[0];
    parts.push(seg + (data.length ? "[" + data.sort().join(",") + "]" : ""));
  }
  return parts.join("<");
}
function findByKey(tag, key, test){
  var all = document.getElementsByTagName(tag);
  for(var i = 0; i < all.length; i++) if(uiKey(all[i]) === key && (!test || test(all[i]))) return all[i];
  return null;
}
var visible = function(el){ return el.getClientRects().length > 0; };

export function keepUi(draw){
  if(typeof document === "undefined" || !document.body || typeof document.querySelectorAll !== "function") return draw();
  // Keys are taken now, while the elements are still in the page — once removed, their ancestors are gone.
  var focused = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
  var focusedKey = focused ? uiKey(focused) : null;
  var open = Array.prototype.map.call(document.querySelectorAll("details[open]"), function(d){ return { el: d, key: uiKey(d) }; });
  try { return draw(); }
  finally {
    // Only what the draw removed: a section that's still in the page is as the person left it.
    open.forEach(function(o){
      if(o.el.isConnected) return;
      var again = findByKey("details", o.key, function(x){ return !x.open; });
      if(again) again.open = true;
    });
    if(focused && !focused.isConnected && (!document.activeElement || document.activeElement === document.body)){
      var to = findByKey(focused.tagName.toLowerCase(), focusedKey, visible);
      if(to) to.focus({ preventScroll: true });
    }
  }
}
