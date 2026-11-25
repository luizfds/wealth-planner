import test from "node:test";
import assert from "node:assert/strict";
import { furnishingDecision } from "../src/calc/furnishing.js";
test("a trial purchase uses the smaller of budget remaining and cash above the buffer", function(){
  assert.deepEqual(furnishingDecision(12000, 2350, 8000, 5000, 2400), {
    remaining: 9650, available: 3000, after: 5600, bufferMargin: 600, budgetMargin: 7250
  });
  assert.equal(furnishingDecision(500, 350, 9000, 1000, 200).available, 150);
  assert.equal(furnishingDecision(100, 110, -10, 20, 5).available, 0);
  assert.equal(furnishingDecision(1, 0, 0.3, 0.1, 0.2).bufferMargin, 0);
});
