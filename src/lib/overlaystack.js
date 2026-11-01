// ---------------- The overlay Back closes (v3.206.2, item 237b — from app.js) ----------------
//
// Any full-page-feeling overlay in this app (a row's edit modal, cross-page search, expense review)
// pushes exactly one history entry for as long as it's open, and every one of its on-screen close
// affordances (tap outside, an explicit X, Escape) routes through requestCloseActiveOverlay() rather
// than tearing itself down immediately. That makes the same single entry what a device/browser
// back-button press naturally pops too — app.js's popstate handler is the one place that actually runs
// the close callback (closeActiveOverlayNow), whichever way it was triggered. Without this, opening one
// of these silently occupied no space in the browser's back-history, so pressing back while one was
// open fell through to whatever the *page* underneath was doing there instead — another page, or
// leaving the app — rather than just closing the thing in front of you.
var activeOverlayClose = null; // the pure cleanup function for whichever overlay is open, if any

export function pushActiveOverlay(onClose, replace){
  activeOverlayClose = onClose;
  try{ history[replace ? "replaceState" : "pushState"]({ overlayOpen: true }, "", location.href); }catch(e){}
}
export function requestCloseActiveOverlay(){
  if(!activeOverlayClose) return;
  history.back();
}
// Whether an overlay is open.
export function overlayOpen(){ return !!activeOverlayClose; }
// An overlay that closed itself some other way (its history entry already gone): nothing to run.
export function forgetActiveOverlay(){ activeOverlayClose = null; }
// Run the open overlay's close callback now (popstate, nav.js's cleanup); false when none was open.
export function closeActiveOverlayNow(){
  if(!activeOverlayClose) return false;
  var closeOverlay = activeOverlayClose;
  activeOverlayClose = null;
  closeOverlay();
  return true;
}
