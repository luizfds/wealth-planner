// An animation may be skipped while its DOM update still succeeds. Only classify
// the animation failure after the update settles: a failed render must still reject.
export function pageTransitionDone(transition, report = console.error){
  function animationFailed(error){
    return transition.updateCallbackDone.then(function(){
      if(error.name !== "AbortError" && error.name !== "TimeoutError") report(error);
    }, function(){ /* The returned update promise carries the render failure. */ });
  }
  transition.ready.catch(animationFailed);
  transition.finished.catch(animationFailed);
  return transition.updateCallbackDone;
}
