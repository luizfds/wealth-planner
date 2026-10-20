import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state, setState, migrateState } from "../src/state.js";
import { agentAccountFor, accountBalance, setAccountBalance, accountSourceOptions, accountsOverview } from "../src/calc/accounts.js";
import { logAgentStatement, fillAgentAccount } from "../src/calc/agentstatement.js";
import { billsForMonth, upcomingBills } from "../src/calc/bills.js";
import { billsCalendarHtml } from "../src/components/cashflow.js";

// Invented: one rental, its manager, a quarterly water bill and a yearly pest check it pays.
function fixture(){
  var p = { id: "p1", what: "1 Example St", kind: "IP", income: [{ what: "Rent", amount: 450, freq: "Weekly" }],
    expenses: [{ id: "wr", what: "Water rates", amount: 210, freq: "Quarterly" }, { id: "pc", what: "Pest check", amount: 160, freq: "Yearly" }], loans: [] };
  return { incomeLog: [], transactions: [], transfers: [], properties: [p], assets: [], debts: [],
    accounts: [{ id: "a1", name: "Bank One", type: "everyday" }, { id: "a2", name: "Fern Realty", type: "agent", link: "property:p1" }] };
}

test("a property manager account is found for its property, or as the only one", function(){
  var st = fixture();
  assert.equal(agentAccountFor(st, "p1").name, "Fern Realty");
  st.accounts[1].link = "";
  assert.equal(agentAccountFor(st, "p1").name, "Fern Realty");
  st.accounts.push({ id: "a3", name: "Other Realty", type: "agent" });
  assert.equal(agentAccountFor(st, "p1"), null);
});

test("statement bills are tagged with the agent account, and older blank ones are filled", function(){
  var st = fixture();
  var rec = logAgentStatement(st, st.properties[0], { date: "2026-04-01", rent: 1950, fees: 140, waterRates: 210, account: "Bank One" });
  assert.deepEqual(st.transactions.map(function(t){ return t.account; }), ["Fern Realty"]);
  assert.equal(st.incomeLog[0].account, "Bank One");
  st.transactions[0].account = "";
  st.transactions.push({ id: "hand", date: "2026-04-02", amount: 30, account: "" });
  assert.equal(fillAgentAccount(st), 1);
  assert.equal(st.transactions[0].account, "Fern Realty");
  assert.equal(st.transactions[1].account, "", "only bills from statements are touched");
  assert.ok(rec.txIds.length === 1);
});

test("bills the agent pays are their own group, never overdue, never upcoming", function(){
  var st = fixture();
  var items = st.properties[0].expenses;
  var tx = [{ id: "t1", date: "2026-07-01", amount: 210, linkedExpenseId: "wr", account: "Fern Realty" },
    { id: "t2", date: "2026-03-01", amount: 160, linkedExpenseId: "pc", account: "Fern Realty" }];
  var r = billsForMonth(items, tx, "2026-10", "2026-10-21", { accounts: st.accounts, transfers: [] });
  var oct = r.days["2026-10-01"];
  assert.equal(oct[0].agent, "Fern Realty");
  assert.equal(oct[0].overdue, false);
  assert.equal(r.agentTotal, 210);
  assert.equal(r.directTotal, 0);
  assert.deepEqual(upcomingBills(items, tx, "2026-09-28", 14, { accounts: st.accounts, transfers: [] }), []);
  var html = billsCalendarHtml(r, "2026-10", "2026-10-21");
  assert.match(html, /Paid by the property manager/);
  assert.match(html, /by-agent/);
  assert.doesNotMatch(html, /From your accounts/);
  // Without the agent account the same bill is a direct debit to chase.
  var plain = billsForMonth(items, tx, "2026-10", "2026-10-21", { accounts: [st.accounts[0]], transfers: [] });
  assert.equal(plain.days["2026-10-01"][0].overdue, true);
});

test("an agent account has no balance, can't be given one, and survives migration", function(){
  var st = fixture();
  setState(migrateState(st));
  var a = state.accounts.find(function(x){ return x.type === "agent"; });
  assert.ok(a, "kept its type");
  assert.equal(a.link, "property:p1", "kept its property");
  var b = accountBalance(a);
  assert.equal(b.balance, null);
  assert.equal(b.source.label, "1 Example St");
  assert.equal(setAccountBalance(a, 100), false);
  assert.deepEqual(accountSourceOptions(a).map(function(o){ return o.key; }), ["property:p1"]);
  assert.equal(accountsOverview().held, 0);
});

test("the Accounts page shows a property manager without a balance or an Update button", async function(){
  var { accountRowHtml } = await import("../src/components/accounts.js");
  setState(migrateState(fixture()));
  var html = accountRowHtml(state.accounts[1], 1, "2026-10-21");
  assert.match(html, /pays from the rent/);
  assert.match(html, /1 Example St/);
  assert.doesNotMatch(html, /data-acct-bal=/);
});
