import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state, defaultPurchaseConfig } from "../src/state.js";
import { recalcComputedItems } from "../src/calc/engine.js";
import { adviceFor } from "../src/calc/advice.js";
import { householdSummary, aiAggregateSnapshot, AI_SUMMARY_FIELDS, anonymiser, deanonymiser } from "../src/calc/aisummary.js";
import { adviceHomeHtml, adviceStripHtml } from "../src/components/advice.js";
import { reviewHtml, askBody, askClaude, SYSTEM_PROMPT, copyPrompt, REVIEW_FORMAT, askClaudeHtml, askUi } from "../src/components/askclaude.js";

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

test("what's on track folds under the rest on Insights and stays off a page's strip", function(){
  var items = [
    { id: "r", kind: "risk", area: "cashflow", title: "Short of cash", detail: "d" },
    { id: "g1", kind: "good", area: "cashflow", title: "Holds up under a rate rise", detail: "d" },
    { id: "g2", kind: "good", area: "cashflow", title: "Kept most of what came in", detail: "d" }
  ];
  var html = adviceHomeHtml(items);
  assert.match(html, /data-adv-good><summary><span class="adv-kind">On track<\/span><span class="adv-title">2 things holding up/);
  assert.ok(html.indexOf('data-adv-id="r"') < html.indexOf("data-adv-good"), "what to act on first");
  assert.match(html, /data-adv-id="g2"/, "each one still there, inside the fold");
  var strip = adviceStripHtml(items, "cashflow");
  assert.ok(!/g1|g2/.test(strip) && /data-adv-id="r"/.test(strip));
  assert.equal(adviceStripHtml(items.slice(1), "cashflow"), "", "nothing to act on, no strip");
});

test("the summary sent for a review carries no names, addresses or scenario names", function(){
  withHousehold(function(){
    var t = householdSummary(adviceFor({ today: "2026-10-20" }), { today: "2026-10-20" });
    ["Alex", "Sam", "Example St", "Example Town", "Everyday"].forEach(function(w){ assert.ok(t.indexOf(w) === -1, w + " leaked"); });
    assert.match(t, /Household gross income/);
    assert.match(t, /Net worth/);
    assert.doesNotMatch(t, /Partner A|Investment property 1|Scenario 2|Holding 1/);
    assert.doesNotMatch(t, /FND|TN1|TN2/);
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
  assert.match(b.messages[0].content, /SUMMARY[\s\S]*general review/);
  assert.doesNotMatch(b.messages[0].content, /Should we buy/);
  var h = reviewHtml("## Buying\n- **Cash** is fine\n- rates <b>\n\nPlain line");
  assert.match(h, /<h4>Buying<\/h4><ul><li><b>Cash<\/b> is fine<\/li><li>rates &lt;b><\/li><\/ul><p>Plain line<\/p>/);
});

test("the prompt for any AI: how to answer, in the standard layout, then the approved figures only", function(){
  var t = copyPrompt("SUMMARY LINES", "Sydney or Melbourne?");
  assert.ok(t.indexOf("HOW TO ANSWER") < t.indexOf("MY FINANCES"));
  assert.ok(t.indexOf(REVIEW_FORMAT) !== -1, "the standard headings travel with it");
  assert.match(t, /Do not infer missing individual details/);
  assert.match(t, /## Priorities/);
  assert.doesNotMatch(t, /Sydney or Melbourne/);
  assert.ok(copyPrompt("S", "").indexOf("MY QUESTION") === -1);
  askUi.pasteOpen = true;
  var h = askClaudeHtml();
  assert.match(h, /data-ai-copy>Copy for any AI/);
  assert.match(h, /data-ai-paste/);
  askUi.pasteOpen = false;
});

test("AI summary excludes arbitrary names, addresses, nested notes, tickers and finding prose", function(){
  withHousehold(function(){
    const secret = "PRIVATE_IDENTIFIER_DO_NOT_TRANSMIT";
    state.shared.push({ id: "x", what: secret, category: secret, classification: secret, amount: 120, freq: "Monthly", notes: secret });
    state.assets.push({ category: secret, what: secret, symbol: secret, amount: 1234, notes: { nested: secret } });
    state.properties[0].what = secret;
    state.properties[0].state = "NSW";
    state.properties[0].loans[0].what = secret;
    state.scenarios[1] = secret;
    state.purchase[secret] = state.purchase["Buy Example Town"];
    state.home[secret] = [];
    const output = householdSummary([{ kind: "risk", title: secret, detail: secret, notes: { nested: secret } }], { today: "2026-10-20" });
    assert.ok(!output.includes(secret), "no arbitrary user-entered string is transmitted");
    assert.doesNotMatch(output, /Partner A|Scenario 2|Holding 1/);
    assert.match(output, /Risk findings \(count\): 1/);
  });
});

test("free-text questions with identifiers never reach direct or copy AI payloads", function(){
  const secret = "PRIVATE_ACCOUNT_12345 Example Street";
  const direct = askBody("Aggregated income $1000", secret, "claude-sonnet-5-5");
  const copied = copyPrompt("Aggregated income $1000", secret);
  assert.equal(JSON.stringify(direct).includes(secret), false);
  assert.equal(copied.includes(secret), false);
  assert.match(direct.messages[0].content, /Aggregated income/);
  assert.match(copied, /Aggregated income/);
  const html = askClaudeHtml();
  assert.match(html, /personal questions and free-text notes are not included/);
  assert.doesNotMatch(html, /data-ai-q/);
});

test("AI aggregate snapshot has only allowlisted fields and no individual financial rows", function(){
  withHousehold(function(){
    const snapshot = aiAggregateSnapshot([{ kind: "risk", detail: "PRIVATE_NOTE" }], { today: "2026-10-20" });
    assert.deepEqual(Object.keys(snapshot), [...AI_SUMMARY_FIELDS]);
    assert.equal(snapshot.householdGrossAnnual, 285000);
    assert.equal(snapshot.findingRiskCount, 1);
    assert.equal(snapshot.budgetUnclassifiedMonthly, 0);
    const summary = householdSummary([], { today: "2026-10-20" });
    assert.doesNotMatch(summary, /Alex|Sam|Example|Loan A|Loan B|Holding 1|Scenario 1|2022/);
    assert.doesNotMatch(summary, /PRIVATE_NOTE/);
    assert.match(summary, /pseudonymised, not anonymous/);
  });
});

test("AI transport refuses missing, cancelled or stale approval without a network request", async function(){
  const oldFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async function(_url, opts){
    calls++;
    return { ok: true, json: async () => ({ content: [{ type: "text", text: opts.body }] }) };
  };
  try {
    const summary = "Household net worth $100,000";
    const approved = JSON.stringify(askBody(summary, ""), null, 2);
    await assert.rejects(askClaude(summary, ""), /not approved/);
    await assert.rejects(askClaude(summary, "", ""), /not approved/);
    await assert.rejects(askClaude(summary + " changed", "", approved), /not approved/);
    await assert.rejects(askClaude(summary, "", JSON.stringify(askBody(summary, ""))), /not approved/);
    assert.equal(calls, 0, "no fetch without exact approved body");
    const answer = await askClaude(summary, "", approved);
    assert.equal(answer, approved);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = oldFetch;
  }
});
