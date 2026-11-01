import { test } from "node:test";
import assert from "node:assert/strict";
import { defineSection, sectionOf, parseAdd, defineRowAction, runRowAction } from "../src/lib/sections.js";

// v3.206.2 (item 237b): the lists a row can belong to, registered by their pages.
defineSection("lines", { rows: () => [] });
defineSection("place", { qualified: true, rows: (id) => id });

test("a section is its kind and what follows the colon", function(){
  assert.equal(sectionOf("lines").kind, "lines");
  assert.equal(sectionOf("lines").arg, "");
  const q = sectionOf("place:p-1:x");
  assert.equal(q.kind, "place");
  assert.equal(q.arg, "p-1:x", "everything after the first colon is the arg");
  assert.equal(sectionOf("nobody"), null, "a kind no page registered");
  assert.equal(sectionOf(""), null);
});

test("+ Add: a qualified kind keeps its arg; anything else files the row under a group", function(){
  assert.deepEqual(parseAdd("place:p-1"), { section: "place:p-1", group: null });
  assert.deepEqual(parseAdd("lines:Needs"), { section: "lines", group: "Needs" });
  assert.deepEqual(parseAdd("lines"), { section: "lines", group: null });
  assert.deepEqual(parseAdd("unknown:Sam"), { section: "unknown", group: "Sam" });
});

test("row actions run in the order registered, the first match only", function(){
  const ran = [];
  defineRowAction(".a", () => ran.push("a"));
  defineRowAction(".b", () => ran.push("b"));
  const target = (cls) => ({ target: { closest: (sel) => (sel === cls ? { sel } : null) } });
  assert.equal(runRowAction(target(".b")), true);
  assert.equal(runRowAction(target(".a")), true);
  assert.equal(runRowAction(target(".c")), false);
  assert.deepEqual(ran, ["b", "a"]);
});
