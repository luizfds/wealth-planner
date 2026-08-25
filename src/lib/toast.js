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
