import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state, defaultPurchaseConfig } from "../src/state.js";
import { recalcComputedItems } from "../src/calc/engine.js";
import { adviceFor } from "../src/calc/advice.js";
import { householdSummary, anonymiser, deanonymiser } from "../src/calc/aisummary.js";
import { adviceHomeHtml, adviceStripHtml } from "../src/components/advice.js";
import { reviewHtml, askBody, SYSTEM_PROMPT, copyPrompt, REVIEW_FORMAT, askClaudeHtml, askUi } from "../src/components/askclaude.js";

// What the app notices (v3.98.0), invented household.
function withHousehold(fn){
  var keys = ["properties", "assets", "purchase", "scenarios", "activeScenario", "home", "invest", "income", "shared", "transactions", "incomeLog", "tax", "accounts", "debts", "emergency"];
  var keep = {}; keys.forEach(function(k){ keep[k] = state[k]; });
  try {
    state.scenarios = ["Renting", "Buy Example Town"]; state.activeScenario = "Renting";
    state.home = { Renting: [{ id: "r", what: "Rent", amount: 2600, freq: "Monthly" }], "Buy Example Town": [] };
    state.invest = {};
    state.income = [{ id: "g1", person: "Alex", incomeType: "Gross", what: "Salary", amount: 190000, freq: "Yearly" }, { id: "g2", person: "Sam", incomeType: "Gross", what: "Salary", amount: 95000, freq: "Yearly" }];
    state.tax = Object.assign({}, state.tax, { settings: { Alex: { concessionalCap: 30000, carryForward: 40000 }, Sam: { concessionalCap: 30000, carryForward: 0 } } });
    state.shared = [{ id: "g", what: "Groceries", category: "Groceries", classification: "Needs", amount: 250, freq: "Weekly" }, { id: "t", what: "Trips", category: "Travel", classification: "Wants", amount: 9000, freq: "Yearly", irregular: true }];
    state.properties = [{ id: "ip", what: "1 Example St", kind: "IP", purchaseDate: "2022-03-01", ownership: { Alex: 60, Sam: 40 }, value: 700000, pmFee: { percent: 7, flat: 0 }, state: "NSW",
      income: [{ what: "Rent", amount: 1800, freq: "Monthly" }], expenses: [{ what: "Rates", amount: 700, freq: "Quarterly" }],
      loans: [{ id: "a", what: "Loan A", balance: 520000, offsetBalance: 140000, rate: 6.2, termYears: 25, repaymentType: "PI", settlementDate: "2022-03-01" },
              { id: "b", what: "Loan B", balance: 60000, offsetBalance: 60000, rate: 6.0, termYears: 30, repaymentType: "PI", settlementDate: "2025-02-01" }] }];
    state.assets = [{ category: "Cash", what: "Everyday", amount: 6000 }, { category: "Shares", what: "Fund (Alex)", symbol: "FND", quantity: 10, amount: 900 },
      { category: "Shares", what: "Tiny One", symbol: "TN1", quantity: 5, amount: 40 }, { category: "Shares", what: "Tiny Two", symbol: "TN2", quantity: 9, amount: 60 }];
    state.purchase = { Renting: defaultPurchaseConfig(0, 20, 6, 30, "NSW", false), "Buy Example Town": Object.assign(defaultPurchaseConfig(900000, 15, 6.3, 30, "NSW", false), { enabled: true, otherCosts: [], syncRepayment: true }) };
    state.transactions = []; state.incomeLog = []; state.accounts = []; state.debts = [];
    recalcComputedItems();
    fn();
  } finally { keys.forEach(function(k){ state[k] = keep[k]; }); recalcComputedItems(); }
}

test("the rules read the household: a purchase under strain, borrowed deposit money, offset placement, PAYG, super room, small holdings", function(){
  withHousehold(function(){
    var a = adviceFor({ today: "2026-10-20" });
    var ids = a.map(function(x){ return x.id; });
    ["buy-borrowed:Buy Example Town", "offset-move", "payg:Alex", "super-room:Alex", "tiny-holdings"].forEach(function(id){ assert.ok(ids.indexOf(id) !== -1, id + " in " + ids.join(", ")); });
    assert.ok(ids.some(function(id){ return /^buy-(stress|ok):/.test(id); }));
    assert.equal(a[0].kind, "risk", "risks first");
    var room = a.find(function(x){ return x.id === "super-room:Alex"; });
    assert.ok(room.impactYearly > 0 && /carry-forward/.test(room.detail));
    var payg = a.find(function(x){ return x.id === "payg:Alex"; });
    assert.match(payg.detail, /more a month in the pay/);
    assert.deepEqual(payg.go, { page: "tax", sub: "people" }, "to the tick that says it's done");
    state.tax.settings = Object.assign({}, state.tax.settings, { Alex: Object.assign({}, (state.tax.settings || {}).Alex, { withholdingVariation: true }) });
    assert.ok(!adviceFor({ today: "2026-10-20" }).some(function(x){ return x.id === "payg:Alex"; }), "once arranged, not suggested");
    delete state.tax.settings.Alex.withholdingVariation;
    var off = a.find(function(x){ return x.id === "offset-move"; });
    assert.ok(off.impactYearly > 0, "a home loan's offset is worth more than a deductible loan's");
    var html = adviceHomeHtml(a);
    assert.match(html, /What the app notices/);
    assert.match(html, /data-adv-go="plan"/);
    assert.match(adviceStripHtml(a.filter(function(x){ return x.area === "tax"; }), "tax"), /The app notices/);
  });
});

test("the summary sent for a review carries no names, addresses or scenario names", function(){
  withHousehold(function(){
    var t = householdSummary(adviceFor({ today: "2026-10-20" }), { today: "2026-10-20" });
    ["Alex", "Sam", "Example St", "Example Town", "Everyday"].forEach(function(w){ assert.ok(t.indexOf(w) === -1, w + " leaked"); });
    assert.match(t, /Partner A/);
    assert.match(t, /Investment property 1 \(/);
    assert.match(t, /Scenario 2/);
    assert.match(t, /FND/);
    assert.equal(anonymiser(state)("Fund (Alex) on Loan B"), "FND on Property 1 loan 2");
    // The answer comes back with labels; on this device they read as the household's own names.
    assert.equal(deanonymiser(state)("Partner A should check Scenario 2 and Property 1 loan 2 (Scenario 12 isn't one)."),
      "Alex should check Buy Example Town and Loan B (Scenario 12 isn't one).");
  });
});

test("the review request and the answer's rendering", function(){
  var b = askBody("SUMMARY", "Should we buy?", "claude-sonnet-5-5");
  assert.equal(b.model, "claude-sonnet-5-5");
  assert.equal(b.system, SYSTEM_PROMPT);
  assert.match(b.messages[0].content, /SUMMARY[\s\S]*THEIR QUESTION\nShould we buy\?/);
  var h = reviewHtml("## Buying\n- **Cash** is fine\n- rates <b>\n\nPlain line");
  assert.match(h, /<h4>Buying<\/h4><ul><li><b>Cash<\/b> is fine<\/li><li>rates &lt;b><\/li><\/ul><p>Plain line<\/p>/);
});

test("the prompt for any AI: how to answer, in the standard layout, then the figures and the question", function(){
  var t = copyPrompt("SUMMARY LINES", "Sydney or Melbourne?");
  assert.ok(t.indexOf("HOW TO ANSWER") < t.indexOf("MY FINANCES") && t.indexOf("MY FINANCES") < t.indexOf("MY QUESTION"));
  assert.ok(t.indexOf(REVIEW_FORMAT) !== -1, "the standard headings travel with it");
  assert.match(t, /use those labels exactly as written/);
  assert.match(t, /## Priorities/);
  assert.ok(copyPrompt("S", "").indexOf("MY QUESTION") === -1);
  askUi.pasteOpen = true;
  var h = askClaudeHtml();
  assert.match(h, /data-ai-copy>Copy for any AI/);
  assert.match(h, /data-ai-paste/);
  askUi.pasteOpen = false;
});
