// ---------------- Choose one of a few things (#426) ----------------
//
// A small dialog of choices — which investment property a statement is for, which account's balance to update. Taken
// out of rentstatement.js's property picker so the + sheet's "Update a balance" asks the same way. It sits on the
// overlay stack (Back closes it), keeps Tab inside it, and gives focus back to what opened it — or, when that has gone,
// to the first of `fallbacks` still on screen.
//
// opts: { title, help, items: [{ id, label, hint }], cls, attr, valid(id) -> bool, gone, then(id), fallbacks }
// `attr` names the choice buttons' data attribute (data-<attr>="id", data-<attr>-close), so a journey that knew the
// property picker's markup still finds it.

import { escapeAttr } from "./html.js";
import { pushActiveOverlay, requestCloseActiveOverlay } from "./overlaystack.js";
import { showToast } from "./toast.js";

var open = {}, sequence = 0;

export function chooseOne(opts){
  var attr = opts.attr || "choice";
  if(open[attr]){ open[attr].querySelector("button").focus(); return; }
  var opener = document.activeElement, request = ++sequence, closing = false;
  var menu = opener && opener.closest && opener.closest("[data-overflow-menu]");
  if(menu) opener = menu.parentElement.querySelector("[data-overflow-toggle]");
  var root = open[attr] = document.createElement("dialog");
  var titleId = attr + "ChooserTitle", helpId = attr + "ChooserHelp";
  root.className = "app-dialog" + (opts.cls ? " " + opts.cls : "");
  root.setAttribute("aria-labelledby", titleId);
  if(opts.help) root.setAttribute("aria-describedby", helpId);
  root.innerHTML = '<h2 id="' + titleId + '">' + escapeAttr(opts.title) + '</h2>' +
    (opts.help ? '<p id="' + helpId + '">' + escapeAttr(opts.help) + '</p>' : '') +
    '<div class="qfab-actions">' + opts.items.map(function(it){
      return '<button type="button" class="qfab-action' + (opts.cls ? " " + opts.cls + "-choice" : "") + '" data-' + attr + '="' + escapeAttr(it.id) + '"><span class="qfab-action-label">' + escapeAttr(it.label) + '</span>' +
        (it.hint ? '<span class="qfab-action-hint">' + escapeAttr(it.hint) + '</span>' : '') + '</button>';
    }).join("") + '</div><div class="app-dialog-actions"><button type="button" class="btn btn-ghost" data-' + attr + '-close>Cancel</button></div>';
  document.body.appendChild(root);
  function restoreFocus(){
    var target = opener && opener.isConnected ? opener : opener && opener.id ? document.getElementById(opener.id) : null;
    function available(el){ return el && el !== document.body && el.getClientRects().length && !el.disabled && !el.closest("[inert]"); }
    if(!available(target)) target = (opts.fallbacks || ["quickFab", "avatarBtn"]).map(function(id){ return document.getElementById(id); }).find(available);
    if(target) target.focus({ preventScroll: true });
  }
  pushActiveOverlay(function(){
    root.close(); root.remove();
    if(open[attr] === root) open[attr] = null;
    restoreFocus();
  });
  function cancelChoice(){ if(closing) return; closing = true; requestCloseActiveOverlay(); }
  root.addEventListener("cancel", function(e){ e.preventDefault(); cancelChoice(); });
  root.addEventListener("click", function(e){
    if(closing) return;
    var bounds = root.getBoundingClientRect();
    var backdrop = e.target === root && (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom);
    if(e.target.closest("[data-" + attr + "-close]") || backdrop){ cancelChoice(); return; }
    var button = e.target.closest("[data-" + attr + "]");
    if(!button) return;
    var id = button.getAttribute("data-" + attr);
    closing = true;
    requestCloseActiveOverlay().then(function(closed){
      if(!closed || request !== sequence) return;
      if(opts.valid && !opts.valid(id)){ if(opts.gone) showToast(opts.gone); return; }
      opts.then(id);
    });
  });
  root.addEventListener("keydown", function(e){
    e.stopPropagation();
    if(e.key !== "Tab") return;
    var stops = Array.from(root.querySelectorAll("button")), first = stops[0], last = stops[stops.length - 1];
    if(e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))){ e.preventDefault(); first.focus(); }
  });
  root.showModal();
  root.querySelector("[data-" + attr + "]").focus();
}
