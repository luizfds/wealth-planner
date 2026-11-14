import { updatePageHelp } from "../lib/help.js";
import { state } from "../state.js";
import { getTaxPeople } from "../calc/tax.js";
import { importChoices, importChooserHtml } from "./importchooser.js";
import { showPage, showExpensesSubpage, showAssetsSubpage, showTaxSubpage, showAccountsSubpage } from "./nav.js";
import { closeAllOverflowMenus } from "./overlays.js";
import { pushActiveOverlay, requestCloseActiveOverlay, forgetActiveOverlay } from "../lib/overlaystack.js";
import { showToast } from "../lib/toast.js";

function importContext(){
  return { people: getTaxPeople().length, properties: (state.properties || []).filter(function(p){ return p.kind === "IP"; }).length,
    shares: (state.assets || []).filter(function(a){ return a.category === "Shares"; }).length };
}
var chooser = null, chooserOpener = null;
function closeImportChooser(){
  if(!chooser) return;
  chooser.close(); chooser.remove(); chooser = null;
  var target = chooserOpener && chooserOpener.isConnected && chooserOpener.getClientRects().length ? chooserOpener : document.getElementById("avatarBtn");
  chooserOpener = null;
  if(target) target.focus();
}
function revealImportTarget(target){
  for(var parent = target.parentElement; parent; parent = parent.parentElement){
    if(parent.tagName === "DETAILS") parent.open = true;
  }
  var menu = target.closest('[data-overflow-menu]');
  if(menu && menu.hidden){
    var toggle = menu.parentElement.querySelector('[data-overflow-toggle]');
    if(toggle) toggle.click();
  }
  target.scrollIntoView({ block: "center" });
  target.focus({ preventScroll: true });
}
async function goToImport(choice){
  closeImportChooser(); forgetActiveOverlay();
  if(await showPage(choice.page, { replace: true }) === false) return;
  if(choice.page === "expenses") await showExpensesSubpage(choice.sub, { replace: true });
  if(choice.page === "assets") await showAssetsSubpage(choice.sub, { replace: true });
  if(choice.page === "tax") await showTaxSubpage(choice.sub, { replace: true });
  if(choice.page === "settings") await showAccountsSubpage(choice.sub, { replace: true });
  if(choice.tool){
    var tool = document.querySelector('[data-asset-list-tool="' + choice.tool + '"]');
    if(tool) tool.click();
  }
  // Header import/export controls follow the active subtab; reveal them synchronously
  // before focusing, rather than waiting for help's mutation-observer pass.
  updatePageHelp();
  var target = document.querySelector(choice.target);
  if(target) revealImportTarget(target);
  else showToast("Open this page's import tool to continue.");
}
export function openImportChooser(preferred, opts){
  if(chooser) return;
  chooserOpener = opts && opts.opener || document.activeElement;
  var openerMenu = chooserOpener && chooserOpener.closest("[data-overflow-menu]");
  if(openerMenu) chooserOpener = openerMenu.parentElement.querySelector("[data-overflow-toggle]");
  closeAllOverflowMenus(null);
  chooser = document.createElement("dialog");
  chooser.className = "app-dialog import-chooser";
  chooser.setAttribute("aria-labelledby", "importChooserTitle");
  chooser.setAttribute("aria-describedby", "importChooserHelp");
  chooser.innerHTML = importChooserHtml(importContext());
  document.body.appendChild(chooser);
  chooser.addEventListener("cancel", function(e){ e.preventDefault(); requestCloseActiveOverlay(); });
  chooser.addEventListener("click", function(e){
    var bounds = chooser.getBoundingClientRect();
    var backdrop = e.target === chooser && (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom);
    if(e.target.closest('[data-import-close]') || backdrop){ requestCloseActiveOverlay(); return; }
    var button = e.target.closest('[data-import-choice]');
    if(!button) return;
    var choice = importChoices(importContext()).find(function(c){ return c.key === button.getAttribute("data-import-choice"); });
    if(choice) goToImport(choice);
  });
  chooser.addEventListener("keydown", function(e){
    e.stopPropagation();
    if(e.key !== "Tab") return;
    var stops = Array.from(chooser.querySelectorAll("button")), first = stops[0], last = stops[stops.length - 1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });
  chooser.showModal();
  pushActiveOverlay(closeImportChooser, !!(opts && opts.replace));
  var choice = importChoices(importContext()).find(function(c){ return c.key === preferred; });
  if(choice) chooser.querySelector('[data-import-choice="' + choice.key + '"]').focus();
}
export function wireImportChooser(){
  document.addEventListener("click", function(e){
    var open = e.target.closest('[data-import-open]');
    if(open) openImportChooser(open.getAttribute("data-import-open"), { opener: open });
  });
}
