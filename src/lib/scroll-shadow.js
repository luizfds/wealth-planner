// Edge-fade affordance for `.table-scroll` containers on wider viewports. Narrow viewports
// (<=880px, see ledger.css's max-width:880px block) already get a static right-edge mask-image
// fade, safe there because a ledger table (min-width:640px) is all but guaranteed to overflow a
// phone-width screen. Above that width a table may or may not actually overflow depending on its
// own column count (e.g. the Income table's extra Person/Type/Super/Sacrifice columns push it
// past a ~1090px content area, most others don't), so a permanent fade would be wrong on a table
// with nothing hidden — this drives a real, scroll-position-aware version instead, toggling
// `.can-scroll-left`/`.can-scroll-right` (see the min-width:881px block in ledger.css) only when
// there's genuinely more to see in that direction. Without this, an overflowing table on desktop
// had no visual cue at all that its rightmost columns (Date/Log/Delete, in the Income table's
// case) were clipped rather than simply absent.
export function initTableScrollShadows(root){
  root = root || document.body;
  var scheduled = false;

  function updateEdges(el){
    var max = el.scrollWidth - el.clientWidth;
    el.classList.toggle("can-scroll-left", el.scrollLeft > 2);
    el.classList.toggle("can-scroll-right", max > 2 && el.scrollLeft < max - 2);
  }
  function updateAll(){
    scheduled = false;
    root.querySelectorAll(".table-scroll").forEach(updateEdges);
  }
  function scheduleUpdate(){
    if(scheduled) return;
    scheduled = true;
    requestAnimationFrame(updateAll);
  }

  // Delegated (scroll doesn't bubble, hence capture:true) rather than a per-element listener —
  // every ledger table is fully re-rendered (innerHTML replaced) on nearly every state change
  // across dozens of call sites, so anything attached to today's table element would go stale
  // the instant it re-renders.
  document.addEventListener("scroll", function(e){
    if(e.target && e.target.classList && e.target.classList.contains("table-scroll")) updateEdges(e.target);
  }, true);
  window.addEventListener("resize", scheduleUpdate);
  // Same reasoning as the scroll listener: a MutationObserver survives re-renders that a
  // per-element ResizeObserver wouldn't. rAF-batched so a burst of renders (e.g. several fields
  // recomputing off one keystroke) collapses into a single pass.
  new MutationObserver(scheduleUpdate).observe(root, { childList: true, subtree: true });
  updateAll();
}
