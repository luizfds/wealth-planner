import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Item 189: one card, one chart style. Every top-level card takes its corners and padding from the
// shared tokens in base.css, and both full charts carry the same tooltip.
var root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
var css = ["base", "dashboard", "ledger", "properties", "projections"].map(function(f){ return fs.readFileSync(path.join(root, "src/styles", f + ".css"), "utf8"); }).join("\n");
function rule(sel){
  var i = css.indexOf(sel + "{");
  assert.ok(i !== -1, sel + " has a rule");
  return css.slice(i, css.indexOf("}", i));
}

test("every top-level card uses the card tokens", function(){
  [".panel", ".stat-tile", ".home-card", "details.ledger", "  .card"].forEach(function(sel){
    var r = rule(sel);
    assert.match(r, /border-radius:\s*var\(--card-radius\)/, sel + " radius");
  });
  [".panel", ".stat-tile", ".home-card", "details.ledger > summary"].forEach(function(sel){
    assert.match(rule(sel), /padding:\s*var\(--card-py\) var\(--card-px\)/, sel + " padding");
  });
  // Goals are a section of compact cards, without a second outer card.
  assert.match(rule("  .sgl"), /border-radius:var\(--inner-radius\)/, "goal card uses the compact radius");
  assert.match(rule("  .sgl"), /background: var\(--paper-raised\)/, "goal card keeps its own surface");
  assert.match(rule(".panel h3"), /font-size:var\(--fs-lg\)/, "a card's title is a section title's size");
});

test("both full charts wire the shared tooltip", function(){
  var src = fs.readFileSync(path.join(root, "src/lib/charts.js"), "utf8");
  var line = src.slice(src.indexOf("export function renderLineChart"), src.indexOf("export function renderStackedAreaChart"));
  var stack = src.slice(src.indexOf("export function renderStackedAreaChart"));
  assert.match(line, /wireChartTooltip\(/);
  assert.match(stack, /wireChartTooltip\(/);
  assert.doesNotMatch(src, /addEventListener\("mousemove"/, "pointer events, so a tap works too");
});
