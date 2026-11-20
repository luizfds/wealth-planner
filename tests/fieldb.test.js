import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fieldHtml, pillsHtml, switchHtml, formatMoney } from "../src/lib/field.js";
import { readNumberField } from "../src/lib/validate.js";

test("a money field: a floating-label box with $ in it, its amount with separators, read back as the number", function(){
  const h = fieldHtml({ id: "f1", label: "Current value", type: "money", value: 646000, className: "prop-value" });
  assert.match(h, /<div class="field field-box"><div class="fbox"><label class="field-label fbox-label" for="f1">Current value<\/label><span class="fbox-pre" aria-hidden="true">\$<\/span><input type="text"/);
  assert.match(h, /class="field-control fbox-control has-pre prop-value"/);
  assert.match(h, /inputmode="decimal" autocomplete="off" data-money value="646,000"/);
  assert.equal(formatMoney(176.3), "176.30");
  assert.equal(formatMoney("1250000"), "1,250,000");
  assert.equal(formatMoney(""), "");
  assert.equal(formatMoney("abc"), "abc", "not a number: left as typed, for its error to say so");
  assert.equal(formatMoney(-5000), "-5,000");
  for (const [raw, n] of [["$1,250.50", 1250.5], ["575,000", 575000], ["1 250", 1250]]) assert.equal(readNumberField(raw, {}).value, n);
  assert.equal(readNumberField("12,34x", {}).ok, false);
});

test("a box can hold a unit, and a select or a date sits in one too", function(){
  assert.match(fieldHtml({ id: "r", label: "Rate", type: "number", value: 6.24, unit: "%", box: true }), /class="field-control fbox-control has-suf"[\s\S]*<span class="fbox-suf" aria-hidden="true">%<\/span><\/div>/);
  assert.match(fieldHtml({ id: "s", label: "State", type: "select", value: "QLD", options: [{ value: "QLD" }], box: true }), /<select id="s" class="field-control fbox-control"/);
  assert.doesNotMatch(fieldHtml({ id: "p", label: "Plain" }), /fbox/, "a field not asked to be a box is as it was");
});

test("pills are a labelled radio group; a switch is a checkbox with role switch, its row the label", function(){
  const p = pillsHtml({ id: "rt", label: "Repayments", name: "rt-1", value: "IO", className: "loan-type", attrs: { "data-x": "1" }, options: [{ value: "PI", label: "Principal & interest" }, { value: "IO", label: "Interest only" }] });
  assert.match(p, /<div class="pills" role="radiogroup" aria-labelledby="rt-label">/);
  assert.match(p, /<input type="radio" class="pill-input loan-type" id="rt-1" name="rt-1" value="IO" checked data-x="1"><span>Interest only<\/span>/);
  assert.match(p, /<span>Principal &amp; interest<\/span>/);
  const s = switchHtml({ id: "off", label: "Offset account", sub: "Counted here", checked: true, className: "loan-has-offset" });
  assert.match(s, /<label class="switch-row" for="off">/);
  assert.match(s, /<input type="checkbox" role="switch" class="switch-input loan-has-offset" id="off" checked>/);
  assert.throws(() => pillsHtml({}), /needs an id/);
  assert.throws(() => switchHtml({ id: "x", attrs: { "on click": "1" } }), /Not an attribute name/);
});
