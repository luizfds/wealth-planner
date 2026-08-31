export function showToast(msg){
  var wrap = document.getElementById("toastWrap");
  var t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  wrap.appendChild(t);
  requestAnimationFrame(function(){ t.classList.add("show"); });
  setTimeout(function(){ t.classList.remove("show"); setTimeout(function(){ t.remove(); }, 200); }, 3200);
}

export function showUndoToast(msg, undoFn){
  var wrap = document.getElementById("toastWrap");
  var t = document.createElement("div");
  t.className = "toast";
  var label = document.createElement("span");
  label.textContent = msg;
  var undoBtn = document.createElement("button");
  undoBtn.type = "button";
  undoBtn.className = "toast-undo-btn";
  undoBtn.textContent = "Undo";
  t.appendChild(label);
  t.appendChild(undoBtn);
  wrap.appendChild(t);
  requestAnimationFrame(function(){ t.classList.add("show"); });
  var dismissTimer = setTimeout(dismiss, 6000);
  function dismiss(){
    clearTimeout(dismissTimer);
    t.classList.remove("show");
    setTimeout(function(){ t.remove(); }, 200);
  }
  undoBtn.addEventListener("click", function(){
    undoFn();
    dismiss();
  });
}

// For a toast that shouldn't auto-vanish on the usual short timer — e.g. "a new version is
// available", which the user could easily be mid-task and miss if it disappeared after a few
// seconds. Stays up until the action is taken or explicitly dismissed. Returns the dismiss
// function so a caller can close it programmatically too (e.g. if the condition it was shown for
// resolves on its own).
export function showPersistentToast(msg, actionLabel, actionFn){
  var wrap = document.getElementById("toastWrap");
  var t = document.createElement("div");
  t.className = "toast";
  var label = document.createElement("span");
  label.textContent = msg;
  var actionBtn = document.createElement("button");
  actionBtn.type = "button";
  actionBtn.className = "toast-undo-btn";
  actionBtn.textContent = actionLabel;
  var closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "toast-close-btn";
  closeBtn.setAttribute("aria-label", "Dismiss");
  closeBtn.textContent = "✕";
  t.appendChild(label);
  t.appendChild(actionBtn);
  t.appendChild(closeBtn);
  wrap.appendChild(t);
  requestAnimationFrame(function(){ t.classList.add("show"); });
  function dismiss(){
    t.classList.remove("show");
    setTimeout(function(){ t.remove(); }, 200);
  }
  actionBtn.addEventListener("click", function(){ actionFn(); dismiss(); });
  closeBtn.addEventListener("click", dismiss);
  return dismiss;
}
