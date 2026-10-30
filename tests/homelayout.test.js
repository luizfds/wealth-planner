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
  var l = normaliseLayout({ order: ["bills", "nope", "nw", "bills"], hidden: { todo: true, nope: true, nw: false }, pinned: ["firePanel", "x", "firePanel"] });
  assert.deepEqual(l.order.slice(0, 2), ["bills", "nw"]);
  assert.equal(l.order.length, keys.length);
  assert.deepEqual(l.hidden, { todo: true });
  assert.deepEqual(l.pinned, ["firePanel"]);
});

test("moving a card swaps it with its neighbour in its own group, and stops at the ends", function(){
  var l = moveCard(normaliseLayout({}), "month", -1);
  assert.deepEqual(l.order.slice(0, 2), ["month", "nw"]);
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
});
