import test from "node:test";
import assert from "node:assert/strict";
import { draftFieldKey } from "../src/lib/error-summary.js";
import { readNumberField, markField } from "../src/lib/validate.js";

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

test("a whole-number field (a day of the month) says so for a fraction, and reads a whole one", () => {
  const day = { min: 1, max: 31, whole: true, range: "Enter a day from 1 to 31." };
  assert.deepEqual(readNumberField("15", day), { ok: true, value: 15 });
  assert.deepEqual(readNumberField("15.5", day), { ok: false, message: "Enter a day from 1 to 31." });
  assert.equal(readNumberField("0", day).ok, false);
  assert.equal(readNumberField("32", day).ok, false);
  assert.deepEqual(readNumberField("", day), { ok: true, value: null });
});

// A tiny stand-in for the DOM markField touches: elements with attributes, children and the two queries it makes.
function fakeDom(){
  const byId = new Map();
  class El {
    constructor(tag){ this.tag = tag; this.attrs = {}; this.children = []; this.className = ""; this.textContent = ""; this._id = ""; }
    get id(){ return this._id; }
    set id(v){ this._id = v; byId.set(v, this); }
    setAttribute(k, v){ if(k === "id") this.id = v; else this.attrs[k] = String(v); }
    getAttribute(k){ return k === "id" ? this._id || null : (k in this.attrs ? this.attrs[k] : null); }
    removeAttribute(k){ delete this.attrs[k]; }
    appendChild(c){ c.parent = this; this.children.push(c); return c; }
    contains(c){ for(let x = c; x; x = x.parent) if(x === this) return true; return false; }
    all(){ return this.children.flatMap(c => [c, ...c.all()]); }
    querySelectorAll(){ return this.all().filter(e => e.className === "field-error" && e.getAttribute("data-for-input") != null); }
    querySelector(){ return this.querySelectorAll()[0] || null; }
    closest(){ return null; }
    get parentElement(){ return this.parent || null; }
  }
  globalThis.document = { createElement: t => new El(t), getElementById: id => byId.get(id) || null };
  return { El };
}

test("two fields in one box (a purchase lot's row) each keep their own message", () => {
  const prev = globalThis.document;
  try {
    const { El } = fakeDom();
    const row = new El("div"), units = row.appendChild(new El("input")), brokerage = row.appendChild(new El("input"));
    units.id = "lot-units"; brokerage.id = "lot-brokerage";
    markField(brokerage, { ok: false, message: "Brokerage can't be negative." });
    markField(units, { ok: false, message: "Enter the units bought." });
    const msgs = row.querySelectorAll();
    assert.equal(msgs.length, 2);
    assert.equal(document.getElementById("lot-brokerage-error").textContent, "Brokerage can't be negative.");
    assert.equal(document.getElementById("lot-units-error").textContent, "Enter the units bought.");
    assert.equal(units.getAttribute("aria-describedby"), "lot-units-error");
    markField(units, { ok: true });
    assert.equal(units.getAttribute("aria-invalid"), null);
    assert.equal(document.getElementById("lot-brokerage-error").textContent, "Brokerage can't be negative.");
  } finally { globalThis.document = prev; }
});


test("repeated-field draft identities stay with their record without modifying saved data", () => {
  const first=Object.freeze({what:"Example cost",amount:1000}), second=Object.freeze({what:"Example cost",amount:1000});
  const key=draftFieldKey(first,"amount");
  assert.equal(draftFieldKey(first,"amount"),key);
  assert.notEqual(draftFieldKey(second,"amount"),key);
  assert.notEqual(draftFieldKey(first,"what"),key);
  assert.deepEqual(first,{what:"Example cost",amount:1000});
});
