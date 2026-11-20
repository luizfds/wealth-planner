// ---------------- One field (#254) ----------------
//
// A label, its control, an optional unit beside it, help under it and room for an error — tied together the way
// assistive tech reads them (the label's for, aria-describedby for help and error, aria-invalid while there's an
// error). The look is base.css's .field / .field-control, from the --field-* tokens; docs/design/fields.md is the
// inventory and the spec. Text a person typed goes through escapeAttr like any other.
//
// fieldHtml({ id, label, type, value, options, unit, help, error, valid, required, disabled, readonly,
//             placeholder, className, attrs, box, prefix })
//   type     "text" (default), "number", "date", "url", … any input type; or "select" / "textarea"
//   options  for a select: [{ value, label }] or groups { label, options: [...] }
//   attrs    extra attributes for the control, e.g. { "data-goal-amount": "g1", step: "0.01" }
//   box      (November 2026, docs/design/fields.md "Floating label") the label inside a soft filled box, above a
//            big value — the box is the control itself, so it's one tap target; `prefix` and `unit` sit inside it
//   wide     the field takes both columns of a .fgrid
//   type "money"  a box with "$" in it, shown with thousands separators (lib/moneyfield.js keeps them as you type);
//            read through lib/validate.js readInput, which takes "$1,250.50" as 1250.5
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
  if(type === "money"){
    o = Object.assign({ box: true, prefix: "$" }, o);
    a += ' inputmode="decimal" autocomplete="off" data-money';
    value = formatMoney(value);
    type = "text";
  }
  if(o.box){
    a = a.replace('class="field-control', 'class="field-control fbox-control' + (o.prefix ? " has-pre" : "") + (o.unit ? " has-suf" : ""));
  }
  if(type === "select"){
    control = "<select" + a + ">" + (o.options || []).map(function optionHtml(opt){
      if(opt.options) return '<optgroup label="' + escapeAttr(opt.label || "") + '">' + opt.options.map(optionHtml).join("") + "</optgroup>";
      var v = String(opt.value == null ? "" : opt.value);
      return '<option value="' + escapeAttr(v) + '"' + (v === value ? " selected" : "") + ">" + escapeAttr(opt.label == null ? v : opt.label) + "</option>";
    }).join("") + "</select>";
  } else if(type === "textarea"){
    control = "<textarea" + a + ">" + escapeAttr(value) + "</textarea>";
  } else {
    control = '<input type="' + escapeAttr(type) + '"' + a + ' value="' + escapeAttr(value) + '">';
  }
  var labelHtml = '<label class="field-label' + (o.box ? " fbox-label" : "") + '" for="' + escapeAttr(id) + '">' + escapeAttr(o.label || "") +
      (o.required ? '<span class="field-req" aria-hidden="true">*</span>' : "") + "</label>";
  if(o.box){
    return '<div class="field field-box' + (o.wide ? " span2" : "") + '">' +
      '<div class="fbox">' + labelHtml + (o.prefix ? '<span class="fbox-pre" aria-hidden="true">' + escapeAttr(o.prefix) + '</span>' : "") + control +
        (o.unit ? '<span class="fbox-suf" aria-hidden="true">' + escapeAttr(o.unit) + '</span>' : "") + '</div>' +
      (o.help ? '<p class="field-help" id="' + escapeAttr(helpId) + '">' + escapeAttr(o.help) + "</p>" : "") +
      '<p class="field-error" id="' + escapeAttr(errorId) + '" aria-live="polite">' + escapeAttr(o.error || "") + "</p>" +
    "</div>";
  }
  return '<div class="field">' + labelHtml +
    (o.unit ? '<div class="field-row">' + control + '<span class="field-unit">' + escapeAttr(o.unit) + "</span></div>" : control) +
    (o.help ? '<p class="field-help" id="' + escapeAttr(helpId) + '">' + escapeAttr(o.help) + "</p>" : "") +
    '<p class="field-error" id="' + escapeAttr(errorId) + '" aria-live="polite">' + escapeAttr(o.error || "") + "</p>" +
  "</div>";
}

// A money amount as it's shown: thousands separators, its cents kept when it has them ("176.3" → "176.30"). Blank and
// anything that isn't a number are left as they are.
export function formatMoney(v){
  var s = String(v == null ? "" : v).replace(/[\s,$]/g, "");
  if(s === "" || !isFinite(Number(s))) return String(v == null ? "" : v);
  var n = Number(s), neg = n < 0, abs = Math.abs(n);
  var cents = Math.round(abs * 100) % 100 !== 0;
  var whole = Math.floor(cents ? abs : Math.round(abs)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + whole + (cents ? "." + String(Math.round(abs * 100) % 100).padStart(2, "0") : "");
}

// A choice of a few, as pills (November 2026): real radios — one tab stop, arrow keys between them, announced as a
// group with its label. pillsHtml({ id, label, name, value, options: [{ value, label }], className, attrs, help })
// className and attrs go on every radio, so a page's change handler reads e.target.value as it read a select's.
export function pillsHtml(o){
  o = o || {};
  var id = String(o.id || "");
  if(!id) throw new Error("pillsHtml needs an id, to label its group");
  var name = o.name || id, value = o.value == null ? "" : String(o.value);
  var extra = Object.keys(o.attrs || {}).map(function(k){
    if(!ATTR_NAME.test(k)) throw new Error("Not an attribute name: " + k);
    return " " + k + '="' + escapeAttr(o.attrs[k]) + '"';
  }).join("");
  return '<div class="field field-pills">' +
    '<span class="field-label" id="' + escapeAttr(id) + '-label">' + escapeAttr(o.label || "") + '</span>' +
    '<div class="pills" role="radiogroup" aria-labelledby="' + escapeAttr(id) + '-label">' + (o.options || []).map(function(opt, i){
      var v = String(opt.value == null ? "" : opt.value);
      return '<label class="pill"><input type="radio" class="pill-input' + (o.className ? " " + escapeAttr(o.className) : "") + '" id="' + escapeAttr(id + "-" + i) + '" name="' + escapeAttr(name) + '" value="' + escapeAttr(v) + '"' +
        (v === value ? " checked" : "") + extra + '><span>' + escapeAttr(opt.label == null ? v : opt.label) + '</span></label>';
    }).join("") + '</div>' +
    (o.help ? '<p class="field-help">' + escapeAttr(o.help) + '</p>' : '') +
  '</div>';
}

// On or off, as a switch (November 2026): a checkbox with role="switch", the whole row its label.
// switchHtml({ id, label, sub, checked, className, attrs })
export function switchHtml(o){
  o = o || {};
  var id = String(o.id || "");
  if(!id) throw new Error("switchHtml needs an id");
  var extra = Object.keys(o.attrs || {}).map(function(k){
    if(!ATTR_NAME.test(k)) throw new Error("Not an attribute name: " + k);
    return " " + k + '="' + escapeAttr(o.attrs[k]) + '"';
  }).join("");
  return '<label class="switch-row" for="' + escapeAttr(id) + '"><span class="switch-text"><b>' + escapeAttr(o.label || "") + '</b>' +
    (o.sub ? '<small>' + escapeAttr(o.sub) + '</small>' : '') + '</span>' +
    '<input type="checkbox" role="switch" class="switch-input' + (o.className ? " " + escapeAttr(o.className) : "") + '" id="' + escapeAttr(id) + '"' + (o.checked ? " checked" : "") + extra + '></label>';
}
