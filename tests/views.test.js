import { test } from "node:test";
import assert from "node:assert/strict";
import { defineView, drawViews, drawStale, redraw, staleViews } from "../src/lib/views.js";

// v3.208.0 (item 236a): pages drawn when seen. A stand-in page whose current page the test sets.
let page = "expenses";
globalThis.document = { body: { getAttribute: () => page } };
const drawn = [];
defineView("header", null, () => drawn.push("header"));
defineView("spending", ["expenses"], () => drawn.push("spending"));
defineView("home", ["dashboard"], () => drawn.push("home"));
defineView("advice", ["dashboard", "expenses"], () => drawn.push("advice"));
defineView("broken", ["expenses"], () => { throw new Error("a view that breaks"); });

test("a full redraw draws the page on screen and every page's own bits; the rest wait", function(){
  drawn.length = 0;
  const thrown = [];
  const keep = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => { try { fn(); } catch(e){ thrown.push(e.message); } };
  try { drawViews(); } finally { globalThis.setTimeout = keep; }
  assert.deepEqual(drawn, ["header", "spending", "advice"]);
  assert.deepEqual(staleViews(), ["home"]);
  assert.deepEqual(thrown, ["a view that breaks"], "one view failing is reported, the others still draw");
});

test("opening a page draws what was left for it, once", function(){
  drawn.length = 0;
  drawStale("dashboard");
  assert.deepEqual(drawn, ["home"]);
  drawStale("dashboard");
  assert.deepEqual(drawn, ["home"], "not again until something makes it stale");
  assert.deepEqual(staleViews(), []);
});

test("an edit's own redraw: what's on screen now, the rest when its page opens", function(){
  drawn.length = 0;
  redraw(["spending", "home", "nonesuch"]);
  assert.deepEqual(drawn, ["spending"]);
  assert.deepEqual(staleViews(), ["home"]);
  page = "dashboard";
  drawStale("dashboard");
  assert.deepEqual(drawn, ["spending", "home"]);
  const keep = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => { try { fn(); } catch(e){} };
  try { drawViews({ all: true }); } finally { globalThis.setTimeout = keep; }
  assert.ok(drawn.includes("spending") && drawn.filter(x => x === "home").length === 2, "all: every view, whatever's showing");
});
