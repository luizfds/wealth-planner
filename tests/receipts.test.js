import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { receiptRefs, receiptIds, attachReceipt, detachReceipt, receiptAccepts, shrunkSize, withReceiptFiles, takeReceiptFiles, deductionReceipts, MAX_FILE_BYTES } from "../src/calc/receipts.js";
import { receiptsLineText } from "../src/lib/storageuse.js";

// Invented household: two deductible lines, a few transactions, one worksheet deduction.
function household(){
  return {
    shared: [{ id: "l1", what: "Work tools", deductible: true, deductiblePerson: "Alex" }, { id: "l2", what: "Groceries" },
      { id: "l3", what: "Union fees", deductible: true, deductiblePerson: "Sam", receipts: [{ id: "rcL", name: "fees.pdf", type: "application/pdf", size: 9000 }] }],
    home: { Renting: [] },
    transactions: [
      { id: "t1", date: "2026-08-04", amount: 129, what: "Fern Hardware", linkedExpenseId: "l1", receipts: [{ id: "rc1", name: "drill.jpg", type: "image/jpeg", size: 120000 }] },
      { id: "t2", date: "2026-09-10", amount: 45.5, what: "Fern Hardware", linkedExpenseId: "l1" },
      { id: "t3", date: "2026-09-12", amount: 88, what: "Fern Grocer", linkedExpenseId: "l2" },
      { id: "t4", date: "2026-10-01", amount: 60, what: "Union", linkedExpenseId: "l3" },
      { id: "t5", date: "2025-05-01", amount: 30, what: "Fern Hardware", linkedExpenseId: "l1" }
    ],
    taxYears: { 2026: { people: { Alex: { deductions: [{ label: "D4", what: "Self-education course", amount: 400 }] } }, evidenceReceipts: { "phi": [{ id: "rcE", name: "phi.pdf", size: 1 }] } } }
  };
}

test("every reference is found, wherever it's attached", function(){
  assert.deepEqual(receiptIds(household()).sort(), ["rc1", "rcE", "rcL"]);
  assert.equal(receiptRefs(household()).length, 3);
});

test("attach and detach edit the reference list; nothing is attached twice", function(){
  var t = {};
  attachReceipt(t, { id: "a", name: "x.jpg", type: "image/jpeg", size: 10 });
  attachReceipt(t, { id: "a", name: "x.jpg" });
  attachReceipt(t, { id: "b", name: "y.pdf" });
  assert.deepEqual(t.receipts.map(function(r){ return r.id; }), ["a", "b"]);
  assert.equal(detachReceipt(t, "a").name, "x.jpg");
  assert.equal(detachReceipt(t, "zz"), null);
  detachReceipt(t, "b");
  assert.equal(t.receipts, undefined);
});

test("photos of any size and PDFs under the cap are accepted; everything else is turned away", function(){
  assert.ok(receiptAccepts({ type: "image/jpeg", name: "a.jpg", size: 9e6 }).image);
  assert.ok(receiptAccepts({ type: "", name: "scan.HEIC", size: 2e6 }).ok);
  assert.ok(receiptAccepts({ type: "application/pdf", name: "a.pdf", size: 300000 }).ok);
  assert.equal(receiptAccepts({ type: "application/pdf", name: "a.pdf", size: MAX_FILE_BYTES + 1 }).ok, false);
  assert.equal(receiptAccepts({ type: "text/plain", name: "a.txt", size: 10 }).ok, false);
  assert.deepEqual(shrunkSize(4000, 3000, 1600), { w: 1600, h: 1200 });
  assert.deepEqual(shrunkSize(800, 600, 1600), { w: 800, h: 600 });
});

test("a backup carries the files the data refers to, and loading it takes them back out", function(){
  var st = household();
  var files = { rc1: { name: "drill.jpg", type: "image/jpeg", size: 3, data: "AAEC" }, rcL: { name: "fees.pdf", data: "AwQ=" }, stray: { name: "old.jpg", data: "AA==" } };
  var out = withReceiptFiles(st, files);
  assert.deepEqual(Object.keys(out.receiptFiles).sort(), ["rc1", "rcL"]);
  assert.equal(st.receiptFiles, undefined, "the live data isn't changed");
  var loaded = JSON.parse(JSON.stringify(out));
  var back = takeReceiptFiles(loaded);
  assert.deepEqual(Object.keys(back).sort(), ["rc1", "rcL"]);
  assert.equal(back.rc1.data, "AAEC");
  assert.equal(loaded.receiptFiles, undefined);
  assert.deepEqual(receiptIds(loaded).sort(), ["rc1", "rcE", "rcL"]);
  assert.equal(withReceiptFiles({ transactions: [] }, files).receiptFiles, undefined);
});

test("Tax → Documents lists the year's deductions with or without a receipt", function(){
  var st = household();
  var rows = deductionReceipts(st, { fy: 2026, lines: st.shared, window: { start: "2026-07-01", end: "2027-06-30" } });
  // t3 isn't deductible, t5 is last year; the worksheet deduction is in.
  assert.deepEqual(rows.map(function(r){ return r.key; }).sort(), ["ded:2026:Alex:0", "tx:t1", "tx:t2", "tx:t4"]);
  var by = {};
  rows.forEach(function(r){ by[r.key] = r; });
  assert.equal(by["tx:t1"].hasReceipt, true);
  assert.equal(by["tx:t2"].hasReceipt, false);
  assert.equal(by["tx:t4"].hasReceipt, true);
  assert.equal(by["tx:t4"].viaLine, true, "the line's invoice covers it");
  assert.equal(by["ded:2026:Alex:0"].hasReceipt, false);
  assert.equal(rows[0].hasReceipt, false, "the ones still missing come first");
});

test("a receipt attached on each of two devices survives a sync merge, files and all", async function(){
  var { mergeStates } = await import("../src/calc/syncmerge.js");
  var base = household();
  var phone = household(); attachReceipt(phone.transactions[1], { id: "rcP", name: "screws.jpg", size: 5 });
  var laptop = household(); attachReceipt(laptop.taxYears[2026].people.Alex.deductions[0], { id: "rcD", name: "course.pdf", size: 7 });
  var r = mergeStates(base, laptop, phone);
  assert.equal(r.conflicts.length, 0);
  assert.deepEqual(receiptIds(r.merged).sort(), ["rc1", "rcD", "rcE", "rcL", "rcP"]);
});

test("storage use names the receipts separately", function(){
  assert.equal(receiptsLineText({ count: 0, bytes: 0 }), "");
  assert.equal(receiptsLineText({ count: 3, bytes: 2.5 * 1048576 }), "3 receipts take 2.5 MB of the browser's file storage.");
});
