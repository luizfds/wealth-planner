import { state } from "../state.js";
import { TOUR_STEPS, tourStatus, setTourStatus, offerTourOnce, placeTourCard } from "../lib/tour.js";
import { setupSteps } from "../lib/setup.js";
import { pushModalOverlay, overlayOpen } from "../lib/overlaystack.js";
import { dialogOpen } from "../lib/dialogs.js";
import { showToast } from "../lib/toast.js";
import { tourOfferHtml, tourShellHtml, tourStepHtml } from "./tour.js";
import { setupOpts } from "./dashboard.js";
import { closeAllOverflowMenus } from "./overlays.js";
import { showPage, showPlanSubpage, showExpensesSubpage, currentPageId, currentView } from "./nav.js";

// ---------------- The quick tour (#339) ----------------
// A card that walks the menu, one place at a time, with the place itself on screen behind it. It is a
// detour: pages change underneath without touching the address bar, and closing it — Done, Skip, Escape
// or the phone's Back — puts the page it started from back. Only the last step's links go somewhere.
var tour = { open: false, starting: false, step: 0, seq: 0, start: null, opener: null, inert: [], close: null, dest: null, checklist: [] };
var root = null;

function store(){ try { return window.localStorage; } catch(e){ return null; } }

export function renderTourOffer(){
  var el = document.getElementById("tourOffer");
  if(!el) return;
  var show = tourStatus(store()) === "offer" && !tour.open;
  // Drawn only when it changes, so a redraw of Home never takes the focus off its buttons.
  if(show === !el.hidden) return;
  el.hidden = !show;
  el.innerHTML = show ? tourOfferHtml() : "";
}
// Someone has just arrived — the setup sheet closed, or the sample household loaded. Asks once, ever.
export function offerTour(){
  if(offerTourOnce(store())) renderTourOffer();
}

function onScreen(el){
  if(!el || el.hidden || !el.getClientRects().length) return false;
  var r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
}
function inViewport(r){
  return r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= document.documentElement.clientWidth;
}
function targetOf(step, bringIntoView){
  var found = null;
  (step.targets || []).some(function(sel){
    var el = document.querySelector(sel);
    if(onScreen(el)){ found = el; return true; }
    return false;
  });
  if(found && bringIntoView && !inViewport(found.getBoundingClientRect())) found.scrollIntoView({ block: "center" });
  return found;
}
function position(){
  if(!tour.open) return;
  var step = TOUR_STEPS[tour.step], el = targetOf(step, false);
  var card = root.querySelector(".tour-card"), spot = root.querySelector("[data-tour-spot]"), dim = root.querySelector("[data-tour-dim]");
  var box = null;
  if(el){
    var r = el.getBoundingClientRect(), pad = 6;
    // Kept inside the screen: a tab against the edge is ringed up to the edge, not past it.
    var vw = document.documentElement.clientWidth, vh = window.innerHeight;
    var x0 = Math.max(2, r.left - pad), y0 = Math.max(2, r.top - pad), x1 = Math.min(vw - 2, r.right + pad), y1 = Math.min(vh - 2, r.bottom + pad);
    if(x1 - x0 > 8 && y1 - y0 > 8) box = { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
  }
  spot.hidden = !box;
  dim.classList.toggle("is-plain", !box);
  if(box){
    spot.style.left = box.left + "px"; spot.style.top = box.top + "px";
    spot.style.width = box.width + "px"; spot.style.height = box.height + "px";
  }
  var c = card.getBoundingClientRect();
  var at = placeTourCard(box, { width: c.width, height: c.height }, { width: document.documentElement.clientWidth, height: window.innerHeight },
    // Beside the sidebar's entry rather than over the ones under it; everywhere else, under or over.
    el && el.matches(".nav-item") ? "right" : null);
  card.style.left = Math.round(at.left) + "px"; card.style.top = Math.round(at.top) + "px";
  card.setAttribute("data-side", at.side);
}
async function showStep(i){
  var step = TOUR_STEPS[i], seq = ++tour.seq;
  tour.step = i;
  try {
    if(step.page && currentPageId() !== step.page) await showPage(step.page, { skipUrl: true });
  } catch(e){ /* the step is still worth reading over whichever page is showing */ }
  if(seq !== tour.seq || !tour.open) return;
  if(step.page === "plan" && step.sub && currentView().sub !== step.sub) showPlanSubpage(step.sub, { skipUrl: true });
  if(step.checklist) tour.checklist = setupSteps(state, setupOpts());
  var last = i === TOUR_STEPS.length - 1;
  var back = root.querySelector("[data-tour-back]"), next = root.querySelector("[data-tour-next]"), skip = root.querySelector("[data-tour-skip-btn]");
  var card = root.querySelector(".tour-card"), focused = document.activeElement;
  root.querySelector("[data-tour-live]").innerHTML = tourStepHtml(step, i, TOUR_STEPS.length, tour.checklist);
  back.hidden = i === 0; skip.hidden = last;
  next.textContent = last ? "Done" : "Next";
  targetOf(step, true);
  position();
  if(!card.contains(focused) || focused.hidden || !focused.isConnected) next.focus();
}

function onKey(e){
  // Nothing under the tour answers the keyboard while it's open (the app's shortcuts, a page's Escape).
  e.stopImmediatePropagation();
  if(e.key === "Escape"){ e.preventDefault(); endTour(); return; }
  if(e.key === "ArrowRight" && tour.step < TOUR_STEPS.length - 1){ e.preventDefault(); showStep(tour.step + 1); return; }
  if(e.key === "ArrowLeft" && tour.step > 0){ e.preventDefault(); showStep(tour.step - 1); return; }
  if(e.key !== "Tab") return;
  var card = root.querySelector(".tour-card");
  var stops = Array.from(card.querySelectorAll("button")).filter(function(el){ return !el.hidden && !el.disabled; });
  var first = stops[0], last = stops[stops.length - 1];
  if(e.shiftKey && (document.activeElement === first || !card.contains(document.activeElement))){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && (document.activeElement === last || !card.contains(document.activeElement))){ e.preventDefault(); first.focus(); }
}

export async function startTour(){
  if(tour.open || tour.starting || dialogOpen() || overlayOpen()) return;
  tour.starting = true;
  try {
    var opener = document.activeElement;
    closeAllOverflowMenus(null);
    // An unsaved scenario asks before it's left, exactly as it does for any other way out of it.
    if(currentPageId() === "scenario" && !(await showPage("plan"))) return;
    tour.open = true; tour.dest = null; tour.opener = opener; tour.start = currentView();
    root.innerHTML = tourShellHtml();
    // Modal: the app behind is out of reach of the keyboard and of a screen reader until the tour closes.
    tour.inert = Array.from(document.body.children).filter(function(el){ return el !== root && !el.inert; });
    tour.inert.forEach(function(el){ el.inert = true; });
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, { passive: true });
    // Its own history entry, so a phone's Back closes the tour instead of leaving the app.
    tour.close = pushModalOverlay(closed);
    renderTourOffer();
    await showStep(0);
  } finally { tour.starting = false; }
}
function endTour(dest){
  if(!tour.open) return;
  tour.dest = dest || null;
  tour.close();
}
function closed(){
  if(!tour.open) return;
  var finished = tour.step === TOUR_STEPS.length - 1, dest = tour.dest, start = tour.start, opener = tour.opener;
  tour.open = false; tour.seq++; tour.close = null; tour.opener = null;
  document.removeEventListener("keydown", onKey, true);
  window.removeEventListener("resize", position);
  window.removeEventListener("scroll", position);
  root.innerHTML = "";
  tour.inert.forEach(function(el){ el.inert = false; });
  tour.inert = [];
  setTourStatus(store(), finished ? "done" : "skipped");
  renderTourOffer();
  if(dest){
    // A first step chosen from the last card: the place, its tab, and the card on it opened and in view.
    showPage(dest.page);
    if(dest.sub && dest.page === "expenses") showExpensesSubpage(dest.sub, { replace: true });
    if(dest.sub && dest.page === "plan") showPlanSubpage(dest.sub, { replace: true });
    var card = dest.open && document.getElementById(dest.open);
    if(card){ card.open = true; setTimeout(function(){ card.scrollIntoView({ behavior: "smooth", block: "start" }); }, 120); }
    return;
  }
  // The address bar never moved, so the page it names is the one to put back.
  if(currentPageId() !== start.page) showPage(start.page, { skipUrl: true });
  if(start.page === "plan" && start.sub && currentView().sub !== start.sub) showPlanSubpage(start.sub, { skipUrl: true });
  setTimeout(function(){
    if(tour.open) return;
    var target = opener && opener.isConnected && onScreen(opener) ? opener : document.getElementById("avatarBtn");
    if(target) target.focus();
  }, 0);
}

export function wireTour(){
  root = document.getElementById("tourRoot");
  document.addEventListener("click", function(e){
    if(e.target.closest("[data-tour-start]")){ startTour(); return; }
    if(e.target.closest("[data-tour-skip]")){
      setTourStatus(store(), "skipped");
      renderTourOffer();
      showToast("Skipped — “Take a tour” is in your menu, top right");
      var menu = document.getElementById("avatarBtn");
      if(menu) menu.focus();
    }
  });
  root.addEventListener("click", function(e){
    if(!tour.open) return;
    var go = e.target.closest("[data-tour-go]");
    if(go){ endTour(tour.checklist[Number(go.getAttribute("data-tour-go"))]); return; }
    if(e.target.closest("[data-tour-end]")){ endTour(); return; }
    if(e.target.closest("[data-tour-back]")){ if(tour.step > 0) showStep(tour.step - 1); return; }
    if(e.target.closest("[data-tour-next]")){
      if(tour.step < TOUR_STEPS.length - 1) showStep(tour.step + 1); else endTour();
    }
  });
  renderTourOffer();
}
