// One page-like editor plus a question above it. Wiring owns popstate listeners; these functions
// own only history entries and cleanup. Every close waiter belongs to its particular editor.
var activeOverlay = null, pendingBack = null, nextId = 0;
function settle(overlay, closed){
  clearTimeout(overlay.timer);
  overlay.waiters.splice(0).forEach(function(done){ done(closed); });
}
export function pushActiveOverlay(onClose, replace){
  if(activeOverlay) settle(activeOverlay, false);
  var overlay = { id: "editor-" + (++nextId) + "-" + Math.random().toString(36).slice(2), close: onClose, waiters: [], closing: false, entry: false,
    previous: history.state, url: location.href };
  activeOverlay = overlay;
  try{
    history[replace ? "replaceState" : "pushState"]({ overlayOpen: true, overlayId: overlay.id }, "", location.href);
    overlay.entry = true;
  }catch(e){}
}
export function requestCloseActiveOverlay(){
  var overlay = activeOverlay;
  if(!overlay) return Promise.resolve(true);
  return new Promise(function(resolve){
    overlay.waiters.push(resolve);
    if(!overlay.entry){ closeActiveOverlayNow(); return; }
    if(overlay.closing) return;
    overlay.closing = true; pendingBack = overlay;
    // History can be unavailable in an embedded browser. Never leave a caller waiting forever.
    overlay.timer = setTimeout(function(){
      if(activeOverlay !== overlay) return;
      pendingBack = null;
      if(history.state && history.state.overlayId === overlay.id){
        try{ history.replaceState(overlay.previous, "", overlay.url); }catch(e){}
      }
      closeActiveOverlayNow(false); // Cancel the continuation when history could not confirm closure.
    }, 1000);
    try{ history.back(); }catch(e){ pendingBack = null; closeActiveOverlayNow(); }
  });
}
export function overlayOpen(){ return !!activeOverlay; }
export function forgetActiveOverlay(){
  var overlay = activeOverlay; activeOverlay = null;
  if(overlay) settle(overlay, true);
}
export function closeActiveOverlayNow(closed){
  var overlay = activeOverlay;
  if(!overlay) return false;
  activeOverlay = null;
  try{ overlay.close(); }finally{ settle(overlay, closed !== false); }
  return true;
}
export function handleOverlayHistory(e){
  if(pendingBack){
    var owner = pendingBack; pendingBack = null;
    if(activeOverlay === owner) closeActiveOverlayNow();
    else if(activeOverlay && activeOverlay.entry){
      // A different editor replaced one while its Back was in flight. That Back must not close it.
      try{ history.replaceState({ overlayOpen: true, overlayId: activeOverlay.id }, "", activeOverlay.url); }catch(err){}
    }
    return true;
  }
  if(activeOverlay && activeOverlay.entry && (!e.state || e.state.overlayId !== activeOverlay.id)) return closeActiveOverlayNow();
  return false;
}

var modalClose = null, skippingModalReturn = false;
export function handleModalHistory(e){
  if(skippingModalReturn){ skippingModalReturn = false; e.stopImmediatePropagation(); return; }
  if(modalClose){
    e.stopImmediatePropagation();
    var close = modalClose; modalClose = null; close();
  } else if(e.state && e.state.appDialog){
    // Forward can revisit a dismissed question. Step back over its inert entry without closing
    // the editor below it, and consume the return event too.
    e.stopImmediatePropagation(); skippingModalReturn = true; history.back();
  }
}
export function pushModalOverlay(onClose){
  var closing = false; modalClose = onClose;
  try{ history.pushState({ appDialog: true }, "", location.href); }
  catch(e){ modalClose = null; return onClose; }
  return function(){ if(!closing){ closing = true; history.back(); } };
}
