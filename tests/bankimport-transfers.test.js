import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { startBankImport } from "../src/components/bank-import.js";
import * as BI from "../src/components/bank-import.js";

// v3.149.1: a transfer already logged — a card repayment typed in by hand — met again on a statement
// is a duplicate, not a second transfer. Invented.
test("a statement row matching a logged transfer is already logged", function(){
  var keep = { transfers: state.transfers, transactions: state.transactions, accounts: state.accounts, importRules: state.importRules };
  try {
    state.accounts = [{ name: "Everyday", type: "everyday" }, { name: "Card A", type: "credit" }];
    state.transactions = []; state.importRules = [];
    state.transfers = [{ id: "x1", date: "2026-05-14", from: "Everyday", to: "Card A", amount: 812.35 }];
    startBankImport("Date,Description,Amount\n15/05/2026,CARD PAYMENT THANK YOU,812.35\n16/05/2026,FERN CAFE,-12.40\n", "card.csv");
    var bi = BI.bankImport;
    assert.equal(bi.duplicates.length, 1);
    assert.ok(bi.duplicates[0].duplicateOfTransfer);
    assert.equal(bi.creditGroups.length, 0, "not offered again");
    assert.equal(bi.groups.length, 1, "the purchase still is");
  } finally { Object.assign(state, keep); }
});
