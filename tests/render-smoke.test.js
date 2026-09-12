import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { modernPlainRowHtml, modernRowShellHtml, optionsHtml, historyTrendHtml } from "../src/lib/ledger-table.js";
import { categoryChartHtml } from "../src/components/expenses.js";
import { sparklineHtml, sparklinePlaceholderHtml } from "../src/lib/charts.js";

// Why this file exists.
//
// Twice in one sitting this suite went fully green over a page that did not render at all:
//
//   1. `merchantKey` imported from the wrong module — the whole bank-import component failed to
//      load, and the page was dead.
//   2. `lineIdAttr(item)` called inside modernRowShellHtml(), which takes (section, idx, opts) and
//      has no `item` in scope — every budget row threw, and the Expenses list was empty.
//
// Both passed `node --check`. Both passed every test. Both were caught only by opening a browser.
// The reason is that the suite tested `calc/` — pure arithmetic — and never once *called* the
// functions that build the app's HTML.
//
// It turns out most of those builders are pure string functions: they take data and return markup,
// touching no DOM. So they can be called straight from the test runner, with no jsdom, no bundler
// and no new dependency — which matters, because "no dependencies, no build step" is the point of
// this project.
//
// These tests deliberately assert almost nothing about *what* the markup says. Pinning exact HTML
// would make every copy change a test failure and teach whoever comes next to stop reading them.
// What they assert is that the function runs and returns markup — which is precisely, and only,
// what was broken both times.

function ledgerItem(overrides){
  return Object.assign({
    id: "e1", what: "Groceries", classification: "Needs", category: "Groceries",
    account: "Everyday", amount: 430, freq: "Weekly", irregular: false, dueMonth: null,
    history: []
  }, overrides || {});
}

test("modernPlainRowHtml builds a budget row without a DOM", function(){
  // The exact call the Expenses page makes for every one of its rows. This is the one that broke.
  var html = modernPlainRowHtml(ledgerItem(), 0, "shared", {}, {
    showClass: true, showDone: true, categories: state.categories, activeScenario: state.activeScenario
  });
  assert.equal(typeof html, "string");
  assert.ok(html.indexOf('class="m-row') !== -1, "should produce a row element");
  assert.ok(html.indexOf('data-section="shared"') !== -1);
  assert.ok(html.indexOf('data-line-id="e1"') !== -1, "an item with an id is addressable from outside the list");
});

test("modernPlainRowHtml survives an item with nothing filled in", function(){
  // A row created by "+ Add expense" before the user types anything, and a row from an old save
  // that predates half these fields. Neither should be able to throw.
  var bare = modernPlainRowHtml({ what: "", amount: 0, freq: "Monthly" }, 0, "shared", {}, {});
  assert.ok(bare.indexOf('class="m-row') !== -1);
  assert.ok(bare.indexOf("data-line-id") === -1, "no id means no id attribute, not undefined");
  var empty = modernPlainRowHtml({}, 3, "shared", {}, { showClass: true });
  assert.equal(typeof empty, "string");
});

test("modernPlainRowHtml renders an open row, a computed row and every section it serves", function(){
  // Each of these takes a different branch through the shell, and only one of them is exercised by
  // the default case above.
  var open = modernPlainRowHtml(ledgerItem(), 0, "shared", { "shared:0": true }, { showClass: true });
  assert.ok(open.indexOf("m-row open") !== -1, "an open row renders its edit panel");
  var computed = modernPlainRowHtml(ledgerItem({ computed: true, computedNote: "from the loan" }), 1, "home:Renting", {}, {});
  assert.ok(computed.indexOf("computed") !== -1);
  ["shared", "income", "home:Renting", "propinc:p1", "propexp:p1", "tx"].forEach(function(section){
    var html = modernPlainRowHtml(ledgerItem(), 2, section, {}, { showClass: section !== "income" });
    assert.ok(html.indexOf('data-section="' + section + '"') !== -1, "section " + section + " renders");
  });
});

test("modernRowShellHtml runs with only the arguments it actually declares", function(){
  // The second bug, exactly: this function takes (section, idx, openState, summary, edit, opts) and
  // reached for an `item` that was never passed to it.
  var shell = modernRowShellHtml("shared", 0, {}, "<span>summary</span>", "<div>edit</div>", {});
  assert.ok(shell.indexOf('data-section="shared"') !== -1);
  assert.ok(shell.indexOf("data-line-id") === -1, "no lineId in opts means the attribute is simply absent");
  var withId = modernRowShellHtml("shared", 0, {}, "<span>s</span>", "", { lineId: "e9", computed: true });
  assert.ok(withId.indexOf('data-line-id="e9"') !== -1);
});

test("optionsHtml and historyTrendHtml handle empty and populated inputs", function(){
  assert.ok(optionsHtml(["Monthly", "Weekly"], "Weekly").indexOf("selected") !== -1);
  assert.equal(typeof optionsHtml([], ""), "string");
  assert.equal(typeof historyTrendHtml({ history: [] }), "string");
  assert.equal(typeof historyTrendHtml({}), "string", "an item with no history array at all");
  assert.equal(typeof historyTrendHtml({ history: [{ date: "2026-01-01", value: 100 }, { date: "2026-06-01", value: 140 }] }), "string");
});

test("categoryChartHtml handles one group, many groups, and a negative one", function(){
  // The negative case is the one that had real geometry consequences (refunds), so it stays pinned
  // here as well as in its own test.
  assert.equal(categoryChartHtml([{ key: "Groceries", monthly: 300 }], "/mo"), "", "one group is not a breakdown");
  var many = categoryChartHtml([{ key: "Groceries", monthly: 300 }, { key: "Transport", monthly: 150 }], "/mo");
  assert.ok(many.indexOf("rule-seg") !== -1);
  var withNegative = categoryChartHtml([
    { key: "Groceries", monthly: 300 }, { key: "Transport", monthly: 150 }, { key: "Clothing", monthly: -40 }
  ], "/mo");
  assert.ok(withNegative.indexOf("is-credit") !== -1, "a net-refund category is labelled, not drawn as a slice");
  assert.ok(withNegative.indexOf("width:-") === -1, "and never given a negative width");
  assert.equal(categoryChartHtml([], "/mo"), "");
});

test("the sparkline survives empty, single-point and flat histories", function(){
  // Every one of these is a real state of a new save: nothing logged, one snapshot, or a value that
  // hasn't moved. A divide-by-zero here draws a broken line rather than throwing, so "it didn't
  // error" is not evidence — the assertion is on the coordinates.
  assert.equal(sparklineHtml([]), "", "nothing to draw yet");
  assert.equal(sparklineHtml([{ date: "2026-01-01", value: 10 }]), "", "one point is not a trend");
  var flat = sparklineHtml([{ date: "2026-01-01", value: 10 }, { date: "2026-02-01", value: 10 }]);
  assert.ok(flat.indexOf("NaN") === -1, "a flat series divides by a zero range");
  var real = sparklineHtml([{ date: "2026-01-01", value: 10 }, { date: "2026-02-01", value: 40 }]);
  assert.ok(real.indexOf("NaN") === -1 && real.indexOf("<svg") !== -1);
  assert.equal(typeof sparklinePlaceholderHtml(), "string");
});

// renderLineChart() is deliberately NOT here: it takes a container element and builds its output
// with document.createElement, so it cannot run in this runner. Stubbing a document for it would
// buy a passing test and no real confidence — that one is verified by driving the app, which is
// the right tool for a function whose whole job is touching the DOM.
