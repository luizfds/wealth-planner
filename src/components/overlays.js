// ---------------- Overlays: the stack Back closes, and sheets on a phone (v3.206.1, item 237) ----------------
//
// Which overlay Back and Escape close (pushActiveOverlay / requestCloseActiveOverlay), the header's height for
// sticky sections and dragging a sheet closed on a phone.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order. What it shares with app.js it reaches through `app` (lib/appctx.js).
import { app } from "../lib/appctx.js";

// ---------------- Page-header ⋯ menus ----------------
// One delegated handler for all four (Income, Expenses, Properties, Assets). The menu is a
// sibling of its own button inside .page-overflow, so "which menu?" is answered by walking up
// from the click rather than by an id per page.
function closeAllOverflowMenus(except){
  document.querySelectorAll(".page-overflow").forEach(function(wrap){
    if(wrap === except) return;
    var menu = wrap.querySelector("[data-overflow-menu]");
    var btn = wrap.querySelector("[data-overflow-toggle]");
    if(menu) menu.hidden = true;
    if(btn) btn.setAttribute("aria-expanded", "false");
  });
}

export function wirePhoneSheets(){  // v3.167.0 (item 197): an open section's header sticks under the page header on a phone, which
  // changes height as it goes slim — so its height is kept as --topbar-h.
  (function(){
    var bar = document.querySelector(".app-topbar");
    if(!bar || typeof ResizeObserver === "undefined") return;
    new ResizeObserver(function(){ document.documentElement.style.setProperty("--topbar-h", bar.offsetHeight + "px"); }).observe(bar);
  })();  // v3.167.0 (item 197): on a phone, a sheet (a row's editor, any dialog) closes by dragging it down
  // by its top — past 110px, or a quick flick. It follows the finger while dragged and springs back
  // when let go short. Closing goes through the same path as ✕ and the back button.
  (function(){
    var phone = window.matchMedia("(max-width: 880px)"), drag = null;
    function closeSheet(sheet){
      if(app.activeOverlayClose){ app.requestCloseActiveOverlay(); return; }
      var x = sheet.querySelector('.review-head [aria-label="Close"], .review-head .icon-btn');
      if(x) x.click();
    }
    document.addEventListener("touchstart", function(e){
      if(!phone.matches || e.touches.length !== 1) return;
      var head = e.target.closest(".review-backdrop > .review-panel > .review-head, .m-row.open > .m-row-summary");
      if(!head || e.target.closest("input, select, textarea")) return;
      var sheet = head.parentElement;
      drag = { sheet: sheet, y0: e.touches[0].clientY, t0: Date.now(), dy: 0 };
    }, { passive: true });
    document.addEventListener("touchmove", function(e){
      if(!drag) return;
      drag.dy = Math.max(0, e.touches[0].clientY - drag.y0);
      drag.sheet.style.transition = "none";
      drag.sheet.style.transform = "translateY(" + drag.dy + "px)";
    }, { passive: true });
    function end(){
      if(!drag) return;
      var d = drag, flick = d.dy > 40 && d.dy / Math.max(1, Date.now() - d.t0) > 0.6;
      drag = null;
      if(!d.dy){ d.sheet.style.transition = d.sheet.style.transform = ""; return; }
      d.sheet.style.transition = "transform .18s ease";
      if(d.dy > 110 || flick){
        d.sheet.style.transform = "translateY(100%)";
        setTimeout(function(){ d.sheet.style.transition = d.sheet.style.transform = ""; closeSheet(d.sheet); }, 170);
      } else {
        d.sheet.style.transform = "";
        setTimeout(function(){ d.sheet.style.transition = ""; }, 200);
      }
    }
    document.addEventListener("touchend", end);
    document.addEventListener("touchcancel", end);
  })();
}

export function wireOverflowMenus(){  document.addEventListener("click", function(e){
    var toggle = e.target.closest("[data-overflow-toggle]");
    if(toggle){
      var wrap = toggle.closest(".page-overflow");
      var menu = wrap.querySelector("[data-overflow-menu]");
      var willOpen = menu.hidden;
      closeAllOverflowMenus(wrap);
      menu.hidden = !willOpen;
      toggle.setAttribute("aria-expanded", String(willOpen));
      return;
    }
    // A click on an item inside the menu (Export CSV, Import…) closes it too — those handlers run
    // on their own ids and don't know this menu exists, so closing is this handler's job either
    // way, whether the click was inside or outside.
    closeAllOverflowMenus(null);
  });  document.addEventListener("keydown", function(e){
    if(e.key === "Escape") closeAllOverflowMenus(null);
  });
}

export { closeAllOverflowMenus };
