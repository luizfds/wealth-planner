// ---------------- "Show more on this page" (#414) ----------------
// In Simple mode, a page that has advanced parts ends with one button that brings them back for this visit. One
// element, moved to whichever page is on screen, like the attention line.
import { isSimple, advancedOnPage, showAdvancedOnPage, simpleOfferDue } from "../lib/mode.js";

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

// #426: Today's one-time offer of Simple, to a household that started in Advanced.
export function renderSimpleOffer(){
  var offer = document.getElementById("modeOffer");
  if(!offer) return;
  var due = simpleOfferDue();
  // Its buttons go with it; focus that was on them moves to the page's first heading rather than the page body.
  if(!due && offer.contains(document.activeElement)){ var t = document.getElementById("pageTitle"); if(t){ t.setAttribute("tabindex", "-1"); t.focus({ preventScroll: true }); } }
  offer.hidden = !due;
}
