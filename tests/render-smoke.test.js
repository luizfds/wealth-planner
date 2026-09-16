import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { modernPlainRowHtml, modernRowShellHtml, optionsHtml, historyTrendHtml } from "../src/lib/ledger-table.js";
import { categoryChartHtml, irregularBudgetSectionHtml, budgetComparisonRowHtml, transactionAccountOptionsHtml } from "../src/components/expenses.js";
import { todaysMixHtml } from "../src/components/assets.js";
import { sparklineHtml, sparklinePlaceholderHtml, dateAxisFormat } from "../src/lib/charts.js";
import { rangeByKey, rangeLabel, rangeStartDate, withinRange, bestFitRange, timeRangeControlHtml } from "../src/lib/timerange.js";

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

test("todaysMixHtml builds the composition bar, and refuses to when there is nothing to divide", function(){
  var buckets = [
    { key: "Super", colorClass: "series-color-0", records: [{ history: [], current: 179806 }] },
    { key: "Cash", colorClass: "series-color-2", records: [{ history: [], current: 1076 }] }
  ];
  var html = todaysMixHtml(buckets, "2026-09-12");
  assert.ok(html.indexOf("rule-seg series-color-0") !== -1, "a series-coloured segment per bucket");
  assert.ok(html.indexOf("rule-swatch series-color-2") !== -1, "and a matching legend swatch");
  assert.ok(html.indexOf("width:-") === -1);
  // A bucket holding nothing today is dropped rather than drawn as a zero-width sliver with a
  // legend entry nobody can point at.
  assert.ok(todaysMixHtml(buckets.concat([{ key: "Shares", colorClass: "series-color-1", records: [] }]), "2026-09-12")
    .indexOf("series-color-1") === -1);
  assert.equal(todaysMixHtml([], "2026-09-12"), "");
  assert.equal(todaysMixHtml([{ key: "Cash", colorClass: "series-color-2", records: [{ history: [], current: 0 }] }], "2026-09-12"), "",
    "nothing owned is not a pie chart of nothing");
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

// ---------------- The shared time-range control ----------------

test("rangeStartDate is unbounded for All and a real date for every fixed window", function(){
  // null means "no lower bound", which callers must treat as unbounded rather than as today —
  // reading it as a date would silently hide everything.
  assert.equal(rangeStartDate(rangeByKey("all"), { today: "2026-09-12" }), null);
  assert.equal(rangeStartDate(rangeByKey("1d"), { today: "2026-09-12" }), "2026-09-11");
  assert.equal(rangeStartDate(rangeByKey("1m"), { today: "2026-09-12" }), "2026-08-13");
  assert.equal(rangeStartDate(rangeByKey("1y"), { today: "2026-09-12" }), "2025-09-12");
  // A window that crosses a month and a year boundary, which naive date arithmetic gets wrong.
  assert.equal(rangeStartDate(rangeByKey("3m"), { today: "2026-01-15" }), "2025-10-17");
});

test("the YTD window starts at the household's own year, not January", function(){
  // The household year is a preference — on the financial basis a "year to date" figure measured
  // from 1 January is simply a different number, which is why the caller passes the boundary in.
  assert.equal(rangeStartDate(rangeByKey("ytd"), { today: "2026-09-12", yearStart: "2026-07-01" }), "2026-07-01");
  assert.equal(rangeLabel(rangeByKey("ytd"), "financial"), "FYTD");
  assert.equal(rangeLabel(rangeByKey("ytd"), "calendar"), "YTD");
});

test("withinRange keeps what's inside, drops what's outside, and drops undated rows", function(){
  var rows = [
    { date: "2026-09-10", amount: 1 },
    { date: "2026-01-02", amount: 2 },
    { date: "", amount: 3 },
    { amount: 4 }
  ];
  var recent = withinRange(rows, rangeByKey("1m"), { today: "2026-09-12" });
  assert.deepEqual(recent.map(function(r){ return r.amount; }), [1]);
  // A row that can't say when it happened cannot honestly appear under "the last 3 months" —
  // but it must still survive "All", or it would be unreachable from the list entirely.
  var all = withinRange(rows, rangeByKey("all"), { today: "2026-09-12" });
  assert.deepEqual(all.map(function(r){ return r.amount; }), [1, 2],
    "undated rows are dropped even by All — they have no place on a dated axis");
});

test("dateAxisFormat picks days inside a quarter and months beyond it", function(){
  // "Aug 2026 / Sep 2026" is the whole axis of a four-week window, which is no axis at all — and
  // the range controls mean one chart now spans a week or a decade depending on the button.
  var day = 86400000;
  var short_ = dateAxisFormat([{ x: Date.UTC(2026, 7, 24) }, { x: Date.UTC(2026, 8, 12) }]);
  assert.ok(/\d/.test(short_(Date.UTC(2026, 8, 12))));
  assert.ok(short_(Date.UTC(2026, 8, 12)).indexOf("2026") === -1, "a three-week span doesn't need the year");
  var long_ = dateAxisFormat([{ x: Date.UTC(2025, 6, 31) }, { x: Date.UTC(2026, 8, 12) }]);
  assert.ok(long_(Date.UTC(2026, 8, 12)).indexOf("2026") !== -1, "a 13-month span does");
  // Exactly at the boundary, and with too few points to have a span at all.
  assert.ok(dateAxisFormat([{ x: 0 }, { x: 100 * day }])(0).indexOf("1970") === -1, "100 days is still short");
  assert.equal(typeof dateAxisFormat([])(0), "string");
  assert.equal(typeof dateAxisFormat(null)(0), "string");
});

test("bestFitRange opens a chart where its observations actually are", function(){
  var at = { today: "2026-09-12" };
  // The reference data's shape: one super reading from July 2025, then a fortnight of daily share
  // logs. "All" spends 95% of the x-axis on the period before anything but super was tracked.
  var clustered = ["2025-07-31", "2026-08-31", "2026-09-07", "2026-09-08", "2026-09-09",
                   "2026-09-10", "2026-09-11", "2026-09-12"];
  assert.equal(bestFitRange(clustered, at), "1w", "six of eight points sit inside the last week");
  // The ordinary case — a year of even monthly logs — has no window better than all of it.
  var monthly = [];
  for(var m = 0; m < 12; m++) monthly.push("2025-" + String(m + 1).padStart(2, "0") + "-01");
  assert.equal(bestFitRange(monthly.concat(["2026-09-12"]), at), "all");
  // Too few points to be framing anything.
  assert.equal(bestFitRange(["2026-09-11", "2026-09-12"], at), "all");
  assert.equal(bestFitRange([], at), "all");
  assert.equal(bestFitRange(null, at), "all");
});

test("timeRangeControlHtml marks the selection and can omit windows", function(){
  var html = timeRangeControlHtml("3m", "tx-range", { omit: ["1d", "1w"] });
  assert.ok(html.indexOf('data-tx-range="3m"') !== -1);
  assert.ok(html.indexOf('aria-pressed="true"') !== -1, "the active option is announced, not just coloured");
  assert.ok(html.indexOf('data-tx-range="1d"') === -1, "omitted windows are absent, not disabled");
  assert.ok(html.indexOf('data-tx-range="all"') !== -1);
});

// Actual vs. planned: an irregular (reserve) row is drillable, and over its own year.
//
// These rows rendered as a flat bar with no expander at all, so the transactions making up their
// "actual" figure had nowhere to be seen — the one case where that matters most, since an
// irregular line's spend can be a single receipt from eleven months ago rather than something
// sitting in this month's Transactions list.
//
// The window is the row's reserve year, not the calendar month, so these use today's date, which
// falls inside all three bases (calendar, financial, rolling12) whichever one a row is set to.
function reserveItem(overrides){
  return Object.assign({
    id: "irr1", what: "Trips", classification: "Wants", category: "Travel",
    account: "Everyday", amount: 20000, freq: "Yearly", irregular: true, history: []
  }, overrides || {});
}
const TODAY_ISO = new Date().toLocaleDateString("en-CA");

test("irregularBudgetSectionHtml renders a reserve row", () => {
  const prev = state.transactions;
  state.transactions = [];
  try {
    const html = irregularBudgetSectionHtml([reserveItem()]);
    assert.match(html, /<div/);
    assert.match(html, /Trips/);
    assert.match(html, /budget-bar-fill/);
  } finally { state.transactions = prev; }
});

test("an irregular row with spend in its reserve year is expandable", () => {
  const prev = state.transactions;
  state.transactions = [{ date: TODAY_ISO, amount: 1200, what: "Flights", linkedExpenseId: "irr1" }];
  try {
    const html = irregularBudgetSectionHtml([reserveItem()]);
    assert.match(html, /data-budget-row-toggle="irr1"/);
    assert.match(html, /is-expandable/);
    assert.match(html, /aria-expanded="false"/);
  } finally { state.transactions = prev; }
});

test("an irregular row with nothing logged stays a plain row", () => {
  const prev = state.transactions;
  // Linked to a different line, so this row's own reserve year is empty.
  state.transactions = [{ date: TODAY_ISO, amount: 1200, what: "Flights", linkedExpenseId: "other" }];
  try {
    const html = irregularBudgetSectionHtml([reserveItem()]);
    assert.ok(!html.includes("data-budget-row-toggle"), "should carry no toggle");
    assert.ok(!html.includes("is-expandable"), "should not be marked expandable");
  } finally { state.transactions = prev; }
});

test("an irregular row ignores spend outside its reserve year", () => {
  const prev = state.transactions;
  // Ten years back is outside every reserve-year basis.
  const longAgo = String(Number(TODAY_ISO.slice(0, 4)) - 10) + TODAY_ISO.slice(4);
  state.transactions = [{ date: longAgo, amount: 1200, what: "Flights", linkedExpenseId: "irr1" }];
  try {
    const html = irregularBudgetSectionHtml([reserveItem()]);
    assert.ok(!html.includes("data-budget-row-toggle"), "out-of-window spend should not make it expandable");
  } finally { state.transactions = prev; }
});

// ---------------- One row builder for both kinds of budget line ----------------
// Regular and irregular rows were two hand-written builders drifting side by side, and that split
// produced two reported gaps in a row (no progress bar on irregular rows until v3.7.0, no
// drill-down until v3.8.0) — each time because a change landed on one builder and not the other.
// They share one now, with `cycle` as the only branch.

// A quarterly line whose cycle opened two months ago, so "inside the cycle" and "inside this
// calendar month" are genuinely different windows — which is the whole point of the drill-down
// reading off cycle.start/end rather than the month.
function quarterlyItem(){
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const cycleStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  return { id: "q1", what: "Gas", amount: 230, freq: "Quarterly", irregular: false,
           dueMonth: cycleStart.getMonth() + 1, classification: "Needs", category: "", history: [] };
}
function isoInMonthsBack(n, day){
  const d = new Date(); d.setHours(0, 0, 0, 0);
  return new Date(d.getFullYear(), d.getMonth() - n, day).toLocaleDateString("en-CA");
}

test("a multi-month cycle drills into its whole cycle, not just this month", () => {
  const prev = state.transactions;
  // One charge last month: inside the quarterly cycle, outside the calendar month. Counted in the
  // row's "actual" either way, so listing only this month left the list not adding up to the
  // figure sitting above it.
  state.transactions = [{ id: "t1", date: isoInMonthsBack(1, 15), amount: 117, what: "Gas (last month)", linkedExpenseId: "q1" }];
  try {
    const html = budgetComparisonRowHtml(quarterlyItem());
    assert.match(html, /is-expandable/, "a charge inside the cycle must make the row drillable");
    assert.match(html, /data-budget-row-toggle="q1"/);
  } finally { state.transactions = prev; }
});

test("a charge outside the cycle entirely does not make the row drillable", () => {
  const prev = state.transactions;
  state.transactions = [{ id: "t1", date: isoInMonthsBack(11, 15), amount: 117, what: "Ancient", linkedExpenseId: "q1" }];
  try {
    const html = budgetComparisonRowHtml(quarterlyItem());
    assert.ok(!html.includes("data-budget-row-toggle"), "out-of-cycle spend is not this cycle's");
  } finally { state.transactions = prev; }
});

test("under budget reads as good news on a regular line but not on a reserve line", () => {
  const prev = state.transactions;
  state.transactions = [];
  try {
    // Regular monthly line, nothing spent: genuinely under this month's bill, so green.
    const regular = budgetComparisonRowHtml({ id: "r1", what: "Internet", amount: 99, freq: "Monthly",
      irregular: false, classification: "Needs", category: "", history: [] });
    assert.match(regular, /var\(--good\)/);
    // Reserve line, nothing spent: being under a whole year's allowance is the normal state of
    // affairs, not an achievement, so no green.
    const reserve = budgetComparisonRowHtml({ id: "i1", what: "Trips", amount: 20000, freq: "Yearly",
      irregular: true, classification: "Wants", category: "", history: [] });
    assert.ok(!reserve.includes("var(--good)"), "a reserve line under budget is not good news");
  } finally { state.transactions = prev; }
});

// ---------------- A deleted account's name survives on the rows that used it ----------------
// deleteAccount() leaves `row.account` alone rather than blanking it: an account is a statement of
// fact about where money moved, and because the link is by name, re-adding one spelled the same
// way re-attaches everything by itself. The catch is that a row can then name an account that is
// not in state.accounts, and a <select> whose value matches none of its options does not render
// empty — the browser falls back to the *first* option, so the row would silently read
// "— No account —" and the next edit would save that over a real fact.
test("the account select keeps an option for a name that no longer exists", () => {
  const prev = state.accounts;
  state.accounts = [{ id: "a1", name: "Commbank", type: "debit" }];
  try {
    const html = transactionAccountOptionsHtml("Credit Card");
    assert.match(html, /value="Credit Card" selected/, "the missing name must still be selectable");
    assert.match(html, /Credit Card \(deleted\)/, "and must say why it is not in the list");
    // The empty option must not be the selected one, or the row reads as unattributed.
    assert.ok(!/<option value="" selected/.test(html), html);
  } finally { state.accounts = prev; }
});

test("a known account selects normally, with no deleted marker", () => {
  const prev = state.accounts;
  state.accounts = [{ id: "a1", name: "Commbank", type: "debit" }, { id: "a2", name: "Amex", type: "credit" }];
  try {
    const html = transactionAccountOptionsHtml("Amex");
    assert.match(html, /value="Amex" selected/);
    assert.ok(!html.includes("(deleted)"), html);
    assert.match(html, /Amex \(credit\)/, "a credit card still says so");
  } finally { state.accounts = prev; }
});

test("no account selected leaves the empty option selected", () => {
  const prev = state.accounts;
  state.accounts = [{ id: "a1", name: "Commbank", type: "debit" }];
  try {
    const html = transactionAccountOptionsHtml("");
    assert.match(html, /<option value="" selected/);
    assert.ok(!html.includes("(deleted)"), html);
  } finally { state.accounts = prev; }
});
