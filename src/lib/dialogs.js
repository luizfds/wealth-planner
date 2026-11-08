import { pushModalOverlay } from "./overlaystack.js";

// Promise-based questions: callers must await the answer before touching data. A second click while
// a question is open is cancelled rather than queued against records which may no longer exist.
var active = false, idleWaiters = [];
export function whenDialogsClosed(){ return active ? new Promise(function(resolve){ idleWaiters.push(resolve); }) : Promise.resolve(); }
export function dialogOpen(){ return active; }
function question(message, options){
  if(active) return Promise.resolve(null);
  active = true;
  var o = options || {}, opener = document.activeElement;
  return new Promise(function(resolve){
    var d = document.createElement("dialog");
    d.className = "app-dialog";
    d.setAttribute("aria-labelledby", "appDialogTitle");
    d.setAttribute("aria-describedby", "appDialogMessage");
    // Only static markup goes through innerHTML; messages, labels and values use DOM properties.
    d.innerHTML = '<form novalidate><h2 id="appDialogTitle"></h2><p id="appDialogMessage"></p><div class="app-dialog-fields"></div><p id="appDialogError" class="app-dialog-error" role="alert" hidden></p><div class="app-dialog-actions"><button type="button" class="btn btn-ghost" data-dialog-cancel>Cancel</button><button type="submit" class="btn btn-primary" data-dialog-submit></button></div></form>';
    d.querySelector("h2").textContent = o.title || "Confirm action";
    d.querySelector("#appDialogMessage").textContent = message;
    var submit = d.querySelector("[data-dialog-submit]");
    submit.textContent = o.accept || "Continue";
    if(o.danger) submit.className = "btn btn-danger";
    var input, repeat, error = d.querySelector("#appDialogError");
    function field(label, id){
      var wrap = document.createElement("label");
      wrap.className = "app-dialog-field";
      var span = document.createElement("span"); span.textContent = label;
      var el = document.createElement("input");
      el.id = id; el.type = o.password ? "password" : "text";
      el.autocomplete = o.password ? (o.repeat ? "new-password" : "current-password") : "off";
      el.setAttribute("aria-describedby", "appDialogMessage appDialogError");
      wrap.append(span, el); d.querySelector(".app-dialog-fields").appendChild(wrap);
      return el;
    }
    if(o.input){
      input = field(o.label || (o.password ? "Passphrase" : "Name"), "appDialogInput");
      input.value = o.value || "";
      if(o.repeat) repeat = field("Confirm " + (o.label || "passphrase").toLowerCase(), "appDialogRepeat");
      if(o.password){
        var reveal = document.createElement("button");
        reveal.type = "button"; reveal.className = "btn btn-ghost";
        reveal.textContent = "Show password"; reveal.setAttribute("aria-pressed", "false");
        reveal.addEventListener("click", function(){
          var show = input.type === "password";
          input.type = show ? "text" : "password"; if(repeat) repeat.type = input.type;
          reveal.textContent = show ? "Hide password" : "Show password";
          reveal.setAttribute("aria-pressed", String(show));
        });
        d.querySelector(".app-dialog-fields").appendChild(reveal);
      }
    }
    if(o.alternative){
      var alternate = document.createElement("button");
      alternate.type = "button"; alternate.className = "btn btn-danger";
      alternate.textContent = o.alternative;
      alternate.addEventListener("click", function(){ answer = "alternative"; close(); });
      d.querySelector(".app-dialog-actions").insertBefore(alternate, submit);
    }
    var answer = null;
    document.body.appendChild(d);
    function keys(e){
      // Existing page-level Escape/Enter/shortcut handlers must not act beneath this modal.
      e.stopImmediatePropagation();
      if(e.key === "Escape"){ e.preventDefault(); close(); }
      if(e.key === "Tab"){
        var stops = Array.from(d.querySelectorAll("button,input")).filter(function(el){ return !el.disabled; });
        var first = stops[0], last = stops[stops.length - 1];
        if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    }
    var close = pushModalOverlay(function(){
      document.removeEventListener("keydown", keys, true);
      d.close();
      // Clear secrets before discarding the DOM; nothing is persisted or logged by the dialog.
      if(input) input.value = ""; if(repeat) repeat.value = "";
      d.remove(); active = false;
      function restoreFocus(){
        var target = opener;
        if(target && !target.isConnected){
          var identity = Array.from(target.attributes).filter(function(a){ return a.name.indexOf("data-") === 0; });
          target = target.id ? document.getElementById(target.id) : identity.length ? Array.from(document.querySelectorAll(target.tagName.toLowerCase())).find(function(el){ return identity.every(function(a){ return el.getAttribute(a.name) === a.value; }); }) : null;
        }
        if(target && target.getClientRects().length && !target.closest("[hidden]")) target.focus();
        else { var fallback = document.querySelector('.mobile-tab.active, .nav-item.active'); if(fallback) fallback.focus(); }
      }
      restoreFocus();
      resolve(answer);
      queueMicrotask(function(){ if(!active) idleWaiters.splice(0).forEach(function(done){ done(); }); });
      // The answer can redraw the opener. Restore its replacement after that draw, unless the
      // caller intentionally moved focus somewhere else (or opened the next question).
      requestAnimationFrame(function(){ if(!active && document.activeElement === document.body) restoreFocus(); });
    });
    d.addEventListener("cancel", function(e){ e.preventDefault(); close(); });
    d.querySelector("[data-dialog-cancel]").addEventListener("click", close);
    d.querySelector("form").addEventListener("submit", function(e){
      e.preventDefault();
      var v = input ? input.value : "accept", problem = "";
      if(input && o.required && !v.trim()) problem = "Enter " + (o.label || "a value").toLowerCase() + ".";
      if(!problem && o.minLength && v.length < o.minLength) problem = "Use at least " + o.minLength + " characters.";
      if(!problem && repeat && v !== repeat.value) problem = "The entries don't match. Type them again.";
      if(!problem && o.validate) problem = o.validate(v) || "";
      error.textContent = problem; error.hidden = !problem;
      if(input) input.setAttribute("aria-invalid", String(!!problem));
      if(repeat) repeat.setAttribute("aria-invalid", String(!!problem));
      if(problem){ (repeat && v !== repeat.value ? repeat : input).focus(); return; }
      answer = v; close();
    });
    d.showModal();
    document.addEventListener("keydown", keys, true);
    if(input){ input.focus(); if(!o.password) input.select(); }
    else d.querySelector("[data-dialog-cancel]").focus();
  });
}

export function confirmDialog(message, options){
  return question(message, options).then(function(answer){ return answer === "accept"; });
}
export function textDialog(message, value, options){
  return question(message, Object.assign({}, options, { input: true, value: value || "" }));
}
export function choiceDialog(message, options){ return question(message, options); }
