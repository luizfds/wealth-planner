import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state, defaultState, setState } from "../src/state.js";
import { applyFirstRun, shouldOfferFirstRun, COMMON_COSTS } from "../src/calc/firstrun.js";
import { accountBalance } from "../src/calc/accounts.js";
import { startFirstRun, firstRun, firstRunHtml } from "../src/components/firstrun.js";

test("an empty app is offered the setup once; anything entered, finished or skipped stops it", function(){
  var keep = state;
  try {
    setState(defaultState());
    assert.equal(shouldOfferFirstRun(), true);
    state.firstRunSkipped = true;
    assert.equal(shouldOfferFirstRun(), false);
    setState(defaultState());
    state.income.push({ what: "Pay", amount: 1 });
    assert.equal(shouldOfferFirstRun(), false);
  } finally { setState(keep); }
});

test("the answers become ordinary rows: pay, accounts with balances, rent and monthly costs", function(){
  var keep = state;
  try {
    setState(defaultState());
    var made = applyFirstRun({
      people: [{ name: "Alex", age: 34, pay: 90000, payFreq: "Yearly" }, { name: "Sam", age: "", pay: "", payFreq: "Yearly" }, { name: "  ", pay: 5 }],
      accounts: [{ name: "Bank One", type: "everyday", balance: 2500 }, { name: "Card", type: "credit", balance: -700 }, { name: "Spare", type: "savings", balance: "" }],
      housing: { kind: "rent", amount: 550, freq: "Weekly" },
      costs: [{ what: "Groceries", amount: 800 }, { what: "Subscriptions", amount: 40 }, { what: "Eating out", amount: "" }]
    }, "2026-10-01");
    assert.deepEqual(made, { people: 2, accounts: 3, lines: 3 });
    assert.equal(state.income.length, 2);
    assert.equal(state.income[0].person, "Alex");
    assert.equal(state.income[0].incomeType, "Gross");
    assert.equal(state.income[0].amount, 90000);
    assert.equal(state.fire.currentAge, 34);
    assert.equal(accountBalance(state.accounts[0]).balance, 2500);
    assert.equal(accountBalance(state.accounts[1]).balance, 700, "a card stores what it owes, positive");
    assert.equal(accountBalance(state.accounts[2]).balance, null, "no balance typed, nothing invented");
    // v3.172.0 (item 207): where the household lives is a budget line marked as the home.
    var rent = state.shared.find(function(r){ return r.what === "Rent"; });
    assert.equal(rent.amount, 550);
    assert.equal(rent.freq, "Weekly");
    assert.equal(rent.account, "Bank One");
    assert.equal(rent.homeCost, true);
    assert.equal(rent.category, "Housing");
    var costs = state.shared.filter(function(r){ return !r.homeCost; });
    assert.equal(costs.length, 2);
    assert.equal(costs[0].category, "Groceries");
    assert.equal(costs[1].classification, "Wants");
    assert.equal(costs[0].account, "Bank One");
    assert.equal(state.firstRunDone, true);
    assert.equal(shouldOfferFirstRun(), false);
  } finally { setState(keep); }
});

test("every preset cost names a default category", function(){
  var keep = state;
  try {
    setState(defaultState());
    COMMON_COSTS.forEach(function(c){ assert.ok(state.categories.indexOf(c.category) !== -1, c.category); });
  } finally { setState(keep); }
});

test("each step of the sheet renders", function(){
  startFirstRun();
  firstRun.answers.people[0].name = "Alex";
  for(var i = 0; i < 5; i++){
    firstRun.step = i;
    var h = firstRunHtml();
    assert.match(h, /Step \d of 5/);
    assert.doesNotMatch(h, /undefined|NaN/);
  }
  assert.match(h, /data-fr-finish="import"/);
});
