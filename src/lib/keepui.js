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
// Long-form invalid drafts also survive when unfocused, so their summaries remain an accurate index.

import { longFormScope } from "./error-summary.js";
import { markField } from "./validate.js";

function uiKey(el){
  var draftKey = el.getAttribute("data-error-key");
  if(draftKey) return el.tagName.toLowerCase() + "[error-key=" + draftKey + "]";
  var parts = [];
  for(var n = el, depth = 0; n && n.nodeType === 1 && n !== document.body && depth < 8; n = n.parentElement, depth++){
    var seg = n.tagName.toLowerCase();
    if(n.id && !n.hasAttribute("data-validation-generated-id")){ parts.push(seg + "#" + n.id); break; }
    var data = [];
    for(var i = 0; i < n.attributes.length; i++){
      var a = n.attributes[i];
      if(a.name.indexOf("data-") === 0 && a.name !== "data-validation-generated-id") data.push([a.name, a.value].join("\u0001")); // a lookup key, never markup
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
  var focusedKey = focused ? uiKey(focused) : null, typing = typingOf(focused);
  var invalid = Array.from(document.querySelectorAll('[data-error-scope] [aria-invalid="true"]')).filter(longFormScope).map(function(el){
    return {el:el, key:uiKey(el), typing:typingOf(el)};
  });
  var open = Array.prototype.map.call(document.querySelectorAll("details[open]"), function(d){ return { el: d, key: uiKey(d) }; });
  try { return draw(); }
  finally {
    // Only what the draw removed: a section that's still in the page is as the person left it.
    open.forEach(function(o){
      if(o.el.isConnected) return;
      var again = findByKey("details", o.key, function(x){ return !x.open; });
      if(again) again.open = true;
    });
    invalid.forEach(function(draft){
      if(draft.el.isConnected) return;
      var to = findByKey(draft.el.tagName.toLowerCase(), draft.key, longFormScope);
      if(to) keepTyping(draft.typing, to);
    });
    if(focused && !focused.isConnected && (!document.activeElement || document.activeElement === document.body)){
      var to = findByKey(focused.tagName.toLowerCase(), focusedKey, visible);
      if(to){ keepTyping(typing, to); to.focus({ preventScroll: true }); }
    }
  }
}

// What was being typed goes across too: the replacement is drawn from what's saved, and a field that doesn't read yet
// (#263) saves nothing — so without this, a redraw mid-typing put the last saved value back, dropped the message saying
// what's wrong, and left the caret at the start for the next key. (Found by the categories journey on CI.)
function typingOf(el){
  if(!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") || /^(checkbox|radio|file|range)$/.test(el.type)) return null;
  var msg = el.getAttribute("aria-invalid") === "true" && el.id ? document.getElementById(el.id + "-error") : null;
  var sel = null;
  try { sel = [el.selectionStart, el.selectionEnd]; } catch(e){ /* number, date: no selection API */ }
  return { generatedId:el.hasAttribute("data-validation-generated-id") ? el.id : null, value: el.value, message: msg && msg.textContent ? msg.textContent : null, sel: sel };
}
function keepTyping(t, to){
  if(!t || to.tagName === "SELECT") return;
  if(t.generatedId && !to.id){ to.id = t.generatedId; to.setAttribute("data-validation-generated-id", ""); }
  if(t.value !== to.value) to.value = t.value;
  if(t.message) markField(to, { ok: false, message: t.message });
  if(t.sel && t.sel[0] != null){ try { to.setSelectionRange(t.sel[0], t.sel[1]); } catch(e){ /* no selection API */ } }
}
