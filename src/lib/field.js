// ---------------- One field (#254) ----------------
//
// A label, its control, an optional unit beside it, help under it and room for an error — tied together the way
// assistive tech reads them (the label's for, aria-describedby for help and error, aria-invalid while there's an
// error). The look is base.css's .field / .field-control, from the --field-* tokens; docs/design/fields.md is the
// inventory and the spec. Text a person typed goes through escapeAttr like any other.
//
// fieldHtml({ id, label, type, value, options, unit, help, error, valid, required, disabled, readonly,
//             placeholder, className, attrs })
//   type     "text" (default), "number", "date", "url", … any input type; or "select" / "textarea"
//   options  for a select: [{ value, label }] — the one matching `value` is selected
//   attrs    extra attributes for the control, e.g. { "data-goal-amount": "g1", step: "0.01" }
import { escapeAttr } from "./html.js";

var ATTR_NAME = /^[a-z][a-z0-9-]*$/;

export function fieldHtml(o){
  o = o || {};
  var id = String(o.id || "");
  if(!id) throw new Error("fieldHtml needs an id, to tie its label to it");
  var helpId = id + "-help", errorId = id + "-error";
  var describedBy = (o.help ? helpId + " " : "") + errorId;
  var a = ' id="' + escapeAttr(id) + '" class="field-control' + (o.valid ? " is-valid" : "") + (o.className ? " " + escapeAttr(o.className) : "") + '"' +
    ' aria-describedby="' + escapeAttr(describedBy) + '"' +
    (o.error ? ' aria-invalid="true"' : "") +
    (o.required ? " required" : "") + (o.disabled ? " disabled" : "") + (o.readonly ? " readonly" : "") +
    (o.placeholder ? ' placeholder="' + escapeAttr(o.placeholder) + '"' : "");
  Object.keys(o.attrs || {}).forEach(function(k){
    if(!ATTR_NAME.test(k)) throw new Error("Not an attribute name: " + k);
    a += " " + k + '="' + escapeAttr(o.attrs[k]) + '"';
  });
  var type = o.type || "text", value = o.value == null ? "" : String(o.value), control;
  if(type === "select"){
    control = "<select" + a + ">" + (o.options || []).map(function(opt){
      var v = String(opt.value == null ? "" : opt.value);
      return '<option value="' + escapeAttr(v) + '"' + (v === value ? " selected" : "") + ">" + escapeAttr(opt.label == null ? v : opt.label) + "</option>";
    }).join("") + "</select>";
  } else if(type === "textarea"){
    control = "<textarea" + a + ">" + escapeAttr(value) + "</textarea>";
  } else {
    control = '<input type="' + escapeAttr(type) + '"' + a + ' value="' + escapeAttr(value) + '">';
  }
  return '<div class="field">' +
    '<label class="field-label" for="' + escapeAttr(id) + '">' + escapeAttr(o.label || "") +
      (o.required ? '<span class="field-req" aria-hidden="true">*</span>' : "") + "</label>" +
    (o.unit ? '<div class="field-row">' + control + '<span class="field-unit">' + escapeAttr(o.unit) + "</span></div>" : control) +
    (o.help ? '<p class="field-help" id="' + escapeAttr(helpId) + '">' + escapeAttr(o.help) + "</p>" : "") +
    '<p class="field-error" id="' + escapeAttr(errorId) + '" aria-live="polite">' + escapeAttr(o.error || "") + "</p>" +
  "</div>";
}
