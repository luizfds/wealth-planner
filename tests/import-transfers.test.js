import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { detectTransfer, closingBalance, learnRule, suggestFor, pruneRules } from "../src/calc/import-rules.js";
import { parseBankCsv } from "../src/calc/bank-import.js";

test("a transfer is spotted from another account's name, or hinted from the words", function(){
  var names = ["Bank One", "Bank One Savings", "Fern Card"];
  assert.deepEqual(detectTransfer("TRANSFER TO BANK ONE SAVINGS 123", names, "Bank One"), { account: "Bank One Savings", likely: true });
  assert.deepEqual(detectTransfer("PAYMENT THANK YOU", names, "Fern Card"), { account: "", likely: true });
  assert.equal(detectTransfer("FERN CAFE NEWTOWN", names, "Bank One"), null);
  assert.equal(detectTransfer("BANK ONE INTEREST", names, "Bank One"), null, "the statement's own account isn't a transfer target");
});

test("closing balance: the last row by date, either file order", function(){
  assert.deepEqual(closingBalance([{ date: "2026-09-01", balance: 100 }, { date: "2026-09-03", balance: 70 }, { date: "2026-09-03", balance: 65 }]), { date: "2026-09-03", balance: 65 });
  assert.deepEqual(closingBalance([{ date: "2026-09-03", balance: 65 }, { date: "2026-09-03", balance: 70 }, { date: "2026-09-01", balance: 100 }]), { date: "2026-09-03", balance: 65 });
  assert.equal(closingBalance([{ date: "2026-09-01", balance: null }]), null);
});

test("the parser reads a balance column, headed or not", function(){
  var headed = parseBankCsv([["Date", "Amount", "Description", "Balance"], ["01/09/2026", "-20.00", "FERN CAFE", "980.00"]]);
  assert.equal(headed.rows[0].balance, 980);
  var bare = parseBankCsv([["01/09/2026", "-20.00", "FERN CAFE", "980.00"], ["02/09/2026", "-5.50", "BUS", "974.50"], ["03/09/2026", "-12.00", "SHOP", "962.50"]]);
  assert.equal(bare.rows[2].balance, 962.5);
  assert.equal(bare.rows[2].amount, 12);
});

test("transfer rules: learned per direction, suggested ahead of spending rules, kept by prune", function(){
  var rules = [{ id: "r1", match: "transfer to bank", linkedExpenseId: "e1", category: "", hits: 1 }];
  learnRule(rules, "TRANSFER TO BANK ONE SAVINGS", { transferAccount: "Bank One Savings", transferDirection: "debit" });
  var t = rules.find(function(r){ return r.transferAccount; });
  assert.equal(t.transferDirection, "debit");
  var s = suggestFor("TRANSFER TO BANK ONE SAVINGS 99", rules, [], "debit");
  assert.equal(s.transferAccount, "Bank One Savings");
  assert.equal(suggestFor("TRANSFER TO BANK ONE SAVINGS 99", rules, [], "credit").transferAccount, undefined);
  assert.equal(pruneRules(rules, []).some(function(r){ return r.transferAccount; }), true);
});
