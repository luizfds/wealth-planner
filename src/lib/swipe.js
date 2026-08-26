// Minimal touch-only horizontal swipe detector — no library, just enough for the Assets subnav
// and the Tax & Super breakdown-flip cards on mobile. A touch that starts inside a horizontally
// scrollable element (a .table-scroll'd ledger/holdings table) is ignored entirely, so swiping to
// see a table's hidden columns doesn't also flip a card or jump a tab underneath it.
export function onHorizontalSwipe(el, handlers){
  var threshold = (handlers && handlers.threshold) || 56;
  var maxDurationMs = 600;
  var startX = 0, startY = 0, startTime = 0, tracking = false;

  el.addEventListener("touchstart", function(e){
    if(e.touches.length !== 1){ tracking = false; return; }
    tracking = !e.target.closest(".table-scroll");
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
  }, { passive: true });

  el.addEventListener("touchend", function(e){
    if(!tracking) return;
    tracking = false;
    if(Date.now() - startTime > maxDurationMs) return;
    var touch = e.changedTouches[0];
    var dx = touch.clientX - startX;
    var dy = touch.clientY - startY;
    if(Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if(dx < 0 && handlers.onSwipeLeft) handlers.onSwipeLeft(e);
    else if(dx > 0 && handlers.onSwipeRight) handlers.onSwipeRight(e);
  }, { passive: true });

  el.addEventListener("touchcancel", function(){ tracking = false; }, { passive: true });
}
