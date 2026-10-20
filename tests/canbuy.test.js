import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state, defaultPurchaseConfig } from "../src/state.js";
import { canBuy, cashSources } from "../src/calc/canbuy.js";
import { canBuyHtml } from "../src/components/canbuy.js";

// Can we buy? (v3.88.0), invented household.
function withHousehold(fn, price){
  var keys = ["properties", "assets", "purchase", "scenarios", "home", "invest", "income", "shared"];
  var keep = {}; keys.forEach(function(k){ keep[k] = state[k]; });
  try {
    state.properties = [{ id: "ip", what: "9 Sample Ave", kind: "IP", purchaseDate: "2022-03-01", ownership: {}, income: [], expenses: [],
      loans: [
        { id: "a", what: "Loan A", balance: 400000, offsetBalance: 60000, rate: 6.2, termYears: 25, repaymentType: "PI", settlementDate: "2022-03-01" },
        { id: "b", what: "Loan B", balance: 70000, offsetBalance: 70000, rate: 5.9, termYears: 30, repaymentType: "PI", settlementDate: "2025-04-01" }
      ] }];
    state.assets = [{ category: "Cash", what: "Everyday", amount: 4000 }];
    state.scenarios = ["Renting", "Buy"];
    state.home = { Renting: [], Buy: [] };
    state.invest = {};
    state.income = []; state.shared = [];
    state.purchase = { Renting: defaultPurchaseConfig(0, 20, 6, 30, "NSW", false), Buy: Object.assign(defaultPurchaseConfig(price, 20, 6, 30, "NSW", false), { enabled: true, otherCosts: [] }) };
    fn();
  } finally { keys.forEach(function(k){ state[k] = keep[k]; }); }
}

test("cash comes from cash, then own-savings offsets, then borrowed money last", function(){
  withHousehold(function(){
    var s = cashSources();
    assert.deepEqual(s.map(function(x){ return x.kind; }), ["cash", "offset", "borrowed"]);
    var c = canBuy("Buy");
    assert.ok(c.upfront > 90000, "20% deposit plus stamp duty");
    assert.equal(c.available, 134000);
    assert.equal(c.draws[0].take, 4000);
    assert.equal(c.draws[1].take, 60000);
    assert.ok(c.draws[2].take > 0 && c.draws[2].kind === "borrowed" && !c.draws[2].deductible);
    var exp = 60000 * 0.062 + c.draws[2].take * 0.059;
    assert.ok(Math.abs(c.extraInterestYearly - exp) <= 1);
    assert.equal(c.deductibleExtra, Math.round(60000 * 0.062));
    assert.ok(c.nonDeductibleExtra > 0);
    var html = canBuyHtml([c]);
    assert.match(html, /borrowed money/);
    assert.match(html, /stops being deductible/);
  }, 400000);
});

test("short of cash says by how much", function(){
  withHousehold(function(){
    var c = canBuy("Buy");
    assert.ok(c.short > 0);
    assert.equal(Math.round(c.short), Math.round(c.upfront - 134000));
    assert.match(canBuyHtml([c]), /short of the cash needed/);
  }, 1200000);
});

test("first home buyer ticked while owning a property is flagged", function(){
  withHousehold(function(){
    state.purchase.Buy.firstHomeBuyer = true;
    assert.equal(canBuy("Buy").fhbButOwns, true);
  }, 500000);
});
