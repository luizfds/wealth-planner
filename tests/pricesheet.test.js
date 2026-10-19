import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { sheetCsvUrls, readPriceSheet, applyPrices, unitsOn, backfillHistory, applyBackfill, sheetRefreshDue, backfillStart } from "../src/calc/pricesheet.js";

test("a sheet link becomes the URLs worth trying", function(){
  var share = sheetCsvUrls("https://docs.google.com/spreadsheets/d/AbC_123-x/edit#gid=42");
  assert.equal(share[0], "https://docs.google.com/spreadsheets/d/AbC_123-x/gviz/tq?tqx=out:csv&headers=0&gid=42");
  assert.match(share[1], /export\?format=csv&gid=42$/);
  var pub = sheetCsvUrls("https://docs.google.com/spreadsheets/d/e/2PACX-zz/pubhtml?gid=7&single=true");
  assert.deepEqual(pub, ["https://docs.google.com/spreadsheets/d/e/2PACX-zz/pub?output=csv&gid=7&single=true"]);
  assert.deepEqual(sheetCsvUrls("https://example.com/sheet.csv"), []);
});

var SHEET = [
  '"Symbol","Price","","AAA","","ZZZ",""',
  '"AAA","12.50","","Date","Close","Date","Close"',
  '"ZZZ","1,234.00","","2025-01-03","10","2025-01-03","1000"',
  '"USDAUD","1.5","","2025-01-10","11","2025-01-10","1100"',
  '"QQQ","#N/A","","2025-01-17","11.5","",""',
  '"IOZ@NOW","30","","","","",""'
].join("\n");

test("the sheet reads as today's prices plus weekly closes per symbol", function(){
  var r = readPriceSheet(SHEET);
  assert.deepEqual(r.prices.map(function(p){ return p.symbol + "=" + p.price; }), ["AAA=12.5", "ZZZ=1234", "USDAUD=1.5", "IOZ@NOW=30"]);
  assert.deepEqual(r.unreadable, ["QQQ"]);
  assert.equal(r.history.AAA.length, 3);
  assert.deepEqual(r.history.ZZZ[1], { date: "2025-01-10", close: 1100 });
});

test("a header row whose Price label was dropped still reads as the header", function(){
  var r = readPriceSheet(SHEET.replace('"Symbol","Price"', '"Symbol",""'));
  assert.equal(r.prices.length, 4);
  assert.deepEqual(r.unreadable, ["QQQ"]);
});

test("the older four-column paste template reads too", function(){
  var r = readPriceSheet('What,Market,Symbol,Price\nFern Fund,ASX,FRN,4.20\nUS$,,USDAUD,1.55');
  assert.deepEqual(r.prices, [{ symbol: "FRN", price: 4.2 }, { symbol: "USDAUD", price: 1.55 }]);
  assert.deepEqual(r.history, {});
});

test("prices land on holdings, the exchange rate and the benchmark store", function(){
  var st = { assets: [{ category: "Shares", symbol: "AAA", quantity: 10, history: [] }], fx: {}, benchmark: { prices: {} } };
  var res = applyPrices(st, readPriceSheet(SHEET).prices, "2026-02-01");
  assert.equal(res.updated, 1);
  assert.deepEqual(res.notFound, ["ZZZ"]);
  assert.equal(st.assets[0].amount, 125);
  assert.deepEqual(st.assets[0].history, [{ date: "2026-02-01", value: 125, price: 12.5 }]);
  assert.equal(st.fx.usdAud, 1.5);
  assert.equal(st.benchmark.prices.IOZ.now, 30);
});

test("units held on a date: from lots and sales, or today's units plus later sales", function(){
  var withLots = { quantity: 15, lots: [{ date: "2025-01-05", units: 10 }, { date: "2025-03-01", units: 10 }], sales: [{ date: "2025-06-01", units: 5 }] };
  assert.equal(unitsOn(withLots, "2025-01-01"), 0);
  assert.equal(unitsOn(withLots, "2025-02-01"), 10);
  assert.equal(unitsOn(withLots, "2025-07-01"), 15);
  var noLots = { quantity: 8, sales: [{ date: "2025-06-01", units: 2 }] };
  assert.equal(unitsOn(noLots, "2025-05-01"), 10);
  assert.equal(unitsOn(noLots, "2025-07-01"), 8);
});

test("backfill fills only the weeks before the first recorded price", function(){
  var a = { category: "Shares", symbol: "AAA", quantity: 10, history: [{ date: "2025-01-12", value: 999 }] };
  var n = backfillHistory(a, [{ date: "2025-01-03", close: 10 }, { date: "2025-01-10", close: 11 }, { date: "2025-01-17", close: 50 }]);
  assert.equal(n, 2);
  assert.deepEqual(a.history.map(function(h){ return h.date + ":" + h.value; }), ["2025-01-03:100", "2025-01-10:110", "2025-01-12:999"]);
  assert.equal(a.history[0].backfill, true);
  assert.equal(backfillHistory(a, [{ date: "2025-01-03", close: 10 }]), 0, "running it again adds nothing");
});

test("backfill skips weeks before a holding was bought", function(){
  var st = { assets: [{ category: "Shares", symbol: "AAA", quantity: 5, lots: [{ date: "2025-01-08", units: 5 }], history: [] }] };
  var res = applyBackfill(st, readPriceSheet(SHEET).history);
  assert.deepEqual(res, { added: 2, holdings: 1 });
  assert.equal(st.assets[0].history[0].date, "2025-01-10");
  assert.equal(backfillStart(st.assets[0], "2024-01-01"), "2025-01-08");
  assert.equal(backfillStart({ lots: [] }, "2024-01-01"), "2024-01-01");
});

test("the sheet is read once a day, only with a link", function(){
  assert.equal(sheetRefreshDue({ url: "", lastRead: "" }, "2026-02-01"), false);
  assert.equal(sheetRefreshDue({ url: "x", lastRead: "2026-01-31" }, "2026-02-01"), true);
  assert.equal(sheetRefreshDue({ url: "x", lastRead: "2026-02-01" }, "2026-02-01"), false);
});
