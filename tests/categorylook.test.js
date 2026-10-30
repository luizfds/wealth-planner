import { test } from "node:test";
import assert from "node:assert/strict";
import { categoryLook, renameCategoryLook, CATEGORY_COLORS, CATEGORY_ICONS } from "../src/calc/categorylook.js";
import { DEFAULT_CATEGORIES } from "../src/constants.js";

test("each default category gets an icon from its name", function(){
  assert.equal(categoryLook("Groceries").icon, "cart");
  assert.equal(categoryLook("Eating out").icon, "fork");
  assert.equal(categoryLook("Investment property").icon, "building");
  assert.equal(categoryLook("Housing").icon, "house");
  assert.equal(categoryLook("Public transport").icon, "bus");
  DEFAULT_CATEGORIES.filter(function(n){ return n !== "Other"; }).forEach(function(n){
    assert.notEqual(categoryLook(n).icon, "dot", n + " should have an icon of its own");
  });
});

test("a name nothing matches keeps the same colour every time", function(){
  var a = categoryLook("Woodworking club"), b = categoryLook("Woodworking club");
  assert.equal(a.icon, "dot");
  assert.equal(a.color, b.color);
  assert.ok(a.color >= 0 && a.color < CATEGORY_COLORS);
});

test("the household's own pick wins, field by field, and bad values are ignored", function(){
  var looks = { Groceries: { color: 6 }, Fuel: { icon: "plane" }, Gym: { color: 99, icon: "rocket" } };
  assert.deepEqual(categoryLook("Groceries", looks), { color: 6, icon: "cart", custom: true });
  assert.equal(categoryLook("Fuel", looks).icon, "plane");
  var gym = categoryLook("Gym", looks);
  assert.equal(gym.color, categoryLook("Gym").color);
  assert.equal(gym.icon, "dumbbell");
  assert.ok(CATEGORY_ICONS.indexOf("dot") !== -1);
});

test("a rename carries the look across without overwriting one already there", function(){
  var moved = renameCategoryLook({ Food: { color: 2 } }, "Food", "Groceries");
  assert.deepEqual(moved, { Groceries: { color: 2 } });
  var kept = renameCategoryLook({ Food: { color: 2 }, Groceries: { color: 5 } }, "Food", "Groceries");
  assert.deepEqual(kept, { Groceries: { color: 5 } });
});
