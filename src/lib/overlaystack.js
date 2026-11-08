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
var overlayClosing = false, closedWaiters = [];

export function pushActiveOverlay(onClose, replace){
  activeOverlayClose = onClose;
  overlayClosing = false;
  try{ history[replace ? "replaceState" : "pushState"]({ overlayOpen: true }, "", location.href); }catch(e){}
}
export function requestCloseActiveOverlay(){
  if(!activeOverlayClose) return Promise.resolve();
  return new Promise(function(resolve){
    closedWaiters.push(resolve);
    if(!overlayClosing){ overlayClosing = true; history.back(); }
  });
}
// Whether an overlay is open.
export function overlayOpen(){ return !!activeOverlayClose; }
// An overlay that closed itself some other way (its history entry already gone): nothing to run.
export function forgetActiveOverlay(){
  activeOverlayClose = null; overlayClosing = false;
  closedWaiters.splice(0).forEach(function(done){ done(); });
}
// Run the open overlay's close callback now (popstate, nav.js's cleanup); false when none was open.
export function closeActiveOverlayNow(){
  if(!activeOverlayClose) return false;
  var closeOverlay = activeOverlayClose;
  activeOverlayClose = null;
  closeOverlay();
  overlayClosing = false;
  closedWaiters.splice(0).forEach(function(done){ done(); });
  return true;
}

// A native modal can sit over a row/sheet without replacing its close callback. Consume only the
// modal's history entry: Back cancels it and leaves the underlying editor and its history intact.
var modalClose = null;
// Register before app.js's popstate listener: on Window (the event target), later listeners
// cannot reliably stop an earlier listener just by requesting capture.
if(typeof window !== "undefined" && window.addEventListener){
  window.addEventListener("popstate", function(e){
    if(!modalClose) return;
    e.stopImmediatePropagation();
    var close = modalClose; modalClose = null;
    close();
  }, true);
}
export function pushModalOverlay(onClose){
  var closing = false;
  modalClose = onClose;
  try{ history.pushState({ appDialog: true }, "", location.href); }
  catch(e){
    modalClose = null;
    return onClose;
  }
  return function(){ if(!closing){ closing = true; history.back(); } };
}
