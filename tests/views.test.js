import { test } from "node:test";
import assert from "node:assert/strict";
import { defineView, drawViews, drawStale, redraw, staleViews, viewsReading, redrawTouched } from "../src/lib/views.js";

// v3.205.0 (item 236a): pages drawn when seen. A stand-in page whose current page the test sets.
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

// v3.206.0 (item 236b): an edit says what it touched (state.js commit); the views that read it are redrawn.
test("an edit redraws only the views that read what it touched", function(){
  page = "expenses";
  defineView("ledger", ["expenses"], () => drawn.push("ledger"), ["transactions", "transfers"]);
  defineView("plan", ["plan"], () => drawn.push("plan"), ["scenarioChanges"]);
  defineView("budget", ["expenses"], () => drawn.push("budget"), ["shared"]);
  const names = viewsReading(["transfers"]);
  assert.ok(names.includes("ledger") && !names.includes("plan") && !names.includes("budget"));
  assert.ok(names.includes("header") && names.includes("home"), "a view that reads anything reads this too");
  assert.ok(viewsReading(["*"]).includes("plan"), "touched everything: every view");
  drawn.length = 0;
  const keep = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => { try { fn(); } catch(e){} };
  try { redrawTouched(["scenarioChanges"]); } finally { globalThis.setTimeout = keep; }
  assert.ok(!drawn.includes("plan") && staleViews().includes("plan"), "off screen: left for when Plan opens");
  assert.ok(!drawn.includes("ledger") && !drawn.includes("budget"), "what doesn't read it isn't drawn");
});

test("a later view is drawn once after the edit's frame, however many edits ask", function(){
  const queued = [];
  const keep = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => { queued.push(fn); };
  let n = 0;
  try {
    defineView("bell", null, () => { n++; }, ["*"], { later: true });
    redraw(["bell"]); redraw(["bell"]);
    assert.equal(n, 0, "not inside the edit");
    assert.equal(queued.length, 1, "queued once");
    queued[0]();
    assert.equal(n, 1);
  } finally { globalThis.setTimeout = keep; }
});
