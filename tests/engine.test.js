import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state, defaultInvestConfig, defaultPurchaseConfig } from "../src/state.js";
import { computeNetWorthSeries } from "../src/calc/engine.js";

// computeNetWorthSeries() is a module-level singleton consumer (imports { state } directly),
// so these tests reset every field it touches before each one rather than constructing a fresh
// state object — there's no dependency-injection seam here, and this mirrors how the app itself
// always has exactly one live `state`.
function resetState(){
  state.scenarios = ["Test"];
  state.baselineScenario = "Test";
  state.activeScenario = "Test";
  state.income = [{ what: "Salary", classification: "", account: "", incomeType: "Net", amount: 6000, freq: "Monthly" }];
  state.shared = [];
  state.home = { Test: [] };
  state.properties = [];
  state.assets = [];
  state.purchase = { Test: defaultPurchaseConfig(0, 20, 6.0, 30, "NSW", false) };
  state.invest = { Test: defaultInvestConfig() };
  state.projection = { horizonYears: 5, investReturnRate: 0, propertyAppreciationRate: 0, inflationRate: 0, rateShockPct: 0 };
  state.tax = { sgRate: 12, ipOwnership: {}, settings: {} };
}

test("invest leg disabled: net worth series is unaffected (pure regression check)", function(){
  resetState();
  var series = computeNetWorthSeries("Test", 2);
  // $6000/mo income, no expenses, 0% portfolio growth => $72,000/yr accumulates in the generic
  // portfolio exactly as it always has, invest leg untouched.
  assert.ok(Math.abs(series[1].y - 72000) < 1e-6);
  assert.ok(Math.abs(series[2].y - 144000) < 1e-6);
});

test("invest leg 'auto' mode redirects the full monthly surplus into the leg's own growth rate, not on top of the generic portfolio", function(){
  resetState();
  state.invest.Test = Object.assign(defaultInvestConfig("Shares"), { enabled: true, contributionMode: "auto", growthRatePct: 0 });
  var series = computeNetWorthSeries("Test", 2);
  // With 0% growth on both legs, this must total exactly the same as the disabled case above —
  // redirecting where the $6000/mo surplus accumulates doesn't create or destroy money.
  assert.ok(Math.abs(series[1].y - 72000) < 1e-6);
  assert.ok(Math.abs(series[2].y - 144000) < 1e-6);
});

test("invest leg 'manual' mode splits the surplus between the leg and the generic portfolio, total unchanged", function(){
  resetState();
  state.invest.Test = Object.assign(defaultInvestConfig("Shares"), {
    enabled: true, contributionMode: "manual", monthlyContribution: 1000, growthRatePct: 0
  });
  var series = computeNetWorthSeries("Test", 1);
  // $1000/mo of the $6000/mo surplus goes to the invest leg, the remaining $5000/mo still
  // compounds in the generic portfolio as before — the combined total must be identical to the
  // single-bucket case, only the split between the two changes.
  assert.ok(Math.abs(series[1].y - 72000) < 1e-6);
});

test("invest leg's initial lump sum is reallocated out of the generic portfolio, not duplicated", function(){
  resetState();
  state.assets = [{ what: "Cash", category: "Cash", amount: 50000 }];
  state.income = []; // isolate this test to the lump-sum reallocation, no monthly flow
  state.invest.Test = Object.assign(defaultInvestConfig("Shares"), {
    enabled: true, contributionMode: "manual", monthlyContribution: 0, initialAmount: 20000, growthRatePct: 0
  });
  var series = computeNetWorthSeries("Test", 0);
  // Today's snapshot (year 0, before any growth) must still total the original $50k regardless
  // of how much of it is earmarked for the invest leg vs. the generic portfolio.
  assert.ok(Math.abs(series[0].y - 50000) < 1e-6);
});

test("invest leg wins over an accidentally-also-enabled purchase leg, matching migrateState()'s own precedence", function(){
  resetState();
  state.purchase.Test = Object.assign(defaultPurchaseConfig(500000, 20, 6, 30, "NSW", true), { enabled: true });
  state.invest.Test = Object.assign(defaultInvestConfig("Shares"), { enabled: true, contributionMode: "manual", monthlyContribution: 0, growthRatePct: 0 });
  var series = computeNetWorthSeries("Test", 1);
  // If the purchase leg were still active too, year 0 would show ~$500k of home equity net of
  // the loan; with invest winning, there's no property leg at all, so year 0 is just $0 (no
  // assets, no invest lump sum, no property).
  assert.ok(Math.abs(series[0].y - 0) < 1e-6);
});
