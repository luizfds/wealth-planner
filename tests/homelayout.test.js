import { test } from "node:test";
import assert from "node:assert/strict";
import { HOME_CARDS, INSIGHT_PANELS, normaliseLayout, moveCard, homeArrangeHtml } from "../src/lib/homelayout.js";

var keys = HOME_CARDS.map(function(c){ return c.key; });

test("a new device gets every card once, in the default order", function(){
  var l = normaliseLayout(null);
  assert.deepEqual(l.order, keys);
  assert.deepEqual(l.hidden, {});
  assert.deepEqual(l.pinned, []);
});

test("a saved order keeps its order, drops what's unknown and repeated, and adds cards it never had", function(){
  var l = normaliseLayout({ order: ["month", "nope", "nw", "month"], hidden: { goals: true, nope: true, nw: false }, pinned: ["firePanel", "x", "firePanel"] });
  assert.equal(l.order.indexOf("month") < l.order.indexOf("nw"), true);
  assert.equal(l.order.length, keys.length);
  assert.deepEqual(l.hidden, { goals: true });
  assert.deepEqual(l.pinned, ["firePanel"]);
});

test("an order saved before Needs you: its bills and to-dos become Needs you, in their place; a new card goes in its own place", function(){
  var l = normaliseLayout({ order: ["nw", "bills", "month", "todo"], hidden: { todo: true } });
  assert.deepEqual(l.order.filter(function(k){ return ["nw", "needs", "month"].indexOf(k) !== -1; }), ["nw", "needs", "month"]);
  assert.equal(l.order.indexOf("bills"), -1); assert.equal(l.order.indexOf("todo"), -1);
  assert.deepEqual(l.hidden, {}, "only one of the two was hidden: Needs you shows");
  assert.deepEqual(normaliseLayout({ hidden: { bills: true, todo: true } }).hidden, { needs: true });
  // The glance, new, goes first — before the first card the default order has after it — not at the end.
  assert.equal(normaliseLayout({ order: ["month", "nw", "goals"] }).order[0], "glance");
});

test("moving a card swaps it with its neighbour in its own group, and stops at the ends", function(){
  var l = moveCard(normaliseLayout({}), "month", -1);
  assert.ok(l.order.indexOf("month") < l.order.indexOf("nw"));
  assert.deepEqual(moveCard(l, "month", -1).order, l.order);
  // The first figure moving up doesn't jump into the cards.
  var f = moveCard(normaliseLayout({}), "savings", -1);
  assert.deepEqual(f.order, keys);
  var g = moveCard(normaliseLayout({}), "savings", 1);
  assert.equal(g.order.indexOf("projected") < g.order.indexOf("savings"), true);
});

test("the sheet lists every card, figure and Insights panel", function(){
  var html = homeArrangeHtml();
  HOME_CARDS.forEach(function(c){ assert.ok(html.indexOf('data-ha-show="' + c.key + '"') !== -1, c.key); });
  INSIGHT_PANELS.forEach(function(p){ assert.ok(html.indexOf('data-ha-pin="' + p.id + '"') !== -1, p.id); });
  assert.ok(html.indexOf('data-ha-move="goals"') === -1);
  assert.ok(html.indexOf('data-ha-move="week"') === -1);
});
