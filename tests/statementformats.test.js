import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBankCsv, statementFormat, parseOfx, parseQif, statementTextToCsv } from "../src/calc/bank-import.js";
import { parseCsv } from "../src/lib/backup.js";

// One invented statement, five ways. Every name and amount is made up.
var CSV = "Date,Description,Amount\n03/10/2026,FERN GROCER NORTHSIDE,-84.50\n05/10/2026,PAY EMPLOYER A,2500.00\n14/10/2026,FERN CAFE & BAKERY,-12.00\n28/10/2026,REFUND FERN GROCER,30.00\n";

var OFX_SGML = "OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:USASCII\nCHARSET:1252\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:NONE\n\n" +
  "<OFX><SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><DTSERVER>20261030<LANGUAGE>ENG</SONRS></SIGNONMSGSRSV1>" +
  "<BANKMSGSRSV1><STMTTRNRS><TRNUID>1<STMTRS><CURDEF>AUD<BANKACCTFROM><BANKID>000000<ACCTID>00000000<ACCTTYPE>CHECKING</BANKACCTFROM>\n<BANKTRANLIST><DTSTART>20261001<DTEND>20261031\n" +
  "<STMTTRN>\n<TRNTYPE>DEBIT\n<DTPOSTED>20261003000000[+10:AEST]\n<TRNAMT>-84.50\n<FITID>A1\n<NAME>FERN GROCER\n<MEMO>FERN GROCER NORTHSIDE\n</STMTTRN>\n" +
  "<STMTTRN>\n<TRNTYPE>CREDIT\n<DTPOSTED>20261005\n<TRNAMT>2500.00\n<FITID>A2\n<NAME>PAY EMPLOYER A\n</STMTTRN>\n" +
  "<STMTTRN>\n<TRNTYPE>DEBIT\n<DTPOSTED>20261014120000\n<TRNAMT>-12.00\n<FITID>A3\n<NAME>FERN CAFE &amp; BAKERY\n</STMTTRN>\n" +
  "<STMTTRN>\n<TRNTYPE>CREDIT\n<DTPOSTED>20261028\n<TRNAMT>30.00\n<FITID>A4\n<MEMO>REFUND FERN GROCER\n</STMTTRN>\n" +
  "</BANKTRANLIST><LEDGERBAL><BALAMT>1000.00<DTASOF>20261031</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>\n";

var OFX_XML = '<?xml version="1.0" encoding="UTF-8"?>\n<?OFX OFXHEADER="200" VERSION="220" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>\n' +
  "<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><CURDEF>AUD</CURDEF><BANKTRANLIST>" +
  "<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261003</DTPOSTED><TRNAMT>-84.50</TRNAMT><FITID>B1</FITID><NAME>FERN GROCER NORTHSIDE</NAME></STMTTRN>" +
  "<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20261005</DTPOSTED><TRNAMT>2500.00</TRNAMT><FITID>B2</FITID><NAME>PAY EMPLOYER A</NAME></STMTTRN>" +
  "<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261014</DTPOSTED><TRNAMT>-12.00</TRNAMT><FITID>B3</FITID><NAME>FERN CAFE &amp; BAKERY</NAME></STMTTRN>" +
  "<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20261028</DTPOSTED><TRNAMT>30.00</TRNAMT><FITID>B4</FITID><NAME>REFUND FERN GROCER</NAME></STMTTRN>" +
  "</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>";

// QFX: OFX 1.x with Intuit's sign-on block.
var QFX = OFX_SGML.replace("</SONRS>", "<INTU.BID>00000</SONRS>");

var QIF = "!Type:Bank\nD03/10/2026\nT-84.50\nPFERN GROCER NORTHSIDE\n^\nD5/10'26\nT2,500.00\nPPAY EMPLOYER A\n^\nD14/10/2026\nT-12.00\nPFERN CAFE & BAKERY\n^\nD28/10/2026\nT30.00\nPREFUND FERN GROCER\n^\n";

function read(text, name){
  var asCsv = statementTextToCsv(text, name);
  return parseBankCsv(parseCsv(asCsv != null ? asCsv : text), { existing: [] }).rows
    .map(function(r){ return [r.date, r.direction, r.amount, r.description].join(" | "); });
}

test("each format is recognised by its contents or its name", function(){
  assert.equal(statementFormat(CSV, "statement.csv"), "csv");
  assert.equal(statementFormat(OFX_SGML, "x.txt"), "ofx");
  assert.equal(statementFormat(OFX_XML, ""), "ofx");
  assert.equal(statementFormat(QFX, "statement.qfx"), "ofx");
  assert.equal(statementFormat(QIF, "x"), "qif");
  assert.equal(statementFormat("D03/10/2026", "statement.qif"), "qif");
});

test("OFX (SGML and XML), QFX and QIF import the same rows as the matching CSV", function(){
  var expected = read(CSV, "statement.csv");
  assert.equal(expected.length, 4);
  assert.deepEqual(read(OFX_SGML, "statement.ofx"), expected);
  assert.deepEqual(read(OFX_XML, "statement.ofx"), expected);
  assert.deepEqual(read(QFX, "statement.qfx"), expected);
  assert.deepEqual(read(QIF, "statement.qif"), expected);
});

test("the parsers' own reading: signed amounts, dates, names joined with memos", function(){
  var o = parseOfx(OFX_SGML);
  assert.equal(o.length, 4);
  assert.deepEqual(o[0], { date: "2026-10-03", description: "FERN GROCER NORTHSIDE", amount: -84.5, id: "A1" });
  assert.equal(o[3].description, "REFUND FERN GROCER");
  var q = parseQif(QIF);
  assert.equal(q[1].date, "5/10/2026");
  assert.equal(q[1].amount, 2500);
});

test("a re-import of the same statement in another format is caught as a duplicate", function(){
  var existing = [{ id: "t1", date: "2026-10-03", amount: 84.5, what: "FERN GROCER NORTHSIDE" }];
  var asCsv = statementTextToCsv(OFX_XML, "s.ofx");
  var r = parseBankCsv(parseCsv(asCsv), { existing: existing }).rows;
  assert.equal(r[0].duplicate, true);
});
