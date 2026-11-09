import test from "node:test";
import assert from "node:assert/strict";
import { labelFields } from "../src/lib/labelfields.js";

// #261: older form markup — a label beside its control, help in a title — tied together, the help made visible.
test("a label is tied to its control and a title becomes visible, described help", () => {
  const out = labelFields('<div class="calc-field" title="Land value only, not market value."><label>Land value</label><input type="number" class="prop-land-value" aria-label="Land value" value="0"></div>', "p1");
  assert.match(out, /<label for="p1-1">Land value<\/label><input [^>]*\bid="p1-1"/);
  assert.match(out, /<input [^>]*aria-describedby="p1-1-help"/);
  assert.match(out, /<input [^>]*aria-label="Land value"/, "an aria-label that starts with the label stays");
  assert.match(out, /<p class="field-help" id="p1-1-help">Land value only, not market value\.<\/p><\/div>$/);
  assert.ok(!/title=/.test(out), "the tooltip is gone");
});

test("help after a select goes after its closing tag; a title on the control counts too", () => {
  const out = labelFields('<div class="calc-field"><label>State</label><select class="prop-state" title="Decides the land tax scale."><option>NSW</option></select></div>', "s");
  assert.match(out, /<select id="s-1" aria-describedby="s-1-help" class="prop-state"><option>NSW<\/option><\/select><p class="field-help" id="s-1-help">Decides the land tax scale\.<\/p>/);
});

test("an aria-label that contradicts the visible label goes; one that starts with it stays", () => {
  const gone = labelFields('<div class="m-edit-field"><label>Qty</label><input class="q" aria-label="Quantity"></div>', "a");
  assert.ok(!/aria-label/.test(gone));
  const kept = labelFields('<div class="m-edit-field"><label>Rate <small>%</small></label><input class="r" aria-label="Rate % for Loan 1"></div>', "b");
  assert.match(kept, /aria-label="Rate % for Loan 1"/);
});

test("checkboxes, controls with an id, and a second pass are left alone", () => {
  const box = '<div class="calc-field"><label>Tick</label><input type="checkbox" class="t"></div>';
  assert.equal(labelFields(box, "c"), box);
  const once = labelFields('<div class="proj-field" title="Help."><label>Fee</label><input class="f"></div>', "d");
  assert.equal(labelFields(once, "d"), once);
});
