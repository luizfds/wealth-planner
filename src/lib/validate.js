// ---------------- Reading a field before it's saved (#263) ----------------
//
// An edit is saved only when its field reads as a value its rule allows. Until then the field keeps what was typed
// (the draft), says what's wrong beside it, and the saved figure doesn't move — no blank or half-typed number turns
// into 0, and nothing out of range is quietly clamped into range. docs/design/validation.md lists each field's rule
// (what blank, 0 and a negative mean for it).
//
// readNumberField(raw, rule) → { ok: true, value } or { ok: false, message }
//   raw      the input's value (an <input type="number"> gives "" for anything it can't read)
//   rule     { badInput, empty, min, max, range }
//            badInput  the input's validity.badInput — "" because it couldn't be read, not because it's empty
//            empty     the message when it's blank; leave it out and blank is allowed (value null)
//            min, max  the range, when there is one, and `range` the message for outside it
// markField(input, result) shows or clears the message and aria-invalid; returns result.ok.
// readInput(input, rule) reads an <input> by its rule and marks it: the result when it reads, null when it doesn't.

export function readNumberField(raw, rule){
  rule = rule || {};
  var s = String(raw == null ? "" : raw).trim();
  if(!s){
    if(rule.badInput) return { ok: false, message: "That isn't a number — use digits and a full stop, like 1250.50." };
    if(rule.empty) return { ok: false, message: rule.empty };
    return { ok: true, value: null };
  }
  var n = Number(s);
  if(!isFinite(n)) return { ok: false, message: "That isn't a number — use digits and a full stop, like 1250.50." };
  if((rule.min != null && n < rule.min) || (rule.max != null && n > rule.max)){
    return { ok: false, message: rule.range || ("Enter a number from " + rule.min + " to " + rule.max + ".") };
  }
  return { ok: true, value: n };
}

var seq = 0;
export function markField(input, result){
  if(!input) return !!(result && result.ok);
  var box = input.closest(".m-edit-field, .field, label") || input.parentElement;
  // This field's own message: a box can hold several fields (a purchase lot's row), each with its message.
  var msg = box && input.id ? Array.from(box.querySelectorAll(".field-error[data-for-input]")).find(function(m){ return m.getAttribute("data-for-input") === input.id; }) : null;
  // Shared fields reserve an error element and already describe it. Reuse it so
  // validation never creates a second message with the same id.
  if(!msg && box && input.id){
    var reserved = document.getElementById(input.id + "-error");
    if(reserved && box.contains(reserved)) msg = reserved;
  }
  if(result && result.ok){
    input.removeAttribute("aria-invalid");
    if(msg){ msg.textContent = ""; }
    return true;
  }
  if(!input.id) input.id = "fld-" + (++seq);
  if(!msg && box){
    msg = document.createElement("p");
    msg.className = "field-error";
    msg.setAttribute("data-for-input", input.id);
    msg.setAttribute("aria-live", "polite");
    msg.id = input.id + "-error";
    box.appendChild(msg);
  }
  if(msg){
    msg.textContent = result.message;
    var ids = (input.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
    if(ids.indexOf(msg.id) === -1) input.setAttribute("aria-describedby", ids.concat(msg.id).join(" "));
  }
  input.setAttribute("aria-invalid", "true");
  return false;
}

export function readInput(input, rule){
  var r = readNumberField(input.value, Object.assign({ badInput: !!(input.validity && input.validity.badInput) }, rule));
  return markField(input, r) ? r : null;
}
