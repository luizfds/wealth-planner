import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePricePaste, reviewPricePaste, priceReviewCount, priceReviewSignature, applyPriceReview, checkPriceUndo, undoPriceReview } from "../src/calc/pricepaste.js";
import { applyPrices } from "../src/calc/pricesheet.js";

// #265: pasted share prices, reviewed before they're written. Invented household and tickers.
function household(){
  return {
    assets: [
      { what: "Example Fund", category: "Shares", symbol: "EXA", market: "ASX", quantity: 10, price: 50, priceUpdated: "2026-11-01", amount: 500, history: [{ date: "2026-11-01", value: 500, price: 50 }] },
      { what: "Second Fund", category: "Shares", symbol: "EXB", market: "ASX", quantity: 4, price: 20, priceUpdated: "2026-11-01", amount: 80, history: [] },
      { what: "Twin", category: "Shares", symbol: "TWN", market: "ASX", quantity: 1, price: 10, amount: 10, history: [] },
      { what: "Twin US", category: "Shares", symbol: "TWN", market: "US", quantity: 1, price: 7, amount: 7, history: [] },
      { what: "Savings", category: "Cash", amount: 1000 }
    ],
    fx: { usdAud: 1.5, usdAudUpdated: "2026-11-01" },
    benchmark: { prices: {} }
  };
}

test("lines: tabs, commas with quotes, spaces; a thousands separator read whole; nothing at or below zero", () => {
  const lines = parsePricePaste('Symbol\tPrice\nEXA\t51.25\nEXB,"1,234.50"\nASX:EXA $52\nEXA 1 234.50\nEXA,1,234.50\nEXB\t0\nEXB\t-3\nEXB\t#N/A\nEXB\t105,32\nLONE\n﻿');
  const by = l => [l.symbol, l.market, l.price, !!l.reason];
  assert.deepEqual(lines.map(by), [
    ["EXA", null, 51.25, false], ["EXB", null, 1234.5, false], ["EXA", "ASX", 52, false],
    ["EXA", null, null, true], ["EXA", null, null, true], ["EXB", null, null, true], ["EXB", null, null, true], ["EXB", null, null, true], ["EXB", null, null, true], ["LONE", null, null, true]
  ]);
  assert.equal(lines[0].line, 2, "line numbers count the header");
  assert.match(lines[5].reason, /more than zero/);
  assert.match(lines[7].reason, /#N\/A/);
});

test("review: holdings with their prices, the rate and benchmarks; left out with reasons; nothing written", () => {
  const st = household(), before = JSON.stringify(st);
  const r = reviewPricePaste("EXA\t75.5\nEXA\t75.50\nEXB\t21\nEXB\t22\nNASDAQ:EXA\t9\nTWN\t11\nASX:TWN\t11\nNOPE\t3\nUSDAUD\t1.55\nIDX@2026-03-02\t40", st);
  assert.equal(JSON.stringify(st), before);
  assert.deepEqual(r.updates.map(u => [u.symbol, u.market, u.price, u.holdings.map(h => [h.what, h.was])]), [["EXA", "ASX", 75.5, [["Example Fund", 50]]], ["TWN", "ASX", 11, [["Twin", 10]]]]);
  assert.equal(r.updates[0].big, true, "a 51% change is flagged");
  assert.equal(r.updates[1].big, false);
  assert.deepEqual(r.fx, { price: 1.55, was: 1.5, line: 9 });
  assert.deepEqual(r.benchmarks.map(b => [b.symbol, b.date, b.price]), [["IDX", "2026-03-02", 40]]);
  assert.deepEqual(r.leftOut.map(l => [l.line, l.symbol]), [[3, "EXB"], [4, "EXB"], [5, "EXA"], [6, "TWN"], [8, "NOPE"]]);
  assert.match(r.leftOut[0].reason, /two different prices/);
  assert.match(r.leftOut[2].reason, /US price, but EXA is held on the ASX/);
  assert.match(r.leftOut[3].reason, /ASX and US/);
  assert.equal(priceReviewCount(r), 4);
});

test("the signature changes when a reviewed holding is priced, deleted or the household replaced", () => {
  const st = household();
  const sig = priceReviewSignature(reviewPricePaste("EXA\t60", st));
  assert.equal(priceReviewSignature(reviewPricePaste("EXA\t60", st)), sig);
  st.assets[0].price = 55;
  assert.notEqual(priceReviewSignature(reviewPricePaste("EXA\t60", st)), sig);
  const st2 = household(); st2.assets.splice(1, 1);
  assert.notEqual(priceReviewSignature(reviewPricePaste("TWN\t60\nASX:TWN\t60", st2)), priceReviewSignature(reviewPricePaste("TWN\t60\nASX:TWN\t60", household())));
});

test("apply writes only what was reviewed, the market respected; Undo restores exactly, then refuses after a newer price", () => {
  const st = household(), before = JSON.stringify(st);
  const r = reviewPricePaste("ASX:TWN\t12\nEXA\t60\nUSDAUD\t1.6\nIDX@NOW\t41", st);
  const rec = applyPriceReview(r, st, "2026-11-03");
  assert.equal(st.assets[2].price, 12);
  assert.equal(st.assets[3].price, 7, "the US holding of the same ticker is untouched");
  assert.equal(st.assets[0].amount, 600);
  assert.equal(st.fx.usdAud, 1.6);
  assert.equal(st.benchmark.prices.IDX.now, 41);
  assert.deepEqual(checkPriceUndo(rec, st), { ok: true });
  assert.deepEqual(undoPriceReview(rec, st), { ok: true });
  assert.equal(JSON.stringify(st), before);
  const rec2 = applyPriceReview(reviewPricePaste("EXA\t61", st), st, "2026-11-03");
  applyPrices(st, [{ symbol: "EXA", price: 62 }], "2026-11-04"); // the day's price read
  assert.deepEqual(undoPriceReview(rec2, st), { ok: false, reason: "changed", changed: 1 });
  assert.equal(st.assets[0].price, 62);
  assert.deepEqual(checkPriceUndo(rec2, household()), { ok: false, reason: "replaced", changed: 0 });
});

test("applyPrices without a market still prices every holding of the ticker, as the sheet read always has", () => {
  const st = household();
  assert.equal(applyPrices(st, [{ symbol: "TWN", price: 9 }], "2026-11-03").updated, 2);
  assert.equal(applyPrices(st, [{ symbol: "TWN", price: 8, market: "US" }], "2026-11-03").updated, 1);
  assert.deepEqual(st.assets.filter(a => a.symbol === "TWN").map(a => a.price), [9, 8]);
});
