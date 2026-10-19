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

test("paying the card is a transfer, from either statement", function(){
  var accounts = [{ name: "Bank One", type: "everyday" }, { name: "Fern Card", type: "credit" }, { name: "Saver", type: "savings" }];
  var names = accounts.map(function(a){ return a.name; });
  // On the card's statement: the payer is where earlier payments to it came from.
  var onCard = detectTransfer("PAYMENT - BPAY - THANK YOU", names, "Fern Card", { accounts: accounts, transfers: [{ from: "Saver", to: "Fern Card" }, { from: "Bank One", to: "Fern Card" }, { from: "Bank One", to: "Fern Card" }] });
  assert.deepEqual(onCard, { account: "Bank One", likely: true, cardPayment: true });
  assert.equal(detectTransfer("PAYMENT-BPAY-THANK YOU", names, "Fern Card", { accounts: accounts, transfers: [] }).account, "", "no history: the person picks");
  // On the bank's statement: the household's one card.
  var onBank = detectTransfer("BPAY Bill Payment Westfield Cards 4111 Rewards", names, "Bank One", { accounts: accounts, transfers: [] });
  assert.equal(onBank.account, "Fern Card");
  // A purchase with "card" in it on the card itself isn't a payment.
  assert.equal(detectTransfer("CARD FEE", names, "Fern Card", { accounts: accounts }), null);
});
