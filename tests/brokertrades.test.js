import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { parseTrades, planTrades, applyTrades, tradeDate, cleanCode } from "../src/calc/brokertrades.js";
import { tradesPreviewHtml } from "../src/components/brokertrades.js";

// Broker trade import (v3.91.0), invented trades.
var COMMSEC = 'Date,Reference,Details,Debit($),Credit($),Balance($)\n' +
  '03/02/2025,C1001,B 40 ABC @ 25.500000,1039.95,,-1039.95\n' +
  '17/06/2025,C1002,B 10 ABC @ 27.000000,289.95,,-1329.90\n' +
  '01/07/2025,R1,Direct Credit Interest,,1.20,-1328.70\n' +
  '09/09/2026,C1003,S 15 ABC @ 30.000000,,430.05,-898.65\n';
var GENERIC = 'Trade Date,Symbol,Side,Quantity,Price,Brokerage\n' +
  '2025-03-04T10:01:00Z,XYZ.AX,BUY,12,10.25,3\n' +
  '2025-08-19,XYZ.AX,Buy,8,11.00,3\n' +
  '2026-02-02,XYZ.AX,SELL,-5,12.40,3\n' +
  '2026-02-02,,Deposit,,,\n';

test("dates, codes", function(){
  assert.equal(tradeDate("03/02/2025"), "2025-02-03");
  assert.equal(tradeDate("2025-03-04T10:01:00Z"), "2025-03-04");
  assert.equal(tradeDate("4 Mar 2025"), "2025-03-04");
  assert.equal(cleanCode("ASX:ABC"), "ABC");
  assert.equal(cleanCode("xyz.ax"), "XYZ");
});

test("CommSec's Details column: buys, a sell, brokerage from the cash; non-trades skipped", function(){
  var r = parseTrades(COMMSEC);
  assert.equal(r.format, "CommSec");
  assert.equal(r.trades.length, 3);
  assert.equal(r.skipped, 1);
  assert.deepEqual(r.trades[0], { date: "2025-02-03", code: "ABC", side: "buy", units: 40, price: 25.5, brokerage: 19.95 });
  assert.equal(r.trades[2].side, "sell");
  assert.equal(r.trades[2].brokerage, 19.95);
});

test("named columns, a negative quantity for a sell", function(){
  var r = parseTrades(GENERIC);
  assert.equal(r.format, "columns");
  assert.equal(r.trades.length, 3);
  assert.equal(r.trades[2].side, "sell");
  assert.equal(r.trades[2].units, 5);
});

test("plan and apply: lots for buys, FIFO sales that leave the units held alone, and a re-read adds nothing", function(){
  var assets = [{ category: "Shares", what: "ABC (A)", symbol: "ABC", quantity: 35, price: 31 }, { category: "Shares", what: "ABC (B)", symbol: "ABC", quantity: 4 }];
  var trades = parseTrades(COMMSEC).trades;
  var plan = planTrades(assets, trades);
  assert.equal(plan[0].holdings.length, 2);
  assert.equal(plan[0].target, 0, "first holding by default");
  assert.equal(plan[0].lotsAfter, 35);
  assert.equal(plan[0].problem, "");
  var n = 0;
  var res = applyTrades(assets, plan, function(){ return "L" + (++n); });
  assert.deepEqual(res, { lots: 2, sales: 1 });
  var a = assets[0];
  assert.equal(a.quantity, 35, "units held untouched");
  assert.equal(a.lots[0].soldUnits, 15, "sold from the oldest lot");
  assert.equal(a.sales[0].parcels[0].acquired, "2025-02-03");
  assert.equal(a.sales[0].proceeds, 430.05);
  assert.equal(a.sales[0].costBase, Math.round((40 * 25.5 + 19.95) * 15 / 40 * 100) / 100);
  var again = planTrades(assets, trades);
  assert.equal(again[0].newBuys.length + again[0].newSales.length, 0);
  // Choosing the other holding, or leaving the code out.
  assert.equal(planTrades(assets, trades, { ABC: 1 })[0].target, 1);
  assert.equal(planTrades(assets, trades, { ABC: "skip" })[0].target, null);
  assert.match(planTrades([], trades)[0].problem, /No holding/);
  assert.match(tradesPreviewHtml(plan, assets), /ABC/);
});
