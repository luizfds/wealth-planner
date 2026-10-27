import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { coinIdsFor, coinGeckoUrl, parseCoinGecko, parseFrankfurter, filePricesFor, fileWeeklyFor, backfillWanted, autoPricesDue, fileKey } from "../src/calc/autoprices.js";

// Invented holdings.
const assets = [
  { category: "Shares", market: "ASX", symbol: "VAS", quantity: 10 },
  { category: "Shares", market: "US", symbol: "aapl", quantity: 2 },
  { category: "Shares", market: "ASX", symbol: "ZZZ", quantity: 1 },
  { category: "Shares", market: "Crypto", symbol: "BTC", quantity: 0.1 },
  { category: "Shares", market: "Crypto", symbol: "render-token", quantity: 5 },
  { category: "Shares", market: "Crypto", symbol: "QQ", quantity: 1 },
  { category: "Cash", what: "Savings", amount: 100 }
];

test("coins by ticker or by CoinGecko id; only the coins go in the request", () => {
  const c = coinIdsFor(assets);
  assert.deepEqual(c.ids, ["bitcoin", "render-token"]);
  assert.equal(c.bySymbol.BTC, "bitcoin"); assert.equal(c.bySymbol.QQ, undefined);
  assert.equal(coinGeckoUrl(c.ids), "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,render-token&vs_currencies=usd");
  assert.deepEqual(parseCoinGecko({ bitcoin: { usd: 65000.5 }, "render-token": { usd: 0 } }, c.bySymbol), [{ symbol: "BTC", price: 65000.5 }]);
  assert.deepEqual(parseCoinGecko(null, c.bySymbol), []);
});

test("the exchange rate from Frankfurter's answer, and nothing from a wrong one", () => {
  assert.equal(parseFrankfurter({ amount: 1, base: "USD", date: "2026-10-24", rates: { AUD: 1.5312 } }), 1.5312);
  assert.equal(parseFrankfurter({ base: "EUR", rates: { AUD: 1.6 } }), null);
  assert.equal(parseFrankfurter({ rates: {} }), null);
});

test("the app's price file: prices for the holdings it covers, by market, and which it doesn't", () => {
  assert.equal(fileKey(assets[1]), "US:AAPL");
  const latest = { updated: "2026-10-24", prices: { "ASX:VAS": { close: 101.25, date: "2026-10-24" }, "US:AAPL": { close: 230.1, date: "2026-10-24" }, "US:VAS": { close: 1 } } };
  const r = filePricesFor(latest, assets);
  assert.deepEqual(r.prices.map(p => [p.symbol, p.price]), [["VAS", 101.25], ["AAPL", 230.1]]);
  assert.deepEqual(r.missing, ["ZZZ"]);
  const w = fileWeeklyFor({ weekly: { "ASX:VAS": [["2026-10-17", 100], ["2026-10-24", 101.25], ["bad", 0]] } }, assets);
  assert.deepEqual(w, { VAS: [{ date: "2026-10-17", close: 100 }, { date: "2026-10-24", close: 101.25 }] });
});

test("backfill is only asked for when a holding has weeks to fill; due once a day while on", () => {
  assert.equal(backfillWanted([{ category: "Shares", market: "ASX", symbol: "VAS", history: [{ date: "2025-01-01", value: 1 }], lots: [{ date: "2025-06-01" }] }]), false);
  assert.equal(backfillWanted([{ category: "Shares", market: "ASX", symbol: "VAS", history: [{ date: "2025-01-01", value: 1 }], lots: [{ date: "2024-06-01" }] }]), true);
  assert.equal(autoPricesDue({ on: true, lastRead: "2026-10-26" }, "2026-10-27"), true);
  assert.equal(autoPricesDue({ on: true, lastRead: "2026-10-27" }, "2026-10-27"), false);
  assert.equal(autoPricesDue({ on: false, lastRead: "" }, "2026-10-27"), false);
});
