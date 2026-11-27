var prefix = "wealthPlanner.fold.";
var phoneQuery = "(max-width:720px)";
export function restoreFolds(root, mobileOnly){
  var narrow = window.matchMedia(phoneQuery).matches;
  root.querySelectorAll(mobileOnly ? "details[data-mobile-fold]" : "details[data-remember-fold]").forEach(function(el){
    var alwaysOpen = el.hasAttribute("data-mobile-fold") && !narrow;
    try { el.open = alwaysOpen || localStorage.getItem(prefix + el.id) === "open"; } catch(e){ if(alwaysOpen) el.open = true; }
  });
}
export function wireFolds(){
  restoreFolds(document);
  var phone = window.matchMedia(phoneQuery);
  phone.addEventListener("change", function(){ restoreFolds(document, true); });
  document.addEventListener("toggle", function(e){
    var el = e.target;
    if(!el.matches || !el.matches("details[data-remember-fold]")) return;
    // The desktop layout exposes the contents without changing the phone's remembered choice.
    if(el.hasAttribute("data-mobile-fold") && !phone.matches) return;
    try { localStorage.setItem(prefix + el.id, el.open ? "open" : "closed"); } catch(err){}
  }, true);
}
