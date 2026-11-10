// ---------------- One line per page (#305, step 2 — docs/design/attention.md) ----------------
//
// A page used to carry a strip of "The app notices" cards above its content: 151px on every Tax tab, 274px on
// Plan → Scenarios. It now carries one line — how many things are about this view, and the first of them —
// which opens the bell showing only those. Nothing when there is nothing, which is most views.
import { viewItems, attentionLineHtml } from "../lib/attention.js";
import { currentView } from "./nav.js";

var lastKey = null;

// One element, moved to whichever page is on screen: under its tab rail, above its content.
function lineEl(){
  var el = document.getElementById("attentionLine");
  if(!el){ el = document.createElement("div"); el.id = "attentionLine"; el.className = "attn-line-wrap"; el.hidden = true; }
  return el;
}
export function renderAttentionLine(force){
  if(typeof document === "undefined") return;
  var page = document.querySelector(".app-page:not([hidden])");
  if(!page) return;
  var view = currentView(), key = view.page + "/" + (view.sub || "");
  var el = lineEl();
  if(!force && key === lastKey && el.parentElement === page) return;
  lastKey = key;
  var html = "";
  try { html = attentionLineHtml(viewItems(view)); } catch(e){ html = ""; }
  if(el.parentElement !== page){
    var rails = page.querySelectorAll(":scope > .subnav");
    if(rails.length) rails[rails.length - 1].insertAdjacentElement("afterend", el); else page.insertAdjacentElement("afterbegin", el);
  }
  if(el.innerHTML !== html) el.innerHTML = html;
  if(el.hidden !== !html) el.hidden = !html;
}
// Tabs are shown by `hidden`, by several functions; watching for it catches every way a view changes.
export function wireAttentionLine(){
  var scheduled = false;
  new MutationObserver(function(){
    if(scheduled) return;
    scheduled = true;
    requestAnimationFrame(function(){ scheduled = false; renderAttentionLine(false); });
  }).observe(document.getElementById("appContent"), { subtree: true, attributes: true, attributeFilter: ["hidden"] });
}
