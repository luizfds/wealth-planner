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
  assert.deepEqual(res, { lots: 2, sales: 1, linked: 0 });
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

// ---------------- v3.96.0: Excel reports, a GST column, sales already recorded ----------------
import { parseTradeSheets } from "../src/calc/brokertrades.js";
import { readXlsx, sheetGrid } from "../src/lib/xlsx.js";
import zlib from "node:zlib";

// A tiny .xlsx built by hand: a zip holding the parts the reader needs, deflated like Excel's.
function zip(files){
  var locals = [], central = [], off = 0;
  Object.keys(files).forEach(function(name){
    var raw = Buffer.from(files[name]), data = zlib.deflateRawSync(raw), nm = Buffer.from(name);
    var lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nm.length, 26);
    locals.push(lh, nm, data);
    var ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, nm);
    off += 30 + nm.length + data.length;
  });
  var cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat(locals.concat([cd, end])));
}
function sheetXml(rows){
  return '<worksheet><sheetData>' + rows.map(function(r, i){
    return '<row r="' + (i + 1) + '">' + r.map(function(v, j){ var ref = String.fromCharCode(65 + j) + (i + 1);
      return typeof v === "number" ? '<c r="' + ref + '"><v>' + v + '</v></c>' : '<c r="' + ref + '" t="inlineStr"><is><t>' + v + '</t></is></c>'; }).join("") + '</row>';
  }).join("") + '</sheetData></worksheet>';
}

test("a broker's Excel report: every sheet read, GST added to the brokerage", async function(){
  var head = ["Trade Date", "Settlement Date", "Symbol", "Name", "Side", "Trade Identifier", "Units", "Avg. Price", "Value", "Fees", "GST", "Total Value"];
  var bytes = zip({
    "xl/workbook.xml": '<workbook><sheets><sheet name="Notes" sheetId="1" r:id="rId1"/><sheet name="Aus" sheetId="2" r:id="rId2"/><sheet name="US" sheetId="3" r:id="rId3"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Target="worksheets/sheet3.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": sheetXml([["This report is a summary"]]),
    "xl/worksheets/sheet2.xml": sheetXml([head, ["2025-03-04", "2025-03-06", "ABC ", " Fund A", "Buy", "T1", 30, 12.5, 375, 2.73, 0.27, 378], ["2026-02-02", "2026-02-04", "ABC ", " Fund A", "Sell", "T2", -10, 15, -150, 2.73, 0.27, -147]]),
    "xl/worksheets/sheet3.xml": sheetXml([head, ["2025-05-01", "2025-05-05", "XYZ ", " Corp", "Buy", "T3", 4, 9.5, 38, 0, 0, 38]])
  });
  var sheets = await readXlsx(bytes);
  assert.deepEqual(sheets.map(function(s){ return s.name; }), ["Notes", "Aus", "US"]);
  var r = parseTradeSheets(sheets.map(function(s){ return s.grid; }));
  assert.equal(r.trades.length, 3);
  assert.deepEqual(r.trades[0], { date: "2025-03-04", code: "ABC", side: "buy", units: 30, price: 12.5, brokerage: 3 });
  assert.equal(r.trades[2].side, "sell");
  assert.equal(r.trades[2].units, 10);
  assert.equal(sheetGrid('<row><c r="B1" t="inlineStr"><is><t>x &amp; y</t></is></c></row>', [])[0][1], "x & y", "a cell's place comes from its reference; entities decoded");
});

test("a sale already recorded uses up the lots the file brings, instead of being counted twice", function(){
  var assets = [{ category: "Shares", what: "ABC", symbol: "ABC", quantity: 0,
    sales: [{ date: "2026-02-02", units: 30, proceeds: 420, costBase: 378, parcels: [{ acquired: "2025-03-04", units: 30, costBase: 378 }] }] }];
  var trades = [{ date: "2025-03-04", code: "ABC", side: "buy", units: 30, price: 12.5, brokerage: 3 }, { date: "2026-02-02", code: "ABC", side: "sell", units: 30, price: 14.1, brokerage: 3 }];
  var plan = planTrades(assets, trades);
  assert.equal(plan[0].newSales.length, 0);
  assert.equal(plan[0].lotsAfter, 0);
  assert.equal(plan[0].problem, "");
  var res = applyTrades(assets, plan, function(){ return "L1"; });
  assert.deepEqual(res, { lots: 1, sales: 0, linked: 1 });
  assert.equal(assets[0].lots[0].soldUnits, 30);
  assert.equal(assets[0].sales[0].parcels[0].lotId, "L1");
  assert.equal(assets[0].sales[0].costBase, 378, "the recorded cost base stands");
  assert.equal(planTrades(assets, trades)[0].newBuys.length, 0, "reading it again adds nothing");
});
