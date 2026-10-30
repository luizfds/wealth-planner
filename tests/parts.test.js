import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { partOn, partHasData, partAllows, partReading } from "../src/calc/parts.js";
import { REPORTS } from "../src/calc/reports.js";

var renter = { properties: [], assets: [{ category: "Cash", what: "Bank One savings" }], parts: {} };
var owner = { properties: [{ id: "p1", what: "1 Example St" }], assets: [{ category: "Shares", what: "VAS" }], parts: {} };

test("a part shows when the household has one, unless it said otherwise", function(){
  assert.equal(partOn("property", renter), false);
  assert.equal(partOn("shares", renter), false);
  assert.equal(partOn("property", owner), true);
  assert.equal(partOn("shares", owner), true);
  assert.equal(partOn("property", Object.assign({}, renter, { parts: { property: "on" } })), true, "said yes before adding one");
  assert.equal(partOn("shares", Object.assign({}, owner, { parts: { shares: "off" } })), false, "said no with one there");
  assert.equal(partHasData("shares", owner), true);
  assert.deepEqual(partReading("property", renter), { setting: "auto", on: false, hasData: false });
});

test("notices and checks about a part that's off stay out; the rest come through", function(){
  var off = Object.assign({}, owner, { parts: { property: "off", shares: "off" } });
  ["payg:Alex", "offset-move", "ded-noprop:x", "dep-missing:p1", "loan-purpose:l1", "own:p1", "rent-vs-statements:p1", "concentration", "tiny-holdings"].forEach(function(id){
    assert.equal(partAllows(id, off), false, id);
    assert.equal(partAllows(id, owner), true, id + " while on");
  });
  ["super-room:Alex", "savings-rate", "ef-low", "people-dob:Sam", "ownership"].forEach(function(id){ assert.equal(partAllows(id, off), true, id); });
});

test("the property and share reports name their part", function(){
  var byKey = {}; REPORTS.forEach(function(r){ byKey[r.key] = r.part; });
  assert.equal(byKey.propreturns, "property");
  assert.equal(byKey.property, "property");
  assert.equal(byKey.cgt, "shares");
  assert.equal(byKey.networth, undefined, "everyone's reports have no part");
});
