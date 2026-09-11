import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { state } from "../src/state.js";
import { computePersonTax } from "../src/calc/tax.js";

// ---------------- The take-home waterfall adds up (v2.88.0) ----------------
//
// The bar on the Tax & super card answers one question — everything that came in, and where it
// went — so the segments have to be exhaustive or the answer is a lie. They weren't: the Medicare
// levy surcharge (v2.82.0) and the HELP repayment (v2.81.0) both come out of take-home and neither
// was ever added to the segment list, so the bar left $23,198 of a $202,465 salary unaccounted for.
// Quietly wrong for five versions, on the most-read figure in the app.
//
// components/income.js can't be imported here (it touches the DOM at module scope), so this pins
// the identity against the same arithmetic the renderer uses, plus a source check that the segment
// list still carries every deduction computePersonTax can produce.

function withPerson(rows, settings, body){
  var s = { income: state.income, tax: state.tax, properties: state.properties, assets: state.assets };
  state.income = rows;
  state.tax = { sgRate: 12, ipOwnership: {}, settings: settings || {}, privateHospitalCover: false, familyThresholds: false };
  state.properties = [];
  state.assets = [];
  try { body(); }
  finally { state.income = s.income; state.tax = s.tax; state.properties = s.properties; state.assets = s.assets; }
}
function grossRow(person, amount){
  return { what: person + " salary", person: person, incomeType: "Gross", amount: amount, freq: "Yearly",
           superMode: "On top", sacrificeMode: "none" };
}
// Mirrors taxWaterfallValues()/taxWaterfallTotal() in components/income.js.
function segments(r){
  return {
    nettakehome: Math.max(0, r.netTakeHome),
    incometax: Math.max(0, r.incomeTax),
    medicare: Math.max(0, r.medicare),
    surcharge: Math.max(0, r.medicareSurcharge || 0),
    help: Math.max(0, r.helpRepayment || 0),
    sacrifice: Math.max(0, r.sacrifice)
  };
}
function segmentSum(r){
  var v = segments(r);
  return Object.keys(v).reduce(function(s, k){ return s + v[k]; }, 0);
}
function total(r){
  return Math.max(0, r.gross) + Math.max(0, r.dividendCash || 0) + Math.max(0, r.frankingCredit || 0);
}

test("the segments account for every dollar of a plain salary", function(){
  withPerson([grossRow("Sam", 120000)], {}, function(){
    var r = computePersonTax("Sam");
    assert.ok(Math.abs(segmentSum(r) - total(r)) < 0.01,
      "segments " + segmentSum(r) + " vs total " + total(r));
  });
});

test("...with a HELP debt", function(){
  // The exact case that was wrong: a $20k repayment vanished from the breakdown entirely.
  withPerson([grossRow("Sam", 200000)], { Sam: { superSacrificeAnnual: 0, concessionalCap: 30000, carryForward: 0, helpBalance: 60000 } }, function(){
    var r = computePersonTax("Sam");
    assert.ok(r.helpRepayment > 19000, "sanity: a real repayment");
    assert.ok(Math.abs(segmentSum(r) - total(r)) < 0.01,
      "unexplained " + (total(r) - segmentSum(r)));
  });
});

test("...with the Medicare levy surcharge", function(){
  withPerson([grossRow("Sam", 150000)], {}, function(){
    state.tax.privateHospitalCover = false;
    var r = computePersonTax("Sam");
    assert.ok(r.medicareSurcharge > 0, "sanity: a real surcharge");
    assert.ok(Math.abs(segmentSum(r) - total(r)) < 0.01);
  });
});

test("...with salary sacrifice, a surcharge and a HELP debt at once", function(){
  withPerson([grossRow("Sam", 220000)], { Sam: { superSacrificeAnnual: 15000, concessionalCap: 30000, carryForward: 0, helpBalance: 80000 } }, function(){
    var r = computePersonTax("Sam");
    assert.ok(r.sacrifice > 0 && r.medicareSurcharge > 0 && r.helpRepayment > 0);
    assert.ok(Math.abs(segmentSum(r) - total(r)) < 0.01);
  });
});

test("...and with dividends, where the total includes the cash and the credit", function(){
  withPerson([grossRow("Sam", 100000)], {}, function(){
    state.assets = [{ category: "Shares", person: "Sam", quantity: 10000, price: 10, dividendPerUnit: 0.7, frankedPct: 100 }];
    var r = computePersonTax("Sam");
    assert.equal(r.dividendCash, 7000);
    assert.ok(Math.abs(segmentSum(r) - total(r)) < 0.01,
      "net take-home carries the dividend cash, so the total has to as well");
  });
});

test("the segment list still names every deduction computePersonTax produces", function(){
  // A source-level guard, for the same reason tests/asset-urls.test.js is one: the failure mode is
  // somebody adding a deduction to the tax chain and not to this list, which no runtime assertion
  // in a DOM-free test can catch.
  var src = readFileSync(new URL("../src/components/income.js", import.meta.url), "utf8");
  var block = /var TAX_WATERFALL_SEGMENTS = \[[\s\S]*?\];/.exec(src);
  assert.ok(block, "TAX_WATERFALL_SEGMENTS should still be a literal list");
  ["nettakehome", "incometax", "medicare", "surcharge", "help", "sacrifice"].forEach(function(key){
    assert.match(block[0], new RegExp('key: "' + key + '"'), "missing segment: " + key);
  });
});

test("no two waterfall segments share a colour", function(){
  // series-color-5 (#008300) sat next to series-color-2 (#1baf7a) in the bar for one version:
  // two greens, telling Medicare levy apart from a HELP repayment by eye. Nothing about the
  // rendered output would fail without this — the bar draws perfectly well in one colour.
  var src = readFileSync(new URL("../src/components/income.js", import.meta.url), "utf8");
  var block = /var TAX_WATERFALL_SEGMENTS = \[[\s\S]*?\];/.exec(src)[0];
  var classes = block.match(/colorClass: "series-color-\d"/g) || [];
  assert.equal(classes.length, 6, "expected one colorClass per segment");
  assert.equal(new Set(classes).size, classes.length, "duplicate colour: " + classes.join(", "));
});

test("every segment carries a short legend label that fits a 118px column", function(){
  // The legend is a 118px-minimum auto-fit grid so it can hold two columns at 360px. `label` is
  // the bar's tooltip and can stay long; `short` is what actually gets printed and ellipsised.
  var src = readFileSync(new URL("../src/components/income.js", import.meta.url), "utf8");
  var block = /var TAX_WATERFALL_SEGMENTS = \[[\s\S]*?\];/.exec(src)[0];
  var shorts = (block.match(/short: "([^"]*)"/g) || []).map(function(s){ return s.slice(8, -1); });
  assert.equal(shorts.length, 6, "every segment needs a `short`");
  shorts.forEach(function(s){
    // ~13 chars is what 118px holds at the legend's 10.5px uppercase with .04em tracking.
    assert.ok(s.length <= 13, '"' + s + '" is too long for the legend column');
  });
});
