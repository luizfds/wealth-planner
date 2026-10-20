import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { statementFromLines, statementCsv, leadingDate, moneyOf, agentStatementFromLines } from "../src/calc/pdfstatement.js";
import { linesOf } from "../src/lib/pdftext.js";
import { parseCsvGrid as parseCsv } from "../src/calc/pricesheet.js";

// PDF statements (v3.92.0). Invented lines, laid out the way pdf.js reports them.
function L(page, y, cells, raw){ return { page: page, y: y, cells: cells.map(function(c){ return { x: c[0], x2: c[1], s: c[2] }; }), raw: raw && raw.map(function(c){ return { x: c[0], x2: c[1], s: c[2] }; }) }; }

test("dates and amounts as statements print them", function(){
  assert.deepEqual(leadingDate("13 Jul Direct Credit FERN"), { day: 13, month: 7, year: null, rest: "Direct Credit FERN" });
  assert.equal(leadingDate("Oct 3").month, 10);
  assert.equal(leadingDate("04/02/2026 X").year, 2026);
  assert.equal(leadingDate("Nothing here"), null);
  assert.deepEqual(moneyOf("1,234.50 CR"), { value: 1234.5, neg: false, cr: true, dr: false });
  assert.equal(moneyOf("-$40.00").neg, true);
  assert.equal(moneyOf("Page 2"), null);
});

test("a bank statement: columns from the header, amounts on the line below, years from the period", function(){
  var lines = [
    L(1, 800, [[60, 160, "Statement period 25 Jun 2026 to 24 Sep 2026"]]),
    L(1, 700, [[58, 78, "Date"], [90, 140, "Transaction"], [362, 383, "Debit"], [411, 433, "Credit"], [499, 528, "Balance"]]),
    L(1, 680, [[58, 160, "25 Jun 2026 OPENING BALANCE"], [502, 528, "50.00 CR"]]),
    L(1, 660, [[58, 200, "13 Jul Direct Credit BANK ONE"]]),
    L(1, 650, [[90, 130, "DIVIDEND"], [418, 433, "20.00"], [502, 528, "70.00 CR"]]),
    L(1, 630, [[58, 200, "22 Jul Transfer To Savings"]]),
    L(1, 620, [[90, 150, "App"], [348, 383, "60.00"], [502, 528, "10.00 CR"]]),
    // A margin note printed flush against the date.
    L(1, 600, [[20, 200, "ZZ1 0303 V06.0004 Aug Card Fern Cafe"], [365, 383, "4.50"], [502, 528, "5.50 CR"]],
      [[20, 58, "ZZ1 0303 V06.00"], [58, 200, "04 Aug Card Fern Cafe"], [365, 383, "4.50"], [502, 528, "5.50 CR"]]),
    L(1, 580, [[58, 200, "24 Sep 2026 CLOSING BALANCE"], [502, 528, "5.50 CR"]]),
    L(1, 40, [[280, 320, "Page 1 of 1"]])
  ];
  var r = statementFromLines(lines);
  assert.deepEqual(r.rows.map(function(x){ return [x.date, x.debit, x.credit, x.balance]; }), [
    ["2026-07-13", 0, 20, 70], ["2026-07-22", 60, 0, 10], ["2026-08-04", 4.5, 0, 5.5]
  ]);
  assert.equal(r.rows[0].description, "Direct Credit BANK ONE DIVIDEND");
  var csv = parseCsv(statementCsv(r.rows));
  assert.deepEqual(csv[0], ["Date", "Description", "Debit", "Credit", "Balance"]);
  assert.deepEqual(csv[2], ["2026-07-22", "Transfer To Savings App", "60.00", "", "10.00"]);
});

test("a card listing: Withdrawal/Deposit columns, signed amounts, a month heading for the year", function(){
  var lines = [
    L(1, 700, [[50, 70, "Date"], [138, 190, "Description"], [382, 425, "Withdrawal"], [469, 500, "Deposit"]]),
    L(1, 680, [[50, 100, "12 Oct 2026"], [136, 250, "FERN CAFE SYDNEY AUS"], [394, 425, "-$5.50"]]),
    L(1, 660, [[50, 100, "12 Oct 2026"], [136, 250, "REFUND SHOP ONE"], [474, 500, "$19.99"]]),
    L(1, 640, [[32, 80, "Nov 2025"]]),
    L(1, 620, [[32, 60, "Nov 6"], [136, 250, "Purchase at BANK ONE"], [394, 425, "-$12.00"]])
  ];
  var r = statementFromLines(lines);
  assert.deepEqual(r.rows.map(function(x){ return [x.date, x.debit, x.credit]; }), [["2026-10-12", 5.5, 0], ["2026-10-12", 0, 19.99], ["2025-11-06", 12, 0]]);
});

test("pdf.js text runs back into lines", function(){
  var items = [
    { str: "Date", transform: [1, 0, 0, 1, 50, 700], width: 20 },
    { str: "12 Oct", transform: [1, 0, 0, 1, 50, 680.5], width: 25 },
    { str: " 2026", transform: [1, 0, 0, 1, 75, 680.5], width: 20 },
    { str: "FERN", transform: [1, 0, 0, 1, 136, 681], width: 20 },
    { str: "Balance", transform: [1, 0, 0, 1, 499, 700.4], width: 30 }
  ];
  var l = linesOf(items, 1);
  assert.equal(l.length, 2);
  assert.deepEqual(l[0].cells.map(function(c){ return c.s; }), ["Date", "Balance"]);
  assert.deepEqual(l[1].cells.map(function(c){ return c.s; }), ["12 Oct 2026", "FERN"]);
});

test("a property manager's statement fills the form, and adds up to what reached you", function(){
  var lines = [
    L(1, 620, [[500, 540, "3 Mar 2026"]]),
    L(1, 580, [[424, 470, "Money In"], [507, 545, "$2,000.00"]]),
    L(1, 520, [[424, 480, "You Received"], [507, 545, "$1,700.50"]]),
    L(1, 460, [[28, 140, "Details"], [472, 512, "Money Out"], [533, 570, "Money In"]]),
    L(1, 380, [[28, 300, "Rent paid to 6/03/2026 (previously paid to 27/02/2026)"], [538, 570, "$500.00"]]),
    L(1, 370, [[28, 300, "Rent paid to 13/03/2026 (previously paid to 6/03/2026)"], [538, 570, "$500.00"]]),
    L(1, 360, [[28, 300, "Rent paid to 20/03/2026"], [538, 570, "$500.00"]]),
    L(1, 350, [[28, 300, "Rent paid to 27/03/2026"], [538, 570, "$500.00"]]),
    L(1, 340, [[28, 200, "Water usage recovered"], [545, 570, "$80.00"]]),
    L(1, 330, [[28, 200, "Management Fee *"], [484, 512, "$120.00"]]),
    L(1, 320, [[28, 200, "Water and sewerage services"], [484, 512, "$190.00"]]),
    L(1, 310, [[28, 200, "Smoke alarm service"], [490, 512, "$64.00"]]),
    L(1, 300, [[28, 200, "Total"], [484, 512, "$374.00"], [531, 570, "$2,080.00"]]),
    L(1, 250, [[28, 200, "Statement Fee *"], [493, 512, "$5.50"]]),
    L(1, 240, [[28, 300, "Withdrawal by EFT to owner"], [478, 512, "$1,700.50"]])
  ];
  var r = agentStatementFromLines(lines);
  assert.equal(r.date, "2026-03-03");
  assert.equal(r.rent, 2000);
  assert.equal(r.water, 80);
  assert.equal(r.fees, 125.5);
  assert.equal(r.waterRates, 190);
  assert.deepEqual(r.others, [{ what: "Smoke alarm service", amount: 64 }]);
  assert.equal(r.received, 1700.5);
  assert.equal(Math.round((r.rent + r.water - r.fees - r.waterRates - 64) * 100) / 100, 1700.5);
});
