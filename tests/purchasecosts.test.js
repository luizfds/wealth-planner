import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state, defaultPurchaseConfig } from "../src/state.js";
import { calcStampDuty, calcLMI, governmentFee, purchaseCostAmount, purchaseOtherTotal, recalcPurchase } from "../src/calc/property.js";
import { computeNetWorthSeries } from "../src/calc/engine.js";

// Item 254: a purchase's costs as a broker quotes them. The $1.3M NSW figures are a broker's 2026–27 funding summary.
test("NSW duty and land registry fees, 2026–27", () => {
  assert.equal(calcStampDuty("NSW", 1300000, false), 52787);
  assert.equal(calcStampDuty("NSW", 1290000, false), 52237);
  assert.equal(calcStampDuty("NSW", 700000, false), 11602 + 0.045 * (700000 - 387000));
  assert.equal(governmentFee("transfer", "NSW", 1300000), 182.73);
  assert.equal(governmentFee("mortgage", "NSW", 1300000), 182.73);
});

test("Victoria's transfer fee is worked out from the price, up to its cap; its mortgage fee is flat", () => {
  assert.ok(Math.abs(governmentFee("transfer", "VIC", 687000) - 1712) < 3, "Land Use Victoria's example: $1,712 at $687,000");
  assert.equal(governmentFee("transfer", "VIC", 750000), 1859.8);
  assert.equal(governmentFee("transfer", "VIC", 2500000), 3614);
  assert.equal(governmentFee("mortgage", "VIC", 750000), 129.2);
});

test("LMI rises with the loan as well as the LVR", () => {
  const big = calcLMI(1144000, 0.88);
  assert.ok(Math.abs(big - 20254) < 100, "within $100 of the broker's $20,254 on $1,144,000 at 88%: " + big);
  assert.ok(Math.abs(calcLMI(900000, 0.88) / 900000 - 0.01752) < 0.0002, "1.752% for a $750k–$1M loan at 87–88%");
  assert.ok(calcLMI(250000, 0.88) / 250000 < calcLMI(700000, 0.88) / 700000, "a smaller loan costs a smaller share");
  assert.equal(calcLMI(500000, 0.8), 0);
});

function withPurchase(cfg, fn){
  const keep = { purchase: state.purchase, invest: state.invest, scenarios: state.scenarios };
  try { state.purchase = { Buy: cfg }; state.invest = {}; state.scenarios = ["Buy"]; fn(); }
  finally { Object.assign(state, keep); }
}

test("a broker's $1.3M funding summary: duty and fees exactly, LMI within a few hundred, cash needed alike", () => {
  const cfg = Object.assign(defaultPurchaseConfig(1300000, 12, 7.15, 30, "NSW", true), { lmiCapitalized: true,
    otherCosts: defaultPurchaseConfig(0, 12, 7, 30, "NSW", true).otherCosts.filter(c => c.fee).concat([{ what: "Legal", amount: 3000 }, { what: "Lender setup", amount: 500 }]) });
  withPurchase(cfg, () => {
    const out = recalcPurchase("Buy");
    assert.equal(out.stampDuty, 52787);
    assert.equal(Math.round(out.otherTotal * 100) / 100, 3865.46, "fees as the broker lists them");
    assert.ok(Math.abs(out.upfrontCash - 212652.46) < 1, "the broker's shortfall: deposit, duty and fees");
    assert.ok(Math.abs(out.loanBalance - 1164254) < 100);
    assert.equal(out.lmiEstimated, true);
  });
});

test("a quote typed in replaces the estimate in the calculator and the projection", () => {
  const cfg = Object.assign(defaultPurchaseConfig(1300000, 12, 7, 30, "NSW", true), { lmiCapitalized: true, lmiQuote: 20254 });
  withPurchase(cfg, () => {
    const out = recalcPurchase("Buy");
    assert.equal(out.lmi, 20254);
    assert.equal(out.lmiEstimated, false);
    assert.equal(out.loanBalance, 1144000 + 20254);
    const a = computeNetWorthSeries("Buy", 1)[0].y;
    cfg.lmiQuote = 30254;
    assert.ok(Math.abs((a - computeNetWorthSeries("Buy", 1)[0].y) - 10000) < 1, "the projection spends the quote");
  });
});

test("fee rows follow the state and price; a typed fee is the person's own", () => {
  const cfg = defaultPurchaseConfig(750000, 12, 7, 30, "VIC", true);
  const transfer = cfg.otherCosts.find(c => c.fee === "transfer");
  assert.equal(purchaseCostAmount(transfer, cfg, 750000), 1859.8);
  cfg.state = "NSW";
  assert.equal(purchaseCostAmount(transfer, cfg, 750000), 182.73);
  const typed = { what: "Transfer Fee", amount: 200 };
  assert.equal(purchaseCostAmount(typed, cfg, 750000), 200);
  assert.ok(Math.abs(purchaseOtherTotal(cfg, 750000) - (1800 + 500 + 600 + 182.73 + 182.73)) < 0.01);
});
