import test from "node:test";
import assert from "node:assert/strict";
import { readNumberField } from "../src/lib/validate.js";

// #263: a field reads as a value its rule allows, or says why — it never turns blank into 0 or clamps.
test("blank is an error when the field needs a value, and allowed (null) when it doesn't", () => {
  assert.deepEqual(readNumberField("", { empty: "Enter an amount." }), { ok: false, message: "Enter an amount." });
  assert.deepEqual(readNumberField("   ", { empty: "Enter an amount." }).ok, false);
  assert.deepEqual(readNumberField("", {}), { ok: true, value: null });
});

test("something the browser couldn't read is an error, not blank and not zero", () => {
  const r = readNumberField("", { badInput: true, empty: "Enter an amount." });
  assert.equal(r.ok, false);
  assert.match(r.message, /isn't a number/);
  assert.equal(readNumberField("12abc", {}).ok, false);
});

test("zero and negatives read as themselves; a range is checked, never clamped", () => {
  assert.deepEqual(readNumberField("0", { empty: "x" }), { ok: true, value: 0 });
  assert.deepEqual(readNumberField("-40", { empty: "x" }), { ok: true, value: -40 });
  assert.deepEqual(readNumberField("1250.50", {}), { ok: true, value: 1250.5 });
  const share = { empty: "x", min: 0, max: 100, range: "The claimable share is from 0 to 100%." };
  assert.deepEqual(readNumberField("150", share), { ok: false, message: "The claimable share is from 0 to 100%." });
  assert.equal(readNumberField("-10", share).ok, false);
  assert.deepEqual(readNumberField("100", share), { ok: true, value: 100 });
  assert.deepEqual(readNumberField("0", share), { ok: true, value: 0 });
  assert.match(readNumberField("101", { min: 0, max: 100 }).message, /from 0 to 100/);
});
