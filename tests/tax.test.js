import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { incomeTaxAU, marginalRateAU, medicareLevyAU } from "../src/calc/tax.js";

// Expected figures pinned to the AU_TAX_BRACKETS table in src/constants.js — update alongside
// it if the brackets are re-indexed for a new financial year.

test("incomeTaxAU is $0 up to the tax-free threshold", function(){
  assert.equal(incomeTaxAU(0), 0);
  assert.equal(incomeTaxAU(18200), 0);
});

test("incomeTaxAU applies each bracket's base + marginal rate at its boundaries", function(){
  assert.ok(Math.abs(incomeTaxAU(45000) - 4288) < 1e-9);
  assert.ok(Math.abs(incomeTaxAU(135000) - 31288) < 1e-9);
  assert.ok(Math.abs(incomeTaxAU(190000) - 51638) < 1e-9);
  assert.ok(Math.abs(incomeTaxAU(200000) - 56138) < 1e-9);
});

test("incomeTaxAU treats negative/non-numeric input as $0 taxable income", function(){
  assert.equal(incomeTaxAU(-500), 0);
  assert.equal(incomeTaxAU("not a number"), 0);
});

test("marginalRateAU returns the rate for the bracket the income falls in", function(){
  assert.equal(marginalRateAU(10000), 0);
  assert.equal(marginalRateAU(30000), 0.16);
  assert.equal(marginalRateAU(100000), 0.30);
  assert.equal(marginalRateAU(160000), 0.37);
  assert.equal(marginalRateAU(300000), 0.45);
});

test("medicareLevyAU shades in between the low-income thresholds, then flat 2%", function(){
  assert.equal(medicareLevyAU(20000), 0);
  assert.ok(Math.abs(medicareLevyAU(30000) - 400) < 1e-9);
  assert.ok(Math.abs(medicareLevyAU(40000) - 800) < 1e-9);
});

// ---------------- Per-scenario income (v2.79.0) ----------------
//
// An income row can carry the same sparse scenarioOverrides map a shared expense can. The reason
// this needs its own tests rather than reusing resolveSharedAmount's: a Gross row's amount is an
// *input to the tax engine*, so an override has to move the marginal rate, the Medicare levy and
// the SG with it — not just subtract from a total at the end.

import { state } from "../src/state.js";
import {
  scenarioIncomeMonthly, scenarioIncomeRows, computePersonTax, effectiveIncomeItems
} from "../src/calc/tax.js";

function withIncome(rows, body){
  var savedIncome = state.income, savedTax = state.tax, savedProps = state.properties;
  state.income = rows;
  state.tax = { sgRate: 12, ipOwnership: {}, settings: {} };
  state.properties = [];
  try { body(); }
  finally { state.income = savedIncome; state.tax = savedTax; state.properties = savedProps; }
}
function grossRow(person, amount, overrides){
  return {
    what: person + " salary", person: person, incomeType: "Gross", amount: amount, freq: "Yearly",
    superMode: "On top", sacrificeMode: "none", scenarioOverrides: overrides
  };
}

test("a Gross row's override moves the tax, not just the total", function(){
  withIncome([grossRow("Sam", 180000, { "Part time": 90000 })], function(){
    var full = computePersonTax("Sam");
    var part = computePersonTax("Sam", { scenario: "Part time" });
    assert.equal(full.gross, 180000);
    assert.equal(part.gross, 90000);
    // Halving the salary must more than halve the tax — that's the whole point of running it
    // through the brackets rather than scaling the net figure.
    assert.ok(part.totalTax < full.totalTax / 2,
      "progressive brackets: " + part.totalTax + " should be well under half of " + full.totalTax);
    assert.ok(part.netTakeHome > full.netTakeHome / 2, "and net take-home more than halves");
  });
});

test("employer super follows the override too", function(){
  withIncome([grossRow("Sam", 180000, { "Part time": 90000 })], function(){
    var full = computePersonTax("Sam");
    var part = computePersonTax("Sam", { scenario: "Part time" });
    assert.ok(Math.abs(part.sg - full.sg / 2) < 1e-6, "SG is a flat rate, so it halves exactly");
  });
});

test("a scenario with no override for a row falls back to its plain amount", function(){
  withIncome([grossRow("Sam", 180000, { "Part time": 90000 })], function(){
    assert.equal(computePersonTax("Sam", { scenario: "Renting" }).gross, 180000);
    assert.equal(computePersonTax("Sam", {}).gross, 180000);
    assert.equal(computePersonTax("Sam").gross, 180000, "no opts at all behaves as before");
  });
});

test("scenarioIncomeMonthly combines typed net rows with recomputed take-home", function(){
  withIncome([
    grossRow("Sam", 120000),
    { what: "Dividends", incomeType: "Net", amount: 500, freq: "Monthly", scenarioOverrides: { Lean: 0 } }
  ], function(){
    var base = scenarioIncomeMonthly({ scenario: "Renting" });
    var lean = scenarioIncomeMonthly({ scenario: "Lean" });
    assert.ok(Math.abs((base - lean) - 500) < 1e-6, "only the dividend row differs");
    // Cent tolerance, not 1e-6: the synthetic row is rounded to cents, same as the stored one
    // recalcComputedItems() writes — deliberately, so the two never disagree by a fraction.
    assert.ok(Math.abs(base - (computePersonTax("Sam").netTakeHome / 12 + 500)) < 0.01);
  });
});

test("scenarioIncomeRows never hands back a live state object it has altered", function(){
  // These are the user's own rows; a caller summing them must not be able to edit their data.
  withIncome([{ what: "Dividends", incomeType: "Net", amount: 500, freq: "Monthly", scenarioOverrides: { Lean: 0 } }], function(){
    var rows = scenarioIncomeRows({ scenario: "Lean" });
    var dividends = rows.find(function(r){ return r.what === "Dividends"; });
    assert.equal(dividends.amount, 0);
    assert.notEqual(dividends, state.income[0], "must be a copy when an override applies");
    assert.equal(state.income[0].amount, 500, "the stored row is untouched");
  });
});

test("scenarioIncomeRows skips state.income's own synthetic rows and emits its own", function(){
  // Otherwise the baseline synthetic row (computed from plain amounts) would be counted alongside
  // the per-scenario one derived from the same gross salary — double-counting an entire income.
  withIncome([
    grossRow("Sam", 120000),
    { what: "Sam — net income", amount: 7000, freq: "Monthly", computed: true, syntheticNetFor: "Sam" }
  ], function(){
    var rows = scenarioIncomeRows({ scenario: "Renting" });
    var forSam = rows.filter(function(r){ return r.syntheticNetFor === "Sam"; });
    assert.equal(forSam.length, 1);
    assert.notEqual(forSam[0].amount, 7000, "recomputed, not the stale stored figure");
  });
});

test("a person who stops working keeps a row, at $0", function(){
  // Dropping the row entirely would make "took the year off" indistinguishable from "this person
  // isn't in the plan", which are different answers.
  withIncome([grossRow("Sam", 120000, { "Year off": 0 })], function(){
    var rows = scenarioIncomeRows({ scenario: "Year off" });
    var sam = rows.find(function(r){ return r.syntheticNetFor === "Sam"; });
    assert.ok(sam, "row still present");
    assert.equal(sam.amount, 0);
    assert.equal(scenarioIncomeMonthly({ scenario: "Year off" }), 0);
  });
});

test("includeRow reaches inside the tax chain, not just its output", function(){
  // The projection uses this to honour endDate. Filtering afterwards would leave a salary that
  // has ended still paying tax, so the remaining income would come out too low.
  withIncome([grossRow("Sam", 120000), grossRow("Alex", 60000)], function(){
    var both = scenarioIncomeMonthly({});
    var samOnly = scenarioIncomeMonthly({ includeRow: function(r){ return r.person !== "Alex"; } });
    assert.ok(samOnly < both);
    assert.ok(Math.abs(samOnly - computePersonTax("Sam").netTakeHome / 12) < 0.01,
      "Alex's row is gone from the tax computation entirely, not netted off afterwards");
  });
});

test("effectiveIncomeItems stays the baseline view", function(){
  // Deliberately unchanged: it's what the Income page's own list and total show, and that page
  // has no scenario selector.
  withIncome([grossRow("Sam", 120000, { Lean: 1 }), { what: "Dividends", incomeType: "Net", amount: 500, freq: "Monthly" }], function(){
    var items = effectiveIncomeItems();
    assert.equal(items.length, 1);
    assert.equal(items[0].what, "Dividends");
  });
});

// ---------------- HELP / HECS (v2.81.0) ----------------

import { helpRepaymentRate, helpRepaymentAnnual, helpNextThreshold } from "../src/calc/tax.js";

test("the HELP rate is a flat percentage of the whole income, not marginal", function(){
  // This is the thing people get wrong about it, and the reason the panel names the next
  // threshold: at $54,435 you repay 1% of all of it, not 1% of the dollar above the threshold.
  assert.equal(helpRepaymentRate(54434), 0);
  assert.equal(helpRepaymentRate(54435), 0.01);
  assert.ok(Math.abs(helpRepaymentAnnual(54435, 50000) - 544.35) < 0.01);
  // One dollar of income either side of a threshold, and the repayment jumps by the whole band.
  assert.equal(helpRepaymentAnnual(54434, 50000), 0);
});

test("the top band applies to everything above it", function(){
  assert.equal(helpRepaymentRate(159664), 0.10);
  assert.equal(helpRepaymentRate(1000000), 0.10);
  assert.equal(helpRepaymentAnnual(200000, 999999), 20000);
});

test("no balance means no repayment, whatever the income", function(){
  assert.equal(helpRepaymentAnnual(200000, 0), 0);
  assert.equal(helpRepaymentAnnual(200000, null), 0);
});

test("a repayment never exceeds what's left owing", function(){
  // The final year's repayment is whatever remains, not a full year's percentage — without this
  // the app would go on "repaying" a debt that's already cleared.
  assert.equal(helpRepaymentAnnual(200000, 500), 500);
  assert.equal(helpRepaymentAnnual(200000, 25000), 20000, "and is not capped when the balance is larger");
});

test("helpNextThreshold names what crossing it actually costs", function(){
  var next = helpNextThreshold(54000);
  assert.equal(next.at, 54435);
  assert.equal(next.away, 435);
  // The cost is the jump in the whole-income repayment (1% of $54,435), not the rate difference.
  assert.ok(Math.abs(next.stepCost - 544.35) < 0.01);
  assert.equal(helpNextThreshold(200000), null, "nothing above the top band");
});

test("repayment income adds back salary sacrifice and ignores a rental loss", function(){
  // The two traps: sacrificing into super does NOT reduce what you repay, and neither does
  // negative gearing. Both reduce taxable income, so inferring the repayment from that figure
  // understates it — which is exactly why this is computed and shown separately.
  withIncome([grossRow("Sam", 120000)], function(){
    state.tax.settings.Sam = { superSacrificeAnnual: 20000, concessionalCap: 30000, carryForward: 0, helpBalance: 50000 };
    var t = computePersonTax("Sam");
    assert.ok(t.taxable < 120000, "sacrifice reduced taxable income");
    assert.equal(t.repaymentIncome, 120000, "but not repayment income");
    assert.ok(Math.abs(t.helpRepayment - 120000 * helpRepaymentRate(120000)) < 0.01);
  });
});

test("a HELP repayment comes out of take-home but is not counted as tax", function(){
  // It's a debt repayment, not a tax: folding it into totalTax would overstate the effective rate.
  // It still leaves the same pay, so every net figure downstream has to see it.
  withIncome([grossRow("Sam", 120000)], function(){
    state.tax.settings.Sam = { superSacrificeAnnual: 0, concessionalCap: 30000, carryForward: 0, helpBalance: 0 };
    var without = computePersonTax("Sam");
    state.tax.settings.Sam.helpBalance = 50000;
    var withDebt = computePersonTax("Sam");
    assert.equal(withDebt.totalTax, without.totalTax, "tax is unchanged");
    assert.equal(withDebt.effectiveRate, without.effectiveRate, "and so is the effective tax rate");
    assert.ok(Math.abs((without.netTakeHome - withDebt.netTakeHome) - withDebt.helpRepayment) < 0.01,
      "take-home drops by exactly the repayment");
    assert.equal(withDebt.helpBalanceAfter, 50000 - withDebt.helpRepayment);
  });
});

test("a person with no HELP settings behaves exactly as before", function(){
  withIncome([grossRow("Sam", 120000)], function(){
    delete state.tax.settings.Sam;
    var t = computePersonTax("Sam");
    assert.equal(t.helpBalance, 0);
    assert.equal(t.helpRepayment, 0);
    assert.equal(t.helpNext, null, "no next-threshold nudge for someone with no debt");
  });
});

// ---------------- Medicare levy surcharge (v2.82.0) ----------------

import { medicareSurchargeAnnual, mlsTierFor, mlsNextTier, mlsThresholds } from "../src/calc/tax.js";

test("holding private hospital cover means no surcharge at any income", function(){
  // The whole point of the levy: it's a charge for *not* holding cover.
  assert.equal(medicareSurchargeAnnual(500000, true, false), 0);
  assert.equal(medicareSurchargeAnnual(97000, true, false), 0);
});

test("the surcharge is flat on the whole income, not marginal", function(){
  assert.equal(medicareSurchargeAnnual(96999, false, false), 0);
  assert.equal(medicareSurchargeAnnual(97000, false, false), 970, "1% of all of it, not of the excess");
  assert.equal(medicareSurchargeAnnual(113000, false, false), 1412.5);
  assert.equal(medicareSurchargeAnnual(151000, false, false), 2265);
});

test("family thresholds are the singles ones doubled", function(){
  assert.deepEqual(mlsThresholds(true).map(function(t){ return t.from; }), [0, 194000, 226000, 302000]);
  // $150k: tier 3 as a single, below the first family threshold entirely.
  assert.equal(mlsTierFor(150000, false).label, "Tier 2");
  assert.equal(mlsTierFor(150000, true).label, "Base tier");
  assert.equal(medicareSurchargeAnnual(150000, false, true), 0);
});

test("mlsNextTier names the step, because crossing one is not a slope", function(){
  var next = mlsNextTier(96000, false);
  assert.equal(next.at, 97000);
  assert.equal(next.away, 1000);
  assert.equal(next.stepCost, 970, "$1,000 more income costs $970, not $10");
  assert.equal(mlsNextTier(500000, false), null);
});

test("the surcharge is a tax — it lands in totalTax and the effective rate", function(){
  // Unlike the HELP repayment, which is a debt repayment and deliberately isn't.
  withIncome([grossRow("Sam", 150000)], function(){
    state.tax.privateHospitalCover = true;
    var covered = computePersonTax("Sam");
    state.tax.privateHospitalCover = false;
    var uncovered = computePersonTax("Sam");
    assert.equal(covered.medicareSurcharge, 0);
    assert.ok(uncovered.medicareSurcharge > 0);
    assert.ok(Math.abs((uncovered.totalTax - covered.totalTax) - uncovered.medicareSurcharge) < 0.01);
    assert.ok(uncovered.effectiveRate > covered.effectiveRate, "and it does move the effective rate");
    state.tax.privateHospitalCover = false;
  });
});

test("surcharge income adds back salary sacrifice", function(){
  // Sacrificing into super does not get you under a surcharge threshold — the same trap as HELP.
  withIncome([grossRow("Sam", 110000)], function(){
    state.tax.settings.Sam = { superSacrificeAnnual: 20000, concessionalCap: 30000, carryForward: 0, helpBalance: 0 };
    state.tax.privateHospitalCover = false;
    var t = computePersonTax("Sam");
    assert.ok(t.taxable < 97000, "sacrifice took taxable income under the first threshold");
    assert.ok(t.surchargeIncome >= 97000, "but not surcharge income");
    assert.ok(t.medicareSurcharge > 0, "so the surcharge still applies");
  });
});

test("mlsIfUncovered says what cover is worth even when it is held", function(){
  // The panel has to be able to answer "is this policy worth it", which needs the number you'd
  // pay without it — not just the zero you pay with it.
  withIncome([grossRow("Sam", 150000)], function(){
    state.tax.privateHospitalCover = true;
    var t = computePersonTax("Sam");
    assert.equal(t.medicareSurcharge, 0);
    assert.ok(t.mlsIfUncovered > 0, "what you'd pay without cover: " + t.mlsIfUncovered);
    state.tax.privateHospitalCover = false;
  });
});


test("family thresholds set the tier from COMBINED income, then charge each person's own", function(){
  // The bug this exists to prevent: testing each person's income against the doubled threshold
  // separately. Two people on $150k each are a $300k household — comfortably Tier 3 — but neither
  // reaches the $194k family Tier 1 alone, so the naive reading reports a $0 surcharge for a
  // household that owes thousands.
  withIncome([grossRow("Sam", 150000), grossRow("Alex", 150000)], function(){
    state.tax.privateHospitalCover = false;
    state.tax.familyThresholds = true;
    state.tax.ipOwnership = {};
    var sam = computePersonTax("Sam");
    assert.equal(sam.tierIncome, 300000, "the tier is set by the household");
    assert.equal(sam.surchargeIncome, 150000, "but the charge is on this person's own income");
    // $300k is Tier 2 on family thresholds — Tier 3 starts at $302k, which is a good illustration
    // of why the tier has to be read off the table rather than guessed at.
    assert.equal(sam.mlsTier.label, "Tier 2");
    assert.equal(sam.medicareSurcharge, 150000 * 0.0125);
    // ...and the naive per-person reading would have charged nothing at all here.
    assert.equal(medicareSurchargeAnnual(150000, false, true), 0, "$150k alone is below the family Tier 1");
    state.tax.familyThresholds = false;
  });
});

test("on singles thresholds the tier income is just this person's own", function(){
  withIncome([grossRow("Sam", 150000), grossRow("Alex", 150000)], function(){
    state.tax.privateHospitalCover = false;
    state.tax.familyThresholds = false;
    var sam = computePersonTax("Sam");
    assert.equal(sam.tierIncome, sam.surchargeIncome);
    assert.equal(sam.mlsTier.label, "Tier 2");
  });
});

// ---------------- Work-related deductions (v2.83.0) ----------------

import { deductionRows, rowDeductionAnnual, personDeductionsAnnual } from "../src/calc/tax.js";

function deductibleRow(what, amount, freq, extra){
  return Object.assign({ what: what, amount: amount, freq: freq, deductible: true, deductiblePct: 100 }, extra || {});
}

test("a row's claim is its annual cost times its work-related share", function(){
  // The share is the point: a phone bill is rarely 100% work, and a flag alone would either
  // overstate the claim or push people to keep a second set of numbers elsewhere.
  // Tolerance, not equality: a Monthly amount round-trips through weekly inside periodsOf().
  assert.ok(Math.abs(rowDeductionAnnual(deductibleRow("Phone", 100, "Monthly", { deductiblePct: 40 })) - 480) < 1e-9);
  assert.equal(rowDeductionAnnual(deductibleRow("Union fees", 600, "Yearly")), 600);
  // Missing pct means the whole thing, which is what an un-edited flagged row should claim.
  assert.equal(rowDeductionAnnual({ amount: 600, freq: "Yearly", deductible: true }), 600);
});

test("a claim share is clamped to 0-100", function(){
  assert.equal(rowDeductionAnnual(deductibleRow("X", 1000, "Yearly", { deductiblePct: 150 })), 1000);
  assert.equal(rowDeductionAnnual(deductibleRow("X", 1000, "Yearly", { deductiblePct: -20 })), 0);
});

test("an unattributed row belongs to the only person, and to nobody when there are two", function(){
  // Silently loading an ambiguous claim onto whoever happens to be first would be worse than
  // leaving it out — it's someone's tax return.
  var rows = [deductibleRow("Laptop", 2000, "Yearly")];
  withIncome([grossRow("Sam", 100000)], function(){
    assert.equal(deductionRows(rows, "Sam").length, 1);
  });
  withIncome([grossRow("Sam", 100000), grossRow("Alex", 100000)], function(){
    assert.equal(deductionRows(rows, "Sam").length, 0);
    assert.equal(deductionRows(rows, "Alex").length, 0);
    // ...until it's attributed.
    var attributed = [deductibleRow("Laptop", 2000, "Yearly", { deductiblePerson: "Alex" })];
    assert.equal(deductionRows(attributed, "Sam").length, 0);
    assert.equal(deductionRows(attributed, "Alex").length, 1);
  });
});

test("rows that aren't flagged are ignored entirely", function(){
  var rows = [{ what: "Groceries", amount: 200, freq: "Weekly" }, deductibleRow("Union fees", 600, "Yearly")];
  withIncome([grossRow("Sam", 100000)], function(){
    assert.equal(personDeductionsAnnual("Sam", rows), 600);
  });
});

test("deductions reduce taxable income, and cascade into the levy, the surcharge and HELP", function(){
  // The cascade is why this is computed inside the tax chain rather than shown as a standalone
  // "you could claim $X" note: surcharge income and repayment income are both built on taxable.
  withIncome([grossRow("Sam", 100000)], function(){
    state.tax.settings.Sam = { superSacrificeAnnual: 0, concessionalCap: 30000, carryForward: 0, helpBalance: 50000 };
    state.tax.privateHospitalCover = false;
    state.tax.familyThresholds = false;
    var without = computePersonTax("Sam");
    var withDeductions = computePersonTax("Sam", { deductibleItems: [deductibleRow("Tools", 8000, "Yearly")] });
    assert.equal(withDeductions.deductions, 8000);
    assert.equal(withDeductions.taxable, without.taxable - 8000);
    assert.ok(withDeductions.incomeTax < without.incomeTax);
    assert.ok(withDeductions.medicare < without.medicare, "the levy follows taxable income down");
    assert.ok(withDeductions.surchargeIncome < without.surchargeIncome, "and so does surcharge income");
    // HELP is the exception that proves the rule: repayment income is built on gross, not taxable,
    // so a work deduction does NOT reduce what you repay.
    assert.equal(withDeductions.helpRepayment, without.helpRepayment);
  });
});

test("deductionsWorth is the tax saved, not the deduction", function(){
  // "I claimed $2,000" and "I got $2,000 back" is the most common confusion about deductions, and
  // the panel exists not to repeat it.
  withIncome([grossRow("Sam", 100000)], function(){
    state.tax.settings.Sam = { superSacrificeAnnual: 0, concessionalCap: 30000, carryForward: 0, helpBalance: 0 };
    var t = computePersonTax("Sam", { deductibleItems: [deductibleRow("Tools", 2000, "Yearly")] });
    assert.equal(t.deductions, 2000);
    assert.ok(t.deductionsWorth < t.deductions, "worth less than it cost, always");
    assert.ok(Math.abs(t.deductionsWorth - 2000 * 0.30) < 1, "at the 30% marginal rate: " + t.deductionsWorth);
  });
});

test("no provider and no opts means no deductions, exactly as before", function(){
  withIncome([grossRow("Sam", 100000)], function(){
    assert.equal(computePersonTax("Sam").deductions, 0);
  });
});

// ---------------- Dividends & franking (v2.84.0) ----------------

import { frankingCredit, holdingDividend, personDividends, COMPANY_TAX_RATE } from "../src/calc/tax.js";

function withAssets(assets, body){
  var saved = state.assets;
  state.assets = assets;
  try { body(); } finally { state.assets = saved; }
}
function holding(person, units, perUnit, frankedPct){
  return { category: "Shares", person: person, quantity: units, price: 10, dividendPerUnit: perUnit, frankedPct: frankedPct };
}

test("the franking credit grosses up, it is not a percentage of the cash", function(){
  // cash * rate/(1-rate), not cash * rate: the cash is what's left AFTER the company paid 30%, so
  // a $700 fully franked dividend carries a $300 credit — $1,000 of pre-tax profit.
  assert.equal(frankingCredit(700, 100), 300);
  assert.notEqual(frankingCredit(700, 100), 700 * COMPANY_TAX_RATE);
});

test("partial and zero franking scale the credit", function(){
  assert.equal(frankingCredit(700, 50), 150);
  assert.equal(frankingCredit(700, 0), 0, "unfranked: nothing was paid, nothing to credit");
  assert.equal(frankingCredit(0, 100), 0);
});

test("a holding's dividend follows its unit count, not a stored total", function(){
  // Per-unit is the point: a total would silently become wrong the moment units are bought or
  // sold, which is exactly when nobody thinks to revisit it.
  var d = holdingDividend({ quantity: 1000, dividendPerUnit: 0.7, frankedPct: 100 });
  assert.equal(d.cash, 700);
  assert.equal(d.credit, 300);
  assert.equal(d.grossedUp, 1000);
  assert.equal(holdingDividend({ quantity: 2000, dividendPerUnit: 0.7, frankedPct: 100 }).cash, 1400);
});

test("only Shares holdings with a dividend count, and attribution follows the deduction rule", function(){
  withIncome([grossRow("Sam", 100000), grossRow("Alex", 100000)], function(){
    withAssets([
      holding("Sam", 1000, 0.7, 100),
      holding("Alex", 500, 0.7, 100),
      holding("", 9999, 0.7, 100),                                    // unattributed, two people
      { category: "Cash", person: "Sam", quantity: 1, dividendPerUnit: 5 },  // not shares
      holding("Sam", 1000, 0, 100)                                    // shares, but pays nothing
    ], function(){
      assert.equal(personDividends("Sam").cash, 700, "the unattributed one is claimed by nobody");
      assert.equal(personDividends("Alex").cash, 350);
    });
  });
});

test("dividends enter taxable income grossed up, and the credit comes off the tax bill", function(){
  withIncome([grossRow("Sam", 100000)], function(){
    // Cover on, to isolate this from the surcharge — the extra income moves that too, which is
    // the subject of the next test rather than this one.
    state.tax.privateHospitalCover = true;
    withAssets([holding("Sam", 10000, 0.7, 100)], function(){   // $7,000 cash, $3,000 credit
      var t = computePersonTax("Sam");
      assert.equal(t.dividendCash, 7000);
      assert.equal(t.frankingCredit, 3000);
      assert.equal(t.dividendGrossedUp, 10000);
      var noDividends = (function(){
        var r;
        withAssets([], function(){ r = computePersonTax("Sam"); });
        return r;
      })();
      assert.equal(t.taxable, noDividends.taxable + 10000, "grossed up, not just the cash");
      assert.ok(Math.abs((t.totalTax - noDividends.totalTax) - (10000 * 0.30 + 10000 * 0.02 - 3000)) < 1,
        "tax on the grossed-up amount at 30% + levy, less the credit");
      state.tax.privateHospitalCover = false;
    });
  });
});

test("grossed-up dividend income cascades into the Medicare levy surcharge", function(){
  // Caught by a test expectation of mine that forgot it: $10,000 of grossed-up dividend income
  // pushed the surcharge up $100 on top of the tax and the credit. Dividends aren't a sidecar —
  // they move every figure built on taxable income.
  withIncome([grossRow("Sam", 100000)], function(){
    state.tax.privateHospitalCover = false;
    state.tax.familyThresholds = false;
    var before, after;
    withAssets([], function(){ before = computePersonTax("Sam"); });
    withAssets([holding("Sam", 10000, 0.7, 100)], function(){ after = computePersonTax("Sam"); });
    assert.ok(after.medicareSurcharge > before.medicareSurcharge);
    assert.ok(Math.abs((after.medicareSurcharge - before.medicareSurcharge) - 100) < 1);
  });
});

test("the franking credit is refundable — the tax bill can go below zero", function(){
  // The case that matters most and the one clamping at zero would quietly delete: a low- or
  // no-income shareholder gets the credit paid out.
  withIncome([grossRow("Sam", 0)], function(){
    withAssets([holding("Sam", 10000, 0.7, 100)], function(){
      var t = computePersonTax("Sam");
      assert.ok(t.totalTax < 0, "a refund, not a bill: " + t.totalTax);
      assert.ok(t.netTakeHome > t.dividendCash, "so more arrives than the company distributed");
    });
  });
});

test("above a 30% marginal rate a fully franked dividend still costs a top-up", function(){
  withIncome([grossRow("Sam", 200000)], function(){
    withAssets([holding("Sam", 10000, 0.7, 100)], function(){
      var t = computePersonTax("Sam");
      assert.ok(t.dividendNet < t.dividendCash, "worth less than the cash: " + t.dividendNet);
      assert.ok(t.dividendNet > 0, "but still worth having");
    });
  });
});

test("dividend cash lands in take-home once, not twice", function(){
  // The credit is settled through the tax bill; adding the grossed-up figure to take-home as well
  // would count it a second time.
  withIncome([grossRow("Sam", 100000)], function(){
    var before;
    withAssets([], function(){ before = computePersonTax("Sam"); });
    withAssets([holding("Sam", 10000, 0.7, 100)], function(){
      var after = computePersonTax("Sam");
      var expected = before.netTakeHome + 7000 - (after.totalTax - before.totalTax);
      assert.ok(Math.abs(after.netTakeHome - expected) < 0.01);
    });
  });
});

// ---------------- Capital gains (v2.85.0) ----------------

import {
  saleCapitalGain, qualifiesForCgtDiscount, heldDays, personCapitalGains, CGT_DISCOUNT_MIN_DAYS
} from "../src/calc/tax.js";

test("the CGT discount needs MORE than 12 months, not 12 months to the day", function(){
  // A sale one day early costs half the discount. Precision here is the whole point of modelling it.
  assert.equal(heldDays("2025-07-01", "2026-07-01"), 365);
  assert.equal(qualifiesForCgtDiscount("2025-07-01", "2026-07-01"), false, "365 days is not enough");
  assert.equal(qualifiesForCgtDiscount("2025-07-01", "2026-07-02"), true, "366 is");
  assert.equal(CGT_DISCOUNT_MIN_DAYS, 366);
});

test("a qualifying gain is halved; a short-held one is not", function(){
  var quick = saleCapitalGain({ acquired: "2026-01-01", date: "2026-06-01", proceeds: 15000, costBase: 5000 });
  assert.equal(quick.raw, 10000);
  assert.equal(quick.assessable, 10000);
  assert.equal(quick.discountApplied, false);
  var held = saleCapitalGain({ acquired: "2024-01-01", date: "2026-06-01", proceeds: 15000, costBase: 5000 });
  assert.equal(held.raw, 10000);
  assert.equal(held.assessable, 5000);
  assert.equal(held.discountApplied, true);
});

test("a capital loss is never discounted", function(){
  // Halving a loss would understate a real offset. The discount only ever applies to a gain.
  var loss = saleCapitalGain({ acquired: "2020-01-01", date: "2026-06-01", proceeds: 3000, costBase: 8000 });
  assert.equal(loss.raw, -5000);
  assert.equal(loss.assessable, -5000);
  assert.equal(loss.isLoss, true);
  assert.equal(loss.discountApplied, false);
});

test("capital gains are bounded to the household year", function(){
  // A CGT event belongs to the year it happened in. Unlike every other figure in this engine —
  // which is a rate — a sale is a one-off, so carrying last year's into this year's estimate
  // would be plainly wrong.
  withIncome([grossRow("Sam", 100000)], function(){
    withAssets([{
      category: "Shares", person: "Sam", quantity: 0, price: 0,
      sales: [
        { date: "2026-08-01", proceeds: 15000, costBase: 5000, acquired: "2024-01-01" },  // this FY
        { date: "2025-08-01", proceeds: 15000, costBase: 5000, acquired: "2023-01-01" }   // last FY
      ]
    }], function(){
      var thisYear = personCapitalGains("Sam", { from: "2026-07-01", to: "2027-06-30" });
      assert.equal(thisYear.sales.length, 1);
      assert.equal(thisYear.assessable, 5000);
      assert.equal(personCapitalGains("Sam").sales.length, 2, "unbounded gets both");
    });
  });
});

test("an assessable gain lands in taxable income and cascades like any other income", function(){
  withIncome([grossRow("Sam", 100000)], function(){
    state.tax.privateHospitalCover = true;
    var before, after;
    withAssets([], function(){ before = computePersonTax("Sam"); });
    withAssets([{
      category: "Shares", person: "Sam", quantity: 0, price: 0,
      sales: [{ date: "2026-08-01", proceeds: 25000, costBase: 5000, acquired: "2024-01-01" }]
    }], function(){ after = computePersonTax("Sam"); });
    assert.equal(after.capitalGainsRaw, 20000);
    assert.equal(after.capitalGains, 10000, "halved by the discount");
    assert.equal(after.capitalGainsDiscount, 10000, "and the saving is reported");
    assert.equal(after.taxable, before.taxable + 10000);
    assert.ok(after.totalTax > before.totalTax);
    state.tax.privateHospitalCover = false;
  });
});

test("an asset with no sales contributes nothing", function(){
  withIncome([grossRow("Sam", 100000)], function(){
    withAssets([{ category: "Shares", person: "Sam", quantity: 100, price: 10 }], function(){
      assert.equal(computePersonTax("Sam").capitalGains, 0);
    });
  });
});
