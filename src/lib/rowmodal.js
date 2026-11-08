// A row stays in its list so delegated edits still work. Isolate siblings on the
// path to body instead of disabling an ancestor that also contains the editor.
export function rowModal(getRow, returnTarget, missing){
  var root = null, owned = new Set(), stopped = false;
  var questionOpen = function(){ return !!document.querySelector("dialog[open]"); };
  function stops(row){
    return Array.from(row.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]')).filter(function(el){
      return el.tabIndex >= 0 && !el.disabled && !el.closest("[inert]") && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden";
    });
  }
  function focusInside(row){
    var target = stops(row)[0] || row;
    target.focus({ preventScroll: true });
  }
  function unname(row){
    if(!row) return;
    var header = row.querySelector(".m-row-summary[data-row-toggle]");
    if(header) header.removeAttribute("aria-label");
    row.removeAttribute("role"); row.removeAttribute("aria-modal"); row.removeAttribute("aria-label"); row.removeAttribute("tabindex");
  }
  function update(){
    if(stopped) return;
    var row = getRow();
    if(!row || !row.isConnected || !row.classList.contains("open")){
      release(); missing(); return;
    }
    if(root !== row){ unname(root); root = row; }
    row.setAttribute("role", "dialog"); row.setAttribute("aria-modal", "true"); row.setAttribute("tabindex", "-1");
    var name = row.querySelector(".m-row-name");
    row.setAttribute("aria-label", "Edit " + (name && name.textContent.trim() || "item"));
    var header = row.querySelector(".m-row-summary[data-row-toggle]");
    if(header) header.setAttribute("aria-label", header.textContent.trim() + " — Close editor");
    var desired = new Set();
    for(var branch = row; branch && branch !== document.body; branch = branch.parentElement){
      Array.from(branch.parentElement.children).forEach(function(el){
        // Native questions own the top layer; the backdrop still supports click-to-close.
        if(el !== branch && el.id !== "mRowBackdrop" && !el.matches("dialog[open]")) desired.add(el);
      });
    }
    owned.forEach(function(el){ if(!desired.has(el)){ el.inert = false; owned.delete(el); } });
    desired.forEach(function(el){ if(!el.inert){ el.inert = true; owned.add(el); } });
    if(!questionOpen() && !row.contains(document.activeElement)) focusInside(row);
  }
  function keys(e){
    if(e.key !== "Tab" || questionOpen()) return;
    var row = getRow(); if(!row) return;
    var targets = stops(row), first = targets[0], last = targets[targets.length - 1];
    if(!first){ e.preventDefault(); row.focus(); return; }
    if(e.shiftKey && (document.activeElement === first || !row.contains(document.activeElement))){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && (document.activeElement === last || !row.contains(document.activeElement))){ e.preventDefault(); first.focus(); }
  }
  function focus(e){
    if(questionOpen()) return;
    var row = getRow();
    if(row && !row.contains(e.target)) focusInside(row);
  }
  var observer = new MutationObserver(update);
  function release(){
    if(stopped) return;
    stopped = true; observer.disconnect();
    document.removeEventListener("keydown", keys, true); document.removeEventListener("focusin", focus, true);
    unname(root); owned.forEach(function(el){ el.inert = false; }); owned.clear();
  }
  document.addEventListener("keydown", keys, true); document.addEventListener("focusin", focus, true);
  observer.observe(document.body, { childList: true, subtree: true });
  update();
  return { release: release, restoreFocus: function(){
    if(questionOpen()) return;
    var target = returnTarget();
    if(target && target.isConnected && !target.closest("[inert], [hidden]") && target.getClientRects().length) target.focus({ preventScroll: true });
  } };
}
