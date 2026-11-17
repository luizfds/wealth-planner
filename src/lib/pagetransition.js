// An animation may be skipped while its DOM update still succeeds. Only classify
// the animation failure after the update settles: a failed render must still reject.
export function pageTransitionDone(transition, report = console.error){
  function animationFailed(error){
    return transition.updateCallbackDone.then(function(){
      // InvalidStateError: the viewport changed mid-transition (a resize, a phone turned) — the animation is skipped,
      // the page itself has changed. A journey resizing just after navigating logged it as an error (#412's PR).
      if(error.name !== "AbortError" && error.name !== "TimeoutError" && error.name !== "InvalidStateError") report(error);
    }, function(){ /* The returned update promise carries the render failure. */ });
  }
  transition.ready.catch(animationFailed);
  transition.finished.catch(animationFailed);
  return transition.updateCallbackDone;
}
