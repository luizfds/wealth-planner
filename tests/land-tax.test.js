import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { calcLandTax, landTaxByState, landTaxForProperty, landTaxDetailForProperty, totalLandTax, landTaxableProperties } from "../src/calc/property.js";

// Rates as at the 2025 land tax year — see LAND_TAX_BRACKETS. These assertions are worked from the
// published scales by hand, so they double as the record of what the table is supposed to say: if
// a state revises its rates, these fail and name the bracket that moved.

test("below the threshold is nil in every state", () => {
  assert.equal(calcLandTax("NSW", 1000000), 0);
  assert.equal(calcLandTax("NSW", 1075000), 100);   // exactly at the threshold: base only
  assert.equal(calcLandTax("VIC", 49999), 0);
  assert.equal(calcLandTax("QLD", 599999), 0);
});

test("NSW: $100 + 1.6% above the general threshold", () => {
  // $1,575,000 is $500,000 over the $1,075,000 threshold -> 100 + 0.016*500000
  assert.equal(calcLandTax("NSW", 1575000), 100 + 8000);
});

test("NSW: the premium bracket takes over above $6,571,000", () => {
  // $7,571,000 is $1,000,000 over -> 88,036 + 2%
  assert.equal(calcLandTax("NSW", 7571000), 88036 + 20000);
  // Just under the premium threshold still uses the general rate.
  assert.equal(Math.round(calcLandTax("NSW", 6570000)), Math.round(100 + 0.016 * (6570000 - 1075000)));
});

test("VIC: the bottom brackets are flat amounts, not marginal", () => {
  assert.equal(calcLandTax("VIC", 50000), 500);
  assert.equal(calcLandTax("VIC", 99999), 500);
  assert.equal(calcLandTax("VIC", 100000), 975);
  assert.equal(calcLandTax("VIC", 299999), 975);
});

test("VIC: marginal brackets start at $300,000", () => {
  assert.equal(calcLandTax("VIC", 400000), 1350 + 0.003 * 100000);
  assert.equal(calcLandTax("VIC", 1500000), 4650 + 0.009 * 500000);
  assert.equal(calcLandTax("VIC", 4000000), 31650 + 0.0265 * 1000000);
});

test("QLD: individual scale", () => {
  assert.equal(calcLandTax("QLD", 800000), 500 + 0.01 * 200000);
  assert.equal(calcLandTax("QLD", 2000000), 4500 + 0.0165 * 1000000);
  assert.equal(calcLandTax("QLD", 4000000), 37500 + 0.0125 * 1000000);
});

test("a state with no table returns null, not zero", () => {
  // "we don't have that scale" and "you owe nothing" must not look the same.
  assert.equal(calcLandTax("TAS", 5000000), null);
  assert.equal(calcLandTax("Other", 5000000), null);
  assert.equal(calcLandTax(undefined, 5000000), null);
});

function withProperties(properties, fn){
  const prev = state.properties;
  state.properties = properties;
  try { fn(); } finally { state.properties = prev; }
}

test("a principal home is exempt and is not aggregated with the investments", () => {
  withProperties([
    { id: "h1", what: "Home", kind: "PPOR", state: "NSW", landValue: 2000000 },
    { id: "p1", what: "IP", kind: "IP", state: "NSW", landValue: 900000 }
  ], () => {
    assert.equal(landTaxableProperties().length, 1);
    // The IP alone is under the $1,075,000 threshold. If the home were aggregated in, the
    // combined $2.9m would be taxed instead — the error this exemption exists to avoid.
    assert.equal(totalLandTax(), 0);
  });
});

test("two properties in one state are one aggregated assessment, not two", () => {
  withProperties([
    { id: "p1", what: "A", kind: "IP", state: "NSW", landValue: 700000 },
    { id: "p2", what: "B", kind: "IP", state: "NSW", landValue: 700000 }
  ], () => {
    const groups = landTaxByState();
    assert.equal(groups.length, 1);
    assert.equal(groups[0].landValue, 1400000);
    // Each alone would be under the threshold and pay nothing; together they are taxed.
    assert.equal(calcLandTax("NSW", 700000), 0);
    assert.equal(groups[0].tax, 100 + 0.016 * (1400000 - 1075000));
    assert.ok(groups[0].tax > 0, "aggregation is the whole point");
  });
});

test("states are assessed separately, never pooled", () => {
  withProperties([
    { id: "p1", what: "A", kind: "IP", state: "NSW", landValue: 900000 },
    { id: "p2", what: "B", kind: "IP", state: "QLD", landValue: 500000 }
  ], () => {
    const groups = landTaxByState();
    assert.equal(groups.length, 2);
    // Both are under their own state's threshold, so pooling them would invent a bill.
    assert.equal(totalLandTax(), 0);
  });
});

test("each property's share adds back up to the state's real bill", () => {
  withProperties([
    { id: "p1", what: "A", kind: "IP", state: "VIC", landValue: 900000 },
    { id: "p2", what: "B", kind: "IP", state: "VIC", landValue: 300000 }
  ], () => {
    const g = landTaxByState()[0];
    const summed = g.properties.reduce((s, p) => s + p.tax, 0);
    assert.ok(Math.abs(summed - g.tax) < 1e-9, "apportionment must be lossless");
    // Apportioned by land value, so the bigger block carries three quarters of it.
    assert.ok(Math.abs(g.properties[0].share - 0.75) < 1e-9);
    assert.ok(Math.abs(landTaxForProperty("p1") - g.tax * 0.75) < 1e-9);
  });
});

test("a property's share is not what it would pay standing alone", () => {
  withProperties([
    { id: "p1", what: "A", kind: "IP", state: "NSW", landValue: 700000 },
    { id: "p2", what: "B", kind: "IP", state: "NSW", landValue: 700000 }
  ], () => {
    // Alone: nothing. Aggregated: half of a real bill. The non-linearity is the point.
    assert.equal(calcLandTax("NSW", 700000), 0);
    assert.ok(landTaxForProperty("p1") > 0);
  });
});

test("properties with no land value or an unsupported state are left out", () => {
  withProperties([
    { id: "p1", what: "No land value", kind: "IP", state: "NSW", landValue: 0 },
    { id: "p2", what: "Unsupported", kind: "IP", state: "TAS", landValue: 5000000 },
    { id: "p3", what: "No state", kind: "IP", landValue: 5000000 }
  ], () => {
    assert.equal(landTaxableProperties().length, 0);
    assert.equal(totalLandTax(), 0);
    assert.equal(landTaxForProperty("p2"), 0);
  });
});

// The caption on the computed expense row has to say which of two different things the figure is.
test("landTaxDetailForProperty reports the group it was assessed with", () => {
  withProperties([
    { id: "p1", what: "A", kind: "IP", state: "NSW", landValue: 700000 },
    { id: "p2", what: "B", kind: "IP", state: "NSW", landValue: 700000 }
  ], () => {
    const d = landTaxDetailForProperty("p1");
    assert.equal(d.groupCount, 2);
    assert.equal(d.groupLandValue, 1400000);
    assert.equal(d.landValue, 700000);
    // Naming this property's own $700,000 would caption the figure with a value that owes $0.
    assert.equal(calcLandTax("NSW", d.landValue), 0);
    assert.ok(d.tax > 0);
  });
});

test("a lone property reports a group of one, so it can be captioned plainly", () => {
  withProperties([
    { id: "p1", what: "A", kind: "IP", state: "NSW", landValue: 1575000 }
  ], () => {
    const d = landTaxDetailForProperty("p1");
    assert.equal(d.groupCount, 1);
    assert.equal(d.groupLandValue, 1575000);
    assert.equal(d.tax, calcLandTax("NSW", 1575000));
  });
});

test("landTaxDetailForProperty is null for a property that isn't assessed", () => {
  withProperties([{ id: "h1", what: "Home", kind: "PPOR", state: "NSW", landValue: 2000000 }], () => {
    assert.equal(landTaxDetailForProperty("h1"), null);
    assert.equal(landTaxForProperty("h1"), 0);
  });
});
