import test from "node:test";
import assert from "node:assert/strict";
import { initialMode, storedMode, setStoredMode, MODE_KEY } from "../src/lib/mode.js";

function memory(){ var m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; }

// #414: Simple and Advanced is decided once per device and remembered.
test("a new household starts Simple; one with something in it keeps everything (Advanced)", () => {
  var fresh = memory();
  assert.equal(initialMode(false, fresh), "simple");
  assert.equal(fresh.m[MODE_KEY], "simple", "remembered");
  var kept = memory();
  assert.equal(initialMode(true, kept), "advanced");
  assert.equal(storedMode(kept), "advanced");
});

test("a choice made stays, whatever the household holds later", () => {
  var s = memory();
  setStoredMode("simple", s);
  assert.equal(initialMode(true, s), "simple");
  setStoredMode("advanced", s);
  assert.equal(initialMode(false, s), "advanced");
});

test("an unreadable or unknown stored value is not a choice", () => {
  var s = memory(); s.setItem(MODE_KEY, "classic");
  assert.equal(storedMode(s), null);
  assert.equal(initialMode(false, s), "simple");
  var broken = { getItem(){ throw new Error("blocked"); }, setItem(){ throw new Error("blocked"); } };
  assert.equal(storedMode(broken), null);
  assert.equal(initialMode(true, broken), "advanced", "still decides, just can't remember");
});
