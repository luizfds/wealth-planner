import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { scenarioTimeline, yearText } from "../src/calc/scenariotimeline.js";

test("the changes in the order they land, the unreached last", function(){
  var t = scenarioTimeline({ age: 38, buying: false, investing: false, triggers: { ip: 5, far: null },
    propertyName: function(){ return "1 Example St"; },
    changes: [
      { id: "far", kind: "cost", what: "A boat", amount: 400, when: "cash", whenCash: 9000000 },
      { id: "ret", kind: "retire", age: 58 },
      { id: "ip", kind: "ip", what: "Example unit", when: "cash", whenCash: 250000 },
      { id: "s", kind: "sell", propertyId: "p1", fromYear: 1 },
      { id: "r", kind: "rent", amount: 760, freq: "Weekly", fromYear: 0 },
      { id: "h", kind: "home" }
    ] });
  assert.deepEqual(t.map(function(e){ return [yearText(e.year), e.label, e.why]; }), [
    ["Now", "Rent $760/wk", ""],
    ["Year 2", "Sell 1 Example St", ""],
    ["Year 5", "Buy Example unit", "when cash reaches $250,000"],   // the projection's year 5 (triggers) is the 5th from now
    ["Year 21", "Retire at 58", ""],
    ["Not within 30 years", "A boat", "when cash reaches $9,000,000"]
  ]);
});
