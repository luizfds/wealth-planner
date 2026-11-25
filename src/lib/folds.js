var prefix = "wealthPlanner.fold.";
export function restoreFolds(root){
  root.querySelectorAll("details[data-remember-fold]").forEach(function(el){
    try { el.open = localStorage.getItem(prefix + el.id) === "open"; } catch(e){}
  });
}
export function wireFolds(){
  restoreFolds(document);
  document.addEventListener("toggle", function(e){
    var el = e.target;
    if(!el.matches || !el.matches("details[data-remember-fold]")) return;
    try { localStorage.setItem(prefix + el.id, el.open ? "open" : "closed"); } catch(err){}
  }, true);
}
