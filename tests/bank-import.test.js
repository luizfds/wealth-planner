import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  detectDateOrder, parseBankDate, parseBankAmount, looksLikeHeaderRow, detectColumns,
  normaliseDescription, transactionKey, parseBankCsv, bankImportSummary
} from "../src/calc/bank-import.js";
import { parseCsv } from "../src/lib/backup.js";

// The fixtures below are shaped like the real exports, not like an ideal CSV: the point of this
// module is the shapes it survives, so a test written against a tidy file tests nothing.

// CommBank: no header row at all, date / signed amount / description / running balance.
var COMMBANK = [
  "02/09/2026,-45.20,\"WOOLWORTHS 1234 SYDNEY NS\",1250.30",
  "03/09/2026,-12.50,\"CAFE MILANO\",1237.80",
  "15/09/2026,-1890.00,\"RENT PAYMENT\",-652.20",
  "16/09/2026,+4200.00,\"SALARY WOOLWORTHS GROUP\",3547.80"
].join("\n");

// A Debit/Credit-split export with a header, unsigned values in each column.
var SPLIT = [
  "Date,Transaction Details,Debit,Credit,Balance",
  "01/08/2026,COLES EXPRESS 5521,88.40,,4100.00",
  "04/08/2026,SPOTIFY P2B3C4,13.99,,4086.01",
  "10/08/2026,REFUND QANTAS,,220.00,4306.01"
].join("\n");

test("a headerless export is not mistaken for a headed one", function(){
  var rows = parseCsv(COMMBANK);
  assert.equal(looksLikeHeaderRow(rows[0]), false, "row 0 here is a real transaction");
  var parsed = parseBankCsv(rows);
  assert.equal(parsed.rows.length, 4, "eating row 0 as a header would silently drop a transaction");
});

test("a headed export finds its columns by name", function(){
  var rows = parseCsv(SPLIT);
  assert.equal(looksLikeHeaderRow(rows[0]), true);
  var cols = detectColumns(rows);
  assert.equal(cols.date, 0);
  assert.equal(cols.description, 1);
  assert.equal(cols.debit, 2);
  assert.equal(cols.credit, 3);
});

test("DD/MM is the default, because in this country it is", function(){
  // 03/04/2026 has no proof either way. Reading it as 3 March moves a third of a year's spending
  // into the wrong months and nothing about the result looks wrong.
  assert.equal(parseBankDate("03/04/2026", detectDateOrder(["03/04/2026"])), "2026-04-03");
});

test("a date above 12 in the first position proves DD/MM for the whole file", function(){
  assert.equal(detectDateOrder(["02/09/2026", "15/09/2026", "03/04/2026"]), "DMY");
});

test("a date above 12 in the SECOND position proves MM/DD, and only that overrides the default", function(){
  assert.equal(detectDateOrder(["09/02/2026", "04/17/2026"]), "MDY");
  assert.equal(parseBankDate("04/17/2026", "MDY"), "2026-04-17");
  // ...and a file that proves both ways is self-contradictory, so it falls back to local order
  // rather than trusting whichever won a count.
  assert.equal(detectDateOrder(["15/09/2026", "04/17/2026"]), "DMY");
});

test("parseBankDate reads ISO, named months and 2-digit years", function(){
  assert.equal(parseBankDate("2026-09-02", "DMY"), "2026-09-02");
  assert.equal(parseBankDate("15 Mar 2026", "DMY"), "2026-03-15");
  assert.equal(parseBankDate("15-Mar-26", "DMY"), "2026-03-15");
  assert.equal(parseBankDate("Mar 15, 2026", "DMY"), "2026-03-15");
  assert.equal(parseBankDate("02.09.2026", "DMY"), "2026-09-02");
});

test("an impossible date is rejected rather than rolled forward", function(){
  // new Date(2026, 1, 31) is 3 March. A rolled-over date is a wrong date that looks right.
  assert.equal(parseBankDate("31/02/2026", "DMY"), null);
  assert.equal(parseBankDate("32/01/2026", "DMY"), null);
  assert.equal(parseBankDate("not a date", "DMY"), null);
});

test("parseBankAmount handles the three ways banks write a negative", function(){
  assert.equal(parseBankAmount("-1234.56"), -1234.56);
  assert.equal(parseBankAmount("(1,234.56)"), -1234.56);
  assert.equal(parseBankAmount("$1,234.56"), 1234.56);
  assert.equal(parseBankAmount("88.40"), 88.40);
  assert.equal(parseBankAmount(""), null);
  assert.equal(parseBankAmount("   "), null);
});

test("a signed Amount column keeps its own sign", function(){
  var parsed = parseBankCsv(parseCsv(COMMBANK));
  var byDesc = {};
  parsed.rows.forEach(function(r){ byDesc[r.description] = r; });
  assert.equal(byDesc["WOOLWORTHS 1234 SYDNEY NS"].direction, "debit");
  assert.equal(byDesc["WOOLWORTHS 1234 SYDNEY NS"].amount, 45.20);
  assert.equal(byDesc["SALARY WOOLWORTHS GROUP"].direction, "credit", "+4200 is money in, not a $4,200 purchase");
  assert.equal(byDesc["SALARY WOOLWORTHS GROUP"].amount, 4200);
});

test("a Debit/Credit pair takes its sign from the column, not the value", function(){
  var parsed = parseBankCsv(parseCsv(SPLIT));
  assert.equal(parsed.rows.length, 3);
  var refund = parsed.rows.find(function(r){ return /REFUND/.test(r.description); });
  assert.equal(refund.direction, "credit");
  assert.equal(refund.amount, 220);
  var coles = parsed.rows.find(function(r){ return /COLES/.test(r.description); });
  assert.equal(coles.direction, "debit", "88.40 in a Debit column is money out even though it's written positive");
});

test("an unsigned single Amount column reads as spending", function(){
  // Some exports put the direction in a Transaction Type column this parser doesn't model. On a
  // statement, unsigned means spending far more often than not — and the review screen can correct
  // the exceptions, which it can't do if the row was silently dropped instead.
  var rows = parseCsv(["Date,Description,Amount", "02/09/2026,COLES,88.40"].join("\n"));
  var parsed = parseBankCsv(rows);
  assert.equal(parsed.rows[0].direction, "debit");
});

test("the running-balance column is not mistaken for the amount", function(){
  // Both are numeric in every row, so "most numeric column wins" picks whichever comes first.
  var parsed = parseBankCsv(parseCsv(COMMBANK));
  var rent = parsed.rows.find(function(r){ return /RENT/.test(r.description); });
  assert.equal(rent.amount, 1890, "1890 is the amount; -652.20 is the balance it left behind");
});

test("the description column is the longest free text, not merely the most", function(){
  // A NAB-shaped export: an account number column is text in every row too, and shorter.
  var rows = parseCsv([
    "Date,Amount,Account Number,Transaction Type,Transaction Details",
    "02/09/2026,-45.20,084-123 55512345,EFTPOS DEBIT,WOOLWORTHS 1234 SYDNEY NSW AU"
  ].join("\n"));
  var parsed = parseBankCsv(rows);
  assert.equal(parsed.rows[0].description, "WOOLWORTHS 1234 SYDNEY NSW AU");
});

test("re-importing the same file flags every row as a duplicate, not none and not some", function(){
  // The normal case, not the edge case: you export "last 3 months" every month.
  var rows = parseCsv(COMMBANK);
  var first = parseBankCsv(rows);
  var committed = first.rows.map(function(r){
    return { date: r.date, amount: r.direction === "debit" ? r.amount : r.amount, what: r.description };
  });
  var second = parseBankCsv(rows, { existing: committed });
  assert.equal(second.rows.filter(function(r){ return r.duplicate; }).length, 4);
  assert.equal(bankImportSummary(second).newSpend, 0);
});

test("two genuinely identical purchases on one day both survive a re-import", function(){
  // They collapse to one duplicate key, so a naive `has this key` check would drop the second
  // coffee forever. The count matters, not just the presence.
  var text = ["01/09/2026,-4.50,COFFEE", "01/09/2026,-4.50,COFFEE"].join("\n");
  var parsed = parseBankCsv(parseCsv(text));
  assert.equal(parsed.rows.length, 2);
  assert.deepEqual(parsed.rows.map(function(r){ return r.duplicate; }), [false, false]);
  // With only ONE of them already logged, the first reads as a duplicate and the second as new.
  var withOne = parseBankCsv(parseCsv(text), { existing: [{ date: "2026-09-01", amount: 4.50, what: "COFFEE" }] });
  assert.deepEqual(withOne.rows.map(function(r){ return r.duplicate; }), [true, false]);
});

test("duplicate matching ignores punctuation and case in the description", function(){
  assert.equal(normaliseDescription("WOOLWORTHS 1234  SYDNEY-NS"), "woolworths 1234 sydney ns");
  assert.equal(
    transactionKey("2026-09-02", -45.2, "WOOLWORTHS 1234 SYDNEY NS"),
    transactionKey("2026-09-02", 45.2, "woolworths  1234, sydney ns")
  );
});

test("a file with no readable date or amount column reports headerOk:false, not zero rows", function(){
  // Two different failures — "this isn't a bank export" and "every row had a problem" — that
  // deserve different messages in the preview.
  var parsed = parseBankCsv(parseCsv("Notes,Comment\nhello,world"));
  assert.equal(parsed.headerOk, false);
  assert.equal(parsed.rows.length, 0);
});

test("unreadable rows are reported with their row number, not silently dropped", function(){
  var parsed = parseBankCsv(parseCsv([
    "Date,Description,Amount",
    "02/09/2026,COLES,-88.40",
    "not-a-date,MYSTERY,-10.00",
    "04/09/2026,NO AMOUNT,"
  ].join("\n")));
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.errors.length, 2);
  assert.deepEqual(parsed.errors.map(function(e){ return e.row; }), [3, 4]);
});

test("blank lines and $0 statement artifacts are skipped without becoming errors", function(){
  var parsed = parseBankCsv(parseCsv([
    "Date,Description,Amount",
    "02/09/2026,COLES,-88.40",
    ",,",
    "03/09/2026,BALANCE CARRIED FORWARD,0.00"
  ].join("\n")));
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.errors.length, 0, "a blank line is not a problem worth reporting");
});

test("the summary names the range, the spend, and how it read the dates", function(){
  var parsed = parseBankCsv(parseCsv(COMMBANK));
  var s = bankImportSummary(parsed);
  assert.equal(s.total, 4);
  assert.equal(s.newSpend, 3);
  assert.ok(Math.abs(s.newSpendAmount - (45.20 + 12.50 + 1890.00)) < 1e-9);
  assert.equal(s.credits, 1);
  assert.equal(s.firstDate, "2026-09-02");
  assert.equal(s.lastDate, "2026-09-16");
  assert.equal(s.dateOrder, "DMY", "stated, because it's the decision most likely to be silently wrong");
});

test("the future-dates flag tolerates a few pending entries but catches a misread", function(){
  // A statement carrying next week's scheduled direct debit is normal; one reaching months out is
  // what 03/04 read as March looks like when the file was exported in April.
  var soon = parseBankCsv(parseCsv(["Date,Description,Amount", "02/09/2026,COLES,-88.40"].join("\n")));
  assert.equal(bankImportSummary(soon).hasFutureDates, false);
  var farOut = parseBankCsv(parseCsv(["Date,Description,Amount", "02/09/2099,COLES,-88.40"].join("\n")));
  assert.equal(bankImportSummary(farOut).hasFutureDates, true);
});

test("a purchase already logged BY HAND is not imported a second time", function(){
  // The bug this exists to prevent, and the one that matters most: logExpenseTransaction() leaves
  // `what` blank on purpose so a linked row shows its budget line's name. So the person this whole
  // feature is for — someone who has been logging by hand and now imports instead — would
  // re-import everything they'd already logged, and watch their spending silently double.
  var handLogged = [{ id: "t1", date: "2026-09-02", amount: 45.20, what: "", linkedExpenseId: "e1" }];
  var parsed = parseBankCsv(parseCsv('02/09/2026,-45.20,"WOOLWORTHS 1234 SYDNEY NS",1250.30'), { existing: handLogged });
  assert.equal(parsed.rows[0].duplicate, false, "not a certain duplicate — the descriptions don't match");
  assert.equal(parsed.rows[0].possibleDuplicate, true, "but the date and amount do, which is all the evidence there is");
  assert.equal(bankImportSummary(parsed).newSpend, 0, "so it is not counted as new spending");
  assert.equal(bankImportSummary(parsed).possibleDuplicates, 1);
});

test("a possible duplicate is consumed per match, not treated as a blanket rule", function(){
  // Two hand-logged $20 rows on one day absorb two bank rows; a third is genuinely new.
  var handLogged = [
    { id: "t1", date: "2026-09-02", amount: 20, what: "" },
    { id: "t2", date: "2026-09-02", amount: 20, what: "" }
  ];
  var parsed = parseBankCsv(parseCsv([
    "02/09/2026,-20.00,SHOP A",
    "02/09/2026,-20.00,SHOP B",
    "02/09/2026,-20.00,SHOP C"
  ].join("\n")), { existing: handLogged });
  assert.deepEqual(parsed.rows.map(function(r){ return r.possibleDuplicate; }), [true, true, false]);
});

test("an exact duplicate is never also counted as a possible one", function(){
  // Double-counting the same row in two buckets would overstate what's being skipped.
  var existing = [{ id: "t1", date: "2026-09-02", amount: 45.20, what: "WOOLWORTHS 1234 SYDNEY NS" }];
  var parsed = parseBankCsv(parseCsv('02/09/2026,-45.20,"WOOLWORTHS 1234 SYDNEY NS",1250.30'), { existing: existing });
  assert.equal(parsed.rows[0].duplicate, true);
  assert.equal(parsed.rows[0].possibleDuplicate, false);
});

test("a hand-logged row on a different day or amount doesn't suppress anything", function(){
  var handLogged = [{ id: "t1", date: "2026-09-01", amount: 45.20, what: "" }];
  var parsed = parseBankCsv(parseCsv('02/09/2026,-45.20,"WOOLWORTHS",1250.30'), { existing: handLogged });
  assert.equal(parsed.rows[0].possibleDuplicate, false);
  assert.equal(bankImportSummary(parsed).newSpend, 1);
});

test("a credit is kept and labelled, not silently dropped", function(){
  // The app can't tell a $220 refund from a $220 salary instalment, so the parser keeps both and
  // lets the review screen ask. Dropping them in the parser would make that impossible.
  var parsed = parseBankCsv(parseCsv([
    "Date,Transaction Details,Debit,Credit,Balance",
    "01/08/2026,COLES EXPRESS 5521,88.40,,4100.00",
    "10/08/2026,REFUND QANTAS,,220.00,4320.00"
  ].join("\n")));
  var credit = parsed.rows.find(function(r){ return r.direction === "credit"; });
  assert.ok(credit, "the credit survives the parse");
  assert.equal(credit.amount, 220, "carried as a positive magnitude; the direction says which way");
  assert.equal(bankImportSummary(parsed).credits, 1);
  assert.equal(bankImportSummary(parsed).newSpend, 1, "and it is not counted as spending");
});
