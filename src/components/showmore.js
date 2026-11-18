// ---------------- "Show more on this page" (#414) ----------------
// In Simple mode, a page that has advanced parts ends with one button that brings them back for this visit. One
// element, moved to whichever page is on screen, like the attention line.
import { isSimple, advancedOnPage, showAdvancedOnPage } from "../lib/mode.js";

function el(){
  var wrap = document.getElementById("showMoreHere");
  if(!wrap){
    wrap = document.createElement("div");
    wrap.id = "showMoreHere"; wrap.className = "show-more-here"; wrap.hidden = true;
    wrap.innerHTML = '<button type="button" class="btn btn-sm btn-ghost" data-show-more>Show more on this page</button>';
  }
  return wrap;
}
export function renderShowMore(){
  if(typeof document === "undefined") return;
  var page = document.querySelector(".app-page:not([hidden])");
  var wrap = el();
  if(page && wrap.parentElement !== page) page.appendChild(wrap);
  wrap.hidden = !(page && isSimple() && advancedOnPage(page).length);
  document.querySelectorAll("[data-mode-toggle]").forEach(function(box){ box.checked = !isSimple(); });
}
export function showMoreHere(){
  var page = document.querySelector(".app-page:not([hidden])");
  if(!page) return;
  showAdvancedOnPage(page);
  renderShowMore();
}
